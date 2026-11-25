// client/src/components/BreakScreen.tsx
import type { BreakActivity } from '../types';
import { BREAK_ACTIVITIES, STRETCH_MOVES } from '../lib/catalog';
import { fmtClock } from '../lib/report';

interface Props {
  activity: BreakActivity;
  elapsedMs: number;
  /** null → manual break (waits for button) */
  plannedSec: number | null;
  nextTitle: string;
  nextMinutes: number;
  onContinue: () => void;
  onExtend: () => void;
  /** reflection for the upcoming step (geçiş göndermesi) */
  cue?: string;
}

const BREATH = [
  { label: 'Nefes al', cls: 'inhale' },
  { label: 'Tut', cls: 'hold' },
  { label: 'Bırak', cls: 'exhale' },
] as const;

function Breathing({ elapsedMs }: { elapsedMs: number }) {
  const sec = Math.floor(elapsedMs / 1000);
  const round = Math.floor(sec / 12);
  const done = round >= 2;
  const phase = BREATH[Math.floor((sec % 12) / 4)];
  const count = 4 - (sec % 4);
  return (
    <div className="breath">
      <div className={`breath-circle ${done ? 'done' : phase.cls}`}>
        <span className="breath-count">{done ? '✓' : count}</span>
      </div>
      <p className="breath-label">{done ? 'Harika! Enerjin tazelendi.' : phase.label}</p>
      <p className="muted small">4 sn al · 4 sn tut · 4 sn bırak — Tur {Math.min(2, round + 1)}/2</p>
    </div>
  );
}

function Stretch({ elapsedMs }: { elapsedMs: number }) {
  const i = Math.floor(elapsedMs / 5000) % STRETCH_MOVES.length;
  const m = STRETCH_MOVES[i];
  return (
    <div className="stretch">
      <div key={i} className="stretch-emoji">
        {m.emoji}
      </div>
      <p className="breath-label">{m.text}</p>
      <div className="dots">
        {STRETCH_MOVES.map((_, j) => (
          <span key={j} className={`dot ${j === i ? 'is-active' : ''}`} />
        ))}
      </div>
    </div>
  );
}

function Water() {
  return (
    <div className="water">
      <div className="glass">
        <div className="glass-fill" />
      </div>
      <p className="breath-label">Bir yudum su iç 💧</p>
      <p className="muted small">Ses tellerin ve odağın için küçük bir yudum yeter.</p>
    </div>
  );
}

export function BreakScreen({ activity, elapsedMs, plannedSec, nextTitle, nextMinutes, onContinue, onExtend, cue }: Props) {
  const meta = BREAK_ACTIVITIES[activity];
  const remainingMs = plannedSec != null ? plannedSec * 1000 - elapsedMs : null;
  return (
    <section className="break-screen" aria-live="polite">
      <p className="eyebrow">
        {meta.emoji} Mola · {meta.label}
      </p>
      {activity === 'breathing' && <Breathing elapsedMs={elapsedMs} />}
      {activity === 'stretch' && <Stretch elapsedMs={elapsedMs} />}
      {activity === 'water' && <Water />}
      {activity === 'silent' && (
        <div className="stretch">
          <div className="stretch-emoji">🤫</div>
          <p className="breath-label">Sessizce toparlan</p>
        </div>
      )}
      {cue && (
        <blockquote className="break-cue">
          <span aria-hidden="true">🌌</span> {cue}
        </blockquote>
      )}
      <div className="break-footer">
        <p className="muted">
          Sıradaki: <b>{nextTitle}</b> · {nextMinutes} dk
        </p>
        {remainingMs != null ? (
          <p className="break-timer">{fmtClock(Math.max(0, remainingMs))}</p>
        ) : (
          <p className="muted small">Manuel bekleme — hazır olduğunda devam et.</p>
        )}
        <div className="row gap-s center wrap">
          <button className="btn btn-primary btn-lg" onClick={onContinue}>
            ▶ Hazırım, devam
          </button>
          {remainingMs != null && (
            <button className="btn" onClick={onExtend}>
              +15 sn
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
