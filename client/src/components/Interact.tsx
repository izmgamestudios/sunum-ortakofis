// client/src/components/Interact.tsx — questions editor, jury setup, live poll / jury panels, result charts, report sections
import { useEffect, useState } from 'react';
import type { JuryConfig, PollResult, Presentation, Question } from '../types';
import { useApp } from '../store';
import { useRoom } from '../lib/room';
import { parseEmails } from '../lib/auth';
import { closePoll, defaultJury, newPin, newQuestion, openPoll, QUESTION_KINDS, resetBoard, syncJury, useInteract, type BoardRow, type Tally } from '../lib/interact';

/* ------------------------------------------------------------------ */
/* Result charts (presenter, audience, report)                        */
/* ------------------------------------------------------------------ */
export function ResultView({ kind, options, data, correct }: { kind: Question['kind']; options: string[]; data: Pick<Tally, 'total' | 'counts' | 'average' | 'words' | 'texts'>; correct?: number | null }) {
  if (kind === 'cloud') {
    const max = Math.max(1, ...data.words.map((w) => w[1]));
    return (
      <div className="word-cloud-live" aria-label="Kelime bulutu">
        {data.words.length ? (
          data.words.map(([w, n], i) => (
            <span key={w} style={{ fontSize: `${0.9 + (n / max) * 1.6}rem`, opacity: 0.55 + (n / max) * 0.45, color: `hsl(${(i * 47) % 360} 70% 45%)` }}>
              {w}
            </span>
          ))
        ) : (
          <span className="muted small">Henüz kelime yok</span>
        )}
      </div>
    );
  }
  if (kind === 'open')
    return (
      <ul className="open-answers">
        {data.texts.length ? data.texts.map((t, i) => <li key={i}>💬 {t}</li>) : <li className="muted small">Henüz yanıt yok</li>}
      </ul>
    );
  const max = Math.max(1, ...data.counts);
  return (
    <div className="poll-bars">
      {options.map((o, i) => (
        <div key={i} className={`poll-bar ${correct === i ? 'is-correct' : ''} ${correct != null && correct !== i ? 'is-wrong' : ''}`}>
          <span className="poll-bar-label">
            {correct === i && '✅ '}
            {o}
          </span>
          <span className="poll-bar-track">
            <span style={{ width: `${(data.counts[i] / max) * 100}%` }} />
          </span>
          <b className="poll-bar-n">
            {data.counts[i] ?? 0}
            <small className="muted"> · %{data.total ? Math.round(((data.counts[i] ?? 0) / data.total) * 100) : 0}</small>
          </b>
        </div>
      ))}
      {kind === 'scale' && data.average != null && <p className="poll-avg">Ortalama: ⭐ {data.average} / 5</p>}
    </div>
  );
}

