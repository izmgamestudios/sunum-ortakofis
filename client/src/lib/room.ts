// client/src/lib/room.ts
import { create } from 'zustand';
import { emitAck, getSocket } from './socket';
import { useApp } from '../store';
import type { ChatMessage } from '../types';
import { roleplaySentence } from './catalog';

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
          pushState();
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
      pushState();
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
  });
}
