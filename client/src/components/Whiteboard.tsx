// client/src/components/Whiteboard.tsx
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Attachment, CanvasElement, CanvasTool } from '../types';
import { uid } from '../lib/factory';
import { downloadBlob, dataUrlToBlob, fileToAttachment } from '../lib/io';
import {
  BOARD_H,
  BOARD_W,
  bbox,
  center,
  drawElement,
  elementLabel,
  elementsForAttachments,
  fontFor,
  HANDLE_UV,
  HANDLES,
  hit,
  keepsAspect,
  renderBoard,
  resizeByHandle,
  STICKY_COLORS,
  toLocal,
  translate,
  type Handle,
  type Pt,
} from '../lib/canvasDraw';

export { BOARD_H, BOARD_W, renderBoard };

const COLORS = ['#111827', '#3b8bf7', '#a93bf5', '#ef4444', '#f59e0b', '#22c55e', '#ffffff'];
const TOOLS: { id: CanvasTool; icon: string; label: string; key: string }[] = [
  { id: 'select', icon: '🖐️', label: 'Seç / taşı / döndür (V)', key: 'v' },
  { id: 'pen', icon: '✏️', label: 'Kalem (P)', key: 'p' },
  { id: 'highlighter', icon: '🖍️', label: 'Fosforlu (H)', key: 'h' },
  { id: 'eraser', icon: '🧽', label: 'Silgi (E)', key: 'e' },
  { id: 'line', icon: '╱', label: 'Çizgi (L)', key: 'l' },
  { id: 'arrow', icon: '➜', label: 'Ok (A)', key: 'a' },
  { id: 'rect', icon: '▭', label: 'Dikdörtgen (R)', key: 'r' },
  { id: 'ellipse', icon: '◯', label: 'Elips (O)', key: 'o' },
  { id: 'text', icon: '𝐓', label: 'Yazı — tıkla ve yaz (T)', key: 't' },
  { id: 'sticky', icon: '📌', label: 'Not kağıdı (N)', key: 'n' },
];

interface Props {
  elements: CanvasElement[];
  onChange: (els: CanvasElement[]) => void;
  attachments: Attachment[];
  /** new files picked from the toolbar → parent stores them on the step */
  onAddAttachments?: (atts: Attachment[]) => void;
  /** double-click on image / media card */
  onOpenMedia?: (attachmentId: string) => void;
  title?: string;
  compact?: boolean;
  /** fill the parent in both dimensions (fullscreen) instead of width only */
  fit?: boolean;
  toolbarExtra?: ReactNode;
}

interface Editor {
  id: string | null; // null → new element
  kind: 'text' | 'sticky';
  x: number;
  y: number;
  w: number;
  h: number;
  value: string;
  fontSize: number;
  color: string;
  fill?: string;
  rotation: number;
}

type Drag =
  | { mode: 'move'; id: string; start: Pt; orig: CanvasElement }
  | { mode: 'resize'; id: string; handle: Handle; orig: CanvasElement }
  | { mode: 'rotate'; id: string; orig: CanvasElement };

const ROT_GAP = 34; // css px between frame and rotate handle
const HANDLE_PX = 11;

