// client/src/components/Whiteboard.tsx — vector whiteboard: tools, groups/layer folders, transforms, zoom & pan
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Attachment, CanvasElement, CanvasGroup, CanvasTool, CanvasView } from '../types';
import { uid } from '../lib/factory';
import { downloadBlob, dataUrlToBlob, fileToAttachment } from '../lib/io';
import { FrameworkPicker } from './FrameworkPicker';
import {
  BOARD_H,
  BOARD_W,
  bbox,
  clampView,
  MAX_ZOOM,
  MIN_ZOOM,
  WORLD,
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
  type Box,
  type Handle,
  type Pt,
} from '../lib/canvasDraw';
import {
  aabb,
  boxesIntersect,
  chainOf,
  duplicateNodes,
  expandNodes,
  groupMap,
  isFrozen,
  isHidden,
  isInside,
  rotateElements,
  scaleElements,
  subGroups,
  topNode,
  unionBox,
  visibleElements,
} from '../lib/canvasGroups';

export { BOARD_H, BOARD_W, renderBoard };

const COLORS = ['#111827', '#3b8bf7', '#a93bf5', '#ef4444', '#f59e0b', '#22c55e', '#ffffff'];
const TOOLS: { id: CanvasTool; icon: string; label: string; key: string }[] = [
  { id: 'select', icon: '🖐️', label: 'Seç / taşı / döndür (V) — Shift ile çoklu seçim', key: 'v' },
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

interface Scene {
  els: CanvasElement[];
  groups: CanvasGroup[];
}

interface Props {
  elements: CanvasElement[];
  groups?: CanvasGroup[];
  onChange: (els: CanvasElement[], groups: CanvasGroup[]) => void;
  attachments: Attachment[];
  onAddAttachments?: (atts: Attachment[]) => void;
  onOpenMedia?: (attachmentId: string) => void;
  title?: string;
  compact?: boolean;
  fit?: boolean;
  toolbarExtra?: ReactNode;
  /** initial zoom / pan (e.g. saved on the step) */
  view?: CanvasView;
  /** called (debounced) when the user zooms or pans — viewers follow it */
  onViewChange?: (v: CanvasView) => void;
}

interface Editor {
  id: string | null;
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
  | { mode: 'move'; start: Pt; origs: CanvasElement[] }
  | { mode: 'resize1'; handle: Handle; orig: CanvasElement }
  | { mode: 'rotate1'; orig: CanvasElement }
  | { mode: 'resizeN'; handle: Handle; box: Box; origs: CanvasElement[] }
  | { mode: 'rotateN'; pivot: Pt; a0: number; origs: CanvasElement[] }
  | { mode: 'marquee'; start: Pt; add: boolean }
  | { mode: 'pan'; sx: number; sy: number; ox: number; oy: number };

type View = CanvasView;
const DEFAULT_VIEW: View = { zoom: 1, ox: 0, oy: 0 };
const isDefault = (v: View) => Math.abs(v.zoom - 1) < 1e-3 && Math.abs(v.ox) < 0.5 && Math.abs(v.oy) < 0.5;

const ROT_GAP = 34;
const HANDLE_PX = 11;
const MIN_Z = MIN_ZOOM;
const MAX_Z = MAX_ZOOM;
const OPP: Record<Handle, Handle> = { nw: 'se', n: 's', ne: 'sw', e: 'w', se: 'nw', s: 'n', sw: 'ne', w: 'e' };


type TNode = { kind: 'g'; g: CanvasGroup; children: TNode[]; z: number; count: number } | { kind: 'e'; e: CanvasElement; z: number };

function buildTree(els: CanvasElement[], groups: CanvasGroup[]): TNode[] {
  const gnodes = new Map<string, Extract<TNode, { kind: 'g' }>>(groups.map((g) => [g.id, { kind: 'g', g, children: [], z: -1, count: 0 }]));
  const root: TNode[] = [];
  els.forEach((e, i) => {
    const parent = e.groupId ? gnodes.get(e.groupId) : undefined;
    (parent ? parent.children : root).push({ kind: 'e', e, z: i });
  });
  groups.forEach((g) => {
    const p = g.parentId && g.parentId !== g.id ? gnodes.get(g.parentId) : undefined;
    (p ? p.children : root).push(gnodes.get(g.id)!);
  });
  const settle = (n: TNode): number => {
    if (n.kind === 'e') return n.z;
    n.z = Math.max(-1, ...n.children.map(settle));
    n.count = n.children.reduce((a, c) => a + (c.kind === 'e' ? 1 : c.count), 0);
    n.children.sort((a, b) => b.z - a.z);
    return n.z;
  };
  root.forEach(settle);
  return root.sort((a, b) => b.z - a.z);
}

export function Whiteboard({ elements, groups = [], onChange, attachments, onAddAttachments, onOpenMedia, title = 'tuval', compact = false, fit = false, toolbarExtra, view: initialView, onViewChange }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tool, setToolState] = useState<CanvasTool>('pen');
  const [color, setColor] = useState(COLORS[1]);
  const [width, setWidth] = useState(6);
  const [draft, setDraft] = useState<CanvasElement | null>(null);
  const [working, setWorking] = useState<Scene | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [entered, setEntered] = useState<string | null>(null);
  const [past, setPast] = useState<Scene[]>([]);
  const [future, setFuture] = useState<Scene[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [showLayers, setShowLayers] = useState(false);
  const [showFw, setShowFw] = useState(false);
  const [size, setSize] = useState({ w: 800, h: 450 });
  const [view, setViewState] = useState<View>(() => clampView(initialView ?? DEFAULT_VIEW));
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [dragNode, setDragNode] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef<Drag | null>(null);
  const latest = useRef<Scene>({ els: elements, groups });
  latest.current = { els: elements, groups };
  const editorDone = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const spaceDown = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d0: number; z0: number; anchor: Pt; mid: { x: number; y: number } } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  const setView = (v: View) => setViewState(clampView(v));
  // report zoom / pan (debounced) so the step remembers it and viewers follow the presenter
  const reported = useRef(view);
  const onViewRef = useRef(onViewChange);
  onViewRef.current = onViewChange;
  useEffect(() => {
    const r = reported.current;
    if (r.zoom === view.zoom && r.ox === view.ox && r.oy === view.oy) return;
    const t = setTimeout(() => {
      reported.current = view;
      onViewRef.current?.(view);
    }, 180);
    return () => clearTimeout(t);
  }, [view]);
  const scale = size.w / BOARD_W;
  const s = scale * view.zoom; // board unit → css px
  const scene = working ?? { els: elements, groups };
  const gm = useMemo(() => groupMap(scene.groups), [scene.groups]);
  const selEls = useMemo(() => expandNodes(sel, scene.els, gm), [sel, scene.els, gm]);
  const single = sel.length === 1 ? scene.els.find((e) => e.id === sel[0]) ?? null : null;
  const selGroup = sel.length === 1 ? gm.get(sel[0]) ?? null : null;
  const frozenSel = sel.some((node) => expandNodes([node], scene.els, gm).some((e) => isFrozen(e, gm, node)));
  const selBox = !single && selEls.length ? unionBox(selEls) : null;
  const enteredBox = entered ? unionBox(expandNodes([entered], scene.els, gm)) : null;

  // focus inline editor after the pointer sequence
  const editorKey = editor ? `${editor.id ?? 'new'}-${editor.x}-${editor.y}` : '';
  // focus right after the DOM update (before paint) so the very first keystroke lands in the editor;
  // pointerdown.preventDefault() keeps the browser from moving focus away afterwards. rAF is a safety net.
  useLayoutEffect(() => {
    if (!editorKey) return;
    const focus = () => {
      const t = editorRef.current;
      if (t && document.activeElement !== t) {
        t.focus({ preventScroll: true });
        t.setSelectionRange(t.value.length, t.value.length);
      }
    };
    focus();
    const raf = requestAnimationFrame(focus);
    return () => cancelAnimationFrame(raf);
  }, [editorKey]);

  const setTool = (t: CanvasTool) => {
    setToolState(t);
    if (t !== 'select') {
      setSel([]);
      setEntered(null);
    }
  };

  const commit = useCallback(
    (next: Partial<Scene>) => {
      const cur = latest.current;
      setPast((p) => [...p.slice(-59), cur]);
      setFuture([]);
      onChange(next.els ?? cur.els, next.groups ?? cur.groups);
    },
    [onChange],
  );
  const patchEls = (ids: Set<string>, p: Partial<CanvasElement>) => commit({ els: latest.current.els.map((e) => (ids.has(e.id) ? { ...e, ...p } : e)) });
  const patchGroup = (id: string, p: Partial<CanvasGroup>) => commit({ groups: latest.current.groups.map((g) => (g.id === id ? { ...g, ...p } : g)) });

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
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, c.width, c.height);
    const k = s * dpr;
    ctx.setTransform(k, 0, 0, k, -view.ox * k, -view.oy * k);
    // the work area grows with zoom-out; the 16:9 presentation frame stays as a dashed guide
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(WORLD.x, WORLD.y, WORLD.w, WORLD.h);
    if (!isDefault(view)) {
      ctx.save();
      ctx.strokeStyle = 'rgba(148,163,184,0.9)';
      ctx.lineWidth = 1.5 / s;
      ctx.setLineDash([8 / s, 6 / s]);
      ctx.strokeRect(0, 0, BOARD_W, BOARD_H);
      ctx.restore();
    }
    const redraw = () => setTick((t) => t + 1);
    scene.els.forEach((el) => {
      if (editor?.id === el.id || isHidden(el, gm)) return;
      drawElement(ctx, el, attachments, redraw);
    });
    if (draft) drawElement(ctx, draft, attachments, redraw);

    const px = 1 / s; // one css pixel in board units
    if (tool === 'select') {
      if (enteredBox) {
        ctx.save();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5 * px;
        ctx.setLineDash([3 * px, 3 * px]);
        ctx.strokeRect(enteredBox.x - 10 * px, enteredBox.y - 10 * px, enteredBox.w + 20 * px, enteredBox.h + 20 * px);
        ctx.restore();
      }
      const frameColor = frozenSel ? '#94a3b8' : '#a93bf5';
      const drawHandles = (b: Box, rot: number) => {
        const cc = center(b);
        const pad = 6 * px, hs = HANDLE_PX * px;
        ctx.save();
        ctx.translate(cc.x, cc.y);
        ctx.rotate(rot);
        ctx.translate(-cc.x, -cc.y);
        ctx.strokeStyle = frameColor;
        ctx.lineWidth = 1.5 * px;
        ctx.setLineDash([6 * px, 4 * px]);
        ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
        ctx.setLineDash([]);
        if (!frozenSel) {
          const top = b.y - pad;
          ctx.beginPath();
          ctx.moveTo(cc.x, top);
          ctx.lineTo(cc.x, top - ROT_GAP * px);
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(cc.x, top - ROT_GAP * px, hs * 0.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#a93bf5';
          ctx.font = `${hs}px system-ui`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('↻', cc.x, top - ROT_GAP * px);
          HANDLES.forEach((h) => {
            const [u, v] = HANDLE_UV[h];
            const hx = b.x - pad + u * (b.w + pad * 2), hy = b.y - pad + v * (b.h + pad * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
            ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
          });
        }
        ctx.restore();
      };
      if (single && !isHidden(single, gm) && editor?.id !== single.id) drawHandles(bbox(single), single.rotation ?? 0);
      else if (selBox) {
        drawHandles(selBox, 0);
        if (selGroup) {
          ctx.save();
          ctx.font = `600 ${12 * px}px Inter, system-ui`;
          ctx.fillStyle = frameColor;
          ctx.textBaseline = 'bottom';
          ctx.fillText(`📁 ${selGroup.name}${selGroup.lockChildren ? ' · içerik kilitli' : ''}`, selBox.x - 6 * px, selBox.y - 10 * px - (frozenSel ? 0 : ROT_GAP * px + 10 * px));
          ctx.restore();
        }
      }
      if (marquee) {
        ctx.save();
        ctx.fillStyle = 'rgba(169,59,245,0.08)';
        ctx.strokeStyle = '#a93bf5';
        ctx.lineWidth = px;
        ctx.fillRect(marquee.x, marquee.y, marquee.w, marquee.h);
        ctx.strokeRect(marquee.x, marquee.y, marquee.w, marquee.h);
        ctx.restore();
      }
    }
  }, [scene, gm, draft, attachments, size, s, view, tick, tool, single, selBox, selGroup, frozenSel, editor, marquee, enteredBox]);

  /* ---------- coordinates ---------- */
  const toBoard = (e: { clientX: number; clientY: number }): Pt => {
    const r = canvasRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: v.ox + ((e.clientX - r.left) / r.width) * (BOARD_W / v.zoom), y: v.oy + ((e.clientY - r.top) / r.height) * (BOARD_H / v.zoom) };
  };
  const topHit = (p: Pt, tol = 12) => [...scene.els].reverse().find((el) => !isHidden(el, gm) && hit(el, p, tol / view.zoom));

  /** handle under pointer for the current selection */
  function handleAt(p: Pt): Handle | 'rotate' | null {
    if (frozenSel || !sel.length) return null;
    const pad = 6 / s, tol = (HANDLE_PX * 0.9) / s;
    let b: Box, q = p;
    if (single) {
      b = bbox(single);
      q = toLocal(single, p);
    } else if (selBox) b = selBox;
    else return null;
    const cx = b.x + b.w / 2;
    if (Math.hypot(q.x - cx, q.y - (b.y - pad - ROT_GAP / s)) < tol * 1.3) return 'rotate';
    for (const h of HANDLES) {
      const [u, v] = HANDLE_UV[h];
      if (Math.abs(q.x - (b.x - pad + u * (b.w + pad * 2))) < tol && Math.abs(q.y - (b.y - pad + v * (b.h + pad * 2))) < tol) return h;
    }
    return null;
  }
  const cursorFor = (h: Handle | 'rotate' | null, rot = 0): string => {
    if (!h) return '';
    if (h === 'rotate') return 'grab';
    const base = { n: 0, ne: 45, e: 90, se: 135, s: 180, sw: 225, w: 270, nw: 315 }[h] + (rot * 180) / Math.PI;
    return ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'][(((Math.round(base / 45) % 8) + 8) % 8) % 4];
  };

  /* ---------- zoom ---------- */
  const zoomAt = (factor: number, cx?: number, cy?: number) => {
    const v = viewRef.current;
    const r = canvasRef.current?.getBoundingClientRect();
    const px = cx != null && r ? (cx - r.left) / r.width : 0.5;
    const py = cy != null && r ? (cy - r.top) / r.height : 0.5;
    const z = Math.max(MIN_Z, Math.min(MAX_Z, v.zoom * factor));
    const bx = v.ox + px * (BOARD_W / v.zoom), by = v.oy + py * (BOARD_H / v.zoom);
    setView({ zoom: z, ox: bx - px * (BOARD_W / z), oy: by - py * (BOARD_H / z) });
  };
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX, e.clientY);
      } else if (!isDefault(viewRef.current)) {
        e.preventDefault();
        const v = viewRef.current;
        const k = BOARD_W / v.zoom / c.getBoundingClientRect().width;
        setView({ ...v, ox: v.ox + e.deltaX * k, oy: v.oy + e.deltaY * k });
      }
    };
    c.addEventListener('wheel', onWheel, { passive: false });
    return () => c.removeEventListener('wheel', onWheel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- inline editor ---------- */
  const openEditor = (ed: Editor) => {
    editorDone.current = false;
    setEditor(ed);
  };
  const closeEditor = (save: boolean) => {
    if (!editor || editorDone.current) return;
    editorDone.current = true;
    const text = editor.value.replace(/\s+$/, '');
    const cur = latest.current;
    if (save) {
      if (editor.id) {
        if (!text.trim()) commit({ els: cur.els.filter((e) => e.id !== editor.id) });
        else commit({ els: cur.els.map((e) => (e.id === editor.id ? { ...e, text } : e)) });
      } else if (text.trim()) {
        const el: CanvasElement =
          editor.kind === 'text'
            ? { id: uid(), type: 'text', color: editor.color, width: 1, x: editor.x, y: editor.y, text, fontSize: editor.fontSize, groupId: entered ?? undefined }
            : { id: uid(), type: 'sticky', color: '#1f2937', width: 1, x: editor.x, y: editor.y, w: editor.w, h: editor.h, text, fontSize: editor.fontSize, fill: editor.fill, rotation: editor.rotation, groupId: entered ?? undefined };
        commit({ els: [...cur.els, el] });
        setSel([el.id]);
      }
    }
    setEditor(null);
  };
  const canEdit = (el: CanvasElement) => !el.locked && !chainOf(el.groupId, gm).some((g) => gm.get(g)!.locked);
  const editExisting = (el: CanvasElement) => {
    const b = bbox(el);
    openEditor({ id: el.id, kind: el.type === 'sticky' ? 'sticky' : 'text', x: b.x, y: b.y, w: b.w, h: b.h, value: el.text ?? '', fontSize: el.fontSize ?? 48, color: el.color, fill: el.fill, rotation: el.rotation ?? 0 });
  };

  /* ---------- pointer ---------- */
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      // pinch zoom: cancel whatever started with the first finger
      const [a, b] = [...pointers.current.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y), z0: viewRef.current.zoom, anchor: toBoard({ clientX: mid.x, clientY: mid.y }), mid };
      dragRef.current = null;
      setDraft(null);
      setWorking(null);
      setMarquee(null);
      return;
    }
    if (editor) {
      closeEditor(true);
      return;
    }
    const p = toBoard(e);
    if (tool === 'text' || tool === 'sticky') e.preventDefault();
    else wrapRef.current?.focus({ preventScroll: true });
    e.currentTarget.setPointerCapture(e.pointerId);

    if (spaceDown.current || e.button === 1) {
      dragRef.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, ox: view.ox, oy: view.oy };
      return;
    }
    if (tool === 'text') {
      const fs = 24 + width * 4;
      openEditor({ id: null, kind: 'text', x: p.x, y: p.y - fs * 0.6, w: 0, h: 0, value: '', fontSize: fs, color: color === '#ffffff' ? '#111827' : color, rotation: 0 });
      return;
    }
    if (tool === 'sticky') {
      const fill = STICKY_COLORS[latest.current.els.filter((x) => x.type === 'sticky').length % STICKY_COLORS.length];
      openEditor({ id: null, kind: 'sticky', x: p.x - 150, y: p.y - 40, w: 300, h: 230, value: '', fontSize: 26, color: '#1f2937', fill, rotation: 0 });
      return;
    }
    if (tool === 'eraser') {
      const t = [...latest.current.els].reverse().find((el) => !isHidden(el, gm) && !isFrozen(el, gm, el.id) && hit(el, p, 8 / view.zoom));
      if (t) commit({ els: latest.current.els.filter((x) => x.id !== t.id) });
      return;
    }
    if (tool === 'select') {
      const h = handleAt(p);
      if (h && single) {
        dragRef.current = h === 'rotate' ? { mode: 'rotate1', orig: single } : { mode: 'resize1', handle: h, orig: single };
        return;
      }
      if (h && selBox) {
        const c = center(selBox);
        dragRef.current = h === 'rotate' ? { mode: 'rotateN', pivot: c, a0: Math.atan2(p.y - c.y, p.x - c.x), origs: selEls } : { mode: 'resizeN', handle: h, box: selBox, origs: selEls };
        return;
      }
      const t = topHit(p);
      if (t) {
        let level = entered;
        if (level && !isInside(t, level, gm)) {
          level = null;
          setEntered(null);
        }
        const node = topNode(t, gm, level);
        if (e.shiftKey) {
          setSel((cur) => (cur.includes(node) ? cur.filter((x) => x !== node) : [...cur, node]));
          return;
        }
        const nextSel = sel.includes(node) ? sel : [node];
        setSel(nextSel);
        const els = expandNodes(nextSel, latest.current.els, gm);
        const frozen = nextSel.some((n) => expandNodes([n], latest.current.els, gm).some((x) => isFrozen(x, gm, n)));
        if (!frozen) dragRef.current = { mode: 'move', start: p, origs: els };
        return;
      }
      if (!e.shiftKey) {
        setSel([]);
        setEntered(null);
      }
      dragRef.current = { mode: 'marquee', start: p, add: e.shiftKey };
      return;
    }
    const base = { id: uid(), color, width: tool === 'highlighter' ? width * 4 : width, opacity: tool === 'highlighter' ? 0.35 : 1 };
    if (tool === 'pen' || tool === 'highlighter') setDraft({ ...base, type: 'path', points: [p.x, p.y] });
    else if (tool === 'line' || tool === 'arrow') setDraft({ ...base, type: tool, points: [p.x, p.y, p.x, p.y] });
    else if (tool === 'rect' || tool === 'ellipse') setDraft({ ...base, type: tool, x: p.x, y: p.y, w: 0, h: 0 });
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const z = Math.max(MIN_Z, Math.min(MAX_Z, (pinch.current.z0 * d) / Math.max(1, pinch.current.d0)));
      const r = canvasRef.current!.getBoundingClientRect();
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const px = (mid.x - r.left) / r.width, py = (mid.y - r.top) / r.height;
      setView({ zoom: z, ox: pinch.current.anchor.x - px * (BOARD_W / z), oy: pinch.current.anchor.y - py * (BOARD_H / z) });
      return;
    }
    const p = toBoard(e);
    const drag = dragRef.current;
    if (drag) {
      const cur = latest.current;
      const replace = (next: CanvasElement[]) => {
        const m = new Map(next.map((x) => [x.id, x]));
        setWorking({ els: cur.els.map((x) => m.get(x.id) ?? x), groups: cur.groups });
      };
      switch (drag.mode) {
        case 'pan': {
          const r = canvasRef.current!.getBoundingClientRect();
          const k = BOARD_W / view.zoom / r.width;
          setView({ ...view, ox: drag.ox - (e.clientX - drag.sx) * k, oy: drag.oy - (e.clientY - drag.sy) * k });
          return;
        }
        case 'marquee':
          setMarquee({ x: Math.min(drag.start.x, p.x), y: Math.min(drag.start.y, p.y), w: Math.abs(p.x - drag.start.x), h: Math.abs(p.y - drag.start.y) });
          return;
        case 'move':
          replace(drag.origs.map((x) => translate(x, p.x - drag.start.x, p.y - drag.start.y)));
          return;
        case 'resize1':
          replace([resizeByHandle(drag.orig, drag.handle, p, keepsAspect(drag.orig) !== e.shiftKey)]);
          return;
        case 'rotate1': {
          const c = center(bbox(drag.orig));
          let a = Math.atan2(p.y - c.y, p.x - c.x) + Math.PI / 2;
          if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
          replace([{ ...drag.orig, rotation: a }]);
          return;
        }
        case 'resizeN': {
          const B = drag.box, h = drag.handle;
          const [u, v] = HANDLE_UV[h], [au, av] = HANDLE_UV[OPP[h]];
          const ax = B.x + au * B.w, ay = B.y + av * B.h;
          let w = u === au ? B.w : Math.max(10, (p.x - ax) * (u > au ? 1 : -1));
          let hh = v === av ? B.h : Math.max(10, (p.y - ay) * (v > av ? 1 : -1));
          if (!e.shiftKey && B.w && B.h) {
            // groups keep proportions by default (Shift = free)
            const ratio = B.w / B.h;
            if (u === au) w = hh * ratio;
            else if (v === av) hh = w / ratio;
            else if (w / hh > ratio) hh = w / ratio;
            else w = hh * ratio;
          }
          const x = u === au ? B.x + (B.w - w) / 2 : u > au ? ax : ax - w;
          const y = v === av ? B.y + (B.h - hh) / 2 : v > av ? ay : ay - hh;
          replace(scaleElements(drag.origs, B, { x, y, w, h: hh }));
          return;
        }
        case 'rotateN': {
          let d = Math.atan2(p.y - drag.pivot.y, p.x - drag.pivot.x) - drag.a0;
          if (e.shiftKey) d = Math.round(d / (Math.PI / 12)) * (Math.PI / 12);
          replace(rotateElements(drag.origs, drag.pivot, d));
          return;
        }
      }
    }
    if (tool === 'eraser' && e.buttons === 1) {
      const t = latest.current.els.find((el) => !isHidden(el, gm) && !isFrozen(el, gm, el.id) && hit(el, p, 8 / view.zoom));
      if (t) commit({ els: latest.current.els.filter((x) => x.id !== t.id) });
      return;
    }
    if (tool === 'select' && canvasRef.current) {
      const h = handleAt(p);
      canvasRef.current.style.cursor = spaceDown.current ? 'grab' : h ? cursorFor(h, single?.rotation) : topHit(p) ? 'move' : '';
    }
    if (!draft) return;
    if (draft.type === 'path') setDraft({ ...draft, points: [...(draft.points ?? []), p.x, p.y] });
    else if (draft.type === 'line' || draft.type === 'arrow') setDraft({ ...draft, points: [draft.points![0], draft.points![1], p.x, p.y] });
    else setDraft({ ...draft, w: p.x - (draft.x ?? 0), h: p.y - (draft.y ?? 0) });
  };

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null;
      return;
    }
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.mode === 'marquee') {
      const box = marquee;
      setMarquee(null);
      if (box && (box.w > 4 || box.h > 4)) {
        const cur = latest.current;
        const nodes = new Set<string>();
        cur.els.forEach((el) => {
          if (isHidden(el, gm) || !boxesIntersect(aabb(el), box)) return;
          if (entered && !isInside(el, entered, gm)) return;
          nodes.add(topNode(el, gm, entered));
        });
        setSel((prev) => (drag.add ? Array.from(new Set([...prev, ...nodes])) : [...nodes]));
      }
      return;
    }
    if (drag && drag.mode !== 'pan') {
      if (working) commit(working);
      setWorking(null);
      return;
    }
    if (draft) {
      const b = bbox(draft);
      if (draft.type === 'path' || b.w > 3 || b.h > 3) {
        const el = { ...(draft.type === 'rect' || draft.type === 'ellipse' ? { ...draft, x: b.x, y: b.y, w: b.w, h: b.h } : draft), groupId: entered ?? undefined };
        commit({ els: [...latest.current.els, el] });
      }
      setDraft(null);
    }
  };

  const onDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const t = topHit(toBoard(e));
    if (!t) return;
    const level = entered && isInside(t, entered, gm) ? entered : null;
    const node = topNode(t, gm, level);
    setToolState('select');
    if (gm.has(node)) {
      // enter the group: select the next level down
      setEntered(node);
      setSel([topNode(t, gm, node)]);
      return;
    }
    setSel([t.id]);
    if ((t.type === 'text' || t.type === 'sticky') && canEdit(t)) editExisting(t);
    else if ((t.type === 'image' || t.type === 'media') && t.attachmentId) onOpenMedia?.(t.attachmentId);
  };

  /* ---------- actions ---------- */
  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [...f, latest.current]);
    const prev = past[past.length - 1];
    onChange(prev.els, prev.groups);
    setPast((p) => p.slice(0, -1));
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, latest.current]);
    const next = future[future.length - 1];
    onChange(next.els, next.groups);
    setFuture((f) => f.slice(0, -1));
  };
  const deleteNodes = (ids: string[]) => {
    const cur = latest.current;
    const gIds = new Set(ids.filter((id) => gm.has(id)).flatMap((g) => subGroups(g, cur.groups)));
    const elIds = new Set(expandNodes(ids, cur.els, gm).filter((e) => !e.locked).map((e) => e.id));
    commit({ els: cur.els.filter((e) => !elIds.has(e.id)), groups: cur.groups.filter((g) => !gIds.has(g.id)) });
    setSel([]);
  };
  const duplicate = () => {
    if (!sel.length) return;
    const cur = latest.current;
    const d = duplicateNodes(sel, cur.els, cur.groups);
    commit({ els: [...cur.els, ...d.elements], groups: [...cur.groups, ...d.groups] });
    setSel(d.topIds);
  };
  const toFront = (front: boolean) => {
    const ids = new Set(selEls.map((e) => e.id));
    const cur = latest.current.els;
    const moved = cur.filter((e) => ids.has(e.id)), rest = cur.filter((e) => !ids.has(e.id));
    commit({ els: front ? [...rest, ...moved] : [...moved, ...rest] });
  };
  const stepEl = (id: string, dir: 1 | -1) => {
    const arr = latest.current.els.slice();
    const i = arr.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    commit({ els: arr });
  };
  const groupSelection = () => {
    if (!sel.length) return;
    const cur = latest.current;
    const g: CanvasGroup = { id: uid(), name: `Grup ${cur.groups.length + 1}`, parentId: entered ?? undefined };
    const nodes = new Set(sel);
    commit({
      els: cur.els.map((e) => (nodes.has(e.id) ? { ...e, groupId: g.id } : e)),
      groups: [...cur.groups.map((x) => (nodes.has(x.id) ? { ...x, parentId: g.id } : x)), g],
    });
    setSel([g.id]);
  };
  const ungroup = () => {
    const cur = latest.current;
    const gs = sel.filter((id) => gm.has(id));
    if (!gs.length) return;
    const parentOf = new Map(gs.map((g) => [g, gm.get(g)!.parentId]));
    const released: string[] = [];
    const els = cur.els.map((e) => {
      if (e.groupId && parentOf.has(e.groupId)) {
        released.push(e.id);
        return { ...e, groupId: parentOf.get(e.groupId) };
      }
      return e;
    });
    const groups = cur.groups
      .filter((g) => !parentOf.has(g.id))
      .map((g) => {
        if (g.parentId && parentOf.has(g.parentId)) {
          released.push(g.id);
          return { ...g, parentId: parentOf.get(g.parentId) };
        }
        return g;
      });
    commit({ els, groups });
    setSel(released);
  };
  const removeFromGroup = () => {
    if (!single?.groupId) return;
    const parent = gm.get(single.groupId)?.parentId;
    commit({ els: latest.current.els.map((e) => (e.id === single.id ? { ...e, groupId: parent } : e)) });
  };
  /** layer drag & drop: move node into `target` group (null = root) */
  const moveInto = (nodes: string | string[], target: string | null) => {
    const cur = latest.current;
    const list = (Array.isArray(nodes) ? nodes : [nodes]).filter((n) => n !== target);
    // groups: never into themselves or their own descendants
    const groupIds = new Set(list.filter((n) => gm.has(n) && !(target && subGroups(n, cur.groups).includes(target))));
    const elIds = new Set(list.filter((n) => !gm.has(n)));
    if (!groupIds.size && !elIds.size) return;
    commit({
      els: cur.els.map((e) => (elIds.has(e.id) ? { ...e, groupId: target ?? undefined } : e)),
      groups: cur.groups.map((g) => (groupIds.has(g.id) ? { ...g, parentId: target ?? undefined } : g)),
    });
  };
  /** leave the entered group one level up, keeping it selected */
  const exitGroup = () => {
    if (!entered) return;
    setSel([entered]);
    setEntered(gm.get(entered)?.parentId ?? null);
  };
  const selectFromLayer = (node: string, elGroup: string | undefined) => {
    setToolState('select');
    setEntered(elGroup ?? null);
    setSel([node]);
  };
  const newFolder = () => {
    if (sel.length) return groupSelection();
    const g: CanvasGroup = { id: uid(), name: `Klasör ${latest.current.groups.length + 1}`, parentId: entered ?? undefined };
    commit({ groups: [...latest.current.groups, g] });
    setRenaming(g.id);
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
      const els = (await elementsForAttachments(atts, latest.current.els.length)).map((x) => ({ ...x, groupId: entered ?? undefined }));
      commit({ els: [...latest.current.els, ...els] });
      setToolState('select');
      setSel(els.map((x) => x.id));
    }
    setBusy(false);
  };

  const exportPng = async () => {
    const url = await renderBoard(visibleElements(latest.current.els, latest.current.groups), attachments, BOARD_W);
    if (url) downloadBlob(dataUrlToBlob(url), `${title}.png`);
    else alert('Harici bağlantılı görseller PNG dışa aktarımını engelliyor (CORS). Görseli dosya olarak ekleyip tekrar dene.');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editor || (e.target as HTMLElement).closest('textarea, input, select')) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const stop = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (e.key === ' ') {
      spaceDown.current = true;
      stop();
      return;
    }
    if (mod && (k === '=' || k === '+')) return stop(), zoomAt(1.25);
    if (mod && k === '-') return stop(), zoomAt(0.8);
    if (mod && k === '0') return stop(), setView(DEFAULT_VIEW);
    if (mod && k === 'z') return stop(), e.shiftKey ? redo() : undo();
    if (mod && k === 'y') return stop(), redo();
    if (mod && k === 'd') return stop(), duplicate();
    if (mod && k === 'g') return stop(), e.shiftKey ? ungroup() : groupSelection();
    if (mod && k === 'a') {
      stop();
      setToolState('select');
      const nodes = new Set<string>();
      latest.current.els.forEach((el) => !isHidden(el, gm) && (!entered || isInside(el, entered, gm)) && nodes.add(topNode(el, gm, entered)));
      setSel([...nodes]);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) return stop(), deleteNodes(sel);
    if (e.key === 'Escape') {
      if (entered) exitGroup();
      else setSel([]);
      return;
    }
    if (e.key === 'Enter') {
      if (single && (single.type === 'text' || single.type === 'sticky') && canEdit(single)) return stop(), editExisting(single);
      if (selGroup) {
        stop();
        setEntered(selGroup.id);
        const first = expandNodes([selGroup.id], latest.current.els, gm).pop();
        setSel(first ? [topNode(first, gm, selGroup.id)] : []);
      }
      return;
    }
    if (sel.length && !frozenSel && e.key.startsWith('Arrow')) {
      stop();
      const d = e.shiftKey ? 20 : 4;
      const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
      const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
      const ids = new Set(selEls.map((x) => x.id));
      commit({ els: latest.current.els.map((x) => (ids.has(x.id) ? translate(x, dx, dy) : x)) });
      return;
    }
    if (!mod && !e.altKey) {
      const t = TOOLS.find((x) => x.key === k);
      if (t) setTool(t.id);
    }
  };
  const onKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === ' ') spaceDown.current = false;
  };

  /* ---------- editor css geometry (relative to surface) ---------- */
  const edStyle = (() => {
    if (!editor) return undefined;
    const fs = editor.fontSize * s;
    const left = (editor.x - view.ox) * s, top = (editor.y - view.oy) * s;
    if (editor.kind === 'sticky') {
      return { left, top, width: editor.w * s, height: editor.h * s, fontSize: fs, background: editor.fill, color: '#1f2937', padding: `${30 * s}px ${18 * s}px ${18 * s}px`, transform: `rotate(${editor.rotation}rad)` };
    }
    const lines = (editor.value || ' ').split('\n');
    const longest = Math.max(...lines.map((l) => l.length), 6);
    return { left, top, width: Math.min(size.w - left, longest * fs * 0.62 + fs), height: lines.length * fs * 1.2 + 6, fontSize: fs, lineHeight: 1.2, color: editor.color, font: fontFor(fs), transform: `rotate(${editor.rotation}rad)` };
  })();

  /* ---------- layers tree ---------- */
  const tree = useMemo(() => (showLayers ? buildTree(scene.els, scene.groups) : []), [showLayers, scene]);
  const renderNode = (n: TNode, depth: number): ReactNode => {
    if (n.kind === 'g') {
      const g = n.g;
      const active = sel.includes(g.id);
      return (
        <li key={g.id}>
          <div
            className={`layer layer--group ${active ? 'is-active' : ''} ${g.hidden ? 'is-hidden' : ''} ${dragNode && dragNode !== g.id ? 'is-droppable' : ''}`}
            style={{ paddingLeft: depth * 14 }}
            draggable
            onDragStart={(ev) => {
              ev.dataTransfer.setData('text/plain', g.id);
              setDragNode(g.id);
            }}
            onDragEnd={() => setDragNode(null)}
            onDragOver={(ev) => ev.preventDefault()}
            onDrop={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              const id = ev.dataTransfer.getData('text/plain');
              if (id) moveInto(id, g.id);
              setDragNode(null);
            }}
          >
            <button className="layer-btn" onClick={() => patchGroup(g.id, { collapsed: !g.collapsed })} aria-label={g.collapsed ? 'Aç' : 'Kapat'}>
              {g.collapsed ? '▸' : '▾'}
            </button>
            {renaming === g.id ? (
              <input
                className="input input--sm layer-rename"
                autoFocus
                defaultValue={g.name}
                onBlur={(ev) => {
                  patchGroup(g.id, { name: ev.target.value.trim() || g.name });
                  setRenaming(null);
                }}
                onKeyDown={(ev) => {
                  ev.stopPropagation();
                  if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
                  if (ev.key === 'Escape') setRenaming(null);
                }}
              />
            ) : (
              <button className="layer-main" onClick={() => selectFromLayer(g.id, g.parentId)} onDoubleClick={() => setRenaming(g.id)} title="Seç · çift tık: yeniden adlandır">
                <span aria-hidden>{g.collapsed ? '📁' : '📂'}</span>
                <span className="truncate">{g.name}</span>
                <small className="muted">{n.count}</small>
              </button>
            )}
            <button className="layer-btn" onClick={() => patchGroup(g.id, { hidden: !g.hidden })} title={g.hidden ? 'Göster' : 'Gizle'}>
              {g.hidden ? '🙈' : '👁️'}
            </button>
            <button className="layer-btn" onClick={() => patchGroup(g.id, { locked: !g.locked })} title={g.locked ? 'Grubun kilidini aç' : 'Grubu kilitle'}>
              {g.locked ? '🔒' : '🔓'}
            </button>
            <button className="layer-btn" onClick={() => patchGroup(g.id, { lockChildren: !g.lockChildren })} title={g.lockChildren ? 'İçerik kilitli — tek tek taşınamaz' : 'İçerik serbest'}>
              {g.lockChildren ? '🧷' : '✋'}
            </button>
          </div>
          {!g.collapsed && n.children.length > 0 && <ul>{n.children.map((c) => renderNode(c, depth + 1))}</ul>}
        </li>
      );
    }
    const el = n.e;
    const lbl = elementLabel(el, attachments);
    const idx = scene.els.indexOf(el);
    return (
      <li key={el.id}>
        <div
          className={`layer ${sel.includes(el.id) ? 'is-active' : ''} ${el.hidden ? 'is-hidden' : ''}`}
          style={{ paddingLeft: depth * 14 + 26 }}
          draggable
          onDragStart={(ev) => {
            ev.dataTransfer.setData('text/plain', el.id);
            setDragNode(el.id);
          }}
          onDragEnd={() => setDragNode(null)}
        >
          <button className="layer-main" onClick={() => selectFromLayer(el.id, el.groupId)} title={lbl.name}>
            <span aria-hidden>{lbl.icon}</span>
            <span className="truncate">{lbl.name}</span>
          </button>
          <button className="layer-btn" onClick={() => patchEls(new Set([el.id]), { hidden: !el.hidden })} title={el.hidden ? 'Göster' : 'Gizle'}>
            {el.hidden ? '🙈' : '👁️'}
          </button>
          <button className="layer-btn" onClick={() => patchEls(new Set([el.id]), { locked: !el.locked })} title={el.locked ? 'Kilidi aç' : 'Kilitle'}>
            {el.locked ? '🔒' : '🔓'}
          </button>
          <button className="layer-btn" onClick={() => stepEl(el.id, 1)} disabled={idx === scene.els.length - 1} title="Bir üst katman">
            ▲
          </button>
          <button className="layer-btn" onClick={() => stepEl(el.id, -1)} disabled={idx === 0} title="Bir alt katman">
            ▼
          </button>
        </div>
      </li>
    );
  };

  const selLabel = single ? `${elementLabel(single, attachments).icon} ${elementLabel(single, attachments).name}` : selGroup ? `📁 ${selGroup.name}` : `${sel.length} öğe`;

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
                const ids = new Set(selEls.filter((x) => !isFrozen(x, gm, x.id) || selGroup).filter((x) => ['path', 'line', 'arrow', 'rect', 'ellipse', 'text'].includes(x.type)).map((x) => x.id));
                if (ids.size && !frozenSel) patchEls(ids, { color: c });
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
          <button className="tool tool--wide" onClick={() => setShowFw(true)} title="Çerçeve / model ekle (grup olarak)">
            🧩 <span className="hide-sm">Çerçeve</span>
          </button>
          <button className="tool" onClick={undo} disabled={!past.length} title="Geri al (Ctrl+Z)" aria-label="Geri al">↶</button>
          <button className="tool" onClick={redo} disabled={!future.length} title="Yinele (Ctrl+Y)" aria-label="Yinele">↷</button>
          <button className={`tool tool--wide ${showLayers ? 'is-active' : ''}`} onClick={() => setShowLayers((x) => !x)} title="Katmanlar & klasörler" aria-pressed={showLayers}>
            🗂️ <span className="hide-sm">Katman</span>
          </button>
          <button className="tool" onClick={exportPng} title="PNG indir" aria-label="PNG indir">⬇️</button>
          <button className="tool" onClick={() => elements.length && confirm('Tuval temizlensin mi?') && commit({ els: [], groups: [] })} title="Temizle" aria-label="Temizle">🗑️</button>
        </div>
        {toolbarExtra}
      </div>

      {sel.length > 0 && tool === 'select' && (
        <div className="sel-bar" role="toolbar" aria-label="Seçili öğe">
          <span className="sel-name truncate">{selLabel}</span>
          {entered && (
            <button className="tool tool--wide" onClick={exitGroup} title="Gruptan çık (Esc)">
              ⤴ <span className="hide-sm">Gruptan çık</span>
            </button>
          )}
          {single && (single.type === 'text' || single.type === 'sticky') && canEdit(single) && (
            <button className="tool tool--wide" onClick={() => editExisting(single)} title="Düzenle (Enter)">
              ✎ <span className="hide-sm">Düzenle</span>
            </button>
          )}
          {selGroup && (
            <>
              <button
                className="tool tool--wide"
                onClick={() => {
                  setEntered(selGroup.id);
                  const first = expandNodes([selGroup.id], latest.current.els, gm).pop();
                  setSel(first ? [topNode(first, gm, selGroup.id)] : []);
                }}
                title="Gruba gir — içindeki öğeleri tek tek seç (çift tık / Enter)"
              >
                ⤵ <span className="hide-sm">Gruba gir</span>
              </button>
              <button className="tool tool--wide" onClick={ungroup} title="Grubu çöz (Ctrl+Shift+G)">
                ⧈ <span className="hide-sm">Çöz</span>
              </button>
              <button className="tool" onClick={() => patchGroup(selGroup.id, { lockChildren: !selGroup.lockChildren })} title={selGroup.lockChildren ? 'İçerik kilitli — aç' : 'İçeriği kilitle'}>
                {selGroup.lockChildren ? '🧷' : '✋'}
              </button>
            </>
          )}
          {sel.length > 1 && (
            <button className="tool tool--wide" onClick={groupSelection} title="Grupla (Ctrl+G)">
              ▣ <span className="hide-sm">Grupla</span>
            </button>
          )}
          {scene.groups.length > 0 && !frozenSel && (
            <select
              className="seg-select"
              value=""
              aria-label="Klasöre taşı"
              title="Klasöre taşı (dokunmatik ekranlar için sürükle-bırak alternatifi)"
              onChange={(e) => {
                const target = e.target.value === '__root' ? null : e.target.value;
                moveInto(sel, target);
                setEntered(null);
              }}
            >
              <option value="">📁 Klasöre taşı…</option>
              <option value="__root">⇱ Kök seviye</option>
              {scene.groups
                .filter((g) => !sel.some((n) => gm.has(n) && subGroups(n, scene.groups).includes(g.id)))
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {'— '.repeat(chainOf(g.parentId, gm).length)}
                    {g.name}
                  </option>
                ))}
            </select>
          )}
          {single?.groupId && !frozenSel && (
            <button className="tool tool--wide" onClick={removeFromGroup} title="Gruptan çıkar">
              ⇱ <span className="hide-sm">Gruptan çıkar</span>
            </button>
          )}
          {single?.type === 'sticky' && canEdit(single) && (
            <span className="seg">
              {STICKY_COLORS.map((c) => (
                <button key={c} className={`swatch swatch--sm ${single.fill === c ? 'is-active' : ''}`} style={{ background: c }} onClick={() => patchEls(new Set([single.id]), { fill: c })} aria-label="Not rengi" />
              ))}
            </span>
          )}
          {single && (single.type === 'image' || single.type === 'media') && single.attachmentId && onOpenMedia && (
            <button className="tool tool--wide" onClick={() => onOpenMedia(single.attachmentId!)} title="Slaytta aç">
              ⛶ <span className="hide-sm">Aç</span>
            </button>
          )}
          <button className="tool" onClick={() => toFront(true)} title="En öne getir" aria-label="En öne">⤒</button>
          <button className="tool" onClick={() => toFront(false)} title="En arkaya gönder" aria-label="En arkaya">⤓</button>
          {single && (
            <button className="tool" onClick={() => patchEls(new Set([single.id]), { rotation: 0 })} disabled={!single.rotation || frozenSel} title="Döndürmeyi sıfırla" aria-label="Döndürmeyi sıfırla">⟲</button>
          )}
          <button className="tool" onClick={duplicate} title="Çoğalt (Ctrl+D)" aria-label="Çoğalt">⧉</button>
          {(single || selGroup) && (
            <button
              className="tool"
              onClick={() => (single ? patchEls(new Set([single.id]), { locked: !single.locked }) : patchGroup(selGroup!.id, { locked: !selGroup!.locked }))}
              title={(single?.locked ?? selGroup?.locked) ? 'Kilidi aç' : 'Kilitle'}
              aria-label="Kilit"
            >
              {(single?.locked ?? selGroup?.locked) ? '🔒' : '🔓'}
            </button>
          )}
          <button className="tool" onClick={() => deleteNodes(sel)} title="Sil (Del)" aria-label="Sil">🗑️</button>
        </div>
      )}

      <div className={`board-body ${showLayers ? 'with-layers' : ''}`}>
        <div ref={wrapRef} className="board-surface-wrap" tabIndex={0} onKeyDown={onKeyDown} onKeyUp={onKeyUp} aria-label="Tuval — V seç, T yazı, N not, Ctrl+G grupla, Ctrl+tekerlek yakınlaştır">
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
                Çizmeye başla · 𝐓 ile tıkla-yaz · 📌 not kağıdı · 🧩 çerçeve · 🖼️ medya
              </p>
            )}
            <div className="zoom-ctl" role="group" aria-label="Yakınlaştırma">
              <button onClick={() => zoomAt(0.8)} aria-label="Uzaklaştır" title="Uzaklaştır (Ctrl −)" disabled={view.zoom <= MIN_Z}>
                −
              </button>
              <button onClick={() => setView(DEFAULT_VIEW)} title="Sunum çerçevesine sığdır (Ctrl 0)" className="zoom-pct">
                {Math.round(view.zoom * 100)}%
              </button>
              <button onClick={() => zoomAt(1.25)} aria-label="Yakınlaştır" title="Yakınlaştır (Ctrl +) · Ctrl+tekerlek · iki parmak" disabled={view.zoom >= MAX_Z}>
                ＋
              </button>
            </div>
            {!isDefault(view) && (
              <p className="pan-hint" aria-hidden>
                {view.zoom < 1 ? 'Çalışma alanı genişledi · kesikli çizgi = sunum çerçevesi · ' : ''}Kaydır: tekerlek · Boşluk+sürükle
              </p>
            )}
          </div>
        </div>

        {showFw && (
          <FrameworkPicker
            hasContent={elements.length > 0}
            onClose={() => setShowFw(false)}
            onInsert={(els, replace, fw) => {
              const g: CanvasGroup = { id: uid(), name: fw.name, lockChildren: true, frameworkId: fw.id, parentId: replace ? undefined : entered ?? undefined };
              // canvas skeleton is a locked group; sticky notes stay free so they can be filled, moved, duplicated
              const grouped = els.map((x) => (x.type === 'sticky' ? x : { ...x, groupId: g.id }));
              const cur = latest.current;
              commit(replace ? { els: grouped, groups: [g] } : { els: [...cur.els, ...grouped], groups: [...cur.groups, g] });
              setToolState('select');
              setSel([g.id]);
            }}
          />
        )}
        {showLayers && (
          <aside className="layers" aria-label="Katmanlar">
            <div className="layers-head">
              <b>🗂️ Katmanlar</b>
              <span className="row gap-s">
                <button className="btn btn-sm" onClick={newFolder} title={sel.length ? 'Seçimi klasöre al (Ctrl+G)' : 'Boş klasör'}>
                  📁＋
                </button>
                <span className="muted small">{elements.length}</span>
              </span>
            </div>
            {!elements.length && !groups.length && <p className="muted small">Henüz öğe yok.</p>}
            <ul className="layer-tree">{tree.map((n) => renderNode(n, 0))}</ul>
            {dragNode && (
              <div
                className="layer-root-drop"
                onDragOver={(ev) => ev.preventDefault()}
                onDrop={(ev) => {
                  ev.preventDefault();
                  const id = ev.dataTransfer.getData('text/plain');
                  if (id) moveInto(id, null);
                  setDragNode(null);
                }}
              >
                ⇱ Kök seviyeye bırak
              </div>
            )}
            <p className="muted small layers-help">Sürükle-bırak: klasöre taşı · çift tık: yeniden adlandır · 🧷 içerik kilidi</p>
          </aside>
        )}
      </div>
    </div>
  );
}
