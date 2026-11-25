// client/src/components/SharedEntry.tsx — landing for /?s=ID: password gate, viewer page or editor import
import { useEffect, useMemo, useState } from 'react';
import { hydrate } from '../store';
import type { Presentation } from '../types';
import { normalizePresentation } from '../lib/factory';
import { entryByShare, openPresentation } from '../lib/library';
import { fetchShare, getMeta, importAsEditor, requestAccess, type ShareMeta } from '../lib/cloud';
import { getSocket } from '../lib/socket';
import { visibleElements } from '../lib/canvasGroups';
import { applyView, BOARD_H, BOARD_W, drawElement } from '../lib/canvasDraw';
import { BetaBadge, Logo } from './Header';
import { ThemeSwitcher } from './Shell';
import { SlideViewer } from './SlideViewer';
import type { Step, TopicNode } from '../types';

function ReadOnlyBoard({ step }: { step: Step }) {
  const [el, setEl] = useState<HTMLCanvasElement | null>(null);
  const [w, setW] = useState(800);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!el?.parentElement) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, e.contentRect.width)));
    ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [el]);
  useEffect(() => {
    if (!el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = Math.round(w * dpr);
    el.height = Math.round(((w * BOARD_H) / BOARD_W) * dpr);
    el.style.width = `${w}px`;
    el.style.height = `${(w * BOARD_H) / BOARD_W}px`;
    const ctx = el.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, el.width, el.height);
    // same framing as the owner's last zoom / pan on this step
    applyView(ctx, w, dpr, step.view);
    visibleElements(step.canvas, step.groups).forEach((x) => drawElement(ctx, x, step.attachments, () => setTick((t) => t + 1)));
  }, [el, w, step, tick]);
  return (
    <div className="watch-scroll">
      <canvas ref={setEl} aria-label="Tuval (salt okunur)" />
    </div>
  );
}

function Tree({ nodes }: { nodes: TopicNode[] }) {
  return (
    <ul className="ro-tree">
      {nodes.map((n) => (
        <li key={n.id}>
          {n.label}
          {n.children.length > 0 && <Tree nodes={n.children} />}
        </li>
      ))}
    </ul>
  );
}

