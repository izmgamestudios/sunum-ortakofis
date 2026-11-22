// client/src/store.ts
import { create } from 'zustand';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import type { BreakActivity, ChatMessage, LiveState, Note, Presentation, Step, TopicNode, TranscriptSegment, View } from './types';
import { createPresentation, createStep, defaultDurationSec, MAX_STEPS, normalizePresentation, uid } from './lib/factory';
import { BREAK_ACTIVITIES, randomRoleplay, roleplaySentence } from './lib/catalog';
import { findMentions } from './lib/speechMatch';
import { elementsForAttachments } from './lib/canvasDraw';

const STORAGE_KEY = 'teknodoz-sunum:v1';

export type HelpTab = 'guide' | 'faq' | 'shortcuts' | 'troubleshoot' | 'support';

const idleLive = (): LiveState => ({
  phase: 'idle',
  stepIndex: 0,
  phaseStartedAt: 0,
  pausedAt: null,
  pausedTotalMs: 0,
  breakActivity: null,
  breakPlannedSec: null,
  breakExtraSec: 0,
  currentRoleplay: null,
  flipKey: 0,
});

export function phaseElapsedMs(live: LiveState, now = Date.now()): number {
  if (live.phase === 'idle' || live.phase === 'done') return 0;
  const end = live.pausedAt ?? now;
  return Math.max(0, end - live.phaseStartedAt - live.pausedTotalMs);
}

interface AppState {
  hydrated: boolean;
  view: View;
  /** UI-only: selected step in the editor, template filter from mega menu, mobile drawer */
  activeStep: number;
  templateCategory: string;
  templateQuery: string;
  drawerOpen: boolean;
  searchOpen: boolean;
  shortcutsOpen: boolean;
  helpTab: HelpTab;
  helpArticle: string | null;
  setActiveStep: (i: number) => void;
  openTemplates: (category?: string, query?: string) => void;
  setDrawer: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  openHelp: (tab?: HelpTab, article?: string | null) => void;
  pres: Presentation;
  live: LiveState;
  setView: (v: View) => void;
  updatePres: (patch: Partial<Presentation> | ((p: Presentation) => Partial<Presentation>)) => void;
  updateStep: (index: number, patch: Partial<Step> | ((s: Step) => Partial<Step>)) => void;
  setStepCount: (n: number) => void;
  /** replace a step's attachments: new ones are placed on the canvas, removed ones are taken off it */
  setAttachments: (index: number, atts: Step['attachments']) => Promise<void>;
  resetDurations: () => void;
  newPresentation: () => void;
  loadPresentation: (p: Presentation) => void;
  // live control
  start: () => void;
  next: () => void;
  prev: () => void;
  /** jump to any step (used while paused); keeps the paused state */
  goToStep: (index: number) => void;
  togglePause: () => void;
  extendBreak: (sec: number) => void;
  finish: () => void;
  rerollRoleplay: () => void;
  // live content
  addNote: (kind: Note['kind'], text: string) => void;
  removeNote: (id: string) => void;
  addChat: (m: ChatMessage) => void;
  addReaction: (emoji: string) => void;
  setAudiencePeak: (n: number) => void;
  addSuggestedWord: (w: string) => void;
  drawWord: (index: number) => string | null;
  toggleMarkWord: (index: number, word: string) => void;
  bingo: () => void;
  addTranscript: (text: string, source: TranscriptSegment['source']) => string[];
  removeTranscript: (id: string) => void;
}

function pickBreakActivity(p: Presentation, breakNo: number): BreakActivity {
  const acts = p.breakConfig.activities.length ? p.breakConfig.activities : (['silent'] as BreakActivity[]);
  return p.breakConfig.order === 'random' ? acts[Math.floor(Math.random() * acts.length)] : acts[breakNo % acts.length];
}

