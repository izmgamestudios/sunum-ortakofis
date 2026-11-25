// client/src/components/ReportView.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { ReportInteract } from './Interact';
import { AiCoachTeaser } from './ComingSoon';
import { FreshBadges } from './ProgressView';
import { useApp } from '../store';
import type { Swot } from '../types';
import { buildReport, fmtDuration } from '../lib/report';
import { EMOTIONS } from '../lib/catalog';
import { downloadBlob, exportElementToPdf, exportJson, exportMarkdown, exportSnmtdz, slugify } from '../lib/io';
import { RecordingsSection, transcriptDocx } from './Recordings';
import { renderBoard } from './Whiteboard';
import { visibleElements } from '../lib/canvasGroups';
import { NOTE_KINDS } from './Panels';
import { BetaBadge, Logo } from './Header';

const SWOT_META: { key: keyof Swot; title: string; emoji: string; cls: string }[] = [
  { key: 'strengths', title: 'Güçlü yönler', emoji: '💪', cls: 's' },
  { key: 'weaknesses', title: 'Zayıf yönler', emoji: '🩹', cls: 'w' },
  { key: 'opportunities', title: 'Fırsatlar', emoji: '🚀', cls: 'o' },
  { key: 'threats', title: 'Tehditler', emoji: '⚠️', cls: 't' },
];

function ScoreRing({ value, label }: { value: number; label: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="score">
      <svg viewBox="0 0 80 80" width="80" height="80" aria-hidden>
        <circle cx="40" cy="40" r={r} className="score-bg" />
        <circle cx="40" cy="40" r={r} className="score-fg" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 40 40)" />
        <text x="40" y="46" textAnchor="middle" className="score-text">
          {value}
        </text>
      </svg>
      <span className="score-label">{label}</span>
    </div>
  );
}

