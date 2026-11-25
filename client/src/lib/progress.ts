// client/src/lib/progress.ts — Sprint 4: run history, trends, streaks, levels and career badges.
// Local-first (IndexedDB); when signed in, summaries are merged with the account (append-only, by id).
import { create } from 'zustand';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import type { Presentation } from '../types';
import { useApp } from '../store';
import { buildReport } from './report';
import { loadPresentation, useLibrary } from './library';
import { DEVICE, me, useAccount } from './account';
import { getSocket } from './socket';

export interface RunSummary {
  id: string;
  presId: string;
  title: string;
  endedAt: number;
  plannedSec: number;
  actualSec: number;
  steps: number;
  completion: number;
  timeScore: number;
  engagementScore: number;
  contentScore: number;
  overallScore: number;
  words: number;
  wpm: number | null;
  fillerRate: number | null;
  audiencePeak: number;
  reactions: number;
  polls: number;
  jury: boolean;
  badges: string[];
}

const KEY = 'teknodoz-sunum:history';
const BACKFILL_KEY = 'teknodoz-sunum:history-backfill-v1';
const MAX = 2000;
/** runs shorter than this don't count (keeps XP / badges honest: no start→stop farming) */
export const MIN_RUN_SEC = 30;

interface ProgressState {
  ready: boolean;
  runs: RunSummary[];
  /** career badges unlocked by the run that just ended (shown once on the report) */
  fresh: { runId: string; badges: CareerBadge[] } | null;
}
export const useProgress = create<ProgressState>(() => ({ ready: false, runs: [], fresh: null }));

export function summarize(p: Presentation): RunSummary | null {
  if (!p.run.endedAt || !p.run.startedAt) return null;
  const r = buildReport(p);
  if (!r.steps.some((s) => s.actualSec != null) || r.actualSec < MIN_RUN_SEC) return null;
  return {
    id: `${p.id}:${p.run.startedAt}`,
    presId: p.id,
    title: p.title || 'Adsız sunum',
    endedAt: p.run.endedAt,
    plannedSec: r.plannedSec,
    actualSec: r.actualSec,
    steps: r.steps.length,
    completion: r.steps.length ? r.steps.filter((s) => s.actualSec != null).length / r.steps.length : 0,
    timeScore: r.timeScore,
    engagementScore: r.engagementScore,
    contentScore: r.contentScore,
    overallScore: r.overallScore,
    words: r.speech.words,
    wpm: r.speech.wpm,
    fillerRate: r.speech.words >= 50 ? r.speech.fillerRate : null,
    audiencePeak: p.run.audiencePeak,
    reactions: r.reactionTotal,
    polls: p.run.polls?.length ?? 0,
    jury: !!p.run.jury?.length,
    badges: r.badges.map((b) => b.label),
  };
}