export const useApp = create<AppState>((set, get) => {
  const touch = (p: Presentation): Presentation => ({ ...p, updatedAt: Date.now() });

  const closeCurrentPhase = (now: number) => {
    const { live, pres } = get();
    const elapsed = Math.round(phaseElapsedMs(live, now) / 1000);
    const run = { ...pres.run, steps: [...pres.run.steps], breaks: [...pres.run.breaks] };
    if (live.phase === 'step') {
      const i = run.steps.findLastIndex((s) => s.stepIndex === live.stepIndex && s.endedAt === undefined);
      if (i >= 0) run.steps[i] = { ...run.steps[i], endedAt: now, actualSec: elapsed, pausedSec: Math.round(live.pausedTotalMs / 1000) };
    } else if (live.phase === 'break') {
      const i = run.breaks.length - 1;
      if (i >= 0 && run.breaks[i].endedAt === undefined) run.breaks[i] = { ...run.breaks[i], endedAt: now, actualSec: elapsed };
    }
    return run;
  };

  const enterStep = (index: number) => {
    const now = Date.now();
    const run = closeCurrentPhase(now);
    const { pres, live } = get();
    const rp = pres.roleplay.enabled ? (pres.roleplay.randomizePerStep ? randomRoleplay(pres.roleplay) : pres.roleplay) : null;
    run.steps.push({
      stepIndex: index,
      startedAt: now,
      plannedSec: pres.steps[index].durationSec,
      pausedSec: 0,
      roleplay: rp ? roleplaySentence(rp) : undefined,
      emotion: rp?.emotion,
    });
    set({
      pres: touch({ ...pres, run }),
      live: {
        ...idleLive(),
        phase: 'step',
        stepIndex: index,
        phaseStartedAt: now,
        // navigating while paused stays paused (elapsed = 0 until resumed)
        pausedAt: live.pausedAt ? now : null,
        currentRoleplay: rp,
        flipKey: live.flipKey + 1,
      },
    });
  };

  const enterBreak = () => {
    const now = Date.now();
    const run = closeCurrentPhase(now);
    const { pres, live } = get();
    const activity = pickBreakActivity(pres, run.breaks.length);
    const planned =
      pres.breakConfig.mode === 'auto' ? Math.max(pres.breakConfig.autoSeconds, BREAK_ACTIVITIES[activity].minSec) : null;
    run.breaks.push({ afterStep: live.stepIndex, activity, plannedSec: planned, startedAt: now });
    set({
      pres: touch({ ...pres, run }),
      live: {
        ...live,
        phase: 'break',
        phaseStartedAt: now,
        pausedAt: null,
        pausedTotalMs: 0,
        breakActivity: activity,
        breakPlannedSec: planned,
        breakExtraSec: 0,
      },
    });
  };

  return {
    hydrated: false,
    view: 'setup',
    activeStep: 0,
    templateCategory: 'all',
    templateQuery: '',
    drawerOpen: false,
    searchOpen: false,
    shortcutsOpen: false,
    helpTab: 'guide',
    helpArticle: null,
    setActiveStep: (activeStep) => set({ activeStep, view: 'setup', drawerOpen: false }),
    openTemplates: (category = 'all', query = '') => set({ view: 'templates', templateCategory: category, templateQuery: query, drawerOpen: false }),
    setDrawer: (drawerOpen) => set({ drawerOpen }),
    setSearchOpen: (searchOpen) => set({ searchOpen }),
    setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
    openHelp: (helpTab = 'guide', helpArticle = null) => {
      set({ view: 'faq', helpTab, helpArticle, drawerOpen: false, searchOpen: false });
      if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
    },
    pres: createPresentation(6),
    live: idleLive(),

    setView: (view) => {
      set({ view, drawerOpen: false });
      if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
    },

    updatePres: (patch) =>
      set((s) => ({ pres: touch({ ...s.pres, ...(typeof patch === 'function' ? patch(s.pres) : patch) }) })),

    updateStep: (index, patch) =>
      set((s) => {
        const steps = s.pres.steps.slice();
        const cur = steps[index];
        if (!cur) return s;
        steps[index] = { ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) };
        return { pres: touch({ ...s.pres, steps }) };
      }),

    setAttachments: async (index, atts) => {
      const step = get().pres.steps[index];
      if (!step) return;
      const added = atts.filter((a) => !step.attachments.some((b) => b.id === a.id));
      const removed = new Set(step.attachments.filter((a) => !atts.some((b) => b.id === a.id)).map((a) => a.id));
      get().updateStep(index, (s) => ({ attachments: atts, canvas: s.canvas.filter((e) => !e.attachmentId || !removed.has(e.attachmentId)) }));
      if (added.length) {
        const els = await elementsForAttachments(added, get().pres.steps[index].canvas.length);
        get().updateStep(index, (s) => ({ canvas: [...s.canvas, ...els] }));
      }
    },

    setStepCount: (n) =>
      set((s) => {
        const count = Math.max(1, Math.min(MAX_STEPS, n));
        const steps = s.pres.steps.slice(0, count);
        while (steps.length < count) steps.push(createStep(steps.length));
        return { pres: touch({ ...s.pres, steps }) };
      }),

    resetDurations: () =>
      set((s) => ({ pres: touch({ ...s.pres, steps: s.pres.steps.map((st, i) => ({ ...st, durationSec: defaultDurationSec(i) })) }) })),

    newPresentation: () => set({ pres: createPresentation(6), live: idleLive(), view: 'setup' }),

    loadPresentation: (p) => set({ pres: p, live: idleLive(), view: p.run.endedAt ? 'report' : 'setup' }),

    start: () => {
      const { pres } = get();
      set({
        pres: touch({
          ...pres,
          notes: [],
          chat: [],
          transcript: [],
          steps: pres.steps.map((s) => ({ ...s, drawnWords: [], markedWords: [], topicTree: clearVisited(s.topicTree) })),
          run: { steps: [], breaks: [], reactions: {}, audiencePeak: 0, suggestedWords: [], bingoCount: 0, autoMarked: 0, startedAt: Date.now() },
        }),
        view: 'live',
      });
      enterStep(0);
    },

    next: () => {
      const { live, pres } = get();
      if (live.phase === 'step') {
        const isLast = live.stepIndex >= pres.steps.length - 1;
        if (isLast) return get().finish();
        // paused → the presenter is browsing: skip the break
        if (pres.breakConfig.mode === 'none' || live.pausedAt) return enterStep(live.stepIndex + 1);
        return enterBreak();
      }
      if (live.phase === 'break') return enterStep(live.stepIndex + 1);
    },

    prev: () => {
      const { live } = get();
      if (live.phase === 'break') return enterStep(live.stepIndex);
      if (live.phase === 'step' && live.stepIndex > 0) enterStep(live.stepIndex - 1);
    },

    goToStep: (index) => {
      const { live, pres } = get();
      if (index < 0 || index >= pres.steps.length) return;
      if (live.phase !== 'step' && live.phase !== 'break') return;
      if (index === live.stepIndex && live.phase === 'step') return;
      enterStep(index);
    },

    togglePause: () =>
      set((s) => {
        const now = Date.now();
        if (s.live.pausedAt) {
          return { live: { ...s.live, pausedTotalMs: s.live.pausedTotalMs + (now - s.live.pausedAt), pausedAt: null } };
        }
        return { live: { ...s.live, pausedAt: now } };
      }),

    extendBreak: (sec) => set((s) => ({ live: { ...s.live, breakExtraSec: s.live.breakExtraSec + sec } })),

    finish: () => {
      const now = Date.now();
      const run = closeCurrentPhase(now);
      const { pres } = get();
      set({ pres: touch({ ...pres, run: { ...run, endedAt: now } }), live: { ...idleLive(), phase: 'done' }, view: 'report' });
    },

    rerollRoleplay: () =>
      set((s) => {
        const rp = randomRoleplay(s.pres.roleplay);
        const run = { ...s.pres.run, steps: s.pres.run.steps.slice() };
        const last = run.steps.length - 1;
        if (last >= 0 && s.live.phase === 'step') run.steps[last] = { ...run.steps[last], roleplay: roleplaySentence(rp), emotion: rp.emotion };
        return { live: { ...s.live, currentRoleplay: rp }, pres: touch({ ...s.pres, run }) };
      }),

    addNote: (kind, text) =>
      set((s) => {
        const startedAt = s.pres.run.startedAt;
        const note: Note = { id: uid(), kind, text, stepIndex: s.live.stepIndex, at: startedAt ? Date.now() - startedAt : 0 };
        return { pres: touch({ ...s.pres, notes: [...s.pres.notes, note] }) };
      }),

    removeNote: (id) => set((s) => ({ pres: touch({ ...s.pres, notes: s.pres.notes.filter((n) => n.id !== id) }) })),

    addChat: (m) =>
      set((s) => (s.pres.chat.some((c) => c.id === m.id) ? s : { pres: { ...s.pres, chat: [...s.pres.chat, m].slice(-2000) } })),

    addReaction: (emoji) =>
      set((s) => ({
        pres: { ...s.pres, run: { ...s.pres.run, reactions: { ...s.pres.run.reactions, [emoji]: (s.pres.run.reactions[emoji] ?? 0) + 1 } } },
      })),

    setAudiencePeak: (n) =>
      set((s) => (n > s.pres.run.audiencePeak ? { pres: { ...s.pres, run: { ...s.pres.run, audiencePeak: n } } } : s)),

    addSuggestedWord: (w) =>
      set((s) => ({ pres: { ...s.pres, run: { ...s.pres.run, suggestedWords: [...s.pres.run.suggestedWords, w].slice(-200) } } })),

    drawWord: (index) => {
      const step = get().pres.steps[index];
      if (!step) return null;
      const pool = step.words.filter((w) => !step.drawnWords.includes(w));
      if (!pool.length) return null;
      const word = pool[Math.floor(Math.random() * pool.length)];
      get().updateStep(index, { drawnWords: [...step.drawnWords, word] });
      return word;
    },

    toggleMarkWord: (index, word) =>
      get().updateStep(index, (s) => ({
        markedWords: s.markedWords.includes(word) ? s.markedWords.filter((w) => w !== word) : [...s.markedWords, word],
      })),

    bingo: () => set((s) => ({ pres: { ...s.pres, run: { ...s.pres.run, bingoCount: s.pres.run.bingoCount + 1 } } })),

    addTranscript: (text, source) => {
      const { pres, live } = get();
      const clean = text.trim();
      if (!clean) return [];
      const index = live.phase === 'step' || live.phase === 'break' ? live.stepIndex : 0;
      const step = pres.steps[index];
      const startedAt = pres.run.startedAt;
      // tombala: any word of the bag spoken → drawn + marked
      const wordHits = findMentions(clean, step.words.filter((w) => !step.markedWords.includes(w)));
      // topic tree: unvisited node labels spoken → visited
      const nodeLabels: string[] = [];
      const walk = (ns: TopicNode[]) => ns.forEach((n) => { if (!n.visited) nodeLabels.push(n.label); walk(n.children); });
      walk(step.topicTree);
      const nodeHits = findMentions(clean, nodeLabels);
      const markTree = (ns: TopicNode[]): TopicNode[] =>
        ns.map((n) => ({ ...n, visited: n.visited || nodeHits.includes(n.label), children: markTree(n.children) }));
      const seg: TranscriptSegment = {
        id: uid(),
        stepIndex: index,
        at: startedAt ? Date.now() - startedAt : 0,
        text: clean,
        source,
        matches: [...wordHits, ...nodeHits],
      };
      const steps = pres.steps.slice();
      steps[index] = {
        ...step,
        drawnWords: [...step.drawnWords, ...wordHits.filter((w) => !step.drawnWords.includes(w))],
        markedWords: [...step.markedWords, ...wordHits],
        topicTree: nodeHits.length ? markTree(step.topicTree) : step.topicTree,
      };
      set({
        pres: touch({
          ...pres,
          steps,
          transcript: [...pres.transcript, seg].slice(-5000),
          run: { ...pres.run, autoMarked: (pres.run.autoMarked ?? 0) + seg.matches.length },
        }),
      });
      return seg.matches;
    },

    removeTranscript: (id) => set((s) => ({ pres: touch({ ...s.pres, transcript: s.pres.transcript.filter((t) => t.id !== id) }) })),
  };
});