function SwotBox({ meta, auto, custom, onChange }: { meta: (typeof SWOT_META)[number]; auto: string[]; custom: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('');
  const add = () => {
    if (!input.trim()) return;
    onChange([...custom, input.trim()]);
    setInput('');
  };
  return (
    <div className={`swot-box swot-${meta.cls}`}>
      <h3>
        {meta.emoji} {meta.title}
      </h3>
      <ul>
        {auto.map((t) => (
          <li key={t} className="swot-auto">
            {t}
          </li>
        ))}
        {custom.map((t, i) => (
          <li key={`${i}-${t}`}>
            {t}
            <button className="chip-x no-print" onClick={() => onChange(custom.filter((_, j) => j !== i))} aria-label="Sil">
              ✕
            </button>
          </li>
        ))}
        {!auto.length && !custom.length && <li className="muted">—</li>}
      </ul>
      <div className="row gap-s no-print">
        <input className="input input--sm" value={input} placeholder="Madde ekle…" onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn btn-sm" onClick={add}>
          ＋
        </button>
      </div>
    </div>
  );
}

export function ReportView() {
  const pres = useApp((s) => s.pres);
  const updatePres = useApp((s) => s.updatePres);
  const report = useMemo(() => buildReport(pres), [pres]);
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    Promise.all(pres.steps.map(async (s) => [s.id, s.canvas.length ? await renderBoard(visibleElements(s.canvas, s.groups), s.attachments, 640) : ''] as const)).then((pairs) => {
      if (alive) setThumbs(Object.fromEntries(pairs));
    });
    return () => {
      alive = false;
    };
  }, [pres.steps]);

  const hasRun = pres.run.steps.length > 0;
  const maxSec = Math.max(1, ...report.steps.map((s) => Math.max(s.plannedSec, s.actualSec ?? 0)));

  const pdf = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      await exportElementToPdf(ref.current, `${slugify(pres.title)}-rapor.pdf`);
    } catch (e) {
      alert(`PDF oluşturulamadı: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="report-wrap">
      <div className="export-bar no-print" data-anchor="report-export">
        <button className="btn btn-primary" onClick={pdf} disabled={busy}>
          {busy ? '⏳ PDF hazırlanıyor…' : '📄 PDF'}
        </button>
        <button className="btn" onClick={() => exportSnmtdz(pres)}>
          💾 .snmtdz
        </button>
        <button className="btn" onClick={() => exportJson(pres)}>
          🧾 JSON
        </button>
        <button className="btn" onClick={() => exportMarkdown(pres)}>
          📝 Markdown
        </button>
        {pres.transcript.length > 0 && (
          <button className="btn" onClick={() => downloadBlob(transcriptDocx(pres), `${slugify(pres.title)}-dokum.docx`)}>
            🎙️ Döküm .docx
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => window.print()}>
          🖨️ Yazdır
        </button>
      </div>

      <article ref={ref} className="report">
        <header className="report-head">
          <Logo small />
          <BetaBadge />
          <h1>{pres.title}</h1>
          <p className="muted">
            {pres.presenter && <>🎤 {pres.presenter} · </>}
            {pres.audience && <>👥 {pres.audience} · </>}
            📅 {new Date(pres.run.startedAt ?? pres.createdAt).toLocaleString('tr-TR')}
          </p>
        </header>

        {!hasRun && <p className="callout">ℹ️ Henüz sunum yapılmadı. Sunumu tamamladığında süre, etkileşim ve SWOT analizi burada oluşur.</p>}

        <FreshBadges />

        <section className="scores" data-anchor="report-scores">
          <ScoreRing value={report.overallScore} label="Genel" />
          <ScoreRing value={report.timeScore} label="Zaman" />
          <ScoreRing value={report.engagementScore} label="Etkileşim" />
          <ScoreRing value={report.contentScore} label="İçerik" />
        </section>

        {report.badges.length > 0 && (
          <section className="badges">
            {report.badges.map((b) => (
              <span key={b.label} className="badge">
                {b.emoji} {b.label}
              </span>
            ))}
          </section>
        )}

        <section className="kpis">
          <div className="kpi">
            <b>{fmtDuration(report.actualSec)}</b>
            <span>gerçekleşen / {fmtDuration(report.plannedSec)} plan</span>
          </div>
          <div className="kpi">
            <b>{report.breaksTaken}</b>
            <span>mola · {fmtDuration(report.breakSec)}</span>
          </div>
          <div className="kpi">
            <b>{pres.notes.length}</b>
            <span>not / alıntı</span>
          </div>
          <div className="kpi">
            <b>{pres.chat.length}</b>
            <span>sohbet · {report.questions} soru</span>
          </div>
          <div className="kpi">
            <b>{report.reactionTotal}</b>
            <span>tepki {report.topReaction ?? ''}</span>
          </div>
          <div className="kpi">
            <b>{pres.run.audiencePeak}</b>
            <span>zirve katılımcı</span>
          </div>
          {report.speech.segments > 0 && (
            <>
              <div className="kpi">
                <b>{report.speech.wpm ?? '—'}</b>
                <span>kelime/dk · {report.speech.words} kelime</span>
              </div>
              <div className="kpi">
                <b>%{(report.speech.fillerRate * 100).toFixed(1)}</b>
                <span>dolgu {report.speech.topFillers[0] ? `· “${report.speech.topFillers[0][0]}”` : ''}</span>
              </div>
              <div className="kpi">
                <b>{report.speech.autoMarked}</b>
                <span>otomatik işaretleme</span>
              </div>
            </>
          )}
        </section>

        <section data-anchor="report-time">
          <h2>⏱️ Adım adım zaman</h2>
          <div className="chart" role="img" aria-label="Planlanan ve gerçekleşen süreler">
            {report.steps.map((s) => (
              <div key={s.index} className="chart-row">
                <span className="chart-label truncate">
                  {s.index + 1}. {s.title}
                </span>
                <div className="chart-bars">
                  <span className="bar bar--plan" style={{ width: `${(s.plannedSec / maxSec) * 100}%` }} />
                  <span
                    className={`bar bar--actual ${s.deviationPct != null && s.deviationPct > 15 ? 'is-over' : ''}`}
                    style={{ width: `${((s.actualSec ?? 0) / maxSec) * 100}%` }}
                  />
                </div>
                <span className="chart-val">
                  {s.actualSec != null ? fmtDuration(s.actualSec) : '—'} / {fmtDuration(s.plannedSec)}
                  {s.deviationPct != null && (
                    <em className={s.deviationPct > 15 ? 'over' : s.deviationPct < -30 ? 'under' : 'ok'}>
                      {s.deviationPct > 0 ? '+' : ''}
                      {s.deviationPct}%
                    </em>
                  )}
                </span>
              </div>
            ))}
          </div>
          <p className="legend small muted">
            <span className="lg lg--plan" /> Plan <span className="lg lg--actual" /> Gerçekleşen
          </p>
        </section>

        <section data-anchor="report-swot">
          <h2>🧩 SWOT analizi</h2>
          <p className="muted small">Otomatik maddeler sunum verisinden üretilir (italik); kendi maddelerini de ekleyebilirsin.</p>
          <div className="swot">
            {SWOT_META.map((m) => (
              <SwotBox
                key={m.key}
                meta={m}
                auto={report.autoSwot[m.key]}
                custom={pres.swot[m.key]}
                onChange={(v) => updatePres((p) => ({ swot: { ...p.swot, [m.key]: v } }))}
              />
            ))}
          </div>
        </section>

        <section data-anchor="report-steps">
          <h2>📚 Adım detayları</h2>
          <div className="step-cards">
            {report.steps.map((s) => {
              const st = pres.steps[s.index];
              return (
                <div key={s.index} className="step-card">
                  <h3>
                    <span className="step-num">{s.index + 1}</span> {s.title}
                  </h3>
                  {s.roleplay && (
                    <p className="small" title={s.emotion ? EMOTIONS[s.emotion].label : undefined}>
                      {s.roleplay}
                    </p>
                  )}
                  {st.text && <p className="step-text">{st.text}</p>}
                  {thumbs[st.id] && <img className="thumb" src={thumbs[st.id]} alt={`${s.index + 1}. adım tuvali`} />}
                  <ul className="mini-stats small">
                    {s.wordsTotal > 0 && (
                      <li>
                        🎱 {s.wordsDrawn}/{s.wordsTotal} çekildi · {s.wordsMarked} bağlandı
                      </li>
                    )}
                    {s.nodesTotal > 0 && (
                      <li>
                        🌳 {s.nodesVisited}/{s.nodesTotal} başlık işlendi
                      </li>
                    )}
                    {st.attachments.length > 0 && <li>🗂️ {st.attachments.length} medya</li>}
                    <li>
                      📝 {s.notes} not · 💬 {s.chat} mesaj
                    </li>
                  </ul>
                  {st.drawnWords.length > 0 && <p className="small muted">Kelimeler: {st.drawnWords.join(', ')}</p>}
                </div>
              );
            })}
          </div>
        </section>

        {pres.notes.length > 0 && (
          <section data-anchor="report-notes">
            <h2>📝 Notlar & alıntılar</h2>
            <ul className="note-list note-list--report">
              {pres.notes.map((n) => (
                <li key={n.id} className={`note note--${n.kind}`}>
                  <span className="note-meta">
                    {NOTE_KINDS[n.kind].emoji} {fmtDuration(n.at / 1000)} · A{n.stepIndex + 1}
                  </span>
                  <span className="note-text">{n.text}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {pres.chat.length > 0 && (
          <section data-anchor="report-chat">
            <h2>💬 Anonim sohbet dökümü</h2>
            <div className="chat-list chat-list--report">
              {pres.chat.map((m) => (
                <div key={m.id} className={`msg ${m.fromPresenter ? 'msg--me' : ''}`}>
                  <span className="msg-name">
                    {m.name} · A{m.stepIndex + 1}
                  </span>
                  <span className="msg-text">{m.text}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="no-print"><AiCoachTeaser variant="report" /></div>

        <ReportInteract pres={pres} />

        <RecordingsSection />

        {pres.transcript.length > 0 && (
          <section data-anchor="report-transcript">
            <h2>🎙️ Konuşma dökümü</h2>
            {pres.steps.map((st, i) => {
              const segs = pres.transcript.filter((t) => t.stepIndex === i);
              if (!segs.length) return null;
              return (
                <div key={st.id} className="transcript-block">
                  <h3 className="small">
                    {i + 1}. {st.title}
                  </h3>
                  <p className="transcript-text">
                    {segs.map((t) => (
                      <span key={t.id} className={t.matches.length ? 'has-match' : ''} title={t.matches.join(', ')}>
                        {t.text}{' '}
                      </span>
                    ))}
                  </p>
                </div>
              );
            })}
          </section>
        )}

        <section data-anchor="report-reflection">
          <h2>🪞 Öz değerlendirme</h2>
          <textarea
            className="input textarea"
            rows={4}
            value={pres.reflection}
            placeholder="Bir dahaki sefere neyi farklı yapacaksın?"
            onChange={(e) => updatePres({ reflection: e.target.value })}
          />
        </section>
        <footer className="report-foot muted small">Teknodoz Sunum · Beta Erken Erişim</footer>
      </article>
    </main>
  );
}
