// client/src/lib/recordings.ts — presenter's audio recordings, kept on this device only (IndexedDB, never uploaded or exported)
import { create } from 'zustand';
import { get as idbGet, set as idbSet } from 'idb-keyval';

export interface Recording {
  id: string;
  presId: string;
  stepIndex: number;
  stepTitle: string;
  name: string;
  mime: string;
  size: number;
  startedAt: number;
  durationMs: number;
  blob: Blob;
  /** audio (per step, microphone) or screen (video) */
  kind?: 'audio' | 'screen';
}

const key = (presId: string) => `teknodoz-sunum:rec:${presId}`;

/** bumps whenever recordings change so views can reload */
export const useRecordings = create<{ version: number }>(() => ({ version: 0 }));
const bump = () => useRecordings.setState((s) => ({ version: s.version + 1 }));

export async function listRecordings(presId: string): Promise<Recording[]> {
  try {
    return ((await idbGet<Recording[]>(key(presId))) ?? []).sort((a, b) => a.startedAt - b.startedAt);
  } catch {
    return [];
  }
}

export async function addRecording(r: Recording): Promise<void> {
  const list = await listRecordings(r.presId);
  await idbSet(key(r.presId), [...list, r]);
  bump();
}

export async function deleteRecording(presId: string, id: string): Promise<void> {
  await idbSet(
    key(presId),
    (await listRecordings(presId)).filter((r) => r.id !== id),
  );
  bump();
}

export async function clearRecordings(presId: string): Promise<void> {
  await idbSet(key(presId), []);
  bump();
}
