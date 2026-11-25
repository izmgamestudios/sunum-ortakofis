// client/src/components/LiveStage.tsx — canvas / slides / sticky wall / text, with fullscreen + HUD + side drawer
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useInteract } from '../lib/interact';
import { useApp } from '../store';
import type { Attachment } from '../types';
import { elementsForAttachments, stickyElement } from '../lib/canvasDraw';
import { fileToAttachment } from '../lib/io';
import { Whiteboard } from './Whiteboard';
import { SlideViewer } from './SlideViewer';
import { StickyWall, useWallItems, WALL_META, type WallItem } from './StickyWall';
import { MediaPanel } from './Media';
import { APP_EVENTS } from '../lib/nav';
import { uid } from '../lib/factory';
import { PixelWorld } from './PixelWorld';
import { ListenDot } from './Transcript';
import { RichText } from './RichText';
import type { SideTab } from './LiveView';

type StageTab = 'canvas' | 'slides' | 'wall' | 'text' | 'pixels';

interface Props {
  stepIndex: number;
  /** compact timer + controls shown on top while fullscreen */
  hud: ReactNode;
  /** tombala / transcript / notes / chat panel (rendered in a drawer while fullscreen) */
  sidePanel: ReactNode;
  /** replaces the tab content (e.g. the break screen) while keeping fullscreen + HUD */
  overlay?: ReactNode;
  /** one-canvas layout: HUD always on top, everything else opens as panels over the canvas */
  canvasMode?: boolean;
  /** side-panel content for a single tab (canvas mode dock) */
  panelFor?: (tab: SideTab) => ReactNode;
  /** roleplay scenario card (canvas mode dock) */
  roleplay?: ReactNode;
}

type DockId = 'slides' | 'wall' | 'text' | 'pixels' | 'roleplay' | SideTab;
const WIDE: DockId[] = ['slides', 'wall', 'pixels', 'poll', 'jury'];

