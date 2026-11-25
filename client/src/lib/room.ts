// client/src/lib/room.ts
import { create } from 'zustand';
import { emitAck, getSocket } from './socket';
import { useApp } from '../store';
import type { ChatMessage } from '../types';
import { roleplaySentence } from './catalog';
import { visibleElements } from './canvasGroups';

interface Suggestion {
  id: string;
  word: string;
  name: string;
  at: number;
}

interface FloatingReaction {
  id: number;
  emoji: string;
  x: number;
}

interface RoomState {
  code: string | null;
  connected: boolean;
  count: number;
  /** anonymous names of connected audience members */
  people: string[];
  chatLocked: boolean;
  error: string | null;
  suggestions: Suggestion[];
  floating: FloatingReaction[];
  open: () => Promise<void>;
  close: () => void;
  sendChat: (text: string) => void;
  setChatLocked: (v: boolean) => void;
  dismissSuggestion: (id: string) => void;
}

const SESSION_KEY = 'teknodoz-sunum:room';
let wired = false;
let reactionSeq = 0;

export const useRoom = create<RoomState>((set, get) => ({
  code: null,
  connected: false,
  count: 0,
  people: [],
  chatLocked: false,
  error: null,
  suggestions: [],
  floating: [],

  open: async () => {
    const s = getSocket();
    wire();
    if (!s.connected) s.connect();
    try {
      const saved = safeSession();
      if (saved) {
        const r = await emitAck<{ ok: boolean; code?: string }>('presenter:resume', saved);
        if (r.ok && r.code) {
          set({ code: r.code, connected: true, error: null });
          sentAssets.clear();
          pushState();
          pushCanvas(true);
          pushView();
          return;
        }
      }
      const r = await emitAck<{ ok: boolean; code?: string; token?: string; error?: string }>('presenter:create', {
        title: useApp.getState().pres.title,
      });
      if (!r.ok || !r.code || !r.token) throw new Error(r.error ?? 'Oda açılamadı');
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code: r.code, token: r.token }));
      } catch {
        /* private mode */
      }
      set({ code: r.code, connected: true, error: null });
      sentAssets.clear();
      pushState();
      pushCanvas(true);
      pushView();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Sunucuya bağlanılamadı', connected: false });
    }
  },

  close: () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    getSocket().disconnect();
    set({ code: null, connected: false, count: 0 });
  },

  sendChat: (text) => {
    if (!get().code) {
      // offline fallback: keep presenter messages locally
      const st = useApp.getState();
      st.addChat({ id: crypto.randomUUID(), name: 'Sunucu', text, at: Date.now(), stepIndex: st.live.stepIndex, fromPresenter: true });
      return;
    }
    getSocket().emit('chat:send', { text });
  },

  setChatLocked: (v) => {
    set({ chatLocked: v });
    getSocket().emit('state:update', { chatLocked: v });
  },

  dismissSuggestion: (id) => set((s) => ({ suggestions: s.suggestions.filter((x) => x.id !== id) })),
}));

