// client/src/components/SetupView.tsx
import { useState } from 'react';
import { useApp } from '../store';
import type { BreakActivity, BreakConfig, Step, TopicMode } from '../types';
import { MAX_STEPS } from '../lib/factory';
import { BREAK_ACTIVITIES } from '../lib/catalog';
import { fmtDuration } from '../lib/report';
import { RoleplaySettings } from './Roleplay';
import { MediaPanel } from './Media';
import { Whiteboard } from './Whiteboard';
import { TombalaEditor, TreeEditor } from './Topics';
import { BetaBadge, Logo } from './Header';

type EditorTab = 'text' | 'media' | 'canvas' | 'flow';

function BreakSettings({ value, onChange }: { value: BreakConfig; onChange: (v: BreakConfig) => void }) {
  const toggleAct = (a: BreakActivity) =>
    onChange({ ...value, activities: value.activities.includes(a) ? value.activities.filter((x) => x !== a) : [...value.activities, a] });
  return (
    <div className="stack">
      <div className="seg-control" role="radiogroup" aria-label="Geçiş modu">
        {(
          [
            ['none', '⏭️ Geçiş yok'],
            ['manual', '✋ Manuel bekle'],
            ['auto', '⏱️ Otomatik'],
          ] as const
        ).map(([m, l]) => (
          <button key={m} role="radio" aria-checked={value.mode === m} className={value.mode === m ? 'is-active' : ''} onClick={() => onChange({ ...value, mode: m })}>
            {l}
          </button>
        ))}
      </div>
      {value.mode === 'auto' && (
        <div className="seg-control" role="radiogroup" aria-label="Geçiş süresi">
          {([15, 30, 45, 60] as const).map((s) => (
            <button key={s} role="radio" aria-checked={value.autoSeconds === s} className={value.autoSeconds === s ? 'is-active' : ''} onClick={() => onChange({ ...value, autoSeconds: s })}>
              {s} sn
            </button>
          ))}
        </div>
      )}
      {value.mode !== 'none' && (
        <>
          <div className="pill-grid">
            {(Object.keys(BREAK_ACTIVITIES) as BreakActivity[]).map((a) => (
              <button key={a} className={`pill ${value.activities.includes(a) ? 'is-active' : ''}`} onClick={() => toggleAct(a)} aria-pressed={value.activities.includes(a)}>
                {BREAK_ACTIVITIES[a].emoji} {BREAK_ACTIVITIES[a].label}
              </button>
            ))}
          </div>
          <div className="seg-control" role="radiogroup" aria-label="Aktivite sırası">
            <button className={value.order === 'cycle' ? 'is-active' : ''} onClick={() => onChange({ ...value, order: 'cycle' })}>
              🔁 Sırayla
            </button>
            <button className={value.order === 'random' ? 'is-active' : ''} onClick={() => onChange({ ...value, order: 'random' })}>
              🎲 Rastgele
            </button>
          </div>
          {value.mode === 'auto' && value.activities.includes('breathing') && value.autoSeconds < 24 && (
            <p className="muted small">ℹ️ Nefes egzersizi 2 tur = 24 sn; bu molalar otomatik 24 sn’ye uzatılır.</p>
          )}
        </>
      )}
    </div>
  );
}

