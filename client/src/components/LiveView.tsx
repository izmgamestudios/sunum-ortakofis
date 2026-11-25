// client/src/components/LiveView.tsx
import { useEffect, useRef, useState } from 'react';
import { phaseElapsedMs, useApp } from '../store';
import { useRoom } from '../lib/room';
import { useSettings } from '../lib/settings';
import { bell, unlockAudio } from '../lib/sound';
import { fmtClock } from '../lib/report';
import { Hourglass } from './Hourglass';
import { RoleplayCard } from './Roleplay';
import { BreakScreen } from './BreakScreen';
import { TombalaLive, TreeLive } from './Topics';
import { ChatPanel, NotesPanel, RoomPanel } from './Panels';
import { MicIndicator, TranscriptPanel } from './Transcript';
import { LiveStage } from './LiveStage';

type SideTab = 'flow' | 'speech' | 'notes' | 'chat' | 'room';

function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Tombala / tree, transcript, notes, chat, room — used beside the stage and in the fullscreen drawer. */
function SidePanel({ stepIndex }: { stepIndex: number }) {
  const step = useApp((s) => s.pres.steps[stepIndex]);
  const chatCount = useApp((s) => s.pres.chat.length);
  const [tab, setTab] = useState<SideTab>('flow');
  const [seenChat, setSeenChat] = useState(chatCount);
  useEffect(() => {
    if (tab === 'chat') setSeenChat(chatCount);
  }, [tab, chatCount]);
  const unread = chatCount - seenChat;
  return (
    <div className="side-panel">
      <div className="side-tabs" role="tablist">
        {(
          [
            ['flow', step.topicMode === 'tree' ? '🌳' : step.topicMode === 'tombala' ? '🎱' : '🧭', step.topicMode === 'tree' ? 'Ağaç' : step.topicMode === 'tombala' ? 'Tombala' : 'Akış'],
            ['speech', '🎙️', 'Döküm'],
            ['notes', '📝', 'Not'],
            ['chat', '💬', 'Sohbet'],
            ['room', '📡', 'Oda'],
          ] as const
        ).map(([t, icon, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`side-tab ${tab === t ? 'is-active' : ''}`} onClick={() => setTab(t)} title={label}>
            <span className="side-tab-ico" aria-hidden>
              {icon}
              {t === 'chat' && unread > 0 && tab !== 'chat' && <span className="side-tab-badge">{unread > 9 ? '9+' : unread}</span>}
            </span>
            <span className="side-tab-label">{label}</span>
          </button>
        ))}
      </div>
      {tab === 'flow' &&
        (step.topicMode === 'tombala' ? (
          <TombalaLive index={stepIndex} />
        ) : step.topicMode === 'tree' ? (
          <TreeLive index={stepIndex} />
        ) : (
          <p className="muted empty">Serbest akış. Hazırlıkta bu adıma tombala ya da konu ağacı ekleyebilirsin.</p>
        ))}
      {tab === 'speech' && <TranscriptPanel />}
      {tab === 'notes' && <NotesPanel />}
      {tab === 'chat' && <ChatPanel />}
      {tab === 'room' && <RoomPanel />}
    </div>
  );
}

