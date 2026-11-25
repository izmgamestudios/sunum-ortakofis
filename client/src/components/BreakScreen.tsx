// client/src/components/BreakScreen.tsx
import type { BreakActivity } from '../types';
import { BREAK_ACTIVITIES, BREATH_PATTERNS, GUIDED, STRETCH_MOVES, type BreathPattern, type GuidedStep } from '../lib/catalog';
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

/** paced breathing: the circle grows / holds / shrinks with each phase */
function PatternBreath({ pattern, elapsedMs }: { pattern: BreathPattern; elapsedMs: number }) {
  const cycle = pattern.phases.reduce((a, p) => a + p.sec, 0);
  const t = elapsedMs / 1000;
  const round = Math.floor(t / cycle);
  const done = round >= pattern.rounds;
  let within = t % cycle;
  let phase = pattern.phases[0];
  for (const p of pattern.phases) {
    if (within < p.sec) {
      phase = p;
      break;
    }
    within -= p.sec;
  }
  const count = Math.max(1, Math.ceil(phase.sec - within));
  return (
    <div className="breath">
      <div className={`breath-circle shape-${done ? 'done' : phase.shape}`} style={{ transitionDuration: `${phase.shape === 'hold' || phase.shape === 'rest' ? 0.3 : phase.sec}s` }}>
        <span className="breath-count">{done ? '✓' : count}</span>
      </div>
      <p className="breath-label">{done ? 'Harika — sakin ve hazırsın.' : phase.label}</p>
      <p className="muted small">
        {pattern.tip} — Tur {Math.min(pattern.rounds, round + 1)}/{pattern.rounds}
      </p>
    </div>
  );
}

/** guided micro-routine: one prompt after another */
function Guided({ steps, elapsedMs, focusDot }: { steps: GuidedStep[]; elapsedMs: number; focusDot?: boolean }) {
  let t = elapsedMs / 1000;
  let i = 0;
  while (i < steps.length - 1 && t >= steps[i].sec) {
    t -= steps[i].sec;
    i++;
  }
  const s = steps[i];
  return (
    <div className="stretch guided">
      {focusDot ? (
        <div className="focus-dot" aria-hidden />
      ) : (
        <div key={i} className="stretch-emoji">
          {s.emoji}
        </div>
      )}
      <p className="breath-label">{s.text}</p>
      <div className="dots">
        {steps.map((_, j) => (
          <span key={j} className={`dot ${j === i ? 'is-active' : j < i ? 'is-done' : ''}`} />
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
      {BREATH_PATTERNS[activity] && <PatternBreath pattern={BREATH_PATTERNS[activity]!} elapsedMs={elapsedMs} />}
      {GUIDED[activity] && <Guided steps={GUIDED[activity]!} elapsedMs={elapsedMs} focusDot={activity === 'focus'} />}
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
