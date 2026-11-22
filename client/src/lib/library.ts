// client/src/lib/library.ts — local library of presentations (IndexedDB) + their cloud share links
import { create } from 'zustand';
import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';
import type { Presentation } from '../types';
import { normalizePresentation, uid } from './factory';
import { useApp } from '../store';

export type Visibility = 'private' | 'link' | 'public' | 'password';
export type LinkRole = 'viewer' | 'editor';

/** Credentials for a presentation stored on the server. Never part of exported files. */
export interface CloudLink {
  shareId: string;
  role: 'owner' | 'editor';
  ownerKey?: string;
  token?: string;
  version: number;
  visibility: Visibility;
  linkRole: LinkRole;
  /** owner choice: also upload notes, chat, transcript and run data */
  includeReport: boolean;
}

export interface LibEntry {
  id: string;
  title: string;
  presenter: string;
  stepCount: number;
  createdAt: number;
  updatedAt: number;
  cloud?: CloudLink;
}

const LIB_KEY = 'teknodoz-sunum:library';
const presKey = (id: string) => `teknodoz-sunum:pres:${id}`;

interface LibState {
  ready: boolean;
  entries: LibEntry[];
}

export const useLibrary = create<LibState>(() => ({ ready: false, entries: [] }));

const persist = () => idbSet(LIB_KEY, useLibrary.getState().entries).catch((e) => console.warn('Kütüphane yazılamadı', e));

const entryFor = (p: Presentation, prev?: LibEntry): LibEntry => ({
  id: p.id,
  title: p.title || 'Adsız sunum',
  presenter: p.presenter,
  stepCount: p.steps.length,
  createdAt: prev?.createdAt ?? p.createdAt ?? Date.now(),
  updatedAt: p.updatedAt ?? Date.now(),
  cloud: prev?.cloud,
});

/** Called once from hydrate(): loads the index and migrates the current (pre-library) presentation into it. */
export async function initLibrary(current: Presentation): Promise<void> {
  const entries = ((await idbGet<LibEntry[]>(LIB_KEY)) ?? []).filter((e) => e && e.id);
  if (!entries.some((e) => e.id === current.id)) {
    entries.unshift(entryFor(current));
    await idbSet(presKey(current.id), current);
  }
  useLibrary.setState({ ready: true, entries });
  await persist();
}

/** Debounced from the store subscription: keeps the library copy of the open presentation fresh. */
export async function savePresentation(p: Presentation): Promise<void> {
  await idbSet(presKey(p.id), p);
  useLibrary.setState((s) => {
    const prev = s.entries.find((e) => e.id === p.id);
    const next = entryFor(p, prev);
    return { entries: prev ? s.entries.map((e) => (e.id === p.id ? next : e)) : [next, ...s.entries] };
  });
  await persist();
}

export async function loadPresentation(id: string): Promise<Presentation | null> {
  const p = await idbGet<Presentation>(presKey(id));
  return p ? normalizePresentation(p) : null;
}

export async function openPresentation(id: string): Promise<boolean> {
  const cur = useApp.getState().pres;
  await savePresentation(cur);
  const p = await loadPresentation(id);
  if (!p) return false;
  useApp.getState().loadPresentation(p);
  useApp.getState().setView('setup');
  return true;
}

export async function addPresentation(p: Presentation, cloud?: CloudLink): Promise<void> {
  await idbSet(presKey(p.id), p);
  useLibrary.setState((s) => ({ entries: [{ ...entryFor(p), cloud }, ...s.entries.filter((e) => e.id !== p.id)] }));
  await persist();
}

export async function duplicatePresentation(id: string): Promise<void> {
  const p = await loadPresentation(id);
  if (!p) return;
  const now = Date.now();
  await addPresentation({ ...p, id: uid(), title: `${p.title} (kopya)`, createdAt: now, updatedAt: now });
}

export async function removePresentation(id: string): Promise<void> {
  await idbDel(presKey(id));
  useLibrary.setState((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
  await persist();
  if (useApp.getState().pres.id === id) {
    const next = useLibrary.getState().entries[0];
    if (next) await openPresentation(next.id);
    else useApp.getState().newPresentation();
  }
}

export function setCloud(presId: string, cloud: CloudLink | undefined): void {
  useLibrary.setState((s) => ({ entries: s.entries.map((e) => (e.id === presId ? { ...e, cloud } : e)) }));
  void persist();
}

export const cloudOf = (presId: string): CloudLink | undefined => useLibrary.getState().entries.find((e) => e.id === presId)?.cloud;
export const entryByShare = (shareId: string): LibEntry | undefined => useLibrary.getState().entries.find((e) => e.cloud?.shareId === shareId);