function safeSession(): { code: string; token: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function pushState(): void {
  const { code } = useRoom.getState();
  if (!code) return;
  const { pres, live } = useApp.getState();
  getSocket().emit('state:update', {
    title: pres.title,
    stepIndex: live.stepIndex,
    stepCount: pres.steps.length,
    stepTitle: pres.steps[live.stepIndex]?.title ?? '',
    phase: live.phase,
    roleplay: live.currentRoleplay ? roleplaySentence(live.currentRoleplay) : '',
    chatLocked: useRoom.getState().chatLocked,
  });
}

function wire(): void {
  if (wired) return;
  wired = true;
  const s = getSocket();
  s.on('connect', () => {
    if (useRoom.getState().code) useRoom.getState().open();
  });
  s.on('disconnect', () => useRoom.setState({ connected: false }));
  s.on('chat:message', (m: ChatMessage) => useApp.getState().addChat(m));
  s.on('room:count', (n: number) => {
    useRoom.setState({ count: n });
    useApp.getState().setAudiencePeak(Math.max(0, n - 1));
  });
  s.on('reaction', (r: { emoji: string }) => {
    useApp.getState().addReaction(r.emoji);
    const id = ++reactionSeq;
    useRoom.setState((st) => ({ floating: [...st.floating.slice(-20), { id, emoji: r.emoji, x: 10 + Math.random() * 80 }] }));
    setTimeout(() => useRoom.setState((st) => ({ floating: st.floating.filter((f) => f.id !== id) })), 2600);
  });
  s.on('room:people', (p: { count: number; names: string[] }) => useRoom.setState({ people: p.names }));
  s.on('word:suggested', (w: Suggestion) => {
    useApp.getState().addSuggestedWord(w.word);
    useRoom.setState((st) => ({ suggestions: [...st.suggestions, w].slice(-30) }));
  });

  // mirror presenter state to audience whenever step/phase changes
  let lastSig = '';
  useApp.subscribe((st) => {
    const sig = `${st.live.phase}|${st.live.stepIndex}|${st.live.flipKey}|${st.pres.title}|${st.pres.steps.length}|${st.live.currentRoleplay?.emotion ?? ''}`;
    if (sig !== lastSig) {
      lastSig = sig;
      pushState();
    }
    // live canvas mirror (throttled)
    const step = st.pres.steps[st.live.stepIndex];
    if (step && (step.view !== lastView || st.live.stepIndex !== lastViewStep)) {
      lastView = step.view;
      lastViewStep = st.live.stepIndex;
      pushView();
    }
    if (step && (step.canvas !== lastCanvas || step.groups !== lastGroups || st.live.stepIndex !== lastCanvasStep)) {
      lastCanvas = step.canvas;
      lastGroups = step.groups;
      lastCanvasStep = st.live.stepIndex;
      pushCanvas();
    }
  });
}

/* ---------------- live canvas mirror for the audience ---------------- */
let lastCanvas: unknown = null;
let lastGroups: unknown = null;
let lastCanvasStep = -1;
let canvasTimer: ReturnType<typeof setTimeout> | undefined;
const sentAssets = new Set<string>();

/** Downscale an image data URL so it fits the socket budget (≤ 1280 px, JPEG). */
function downscale(src: string, max = 1280): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      try {
        let out = c.toDataURL('image/jpeg', 0.82);
        if (out.length > 1_500_000) out = c.toDataURL('image/jpeg', 0.6);
        resolve(out.length <= 1_550_000 ? out : null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

let lastView: unknown;
let lastViewStep = -1;
let viewTimer: ReturnType<typeof setTimeout> | undefined;
/** presenter zoom / pan → watch-only viewers follow it */
export function pushView(): void {
  clearTimeout(viewTimer);
  viewTimer = setTimeout(() => {
    if (!useRoom.getState().code) return;
    const { pres, live } = useApp.getState();
    const v = pres.steps[live.stepIndex]?.view ?? { zoom: 1, ox: 0, oy: 0 };
    getSocket().emit('canvas:view', { stepIndex: live.stepIndex, zoom: v.zoom, ox: v.ox, oy: v.oy });
  }, 120);
}

export function pushCanvas(immediate = false): void {
  clearTimeout(canvasTimer);
  canvasTimer = setTimeout(
    async () => {
      if (!useRoom.getState().code) return;
      const { pres, live } = useApp.getState();
      const step = pres.steps[live.stepIndex];
      if (!step) return;
      const elements = visibleElements(step.canvas, step.groups).map(({ groupId: _g, frameworkId: _f, locked: _l, ...rest }) => rest);
      const used = new Set(elements.map((e) => e.attachmentId).filter(Boolean));
      const atts = step.attachments.filter((a) => used.has(a.id)).map((a) => ({ id: a.id, kind: a.kind, name: a.name, url: a.dataUrl ? undefined : a.url }));
      const sock = getSocket();
      sock.emit('canvas:update', { stepIndex: live.stepIndex, elements, atts });
      for (const a of step.attachments) {
        if (!used.has(a.id) || a.kind !== 'image' || !a.dataUrl || sentAssets.has(a.id)) continue;
        sentAssets.add(a.id);
        const small = await downscale(a.dataUrl);
        if (small) sock.emit('canvas:asset', { id: a.id, dataUrl: small });
      }
    },
    immediate ? 0 : 350,
  );
}