function StepEditor({ index, step }: { index: number; step: Step }) {
  const updateStep = useApp((s) => s.updateStep);
  const [tab, setTab] = useState<EditorTab>('text');
  const patch = (p: Partial<Step>) => updateStep(index, p);
  return (
    <div className="card step-editor">
      <div className="step-editor-head">
        <span className="step-num">{index + 1}</span>
        <input className="input input--title" value={step.title} onChange={(e) => patch({ title: e.target.value })} aria-label="Adım başlığı" />
        <label className="duration-input" title="Süre (dakika)">
          <input
            type="number"
            min={0.5}
            max={60}
            step={0.5}
            value={step.durationSec / 60}
            onChange={(e) => patch({ durationSec: Math.max(30, Math.min(3600, Math.round(Number(e.target.value) * 60) || 60)) })}
            aria-label="Süre (dakika)"
          />
          <span>dk</span>
        </label>
      </div>
      <div className="subtabs" role="tablist">
        {(
          [
            ['text', '✍️ Metin'],
            ['media', `🗂️ Medya${step.attachments.length ? ` (${step.attachments.length})` : ''}`],
            ['canvas', '🎨 Tuval'],
            ['flow', '🧭 Konu akışı'],
          ] as const
        ).map(([t, l]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`subtab ${tab === t ? 'is-active' : ''}`} onClick={() => setTab(t)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'text' && (
        <textarea
          className="input textarea"
          rows={8}
          value={step.text}
          placeholder="Bu adımda anlatacakların, ana mesaj, konuşma notları…"
          onChange={(e) => patch({ text: e.target.value })}
        />
      )}
      {tab === 'media' && <MediaPanel attachments={step.attachments} onChange={(attachments) => patch({ attachments })} />}
      {tab === 'canvas' && <Whiteboard elements={step.canvas} attachments={step.attachments} onChange={(canvas) => patch({ canvas })} title={`adim-${index + 1}`} />}
      {tab === 'flow' && (
        <div className="stack">
          <div className="seg-control" role="radiogroup" aria-label="Konu akışı">
            {(
              [
                ['free', '💬 Serbest'],
                ['tombala', '🎱 Kelime tombalası'],
                ['tree', '🌳 Konu ağacı'],
              ] as [TopicMode, string][]
            ).map(([m, l]) => (
              <button key={m} role="radio" aria-checked={step.topicMode === m} className={step.topicMode === m ? 'is-active' : ''} onClick={() => patch({ topicMode: m })}>
                {l}
              </button>
            ))}
          </div>
          {step.topicMode === 'free' && <p className="muted small">Serbest akış: metin ve tuval üzerinden ilerlersin.</p>}
          {step.topicMode === 'tombala' && <TombalaEditor step={step} onChange={patch} />}
          {step.topicMode === 'tree' && <TreeEditor step={step} onChange={patch} />}
        </div>
      )}
    </div>
  );
}

export function SetupView() {
  const pres = useApp((s) => s.pres);
  const live = useApp((s) => s.live);
  const updatePres = useApp((s) => s.updatePres);
  const setStepCount = useApp((s) => s.setStepCount);
  const resetDurations = useApp((s) => s.resetDurations);
  const start = useApp((s) => s.start);
  const setView = useApp((s) => s.setView);
  const [active, setActive] = useState(0);
  const idx = Math.min(active, pres.steps.length - 1);
  const total = pres.steps.reduce((a, s) => a + s.durationSec, 0);
  const breakCount = pres.breakConfig.mode === 'none' ? 0 : pres.steps.length - 1;
  const maxDur = Math.max(...pres.steps.map((s) => s.durationSec));
  const isLive = live.phase === 'step' || live.phase === 'break';

  return (
    <main className="setup">
      <section className="hero">
        <Logo />
        <BetaBadge />
        <input className="input hero-title" value={pres.title} onChange={(e) => updatePres({ title: e.target.value })} aria-label="Sunum başlığı" />
        <div className="row gap-s wrap center">
          <input className="input" style={{ maxWidth: 240 }} placeholder="Sunan kişi" value={pres.presenter} onChange={(e) => updatePres({ presenter: e.target.value })} />
          <input className="input" style={{ maxWidth: 240 }} placeholder="Hedef kitle" value={pres.audience} onChange={(e) => updatePres({ audience: e.target.value })} />
        </div>
      </section>

      <div className="setup-grid">
        <aside className="stack">
          <div className="card">
            <h2 className="card-title">⏳ Adım sayısı</h2>
            <div className="count-picker" role="radiogroup" aria-label="Adım sayısı">
              {Array.from({ length: MAX_STEPS }, (_, i) => i + 1).map((n) => (
                <button key={n} role="radio" aria-checked={pres.steps.length === n} className={pres.steps.length === n ? 'is-active' : ''} onClick={() => setStepCount(n)}>
                  {n}
                </button>
              ))}
            </div>
            <ol className="timeline">
              {pres.steps.map((s, i) => (
                <li key={s.id}>
                  <button className={`timeline-row ${i === idx ? 'is-active' : ''}`} onClick={() => setActive(i)}>
                    <span className="timeline-num">{i + 1}</span>
                    <span className="timeline-title truncate">{s.title}</span>
                    <span className="timeline-bar">
                      <span style={{ width: `${(s.durationSec / maxDur) * 100}%` }} />
                    </span>
                    <span className="timeline-min">{fmtDuration(s.durationSec)}</span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="muted small">
              Toplam konuşma: <b>{fmtDuration(total)}</b>
              {breakCount > 0 && ` · ${breakCount} geçiş molası`}
            </p>
            <button className="btn btn-ghost btn-sm" onClick={resetDurations}>
              ↺ Süreleri 1-2-3… dk yap
            </button>
          </div>

          <div className="card">
            <h2 className="card-title">🫁 Adımlar arası geçiş</h2>
            <BreakSettings value={pres.breakConfig} onChange={(breakConfig) => updatePres({ breakConfig })} />
          </div>

          <div className="card">
            <h2 className="card-title">🎭 Sunum şekli</h2>
            <RoleplaySettings value={pres.roleplay} onChange={(roleplay) => updatePres({ roleplay })} />
          </div>

          <div className="card">
            <label className="switch">
              <input type="checkbox" checked={pres.autoAdvance} onChange={(e) => updatePres({ autoAdvance: e.target.checked })} />
              <span>⏭️ Süre bitince otomatik sonraki adıma geç</span>
            </label>
          </div>
        </aside>

        <section className="stack">
          <StepEditor key={pres.steps[idx].id} index={idx} step={pres.steps[idx]} />
        </section>
      </div>

      <div className="start-bar">
        {isLive ? (
          <button className="btn btn-primary btn-lg" onClick={() => setView('live')}>
            ↩︎ Sunuma dön
          </button>
        ) : null}
        <button
          className="btn btn-primary btn-lg"
          onClick={() => (!isLive || confirm('Devam eden sunum sıfırlanıp baştan başlasın mı?')) && start()}
        >
          ▶ {isLive ? 'Baştan başlat' : 'Sunumu başlat'}
        </button>
      </div>
    </main>
  );
}
