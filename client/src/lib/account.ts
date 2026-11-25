// client/src/lib/account.ts — signed-in account + "Sunumlarım" sync across devices
// Local-first: everything keeps working offline / signed out. When signed in, linked presentations are
// pushed (debounced, optimistic concurrency) and pulled when another device changes them. Nothing is ever
// silently overwritten: on a conflict the local version is kept as a separate "çakışan kopya".
import { create } from 'zustand';
import type { Presentation } from '../types';
import { useApp } from '../store';
import { getSocket } from './socket';
import { authMe, logout as apiLogout } from './auth';
import { normalizePresentation, uid } from './factory';
import { addPresentation, hasLocalContent, libraryHooks, loadPresentation, removePresentation, setAccount, upsertRemoteEntries, useLibrary } from './library';

export type SyncState = 'off' | 'idle' | 'syncing' | 'error';

interface AccountState {
  email: string | null;
  ready: boolean;
  mailReady: boolean;
  sync: SyncState;
  message: string | null;
  lastSync: number | null;
  /** quota info from the server */
  used: number;
  quota: number;
}

export const useAccount = create<AccountState>(() => ({ email: null, ready: false, mailReady: false, sync: 'off', message: null, lastSync: null, used: 0, quota: 0 }));

const DEVICE = uid();
const LOGIN_AT_KEY = 'teknodoz-sunum:account-login-at';

class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(message);
  }
}
async function me<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/me${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'x-device': DEVICE, ...(init.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new HttpError((body.error as string) ?? `Hata ${res.status}`, res.status, body);
  return body as T;
}

type RemoteItem = { id: string; title: string; presenter: string; stepCount: number; updatedAt: number; version: number; deleted?: boolean };

/* ---------------- push ---------------- */
const lastPushed = new Map<string, string>();
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** what gets synced: the whole presentation (it's the user's own private copy) */
const bodyOf = (p: Presentation) => JSON.stringify(p);

async function push(p: Presentation, force = false): Promise<void> {
  const entry = useLibrary.getState().entries.find((e) => e.id === p.id);
  if (!useAccount.getState().email || !entry) return;
  const json = bodyOf(p);
  if (!force && lastPushed.get(p.id) === json) return;
  useAccount.setState({ sync: 'syncing', message: null });
  try {
    const r = await me<{ version: number }>(`/presentations/${encodeURIComponent(p.id)}`, {
      method: 'PUT',
      body: `{"presentation":${json},"baseVersion":${entry.account?.version ?? 0},"force":${force}}`,
    });
    lastPushed.set(p.id, json);
    setAccount(p.id, { version: r.version });
    useAccount.setState({ sync: 'idle', lastSync: Date.now() });
  } catch (e) {
    if (e instanceof HttpError && e.status === 409) return resolveConflict(p);
    if (e instanceof HttpError && e.status === 401) return signedOut();
    useAccount.setState({ sync: 'error', message: e instanceof Error ? e.message : 'Senkron hatası' });
  }
}

/** keep my version as a copy, take the server's version under the original id */
async function resolveConflict(mine: Presentation): Promise<void> {
  try {
    const remote = await me<{ presentation: Presentation; version: number }>(`/presentations/${encodeURIComponent(mine.id)}`);
    const copy: Presentation = { ...mine, id: uid(), title: `${mine.title} (çakışan kopya)`, updatedAt: Date.now() };
    await addPresentation(copy);
    setAccount(copy.id, { version: 0 });
    void push(copy);
    const theirs = normalizePresentation({ ...remote.presentation, id: mine.id });
    lastPushed.set(mine.id, bodyOf(theirs));
    setAccount(mine.id, { version: remote.version });
    if (useApp.getState().pres.id === mine.id) applying(() => useApp.setState({ pres: theirs }));
    else await addPresentation(theirs, useLibrary.getState().entries.find((e) => e.id === mine.id)?.cloud);
    useAccount.setState({ sync: 'idle', message: `“${mine.title}” başka bir cihazda da değişmişti. Diğer cihazın sürümü açıldı; seninki “çakışan kopya” olarak saklandı.` });
  } catch (e) {
    useAccount.setState({ sync: 'error', message: e instanceof Error ? e.message : 'Çakışma çözülemedi' });
  }
}

let applyingRemote = false;
const applying = (fn: () => void) => {
  applyingRemote = true;
  fn();
  applyingRemote = false;
};

/** schedule a push for a linked (or newly created while signed in) presentation */
function schedulePush(p: Presentation) {
  clearTimeout(pushTimers.get(p.id));
  pushTimers.set(
    p.id,
    setTimeout(() => {
      pushTimers.delete(p.id);
      void push(useApp.getState().pres.id === p.id ? useApp.getState().pres : p);
    }, 1500),
  );
}

/* ---------------- pull ---------------- */
async function fetchRemote(id: string) {
  return me<{ presentation: Presentation; version: number }>(`/presentations/${encodeURIComponent(id)}`).then((r) => {
    lastPushed.set(id, bodyOf(normalizePresentation({ ...r.presentation, id })));
    return r;
  });
}

/** list from the server → add new entries, mark stale ones, drop ones deleted elsewhere */
export async function syncDown(): Promise<void> {
  if (!useAccount.getState().email) return;
  useAccount.setState({ sync: 'syncing' });
  try {
    const r = await me<{ items: RemoteItem[]; used: number; quota: number }>('/presentations');
    const live = r.items.filter((i) => !i.deleted);
    upsertRemoteEntries(live);
    for (const del of r.items.filter((i) => i.deleted)) {
      const e = useLibrary.getState().entries.find((x) => x.id === del.id);
      if (e?.account && useApp.getState().pres.id !== del.id) await removePresentation(del.id, { keepRemote: true });
      else if (e?.account) setAccount(del.id, undefined); // open here: keep it, just unlink
    }
    // the open presentation changed elsewhere and has no local edits → take it
    const cur = useApp.getState().pres;
    const ce = useLibrary.getState().entries.find((e) => e.id === cur.id);
    if (ce?.account?.stale && lastPushed.get(cur.id) === bodyOf(cur)) await pullOpen(cur.id);
    useAccount.setState({ sync: 'idle', lastSync: Date.now(), used: r.used, quota: r.quota });
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) return signedOut();
    useAccount.setState({ sync: 'error', message: e instanceof Error ? e.message : 'Liste alınamadı' });
  }
}

