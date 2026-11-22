// client/src/lib/canvasDraw.ts — geometry + rendering for the whiteboard (shared by editor, thumbnails, export)
import type { Attachment, CanvasElement } from '../types';
import { uid } from './factory';

export const BOARD_W = 1600;
export const BOARD_H = 900;
export const STICKY_COLORS = ['#fef08a', '#fbcfe8', '#bbf7d0', '#bfdbfe', '#ddd6fe', '#fed7aa'];

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Pt {
  x: number;
  y: number;
}

/* ---------------- text measurement ---------------- */
let mctx: CanvasRenderingContext2D | null = null;
function measureCtx(): CanvasRenderingContext2D | null {
  if (!mctx && typeof document !== 'undefined') mctx = document.createElement('canvas').getContext('2d');
  return mctx;
}
export const fontFor = (fs: number) => `600 ${fs}px Inter, system-ui, sans-serif`;

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  text.split('\n').forEach((para) => {
    const words = para.split(/\s+/);
    let line = '';
    words.forEach((w) => {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line);
        line = w;
      } else line = test;
    });
    out.push(line);
  });
  return out;
}

/* ---------------- geometry ---------------- */
export function bbox(el: CanvasElement): Box {
  if (el.points && el.points.length >= 2) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < el.points.length; i += 2) {
      minX = Math.min(minX, el.points[i]);
      maxX = Math.max(maxX, el.points[i]);
      minY = Math.min(minY, el.points[i + 1]);
      maxY = Math.max(maxY, el.points[i + 1]);
    }
    const pad = el.width / 2;
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
  }
  if (el.type === 'text') {
    const fs = el.fontSize ?? 48;
    const lines = (el.text ?? '').split('\n');
    const ctx = measureCtx();
    let w = Math.max(...lines.map((l) => l.length)) * fs * 0.55;
    if (ctx) {
      ctx.font = fontFor(fs);
      w = Math.max(...lines.map((l) => ctx.measureText(l).width));
    }
    return { x: el.x ?? 0, y: el.y ?? 0, w: Math.max(w, fs * 0.5), h: lines.length * fs * 1.2 };
  }
  const x = el.x ?? 0, y = el.y ?? 0, w = el.w ?? 0, h = el.h ?? 0;
  return { x: Math.min(x, x + w), y: Math.min(y, y + h), w: Math.abs(w), h: Math.abs(h) };
}

export const center = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

export function rotatePt(p: Pt, c: Pt, r: number): Pt {
  if (!r) return p;
  const cos = Math.cos(r), sin = Math.sin(r);
  const dx = p.x - c.x, dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

/** World point → element's unrotated frame. */
export function toLocal(el: CanvasElement, p: Pt): Pt {
  return rotatePt(p, center(bbox(el)), -(el.rotation ?? 0));
}

export function hit(el: CanvasElement, p: Pt, tol = 12): boolean {
  if (el.hidden) return false;
  const b = bbox(el);
  const q = toLocal(el, p);
  return q.x >= b.x - tol && q.x <= b.x + b.w + tol && q.y >= b.y - tol && q.y <= b.y + b.h + tol;
}

export function translate(el: CanvasElement, dx: number, dy: number): CanvasElement {
  if (el.points) return { ...el, points: el.points.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)) };
  return { ...el, x: (el.x ?? 0) + dx, y: (el.y ?? 0) + dy };
}

/** Map an element from its current bbox onto `nb` (unrotated frame). */
export function fitToBox(el: CanvasElement, nb: Box): CanvasElement {
  const ob = bbox(el);
  const sx = ob.w ? nb.w / ob.w : 1;
  const sy = ob.h ? nb.h / ob.h : 1;
  if (el.points) {
    return { ...el, points: el.points.map((v, i) => (i % 2 === 0 ? nb.x + (v - ob.x) * sx : nb.y + (v - ob.y) * sy)) };
  }
  if (el.type === 'text') return { ...el, x: nb.x, y: nb.y, fontSize: Math.max(8, (el.fontSize ?? 48) * sy) };
  return { ...el, x: nb.x, y: nb.y, w: nb.w, h: nb.h };
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** Handle position in the unrotated frame (0..1 of bbox). */
export const HANDLE_UV: Record<Handle, [number, number]> = {
  nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5],
};
const OPPOSITE: Record<Handle, Handle> = { nw: 'se', n: 's', ne: 'sw', e: 'w', se: 'nw', s: 'n', sw: 'ne', w: 'e' };

export const keepsAspect = (el: CanvasElement) => el.type === 'image' || el.type === 'text' || el.type === 'media';

/**
 * Resize keeping the opposite handle fixed in world space, even when rotated.
 * `orig` is the element at drag start, `p` the pointer in world coords.
 */
