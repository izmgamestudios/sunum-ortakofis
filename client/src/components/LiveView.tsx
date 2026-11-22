// client/src/components/LiveView.tsx
import { useEffect, useState } from 'react';
import { phaseElapsedMs, useApp } from '../store';
import { useRoom } from '../lib/room';
import { fmtClock } from '../lib/report';
import { Hourglass } from './Hourglass';
import { RoleplayCard } from './Roleplay';
import { BreakScreen } from './BreakScreen';
import { Whiteboard } from './Whiteboard';
import { MediaPanel } from './Media';
import { TombalaLive, TreeLive } from './Topics';
import { ChatPanel, NotesPanel, RoomPanel } from './Panels';

type MainTab = 'canvas' | 'text' | 'media';
type SideTab = 'flow' | 'notes' | 'chat' | 'room';

function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function LiveView() {
  const pres = useApp((s) => s.pres);
  const live = useApp((s) => s.live);
  const { start, next, prev, togglePause, finish, extendBreak, rerollRoleplay, updateStep, setView } = useApp.getState();
  const floating = useRoom((s) => s.floating);
  const chatCount = useApp((s) => s.pres.chat.length);
  const now = useNow();
  const [mainTab, setMainTab] = useState<MainTab>('canvas');
  const [sideTab, setSideTab] = useState<SideTab>('flow');
  const [seenChat, setSeenChat] = useState(chatCount);

  const step = pres.steps[live.stepIndex];
  const elapsed = phaseElapsedMs(live, now);
  const plannedMs = (step?.durationSec ?? 60) * 1000;
  const remaining = plannedMs - elapsed;
  const overtime = live.phase === 'step' && remaining < 0;
  const breakTotalSec = live.breakPlannedSec != null ? live.breakPlannedSec + live.breakExtraSec : null;

  // auto transitions
  useEffect(() => {
    if (live.pausedAt) return;
    if (live.phase === 'step' && pres.autoAdvance && remaining <= 0) next();
    if (live.phase === 'break' && breakTotalSec != null && elapsed >= breakTotalSec * 1000) next();
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') next();
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') prev();
      else if (e.key === ' ') {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, togglePause]);

  useEffect(() => {
    if (sideTab === 'chat') setSeenChat(chatCount);
  }, [sideTab, chatCount]);

  if (live.phase === 'idle' || live.phase === 'done' || !step) {
    return (
      <main className="live-empty">
        <p className="eyebrow">{live.phase === 'done' ? 'Sunum tamamlandı 🎉' : 'Sunum henüz başlamadı'}</p>
        <h1>{pres.title}</h1>
        <div className="row gap-s center wrap">
          <button className="btn btn-primary btn-lg" onClick={start}>
            ▶ {live.phase === 'done' ? 'Yeniden başlat' : 'Sunumu başlat'}
          </button>
          {live.phase === 'done' && (
            <button className="btn btn-lg" onClick={() => setView('report')}>
              📊 Raporu gör
            </button>
          )}
        </div>
      </main>
    );
  }

  const progress = live.phase === 'step' ? Math.min(1, elapsed / plannedMs) : breakTotalSec ? Math.min(1, elapsed / (breakTotalSec * 1000)) : 0;
  const totalMs = pres.steps.reduce((a, s) => a + s.durationSec * 1000, 0);
  const doneMs = pres.steps.slice(0, live.stepIndex).reduce((a, s) => a + s.durationSec * 1000, 0) + (live.phase === 'step' ? Math.min(elapsed, plannedMs) : 0);
  const isLast = live.stepIndex === pres.steps.length - 1;
  const unread = chatCount - seenChat;

  return (
    <main className={`live ${overtime ? 'is-overtime' : ''}`}>
      <div className="live-top">
        <div className="hg-wrap">
          <Hourglass progress={progress} running={!live.pausedAt} overtime={overtime} flipKey={live.flipKey} size={40} />
          <div className="timer-block">
            <span className={`timer ${overtime ? 'timer--over' : ''}`} aria-live="off">
              {live.phase === 'step' ? fmtClock(remaining) : breakTotalSec != null ? fmtClock(breakTotalSec * 1000 - elapsed) : '∞'}
            </span>
            <span className="timer-sub">
              {live.phase === 'break' ? 'Mola' : `${live.stepIndex + 1}/${pres.steps.length} · ${step.durationSec / 60} dk`}
              {live.pausedAt ? ' · ⏸ duraklatıldı' : ''}
            </span>
          </div>
        </div>
        <ol className="step-dots" aria-label="Adımlar">
          {pres.steps.map((s, i) => (
            <li
              key={s.id}
              className={`step-dot ${i < live.stepIndex ? 'is-done' : ''} ${i === live.stepIndex ? 'is-current' : ''}`}
              title={`${i + 1}. ${s.title} — ${s.durationSec / 60} dk`}
            >
              <span>{i + 1}</span>
              <small>{s.durationSec / 60}′</small>
            </li>
          ))}
        </ol>
        <div className="controls">
          <button className="icon-btn" onClick={prev} disabled={live.phase === 'step' && live.stepIndex === 0} aria-label="Önceki">
            ⏮
          </button>
          <button className="icon-btn icon-btn--primary" onClick={togglePause} aria-label={live.pausedAt ? 'Devam' : 'Duraklat'}>
            {live.pausedAt ? '▶' : '⏸'}
          </button>
          <button className="icon-btn" onClick={next} aria-label={isLast && live.phase === 'step' ? 'Bitir' : 'Sonraki'}>
            {isLast && live.phase === 'step' ? '🏁' : '⏭'}
          </button>
          <button className="icon-btn" onClick={() => confirm('Sunum bitirilip rapora geçilsin mi?') && finish()} aria-label="Sunumu bitir">
            ⏹
          </button>
        </div>
        <div className="overall-progress" aria-hidden>
          <span style={{ width: `${(doneMs / totalMs) * 100}%` }} />
        </div>
      </div>

      <div className="floating-reactions" aria-hidden>
        {floating.map((f) => (
          <span key={f.id} style={{ left: `${f.x}%` }}>
            {f.emoji}
          </span>
        ))}
      </div>

      {live.phase === 'break' && live.breakActivity ? (
        <BreakScreen
          activity={live.breakActivity}
          elapsedMs={elapsed}
          plannedSec={breakTotalSec}
          nextTitle={pres.steps[live.stepIndex + 1]?.title ?? ''}
          nextMinutes={(pres.steps[live.stepIndex + 1]?.durationSec ?? 60) / 60}
          onContinue={next}
          onExtend={() => extendBreak(15)}
        />
      ) : (
        <div className="live-grid">
          <section className="live-main">
            <div className="live-step-head">
              <h1 className="live-title">
                <span className="step-num">{live.stepIndex + 1}</span> {step.title}
              </h1>
            </div>
            {live.currentRoleplay && <RoleplayCard rp={live.currentRoleplay} onReroll={rerollRoleplay} compact />}
            <div className="subtabs" role="tablist">
              {(
                [
                  ['canvas', '🎨 Tuval'],
                  ['text', '✍️ Metin'],
                  ['media', `🗂️ Medya${step.attachments.length ? ` (${step.attachments.length})` : ''}`],
                ] as const
              ).map(([t, l]) => (
                <button key={t} role="tab" aria-selected={mainTab === t} className={`subtab ${mainTab === t ? 'is-active' : ''}`} onClick={() => setMainTab(t)}>
                  {l}
                </button>
              ))}
            </div>
            {mainTab === 'canvas' && (
              <Whiteboard
                key={step.id}
                elements={step.canvas}
                attachments={step.attachments}
                onChange={(canvas) => updateStep(live.stepIndex, { canvas })}
                title={`adim-${live.stepIndex + 1}`}
                compact
              />
            )}
            {mainTab === 'text' && (
              <textarea
                className="input textarea live-text"
                value={step.text}
                placeholder="Bu adım için metin yok — buraya canlı yazabilirsin."
                onChange={(e) => updateStep(live.stepIndex, { text: e.target.value })}
              />
            )}
            {mainTab === 'media' && <MediaPanel key={step.id} attachments={step.attachments} onChange={(attachments) => updateStep(live.stepIndex, { attachments })} />}
          </section>

          <aside className="live-side">
            <div className="subtabs" role="tablist">
              {(
                [
                  ['flow', step.topicMode === 'tree' ? '🌳 Ağaç' : step.topicMode === 'tombala' ? '🎱 Tombala' : '🧭 Akış'],
                  ['notes', '📝 Not'],
                  ['chat', `💬 Sohbet${unread > 0 && sideTab !== 'chat' ? ` (${unread})` : ''}`],
                  ['room', '📡 Oda'],
                ] as const
              ).map(([t, l]) => (
                <button key={t} role="tab" aria-selected={sideTab === t} className={`subtab ${sideTab === t ? 'is-active' : ''}`} onClick={() => setSideTab(t)}>
                  {l}
                </button>
              ))}
            </div>
            {sideTab === 'flow' &&
              (step.topicMode === 'tombala' ? (
                <TombalaLive index={live.stepIndex} />
              ) : step.topicMode === 'tree' ? (
                <TreeLive index={live.stepIndex} />
              ) : (
                <p className="muted empty">Serbest akış. Kurulumda bu adıma tombala ya da konu ağacı ekleyebilirsin.</p>
              ))}
            {sideTab === 'notes' && <NotesPanel />}
            {sideTab === 'chat' && <ChatPanel />}
            {sideTab === 'room' && <RoomPanel />}
          </aside>
        </div>
      )}
      <p className="kbd-hint hide-xs">⌨️ ← / → adım · Boşluk duraklat</p>
    </main>
  );
}
