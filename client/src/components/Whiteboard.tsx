// client/src/components/Whiteboard.tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Attachment, CanvasElement, CanvasTool } from '../types';
import { uid } from '../lib/factory';
import { downloadBlob, dataUrlToBlob } from '../lib/io';

export const BOARD_W = 1600;
export const BOARD_H = 900;
const COLORS = ['#111827', '#3b8bf7', '#a93bf5', '#ef4444', '#f59e0b', '#22c55e', '#ffffff'];
const TOOLS: { id: CanvasTool; icon: string; label: string }[] = [
  { id: 'select', icon: '🖐️', label: 'Taşı' },
  { id: 'pen', icon: '✏️', label: 'Kalem' },
  { id: 'highlighter', icon: '🖍️', label: 'Fosforlu' },
  { id: 'eraser', icon: '🧽', label: 'Silgi' },
  { id: 'line', icon: '╱', label: 'Çizgi' },
  { id: 'arrow', icon: '➜', label: 'Ok' },
  { id: 'rect', icon: '▭', label: 'Dikdörtgen' },
  { id: 'ellipse', icon: '◯', label: 'Elips' },
  { id: 'text', icon: '𝐓', label: 'Yazı' },
];

interface Props {
  elements: CanvasElement[];
  onChange: (els: CanvasElement[]) => void;
  attachments: Attachment[];
  title?: string;
  compact?: boolean;
}

const imageCache = new Map<string, HTMLImageElement>();

function bbox(el: CanvasElement): { x: number; y: number; w: number; h: number } {
  if (el.points && el.points.length >= 2) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < el.points.length; i += 2) {
      minX = Math.min(minX, el.points[i]);
      maxX = Math.max(maxX, el.points[i]);
      minY = Math.min(minY, el.points[i + 1]);
      maxY = Math.max(maxY, el.points[i + 1]);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  if (el.type === 'text') {
    const fs = el.fontSize ?? 48;
    const lines = (el.text ?? '').split('\n');
    return { x: el.x ?? 0, y: el.y ?? 0, w: Math.max(...lines.map((l) => l.length)) * fs * 0.55, h: lines.length * fs * 1.2 };
  }
  const x = el.x ?? 0, y = el.y ?? 0, w = el.w ?? 0, h = el.h ?? 0;
  return { x: Math.min(x, x + w), y: Math.min(y, y + h), w: Math.abs(w), h: Math.abs(h) };
}

function hit(el: CanvasElement, px: number, py: number, tol = 16): boolean {
  const b = bbox(el);
  return px >= b.x - tol && px <= b.x + b.w + tol && py >= b.y - tol && py <= b.y + b.h + tol;
}

function translate(el: CanvasElement, dx: number, dy: number): CanvasElement {
  if (el.points) return { ...el, points: el.points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)) };
  return { ...el, x: (el.x ?? 0) + dx, y: (el.y ?? 0) + dy };
}