export function resizeByHandle(orig: CanvasElement, handle: Handle, p: Pt, lockAspect: boolean): CanvasElement {
  const b = bbox(orig);
  const r = orig.rotation ?? 0;
  const c = center(b);
  const [au, av] = HANDLE_UV[OPPOSITE[handle]];
  const [hu, hv] = HANDLE_UV[handle];
  const anchorW = rotatePt({ x: b.x + au * b.w, y: b.y + av * b.h }, c, r);
  // pointer relative to anchor, in local axes
  const d = rotatePt({ x: p.x - anchorW.x, y: p.y - anchorW.y }, { x: 0, y: 0 }, -r);
  const sxSign = hu === au ? 0 : hu > au ? 1 : -1;
  const sySign = hv === av ? 0 : hv > av ? 1 : -1;
  const MIN = 12;
  let w = sxSign ? Math.max(MIN, d.x * sxSign) : b.w;
  let h = sySign ? Math.max(MIN, d.y * sySign) : b.h;
  if (lockAspect && b.w && b.h) {
    const ratio = b.w / b.h;
    if (!sxSign) w = h * ratio;
    else if (!sySign) h = w / ratio;
    else if (w / h > ratio) h = w / ratio;
    else w = h * ratio;
  }
  // the anchor keeps its relative (u,v) position in the new box → centre = anchor + ((0.5-u)·w, (0.5-v)·h), rotated
  const offWorld = rotatePt({ x: (0.5 - au) * w, y: (0.5 - av) * h }, { x: 0, y: 0 }, r);
  const nc = { x: anchorW.x + offWorld.x, y: anchorW.y + offWorld.y };
  return fitToBox(orig, { x: nc.x - w / 2, y: nc.y - h / 2, w, h });
}

/* ---------------- labels (layers panel) ---------------- */
export function elementLabel(el: CanvasElement, atts: Attachment[]): { icon: string; name: string } {
  const att = atts.find((a) => a.id === el.attachmentId);
  switch (el.type) {
    case 'path':
      return { icon: (el.opacity ?? 1) < 1 ? '🖍️' : '✏️', name: (el.opacity ?? 1) < 1 ? 'Fosforlu' : 'Kalem çizimi' };
    case 'line':
      return { icon: '╱', name: 'Çizgi' };
    case 'arrow':
      return { icon: '➜', name: 'Ok' };
    case 'rect':
      return { icon: '▭', name: 'Dikdörtgen' };
    case 'ellipse':
      return { icon: '◯', name: 'Elips' };
    case 'text':
      return { icon: '𝐓', name: `“${(el.text ?? '').slice(0, 22)}”` };
    case 'sticky':
      return { icon: '📌', name: `Not: ${(el.text ?? '').slice(0, 18)}` };
    case 'image':
      return { icon: '🖼️', name: att?.name ?? 'Görsel' };
    case 'media':
      return { icon: att?.kind === 'pdf' ? '📄' : att?.kind === 'video' ? '🎬' : att?.kind === 'audio' ? '🎧' : '🔗', name: att?.name ?? 'Medya' };
  }
}

/* ---------------- rendering ---------------- */
const imageCache = new Map<string, HTMLImageElement>();

