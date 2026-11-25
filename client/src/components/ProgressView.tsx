// client/src/components/ProgressView.tsx — Sprint 4: progress dashboard (trends, weekly streak, level, career badges)
import { useMemo } from 'react';
import { useApp } from '../store';
import { careerBadges, levelOf, weekStart, weekStreak, useProgress, type RunSummary } from '../lib/progress';
import { useAccount } from '../lib/account';
import { fmtDuration } from '../lib/report';

interface Metric {
  key: string;
  label: string;
  unit: string;
  /** higher is better? (for the delta colour) */
  up: boolean;
  value: (r: RunSummary) => number | null;
  fmt: (n: number) => string;
  band?: [number, number];
}
const METRICS: Metric[] = [
  { key: 'overall', label: 'Genel skor', unit: '/100', up: true, value: (r) => r.overallScore, fmt: (n) => String(Math.round(n)) },
  { key: 'time', label: 'Süreye uyum', unit: '%', up: true, value: (r) => r.timeScore, fmt: (n) => `%${Math.round(n)}` },
  { key: 'wpm', label: 'Konuşma hızı', unit: 'kelime/dk', up: true, value: (r) => r.wpm, fmt: (n) => String(Math.round(n)), band: [110, 160] },
  { key: 'filler', label: 'Dolgu oranı', unit: '%', up: false, value: (r) => (r.fillerRate == null ? null : r.fillerRate * 100), fmt: (n) => `%${n.toFixed(1)}` },
  { key: 'engage', label: 'Etkileşim', unit: '/100', up: true, value: (r) => r.engagementScore, fmt: (n) => String(Math.round(n)) },
];

function Trend({ m, runs }: { m: Metric; runs: RunSummary[] }) {
  const pts = runs
    .slice(-20)
    .map((r) => ({ r, v: m.value(r) }))
    .filter((x): x is { r: RunSummary; v: number } => x.v != null);
  const last = pts[pts.length - 1]?.v ?? null;
  const prev = pts.slice(0, -1);
  const avgPrev = prev.length ? prev.reduce((a, x) => a + x.v, 0) / prev.length : null;
  const delta = last != null && avgPrev != null ? last - avgPrev : null;
  const good = delta == null || Math.abs(delta) < 0.05 ? null : m.up ? delta > 0 : delta < 0;

  const W = 260;
  const H = 70;
  const vals = pts.map((x) => x.v).concat(m.band ?? []);
  const lo = Math.min(...vals, m.key === 'filler' ? 0 : Infinity);
  const hi = Math.max(...vals, lo + 1);
  const x = (i: number) => (pts.length === 1 ? W / 2 : 6 + (i * (W - 12)) / (pts.length - 1));
  const y = (v: number) => H - 6 - ((v - lo) / (hi - lo)) * (H - 12);
  return (
    <div className="card trend" data-anchor={`trend-${m.key}`}>
      <div className="trend-head">
        <span className="muted small">{m.label}</span>
        {delta != null && good != null && (
          <span className={`trend-delta ${good ? 'is-good' : 'is-bad'}`} title="Son sunum, önceki sunumların ortalamasıyla karşılaştırıldı">
            {delta > 0 ? '▲' : '▼'} {m.key === 'filler' ? Math.abs(delta).toFixed(1) : Math.round(Math.abs(delta))}
          </span>
        )}
      </div>
      <b className="trend-value">
        {last != null ? m.fmt(last) : '—'} <small className="muted">{m.unit}</small>
      </b>
      {pts.length ? (
        <svg viewBox={`0 0 ${W} ${H}`} className="trend-chart" role="img" aria-label={`${m.label} trendi, son ${pts.length} sunum`}>
          {m.band && <rect x={0} width={W} y={y(m.band[1])} height={Math.max(0, y(m.band[0]) - y(m.band[1]))} className="trend-band" />}
          {pts.length > 1 && <polyline points={pts.map((p, i) => `${x(i)},${y(p.v)}`).join(' ')} className="trend-line" />}
          {pts.map((p, i) => (
            <circle key={p.r.id} cx={x(i)} cy={y(p.v)} r={i === pts.length - 1 ? 4 : 2.5} className="trend-dot">
              <title>{`${p.r.title} · ${new Date(p.r.endedAt).toLocaleDateString('tr-TR')} · ${m.fmt(p.v)}`}</title>
            </circle>
          ))}
        </svg>
      ) : (
        <p className="muted small">{m.key === 'wpm' || m.key === 'filler' ? 'Dinleme açık bir sunumdan sonra oluşur.' : 'Veri yok'}</p>
      )}
    </div>
  );
}

function WeekStrip({ runs }: { runs: RunSummary[] }) {
  const cur = weekStart(Date.now());
  const weeks = Array.from({ length: 12 }, (_, i) => cur - (11 - i) * 7 * 24 * 3600 * 1000);
  const counts = new Map<number, number>();
  runs.forEach((r) => counts.set(weekStart(r.endedAt), (counts.get(weekStart(r.endedAt)) ?? 0) + 1));
  return (
    <div className="week-strip" role="list" aria-label="Son 12 hafta">
      {weeks.map((w) => {
        const n = counts.get(w) ?? 0;
        return (
          <span
            key={w}
            role="listitem"
            className={`week-cell lvl-${Math.min(3, n)} ${w === cur ? 'is-now' : ''}`}
            title={`${new Date(w).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} haftası · ${n} sunum`}
          >
            {n || ''}
          </span>
        );
      })}
    </div>
  );
}

