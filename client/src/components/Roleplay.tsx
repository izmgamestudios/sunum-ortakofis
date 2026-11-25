// client/src/components/Roleplay.tsx
import type { Emotion, RoleplayConfig, Setting, TimeOfDay, Tone } from '../types';
import { CROWD, EMOTIONS, randomRoleplay, roleplaySentence, roleplayTips, SETTINGS, TIMES, TONES } from '../lib/catalog';

interface Props {
  value: RoleplayConfig;
  onChange: (v: RoleplayConfig) => void;
}

export function RoleplaySettings({ value, onChange }: Props) {
  const set = <K extends keyof RoleplayConfig>(k: K, v: RoleplayConfig[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="stack">
      <label className="switch">
        <input type="checkbox" checked={value.enabled} onChange={(e) => set('enabled', e.target.checked)} />
        <span>🎭 Rol yapma / drama modu</span>
      </label>
      {value.enabled && (
        <>
          <fieldset className="fs">
            <legend>Duygu</legend>
            <div className="pill-grid">
              {(Object.keys(EMOTIONS) as Emotion[]).map((e) => (
                <button key={e} className={`pill ${value.emotion === e ? 'is-active' : ''}`} style={{ ['--pill' as string]: EMOTIONS[e].color }} onClick={() => set('emotion', e)}>
                  {EMOTIONS[e].emoji} {EMOTIONS[e].label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="fs">
            <legend>Ton</legend>
            <div className="pill-grid">
              {(Object.keys(TONES) as Tone[]).map((t) => (
                <button key={t} className={`pill ${value.tone === t ? 'is-active' : ''}`} onClick={() => set('tone', t)}>
                  {TONES[t].label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="fs">
            <legend>Mekân / ortam</legend>
            <div className="pill-grid">
              {(Object.keys(SETTINGS) as Setting[]).map((s) => (
                <button key={s} className={`pill ${value.setting === s ? 'is-active' : ''}`} onClick={() => set('setting', s)}>
                  {SETTINGS[s].emoji} {SETTINGS[s].label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="fs">
            <legend>Zaman</legend>
            <div className="pill-grid">
              {(Object.keys(TIMES) as TimeOfDay[]).map((t) => (
                <button key={t} className={`pill ${value.timeOfDay === t ? 'is-active' : ''}`} onClick={() => set('timeOfDay', t)}>
                  {TIMES[t].emoji} {TIMES[t].label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="fs">
            <legend>
              Kalabalık: <b>{CROWD[value.crowd]}</b>
            </legend>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={value.crowd}
              onChange={(e) => set('crowd', Number(e.target.value) as RoleplayConfig['crowd'])}
              aria-label="Kalabalık seviyesi"
              className="full"
            />
          </fieldset>
          <label className="switch">
            <input type="checkbox" checked={value.randomizePerStep} onChange={(e) => set('randomizePerStep', e.target.checked)} />
            <span>🎲 Her adımda senaryo zarı at (rastgele duygu/ortam)</span>
          </label>
          <div className="row gap-s wrap">
            <button className="btn btn-ghost" onClick={() => onChange({ ...randomRoleplay(value), enabled: true })}>
              🎲 Şimdi rastgele seç
            </button>
          </div>
          <RoleplayCard rp={value} />
        </>
      )}
    </div>
  );
}

export function RoleplayCard({ rp, onReroll, compact = false }: { rp: RoleplayConfig; onReroll?: () => void; compact?: boolean }) {
  const e = EMOTIONS[rp.emotion];
  return (
    <div className={`rp-card ${compact ? 'rp-card--compact' : ''}`} style={{ ['--rp' as string]: e.color }}>
      <div className="rp-emoji" aria-hidden>
        {e.emoji}
      </div>
      <div className="rp-body">
        <p className="rp-sentence">{roleplaySentence(rp)}</p>
        {!compact && (
          <ul className="rp-tips">
            {roleplayTips(rp).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
      </div>
      {onReroll && (
        <button className="icon-btn" onClick={onReroll} title="Yeni senaryo zarı" aria-label="Yeni senaryo">
          🎲
        </button>
      )}
    </div>
  );
}
