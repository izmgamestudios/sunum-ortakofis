// client/src/lib/canvasGroups.ts — layer folders / groups: hierarchy helpers and group transforms
import type { CanvasElement, CanvasGroup } from '../types';
import { bbox, center, fitToBox, rotatePt, translate, type Box, type Pt } from './canvasDraw';
import { uid } from './factory';

export type GroupMap = Map<string, CanvasGroup>;
export const groupMap = (groups: CanvasGroup[]): GroupMap => new Map(groups.map((g) => [g.id, g]));

/** Group ids from the element's own group up to the root. */
export function chainOf(groupId: string | undefined, gm: GroupMap): string[] {
  const out: string[] = [];
  let cur = groupId;
  const seen = new Set<string>();
  while (cur && gm.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    out.push(cur);
    cur = gm.get(cur)!.parentId;
  }
  return out;
}

export const isHidden = (el: CanvasElement, gm: GroupMap) => !!el.hidden || chainOf(el.groupId, gm).some((g) => gm.get(g)!.hidden);
export const groupHidden = (gid: string, gm: GroupMap) => chainOf(gid, gm).some((g) => gm.get(g)!.hidden);

/** Elements with hidden ancestors removed (for thumbnails, export, audience). */
export function visibleElements(elements: CanvasElement[], groups: CanvasGroup[] = []): CanvasElement[] {
  if (!groups.length) return elements.filter((e) => !e.hidden);
  const gm = groupMap(groups);
  return elements.filter((e) => !isHidden(e, gm));
}

/**
 * Node that is selected when an element is clicked: the outermost ancestor group directly below `entered`
 * (root when null), or the element itself.
 */
export function topNode(el: CanvasElement, gm: GroupMap, entered: string | null): string {
  const chain = chainOf(el.groupId, gm); // innermost … outermost
  if (!entered) return chain.length ? chain[chain.length - 1] : el.id;
  const i = chain.indexOf(entered);
  if (i < 0) return chain.length ? chain[chain.length - 1] : el.id; // outside the entered group
  return i === 0 ? el.id : chain[i - 1];
}

export function isInside(el: CanvasElement, gid: string, gm: GroupMap): boolean {
  return chainOf(el.groupId, gm).includes(gid);
}

/** Expand node ids (elements and/or groups) to the elements they contain. */
export function expandNodes(ids: string[], elements: CanvasElement[], gm: GroupMap): CanvasElement[] {
  const set = new Set(ids);
  return elements.filter((e) => set.has(e.id) || chainOf(e.groupId, gm).some((g) => set.has(g)));
}

/** All descendant group ids of `gid` (inclusive). */
export function subGroups(gid: string, groups: CanvasGroup[]): string[] {
  const out = [gid];
  for (let i = 0; i < out.length; i++) groups.forEach((g) => g.parentId === out[i] && !out.includes(g.id) && out.push(g.id));
  return out;
}

/** Can this element be moved/resized/rotated? (own lock, ancestor lock, or "lock children" of an ancestor below the selected level) */
export function isFrozen(el: CanvasElement, gm: GroupMap, selectedNode: string): boolean {
  if (el.locked) return true;
  const chain = chainOf(el.groupId, gm);
  for (const g of chain) {
    const grp = gm.get(g)!;
    if (grp.locked) return true;
    if (g === selectedNode) return false; // moving the whole group is fine
    if (grp.lockChildren) return true;
  }
  return false;
}

/* ---------------- geometry ---------------- */
/** Axis-aligned bounds of an element including its rotation. */
export function aabb(el: CanvasElement): Box {
  const b = bbox(el);
  const r = el.rotation ?? 0;
  if (!r) return b;
  const c = center(b);
  const pts = [
    { x: b.x, y: b.y },
    { x: b.x + b.w, y: b.y },
    { x: b.x + b.w, y: b.y + b.h },
    { x: b.x, y: b.y + b.h },
  ].map((p) => rotatePt(p, c, r));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

export function unionBox(els: CanvasElement[]): Box | null {
  if (!els.length) return null;
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  els.forEach((e) => {
    const b = aabb(e);
    x1 = Math.min(x1, b.x);
    y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.w);
    y2 = Math.max(y2, b.y + b.h);
  });
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export const boxesIntersect = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Scale a set of elements from box `from` to box `to` (each element keeps its own rotation). */
export function scaleElements(els: CanvasElement[], from: Box, to: Box): CanvasElement[] {
  const sx = from.w ? to.w / from.w : 1;
  const sy = from.h ? to.h / from.h : 1;
  return els.map((el) => {
    const b = bbox(el);
    const c = center(b);
    const nc = { x: to.x + (c.x - from.x) * sx, y: to.y + (c.y - from.y) * sy };
    const w = Math.max(2, b.w * sx), h = Math.max(2, b.h * sy);
    const scaled = fitToBox(el, { x: nc.x - w / 2, y: nc.y - h / 2, w, h });
    return el.points ? { ...scaled, width: Math.max(1, el.width * Math.sqrt(Math.abs(sx * sy))) } : scaled;
  });
}

/** Rotate a set of elements around `pivot` by `delta` radians. */
export function rotateElements(els: CanvasElement[], pivot: Pt, delta: number): CanvasElement[] {
  return els.map((el) => {
    const c = center(bbox(el));
    const nc = rotatePt(c, pivot, delta);
    return { ...translate(el, nc.x - c.x, nc.y - c.y), rotation: (el.rotation ?? 0) + delta };
  });
}

/** Deep copy of nodes (elements + groups) with fresh ids, offset by (dx, dy). */
export function duplicateNodes(ids: string[], elements: CanvasElement[], groups: CanvasGroup[], dx = 30, dy = 30) {
  const gm = groupMap(groups);
  const groupIds = new Set(ids.filter((id) => gm.has(id)).flatMap((g) => subGroups(g, groups)));
  const newGroupId = new Map([...groupIds].map((g) => [g, uid()]));
  const newGroups = [...groupIds].map((g) => {
    const og = gm.get(g)!;
    return { ...og, id: newGroupId.get(g)!, name: ids.includes(g) ? `${og.name} (kopya)` : og.name, parentId: og.parentId && newGroupId.get(og.parentId) ? newGroupId.get(og.parentId) : og.parentId };
  });
  const newElId = new Map<string, string>();
  const els = expandNodes(ids, elements, gm).map((e) => {
    const id = uid();
    newElId.set(e.id, id);
    return { ...translate(e, dx, dy), id, groupId: e.groupId && newGroupId.get(e.groupId) ? newGroupId.get(e.groupId) : e.groupId };
  });
  const topIds = ids.map((id) => newGroupId.get(id) ?? newElId.get(id)).filter((x): x is string => !!x);
  return { elements: els, groups: newGroups, topIds };
}