export function Whiteboard({ elements, onChange, attachments, onAddAttachments, onOpenMedia, title = 'tuval', compact = false, fit = false, toolbarExtra }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tool, setToolState] = useState<CanvasTool>('pen');
  const [color, setColor] = useState(COLORS[1]);
  const [width, setWidth] = useState(6);
  const [draft, setDraft] = useState<CanvasElement | null>(null);
  const [working, setWorking] = useState<CanvasElement[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [past, setPast] = useState<CanvasElement[][]>([]);
  const [future, setFuture] = useState<CanvasElement[][]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [showLayers, setShowLayers] = useState(false);
  const [size, setSize] = useState({ w: 800, h: 450 });
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<Drag | null>(null);
  const latest = useRef(elements);
  latest.current = elements;
  const editorDone = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const scale = size.w / BOARD_W;

  // focus the inline editor on the next frame (after the pointer sequence has finished)
  const editorKey = editor ? `${editor.id ?? 'new'}-${editor.x}-${editor.y}` : '';
  useEffect(() => {
    if (!editorKey) return;
    const raf = requestAnimationFrame(() => {
      const t = editorRef.current;
      if (t) {
        t.focus({ preventScroll: true });
        t.setSelectionRange(t.value.length, t.value.length);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [editorKey]);
  const list = working ?? elements;
  const selected = list.find((e) => e.id === selectedId) ?? null;

  const setTool = (t: CanvasTool) => {
    setToolState(t);
    if (t !== 'select') setSelectedId(null);
  };

  const commit = useCallback(
    (next: CanvasElement[]) => {
      setPast((p) => [...p.slice(-59), latest.current]);
      setFuture([]);
      onChange(next);
    },
    [onChange],
  );
  const patchEl = (id: string, p: Partial<CanvasElement>) => commit(latest.current.map((e) => (e.id === id ? { ...e, ...p } : e)));

  /* ---------- sizing ---------- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      const cw = fit && h > 50 ? Math.min(w, (h * BOARD_W) / BOARD_H) : w;
      setSize({ w: Math.max(200, cw), h: (Math.max(200, cw) * BOARD_H) / BOARD_W });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  /* ---------- render ---------- */
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(size.w * dpr);
    c.height = Math.round(size.h * dpr);
    c.style.width = `${size.w}px`;
    c.style.height = `${size.h}px`;
    const ctx = c.getContext('2d')!;
    const k = scale * dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    const redraw = () => setTick((t) => t + 1);
    list.forEach((el) => {
      if (editor?.id === el.id) return;
      drawElement(ctx, el, attachments, redraw);
    });
    if (draft) drawElement(ctx, draft, attachments, redraw);

    // selection frame
    if (tool === 'select' && selected && !selected.hidden && editor?.id !== selected.id) {
      const b = bbox(selected);
      const cc = center(b);
      const pad = 6 / scale;
      const hs = HANDLE_PX / scale;
      ctx.save();
      ctx.translate(cc.x, cc.y);
      ctx.rotate(selected.rotation ?? 0);
      ctx.translate(-cc.x, -cc.y);
      ctx.strokeStyle = selected.locked ? '#94a3b8' : '#a93bf5';
      ctx.lineWidth = 1.5 / scale;
      ctx.setLineDash([6 / scale, 4 / scale]);
      ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
      ctx.setLineDash([]);
      if (!selected.locked) {
        const top = b.y - pad;
        ctx.beginPath();
        ctx.moveTo(cc.x, top);
        ctx.lineTo(cc.x, top - ROT_GAP / scale);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cc.x, top - ROT_GAP / scale, hs * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#a93bf5';
        ctx.font = `${hs}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('↻', cc.x, top - ROT_GAP / scale);
        HANDLES.forEach((h) => {
          const [u, v] = HANDLE_UV[h];
          const hx = b.x - pad + u * (b.w + pad * 2);
          const hy = b.y - pad + v * (b.h + pad * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
          ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
        });
      }
      ctx.restore();
    }
  }, [list, draft, attachments, size, scale, tick, tool, selected, editor]);

  /* ---------- helpers ---------- */
  const toBoard = (e: { clientX: number; clientY: number }): Pt => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * BOARD_W, y: ((e.clientY - r.top) / r.height) * BOARD_H };
  };
  const topHit = (p: Pt, tol?: number) => [...list].reverse().find((el) => hit(el, p, tol));

  function handleAt(el: CanvasElement, p: Pt): Handle | 'rotate' | null {
    if (el.locked) return null;
    const q = toLocal(el, p);
    const b = bbox(el);
    const pad = 6 / scale;
    const tol = (HANDLE_PX * 0.9) / scale;
    const cx = b.x + b.w / 2;
    if (Math.hypot(q.x - cx, q.y - (b.y - pad - ROT_GAP / scale)) < tol * 1.3) return 'rotate';
    for (const h of HANDLES) {
      const [u, v] = HANDLE_UV[h];
      const hx = b.x - pad + u * (b.w + pad * 2);
      const hy = b.y - pad + v * (b.h + pad * 2);
      if (Math.abs(q.x - hx) < tol && Math.abs(q.y - hy) < tol) return h;
    }
    return null;
  }

  const cursorFor = (h: Handle | 'rotate' | null, rot = 0): string => {
    if (!h) return '';
    if (h === 'rotate') return 'grab';
    const base = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 }[h] + (rot * 180) / Math.PI;
    const a = ((Math.round(base / 45) % 8) + 8) % 8;
    return ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'][a % 4];
  };

  /* ---------- inline editor ---------- */
  const openEditor = (ed: Editor) => {
    editorDone.current = false;
    setEditor(ed);
  };
  const closeEditor = (save: boolean) => {
    if (!editor || editorDone.current) return;
    editorDone.current = true;
    const text = editor.value.replace(/\s+$/, '');
    if (save) {
      if (editor.id) {
        if (!text.trim()) commit(latest.current.filter((e) => e.id !== editor.id));
        else patchEl(editor.id, { text });
      } else if (text.trim()) {
        const el: CanvasElement =
          editor.kind === 'text'
            ? { id: uid(), type: 'text', color: editor.color, width: 1, x: editor.x, y: editor.y, text, fontSize: editor.fontSize }
            : { id: uid(), type: 'sticky', color: '#1f2937', width: 1, x: editor.x, y: editor.y, w: editor.w, h: editor.h, text, fontSize: editor.fontSize, fill: editor.fill, rotation: editor.rotation };
        commit([...latest.current, el]);
        setSelectedId(el.id);
      }
    }
    setEditor(null);
  };
  const editExisting = (el: CanvasElement) => {
    const b = bbox(el);
    openEditor({
      id: el.id,
      kind: el.type === 'sticky' ? 'sticky' : 'text',
      x: b.x,
      y: b.y,
      w: b.w,
      h: b.h,
      value: el.text ?? '',
      fontSize: el.fontSize ?? 48,
      color: el.color,
      fill: el.fill,
      rotation: el.rotation ?? 0,
    });
  };

  /* ---------- pointer ---------- */
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (editor) {
      closeEditor(true);
      return;
    }
    const p = toBoard(e);
    if (tool === 'text' || tool === 'sticky') {
      // keep the browser's default mousedown from stealing focus from the editor we are about to open
      e.preventDefault();
    } else wrapRef.current?.focus({ preventScroll: true });
    if (tool === 'text') {
      openEditor({ id: null, kind: 'text', x: p.x, y: p.y - (24 + width * 4) * 0.6, w: 0, h: 0, value: '', fontSize: 24 + width * 4, color: color === '#ffffff' ? '#111827' : color, rotation: 0 });
      return;
    }
    if (tool === 'sticky') {
      const fill = STICKY_COLORS[latest.current.filter((x) => x.type === 'sticky').length % STICKY_COLORS.length];
      openEditor({ id: null, kind: 'sticky', x: p.x - 150, y: p.y - 40, w: 300, h: 230, value: '', fontSize: 26, color: '#1f2937', fill, rotation: 0 });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    if (tool === 'eraser') {
      const t = [...latest.current].reverse().find((el) => !el.locked && hit(el, p, 8));
      if (t) commit(latest.current.filter((x) => x.id !== t.id));
      return;
    }
    if (tool === 'select') {
      if (selected) {
        const h = handleAt(selected, p);
        if (h === 'rotate') {
          dragRef.current = { mode: 'rotate', id: selected.id, orig: selected };
          return;
        }
        if (h) {
          dragRef.current = { mode: 'resize', id: selected.id, handle: h, orig: selected };
          return;
        }
      }
      const t = topHit(p);
      setSelectedId(t?.id ?? null);
      if (t && !t.locked) dragRef.current = { mode: 'move', id: t.id, start: p, orig: t };
      return;
    }
    const base = { id: uid(), color, width: tool === 'highlighter' ? width * 4 : width, opacity: tool === 'highlighter' ? 0.35 : 1 };
    if (tool === 'pen' || tool === 'highlighter') setDraft({ ...base, type: 'path', points: [p.x, p.y] });
    else if (tool === 'line' || tool === 'arrow') setDraft({ ...base, type: tool, points: [p.x, p.y, p.x, p.y] });
    else if (tool === 'rect' || tool === 'ellipse') setDraft({ ...base, type: tool, x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toBoard(e);
    const drag = dragRef.current;
    if (drag) {
      let next: CanvasElement;
      if (drag.mode === 'move') next = translate(drag.orig, p.x - drag.start.x, p.y - drag.start.y);
      else if (drag.mode === 'resize') next = resizeByHandle(drag.orig, drag.handle, p, keepsAspect(drag.orig) !== e.shiftKey);
      else {
        const c = center(bbox(drag.orig));
        let a = Math.atan2(p.y - c.y, p.x - c.x) + Math.PI / 2;
        if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
        next = { ...drag.orig, rotation: a };
      }
      setWorking(latest.current.map((x) => (x.id === drag.id ? next : x)));
      return;
    }
    if (tool === 'eraser' && e.buttons === 1) {
      const t = latest.current.find((el) => !el.locked && hit(el, p, 8));
      if (t) commit(latest.current.filter((x) => x.id !== t.id));
      return;
    }
    if (tool === 'select' && canvasRef.current) {
      const h = selected ? handleAt(selected, p) : null;
      canvasRef.current.style.cursor = h ? cursorFor(h, selected?.rotation) : topHit(p) ? 'move' : '';
    }
    if (!draft) return;
    if (draft.type === 'path') setDraft({ ...draft, points: [...(draft.points ?? []), p.x, p.y] });
    else if (draft.type === 'line' || draft.type === 'arrow') setDraft({ ...draft, points: [draft.points![0], draft.points![1], p.x, p.y] });
    else setDraft({ ...draft, w: p.x - (draft.x ?? 0), h: p.y - (draft.y ?? 0) });
  };

  const onUp = () => {
    if (dragRef.current) {
      dragRef.current = null;
      if (working) commit(working);
      setWorking(null);
      return;
    }
    if (draft) {
      const b = bbox(draft);
      if (draft.type === 'path' || b.w > 3 || b.h > 3) {
        // normalise negative width/height for boxes
        commit([...latest.current, draft.type === 'rect' || draft.type === 'ellipse' ? { ...draft, x: b.x, y: b.y, w: b.w, h: b.h } : draft]);
      }
      setDraft(null);
    }
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const t = topHit(toBoard(e));
    if (!t || t.locked) return;
    if (t.type === 'text' || t.type === 'sticky') {
      setToolState('select');
      setSelectedId(t.id);
      editExisting(t);
    } else if ((t.type === 'image' || t.type === 'media') && t.attachmentId) onOpenMedia?.(t.attachmentId);
  };

  /* ---------- actions ---------- */
  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [...f, latest.current]);
    onChange(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, latest.current]);
    onChange(future[future.length - 1]);
    setFuture((f) => f.slice(0, -1));
  };
  const removeSelected = () => {
    if (!selected || selected.locked) return;
    commit(latest.current.filter((x) => x.id !== selected.id));
    setSelectedId(null);
  };
  const duplicate = () => {
    if (!selected) return;
    const copy = { ...translate(selected, 30, 30), id: uid(), locked: false };
    commit([...latest.current, copy]);
    setSelectedId(copy.id);
  };
  const reorder = (id: string, to: 'up' | 'down' | 'top' | 'bottom') => {
    const arr = latest.current.slice();
    const i = arr.findIndex((x) => x.id === id);
    if (i < 0) return;
    const [el] = arr.splice(i, 1);
    const j = to === 'top' ? arr.length : to === 'bottom' ? 0 : to === 'up' ? Math.min(arr.length, i + 1) : Math.max(0, i - 1);
    arr.splice(j, 0, el);
    commit(arr);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const atts: Attachment[] = [];
    for (const f of Array.from(files)) {
      try {
        atts.push(await fileToAttachment(f));
      } catch (err) {
        alert(err instanceof Error ? err.message : String(err));
      }
    }
    if (atts.length) {
      onAddAttachments?.(atts);
      const els = await elementsForAttachments(atts, latest.current.length);
      commit([...latest.current, ...els]);
      setToolState('select');
      setSelectedId(els[els.length - 1]?.id ?? null);
    }
    setBusy(false);
  };

  const exportPng = async () => {
    const url = await renderBoard(latest.current, attachments, BOARD_W);
    if (url) downloadBlob(dataUrlToBlob(url), `${title}.png`);
    else alert('Harici bağlantılı görseller PNG dışa aktarımını engelliyor (CORS). Görseli dosya olarak ekleyip tekrar dene.');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editor || (e.target as HTMLElement).closest('textarea, input, select')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      e.shiftKey ? redo() : undo();
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
    } else if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      duplicate();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
      e.preventDefault();
      removeSelected();
    } else if (e.key === 'Escape') setSelectedId(null);
    else if (e.key === 'Enter' && selected && (selected.type === 'text' || selected.type === 'sticky')) {
      e.preventDefault();
      editExisting(selected);
    } else if (selected && !selected.locked && e.key.startsWith('Arrow')) {
      // nudge — and keep arrows from changing the presentation step
      e.preventDefault();
      e.stopPropagation();
      const d = e.shiftKey ? 20 : 4;
      const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
      const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
      commit(latest.current.map((x) => (x.id === selected.id ? translate(x, dx, dy) : x)));
    } else if (!mod && !e.altKey) {
      const t = TOOLS.find((x) => x.key === e.key.toLowerCase());
      if (t) setTool(t.id);
    }
  };

  /* ---------- editor geometry (css px, relative to surface) ---------- */
  const edStyle = (() => {
    if (!editor) return undefined;
    const fs = editor.fontSize * scale;
    if (editor.kind === 'sticky') {
      return {
        left: editor.x * scale,
        top: editor.y * scale,
        width: editor.w * scale,
        height: editor.h * scale,
        fontSize: fs,
        background: editor.fill,
        color: '#1f2937',
        padding: `${(18 + 12) * scale}px ${18 * scale}px ${18 * scale}px`,
        transform: `rotate(${editor.rotation}rad)`,
      };
    }
    const lines = (editor.value || ' ').split('\n');
    const longest = Math.max(...lines.map((l) => l.length), 6);
    return {
      left: editor.x * scale,
      top: editor.y * scale,
      width: Math.min(size.w - editor.x * scale, longest * fs * 0.62 + fs),
      height: lines.length * fs * 1.2 + 6,
      fontSize: fs,
      lineHeight: 1.2,
      color: editor.color,
      font: fontFor(fs),
      transform: `rotate(${editor.rotation}rad)`,
    };
  })();

  return (
    <div className={`board ${compact ? 'board--compact' : ''} ${fit ? 'board--fit' : ''}`}>
      <div className="board-toolbar" role="toolbar" aria-label="Tuval araçları">
        <div className="seg">
          {TOOLS.map((t) => (
            <button key={t.id} className={`tool ${tool === t.id ? 'is-active' : ''}`} onClick={() => setTool(t.id)} title={t.label} aria-label={t.label} aria-pressed={tool === t.id}>
              {t.icon}
            </button>
          ))}
        </div>
        <div className="seg">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch ${color === c ? 'is-active' : ''}`}
              style={{ background: c }}
              onClick={() => {
                setColor(c);
                if (selected && !selected.locked && ['path', 'line', 'arrow', 'rect', 'ellipse', 'text'].includes(selected.type)) patchEl(selected.id, { color: c });
              }}
              aria-label={`Renk ${c}`}
            />
          ))}
        </div>
        <label className="seg width-ctl" title="Kalınlık / yazı boyutu">
          <span aria-hidden>●</span>
          <input type="range" min={2} max={24} value={width} onChange={(e) => setWidth(Number(e.target.value))} aria-label="Kalınlık" />
        </label>
        <div className="seg">
          <input ref={fileRef} type="file" hidden multiple accept="image/*,application/pdf,video/*,audio/*" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <button className="tool tool--wide" onClick={() => fileRef.current?.click()} disabled={busy} title="Görsel / PDF / video ekle → tuvale yerleşir">
            {busy ? '⏳' : '🖼️'} <span className="hide-sm">Medya</span>
          </button>
          <button className="tool" onClick={undo} disabled={!past.length} title="Geri al (Ctrl+Z)" aria-label="Geri al">↶</button>
          <button className="tool" onClick={redo} disabled={!future.length} title="Yinele (Ctrl+Y)" aria-label="Yinele">↷</button>
          <button className={`tool tool--wide ${showLayers ? 'is-active' : ''}`} onClick={() => setShowLayers((s) => !s)} title="Katmanlar" aria-pressed={showLayers}>
            🗂️ <span className="hide-sm">Katman</span>
          </button>
          <button className="tool" onClick={exportPng} title="PNG indir" aria-label="PNG indir">⬇️</button>
          <button className="tool" onClick={() => elements.length && confirm('Tuval temizlensin mi?') && commit([])} title="Temizle" aria-label="Temizle">🗑️</button>
        </div>
        {toolbarExtra}
      </div>

      {selected && tool === 'select' && (
        <div className="sel-bar" role="toolbar" aria-label="Seçili öğe">
          <span className="sel-name truncate">
            {elementLabel(selected, attachments).icon} {elementLabel(selected, attachments).name}
          </span>
          {(selected.type === 'text' || selected.type === 'sticky') && !selected.locked && (
            <button className="tool tool--wide" onClick={() => editExisting(selected)} title="Düzenle (Enter)">✎ <span className="hide-sm">Düzenle</span></button>
          )}
          {selected.type === 'sticky' && !selected.locked && (
            <span className="seg">
              {STICKY_COLORS.map((c) => (
                <button key={c} className={`swatch swatch--sm ${selected.fill === c ? 'is-active' : ''}`} style={{ background: c }} onClick={() => patchEl(selected.id, { fill: c })} aria-label="Not rengi" />
              ))}
            </span>
          )}
          {(selected.type === 'image' || selected.type === 'media') && selected.attachmentId && onOpenMedia && (
            <button className="tool tool--wide" onClick={() => onOpenMedia(selected.attachmentId!)} title="Slaytta aç">⛶ <span className="hide-sm">Aç</span></button>
          )}
          <button className="tool" onClick={() => reorder(selected.id, 'top')} title="En öne getir" aria-label="En öne">⤒</button>
          <button className="tool" onClick={() => reorder(selected.id, 'bottom')} title="En arkaya gönder" aria-label="En arkaya">⤓</button>
          <button className="tool" onClick={() => patchEl(selected.id, { rotation: 0 })} disabled={!selected.rotation} title="Döndürmeyi sıfırla" aria-label="Döndürmeyi sıfırla">⟲</button>
          <button className="tool" onClick={duplicate} title="Çoğalt (Ctrl+D)" aria-label="Çoğalt">⧉</button>
          <button className="tool" onClick={() => patchEl(selected.id, { locked: !selected.locked })} title={selected.locked ? 'Kilidi aç' : 'Kilitle'} aria-label="Kilit">{selected.locked ? '🔒' : '🔓'}</button>
          <button className="tool" onClick={removeSelected} disabled={selected.locked} title="Sil (Del)" aria-label="Sil">🗑️</button>
        </div>
      )}

      <div className={`board-body ${showLayers ? 'with-layers' : ''}`}>
        <div ref={wrapRef} className="board-surface-wrap" tabIndex={0} onKeyDown={onKeyDown} aria-label="Tuval — kısayollar: V seç, P kalem, T yazı, N not, Del sil">
          <div className="board-surface" style={{ width: size.w, height: size.h }}>
            <canvas
              ref={canvasRef}
              className={`tool-${tool}`}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onDoubleClick={onDoubleClick}
            />
            {editor && (
              <textarea
                ref={editorRef}
                className={`board-editor board-editor--${editor.kind}`}
                style={edStyle}
                value={editor.value}
                placeholder={editor.kind === 'sticky' ? 'Not yaz…' : 'Yaz…'}
                onChange={(e) => setEditor({ ...editor, value: e.target.value })}
                onBlur={() => closeEditor(true)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Escape') closeEditor(false);
                  else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) closeEditor(true);
                }}
              />
            )}
            {!elements.length && !draft && !editor && (
              <p className="board-empty" aria-hidden>
                Çizmeye başla · 𝐓 ile tıkla-yaz · 📌 not kağıdı · 🖼️ medya ekle
              </p>
            )}
          </div>
        </div>

        {showLayers && (
          <aside className="layers" aria-label="Katmanlar">
            <div className="layers-head">
              <b>🗂️ Katmanlar</b>
              <span className="muted small">{elements.length}</span>
            </div>
            {!elements.length && <p className="muted small">Henüz öğe yok.</p>}
            <ul>
              {[...elements].reverse().map((el, ri) => {
                const lbl = elementLabel(el, attachments);
                const idx = elements.length - 1 - ri;
                return (
                  <li key={el.id} className={`layer ${el.id === selectedId ? 'is-active' : ''} ${el.hidden ? 'is-hidden' : ''}`}>
                    <button
                      className="layer-main"
                      onClick={() => {
                        setToolState('select');
                        setSelectedId(el.id);
                      }}
                      title={lbl.name}
                    >
                      <span aria-hidden>{lbl.icon}</span>
                      <span className="truncate">{lbl.name}</span>
                    </button>
                    <button className="layer-btn" onClick={() => patchEl(el.id, { hidden: !el.hidden })} aria-label={el.hidden ? 'Göster' : 'Gizle'} title={el.hidden ? 'Göster' : 'Gizle'}>
                      {el.hidden ? '🙈' : '👁️'}
                    </button>
                    <button className="layer-btn" onClick={() => patchEl(el.id, { locked: !el.locked })} aria-label="Kilit" title={el.locked ? 'Kilidi aç' : 'Kilitle'}>
                      {el.locked ? '🔒' : '🔓'}
                    </button>
                    <button className="layer-btn" onClick={() => reorder(el.id, 'up')} disabled={idx === elements.length - 1} aria-label="Yukarı" title="Bir üst katman">
                      ▲
                    </button>
                    <button className="layer-btn" onClick={() => reorder(el.id, 'down')} disabled={idx === 0} aria-label="Aşağı" title="Bir alt katman">
                      ▼
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}
