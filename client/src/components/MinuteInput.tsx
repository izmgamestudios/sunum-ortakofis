// client/src/components/MinuteInput.tsx — editable step duration in minutes (0.5 … 60, half-minute steps)
import { useEffect, useState } from 'react';

const MIN_SEC = 30;
const MAX_SEC = 3600;

export const clampSec = (sec: number) => Math.max(MIN_SEC, Math.min(MAX_SEC, Math.round(sec / 30) * 30));

interface Props {
  sec: number;
  onChange: (sec: number) => void;
  label: string;
  /** show −/+ buttons (1 minute) next to the field */
  steppers?: boolean;
}

export function MinuteInput({ sec, onChange, label, steppers = false }: Props) {
  // local draft so the user can clear the field and type a new value
  const [draft, setDraft] = useState(String(sec / 60));
  useEffect(() => setDraft(String(sec / 60)), [sec]);
  const commit = (raw: string) => {
    const n = Number(raw.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return setDraft(String(sec / 60));
    const next = clampSec(n * 60);
    if (next !== sec) onChange(next);
    setDraft(String(next / 60));
  };
  return (
    <span className="duration-input" title={label}>
      {steppers && (
        <button type="button" className="dur-step" onClick={() => onChange(clampSec(sec - 60))} disabled={sec <= MIN_SEC} aria-label={`${label}: 1 dakika azalt`}>
          −
        </button>
      )}
      <input
        type="number"
        inputMode="decimal"
        min={0.5}
        max={60}
        step={0.5}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          if (e.target.value && Number(e.target.value) > 0) commit(e.target.value);
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label={label}
      />
      <span>dk</span>
      {steppers && (
        <button type="button" className="dur-step" onClick={() => onChange(clampSec(sec + 60))} disabled={sec >= MAX_SEC} aria-label={`${label}: 1 dakika artır`}>
          +
        </button>
      )}
    </span>
  );
}