export function LiveStage({ stepIndex, hud, sidePanel, overlay, canvasMode = false, panelFor, roleplay }: Props) {
  const step = useApp((s) => s.pres.steps[stepIndex]);
  const updateStep = useApp((s) => s.updateStep);
  const [tab, setTab] = useState<StageTab>('canvas');
  const [panel, setPanel] = useState<DockId | null>(null);
  const juryOn = useApp((s) => !!s.pres.jury?.enabled);
  const pollActive = useInteract((s) => !!s.active);
  /** presentation screen: app chrome, canvas tools and dock hidden — only the HUD stays */
  const [present, setPresent] = useState(false);
  const [dockOpen, setDockOpen] = useState(true);
  const [textOpen, setTextOpen] = useState(false);
  const flowLabel = step.topicMode === 'tree' ? ['🌳', 'Ağaç'] : step.topicMode === 'tombala' ? ['🎱', 'Tombala'] : ['🧭', 'Akış'];
  // canvas mode: the "tabs" are panels over the canvas
  const showPanel = (id: DockId) => {
    if (id === 'text') return setTextOpen((o) => !o);
    setPanel((p) => (p === id ? null : id));
  };
  const togglePresent = () => {
    setPresent((p) => {
      const next = !p;
      setDockOpen(!next);
      if (next) setPanel(null);
      return next;
    });
  };
  // Esc leaves presentation mode (when not in browser fullscreen, which handles Esc itself)
  useEffect(() => {
    if (!present) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement && !panel) setPresent(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [present, panel]);
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
    if (tab === 'wall' || panel === 'wall') return;
    setPeek(newest);
    const t = setTimeout(() => setPeek((p) => (p?.id === newest.id ? null : p)), 7000);
    return () => clearTimeout(t);
  }, [audience, tab, panel]);

  useEffect(() => {
    if (tab === 'pixels' && step.widget !== 'pixels') setTab('canvas');
  }, [tab, step.widget]);

  useEffect(() => {
    if (tab === 'wall' || panel === 'wall') setSeen(new Set(items.map((i) => i.id)));
  }, [tab, panel, items]);

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

  if (canvasMode) {
    const dock: [DockId, string, string, number?][] = [
      ['slides', '🖼️', `Slayt${visualCount ? ` (${visualCount})` : ''}`],
      ['wall', '📌', 'Duvar', unread],
      ['text', '✍️', 'Metin'],
      ...(step.widget === 'pixels' ? ([['pixels', '🌍', 'Piksel']] as [DockId, string, string][]) : []),
      ...(roleplay ? ([['roleplay', '🎭', 'Senaryo']] as [DockId, string, string][]) : []),
      ['flow', flowLabel[0], flowLabel[1]],
      ['speech', '🎙️', 'Dinleme'],
      ['notes', '📝', 'Not'],
      ['chat', '💬', 'Sohbet'],
      ['room', '📡', 'Oda'],
      ['poll', '📊', 'Etkileşim', pollActive ? 1 : 0],
      ...(juryOn ? ([['jury', '⚖️', 'Jüri']] as [DockId, string, string][]) : []),
    ];
    const current = dock.find((d) => d[0] === panel);
    return (
      <div ref={stageRef} className={`stage is-canvas ${fs || present ? 'is-fs' : ''} ${present ? 'is-present' : ''}`}>
        <div className="stage-hud">
          {hud}
          <button className={`btn btn-sm ${present ? 'btn-primary' : ''}`} onClick={togglePresent} aria-pressed={present} title={present ? 'Düzenleme moduna dön (Esc)' : 'Sunum ekranı: menüler ve düzenleme araçları gizlenir'}>
            {present ? '✏️' : '🎬'} <span className="hide-sm">{present ? 'Düzenle' : 'Sunum modu'}</span>
          </button>
          {fsButton}
        </div>
        <div className="stage-body">
          <div className="stage-main">
            {overlay ?? (
              <div className="stage-canvas">
                <Whiteboard
                  key={step.id}
                  view={step.view}
                  onViewChange={(v) => updateStep(stepIndex, { view: v })}
                  elements={step.canvas}
                  groups={step.groups}
                  attachments={step.attachments}
                  onChange={(canvas, groups) => updateStep(stepIndex, { canvas, groups })}
                  onAddAttachments={(atts) => updateStep(stepIndex, (s) => ({ attachments: [...s.attachments, ...atts] }))}
                  onOpenMedia={(id) => {
                    setFocusId(id);
                    setPanel('slides');
                  }}
                  title={`adim-${stepIndex + 1}`}
                  compact
                  fit
                  presenting={present}
                />
                {peek && panel !== 'wall' && (
                  <button className="peek-sticky" style={{ background: WALL_META[peek.kind].color }} onClick={() => setPanel('wall')} title="Duvarda aç">
                    <small>
                      {WALL_META[peek.kind].emoji} {peek.author}
                    </small>
                    <span>{peek.text}</span>
                  </button>
                )}
              </div>
            )}
            {!overlay && !dockOpen && (
              <button className="dock-toggle" onClick={() => setDockOpen(true)} title="Panelleri göster" aria-label="Panelleri göster">
                ☰
              </button>
            )}
            {!overlay && dockOpen && (
              <nav className="canvas-dock" aria-label="Sunum panelleri">
                <button className="dock-btn dock-hide" onClick={() => (setDockOpen(false), setPanel(null))} title="Panelleri gizle" aria-label="Panelleri gizle">
                  <span aria-hidden>‹</span>
                  <small>Gizle</small>
                </button>
                {dock.map(([id, icon, label, badge], k) => (
                  <button
                    key={id}
                    className={`dock-btn ${panel === id || (id === 'text' && textOpen) ? 'is-active' : ''} ${k === 3 + (step.widget === 'pixels' ? 1 : 0) + (roleplay ? 1 : 0) ? 'dock-sep' : ''}`}
                    onClick={() => showPanel(id)}
                    aria-pressed={panel === id || (id === 'text' && textOpen)}
                    title={label}
                  >
                    <span aria-hidden>{icon}</span>
                    <small>{label}</small>
                    {id === 'speech' && <ListenDot />}
                    {!!badge && panel !== id && <span className="dock-badge">{badge > 9 ? '9+' : badge}</span>}
                  </button>
                ))}
              </nav>
            )}
            {!overlay && (
              <aside className={`text-drawer ${textOpen ? 'is-open' : ''} ${current && !WIDE.includes(current[0]) ? 'is-shifted' : ''}`} aria-label="Adım metni">
                <button className="text-handle" onClick={() => setTextOpen((o) => !o)} aria-expanded={textOpen} title={textOpen ? 'Metni gizle' : 'Metni göster'}>
                  <span aria-hidden>{textOpen ? '›' : '‹'}</span> ✍️ <span className="text-handle-label">Metin</span>
                </button>
                {textOpen && (
                  <div className="text-drawer-body">
                    {present ? (
                      <RichText readOnly html={step.html} text={step.text} onChange={() => undefined} />
                    ) : (
                      <RichText key={step.id} html={step.html} text={step.text} onChange={(html, text) => updateStep(stepIndex, { html, text })} placeholder="Bu adım için metin yok — buraya canlı yazabilirsin." minHeight={120} />
                    )}
                  </div>
                )}
              </aside>
            )}
            {!overlay && current && (
              <section className={`float-panel ${WIDE.includes(current[0]) ? 'float-panel--wide' : ''}`} role="dialog" aria-label={current[2]} onKeyDown={(e) => e.key === 'Escape' && setPanel(null)}>
                <header className="float-head">
                  <b>
                    {current[1]} {current[2]}
                  </b>
                  <button className="icon-btn icon-btn--ghost" onClick={() => setPanel(null)} aria-label="Paneli kapat" title="Kapat (Esc)">
                    ✕
                  </button>
                </header>
                <div className="float-body">
                  {panel === 'slides' && (
                    <>
                      <input ref={fileRef} type="file" hidden multiple accept="image/*,application/pdf,video/*,audio/*" onChange={(e) => { pickFiles(e.target.files); e.target.value = ''; }} />
                      <SlideViewer
                        attachments={step.attachments}
                        focusId={focusId}
                        onPinExisting={(a) => addToCanvas([a], false).then(() => setPanel(null))}
                        onPinNew={(a) => addToCanvas([a], true).then(() => setPanel(null))}
                        onAddClick={() => fileRef.current?.click()}
                      />
                    </>
                  )}
                  {panel === 'wall' && (
                    <StickyWall
                      done={done}
                      onToggleDone={(id) =>
                        setDone((d) => {
                          const n = new Set(d);
                          n.has(id) ? n.delete(id) : n.add(id);
                          return n;
                        })
                      }
                      onPin={(it) => {
                        pinSticky(it);
                        setTab('canvas');
                      }}
                    />
                  )}
                  {panel === 'pixels' && (
                    <PixelWorld
                      images={step.attachments.filter((a) => a.kind === 'image' && (a.dataUrl || a.url)).map((a) => ({ name: a.name, src: (a.dataUrl ?? a.url)! }))}
                      onPin={(dataUrl, name) =>
                        addToCanvas([{ id: uid(), kind: 'image', name, mime: 'image/png', size: Math.round((dataUrl.length * 3) / 4), dataUrl }], true).then(() => setPanel(null))
                      }
                    />
                  )}
                  {panel === 'roleplay' && roleplay}
                  {panel && !(['slides', 'wall', 'pixels', 'roleplay'] as DockId[]).includes(panel) && panelFor?.(panel as SideTab)}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    );
  }

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
            ...(step.widget === 'pixels' ? ([['pixels', '🌍 Piksel']] as const) : []),
          ] as [StageTab, string][]
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
                view={step.view}
                onViewChange={(v) => updateStep(stepIndex, { view: v })}
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
          {!overlay && tab === 'pixels' && (
            <div className="stage-pixels">
              <PixelWorld
                images={step.attachments.filter((a) => a.kind === 'image' && (a.dataUrl || a.url)).map((a) => ({ name: a.name, src: (a.dataUrl ?? a.url)! }))}
                onPin={(dataUrl, name) =>
                  addToCanvas([{ id: uid(), kind: 'image', name, mime: 'image/png', size: Math.round((dataUrl.length * 3) / 4), dataUrl }], true).then(() => setTab('canvas'))
                }
              />
            </div>
          )}
          {!overlay && tab === 'text' && (
            <RichText key={step.id} html={step.html} text={step.text} onChange={(html, text) => updateStep(stepIndex, { html, text })} placeholder="Bu adım için metin yok — buraya canlı yazabilirsin." className="live-text" />
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
