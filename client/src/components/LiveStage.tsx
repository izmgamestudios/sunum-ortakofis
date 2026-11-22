// client/src/components/LiveStage.tsx — canvas / slides / sticky wall / text, with fullscreen + HUD + side drawer
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../store';
import type { Attachment } from '../types';
import { elementsForAttachments, stickyElement } from '../lib/canvasDraw';
import { fileToAttachment } from '../lib/io';
import { Whiteboard } from './Whiteboard';
import { SlideViewer } from './SlideViewer';
import { StickyWall, useWallItems, WALL_META, type WallItem } from './StickyWall';
import { MediaPanel } from './Media';
import { APP_EVENTS } from '../lib/nav';

type StageTab = 'canvas' | 'slides' | 'wall' | 'text';

interface Props {
  stepIndex: number;
  /** compact timer + controls shown on top while fullscreen */
  hud: ReactNode;
  /** tombala / transcript / notes / chat panel (rendered in a drawer while fullscreen) */
  sidePanel: ReactNode;
  /** replaces the tab content (e.g. the break screen) while keeping fullscreen + HUD */
  overlay?: ReactNode;
}

export function LiveStage({ stepIndex, hud, sidePanel, overlay }: Props) {
  const step = useApp((s) => s.pres.steps[stepIndex]);
  const updateStep = useApp((s) => s.updateStep);
  const [tab, setTab] = useState<StageTab>('canvas');
  const [fs, setFs] = useState(false);
  const fsRef = useRef(false);
  fsRef.current = fs;
  const [drawer, setDrawer] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [peek, setPeek] = useState<WallItem | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const items = useWallItems();
  const audience = items.filter((i) => i.kind !== 'note');
  const unread = audience.filter((i) => !seen.has(i.id)).length;
  const lastAudienceId = useRef<string | null>(audience[0]?.id ?? null);

  /* ---------- canvas helpers ---------- */
  const addToCanvas = async (atts: Attachment[], storeAttachments: boolean) => {
    const cur = useApp.getState().pres.steps[stepIndex];
    const els = await elementsForAttachments(atts, cur.canvas.length);
    updateStep(stepIndex, (s) => ({
      attachments: storeAttachments ? [...s.attachments, ...atts] : s.attachments,
      canvas: [...s.canvas, ...els],
    }));
  };
  const pinSticky = (it: WallItem) => {
    const idx = Object.keys(WALL_META).indexOf(it.kind);
    const el = stickyElement(`${WALL_META[it.kind].emoji} ${it.text}\n— ${it.author}`, [1, 0, 2, 3, 4][idx] ?? 0);
    el.fill = WALL_META[it.kind].color;
    updateStep(stepIndex, (s) => ({ canvas: [...s.canvas, el] }));
    setDone((d) => new Set(d).add(it.id));
    setTab('canvas');
  };
  const pickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const atts: Attachment[] = [];
    for (const f of Array.from(files)) {
      try {
        atts.push(await fileToAttachment(f));
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    }
    if (atts.length) await addToCanvas(atts, true);
  };

  /* ---------- audience peek: newest input pops up on the canvas ---------- */
  useEffect(() => {
    const newest = audience[0];
    if (!newest || newest.id === lastAudienceId.current) return;
    lastAudienceId.current = newest.id;
    if (tab === 'wall') return;
    setPeek(newest);
    const t = setTimeout(() => setPeek((p) => (p?.id === newest.id ? null : p)), 7000);
    return () => clearTimeout(t);
  }, [audience, tab]);

  useEffect(() => {
    if (tab === 'wall') setSeen(new Set(items.map((i) => i.id)));
  }, [tab, items]);

  /* ---------- fullscreen (API where available, CSS overlay fallback e.g. iOS) ---------- */
  const enterFs = async () => {
    const el = stageRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> }) | null;
    setFs(true);
    try {
      if (el?.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else await el?.webkitRequestFullscreen?.();
    } catch {
      /* fallback: CSS overlay stays */
    }
  };
  const exitFs = async () => {
    setFs(false);
    setDrawer(false);
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  };
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) {
        setFs(false);
        setDrawer(false);
      }
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  useEffect(() => {
    const toggle = () => (fsRef.current ? exitFs() : enterFs());
    window.addEventListener(APP_EVENTS.fullscreen, toggle);
    return () => window.removeEventListener(APP_EVENTS.fullscreen, toggle);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!fs) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.fullscreenElement && exitFs();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fs]); // eslint-disable-line react-hooks/exhaustive-deps

  const visualCount = step.attachments.filter((a) => a.kind !== 'file').length;
  const fsButton = (
    <button className="tool tool--wide stage-fs-btn" onClick={() => (fs ? exitFs() : enterFs())} title={fs ? 'Tam ekrandan çık (Esc)' : 'Tam ekran'} aria-pressed={fs}>
      {fs ? '🗗' : '⛶'} <span className="hide-sm">{fs ? 'Küçült' : 'Tam ekran'}</span>
    </button>
  );

  return (
    <div ref={stageRef} className={`stage ${fs ? 'is-fs' : ''} ${drawer ? 'drawer-open' : ''}`}>
      {fs && (
        <div className="stage-hud">
          {hud}
          <button className={`btn btn-sm ${drawer ? 'btn-primary' : ''}`} onClick={() => setDrawer((d) => !d)} aria-expanded={drawer} title="Tombala, döküm, not, sohbet">
            ☰ <span className="hide-sm">Panel</span>
          </button>
          <button className="btn btn-sm" onClick={exitFs} title="Tam ekrandan çık (Esc)">
            ✕
          </button>
        </div>
      )}

      {!overlay && <div className="stage-tabs subtabs" role="tablist">
        {(
          [
            ['canvas', '🎨 Tuval'],
            ['slides', `🖼️ Slayt${visualCount ? ` (${visualCount})` : ''}`],
            ['wall', `📌 Duvar${unread ? ` · ${unread} yeni` : ''}`],
            ['text', '✍️ Metin'],
          ] as const
        ).map(([t, l]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`subtab ${tab === t ? 'is-active' : ''} ${t === 'wall' && unread ? 'has-badge' : ''}`} onClick={() => setTab(t)}>
            {l}
          </button>
        ))}
        {tab !== 'canvas' && <span className="stage-tabs-end">{fsButton}</span>}
      </div>}

      <div className="stage-body">
        <div className="stage-main">
          {overlay}
          {!overlay && tab === 'canvas' && (
            <div className="stage-canvas">
              <Whiteboard
                key={step.id}
                elements={step.canvas}
                groups={step.groups}
                attachments={step.attachments}
                onChange={(canvas, groups) => updateStep(stepIndex, { canvas, groups })}
                onAddAttachments={(atts) => updateStep(stepIndex, (s) => ({ attachments: [...s.attachments, ...atts] }))}
                onOpenMedia={(id) => {
                  setFocusId(id);
                  setTab('slides');
                }}
                title={`adim-${stepIndex + 1}`}
                compact
                fit={fs}
                toolbarExtra={fsButton}
              />
              {peek && (
                <button className="peek-sticky" style={{ background: WALL_META[peek.kind].color }} onClick={() => setTab('wall')} title="Duvarda aç">
                  <small>
                    {WALL_META[peek.kind].emoji} {peek.author}
                  </small>
                  <span>{peek.text}</span>
                </button>
              )}
            </div>
          )}
          {!overlay && tab === 'slides' && (
            <>
              <input ref={fileRef} type="file" hidden multiple accept="image/*,application/pdf,video/*,audio/*" onChange={(e) => { pickFiles(e.target.files); e.target.value = ''; }} />
              <SlideViewer
                attachments={step.attachments}
                focusId={focusId}
                onPinExisting={(a) => addToCanvas([a], false).then(() => setTab('canvas'))}
                onPinNew={(a) => addToCanvas([a], true).then(() => setTab('canvas'))}
                onAddClick={() => fileRef.current?.click()}
              />
              {!fs && (
                <details className="manage-media">
                  <summary>🗂️ Dosyaları yönet (link ekle, indir, kaldır)</summary>
                  <MediaPanel attachments={step.attachments} onChange={(attachments) => void useApp.getState().setAttachments(stepIndex, attachments)} />
                </details>
              )}
            </>
          )}
          {!overlay && tab === 'wall' && (
            <StickyWall
              done={done}
              onToggleDone={(id) =>
                setDone((d) => {
                  const n = new Set(d);
                  n.has(id) ? n.delete(id) : n.add(id);
                  return n;
                })
              }
              onPin={pinSticky}
            />
          )}
          {!overlay && tab === 'text' && (
            <textarea
              className="input textarea live-text"
              value={step.text}
              placeholder="Bu adım için metin yok — buraya canlı yazabilirsin."
              onChange={(e) => updateStep(stepIndex, { text: e.target.value })}
            />
          )}
        </div>
        {fs && (
          <aside className="stage-drawer" aria-hidden={!drawer}>
            {sidePanel}
          </aside>
        )}
      </div>
    </div>
  );
}