/** Read-only presentation page for anonymous viewers. */
function SharedViewer({ pres, meta, onRefresh }: { pres: Presentation; meta: ShareMeta; onRefresh: () => void }) {
  const [i, setI] = useState(0);
  const step = pres.steps[Math.min(i, pres.steps.length - 1)];
  const total = useMemo(() => pres.steps.reduce((a, s) => a + s.durationSec, 0), [pres]);
  const visual = step.attachments.filter((a) => a.kind !== 'file');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, .slides')) return;
      if (e.key === 'ArrowRight') setI((x) => Math.min(pres.steps.length - 1, x + 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pres.steps.length]);
  return (
    <div className="aud-page">
      <SharedHeader />
      <main className="audience audience--live shared-view">
        <section className="card aud-state">
          <div className="row gap-s wrap" style={{ justifyContent: 'space-between' }}>
            <h1>{pres.title}</h1>
            <span className="lib-badge">👀 Salt okunur</span>
          </div>
          <p className="muted small">
            {pres.presenter && <>🎤 {pres.presenter} · </>}
            {pres.steps.length} adım · {Math.round(total / 60)} dk · güncellendi {new Date(meta.updatedAt).toLocaleString('tr-TR')}{' '}
            <button className="link-btn" onClick={onRefresh}>
              ↻ yenile
            </button>
          </p>
          <ol className="step-dots step-dots--sm">
            {pres.steps.map((s, k) => (
              <li key={s.id} className={`step-dot ${k < i ? 'is-done' : ''} ${k === i ? 'is-current' : ''}`}>
                <button className="step-dot-btn" onClick={() => setI(k)} aria-label={`${k + 1}. ${s.title}`}>
                  <span className="dot-num">{k + 1}</span>
                  <small className="dot-min">{Math.round(s.durationSec / 60)} dk</small>
                </button>
              </li>
            ))}
          </ol>
        </section>
        <div className="aud-grid">
          <div className="stack">
            <section className="card stack">
              <h2 className="live-title">
                <span className="step-num">{i + 1}</span> {step.title}
              </h2>
              {step.canvas.length > 0 && <ReadOnlyBoard step={step} />}
              {step.text && <p className="ro-text">{step.text}</p>}
            </section>
            {visual.length > 0 && (
              <section className="card">
                <SlideViewer attachments={step.attachments} />
              </section>
            )}
          </div>
          <div className="aud-col-side">
            {step.topicTree.length > 0 && (
              <section className="card stack">
                <h3 className="card-title">🌳 Konu ağacı</h3>
                <Tree nodes={step.topicTree} />
              </section>
            )}
            {step.words.length > 0 && (
              <section className="card stack">
                <h3 className="card-title">🎱 Tombala kelimeleri</h3>
                <ul className="word-cloud">
                  {step.words.map((w) => (
                    <li key={w} className="ball ball--sm">
                      {w}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="card stack">
              <div className="row gap-s">
                <button className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>
                  ‹ Önceki
                </button>
                <button className="btn btn-primary" disabled={i === pres.steps.length - 1} onClick={() => setI(i + 1)}>
                  Sonraki ›
                </button>
              </div>
              <p className="small muted">Canlı sunuma katılmak için sunucunun paylaştığı oda kodunu kullan.</p>
              <a className="btn btn-ghost btn-sm" href="/">
                Kendi sunumunu oluştur →
              </a>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

function SharedHeader() {
  return (
    <header className="aud-head">
      <a href="/" className="aud-logo" aria-label="Teknodoz Sunum ana sayfa">
        <Logo small />
      </a>
      <BetaBadge />
      <span className="aud-head-right">
        <ThemeSwitcher />
      </span>
    </header>
  );
}

type Phase = { k: 'loading' } | { k: 'error'; msg: string } | { k: 'password'; meta: ShareMeta; err?: string } | { k: 'viewer'; meta: ShareMeta; pres: Presentation; token: string };

export function SharedEntry({ shareId, onOpenApp }: { shareId: string; onOpenApp: () => void }) {
  const [phase, setPhase] = useState<Phase>({ k: 'loading' });
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  const leaveToApp = () => {
    const u = new URL(window.location.href);
    u.searchParams.delete('s');
    window.history.replaceState(null, '', u);
    onOpenApp();
  };

  const proceed = async (meta: ShareMeta, token: string, role: 'viewer' | 'editor') => {
    if (role === 'editor') {
      const presId = await importAsEditor(meta.id, token);
      await openPresentation(presId);
      leaveToApp();
      return;
    }
    const r = await fetchShare(meta.id, { token });
    setPhase({ k: 'viewer', meta, pres: normalizePresentation(r.presentation), token });
  };

  useEffect(() => {
    (async () => {
      await hydrate();
      // already in my library (owner or editor) → just open it
      const mine = entryByShare(shareId);
      if (mine) {
        await openPresentation(mine.id);
        return leaveToApp();
      }
      try {
        const meta = await getMeta(shareId);
        if (meta.needsPassword) return setPhase({ k: 'password', meta });
        const acc = await requestAccess(shareId);
        await proceed(meta, acc.token, acc.role);
      } catch (e) {
        setPhase({ k: 'error', msg: e instanceof Error ? e.message : 'Sunum açılamadı' });
      }
    })();
  }, [shareId]); // eslint-disable-line react-hooks/exhaustive-deps

  // viewers get live refreshes when the owner/editors save
  useEffect(() => {
    if (phase.k !== 'viewer') return;
    const s = getSocket();
    s.emit('share:watch', { id: phase.meta.id, token: phase.token });
    const onUpd = (e: { id: string }) => e.id === phase.meta.id && void refresh();
    s.on('share:updated', onUpd);
    return () => {
      s.off('share:updated', onUpd);
    };
  }, [phase.k]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async () => {
    if (phase.k !== 'viewer') return;
    try {
      const [r, meta] = await Promise.all([fetchShare(phase.meta.id, { token: phase.token }), getMeta(phase.meta.id)]);
      setPhase({ k: 'viewer', meta, pres: normalizePresentation(r.presentation), token: phase.token });
    } catch {
      setPhase({ k: 'error', msg: 'Sunum artık erişilebilir değil (özel yapılmış, şifresi değişmiş ya da kaldırılmış olabilir).' });
    }
  };

  const submitPw = async () => {
    if (phase.k !== 'password') return;
    setBusy(true);
    try {
      const acc = await requestAccess(shareId, pw);
      await proceed(phase.meta, acc.token, acc.role);
    } catch (e) {
      setPhase({ ...phase, err: e instanceof Error ? e.message : 'Hata' });
    } finally {
      setBusy(false);
    }
  };

  if (phase.k === 'viewer') return <SharedViewer pres={phase.pres} meta={phase.meta} onRefresh={refresh} />;

  return (
    <div className="aud-page">
      <SharedHeader />
      <main className="audience audience--join">
        <div className="join-card card">
          {phase.k === 'loading' && <p className="muted">⏳ Sunum açılıyor…</p>}
          {phase.k === 'error' && (
            <>
              <p className="eyebrow">Paylaşılan sunum</p>
              <h1>😕 Açılamadı</h1>
              <p className="muted">{phase.msg}</p>
              <a className="btn btn-primary" href="/">
                Teknodoz Sunum’a git
              </a>
            </>
          )}
          {phase.k === 'password' && (
            <>
              <p className="eyebrow">🔑 Şifreli sunum</p>
              <h1>{phase.meta.title}</h1>
              <p className="muted">
                {phase.meta.stepCount} adım · {phase.meta.linkRole === 'editor' ? '✏️ şifreyle düzenleme izni' : '👀 şifreyle izleme izni'}
              </p>
              <input
                className="input"
                type="password"
                autoFocus
                autoComplete="current-password"
                value={pw}
                placeholder="Şifre"
                onChange={(e) => setPw(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitPw()}
                aria-label="Şifre"
              />
              <button className="btn btn-primary btn-lg" disabled={!pw || busy} onClick={submitPw}>
                {busy ? '⏳' : 'Aç →'}
              </button>
              {phase.err && <p className="error">{phase.err}</p>}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
