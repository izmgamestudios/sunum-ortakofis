// client/src/lib/cloud.ts — shared presentations: REST client, autosave with optimistic concurrency, live update pulls
import { create } from 'zustand';
import type { Presentation } from '../types';
import { useApp } from '../store';
import { normalizePresentation } from './factory';
import { getSocket } from './socket';
import { addPresentation, cloudOf, entryByShare, setCloud, type CloudLink, type LinkRole, type Visibility } from './library';

export type SyncStatus = 'local' | 'saving' | 'saved' | 'conflict' | 'error' | 'deleted' | 'readonly';

interface CloudState {
  status: SyncStatus;
  message: string | null;
  savedAt: number | null;
}
export const useCloud = create<CloudState>(() => ({ status: 'local', message: null, savedAt: null }));

export interface Invite {
  email: string;
  role: LinkRole;
}

export interface ShareSettings {
  visibility: Visibility;
  linkRole: LinkRole;
  password?: string;
  /** invite-only: who may open it after logging in with that e-mail */
  invites?: Invite[];
  /** e-mail an invitation link to newly added invitees */
  notify?: boolean;
}

export interface ShareMeta {
  id: string;
  title: string;
  presenter: string;
  stepCount: number;
  visibility: Visibility;
  linkRole: LinkRole;
  needsPassword: boolean;
  /** invite-only share: the visitor must log in with an invited e-mail */
  needsLogin?: boolean;
  you?: string | null;
  invited?: boolean;
  updatedAt: number;
  version: number;
  role: 'owner' | LinkRole | null;
}

export const shareUrl = (shareId: string) => `${window.location.origin}/?s=${shareId}`;

/* ---------------- REST ---------------- */
class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

async function api<T>(path: string, init: RequestInit & { link?: Pick<CloudLink, 'ownerKey' | 'token'> } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.link?.ownerKey) headers['x-owner-key'] = init.link.ownerKey;
  else if (init.link?.token) headers.Authorization = `Bearer ${init.link.token}`;
  const res = await fetch(`/api/shares${path}`, { ...init, headers });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError((body.error as string) ?? `Hata ${res.status}`, res.status, body);
  return body as T;
}

/** What goes to the server: content always; notes/chat/transcript/run only if the owner allows it. */
export function payloadOf(p: Presentation, includeReport: boolean): Presentation {
  if (includeReport) return p;
  return { ...p, notes: [], chat: [], transcript: [], run: { steps: [], breaks: [], reactions: {}, audiencePeak: 0, suggestedWords: [], bingoCount: 0, autoMarked: 0 }, reflection: '' };
}

export const getMeta = (id: string, link?: CloudLink) => api<ShareMeta>(`/${id}/meta`, { link });
export const requestAccess = (id: string, password?: string) => api<{ token: string; role: LinkRole }>(`/${id}/access`, { method: 'POST', body: JSON.stringify({ password }) });
export { ApiError };
export const fetchShare = (id: string, link: Pick<CloudLink, 'ownerKey' | 'token'>) =>
  api<{ presentation: Presentation; version: number; role: 'owner' | LinkRole; settings?: { visibility: Visibility; linkRole: LinkRole; hasPassword: boolean; invites?: Invite[] } }>(`/${id}`, { link });
export const listPublic = () => api<{ items: { id: string; title: string; presenter: string; stepCount: number; updatedAt: number; linkRole: LinkRole }[] }>('/public');

/** Create a share for the open presentation (caller becomes owner). */
export async function shareCurrent(settings: ShareSettings, includeReport: boolean): Promise<CloudLink & { notified?: number; mailReady?: boolean }> {
  const p = useApp.getState().pres;
  const r = await api<{ id: string; ownerKey: string; version: number; visibility: Visibility; linkRole: LinkRole; notified?: number; mailReady?: boolean }>('', {
    method: 'POST',
    body: JSON.stringify({ presentation: payloadOf(p, includeReport), settings }),
  });
  const link: CloudLink = { shareId: r.id, role: 'owner', ownerKey: r.ownerKey, version: r.version, visibility: r.visibility, linkRole: r.linkRole, includeReport };
  setCloud(p.id, link);
  // what we just uploaded is the synced baseline (otherwise the next remote update looks like a conflict)
  lastSynced = useApp.getState().pres === p ? p : lastSynced;
  lastUploaded.set(r.id, JSON.stringify(payloadOf(p, includeReport)));
  watchCurrent();
  useCloud.setState({ status: 'saved', savedAt: Date.now(), message: null });
  if (useApp.getState().pres !== p) scheduleSave();
  return { ...link, notified: r.notified, mailReady: r.mailReady };
}