export function Leaderboard({ rows, you }: { rows: BoardRow[]; you?: string }) {
  if (!rows.length) return null;
  const podium = rows.slice(0, 3);
  return (
    <div className="leaderboard">
      <div className="podium">
        {[1, 0, 2].map((i) =>
          podium[i] ? (
            <div key={i} className={`podium-col p${i + 1}`}>
              <span className="podium-medal">{['🥇', '🥈', '🥉'][i]}</span>
              <b className="truncate">{podium[i].name}</b>
              <small>{podium[i].points} puan</small>
              <span className="podium-block">{i + 1}</span>
            </div>
          ) : null,
        )}
      </div>
      <ol className="board-list" start={4}>
        {rows.slice(3).map((r) => (
          <li key={r.rank} className={r.name === you ? 'is-you' : ''}>
            <span>{r.name}</span>
            <b>{r.points}</b>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Setup: questions of a step                                          */
/* ------------------------------------------------------------------ */
export function QuestionEditor({ questions, onChange }: { questions: Question[]; onChange: (q: Question[]) => void }) {
  const set = (i: number, p: Partial<Question>) => onChange(questions.map((q, j) => (j === i ? { ...q, ...p } : q)));
  return (
    <div className="stack q-editor">
      <p className="muted small">Canlı sunumda 📊 Etkileşim panelinden başlatırsın; izleyiciler oda koduyla telefonlarından yanıt verir, sonuçlar anında görünür.</p>
      {questions.map((q, i) => (
        <fieldset key={q.id} className="fs q-item">
          <legend>
            {QUESTION_KINDS[q.kind].icon} {QUESTION_KINDS[q.kind].label}
          </legend>
          <div className="row gap-s">
            <input className="input" value={q.text} placeholder="Soru metni" onChange={(e) => set(i, { text: e.target.value })} aria-label="Soru metni" />
            <button className="icon-btn icon-btn--ghost" onClick={() => onChange(questions.filter((_, j) => j !== i))} aria-label="Soruyu sil">
              🗑️
            </button>
          </div>
          {(q.kind === 'choice' || q.kind === 'quiz') && (
            <div className="stack q-options">
              {q.options.map((o, k) => (
                <div key={k} className="row gap-s">
                  {q.kind === 'quiz' && (
                    <input type="radio" name={`correct-${q.id}`} checked={q.correct === k} onChange={() => set(i, { correct: k })} aria-label={`Doğru cevap: ${k + 1}. seçenek`} title="Doğru cevap" />
                  )}
                  <input className="input" value={o} placeholder={`${k + 1}. seçenek`} onChange={(e) => set(i, { options: q.options.map((x, m) => (m === k ? e.target.value : x)) })} aria-label={`${k + 1}. seçenek`} />
                  {q.options.length > 2 && (
                    <button className="icon-btn icon-btn--ghost" onClick={() => set(i, { options: q.options.filter((_, m) => m !== k), correct: q.correct === k ? 0 : q.correct && q.correct > k ? q.correct - 1 : q.correct })} aria-label="Seçeneği sil">
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <div className="row gap-s wrap">
                {q.options.length < 8 && (
                  <button className="btn btn-sm btn-ghost" onClick={() => set(i, { options: [...q.options, ''] })}>
                    ＋ Seçenek
                  </button>
                )}
                {q.kind === 'quiz' && (
                  <label className="small row gap-s">
                    ⏱️ Süre
                    <input className="input q-time" type="number" min={5} max={120} value={q.timeLimit ?? 20} onChange={(e) => set(i, { timeLimit: Math.max(5, Math.min(120, Number(e.target.value) || 20)) })} /> sn
                  </label>
                )}
              </div>
              {q.kind === 'quiz' && <p className="muted small">Doğru cevabı soldaki daireyle işaretle. Doğru + hızlı cevap daha çok puan (en fazla 1000).</p>}
            </div>
          )}
        </fieldset>
      ))}
      <div className="row gap-s wrap">
        {(Object.keys(QUESTION_KINDS) as Question['kind'][]).map((k) => (
          <button key={k} className="btn btn-sm" onClick={() => onChange([...questions, newQuestion(k)])} title={QUESTION_KINDS[k].hint}>
            ＋ {QUESTION_KINDS[k].icon} {QUESTION_KINDS[k].label}
          </button>
        ))}
      </div>
    </div>
  );
}

const validQuestion = (q: Question) => q.text.trim() && (q.kind !== 'choice' && q.kind !== 'quiz' ? true : q.options.filter((o) => o.trim()).length >= 2);
const cleanQ = (q: Question): Question => ({ ...q, options: q.options.map((o) => o.trim()).filter(Boolean) });

/* ------------------------------------------------------------------ */
/* Setup: pitch-day jury                                               */
/* ------------------------------------------------------------------ */
export function JuryEditor() {
  const pres = useApp((s) => s.pres);
  const updatePres = useApp((s) => s.updatePres);
  const jury: JuryConfig = pres.jury ?? { ...defaultJury(), enabled: false };
  const set = (p: Partial<JuryConfig>) => updatePres({ jury: { ...jury, ...p } });
  const [draft, setDraft] = useState('');
  const [bad, setBad] = useState<string[]>([]);
  const addEmails = () => {
    const { valid, invalid } = parseEmails(draft);
    setBad(invalid);
    set({ emails: [...new Set([...jury.emails, ...valid])] });
    setDraft(invalid.join(', '));
  };
  return (
    <div className="stack">
      <label className="switch">
        <input type="checkbox" checked={jury.enabled} onChange={(e) => (e.target.checked && !pres.jury ? updatePres({ jury: defaultJury() }) : set({ enabled: e.target.checked }))} />
        <span>🏆 Pitch günü: her adım bir takımın pitch’i, jüri puanlar</span>
      </label>
      {jury.enabled && (
        <>
          <p className="muted small">Adım başlıklarını takım / girişim adı yap. Jüri her adımı aşağıdaki kriterlere 1–10 puan verir; ağırlıklı ortalamayla canlı sıralama çıkar.</p>
          <div className="jury-criteria">
            {jury.criteria.map((c, i) => (
              <div key={c.id} className="row gap-s">
                <input className="input" value={c.label} onChange={(e) => set({ criteria: jury.criteria.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} aria-label="Kriter" />
                <label className="small row gap-s" title="Ağırlık">
                  ×
                  <input className="input q-time" type="number" min={0} max={10} step={0.5} value={c.weight} onChange={(e) => set({ criteria: jury.criteria.map((x, j) => (j === i ? { ...x, weight: Math.max(0, Math.min(10, Number(e.target.value) || 0)) } : x)) })} aria-label={`${c.label} ağırlığı`} />
                </label>
                {jury.criteria.length > 1 && (
                  <button className="icon-btn icon-btn--ghost" onClick={() => set({ criteria: jury.criteria.filter((_, j) => j !== i) })} aria-label="Kriteri sil">
                    ✕
                  </button>
                )}
              </div>
            ))}
            {jury.criteria.length < 10 && (
              <button className="btn btn-sm btn-ghost" onClick={() => set({ criteria: [...jury.criteria, { id: `k${Date.now().toString(36)}`, label: 'Yeni kriter', weight: 1 }] })}>
                ＋ Kriter
              </button>
            )}
          </div>
          <fieldset className="fs">
            <legend>🔢 PIN ile jüri girişi</legend>
            <div className="row gap-s wrap">
              <input className="input jury-pin" value={jury.pin} inputMode="numeric" maxLength={8} placeholder="kapalı" onChange={(e) => set({ pin: e.target.value.replace(/\D/g, '').slice(0, 8) })} aria-label="Jüri PIN" />
              <button className="btn btn-sm" onClick={() => set({ pin: newPin() })}>
                🎲 Yeni PIN
              </button>
              {jury.pin && (
                <button className="btn btn-sm btn-ghost" onClick={() => set({ pin: '' })}>
                  Kapat
                </button>
              )}
            </div>
            <p className="muted small">Jüri, izleyici sayfasından oda kodu + bu PIN ile girer. Boş bırakırsan PIN girişi kapanır.</p>
          </fieldset>
          <fieldset className="fs">
            <legend>📧 E-postayla davetli jüri ({jury.emails.length})</legend>
            <div className="row gap-s">
              <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addEmails()} placeholder="juri@ornek.com — toplu yapıştırabilirsin" aria-label="Jüri e-postaları" />
              <button className="btn btn-sm" onClick={addEmails} disabled={!draft.trim()}>
                ＋ Ekle
              </button>
            </div>
            {bad.length > 0 && <p className="error small">Geçersiz: {bad.join(', ')}</p>}
            {jury.emails.length > 0 && (
              <ul className="invite-list">
                {jury.emails.map((e) => (
                  <li key={e}>
                    <span className="truncate">{e}</span>
                    <span />
                    <button className="icon-btn icon-btn--ghost" onClick={() => set({ emails: jury.emails.filter((x) => x !== e) })} aria-label={`${e} kaldır`}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted small">Davetli jüri, izleyici sayfasında “E-postayla jüri girişi”ni seçip kendine gelen kodla girer. PIN ve e-posta birlikte kullanılabilir.</p>
          </fieldset>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live: poll / quiz panel                                             */
/* ------------------------------------------------------------------ */
function Countdown({ endsAt }: { endsAt: number }) {
  const [, t] = useState(0);
  useEffect(() => {
    const i = setInterval(() => t((x) => x + 1), 250);
    return () => clearInterval(i);
  }, []);
  const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  return <span className={`poll-countdown ${left <= 5 ? 'is-low' : ''}`}>⏱️ {left} sn</span>;
}

export function LivePollPanel({ stepIndex }: { stepIndex: number }) {
  const step = useApp((s) => s.pres.steps[stepIndex]);
  const updateStep = useApp((s) => s.updateStep);
  const code = useRoom((s) => s.code);
  const { active, tally, last, board, error } = useInteract();
  const [adding, setAdding] = useState(false);
  const questions = step.questions ?? [];
  const startable = questions.filter(validQuestion);
  return (
    <div className="stack live-poll">
      {error && <p className="error small">{error}</p>}
      {code ? (
        <p className="small muted">
          📡 Oda kodu <b className="room-code-inline">{code}</b> — izleyiciler {window.location.host}/?join={code}
        </p>
      ) : (
        <p className="small muted">Soruyu başlatınca canlı oda otomatik açılır.</p>
      )}

      {active ? (
        <section className="card poll-live">
          <header className="row gap-s wrap" style={{ justifyContent: 'space-between' }}>
            <b>
              {QUESTION_KINDS[active.kind].icon} {active.text}
            </b>
            <span className="row gap-s">
              {active.endsAt && <Countdown endsAt={active.endsAt} />}
              <span className="stat-chip">🗳️ {tally?.total ?? 0}</span>
            </span>
          </header>
          {active.kind === 'quiz' ? (
            <p className="muted small">Cevaplar süre bitince gösterilir.</p>
          ) : (
            tally && <ResultView kind={active.kind} options={active.options} data={tally} />
          )}
          <button className="btn btn-primary" onClick={closePoll}>
            ⏹ Bitir ve sonuçları göster
          </button>
        </section>
      ) : last ? (
        <section className="card poll-live">
          <b>
            {QUESTION_KINDS[last.kind].icon} {last.text} <small className="muted">· {last.total} yanıt</small>
          </b>
          <ResultView kind={last.kind} options={last.options} data={last} correct={last.correct} />
          {last.board && <Leaderboard rows={last.board} />}
          <button className="btn btn-sm btn-ghost" onClick={() => useInteract.setState({ last: null })}>
            Kapat
          </button>
        </section>
      ) : null}

      <div className="stack">
        <h4 className="section-title">Bu adımın soruları</h4>
        {startable.length === 0 && <p className="muted small">Bu adımda soru yok — aşağıdan hemen ekle ya da Hazırlık → adım → 📊 Etkileşim.</p>}
        {startable.map((q) => (
          <div key={q.id} className="q-row">
            <span className="truncate">
              {QUESTION_KINDS[q.kind].icon} {q.text}
            </span>
            <button className="btn btn-sm btn-primary" onClick={() => void openPoll(cleanQ(q))} disabled={active?.id === q.id}>
              {active?.id === q.id ? '● Açık' : '▶ Başlat'}
            </button>
          </div>
        ))}
        {adding ? (
          <QuestionEditor questions={questions} onChange={(qs) => updateStep(stepIndex, { questions: qs })} />
        ) : (
          <button className="btn btn-sm btn-ghost" onClick={() => setAdding(true)}>
            ＋ Soru ekle / düzenle
          </button>
        )}
      </div>

      {board.length > 0 && !last?.board && (
        <section className="stack">
          <h4 className="section-title">🏆 Quiz puan tablosu</h4>
          <Leaderboard rows={board} />
          <button className="btn btn-sm btn-ghost" onClick={() => confirm('Puan tablosu sıfırlansın mı?') && resetBoard()}>
            ↺ Puanları sıfırla
          </button>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live: jury panel                                                    */
/* ------------------------------------------------------------------ */
export function JuryRanking({ pres, rows }: { pres: Presentation; rows: { stepIndex: number; avg: Record<string, number>; total: number; jurors: number; comments: { name: string; text: string }[] }[] }) {
  const criteria = pres.jury?.criteria ?? [];
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  if (!sorted.length) return <p className="muted small">Henüz puan yok.</p>;
  return (
    <div className="stack">
      <div className="podium">
        {[1, 0, 2].map((i) =>
          sorted[i] ? (
            <div key={i} className={`podium-col p${i + 1}`}>
              <span className="podium-medal">{['🥇', '🥈', '🥉'][i]}</span>
              <b className="truncate">{pres.steps[sorted[i].stepIndex]?.title ?? `${sorted[i].stepIndex + 1}. adım`}</b>
              <small>{sorted[i].total.toFixed(2)} / 10</small>
              <span className="podium-block">{i + 1}</span>
            </div>
          ) : null,
        )}
      </div>
      <div className="table-wrap">
        <table className="jury-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Takım / pitch</th>
              {criteria.map((c) => (
                <th key={c.id}>
                  {c.label}
                  {c.weight !== 1 && <small> ×{c.weight}</small>}
                </th>
              ))}
              <th>Toplam</th>
              <th>Jüri</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.stepIndex}>
                <td>{i + 1}</td>
                <td>{pres.steps[r.stepIndex]?.title ?? `${r.stepIndex + 1}. adım`}</td>
                {criteria.map((c) => (
                  <td key={c.id}>{r.avg[c.id]?.toFixed(1) ?? '–'}</td>
                ))}
                <td>
                  <b>{r.total.toFixed(2)}</b>
                </td>
                <td>{r.jurors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sorted.some((r) => r.comments.length) && (
        <details>
          <summary>💬 Jüri yorumları</summary>
          {sorted.map((r) =>
            r.comments.length ? (
              <div key={r.stepIndex} className="small">
                <b>{pres.steps[r.stepIndex]?.title}</b>
                <ul>
                  {r.comments.map((c, k) => (
                    <li key={k}>
                      <i>{c.name}:</i> {c.text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </details>
      )}
    </div>
  );
}

export function JuryPanel() {
  const pres = useApp((s) => s.pres);
  const stepIndex = useApp((s) => s.live.stepIndex);
  const code = useRoom((s) => s.code);
  const jury = useInteract((s) => s.jury);
  const error = useInteract((s) => s.error);
  useEffect(() => {
    void syncJury();
  }, [pres.jury?.pin, pres.jury?.emails.length, pres.jury?.criteria.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pres.jury?.enabled) return <p className="muted">Jüri modu kapalı. Hazırlık → 🏆 Pitch günü jürisi’nden aç.</p>;
  const current = jury?.byStep.find((r) => r.stepIndex === stepIndex);
  return (
    <div className="stack jury-panel">
      {error && <p className="error small">{error}</p>}
      <div className="jury-access">
        <p className="small">
          ⚖️ Jüri girişi: <b>{window.location.host}/?join={code ?? '…'}</b> → “Jüri girişi”
        </p>
        <div className="row gap-s wrap">
          {pres.jury.pin && (
            <span className="stat-chip">
              🔢 PIN <b>{pres.jury.pin}</b>
            </span>
          )}
          {pres.jury.emails.length > 0 && <span className="stat-chip">📧 {pres.jury.emails.length} davetli jüri</span>}
          <span className="stat-chip">👥 {jury?.jurors.length ?? 0} jüri bağlı</span>
        </div>
        {jury?.jurors.length ? <p className="small muted">{jury.jurors.join(' · ')}</p> : null}
      </div>
      <p className="small">
        Şu an puanlanan: <b>{pres.steps[stepIndex]?.title}</b> — {current ? `${current.jurors} jüri puanladı · ${current.total.toFixed(2)} / 10` : 'henüz puan yok'}
      </p>
      <h4 className="section-title">🏆 Canlı sıralama</h4>
      <JuryRanking pres={pres} rows={jury?.byStep ?? pres.run.jury ?? []} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Report sections                                                     */
/* ------------------------------------------------------------------ */
export function ReportInteract({ pres }: { pres: Presentation }) {
  const polls = pres.run.polls ?? [];
  const jury = pres.run.jury ?? [];
  if (!polls.length && !jury.length) return null;
  return (
    <>
      {jury.length > 0 && (
        <section data-anchor="report-jury">
          <h2>🏆 Pitch günü — jüri sonuçları</h2>
          <JuryRanking pres={pres} rows={jury} />
        </section>
      )}
      {polls.length > 0 && (
        <section data-anchor="report-polls">
          <h2>📊 Anket & quiz sonuçları</h2>
          <div className="report-polls">
            {polls.map((p: PollResult) => (
              <div key={p.qid} className="card stack">
                <b>
                  {QUESTION_KINDS[p.kind].icon} {p.text} <small className="muted">· {p.stepIndex + 1}. adım · {p.total} yanıt</small>
                </b>
                <ResultView kind={p.kind} options={p.options} data={p} correct={p.correct} />
              </div>
            ))}
          </div>
          {pres.run.board && pres.run.board.length > 0 && (
            <>
              <h3>Quiz puan tablosu</h3>
              <Leaderboard rows={pres.run.board} />
            </>
          )}
        </section>
      )}
    </>
  );
}
