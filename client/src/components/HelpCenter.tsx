// client/src/components/HelpCenter.tsx — guide, FAQ, shortcuts, troubleshooting and support
import { useEffect, useMemo, useState } from 'react';
import { useApp, type HelpTab } from '../store';
import { FAQS, GUIDE, TROUBLESHOOT, type FaqItem, type GuideArticle, type GuideCategory } from '../lib/help';
import { foldTr } from '../lib/speechMatch';
import { ShortcutsTable } from './Shortcuts';
import { useTheme } from '../lib/theme';
import { TEMPLATES } from '../lib/templates';
import { FRAMEWORKS } from '../lib/frameworks';

const APP_VERSION = '0.3.0-beta';
const READ_KEY = 'teknodoz-sunum:guide-read';

const TABS: { id: HelpTab; label: string }[] = [
  { id: 'guide', label: '📖 Kılavuz' },
  { id: 'faq', label: '❓ SSS' },
  { id: 'shortcuts', label: '⌨️ Kısayollar' },
  { id: 'troubleshoot', label: '🩺 Sorun giderme' },
  { id: 'support', label: '🛟 Destek' },
];

function loadRead(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function Article({ a }: { a: GuideArticle }) {
  const { setView, openTemplates } = useApp.getState();
  return (
    <article className="guide-article">
      <p className="eyebrow">{a.category}</p>
      <h2>
        {a.emoji} {a.title}
      </h2>
      <p className="muted">{a.summary}</p>
      {a.sections.map((s, i) => (
        <section key={s.h} data-anchor={`guide-${a.id}-${i}`} className="guide-section">
          <h3>{s.h}</h3>
          {s.p?.map((p) => <p key={p}>{p}</p>)}
          {s.ul && (
            <ul>
              {s.ul.map((li) => (
                <li key={li}>{li}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {a.goto && (
        <div className="row gap-s wrap">
          {a.goto.map((g) => (
            <button key={g.label} className="btn btn-primary btn-sm" onClick={() => (g.templates ? openTemplates(g.templates) : setView(g.view))}>
              {g.label}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}

function FaqList({ items, openId }: { items: { f: FaqItem; i: number }[]; openId: string | null }) {
  const tags = ['Tümü', ...Array.from(new Set(FAQS.map((f) => f.tag)))];
  const [tag, setTag] = useState('Tümü');
  const shown = items.filter(({ f }) => tag === 'Tümü' || f.tag === tag);
  return (
    <div className="stack">
      <div className="pill-grid">
        {tags.map((t) => (
          <button key={t} className={`pill pill--sm ${tag === t ? 'is-active' : ''}`} onClick={() => setTag(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="faq-list">
        {shown.map(({ f, i }) => (
          <details key={f.q} className="faq" open={openId === `faq-${i}`} data-anchor={`faq-${i}`}>
            <summary>
              <span className="faq-tag">{f.tag}</span> {f.q}
            </summary>
            <p>{f.a}</p>
          </details>
        ))}
        {!shown.length && <p className="muted empty">Sonuç yok.</p>}
      </div>
    </div>
  );
}

function Support() {
  const mode = useTheme((s) => s.mode);
  const [copied, setCopied] = useState(false);
  const info = [
    `Teknodoz Sunum v${APP_VERSION}`,
    `Tarayıcı: ${navigator.userAgent}`,
    `Ekran: ${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`,
    `Tema: ${mode}`,
    `Konuşma tanıma: ${'webkitSpeechRecognition' in window || 'SpeechRecognition' in window ? 'var' : 'yok'}`,
    `Tam ekran API: ${document.fullscreenEnabled ? 'var' : 'yok'}`,
    `Dil: ${navigator.language}`,
  ].join('\n');
  return (
    <div className="stack support">
      <div className="card stack">
        <h3>🛟 Destek almak için</h3>
        <ol>
          <li>Önce <b>Sorun giderme</b> ve <b>SSS</b> sekmelerine göz at — çoğu sorunun çözümü orada.</li>
          <li>Sorunu tekrar üreten adımları not et (ne yaptın, ne bekledin, ne oldu?).</li>
          <li>Aşağıdaki sistem bilgisini kopyala ve gerekiyorsa sunumunu <b>.snmtdz</b> olarak dışa aktar (Ctrl+S).</li>
          <li>Bu bilgileri, uygulamayı sana sağlayan ekip/yöneticiyle paylaş.</li>
        </ol>
      </div>
      <div className="card stack">
        <h3>🧾 Sistem bilgisi</h3>
        <pre className="sysinfo">{info}</pre>
        <button
          className="btn btn-sm"
          onClick={() =>
            navigator.clipboard?.writeText(info).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
        >
          {copied ? '✅ Kopyalandı' : '📋 Sistem bilgisini kopyala'}
        </button>
      </div>
      <div className="card stack">
        <h3>💡 Geri bildirim</h3>
        <p className="muted">Beta sürecinde her fikir değerli. Sunum sonrası raporun “Öz değerlendirme” alanına not düşebilir, raporu PDF olarak ekiple paylaşabilirsin.</p>
        <p className="muted small">
          Sürüm {APP_VERSION} · {TEMPLATES.length} şablon · {FRAMEWORKS.length} model · {GUIDE.length} kılavuz makalesi · {FAQS.length} SSS
        </p>
      </div>
    </div>
  );
}

export function HelpCenter() {
  const tab = useApp((s) => s.helpTab);
  const articleId = useApp((s) => s.helpArticle);
  const openHelp = useApp((s) => s.openHelp);
  const [q, setQ] = useState('');
  const [read, setRead] = useState<Set<string>>(loadRead);
  const current = GUIDE.find((g) => g.id === articleId) ?? GUIDE[0];
  const fq = foldTr(q);

  useEffect(() => {
    if (tab !== 'guide') return;
    setRead((r) => {
      if (r.has(current.id)) return r;
      const n = new Set(r).add(current.id);
      try {
        localStorage.setItem(READ_KEY, JSON.stringify([...n]));
      } catch {
        /* ignore */
      }
      return n;
    });
  }, [tab, current.id]);

  const guideHits = useMemo(
    () => GUIDE.filter((g) => !fq || foldTr(`${g.title} ${g.summary} ${g.sections.map((s) => `${s.h} ${(s.p ?? []).join(' ')} ${(s.ul ?? []).join(' ')}`).join(' ')}`).includes(fq)),
    [fq],
  );
  const faqHits = useMemo(() => FAQS.map((f, i) => ({ f, i })).filter(({ f }) => !fq || foldTr(`${f.q} ${f.a}`).includes(fq)), [fq]);
  const tsHits = useMemo(() => TROUBLESHOOT.map((t, i) => ({ t, i })).filter(({ t }) => !fq || foldTr(`${t.symptom} ${t.fixes.join(' ')}`).includes(fq)), [fq]);
  const cats = Array.from(new Set(GUIDE.map((g) => g.category))) as GuideCategory[];
  const pct = Math.round((read.size / GUIDE.length) * 100);

  return (
    <main className="page help">
      <header className="page-head help-head">
        <h1>🛟 Yardım merkezi</h1>
        <p className="muted">Kılavuz, sık sorulan sorular, klavye kısayolları, sorun giderme ve destek — hepsi tek yerde.</p>
        <input className="input help-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Yardımda ara: zil, pdf, katman, canlı oda, kurulum…" />
        {q && (
          <p className="small muted">
            {guideHits.length} kılavuz · {faqHits.length} SSS · {tsHits.length} sorun giderme sonucu
          </p>
        )}
      </header>

      <div className="subtabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`subtab ${tab === t.id ? 'is-active' : ''}`} onClick={() => openHelp(t.id, null)}>
            {t.label}
            {q && t.id === 'guide' ? ` (${guideHits.length})` : q && t.id === 'faq' ? ` (${faqHits.length})` : q && t.id === 'troubleshoot' ? ` (${tsHits.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'guide' && (
        <div className="guide-layout">
          <aside className="guide-nav" aria-label="Kılavuz içindekiler">
            <div className="guide-progress">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <small>🎓 Rehber ilerlemen</small>
                <small>
                  {read.size}/{GUIDE.length}
                </small>
              </div>
              <div className="bar-track">
                <span style={{ width: `${pct}%` }} />
              </div>
              {pct === 100 && <small className="badge">🏅 Rehber Ustası</small>}
            </div>
            {cats.map((c) => {
              const items = guideHits.filter((g) => g.category === c);
              if (!items.length) return null;
              return (
                <div key={c} className="guide-cat">
                  <p className="nav-group-head">
                    <span className="nav-dot" /> {c}
                  </p>
                  {items.map((g) => (
                    <button key={g.id} className={`side-item ${g.id === current.id ? 'is-active' : ''}`} onClick={() => openHelp('guide', g.id)}>
                      <span className="truncate">
                        {g.emoji} {g.title}
                      </span>
                      {read.has(g.id) && <small className="side-min">✓</small>}
                    </button>
                  ))}
                </div>
              );
            })}
            {!guideHits.length && <p className="muted small">Kılavuzda sonuç yok.</p>}
          </aside>
          <div className="guide-body">
            <Article a={current} />
            <nav className="guide-pager">
              {(() => {
                const i = GUIDE.indexOf(current);
                return (
                  <>
                    {i > 0 ? (
                      <button className="btn btn-sm" onClick={() => openHelp('guide', GUIDE[i - 1].id)}>
                        ‹ {GUIDE[i - 1].title}
                      </button>
                    ) : (
                      <span />
                    )}
                    {i < GUIDE.length - 1 && (
                      <button className="btn btn-sm" onClick={() => openHelp('guide', GUIDE[i + 1].id)}>
                        {GUIDE[i + 1].title} ›
                      </button>
                    )}
                  </>
                );
              })()}
            </nav>
          </div>
        </div>
      )}

      {tab === 'faq' && <FaqList items={faqHits} openId={articleId} />}

      {tab === 'shortcuts' && <ShortcutsTable filter={q} />}

      {tab === 'troubleshoot' && (
        <div className="ts-grid">
          {tsHits.map(({ t, i }) => (
            <div key={t.symptom} className={`card ts-card ${articleId === `ts-${i}` ? 'is-focus' : ''}`} data-anchor={`ts-${i}`}>
              <h3>🩺 {t.symptom}</h3>
              <ul>
                {t.fixes.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          ))}
          {!tsHits.length && <p className="muted empty">Sonuç yok.</p>}
        </div>
      )}

      {tab === 'support' && <Support />}
    </main>
  );
}