export async function updateSettings(presId: string, settings: Partial<ShareSettings>, includeReport?: boolean): Promise<CloudLink & { notified?: number; mailReady?: boolean }> {
  const link = cloudOf(presId);
  if (!link || link.role !== 'owner') throw new Error('Yalnızca sahip değiştirebilir');
  const r = await api<{ visibility: Visibility; linkRole: LinkRole; notified?: number; mailReady?: boolean }>(`/${link.shareId}/settings`, { method: 'PATCH', link, body: JSON.stringify(settings) });
  const next: CloudLink = { ...link, visibility: r.visibility, linkRole: r.linkRole, includeReport: includeReport ?? link.includeReport };
  setCloud(presId, next);
  if (includeReport !== undefined && includeReport !== link.includeReport) scheduleSave(true);
  return { ...next, notified: r.notified, mailReady: r.mailReady };
}

/** Owner deletes the server copy; the local presentation stays (private). */
export async function unshare(presId: string): Promise<void> {
  const link = cloudOf(presId);
  if (!link) return;
  if (link.role === 'owner') await api(`/${link.shareId}`, { method: 'DELETE', link }).catch((e) => {
    if (!(e instanceof ApiError && e.status === 404)) throw e;
  });
  getSocket().emit('share:unwatch', { id: link.shareId });
  setCloud(presId, undefined);
  useCloud.setState({ status: 'local', message: null });
}

/** Claim ownership on another device with "shareId:ownerKey". */
export async function importWithOwnerKey(backup: string): Promise<string> {
  // accept "id:key" and also a pasted URL like https://…/?s=id:key
  const raw = backup.trim().replace(/^.*[?&]s=/, '');
  const cut = raw.indexOf(':');
  const shareId = cut > 0 ? raw.slice(0, cut) : '';
  const ownerKey = cut > 0 ? raw.slice(cut + 1) : '';
  if (!shareId || !ownerKey) throw new Error('Biçim: paylaşımKimliği:sahipAnahtarı');
  const r = await fetchShare(shareId, { ownerKey });
  if (r.role !== 'owner') throw new Error('Anahtar geçersiz');
  const p = normalizePresentation(r.presentation);
  const existing = entryByShare(shareId);
  if (existing) return existing.id;
  await addPresentation(p, { shareId, role: 'owner', ownerKey, version: r.version, visibility: r.settings!.visibility, linkRole: r.settings!.linkRole, includeReport: false });
  return p.id;
}

/** Visitor with an editor link: keep a local working copy bound to the share. */
export async function importAsEditor(shareId: string, token: string): Promise<string> {
  const r = await fetchShare(shareId, { token });
  const meta = await getMeta(shareId, { token } as CloudLink);
  const p = normalizePresentation(r.presentation);
  await addPresentation(p, { shareId, role: 'editor', token, version: r.version, visibility: meta.visibility, linkRole: meta.linkRole, includeReport: true });
  return p.id;
}

/* ---------------- sync engine ---------------- */
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let lastSynced: Presentation | null = null;
let applyingRemote = false;
let watching: string | null = null;
const lastUploaded = new Map<string, string>();

export const isDirty = () => useApp.getState().pres !== lastSynced;

function scheduleSave(immediate = false) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void pushNow(false), immediate ? 0 : 1500);
}

export async function pushNow(force: boolean): Promise<void> {
  const pres = useApp.getState().pres;
  const link = cloudOf(pres.id);
  if (!link) return;
  const json = JSON.stringify(payloadOf(pres, link.role === 'owner' ? link.includeReport : true));
  // nothing that is shared changed (e.g. only private chat/notes) → skip the upload
  if (!force && json === lastUploaded.get(link.shareId)) {
    lastSynced = pres;
    useCloud.setState({ status: 'saved', message: null });
    return;
  }
  useCloud.setState({ status: 'saving', message: null });
  try {
    const r = await api<{ version: number }>(`/${link.shareId}`, {
      method: 'PUT',
      link,
      body: `{"presentation":${json},"baseVersion":${link.version},"force":${force}}`,
    });
    lastUploaded.set(link.shareId, json);
    setCloud(pres.id, { ...link, version: r.version });
    lastSynced = pres;
    useCloud.setState({ status: 'saved', savedAt: Date.now(), message: null });
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) useCloud.setState({ status: 'conflict', message: 'Sunum başka biri tarafından güncellendi.' });
    else if (e instanceof ApiError && e.status === 404) useCloud.setState({ status: 'deleted', message: 'Paylaşım sahibi tarafından kaldırıldı.' });
    else if (e instanceof ApiError && e.status === 403) useCloud.setState({ status: 'readonly', message: 'Düzenleme iznin kaldırıldı ya da bağlantı ayarları değişti.' });
    else useCloud.setState({ status: 'error', message: e instanceof Error ? e.message : 'Kaydedilemedi' });
  }
}