export function ProgressView() {
  const runs = useProgress((s) => s.runs);
  const ready = useProgress((s) => s.ready);
  const email = useAccount((s) => s.email);
  const start = useApp((s) => s.start);
  const setView = useApp((s) => s.setView);
  const lvl = useMemo(() => levelOf(runs), [runs]);
  const streak = useMemo(() => weekStreak(runs), [runs]);
  const badges = useMemo(() => careerBadges(runs), [runs]);
  const earned = badges.filter((b) => b.earned).length;
  const totalMin = Math.round(runs.reduce((a, r) => a + r.actualSec, 0) / 60);
  const recent = runs.slice(-8).reverse();

  return (
    <main className="page progress-page" data-anchor="progress">
      <header className="page-head">
        <h1>📈 Gelişimim</h1>
        <p className="muted">
          Sunumdan sunuma ilerlemen, haftalık prova serin ve rozetlerin. {email ? '☁️ Hesabınla tüm cihazlarda senkron.' : '💾 Bu cihazda saklanıyor — giriş yaparsan tüm cihazlarda senkron olur.'}
        </p>
      </header>

      {ready && !runs.length ? (
        <section className="card empty-progress stack center-text">
          <span className="empty-emoji" aria-hidden>
            🌱
          </span>
          <h2>İlk sunumunla yolculuk başlasın</h2>
          <p className="muted">En az 30 saniyelik bir sunumu tamamladığında süreye uyum, konuşma hızı ve dolgu oranı burada trend olarak birikir; seriler ve rozetler açılır.</p>
          <div className="row gap-s" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={start}>
              ▶ Prova başlat
            </button>
            <button className="btn" onClick={() => setView('templates')}>
              📚 Şablon seç
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="progress-top">
            <div className="card level-card" data-anchor="progress-level">
              <div className="level-emoji" aria-hidden>
                {lvl.emoji}
              </div>
              <div className="stack-xs grow">
                <span className="muted small">Seviye {lvl.level}</span>
                <b className="level-name">{lvl.name}</b>
                <div className="xp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(lvl.pct * 100)} aria-label="Sonraki seviyeye ilerleme">
                  <span style={{ width: `${Math.round(lvl.pct * 100)}%` }} />
                </div>
                <span className="muted small">
                  {lvl.xp} XP{lvl.next ? ` · ${lvl.next.emoji} ${lvl.next.name} için ${lvl.next.xp - lvl.xp} XP` : ' · en üst seviye'}
                </span>
              </div>
            </div>
            <div className="card streak-card" data-anchor="progress-streak">
              <div className="row gap-s" style={{ alignItems: 'baseline' }}>
                <b className="streak-num">🔥 {streak.current}</b>
                <span className="muted small">haftalık seri · en iyi {streak.best}</span>
              </div>
              <WeekStrip runs={runs} />
              <span className="muted small">{streak.thisWeek ? `Bu hafta ${streak.thisWeek} prova ✅` : 'Bu hafta henüz prova yok — seriyi korumak için bir prova yap.'}</span>
            </div>
          </section>

          <section className="kpis">
            <div className="kpi">
              <b>{runs.length}</b>
              <span>tamamlanan sunum</span>
            </div>
            <div className="kpi">
              <b>{totalMin}</b>
              <span>dakika sahnede</span>
            </div>
            <div className="kpi">
              <b>{Math.round(runs.reduce((a, r) => a + r.overallScore, 0) / Math.max(1, runs.length))}</b>
              <span>ortalama skor</span>
            </div>
            <div className="kpi">
              <b>
                {earned}/{badges.length}
              </b>
              <span>rozet</span>
            </div>
          </section>

          <h2 className="section-title">Trendler · son 20 sunum</h2>
          <section className="trend-grid">
            {METRICS.map((m) => (
              <Trend key={m.key} m={m} runs={runs} />
            ))}
          </section>

          <h2 className="section-title">Rozetler</h2>
          <section className="career-badges" data-anchor="progress-badges">
            {badges.map((b) => (
              <div key={b.id} className={`career-badge ${b.earned ? 'is-earned' : ''}`} title={b.hint}>
                <span className="cb-emoji" aria-hidden>
                  {b.earned ? b.emoji : '🔒'}
                </span>
                <b>{b.label}</b>
                <small className="muted">{b.hint}</small>
                {!b.earned && (
                  <span className="cb-bar" aria-label={`${b.have}/${b.need}`}>
                    <span style={{ width: `${(b.have / b.need) * 100}%` }} />
                  </span>
                )}
              </div>
            ))}
          </section>

          <h2 className="section-title">Son sunumlar</h2>
          <section className="card">
            <table className="table progress-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Sunum</th>
                  <th>Süre</th>
                  <th>Skor</th>
                  <th>Zaman</th>
                  <th>Hız</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.endedAt).toLocaleDateString('tr-TR')}</td>
                    <td className="truncate">{r.title}</td>
                    <td>
                      {fmtDuration(r.actualSec)} / {fmtDuration(r.plannedSec)}
                    </td>
                    <td>
                      <b>{r.overallScore}</b>
                    </td>
                    <td>%{r.timeScore}</td>
                    <td>{r.wpm ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}

/** shown on the report right after a run that unlocked career badges */
export function FreshBadges() {
  const fresh = useProgress((s) => s.fresh);
  const runId = useApp((s) => `${s.pres.id}:${s.pres.run.startedAt}`);
  const setView = useApp((s) => s.setView);
  if (!fresh || fresh.runId !== runId) return null;
  return (
    <section className="card fresh-badges no-print" role="status" data-anchor="fresh-badges">
      <b>🎉 Yeni rozet{fresh.badges.length > 1 ? 'ler' : ''} kazandın!</b>
      <div className="row gap-s wrap">
        {fresh.badges.map((b) => (
          <span key={b.id} className="badge">
            {b.emoji} {b.label}
          </span>
        ))}
      </div>
      <button className="btn btn-sm" onClick={() => setView('progress')}>
        📈 Gelişimime git
      </button>
    </section>
  );
}