export function LiveView() {
  const pres = useApp((s) => s.pres);
  const live = useApp((s) => s.live);
  const { start, next, prev, togglePause, finish, extendBreak, rerollRoleplay, setView, goToStep } = useApp.getState();
  const floating = useRoom((s) => s.floating);
  const { bell: bellOn, bellWarnSec, volume, set: setSettings } = useSettings();
  const now = useNow();
  const lastSec = useRef<number | null>(null);

  const step = pres.steps[live.stepIndex];
  const elapsed = phaseElapsedMs(live, now);
  const plannedMs = (step?.durationSec ?? 60) * 1000;
  const remaining = plannedMs - elapsed;
  const overtime = live.phase === 'step' && remaining < 0;
  const warning = live.phase === 'step' && !overtime && remaining <= bellWarnSec * 1000;
  const breakTotalSec = live.breakPlannedSec != null ? live.breakPlannedSec + live.breakExtraSec : null;
  const paused = !!live.pausedAt;

  // auto transitions
  useEffect(() => {
    if (live.pausedAt) return;
    if (live.phase === 'step' && pres.autoAdvance && remaining <= 0) next();
    if (live.phase === 'break' && breakTotalSec != null && elapsed >= breakTotalSec * 1000) next();
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  // 🔔 bell: warning chime, ticks in the last 5 s, double bell at zero (also last 3 s of timed breaks)
  useEffect(() => {
    lastSec.current = null;
  }, [live.flipKey, live.phase]);
  useEffect(() => {
    if (paused || !bellOn) return;
    const msLeft = live.phase === 'step' ? remaining : breakTotalSec != null ? breakTotalSec * 1000 - elapsed : null;
    if (msLeft == null) return;
    const sec = Math.ceil(msLeft / 1000);
    const prevSec = lastSec.current;
    lastSec.current = sec;
    if (prevSec == null || prevSec === sec) return;
    if (live.phase === 'step') {
      if (sec === bellWarnSec && step && step.durationSec > bellWarnSec) bell('warn', volume);
      else if (sec >= 1 && sec <= 5) bell('tick', volume);
      else if (sec === 0) bell('end', volume);
    } else if (sec >= 1 && sec <= 3) bell('tick', volume);
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  // audio needs one user gesture before it may play
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

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
  const timerText = live.phase === 'step' ? fmtClock(remaining) : breakTotalSec != null ? fmtClock(breakTotalSec * 1000 - elapsed) : '∞';
  const minLabel = (sec: number) => (sec % 60 ? `${(sec / 60).toFixed(1).replace('.', ',')} dk` : `${sec / 60} dk`);

  const controls = (
    <div className="controls">
      <button className="icon-btn" onClick={prev} disabled={live.phase === 'step' && live.stepIndex === 0} aria-label="Önceki adım" title="Önceki (←)">
        ⏮
      </button>
      <button className={`icon-btn icon-btn--primary ${paused ? 'is-paused' : ''}`} onClick={togglePause} aria-label={paused ? 'Devam' : 'Duraklat'} title="Duraklat / devam (Boşluk)">
        {paused ? '▶' : '⏸'}
      </button>
      <button className="icon-btn" onClick={next} aria-label={isLast && live.phase === 'step' ? 'Bitir' : 'Sonraki adım'} title="Sonraki (→)">
        {isLast && live.phase === 'step' ? '🏁' : '⏭'}
      </button>
      <button
        className="icon-btn"
        onClick={() => setSettings({ bell: !bellOn })}
        aria-label={bellOn ? 'Zili kapat' : 'Zili aç'}
        aria-pressed={bellOn}
        title={bellOn ? `Zil açık — son ${bellWarnSec} sn uyarısı` : 'Zil kapalı'}
      >
        {bellOn ? '🔔' : '🔕'}
      </button>
      <button className="icon-btn" onClick={() => confirm('Sunum bitirilip rapora geçilsin mi?') && finish()} aria-label="Sunumu bitir" title="Bitir">
        ⏹
      </button>
    </div>
  );

  const timer = (size: number) => (
    <div className="hg-wrap">
      <Hourglass progress={progress} running={!paused} overtime={overtime} flipKey={live.flipKey} size={size} />
      <div className="timer-block">
        <span className={`timer ${overtime ? 'timer--over' : warning ? 'timer--warn' : ''}`} aria-live="off">
          {timerText}
        </span>
        <span className="timer-sub">
          {live.phase === 'break' ? 'Mola' : `${live.stepIndex + 1}/${pres.steps.length} · ${minLabel(step.durationSec)}`}
          {paused ? ' · ⏸ duraklatıldı' : ''}
        </span>
        <MicIndicator />
      </div>
    </div>
  );

  const dots = (
    <ol className={`step-dots ${paused ? 'is-browsable' : ''}`} aria-label={paused ? 'Adımlar — gitmek için dokun' : 'Adımlar'}>
      {pres.steps.map((s, i) => (
        <li key={s.id} className={`step-dot ${i < live.stepIndex ? 'is-done' : ''} ${i === live.stepIndex ? 'is-current' : ''}`}>
          <button
            className="step-dot-btn"
            onClick={() => goToStep(i)}
            disabled={!paused || (i === live.stepIndex && live.phase === 'step')}
            title={`${i + 1}. ${s.title} — ${minLabel(s.durationSec)}${paused ? ' · gitmek için tıkla' : ' · gezinmek için önce duraklat'}`}
            aria-label={`${i + 1}. adım, ${minLabel(s.durationSec)}`}
          >
            <span className="dot-num">{i + 1}</span>
            <small className="dot-min">{minLabel(s.durationSec)}</small>
          </button>
        </li>
      ))}
    </ol>
  );

  return (
    <main className={`live ${overtime ? 'is-overtime' : ''} ${warning ? 'is-warning' : ''}`}>
      <div className="live-top">
        {timer(40)}
        {dots}
        {controls}
        <div className="overall-progress" aria-hidden>
          <span style={{ width: `${(doneMs / totalMs) * 100}%` }} />
        </div>
      </div>

      {paused && live.phase === 'step' && (
        <p className="paused-hint" role="status">
          ⏸ Duraklatıldı — adım numaralarına dokunarak adımlar arasında gezinebilirsin. Devam etmek için ▶ ya da Boşluk.
        </p>
      )}

      <div className="floating-reactions" aria-hidden>
        {floating.map((f) => (
          <span key={f.id} style={{ left: `${f.x}%` }}>
            {f.emoji}
          </span>
        ))}
      </div>

      <div className="live-grid">
          <section className="live-main">
            <div className="live-step-head">
              <h1 className="live-title">
                <span className="step-num">{live.phase === 'break' ? '☕' : live.stepIndex + 1}</span> {live.phase === 'break' ? 'Mola' : step.title}
              </h1>
            </div>
            {live.currentRoleplay && live.phase === 'step' && <RoleplayCard rp={live.currentRoleplay} onReroll={rerollRoleplay} compact />}
            {/* no key: the stage must survive step changes, otherwise fullscreen would exit */}
            <LiveStage
              stepIndex={live.stepIndex}
              overlay={
                live.phase === 'break' && live.breakActivity ? (
                  <BreakScreen
                    activity={live.breakActivity}
                    elapsedMs={elapsed}
                    plannedSec={breakTotalSec}
                    nextTitle={pres.steps[live.stepIndex + 1]?.title ?? ''}
                    nextMinutes={(pres.steps[live.stepIndex + 1]?.durationSec ?? 60) / 60}
                    cue={pres.steps[live.stepIndex + 1]?.cue}
                    onContinue={next}
                    onExtend={() => extendBreak(15)}
                  />
                ) : null
              }
              hud={
                <div className="hud">
                  {timer(28)}
                  <span className="hud-title truncate">
                    <span className="step-num">{live.stepIndex + 1}</span> {step.title}
                  </span>
                  {dots}
                  {controls}
                </div>
              }
              sidePanel={<SidePanel stepIndex={live.stepIndex} />}
            />
          </section>

          <aside className="live-side">
            <SidePanel stepIndex={live.stepIndex} />
          </aside>
        </div>
      <p className="kbd-hint hide-xs">⌨️ ← / → adım · Boşluk duraklat · tuvalde V seç, T yazı, N not, Del sil, Ctrl+Z geri al</p>
    </main>
  );
}