async function pullOpen(id: string) {
  const r = await fetchRemote(id);
  const fresh = normalizePresentation({ ...r.presentation, id });
  setAccount(id, { version: r.version });
  if (useApp.getState().pres.id === id) applying(() => useApp.setState({ pres: fresh }));
}

/* ---------------- account lifecycle ---------------- */
async function joinRoom() {
  try {
    const { token } = await me<{ token: string }>('/socket-token');
    getSocket().emit('user:join', { token });
  } catch {
    /* live updates are a bonus */
  }
}

function signedOut() {
  useAccount.setState({ email: null, sync: 'off', message: 'Oturum sona erdi — senkron için yeniden giriş yap.' });
}

/** called after a successful code login */
export async function onLogin(email: string): Promise<void> {
  try {
    localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
  } catch {
    /* private mode */
  }
  useAccount.setState({ email, sync: 'idle', message: null });
  await joinRoom();
  await syncDown();
}

export async function logout(): Promise<void> {
  await apiLogout().catch(() => undefined);
  getSocket().emit('user:leave');
  useAccount.setState({ email: null, sync: 'off', message: null });
}

/** presentations on this device that are not in the account yet */
export const unlinkedCount = () => useLibrary.getState().entries.filter((e) => !e.account).length;

/** move (upload) every local presentation into the account */
export async function migrateLocal(onProgress?: (done: number, total: number) => void): Promise<number> {
  const todo = useLibrary.getState().entries.filter((e) => !e.account);
  let done = 0;
  for (const e of todo) {
    const p = useApp.getState().pres.id === e.id ? useApp.getState().pres : await loadPresentation(e.id);
    if (p) await push(p, false);
    onProgress?.(++done, todo.length);
  }
  return done;
}

/* ---------------- wiring ---------------- */
let wired = false;
export async function initAccount(): Promise<void> {
  if (wired) return;
  wired = true;
  libraryHooks.fetchRemote = (id) => (useAccount.getState().email ? fetchRemote(id) : Promise.resolve(null));
  libraryHooks.deleteRemote = async (id) => {
    if (useAccount.getState().email) await me(`/presentations/${encodeURIComponent(id)}`, { method: 'DELETE' });
  };

  const s = getSocket();
  s.on('connect', () => useAccount.getState().email && void joinRoom().then(syncDown));
  s.on('lib:changed', (e: { id: string; version: number; deleted?: boolean; by?: string }) => {
    if (e.by === DEVICE) return;
    const entry = useLibrary.getState().entries.find((x) => x.id === e.id);
    if (entry?.account && e.version <= entry.account.version) return;
    void syncDown();
  });

  // push linked presentations (and ones created after signing in) when they change
  let lastPres = useApp.getState().pres;
  useApp.subscribe((st) => {
    if (st.pres === lastPres) return;
    lastPres = st.pres;
    if (applyingRemote || !useAccount.getState().email) return;
    const entry = useLibrary.getState().entries.find((e) => e.id === st.pres.id);
    let loginAt = 0;
    try {
      loginAt = Number(localStorage.getItem(LOGIN_AT_KEY) ?? 0);
    } catch {
      /* ignore */
    }
    const linked = !!entry?.account || st.pres.createdAt >= loginAt;
    if (linked) schedulePush(st.pres);
  });

  try {
    const r = await authMe();
    useAccount.setState({ email: r.email, mailReady: r.mailReady, ready: true, sync: r.email ? 'idle' : 'off' });
    if (r.email) {
      await joinRoom();
      await syncDown();
      // a presentation opened from the list may only exist remotely
      const cur = useApp.getState().pres;
      if (!(await hasLocalContent(cur.id))) await pullOpen(cur.id).catch(() => undefined);
    }
  } catch {
    useAccount.setState({ ready: true });
  }
}