export function getImage(src: string, onLoad?: () => void): HTMLImageElement {
  let img = imageCache.get(src);
  if (!img) {
    img = new Image();
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    if (onLoad) img.addEventListener('load', onLoad, { once: true });
    img.src = src;
    imageCache.set(src, img);
  } else if (!img.complete && onLoad) img.addEventListener('load', onLoad, { once: true });
  return img;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const MEDIA_ICON: Record<string, string> = { pdf: '📄', video: '🎬', audio: '🎧', link: '🔗', file: '📎', image: '🖼️' };

export function drawElement(ctx: CanvasRenderingContext2D, el: CanvasElement, atts: Attachment[], onImgLoad: () => void): void {
  if (el.hidden) return;
  ctx.save();
  const r = el.rotation ?? 0;
  if (r) {
    const c = center(bbox(el));
    ctx.translate(c.x, c.y);
    ctx.rotate(r);
    ctx.translate(-c.x, -c.y);
  }
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
        ctx.quadraticCurveTo(pts[i], pts[i + 1], (pts[i] + pts[i + 2]) / 2, (pts[i + 1] + pts[i + 3]) / 2);
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
    case 'rect': {
      const b = bbox(el);
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      break;
    }
    case 'ellipse': {
      const b = bbox(el);
      ctx.beginPath();
      ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'text': {
      const fs = el.fontSize ?? 48;
      ctx.font = fontFor(fs);
      ctx.textBaseline = 'top';
      (el.text ?? '').split('\n').forEach((line, i) => ctx.fillText(line, el.x ?? 0, (el.y ?? 0) + i * fs * 1.2));
      break;
    }
    case 'sticky': {
      const b = bbox(el);
      ctx.shadowColor = 'rgba(0,0,0,0.18)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = el.fill ?? STICKY_COLORS[0];
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(b.x, b.y, b.w, 18);
      const fs = el.fontSize ?? 26;
      ctx.fillStyle = '#1f2937';
      ctx.font = fontFor(fs);
      ctx.textBaseline = 'top';
      const pad = 18;
      const lines = wrapText(ctx, el.text ?? '', b.w - pad * 2);
      const maxLines = Math.max(1, Math.floor((b.h - pad * 2 - 10) / (fs * 1.25)));
      lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(i === maxLines - 1 && lines.length > maxLines ? `${l}…` : l, b.x + pad, b.y + pad + 12 + i * fs * 1.25));
      break;
    }
    case 'image': {
      const att = atts.find((a) => a.id === el.attachmentId);
      const src = att?.dataUrl ?? att?.url;
      const b = bbox(el);
      if (!src) break;
      const img = getImage(src, onImgLoad);
      if (img.complete && img.naturalWidth) ctx.drawImage(img, b.x, b.y, b.w, b.h);
      else {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
      break;
    }
    case 'media': {
      const att = atts.find((a) => a.id === el.attachmentId);
      const b = bbox(el);
      ctx.shadowColor = 'rgba(0,0,0,0.12)';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, b.x, b.y, b.w, b.h, 18);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#a93bf5';
      ctx.lineWidth = 3;
      ctx.stroke();
      const s = Math.min(b.w, b.h);
      ctx.font = `${s * 0.36}px system-ui, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(MEDIA_ICON[att?.kind ?? 'file'] ?? '📎', b.x + b.w / 2, b.y + b.h * 0.4);
      ctx.fillStyle = '#0f172a';
      ctx.font = fontFor(Math.max(14, s * 0.09));
      const name = att?.name ?? 'Medya';
      ctx.fillText(name.length > 28 ? `${name.slice(0, 26)}…` : name, b.x + b.w / 2, b.y + b.h * 0.74);
      ctx.fillStyle = '#64748b';
      ctx.font = `500 ${Math.max(12, s * 0.07)}px Inter, system-ui, sans-serif`;
      ctx.fillText('çift tıkla → aç', b.x + b.w / 2, b.y + b.h * 0.87);
      break;
    }
  }
  ctx.restore();
}

/** Off-screen render for thumbnails / reports / PNG export. Waits for embedded images. */
export async function renderBoard(elements: CanvasElement[], atts: Attachment[], width = 800): Promise<string> {
  const srcs = elements
    .filter((e) => e.type === 'image' && !e.hidden)
    .map((e) => atts.find((a) => a.id === e.attachmentId))
    .map((a) => a?.dataUrl ?? a?.url)
    .filter((s): s is string => !!s);
  await Promise.all(
    srcs.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = getImage(src);
          if (img.complete) return resolve();
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
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

/* ---------------- placing attachments ---------------- */
function naturalSize(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = getImage(src);
    const done = () => resolve({ w: img.naturalWidth || 800, h: img.naturalHeight || 600 });
    if (img.complete) return done();
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', () => resolve({ w: 800, h: 600 }), { once: true });
  });
}

/** Canvas elements for freshly added attachments: images as pictures, everything else as clickable media cards. Cascades placement. */
export async function elementsForAttachments(atts: Attachment[], existing: number): Promise<CanvasElement[]> {
  const out: CanvasElement[] = [];
  for (const [i, a] of atts.entries()) {
    const k = existing + i;
    const off = (k % 6) * 36;
    if (a.kind === 'image') {
      const { w: nw, h: nh } = await naturalSize(a.dataUrl ?? a.url ?? '');
      const s = Math.min(720 / nw, 480 / nh, 1);
      const w = nw * s, h = nh * s;
      out.push({ id: uid(), type: 'image', color: '#000', width: 1, attachmentId: a.id, x: (BOARD_W - w) / 2 + off - 90, y: (BOARD_H - h) / 2 + off - 90, w, h });
    } else {
      out.push({ id: uid(), type: 'media', color: '#000', width: 1, attachmentId: a.id, x: 120 + off * 3, y: 120 + off * 2, w: 300, h: 220 });
    }
  }
  return out;
}

export function stickyElement(text: string, colorIndex = 0, at?: Pt): CanvasElement {
  const x = at?.x ?? 160 + Math.random() * (BOARD_W - 520);
  const y = at?.y ?? 120 + Math.random() * (BOARD_H - 420);
  return {
    id: uid(),
    type: 'sticky',
    color: '#1f2937',
    width: 1,
    x,
    y,
    w: 300,
    h: 230,
    text,
    fontSize: 26,
    fill: STICKY_COLORS[colorIndex % STICKY_COLORS.length],
    rotation: ((Math.random() - 0.5) * 6 * Math.PI) / 180,
  };
}