/* ---------------- derived metrics ---------------- */
const WEEK = 7 * 24 * 3600 * 1000;
/** Monday 00:00 local of the week containing t */
export function weekStart(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** consecutive weeks with at least one run, counting back from this week (or last week, so the streak survives until Sunday) */
export function weekStreak(runs: RunSummary[], now = Date.now()): { current: number; best: number; thisWeek: number } {
  const weeks = new Set(runs.map((r) => weekStart(r.endedAt)));
  const cur = weekStart(now);
  let w = weeks.has(cur) ? cur : cur - WEEK;
  let current = 0;
  while (weeks.has(w)) {
    current++;
    w = weekStart(w - WEEK / 2);
  }
  const sorted = [...weeks].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  sorted.forEach((x, i) => {
    run = i && Math.round((x - sorted[i - 1]) / WEEK) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return { current, best, thisWeek: runs.filter((r) => weekStart(r.endedAt) === cur).length };
}

export const LEVELS = [
  { xp: 0, name: 'Çaylak', emoji: '🌱' },
  { xp: 300, name: 'Konuşmacı', emoji: '🗣️' },
  { xp: 800, name: 'Anlatıcı', emoji: '📖' },
  { xp: 1600, name: 'Sahne Sahibi', emoji: '🎤' },
  { xp: 3000, name: 'İlham Veren', emoji: '✨' },
  { xp: 5000, name: 'Usta Hatip', emoji: '🏆' },
];
/** each run: 50 for showing up + its overall score (0-100) */
export const xpOf = (r: RunSummary) => 50 + Math.round(r.overallScore);
export function levelOf(runs: RunSummary[]) {
  const xp = runs.reduce((a, r) => a + xpOf(r), 0);
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++;
  const next = LEVELS[i + 1] ?? null;
  const pct = next ? (xp - LEVELS[i].xp) / (next.xp - LEVELS[i].xp) : 1;
  return { ...LEVELS[i], xp, level: i + 1, next, pct };
}

export interface CareerBadge {
  id: string;
  emoji: string;
  label: string;
  hint: string;
  /** progress toward the badge */
  have: number;
  need: number;
}
const cnt = (runs: RunSummary[], f: (r: RunSummary) => boolean) => runs.filter(f).length;

export function careerBadges(runs: RunSummary[], now = Date.now()): (CareerBadge & { earned: boolean })[] {
  const totalMin = Math.round(runs.reduce((a, r) => a + r.actualSec, 0) / 60);
  const best = weekStreak(runs, now).best;
  const first3 = runs.slice(0, 3);
  const last3 = runs.slice(-3);
  const avg = (xs: RunSummary[]) => (xs.length ? xs.reduce((a, r) => a + r.overallScore, 0) / xs.length : 0);
  const growth = runs.length >= 6 ? Math.max(0, Math.round(avg(last3) - avg(first3))) : 0;
  const list: CareerBadge[] = [
    { id: 'first', emoji: '🚀', label: 'İlk Pitch', hint: 'İlk sunumunu tamamla', have: runs.length, need: 1 },
    { id: 'five', emoji: '🎯', label: 'Prova Alışkanlığı', hint: '5 sunum tamamla', have: runs.length, need: 5 },
    { id: 'ten', emoji: '🔟', label: '10 Sunum', hint: '10 sunum tamamla', have: runs.length, need: 10 },
    { id: 'twentyfive', emoji: '💎', label: 'Sahne Veteranı', hint: '25 sunum tamamla', have: runs.length, need: 25 },
    { id: 'ontime', emoji: '⏱️', label: 'Süreye Tam Uyum', hint: 'Zaman skoru 95+ olan bir sunum', have: cnt(runs, (r) => r.timeScore >= 95 && r.completion === 1), need: 1 },
    { id: 'ontime3', emoji: '⌚', label: 'İsviçre Saati', hint: '3 sunumda zaman skoru 90+', have: cnt(runs, (r) => r.timeScore >= 90), need: 3 },
    { id: 'nofiller', emoji: '🧼', label: 'Sıfır Dolgu', hint: '100+ kelimelik dökümde dolgu oranı %0.5 altı', have: cnt(runs, (r) => r.words >= 100 && r.fillerRate != null && r.fillerRate < 0.005), need: 1 },
    { id: 'rhythm', emoji: '🎵', label: 'Ritim Ustası', hint: '3 sunumda 110–160 kelime/dk', have: cnt(runs, (r) => r.wpm != null && r.wpm >= 110 && r.wpm <= 160), need: 3 },
    { id: 'streak3', emoji: '🔥', label: '3 Haftalık Seri', hint: '3 hafta üst üste en az 1 sunum', have: best, need: 3 },
    { id: 'streak8', emoji: '☄️', label: '8 Haftalık Seri', hint: '8 hafta üst üste en az 1 sunum', have: best, need: 8 },
    { id: 'score90', emoji: '🌟', label: 'Yıldız Performans', hint: 'Genel skoru 90+ olan bir sunum', have: cnt(runs, (r) => r.overallScore >= 90), need: 1 },
    { id: 'growth', emoji: '📈', label: 'Gelişen Konuşmacı', hint: 'Son 3 sunumun ortalaması ilk 3’ten 15 puan yüksek', have: growth, need: 15 },
    { id: 'crowd', emoji: '🏟️', label: 'Kalabalık Salon', hint: 'Canlı odada aynı anda 20+ izleyici', have: Math.max(0, ...runs.map((r) => r.audiencePeak)), need: 20 },
    { id: 'interactive', emoji: '📊', label: 'Etkileşim Ustası', hint: 'Bir sunumda 3+ canlı anket/quiz', have: Math.max(0, ...runs.map((r) => r.polls)), need: 3 },
    { id: 'jury', emoji: '⚖️', label: 'Jüri Önünde', hint: 'Jüri puanlamalı bir pitch günü yap', have: cnt(runs, (r) => r.jury), need: 1 },
    { id: 'marathon', emoji: '🏃', label: 'Maratoncu', hint: 'Toplam 300 dakika sunum', have: totalMin, need: 300 },
  ];
  return list.map((b) => ({ ...b, have: Math.min(b.have, b.need), earned: b.have >= b.need }));
}

/* ---------------- persistence + sync ---------------- */
function merge(a: RunSummary[], b: RunSummary[]): RunSummary[] {
  const m = new Map(a.map((r) => [r.id, r]));
  b.forEach((r) => m.has(r.id) || m.set(r.id, r));
  return [...m.values()].sort((x, y) => x.endedAt - y.endedAt).slice(-MAX);
}
async function persist(runs: RunSummary[]) {
  useProgress.setState({ runs });
  await idbSet(KEY, runs).catch(() => undefined);
}

async function pushRemote(items: RunSummary[]) {
  if (!useAccount.getState().email || !items.length) return;
  try {
    const r = await me<{ items: RunSummary[] }>('/history', { method: 'POST', body: JSON.stringify({ items }) });
    await persist(merge(useProgress.getState().runs, r.items));
  } catch {
    /* offline: the next sync sends everything again */
  }
}
/** pull the account's history and send anything only this device has */
export async function syncHistory() {
  if (!useAccount.getState().email) return;
  try {
    const r = await me<{ items: RunSummary[] }>('/history');
    const remoteIds = new Set(r.items.map((x) => x.id));
    const local = useProgress.getState().runs;
    await persist(merge(local, r.items));
    const missing = local.filter((x) => !remoteIds.has(x.id));
    if (missing.length) await pushRemote(missing);
  } catch {
    /* ignore */
  }
}

/** add a finished run; returns career badges it unlocked */
export async function recordRun(p: Presentation, { announce = true } = {}): Promise<CareerBadge[]> {
  const s = summarize(p);
  if (!s) return [];
  const before = useProgress.getState().runs;
  if (before.some((r) => r.id === s.id)) return [];
  const had = new Set(careerBadges(before).filter((b) => b.earned).map((b) => b.id));
  const after = merge(before, [s]);
  await persist(after);
  const unlocked = careerBadges(after).filter((b) => b.earned && !had.has(b.id));
  if (announce && unlocked.length) useProgress.setState({ fresh: { runId: s.id, badges: unlocked } });
  void pushRemote([s]);
  return unlocked;
}

/** one-time import of runs that already exist in the library (finished before Sprint 4) */
async function backfill() {
  if (await idbGet(BACKFILL_KEY).catch(() => true)) return;
  const found: RunSummary[] = [];
  const cur = useApp.getState().pres;
  const seen = new Set<string>();
  for (const e of useLibrary.getState().entries) {
    const p = e.id === cur.id ? cur : await loadPresentation(e.id).catch(() => null);
    const s = p && summarize(p);
    if (s) (found.push(s), seen.add(e.id));
  }
  if (!seen.has(cur.id)) {
    const s = summarize(cur);
    if (s) found.push(s);
  }
  if (found.length) await persist(merge(useProgress.getState().runs, found));
  await idbSet(BACKFILL_KEY, true).catch(() => undefined);
}

let wired = false;
export async function initProgress(): Promise<void> {
  if (wired) return;
  wired = true;
  const saved = (await idbGet<RunSummary[]>(KEY).catch(() => undefined)) ?? [];
  useProgress.setState({ runs: saved, ready: true });

  // record each run as it ends
  let lastEnded = useApp.getState().pres.run.endedAt;
  useApp.subscribe((st) => {
    const ended = st.pres.run.endedAt;
    if (ended && ended !== lastEnded) void recordRun(st.pres, { announce: Date.now() - ended < 60_000 });
    lastEnded = ended;
  });

  // library loads asynchronously; give it a moment before the one-time backfill
  const startBackfill = () => void backfill();
  if (useLibrary.getState().ready) startBackfill();
  else {
    const off = useLibrary.subscribe((s) => {
      if (s.ready) {
        off();
        startBackfill();
      }
    });
  }

  // account: merge on login and when another device adds a run
  let email = useAccount.getState().email;
  if (email) void syncHistory();
  useAccount.subscribe((a) => {
    if (a.email && a.email !== email) void syncHistory();
    email = a.email;
  });
  getSocket().on('history:changed', (e: { by?: string }) => e.by !== DEVICE && void syncHistory());
}
