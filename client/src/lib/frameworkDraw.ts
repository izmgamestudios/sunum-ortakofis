// client/src/lib/frameworkDraw.ts — turns a framework definition into editable whiteboard elements
import type { CanvasElement } from '../types';
import type { BizArea, Framework, Layout } from './frameworks';
import { STICKY_COLORS, textWidth } from './canvasDraw';
import { uid } from './factory';

const PALETTE = ['#3b8bf7', '#a93bf5', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6', '#ec4899', '#6366f1', '#0ea5e9', '#84cc16', '#f97316', '#64748b'];
const INK = '#0f172a';
const MUTED = '#64748b';
const CX = 800;
const CY = 520;

const alpha = (hex: string, a: number) => `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
const col = (i: number) => PALETTE[i % PALETTE.length];

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1, 7), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

class Builder {
  els: CanvasElement[] = [];
  constructor(private fwId: number) {}
  private push(el: Omit<CanvasElement, 'id' | 'frameworkId'>) {
    this.els.push({ ...el, id: uid(), frameworkId: this.fwId });
  }
  /** largest font size ≤ fs that fits every line into maxW */
  fit(text: string, maxW: number, fs: number, min = 13): number {
    let f = fs;
    while (f > min && textWidth(text, f) > maxW) f -= 1;
    return f;
  }
  text(text: string, cx: number, cy: number, fs: number, color = INK, opts: { maxW?: number; rotation?: number; left?: boolean } = {}) {
    if (!text) return;
    const f = opts.maxW ? this.fit(text, opts.maxW, fs) : fs;
    const w = textWidth(text, f);
    const h = text.split('\n').length * f * 1.2;
    this.push({ type: 'text', color, width: 1, text, fontSize: f, align: 'center', x: opts.left ? cx : cx - w / 2, y: cy - h / 2, rotation: opts.rotation });
  }
  /** "TITLE\nsub" → bold title + smaller muted subtitle stacked around cy */
  label(text: string, cx: number, cy: number, fs: number, maxW: number, color = INK) {
    const [title, ...rest] = text.split('\n');
    const sub = rest.join('\n');
    if (!sub) return this.text(title, cx, cy, fs, color, { maxW });
    const tf = this.fit(title, maxW, fs);
    const sf = this.fit(sub, maxW, Math.max(14, Math.round(fs * 0.62)));
    const total = tf * 1.2 + sf * 1.2 * sub.split('\n').length + 6;
    this.text(title, cx, cy - total / 2 + (tf * 1.2) / 2, tf, color);
    this.text(sub, cx, cy + total / 2 - (sf * 1.2 * sub.split('\n').length) / 2, sf, color === INK ? MUTED : color);
  }
  rect(x: number, y: number, w: number, h: number, stroke: string, fill?: string, width = 3) {
    this.push({ type: 'rect', color: stroke, width, x, y, w, h, fill });
  }
  circle(cx: number, cy: number, r: number, stroke: string, fill?: string, width = 3) {
    this.push({ type: 'ellipse', color: stroke, width, x: cx - r, y: cy - r, w: r * 2, h: r * 2, fill });
  }
  poly(points: number[], stroke: string, fill?: string, width = 3) {
    this.push({ type: 'polygon', color: stroke, width, points, fill });
  }
  line(x1: number, y1: number, x2: number, y2: number, color = MUTED, width = 3, arrow = false) {
    this.push({ type: arrow ? 'arrow' : 'line', color, width, points: [x1, y1, x2, y2] });
  }
  path(points: number[], color: string, width = 6) {
    this.push({ type: 'path', color, width, points });
  }
  /** free sticky note (not grouped/locked on insert) for filling in a canvas block */
  sticky(x: number, y: number, w: number, h: number, colorIndex = 0, text = '…') {
    this.push({ type: 'sticky', color: '#1f2937', width: 1, x, y, w, h, text, fontSize: 20, fill: STICKY_COLORS[colorIndex % STICKY_COLORS.length] });
  }
  /** left-aligned paragraph wrapped to maxW, top edge at y */
  para(text: string, x: number, y: number, fs: number, maxW: number, color = MUTED): number {
    const lines = wrap(text, fs, maxW);
    this.push({ type: 'text', color, width: 1, text: lines.join('\n'), fontSize: fs, align: 'left', x, y });
    return lines.length * fs * 1.2;
  }
}

/** greedy word wrap using the whiteboard's text metrics */
function wrap(text: string, fs: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && textWidth(next, fs) > maxW) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

/* business canvas grid: 5 top columns + 2 bottom halves */
const BIZ = { x: 70, w: 1460, top: 150, mid: 670, bottom: 860 };
function bizRect(a: BizArea): { x: number; y: number; w: number; h: number } {
  const cw = BIZ.w / 5, th = BIZ.mid - BIZ.top, half = th / 2;
  if (a === 'b1') return { x: BIZ.x, y: BIZ.mid, w: BIZ.w / 2, h: BIZ.bottom - BIZ.mid };
  if (a === 'b2') return { x: BIZ.x + BIZ.w / 2, y: BIZ.mid, w: BIZ.w / 2, h: BIZ.bottom - BIZ.mid };
  const c = Number(a[1]) - 1;
  const x = BIZ.x + c * cw;
  if (a.endsWith('t')) return { x, y: BIZ.top, w: cw, h: half };
  if (a.endsWith('b')) return { x, y: BIZ.top + half, w: cw, h: half };
  return { x, y: BIZ.top, w: cw, h: th };
}

/** Catmull-Rom → dense polyline so the whiteboard's smoothing draws a clean curve. */
function smooth(pts: [number, number][], samples = 16): number[] {
  const out: number[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < samples; s++) {
      const t = s / samples, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push(f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]));
    }
  }
  const last = pts[pts.length - 1];
  out.push(last[0], last[1]);
  return out;
}

function axes(b: Builder, ox: number, oy: number, ex: number, ey: number, xLabel: string, yLabel: string) {
  b.line(ox, oy, ex, oy, INK, 3, true);
  b.line(ox, oy, ox, ey, INK, 3, true);
  b.text(xLabel, (ox + ex) / 2, oy + 40, 24, MUTED);
  b.text(yLabel, ox - 50, (oy + ey) / 2, 24, MUTED, { rotation: -Math.PI / 2 });
}

/* ------------------------------------------------------------------ */
const LAYOUTS: { [K in Layout['kind']]: (b: Builder, fw: Framework, l: Extract<Layout, { kind: K }>) => void } = {
  venn(b, fw, l) {
    const n = fw.parts.length;
    const centres: [number, number][] =
      n === 2 ? [[CX - 170, CY], [CX + 170, CY]]
      : n === 3 ? [[CX, CY - 110], [CX - 150, CY + 120], [CX + 150, CY + 120]]
      : [[CX, CY - 180], [CX - 190, CY], [CX + 190, CY], [CX, CY + 180]];
    const r = n === 4 ? 190 : n === 3 ? 235 : 260;
    centres.forEach(([x, y], i) => b.circle(x, y, r, col(i), alpha(col(i), 0.18)));
    const mid = centres.reduce((a, [x, y]) => [a[0] + x / n, a[1] + y / n], [0, 0]);
    centres.forEach(([x, y], i) => {
      const dx = x - mid[0], dy = y - mid[1];
      const d = Math.hypot(dx, dy) || 1;
      b.label(fw.parts[i], x + (dx / d) * r * 0.5, y + (dy / d) * r * 0.5, 30, r * 1.1, col(i));
    });
    // pairwise intersections (Ikigai: passion / mission / vocation / profession)
    if (l.pairs && n === 4) {
      const pairIdx: [number, number][] = [[0, 1], [0, 2], [2, 3], [1, 3]];
      pairIdx.forEach(([a, c], k) => {
        const [x1, y1] = centres[a], [x2, y2] = centres[c];
        const px = (x1 + x2) / 2, py = (y1 + y2) / 2;
        const dx = px - mid[0], dy = py - mid[1], d = Math.hypot(dx, dy) || 1;
        b.text(l.pairs![k], px + (dx / d) * 40, py + (dy / d) * 40, 20, INK);
      });
    }
    if (l.center) {
      b.circle(mid[0], mid[1], 62, INK, '#ffffffdd', 2);
      b.text(l.center, mid[0], mid[1], 26, INK, { maxW: 110 });
    }
  },

  wheel(b, fw) {
    const n = fw.parts.length, R = 320;
    [0.25, 0.5, 0.75].forEach((k) => b.circle(CX, CY, R * k, '#cbd5e1', undefined, 1.5));
    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / n, a1 = a0 + (2 * Math.PI) / n;
      const pts = [CX, CY];
      for (let s = 0; s <= 14; s++) {
        const a = a0 + ((a1 - a0) * s) / 14;
        pts.push(CX + Math.cos(a) * R, CY + Math.sin(a) * R);
      }
      b.poly(pts, '#ffffff', alpha(col(i), 0.28), 3);
      const am = (a0 + a1) / 2;
      b.text(fw.parts[i], CX + Math.cos(am) * (R + 58), CY + Math.sin(am) * (R + 34), 24, col(i), { maxW: 190 });
    }
    b.circle(CX, CY, 8, INK, INK, 1);
    b.text('Her alanı 1–10 puanla ve dilimi o seviyeye kadar boya', CX, 878, 18, MUTED);
  },

  concentric(b, fw) {
    const n = fw.parts.length;
    const rMin = n === 2 ? 170 : 115, rMax = 330;
    const radii = fw.parts.map((_, i) => (n === 1 ? rMax : rMin + ((rMax - rMin) * i) / (n - 1)));
    for (let i = n - 1; i >= 0; i--) b.circle(CX, CY, radii[i], col(i), alpha(col(i), i === 0 ? 0.35 : 0.16));
    fw.parts.forEach((p, i) => {
      if (i === 0) b.label(p, CX, CY, 32, radii[0] * 1.6, INK);
      else b.label(p, CX, CY - (radii[i] + radii[i - 1]) / 2, 28, (radii[i] - radii[i - 1]) * 3, col(i));
    });
  },

  matrix(b, fw, l) {
    const x0 = 260, y0 = 200, w = 610, h = 315;
    fw.parts.slice(0, 4).forEach((p, i) => {
      const cx = x0 + (i % 2) * w, cy = y0 + Math.floor(i / 2) * h;
      b.rect(cx, cy, w - 12, h - 12, col(i), alpha(col(i), 0.14));
      b.label(p, cx + (w - 12) / 2, cy + (h - 12) / 2, 34, w - 60, col(i));
    });
    if (l.x) l.x.forEach((t, i) => b.text(t, x0 + i * w + (w - 12) / 2, y0 - 28, 24, MUTED));
    if (l.y) l.y.forEach((t, i) => b.text(t, x0 - 48, y0 + i * h + (h - 12) / 2, 24, MUTED, { rotation: -Math.PI / 2 }));
  },

  pyramid(b, fw, l) {
    const n = fw.parts.length, top = 180, base = 850, half = 540;
    const lh = (base - top) / n;
    const hw = (y: number) => (half * (y - top)) / (base - top);
    fw.parts.forEach((p, i) => {
      const y1 = top + i * lh, y2 = y1 + lh;
      b.poly([CX - hw(y1), y1, CX + hw(y1), y1, CX + hw(y2), y2, CX - hw(y2), y2], '#ffffff', alpha(col(i), 0.75), 3);
      const room = (hw(y1) + hw(y2)) * 0.85;
      const fs = Math.min(28, lh * 0.42);
      if (b.fit(p, room, fs) < 18) {
        // too narrow (pyramid tip): label outside on the left with a leader line
        const lx = CX - hw(y2) - 40;
        b.line(lx + 8, (y1 + y2) / 2 + lh * 0.15, CX - 6, (y1 + y2) / 2 + lh * 0.15, '#cbd5e1', 2);
        b.text(p, lx - textWidth(p, 22) / 2, (y1 + y2) / 2 + lh * 0.15, 22, col(i));
      } else b.text(p, CX, (y1 + y2) / 2 + (i === 0 ? lh * 0.18 : 0), fs, luminance(col(i)) > 0.6 ? INK : '#ffffff', { maxW: room });
      if (l.notes?.[i]) b.text(l.notes[i], CX + hw(y2) + 70, (y1 + y2) / 2, 22, MUTED);
    });
  },

  cycle(b, fw) {
    const n = fw.parts.length;
    const R = n <= 4 ? 245 : n <= 6 ? 270 : 300;
    const rn = n <= 4 ? 112 : n <= 8 ? 82 : 60;
    const pos = fw.parts.map((_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return [CX + Math.cos(a) * R * 1.35, CY + 10 + Math.sin(a) * R] as [number, number];
    });
    pos.forEach(([x1, y1], i) => {
      const [x2, y2] = pos[(i + 1) % n];
      const d = Math.hypot(x2 - x1, y2 - y1);
      const ux = (x2 - x1) / d, uy = (y2 - y1) / d;
      b.line(x1 + ux * (rn + 10), y1 + uy * (rn + 10), x2 - ux * (rn + 14), y2 - uy * (rn + 14), MUTED, 3, true);
    });
    pos.forEach(([x, y], i) => {
      b.circle(x, y, rn, col(i), alpha(col(i), 0.2));
      b.label(fw.parts[i], x, y, n <= 4 ? 30 : n <= 8 ? 22 : 17, rn * 1.7, col(i));
    });
    b.text('↻', CX, CY + 10, 90, '#cbd5e1');
  },

  steps(b, fw) {
    const n = fw.parts.length, gap = 12, total = 1460;
    const w = (total - gap * (n - 1)) / n, h = 210, y = 300, notch = 42;
    fw.parts.forEach((p, i) => {
      const x = 70 + i * (w + gap);
      const pts = [x, y, x + w - notch, y, x + w, y + h / 2, x + w - notch, y + h, x, y + h];
      if (i > 0) pts.push(x + notch, y + h / 2); // inward notch on all but the first chevron
      b.poly(pts, '#ffffff', col(i), 2);
      b.text(String(i + 1), x + w / 2, y - 34, 26, col(i));
      b.label(p, x + w / 2 + (i === 0 ? -10 : 8), y + h / 2, 28, w - notch * 2 - 8, '#ffffff');
      b.rect(x + 8, y + h + 50, w - 16, 220, '#cbd5e1', '#f8fafc', 2);
      b.text('Örneğini yaz…', x + w / 2, y + h + 82, 18, '#94a3b8');
    });
  },

  vsteps(b, fw, l) {
    const n = fw.parts.length, top = 175, avail = 690, gap = 26;
    const h = Math.min(88, (avail - gap * (n - 1)) / n), w = 900, x = CX - w / 2;
    fw.parts.forEach((p, i) => {
      const y = top + i * (h + gap);
      const c = i === 0 ? '#ef4444' : i === n - 1 ? '#22c55e' : col(i);
      b.rect(x, y, w, h, c, alpha(c, 0.14));
      b.text(p, x + 150, y + h / 2, 26, c, { maxW: 260 });
      b.text('…', x + 600, y + h / 2, 26, '#94a3b8');
      if (i < n - 1) {
        b.line(CX, y + h + 2, CX, y + h + gap - 2, MUTED, 3, true);
        if (l.connector) b.text(l.connector, CX + 80, y + h + gap / 2, 16, MUTED);
      }
    });
  },

  stairs(b, fw) {
    const n = fw.parts.length, w = 1400 / n, bottom = 850;
    fw.parts.forEach((p, i) => {
      const h = 130 + (i * 480) / Math.max(1, n - 1);
      const x = 100 + i * w;
      b.rect(x, bottom - h, w - 10, h, col(i), alpha(col(i), 0.2));
      b.text(String(i + 1), x + (w - 10) / 2, bottom - h + 34, 26, col(i));
      b.text(p, x + (w - 10) / 2, bottom - h + 78, 26, INK, { maxW: w - 30 });
    });
    b.line(120, 300, 1460, 175, '#cbd5e1', 4, true);
  },

  columns(b, fw, l) {
    const n = fw.parts.length, gap = 16, w = (1460 - gap * (n - 1)) / n;
    fw.parts.forEach((p, i) => {
      const x = 70 + i * (w + gap);
      const fill = l.colors?.[i] ?? alpha(col(i), 0.28);
      const solid = l.colors?.[i] ?? col(i);
      const ink = l.colors?.[i] ? (luminance(l.colors[i]) < 0.45 ? '#ffffff' : INK) : INK;
      b.rect(x, 175, w, 135, solid, fill, 3);
      b.label(p, x + w / 2, 242, n > 5 ? 26 : 32, w - 24, ink);
      b.rect(x, 322, w, 528, '#cbd5e1', '#f8fafc', 2);
      b.text('…', x + w / 2, 360, 26, '#94a3b8');
    });
  },

  stack(b, fw) {
    const n = fw.parts.length, h = 160, gap = 30, w = 960;
    const top = CY - (n * h + (n - 1) * gap) / 2 + 20;
    const colors = ['#22c55e', '#f59e0b', '#22c55e', '#3b8bf7'];
    fw.parts.forEach((p, i) => {
      const c = colors[i % colors.length];
      b.rect(CX - w / 2, top + i * (h + gap), w, h, c, alpha(c, 0.2));
      b.text(p, CX - w / 2 + 150, top + i * (h + gap) + h / 2, 34, c, { maxW: 240 });
      b.text('“…”', CX + 140, top + i * (h + gap) + h / 2, 28, '#94a3b8');
    });
  },

  curve(b, _fw, l) {
    const ox = 200, oy = 810, W = 1240, H = 570;
    axes(b, ox, oy, ox + W + 40, oy - H - 30, l.x, l.y);
    const map = ([u, v]: [number, number]): [number, number] => [ox + 20 + u * W, oy - 10 - v * H];
    const pts = l.points.map(map);
    b.path(smooth(pts), '#a93bf5', 7);
    l.marks.forEach(([i, label], k) => {
      const [x, y] = pts[i];
      b.circle(x, y, 11, col(k), col(k), 2);
      const above = l.points[i][1] < 0.6;
      b.text(label, x, y + (above ? -42 : 42), 24, col(k), { maxW: 220 });
    });
  },

  fishbone(b, fw, l) {
    b.line(160, CY, 1230, CY, INK, 6, true);
    b.rect(1245, CY - 75, 270, 150, '#ef4444', alpha('#ef4444', 0.15));
    b.text(l.head, 1380, CY - 14, 30, '#ef4444');
    b.text('Sorunu yaz…', 1380, CY + 28, 18, MUTED);
    [380, 720, 1060].forEach((x, k) => {
      [-1, 1].forEach((side, s) => {
        const idx = k + s * 3;
        const p = fw.parts[idx];
        if (!p) return;
        const ex = x - 180, ey = CY + side * 290;
        b.line(ex, ey, x, CY, col(idx), 4);
        b.rect(ex - 105, ey + (side < 0 ? -62 : 8), 210, 54, col(idx), alpha(col(idx), 0.18), 2);
        b.text(p, ex, ey + (side < 0 ? -35 : 35), 24, col(idx), { maxW: 190 });
        [0.35, 0.68].forEach((t) => {
          const bx = ex + (x - ex) * t, by = ey + (CY - ey) * t;
          b.line(bx - 110, by, bx, by, '#cbd5e1', 2);
          b.text('neden…', bx - 150, by, 16, '#94a3b8');
        });
      });
    });
  },

  pareto(b) {
    const values = [38, 22, 12, 9, 7, 5, 4, 3];
    const ox = 200, oy = 810, W = 1220, H = 560;
    axes(b, ox, oy, ox + W + 60, oy - H - 40, 'Nedenler (en etkiliden en aza)', 'Etki');
    const bw = W / values.length;
    let cum = 0;
    const cumPts: [number, number][] = [];
    values.forEach((v, i) => {
      const h = (v / 40) * H * 0.95;
      const x = ox + 20 + i * bw;
      const hi = i < 2;
      b.rect(x, oy - h, bw - 22, h, hi ? '#a93bf5' : '#94a3b8', alpha(hi ? '#a93bf5' : '#94a3b8', hi ? 0.75 : 0.35), 2);
      b.text(`N${i + 1}`, x + (bw - 22) / 2, oy + 16, 16, MUTED);
      cum += v;
      cumPts.push([x + (bw - 22) / 2, oy - (cum / 100) * H]);
    });
    b.path(smooth(cumPts, 6), '#f59e0b', 5);
    const y80 = oy - 0.8 * H;
    b.line(ox, y80, ox + W + 20, y80, '#f59e0b', 2);
    b.text('%80', ox + W + 50, y80, 22, '#f59e0b');
    b.text('%20 neden → %80 sonuç', ox + bw * 1.1, oy - 0.95 * H * 0.95 - 34, 26, '#a93bf5');
  },

  table(b, _fw, l) {
    const cols = l.headers.length;
    const total = 1360, first = total / (cols + 0.6) * 1.6;
    const rest = (total - first) / (cols - 1);
    const widths = l.headers.map((_, i) => (i === 0 ? first : rest));
    const x0 = 120, rh = 78, hh = 72;
    const rows = l.rows.length;
    const y0 = Math.max(185, CY - (hh + rows * rh) / 2 - (l.formula ? 30 : 0));
    let x = x0;
    l.headers.forEach((h, i) => {
      b.rect(x, y0, widths[i], hh, '#7c3aed', alpha('#a93bf5', 0.85), 1);
      b.text(h, x + widths[i] / 2, y0 + hh / 2, 24, '#ffffff', { maxW: widths[i] - 20 });
      x += widths[i];
    });
    l.rows.forEach((row, r) => {
      let cx = x0;
      const y = y0 + hh + r * rh;
      row.forEach((cell, i) => {
        b.rect(cx, y, widths[i], rh, '#cbd5e1', r % 2 ? '#f8fafc' : '#ffffff', 1.5);
        if (cell) b.text(cell, cx + widths[i] / 2, y + rh / 2, 22, i === 0 ? INK : '#334155', { maxW: widths[i] - 20 });
        cx += widths[i];
      });
    });
    if (l.formula) b.text(l.formula, CX, y0 + hh + rows * rh + 50, 24, MUTED, { maxW: 1300 });
  },

  tree(b, fw) {
    const [root, first, second] = fw.parts;
    const box = (x: number, y: number, w: number, h: number, t: string, c: string) => {
      b.rect(x, y, w, h, c, alpha(c, 0.15));
      b.text(t, x + w / 2, y + h / 2, 24, c, { maxW: w - 24 });
    };
    b.text(root, 290, 172, 24, MUTED);
    b.text(`${first}\n“Hemen ne olur?”`, 780, 172, 22, MUTED);
    b.text(`${second}\n“Sonra ne olur?”`, 1290, 172, 22, MUTED);
    box(140, CY - 60, 300, 120, 'Karar: …', '#a93bf5');
    [[345, 'A'], [705, 'B']].forEach(([y, k], i) => {
      const yy = y as number;
      b.line(440, CY, 620, yy, MUTED, 3, true);
      box(620, yy - 50, 320, 100, `Sonuç ${k}: …`, col(i));
      [-80, 80].forEach((dy, j) => {
        b.line(940, yy, 1120, yy + dy, '#cbd5e1', 3, true);
        box(1120, yy + dy - 38, 340, 76, `${k}${j + 1}: …`, col(i + 2));
      });
    });
  },

  chain(b, fw) {
    b.text('Mevcut alışkanlık (işaret)', 450, 205, 26, MUTED);
    b.text('Yeni alışkanlık', 1150, 205, 26, MUTED);
    for (let i = 0; i < fw.parts.length; i += 2) {
      const y = 250 + (i / 2) * 195;
      b.rect(200, y, 500, 130, '#3b8bf7', alpha('#3b8bf7', 0.14));
      b.text(fw.parts[i], 450, y + 65, 28, '#1d4ed8', { maxW: 460 });
      b.line(720, y + 65, 880, y + 65, MUTED, 4, true);
      b.text('sonra', 800, y + 38, 18, MUTED);
      b.rect(900, y, 500, 130, '#22c55e', alpha('#22c55e', 0.16));
      b.text(fw.parts[i + 1] ?? '…', 1150, y + 65, 28, '#15803d', { maxW: 460 });
    }
  },

  timeline(b, _fw, l) {
    const total = l.blocks.reduce((a, [, m]) => a + m, 0);
    let x = 110;
    const W = 1380, y = 360, h = 170;
    l.blocks.forEach(([name, m]) => {
      const w = (m / total) * W;
      const focus = name === 'Odak';
      const c = focus ? '#ef4444' : name === 'Uzun mola' ? '#14b8a6' : '#22c55e';
      b.rect(x, y, w - 6, h, c, alpha(c, focus ? 0.75 : 0.35), 2);
      b.text(`${focus ? '🍅' : '☕'}\n${m} dk`, x + (w - 6) / 2, y + h / 2, w > 120 ? 26 : 18, focus ? '#ffffff' : INK, { maxW: w - 14 });
      b.text(name, x + (w - 6) / 2, y + h + 34, 18, MUTED, { maxW: w });
      x += w;
    });
    b.text('Her 25 dk odaktan sonra 5 dk mola · 4 turdan sonra uzun mola', CX, 680, 26, INK);
    b.text('Bugünün turları:  ○ ○ ○ ○   ○ ○ ○ ○', CX, 750, 26, MUTED);
  },

  jar(b, fw) {
    b.poly([560, 250, 560, 790, 610, 845, 990, 845, 1040, 790, 1040, 250], '#64748b', alpha('#bfdbfe', 0.25), 4);
    b.rect(535, 210, 530, 44, '#64748b', '#e2e8f0', 3);
    [[690, 730], [870, 735], [780, 580]].forEach(([x, y], i) => {
      b.circle(x, y, 92, '#475569', alpha(col(i), 0.55), 3);
      b.text(['Sağlık', 'Aile', 'Hedef'][i], x, y, 26, INK);
    });
    [[620, 520], [960, 600], [930, 470], [660, 420], [820, 420], [990, 380]].forEach(([x, y]) => b.circle(x, y, 32, '#94a3b8', '#cbd5e1', 2));
    b.rect(570, 280, 460, 60, '#eab308', alpha('#fde68a', 0.8), 1);
    b.text('kum', 800, 310, 20, '#92400e');
    fw.parts.forEach((p, i) => b.text(`${['🪨', '🔘', '⏳'][i]} ${p}`, 1290, 380 + i * 90, 28, INK, { maxW: 380 }));
    b.text('Önce büyük taşlar!', 1290, 680, 26, '#a93bf5');
  },

  kano(b, fw) {
    const ox = CX, oy = CY + 20, W = 620, H = 300;
    b.line(ox - W - 20, oy, ox + W + 30, oy, INK, 3, true);
    b.line(ox, oy + H + 20, ox, oy - H - 30, INK, 3, true);
    b.text('Özellik düzeyi →', ox + W - 80, oy + 32, 22, MUTED);
    b.text('Memnuniyet', ox, oy - H - 52, 22, MUTED);
    const map = (u: number, v: number) => [ox + u * W, oy - v * H] as [number, number];
    const curves: [number, number][][] = [
      Array.from({ length: 9 }, (_, i) => { const u = -1 + i / 4; return [u, -0.95 + 0.95 * (1 - Math.exp(-2.6 * (u + 1))) / (1 - Math.exp(-5.2))]; }),
      [[-1, -0.75], [1, 0.75]],
      Array.from({ length: 9 }, (_, i) => { const u = -1 + i / 4; return [u, 0.95 * (Math.exp(2.6 * (u + 1)) - 1) / (Math.exp(5.2) - 1)]; }),
    ];
    curves.forEach((c, i) => {
      const pts = c.map(([u, v]) => map(u, v));
      b.path(smooth(pts, 8), col(i), 6);
      const [lx, ly] = pts[pts.length - 1];
      b.text(fw.parts[i], lx - 60, ly - 34, 24, col(i), { maxW: 260 });
    });
  },

  bizcanvas(b, _fw, l) {
    l.blocks.forEach((blk, i) => {
      const r = bizRect(blk.area);
      const c = col(i);
      const pad = 16;
      b.rect(r.x + 3, r.y + 3, r.w - 6, r.h - 6, c, alpha(c, 0.07), 3);
      const head = `${blk.icon} ${blk.title}`;
      const bottomRow = blk.area === 'b1' || blk.area === 'b2';
      const textW = bottomRow ? r.w * 0.5 : r.w - pad * 2 - 6;
      const hf = b.fit(head, textW, 22, 15);
      b.text(head, r.x + pad + 3, r.y + pad + 3 + (hf * 1.2) / 2, hf, INK, { left: true });
      const qh = b.para(blk.q, r.x + pad + 3, r.y + pad + 12 + hf * 1.2, 15, textW);
      if (bottomRow) {
        const sw = Math.min(300, r.w * 0.4), sh = r.h - 44;
        b.sticky(r.x + r.w - sw - 24, r.y + 22, sw, sh, i);
      } else {
        const sy = r.y + pad + 26 + hf * 1.2 + qh;
        const sw = r.w - 56, sh = Math.min(130, r.y + r.h - sy - 18);
        if (sh > 60) b.sticky(r.x + 28, sy, sw, sh, i);
      }
    });
  },

  vpc(b) {
    // value map — square
    const sx = 100, sy = 190, ss = 500, vx = sx + ss * 0.36, hy = sy + ss / 2;
    const blue = '#3b8bf7', pink = '#ec4899';
    b.rect(sx, sy, ss, ss, blue, alpha(blue, 0.06), 4);
    b.line(vx, sy, vx, sy + ss, blue, 3);
    b.line(vx, hy, sx + ss, hy, blue, 3);
    b.text('🎁 Ürün &\nHizmetler', (sx + vx) / 2, sy + 60, 22, INK, { maxW: vx - sx - 20 });
    b.text('📈 Kazanç Yaratıcılar', (vx + sx + ss) / 2, sy + 50, 22, INK, { maxW: sx + ss - vx - 30 });
    b.text('💊 Acı Gidericiler', (vx + sx + ss) / 2, hy + 50, 22, INK, { maxW: sx + ss - vx - 30 });
    b.sticky(sx + 20, sy + 150, vx - sx - 40, 120, 3);
    b.sticky(vx + 30, sy + 110, sx + ss - vx - 60, 110, 2);
    b.sticky(vx + 30, hy + 110, sx + ss - vx - 60, 110, 1);
    b.text('Değer Haritası', sx + ss / 2, sy + ss + 40, 28, blue);
    // customer profile — circle
    const cx = 1220, cy = hy, r = 250, jx = cx + r * 0.35, jh = Math.sqrt(r * r - (r * 0.35) ** 2);
    b.circle(cx, cy, r, pink, alpha(pink, 0.06), 4);
    b.line(jx, cy - jh, jx, cy + jh, pink, 3);
    b.line(cx - r, cy, jx, cy, pink, 3);
    b.text('😊 Kazançlar', (cx - r * 0.55 + jx) / 2, cy - 150, 22, INK, { maxW: 260 });
    b.text('😣 Acılar', (cx - r * 0.55 + jx) / 2, cy + 60, 22, INK, { maxW: 260 });
    b.text('🛠️\nMüşteri\nİşleri', (jx + cx + r) / 2, cy - 70, 20, INK, { maxW: cx + r - jx - 16 });
    b.sticky(cx - 170, cy - 110, 230, 90, 2);
    b.sticky(cx - 170, cy + 100, 230, 90, 1);
    b.sticky(jx + 14, cy - 10, cx + r - jx - 44, 110, 0);
    b.text('Müşteri Profili', cx, sy + ss + 40, 28, pink);
    // fit
    b.line(640, cy - 22, 930, cy - 22, '#94a3b8', 4, true);
    b.line(930, cy + 22, 640, cy + 22, '#94a3b8', 4, true);
    b.text('UYUM', 785, cy - 64, 24, MUTED);
    b.para('Acı gidericiler ↔ acılar · kazanç yaratıcılar ↔ kazançlar · ürünler ↔ müşteri işleri', 100, 800, 18, 1400);
  },

  flow(b) {
    const ox = 220, oy = 820, ex = 1430, ey = 220;
    axes(b, ox, oy, ex + 30, ey - 20, 'Beceri', 'Zorluk');
    const ang = Math.atan2(ey - oy, ex - ox);
    // band hugging the diagonal, kept inside the axes
    const sx = ox + 40, sy = oy - 10, tx = ex - 40, ty = ey + 30;
    const nx = -Math.sin(ang) * 75, ny = Math.cos(ang) * 75;
    b.poly([sx + nx, sy + ny, tx + nx, ty + ny, tx - nx, ty - ny, sx - nx * 0.2, sy - ny * 0.2], '#22c55e', alpha('#22c55e', 0.25), 2);
    b.text('AKIŞ', (ox + ex) / 2, (oy + ey) / 2, 44, '#15803d', { rotation: ang });
    b.text('KAYGI\nzorluk > beceri', 520, 360, 32, '#ef4444');
    b.text('SIKILMA\nbeceri > zorluk', 1150, 690, 32, '#3b8bf7');
  },
};

export function buildFramework(fw: Framework): CanvasElement[] {
  const b = new Builder(fw.id);
  b.text(fw.name, 70, 58, 44, INK, { left: true, maxW: 1100 });
  b.text(fw.subtitle, 72, 112, 22, MUTED, { left: true, maxW: 1100 });
  (LAYOUTS[fw.layout.kind] as (b: Builder, fw: Framework, l: Layout) => void)(b, fw, fw.layout);
  const foot = '🧩 Teknodoz Sunum · düzenlenebilir çerçeve';
  b.text(foot, 1530 - textWidth(foot, 14), 884, 14, '#cbd5e1', { left: true });
  return b.els;
}
