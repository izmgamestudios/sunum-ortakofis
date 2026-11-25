// client/src/lib/interact.ts — presenter side of live polls, quiz leaderboard and pitch-day jury
import { create } from 'zustand';
import type { JuryConfig, JuryCriterion, PollResult, Question } from '../types';
import { useApp } from '../store';
import { emitAck, getSocket } from './socket';
import { useRoom } from './room';
import { uid } from './factory';

export const DEFAULT_CRITERIA: JuryCriterion[] = [
  { id: 'problem', label: 'Problem', weight: 1 },
  { id: 'cozum', label: 'Çözüm', weight: 1 },
  { id: 'pazar', label: 'Pazar', weight: 1 },
  { id: 'ekip', label: 'Ekip', weight: 1 },
  { id: 'sunum', label: 'Sunum', weight: 1 },
];

export const newPin = () => String(Math.floor(100000 + Math.random() * 900000));

export const defaultJury = (): JuryConfig => ({ enabled: true, criteria: DEFAULT_CRITERIA.map((c) => ({ ...c })), pin: newPin(), emails: [] });

export const QUESTION_KINDS: Record<Question['kind'], { icon: string; label: string; hint: string }> = {
  choice: { icon: '📊', label: 'Çoktan seçmeli anket', hint: '2–8 seçenek' },
  yesno: { icon: '👍', label: 'Evet / Hayır', hint: 'hızlı nabız' },
  scale: { icon: '⭐', label: '1–5 puan', hint: 'ortalama gösterilir' },
  cloud: { icon: '☁️', label: 'Kelime bulutu', hint: 'tek kelime' },
  open: { icon: '💬', label: 'Açık uçlu', hint: 'kısa yanıt' },
  quiz: { icon: '🏆', label: 'Quiz (puanlı)', hint: 'doğru + hız = puan' },
};

export const newQuestion = (kind: Question['kind'] = 'choice'): Question => ({
  id: uid().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24),
  kind,
  text: '',
  options: kind === 'choice' || kind === 'quiz' ? ['', ''] : [],
  correct: kind === 'quiz' ? 0 : undefined,
  timeLimit: kind === 'quiz' ? 20 : undefined,
});

export interface Tally {
  qid: string;
  total: number;
  counts: number[];
  average: number | null;
  words: [string, number][];
  texts: string[];
}
export interface ActivePoll {
  id: string;
  kind: Question['kind'];
  text: string;
  options: string[];
  stepIndex: number;
  endsAt: number | null;
}
export interface BoardRow {
  rank: number;
  name: string;
  points: number;
  correct: number;
}
export interface JuryOverview {
  criteria: JuryCriterion[];
  byStep: { stepIndex: number; avg: Record<string, number>; total: number; jurors: number; comments: { name: string; text: string }[] }[];
  jurors: string[];
}

interface InteractState {
  active: ActivePoll | null;
  tally: Tally | null;
  last: (PollResult & { board: BoardRow[] | null }) | null;
  board: BoardRow[];
  jury: JuryOverview | null;
  error: string | null;
}
export const useInteract = create<InteractState>(() => ({ active: null, tally: null, last: null, board: [], jury: null, error: null }));

async function ensureRoom(): Promise<boolean> {
  if (!useRoom.getState().code) await useRoom.getState().open();
  if (!useRoom.getState().code) {
    useInteract.setState({ error: useRoom.getState().error ?? 'Canlı oda açılamadı.' });
    return false;
  }
  hello();
  return true;
}

function hello() {
  getSocket().emit('interact:hello', {});
}

export async function openPoll(q: Question): Promise<void> {
  if (!(await ensureRoom())) return;
  const r = await emitAck<{ ok: boolean; error?: string }>('poll:open', { stepIndex: useApp.getState().live.stepIndex, question: q });
  useInteract.setState({ error: r.ok ? null : r.error ?? 'Soru başlatılamadı', last: null });
}
export const closePoll = () => getSocket().emit('poll:close');
export const resetBoard = () => {
  getSocket().emit('poll:reset-board');
  useInteract.setState({ board: [] });
};

/** send the jury setup to the live room (opens jury scoring for the audience page) */
export async function syncJury(): Promise<void> {
  const j = useApp.getState().pres.jury;
  if (!j?.enabled) {
    if (useRoom.getState().code) getSocket().emit('jury:config', { enabled: false });
    return;
  }
  if (!(await ensureRoom())) return;
  const r = await emitAck<{ ok: boolean; error?: string }>('jury:config', { criteria: j.criteria, pin: j.pin || null, emails: j.emails });
  if (!r.ok) useInteract.setState({ error: r.error ?? 'Jüri ayarı gönderilemedi' });
}

let wired = false;
export function initInteract(): void {
  if (wired) return;
  wired = true;
  const s = getSocket();
  s.on('connect', () => useRoom.getState().code && hello());
  s.on('poll:state', (a: ActivePoll) => useInteract.setState({ active: a, tally: null }));
  s.on('poll:tally', (t: Tally) => useInteract.setState({ tally: t }));
  s.on('poll:results', (r: Tally & { question: { id: string; kind: Question['kind']; text: string; options: string[]; stepIndex: number }; correct: number | null; board: BoardRow[] | null }) => {
    const result: PollResult = {
      qid: r.question.id,
      stepIndex: r.question.stepIndex,
      kind: r.question.kind,
      text: r.question.text,
      options: r.question.options,
      total: r.total,
      counts: r.counts,
      average: r.average,
      words: r.words,
      texts: r.texts,
      correct: r.correct,
      at: Date.now(),
    };
    useInteract.setState((st) => ({ active: null, tally: null, last: { ...result, board: r.board }, board: r.board ?? st.board }));
    // keep results in the presentation (report)
    const app = useApp.getState();
    const run = app.pres.run;
    app.updatePres({ run: { ...run, polls: [...(run.polls ?? []).filter((p) => p.qid !== result.qid), result], board: r.board ?? run.board } });
  });
  s.on('jury:update', (o: JuryOverview | null) => {
    useInteract.setState({ jury: o });
    if (!o) return;
    const app = useApp.getState();
    app.updatePres({ run: { ...app.pres.run, jury: o.byStep } });
  });
  // re-announce the jury when the room (re)opens
  let lastCode: string | null = null;
  useRoom.subscribe((st) => {
    if (st.code && st.code !== lastCode) {
      lastCode = st.code;
      hello();
      if (useApp.getState().pres.jury?.enabled) void syncJury();
    }
  });
}