/** Replace local content with the server version (owner keeps local report data unless it is uploaded). */
export async function pullNow(): Promise<void> {
  const cur = useApp.getState().pres;
  const link = cloudOf(cur.id);
  if (!link) return;
  try {
    const r = await fetchShare(link.shareId, link);
    const remote = normalizePresentation(r.presentation);
    const keepReport = link.role === 'owner' && !link.includeReport;
    const merged: Presentation = keepReport
      ? { ...remote, id: cur.id, notes: cur.notes, chat: cur.chat, transcript: cur.transcript, run: cur.run, reflection: cur.reflection }
      : { ...remote, id: cur.id };
    applyingRemote = true;
    useApp.setState({ pres: merged });
    applyingRemote = false;
    lastSynced = merged;
    setCloud(cur.id, { ...link, version: r.version });
    useCloud.setState({ status: 'saved', savedAt: Date.now(), message: null });
  } catch (e) {
    useCloud.setState({ status: 'error', message: e instanceof Error ? e.message : 'Yüklenemedi' });
  }
}

function watchCurrent() {
  const pres = useApp.getState().pres;
  const link = cloudOf(pres.id);
  const s = getSocket();
  if (watching && watching !== link?.shareId) s.emit('share:unwatch', { id: watching });
  watching = link?.shareId ?? null;
  if (link) s.emit('share:watch', { id: link.shareId, ownerKey: link.ownerKey, token: link.token });
}

let wired = false;
/** Call once after hydrate. */
export function initCloudSync(): void {
  if (wired) return;
  wired = true;
  const s = getSocket();
  s.on('connect', watchCurrent);
  s.on('share:updated', (e: { id: string; version: number }) => {
    const pres = useApp.getState().pres;
    const link = cloudOf(pres.id);
    if (!link || link.shareId !== e.id || e.version <= link.version) return; // our own echo
    if (isDirty()) useCloud.setState({ status: 'conflict', message: 'Bu sırada başka biri de değişiklik yaptı.' });
    else void pullNow();
  });
  s.on('share:deleted', (e: { id: string }) => {
    const link = cloudOf(useApp.getState().pres.id);
    if (link?.shareId === e.id && link.role === 'editor') useCloud.setState({ status: 'deleted', message: 'Paylaşım sahibi tarafından kaldırıldı.' });
  });

  // presenter position → people watching the shared link can follow it
  let liveSig = '';
  let liveTimer: ReturnType<typeof setTimeout> | undefined;
  useApp.subscribe((st) => {
    const link = cloudOf(st.pres.id);
    if (!link || link.visibility === 'private') return;
    const { live } = st;
    const phase = live.intro ? 'intro' : live.outro ? 'outro' : live.phase === 'step' || live.phase === 'break' ? live.phase : 'done';
    const v = st.pres.steps[live.stepIndex]?.view ?? { zoom: 1, ox: 0, oy: 0 };
    const sig = `${link.shareId}|${phase}|${live.stepIndex}|${v.zoom}|${v.ox}|${v.oy}`;
    if (sig === liveSig || (phase === 'done' && liveSig.includes('|done|'))) return;
    liveSig = sig;
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => {
      getSocket().emit('share:live', { id: link.shareId, ownerKey: link.ownerKey, token: link.ownerKey ? undefined : link.token, phase, stepIndex: live.stepIndex, zoom: v.zoom, ox: v.ox, oy: v.oy });
    }, 150);
  });

  let lastPresId = useApp.getState().pres.id;
  lastSynced = useApp.getState().pres;
  const refreshStatus = () => {
    const link = cloudOf(useApp.getState().pres.id);
    useCloud.setState({ status: link ? 'saved' : 'local', message: null });
  };
  refreshStatus();
  watchCurrent();
  useApp.subscribe((st) => {
    if (st.pres.id !== lastPresId) {
      // switched presentation
      lastPresId = st.pres.id;
      lastSynced = st.pres;
      refreshStatus();
      watchCurrent();
      return;
    }
    if (applyingRemote || st.pres === lastSynced) return;
    const link = cloudOf(st.pres.id);
    if (!link) return;
    const cs = useCloud.getState().status;
    if (cs === 'conflict' || cs === 'deleted' || cs === 'readonly') return; // wait for the user's decision
    scheduleSave();
  });
}
