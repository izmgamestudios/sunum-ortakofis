// client/src/components/TemplatesView.tsx
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import { CATEGORIES, presentationFromTemplate, TEMPLATES, totalMinutes, type PresentationTemplate, type TemplateCategory } from '../lib/templates';
import { EMOTIONS, SETTINGS } from '../lib/catalog';
import { foldTr as normalizeTr } from '../lib/speechMatch';
import { FW_GROUPS, type FwGroup } from '../lib/frameworks';
import { FwThumb } from './FrameworkPicker';
import { AddTemplateDialog } from './StepTools';

function isPristine(p: ReturnType<typeof useApp.getState>['pres']): boolean {
  return !p.steps.some((s) => s.text || s.attachments.length || s.canvas.length || s.words.length || s.topicTree.length) && !p.run.startedAt;
}

function TemplateCard({ t, onUse }: { t: PresentationTemplate; onUse: (t: PresentationTemplate) => void }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const cat = CATEGORIES[t.category];
  const rp = t.roleplay;
  return (
    <article className="tpl-card" style={{ ['--tpl' as string]: cat.color }}>
      <div className="tpl-top">
        <span className="tpl-cat">
          {cat.emoji} {cat.label}
        </span>
        <span className="tpl-level">{t.level}</span>
      </div>
      {t.frameworkId && <FwThumb id={t.frameworkId} width={480} className="tpl-thumb" />}
      <h3>{t.title}</h3>
      <p className="small muted">{t.description}</p>
      <ul className="tpl-meta small">
        <li>⏳ {t.steps.length} adım · {totalMinutes(t)} dk</li>
        <li>👥 {t.audience}</li>
        {rp?.emotion && (
          <li>
            🎭 {EMOTIONS[rp.emotion].emoji} {EMOTIONS[rp.emotion].label}
            {rp.setting ? ` · ${SETTINGS[rp.setting].label}` : ''}
          </li>
        )}
      </ul>
      {open && (
        <ol className="tpl-steps small">
          {t.steps.map((s, i) => (
            <li key={s.title}>
              <b>{s.title}</b> <span className="muted">· {i + 1} dk · {s.words ? '🎱 tombala' : s.tree ? '🌳 ağaç' : '💬 serbest'}</span>
              <br />
              <span className="muted">{s.text}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="row gap-s tpl-actions">
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? '▲ Gizle' : '▼ Adımlar'}
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => onUse(t)}>
          ✨ Bu şablonla başla
        </button>
        <button className="btn btn-sm" onClick={() => setAdding(true)} title="Bu şablonun adımlarını açık ya da kayıtlı bir sunuma ekle">
          ➕ Mevcut sunuma ekle
        </button>
      </div>
      {adding && <AddTemplateDialog template={t} onClose={() => setAdding(false)} />}
    </article>
  );
}

export function TemplatesView() {
  const load = useApp((s) => s.loadPresentation);
  const setView = useApp((s) => s.setView);
  const initialCat = useApp((s) => s.templateCategory) as TemplateCategory | 'all';
  const [cat, setCat] = useState<TemplateCategory | 'all'>(initialCat);
  useEffect(() => setCat(initialCat), [initialCat]);
  const initialQ = useApp((s) => s.templateQuery);
  const [q, setQ] = useState(initialQ);
  useEffect(() => setQ(initialQ), [initialQ]);
  const [fwGroup, setFwGroup] = useState<FwGroup | 'all'>('all');

  const recommended = useMemo(() => {
    // one template from 3 different random categories → fresh suggestions each visit
    const cats = (Object.keys(CATEGORIES) as TemplateCategory[]).sort(() => Math.random() - 0.5).slice(0, 3);
    return cats.map((c) => { const pool = TEMPLATES.filter((t) => t.category === c); return pool[Math.floor(Math.random() * pool.length)] ?? TEMPLATES[0]; });
  }, []);

  const filtered = TEMPLATES.filter((t) => {
    if (cat !== 'all' && t.category !== cat) return false;
    if (cat === 'cerceve' && fwGroup !== 'all' && t.audience !== FW_GROUPS[fwGroup].label) return false;
    if (!q.trim()) return true;
    const hay = normalizeTr([t.title, t.description, t.audience, CATEGORIES[t.category].label, ...t.steps.map((s) => s.title)].join(' '));
    return normalizeTr(q).split(' ').every((w) => hay.includes(w));
  });

  const use = (t: PresentationTemplate) => {
    const cur = useApp.getState().pres;
    if (!isPristine(cur) && !confirm(`“${cur.title}” sunumunun yerine “${t.title}” şablonu açılsın mı? Mevcut sunumu önce .snmtdz olarak dışa aktarmanı öneririz.`)) return;
    load(presentationFromTemplate(t));
    setView('setup');
  };

  return (
    <main className="page">
      <header className="page-head">
        <h1>📚 Şablon galerisi</h1>
        <p className="muted">Hazır sunum iskeletleriyle başla: adım başlıkları, konuşma ipuçları, tombala kelimeleri, konu ağaçları ve önerilen rol ayarları dahil. Her şeyi sonradan düzenleyebilirsin.</p>
      </header>

      <section className="stack">
        <h2 className="section-title">✨ Senin için öneriler</h2>
        <div className="tpl-grid">
          {recommended.map((t) => (
            <TemplateCard key={`rec-${t.id}`} t={t} onUse={use} />
          ))}
        </div>
      </section>

      <section className="stack">
        <h2 className="section-title">Tüm şablonlar ({filtered.length})</h2>
        <input className="input" placeholder="🔍 Ara: pitch, iklim, bütçe, mülakat…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="pill-grid" role="radiogroup" aria-label="Kategori">
          <button className={`pill ${cat === 'all' ? 'is-active' : ''}`} onClick={() => setCat('all')}>
            Tümü
          </button>
          {(Object.keys(CATEGORIES) as TemplateCategory[]).map((c) => (
            <button key={c} className={`pill ${cat === c ? 'is-active' : ''}`} style={{ ['--pill' as string]: CATEGORIES[c].color }} onClick={() => setCat(c)}>
              {CATEGORIES[c].emoji} {CATEGORIES[c].label}
            </button>
          ))}
        </div>
        {cat === 'cerceve' && (
          <div className="pill-grid" role="radiogroup" aria-label="Model grubu">
            <button className={`pill pill--sm ${fwGroup === 'all' ? 'is-active' : ''}`} onClick={() => setFwGroup('all')}>
              Tüm modeller
            </button>
            {(Object.keys(FW_GROUPS) as FwGroup[]).map((g) => (
              <button key={g} className={`pill pill--sm ${fwGroup === g ? 'is-active' : ''}`} onClick={() => setFwGroup(g)}>
                {FW_GROUPS[g].emoji} {FW_GROUPS[g].label}
              </button>
            ))}
          </div>
        )}
        <div className="tpl-grid">
          {filtered.map((t) => (
            <TemplateCard key={t.id} t={t} onUse={use} />
          ))}
        </div>
        {!filtered.length && <p className="muted empty">Eşleşen şablon yok.</p>}
      </section>
    </main>
  );
}
