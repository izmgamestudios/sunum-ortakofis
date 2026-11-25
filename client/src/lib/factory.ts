// client/src/lib/factory.ts
import type { Presentation, Step, TopicNode } from '../types';

/** quick step-count picker shows 1…9; presentations can grow beyond that (add, merge, templates) */
export const QUICK_STEPS = 9;
/** technical upper bound (abuse protection), not a product limit */
export const MAX_STEPS = 60;
export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);

/** Step N lasts N minutes by default (1 → 1 dk, 6 → 6 dk). */
export function defaultDurationSec(index: number): number {
  return (index + 1) * 60;
}

export function createStep(index: number): Step {
  return {
    id: uid(),
    title: `${index + 1}. Adım`,
    durationSec: defaultDurationSec(index),
    text: '',
    attachments: [],
    canvas: [],
    groups: [],
    topicMode: 'free',
    words: [],
    drawnWords: [],
    markedWords: [],
    topicTree: [],
  };
}

export function createNode(label: string): TopicNode {
  return { id: uid(), label, children: [] };
}

export function createPresentation(stepCount = 6): Presentation {
  const now = Date.now();
  return {
    format: 'snmtdz',
    version: 1,
    id: uid(),
    title: 'Yeni Sunum',
    presenter: '',
    audience: '',
    createdAt: now,
    updatedAt: now,
    steps: Array.from({ length: stepCount }, (_, i) => createStep(i)),
    breakConfig: { mode: 'auto', autoSeconds: 30, activities: ['breathing', 'stretch', 'water'], order: 'cycle' },
    roleplay: {
      enabled: false,
      emotion: 'neutral',
      tone: 'friendly',
      setting: 'stage',
      timeOfDay: 'noon',
      crowd: 3,
      randomizePerStep: false,
    },
    autoAdvance: false,
    notes: [],
    chat: [],
    run: { steps: [], breaks: [], reactions: {}, audiencePeak: 0, suggestedWords: [], bingoCount: 0, autoMarked: 0 },
    swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
    reflection: '',
    transcript: [],
  };
}

/** Defensive normalisation for imported files (older / hand-edited JSON). */
export function normalizePresentation(raw: unknown): Presentation {
  if (!raw || typeof raw !== 'object') throw new Error('Geçersiz dosya içeriği.');
  const r = raw as Partial<Presentation>;
  if (!Array.isArray(r.steps) || r.steps.length === 0) throw new Error('Dosyada sunum adımı bulunamadı.');
  const base = createPresentation(Math.min(MAX_STEPS, r.steps.length));
  const steps = r.steps.slice(0, MAX_STEPS).map((s, i) => ({ ...createStep(i), ...s, id: s?.id ?? uid() }));
  return {
    ...base,
    ...r,
    format: 'snmtdz',
    version: 1,
    steps,
    breakConfig: { ...base.breakConfig, ...r.breakConfig },
    roleplay: { ...base.roleplay, ...r.roleplay },
    run: { ...base.run, ...r.run },
    swot: { ...base.swot, ...r.swot },
    notes: Array.isArray(r.notes) ? r.notes : [],
    chat: Array.isArray(r.chat) ? r.chat : [],
    transcript: Array.isArray(r.transcript) ? r.transcript : [],
  };
}