function clearVisited(nodes: Step['topicTree']): Step['topicTree'] {
  return nodes.map((n) => ({ ...n, visited: false, children: clearVisited(n.children) }));
}

/* ---------- persistence (IndexedDB, debounced) ---------- */
let hydratePromise: Promise<void> | null = null;
/** Load the last session + library once; later calls return the same promise. */
export function hydrate(): Promise<void> {
  if (!hydratePromise) hydratePromise = doHydrate();
  return hydratePromise;
}

async function doHydrate(): Promise<void> {
  try {
    const saved = await idbGet<{ pres: Presentation; view: View; live: LiveState }>(STORAGE_KEY);
    if (saved?.pres?.steps?.length) {
      const view = saved.view === 'faq' || saved.view === 'credits' ? 'setup' : saved.view;
      useApp.setState({ pres: normalizePresentation(saved.pres), view: view ?? 'setup', live: saved.live ?? idleLive() });
    }
    const { initLibrary } = await import('./lib/library');
    await initLibrary(useApp.getState().pres);
  } catch (e) {
    console.warn('Kayıt okunamadı', e);
  } finally {
    useApp.setState({ hydrated: true });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastPres: Presentation | null = null;
  useApp.subscribe((s) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      idbSet(STORAGE_KEY, { pres: s.pres, view: s.view, live: s.live }).catch((e) => console.warn('Kayıt yazılamadı', e));
      if (s.pres !== lastPres) {
        lastPres = s.pres;
        void import('./lib/library').then((m) => m.savePresentation(s.pres));
      }
    }, 400);
  });
}