function drawElement(ctx: CanvasRenderingContext2D, el: CanvasElement, atts: Attachment[], onImgLoad: () => void) {
  ctx.save();
  ctx.globalAlpha = el.opacity ?? 1;
  ctx.strokeStyle = el.color;
  ctx.fillStyle = el.color;
  ctx.lineWidth = el.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const pts = el.points ?? [];
  switch (el.type) {
    case 'path': {
      if (pts.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length - 2; i += 2) {
        const mx = (pts[i] + pts[i + 2]) / 2;
        const my = (pts[i + 1] + pts[i + 3]) / 2;
        ctx.quadraticCurveTo(pts[i], pts[i + 1], mx, my);
      }
      ctx.lineTo(pts[pts.length - 2], pts[pts.length - 1]);
      if (pts.length === 2) ctx.lineTo(pts[0] + 0.1, pts[1]);
      ctx.stroke();
      break;
    }
    case 'line':
    case 'arrow': {
      if (pts.length < 4) break;
      const [x1, y1, x2, y2] = pts;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (el.type === 'arrow') {
        const a = Math.atan2(y2 - y1, x2 - x1);
        const len = 18 + el.width * 2;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - len * Math.cos(a - 0.45), y2 - len * Math.sin(a - 0.45));
        ctx.lineTo(x2 - len * Math.cos(a + 0.45), y2 - len * Math.sin(a + 0.45));
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'rect':
      ctx.strokeRect(el.x ?? 0, el.y ?? 0, el.w ?? 0, el.h ?? 0);
      break;
    case 'ellipse': {
      const b = bbox(el);
      ctx.beginPath();
      ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'text': {
      const fs = el.fontSize ?? 48;
      ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      (el.text ?? '').split('\n').forEach((line, i) => ctx.fillText(line, el.x ?? 0, (el.y ?? 0) + i * fs * 1.2));
      break;
    }
    case 'image': {
      const att = atts.find((a) => a.id === el.attachmentId);
      const src = att?.dataUrl ?? att?.url;
      if (!src) break;
      let img = imageCache.get(src);
      if (!img) {
        img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = onImgLoad;
        img.src = src;
        imageCache.set(src, img);
      }
      if (img.complete && img.naturalWidth) ctx.drawImage(img, el.x ?? 0, el.y ?? 0, el.w ?? 400, el.h ?? 300);
      break;
    }
  }
  ctx.restore();
}

/** Off-screen render for thumbnails / reports. Waits for embedded images. */
export async function renderBoard(elements: CanvasElement[], atts: Attachment[], width = 800): Promise<string> {
  const srcs = elements
    .filter((e) => e.type === 'image')
    .map((e) => atts.find((a) => a.id === e.attachmentId))
    .map((a) => a?.dataUrl ?? a?.url)
    .filter((s): s is string => !!s);
  await Promise.all(
    srcs.map(
      (src) =>
        new Promise<void>((resolve) => {
          const cached = imageCache.get(src);
          if (cached?.complete) return resolve();
          const img = cached ?? new Image();
          img.crossOrigin = 'anonymous';
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
          if (!cached) {
            img.src = src;
            imageCache.set(src, img);
          }
        }),
    ),
  );
  const c = document.createElement('canvas');
  c.width = width;
  c.height = Math.round((width * BOARD_H) / BOARD_W);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(width / BOARD_W, 0, 0, width / BOARD_W, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);
  elements.forEach((el) => drawElement(ctx, el, atts, () => undefined));
  try {
    return c.toDataURL('image/png');
  } catch {
    return '';
  }
}

export function Whiteboard({ elements, onChange, attachments, title = 'tuval', compact = false }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<CanvasTool>('pen');
  const [color, setColor] = useState(COLORS[1]);
  const [width, setWidth] = useState(6);
  const [draft, setDraft] = useState<CanvasElement | null>(null);
  const [redo, setRedo] = useState<CanvasElement[][]>([]);
  const [past, setPast] = useState<CanvasElement[][]>([]);
  const [tick, setTick] = useState(0);
  const dragRef = useRef<{ id: string; lastX: number; lastY: number; moved: CanvasElement[] } | null>(null);
  const [cssW, setCssW] = useState(800);

  const commit = useCallback(
    (next: CanvasElement[]) => {
      setPast((p) => [...p.slice(-49), elements]);
      setRedo([]);
      onChange(next);
    },
    [elements, onChange],
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setCssW(Math.max(200, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // render
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssH = (cssW * BOARD_H) / BOARD_W;
    c.width = Math.round(cssW * dpr);
    c.height = Math.round(cssH * dpr);
    c.style.height = `${cssH}px`;
    const ctx = c.getContext('2d')!;
    ctx.setTransform((cssW * dpr) / BOARD_W, 0, 0, (cssW * dpr) / BOARD_W, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    const redraw = () => setTick((t) => t + 1);
    const list = dragRef.current ? dragRef.current.moved : elements;
    list.forEach((el) => drawElement(ctx, el, attachments, redraw));
    if (draft) drawElement(ctx, draft, attachments, redraw);
  }, [elements, draft, attachments, cssW, tick]);

  const toBoard = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * BOARD_W, y: ((e.clientY - r.top) / r.height) * BOARD_H };
  };

  const onDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = toBoard(e);
    if (tool === 'text') {
      const text = window.prompt('Tuvale yazılacak metin:');
      if (text?.trim()) commit([...elements, { id: uid(), type: 'text', color, width, x, y, text: text.trim(), fontSize: 24 + width * 4 }]);
      return;
    }
    if (tool === 'eraser') {
      const idx = [...elements].reverse().findIndex((el) => hit(el, x, y, 8));
      if (idx >= 0) commit(elements.filter((_, i) => i !== elements.length - 1 - idx));
      return;
    }
    if (tool === 'select') {
      const target = [...elements].reverse().find((el) => hit(el, x, y));
      if (target) dragRef.current = { id: target.id, lastX: x, lastY: y, moved: elements };
      return;
    }
    const base = { id: uid(), color, width: tool === 'highlighter' ? width * 4 : width, opacity: tool === 'highlighter' ? 0.35 : 1 };
    if (tool === 'pen' || tool === 'highlighter') setDraft({ ...base, type: 'path', points: [x, y] });
    else if (tool === 'line' || tool === 'arrow') setDraft({ ...base, type: tool, points: [x, y, x, y] });
    else if (tool === 'rect' || tool === 'ellipse') setDraft({ ...base, type: tool, x, y, w: 0, h: 0 });
  };

  const onMove = (e: React.PointerEvent) => {
    const { x, y } = toBoard(e);
    if (tool === 'eraser' && e.buttons === 1) {
      const idx = elements.findIndex((el) => hit(el, x, y, 8));
      if (idx >= 0) commit(elements.filter((_, i) => i !== idx));
      return;
    }
    const drag = dragRef.current;
    if (drag) {
      const dx = x - drag.lastX, dy = y - drag.lastY;
      drag.moved = drag.moved.map((el) => (el.id === drag.id ? translate(el, dx, dy) : el));
      drag.lastX = x;
      drag.lastY = y;
      setTick((t) => t + 1);
      return;
    }
    if (!draft) return;
    if (draft.type === 'path') setDraft({ ...draft, points: [...(draft.points ?? []), x, y] });
    else if (draft.type === 'line' || draft.type === 'arrow') setDraft({ ...draft, points: [draft.points![0], draft.points![1], x, y] });
    else setDraft({ ...draft, w: x - (draft.x ?? 0), h: y - (draft.y ?? 0) });
  };

  const onUp = () => {
    if (dragRef.current) {
      const moved = dragRef.current.moved;
      dragRef.current = null;
      if (moved !== elements) commit(moved);
      return;
    }
    if (draft) {
      commit([...elements, draft]);
      setDraft(null);
    }
  };

  const undo = () => {
    if (!past.length) return;
    setRedo((r) => [...r, elements]);
    onChange(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  };
  const redoFn = () => {
    if (!redo.length) return;
    setPast((p) => [...p, elements]);
    onChange(redo[redo.length - 1]);
    setRedo((r) => r.slice(0, -1));
  };

  const insertImage = (a: Attachment) => {
    const src = a.dataUrl ?? a.url;
    if (!src) return;
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(700 / img.naturalWidth, 500 / img.naturalHeight, 1);
      const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
      commit([...elements, { id: uid(), type: 'image', color: '#000', width: 1, attachmentId: a.id, x: (BOARD_W - w) / 2, y: (BOARD_H - h) / 2, w, h }]);
    };
    img.src = src;
  };

  const exportPng = () => {
    const c = canvasRef.current;
    if (!c) return;
    try {
      downloadBlob(dataUrlToBlob(c.toDataURL('image/png')), `${title}.png`);
    } catch {
      alert('Harici bağlantılı görseller PNG dışa aktarımını engelliyor (CORS). Görseli dosya olarak ekleyip tekrar dene.');
    }
  };

  const images = attachments.filter((a) => a.kind === 'image');

  return (
    <div className={`board ${compact ? 'board--compact' : ''}`}>
      <div className="board-toolbar" role="toolbar" aria-label="Tuval araçları">
        <div className="seg">
          {TOOLS.map((t) => (
            <button key={t.id} className={`tool ${tool === t.id ? 'is-active' : ''}`} onClick={() => setTool(t.id)} title={t.label} aria-label={t.label}>
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
              onClick={() => setColor(c)}
              aria-label={`Renk ${c}`}
            />
          ))}
        </div>
        <label className="seg width-ctl" title="Kalınlık">
          <span aria-hidden>●</span>
          <input type="range" min={2} max={24} value={width} onChange={(e) => setWidth(Number(e.target.value))} aria-label="Kalınlık" />
        </label>
        <div className="seg">
          <button className="tool" onClick={undo} disabled={!past.length} title="Geri al" aria-label="Geri al">↶</button>
          <button className="tool" onClick={redoFn} disabled={!redo.length} title="Yinele" aria-label="Yinele">↷</button>
          <button className="tool" onClick={() => elements.length && confirm('Tuval temizlensin mi?') && commit([])} title="Temizle" aria-label="Temizle">🗑️</button>
          <button className="tool" onClick={exportPng} title="PNG indir" aria-label="PNG indir">⬇️</button>
        </div>
        {images.length > 0 && (
          <select className="seg-select" value="" onChange={(e) => { const a = images.find((i) => i.id === e.target.value); if (a) insertImage(a); }} aria-label="Görsel ekle">
            <option value="">🖼️ Görsel ekle…</option>
            {images.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}
      </div>
      <div ref={wrapRef} className="board-surface">
        <canvas
          ref={canvasRef}
          className={`tool-${tool}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
      </div>
    </div>
  );
}
