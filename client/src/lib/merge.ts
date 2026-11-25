// client/src/lib/merge.ts — add template steps to a presentation, merge presentations, split one in two
import type { Presentation, Step } from '../types';
import { createPresentation, MAX_STEPS, normalizePresentation, uid } from './factory';

/** a step copied into another presentation: fresh ids, run-time state cleared */
export function cloneStep(s: Step): Step {
  const groupIds = new Map(s.groups.map((g) => [g.id, uid()]));
  const attIds = new Map(s.attachments.map((a) => [a.id, uid()]));
  return {
    ...s,
    id: uid(),
    drawnWords: [],
    markedWords: [],
    attachments: s.attachments.map((a) => ({ ...a, id: attIds.get(a.id)! })),
    groups: s.groups.map((g) => ({ ...g, id: groupIds.get(g.id)!, parentId: g.parentId ? groupIds.get(g.parentId) : undefined })),
    canvas: s.canvas.map((e) => ({ ...e, id: uid(), groupId: e.groupId ? groupIds.get(e.groupId) : undefined, attachmentId: e.attachmentId ? attIds.get(e.attachmentId) : undefined })),
    topicTree: JSON.parse(JSON.stringify(s.topicTree)),
  };
}

const freshRun = (p: Presentation): Presentation => {
  const base = createPresentation(1);
  return { ...p, notes: [], chat: [], transcript: [], run: base.run, swot: base.swot, reflection: '' };
};

/** append steps (capped at MAX_STEPS) */
export function appendSteps(target: Presentation, steps: Step[]): { pres: Presentation; added: number } {
  const room = Math.max(0, MAX_STEPS - target.steps.length);
  const add = steps.slice(0, room).map(cloneStep);
  return { pres: { ...target, steps: [...target.steps, ...add], updatedAt: Date.now() }, added: add.length };
}

/** a new presentation built from chosen steps of several presentations (first one gives settings, intro; last one gives outro) */
export function mergePresentations(sources: Presentation[], steps: Step[], title: string): Presentation {
  const first = sources[0];
  const last = sources[sources.length - 1];
  const now = Date.now();
  return normalizePresentation(
    freshRun({
      ...first,
      id: uid(),
      title: title || sources.map((s) => s.title).join(' + '),
      createdAt: now,
      updatedAt: now,
      templateId: undefined,
      steps: steps.slice(0, MAX_STEPS).map(cloneStep),
      intro: first.intro,
      outro: last.outro,
    }),
  );
}

/** split after step `at` (1-based count kept in part 1) → two new presentations; the original stays untouched */
export function splitPresentation(p: Presentation, at: number): [Presentation, Presentation] {
  const now = Date.now();
  const a = freshRun({ ...p, id: uid(), title: `${p.title} (1/2)`, createdAt: now, updatedAt: now, steps: p.steps.slice(0, at).map(cloneStep), outro: undefined });
  const b = freshRun({ ...p, id: uid(), title: `${p.title} (2/2)`, createdAt: now, updatedAt: now + 1, steps: p.steps.slice(at).map(cloneStep), intro: undefined });
  return [normalizePresentation(a), normalizePresentation(b)];
}
