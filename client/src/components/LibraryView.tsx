// client/src/components/LibraryView.tsx — "Sunumlarım": private / shared by me / shared with me / public gallery
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { duplicatePresentation, openPresentation, removePresentation, useLibrary, type LibEntry } from '../lib/library';
import { importWithOwnerKey, listPublic, unshare } from '../lib/cloud';
import { importFile, SNMTDZ_EXT } from '../lib/io';
import { foldTr } from '../lib/speechMatch';
import { ShareDialog } from './ShareDialog';
import { MergeDialog, SplitDialog } from './StepTools';

type Tab = 'all' | 'private' | 'mine' | 'withme' | 'explore';

const VIS_BADGE: Record<string, string> = { private: '🔒 Özel bulut', link: '🔗 Bağlantıyla', public: '🌍 Herkese açık', password: '🔑 Şifreli', invite: '📧 Davetliler' };

function rel(ts: number): string {
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'az önce';
  if (d < 3600) return `${Math.floor(d / 60)} dk önce`;
  if (d < 86400) return `${Math.floor(d / 3600)} sa önce`;
  return new Date(ts).toLocaleDateString('tr-TR');
}

export function LibraryView() {
  const entries = useLibrary((s) => s.entries);
  const currentId = useApp((s) => s.pres.id);
  const newPresentation = useApp((s) => s.newPresentation);
  const openTemplates = useApp((s) => s.openTemplates);
  const loadPres = useApp((s) => s.loadPresentation);
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'updated' | 'title'>('updated');
  const [shareFor, setShareFor] = useState<string | null>(null);
  const [publicItems, setPublicItems] = useState<{ id: string; title: string; presenter: string; stepCount: number; updatedAt: number; linkRole: string }[] | null>(null);
  const [pubError, setPubError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const [splitting, setSplitting] = useState<string | null>(null);
  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  useEffect(() => {
    if (tab !== 'explore' || publicItems) return;
    listPublic()
      .then((r) => setPublicItems(r.items))
      .catch((e) => setPubError(e instanceof Error ? e.message : 'Yüklenemedi'));
  }, [tab, publicItems]);

  const counts = {
    all: entries.length,
    private: entries.filter((e) => !e.cloud || e.cloud.visibility === 'private').length,
    mine: entries.filter((e) => e.cloud?.role === 'owner' && e.cloud.visibility !== 'private').length,
    withme: entries.filter((e) => e.cloud?.role === 'editor').length,
  };

  const list = useMemo(() => {
    const fq = foldTr(q);
    return entries
      .filter((e) => {
        if (tab === 'private') return !e.cloud || e.cloud.visibility === 'private';
        if (tab === 'mine') return e.cloud?.role === 'owner' && e.cloud.visibility !== 'private';
        if (tab === 'withme') return e.cloud?.role === 'editor';
        return true;
      })
      .filter((e) => !fq || foldTr(`${e.title} ${e.presenter}`).includes(fq))
      .sort((a, b) => (sort === 'title' ? a.title.localeCompare(b.title, 'tr') : b.updatedAt - a.updatedAt));
  }, [entries, tab, q, sort]);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 3000);
  };

  const share = async (e: LibEntry) => {
    if (e.id !== currentId) await openPresentation(e.id);
    useApp.getState().setView('library');
    setShareFor(e.id);
  };

  const remove = async (e: LibEntry) => {
    const owner = e.cloud?.role === 'owner';
    if (!confirm(`“${e.title}” bu cihazdan silinsin mi?${owner ? '\n\nPaylaşımı da sunucudan kaldırmak için önce “Paylaşımı kaldır”ı kullan; aksi halde bağlantı çalışmaya devam eder ve sahip anahtarı bu cihazdan silinir.' : ''}`)) return;
    await removePresentation(e.id);
    flash('Silindi');
  };

  const claim = async () => {
    const backup = prompt('Sahip anahtarını yapıştır (paylaşımKimliği:anahtar):');
    if (!backup) return;
    try {
      const id = await importWithOwnerKey(backup);
      await openPresentation(id);
      flash('Sunum sahibi olarak eklendi ✅');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Eklenemedi');
    }
  };

  const onImport = async (f?: File) => {
    if (!f) return;
    try {
      const p = await importFile(f);
      loadPres(p);
      flash(`“${p.title}” içe aktarıldı`);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'İçe aktarılamadı');
    }
  };

  const TABS: [Tab, string][] = [
    ['all', `📚 Tümü ${counts.all}`],
    ['private', `🔒 Özel ${counts.private}`],
    ['mine', `📤 Paylaştıklarım ${counts.mine}`],
    ['withme', `✏️ Benimle paylaşılan ${counts.withme}`],
    ['explore', '🌍 Keşfet'],
  ];

  return (
    <main className="page">
      <header className="page-head">
        <h1>🗂️ Sunumlarım</h1>
        <p className="muted">Sunumların bu cihazda saklanır. İstediğini bağlantıyla, herkese açık ya da şifreli paylaşabilir; izleyici mi düzenleyici mi olacaklarına sen karar verirsin.</p>
        <div className="row gap-s wrap">
          <button className="btn btn-primary" onClick={() => newPresentation()}>
            ＋ Yeni sunum
          </button>
          <button className="btn" onClick={() => openTemplates()}>
            📚 Şablondan
          </button>
          <input ref={fileRef} type="file" hidden accept={`${SNMTDZ_EXT},.json`} onChange={(e) => { void onImport(e.target.files?.[0]); e.target.value = ''; }} />
          <button className="btn" onClick={() => fileRef.current?.click()}>
            📥 İçe aktar
          </button>
          <button className="btn btn-ghost" onClick={claim} title="Başka cihazda paylaştığın bir sunumun sahibi olarak devam et">
            🔐 Sahip anahtarıyla aç
          </button>
        </div>
      </header>

      <div className="subtabs" role="tablist">
        {TABS.map(([t, l]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`subtab ${tab === t ? 'is-active' : ''}`} onClick={() => setTab(t)}>
            {l}
          </button>
        ))}
      </div>

      {tab !== 'explore' ? (
        <>
          <div className="row gap-s wrap">
            <input className="input" style={{ maxWidth: 420 }} placeholder="🔍 Sunum ara…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="seg-select" value={sort} onChange={(e) => setSort(e.target.value as 'updated' | 'title')} aria-label="Sırala">
              <option value="updated">Son düzenlenen</option>
              <option value="title">A → Z</option>
            </select>
          </div>
          {picked.length > 0 && (
            <div className="merge-bar" role="region" aria-label="Seçili sunumlar">
              <span>
                <b>{picked.length}</b> sunum seçili <small className="muted">(seçim sırası = birleştirme sırası)</small>
              </span>
              <button className="btn btn-primary btn-sm" disabled={picked.length < 2} onClick={() => setMerging(true)}>
                🔗 Birleştir
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setPicked([])}>
                Seçimi temizle
              </button>
            </div>
          )}
          <div className="lib-grid">
            {list.map((e) => (
              <article key={e.id} className={`lib-card ${e.id === currentId ? 'is-current' : ''} ${picked.includes(e.id) ? 'is-picked' : ''}`}>
                <label className="lib-pick" title="Birleştirmek için seç">
                  <input type="checkbox" checked={picked.includes(e.id)} onChange={() => togglePick(e.id)} aria-label={`${e.title} — birleştirmek için seç`} />
                  {picked.includes(e.id) && <span className="lib-pick-n">{picked.indexOf(e.id) + 1}</span>}
                </label>
                <div className="lib-top">
                  <span className="lib-badge">{e.cloud ? (e.cloud.role === 'editor' ? '✏️ Düzenleyici' : VIS_BADGE[e.cloud.visibility]) : '🔒 Yalnızca bu cihaz'}</span>
                  {e.cloud?.role === 'owner' && e.cloud.visibility !== 'private' && <span className="lib-badge lib-badge--role">{e.cloud.linkRole === 'editor' ? '✏️ link: düzenle' : '👀 link: izle'}</span>}
                  {e.id === currentId && <span className="lib-badge lib-badge--now">● Açık</span>}
                </div>
                <h3 className="truncate">{e.title}</h3>
                <p className="small muted">
                  {e.stepCount} adım{e.presenter ? ` · ${e.presenter}` : ''} · {rel(e.updatedAt)}
                </p>
                <div className="row gap-s wrap lib-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => openPresentation(e.id)}>
                    Aç
                  </button>
                  <button className="btn btn-sm" onClick={() => share(e)}>
                    🔗 {e.cloud?.role === 'editor' ? 'Bağlantı' : 'Paylaş'}
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => duplicatePresentation(e.id).then(() => flash('Kopya oluşturuldu (özel)'))} title="Özel kopya">
                    ⧉
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={() => setSplitting(e.id)} title="İki sunuma ayır" disabled={e.stepCount < 2}>
                    ✂️
                  </button>
                  {e.cloud?.role === 'editor' && (
                    <button className="btn btn-sm btn-ghost" onClick={() => confirm('Bu paylaşımdan ayrılınsın mı? Yerel kopya özel olarak kalır.') && unshare(e.id)} title="Paylaşımdan ayrıl">
                      ⇠
                    </button>
                  )}
                  <button className="btn btn-sm btn-ghost" onClick={() => remove(e)} title="Bu cihazdan sil">
                    🗑️
                  </button>
                </div>
              </article>
            ))}
            {!list.length && <p className="muted empty">Bu sekmede sunum yok.</p>}
          </div>
        </>
      ) : (
        <div className="lib-grid">
          {pubError && <p className="error">{pubError}</p>}
          {!publicItems && !pubError && <p className="muted">⏳ Yükleniyor…</p>}
          {publicItems?.map((p) => (
            <article key={p.id} className="lib-card">
              <div className="lib-top">
                <span className="lib-badge">🌍 Herkese açık</span>
                <span className="lib-badge lib-badge--role">{p.linkRole === 'editor' ? '✏️ Herkes düzenleyebilir' : '👀 İzleme'}</span>
              </div>
              <h3 className="truncate">{p.title}</h3>
              <p className="small muted">
                {p.stepCount} adım{p.presenter ? ` · ${p.presenter}` : ''} · {rel(p.updatedAt)}
              </p>
              <a className="btn btn-primary btn-sm" href={`/?s=${p.id}`}>
                Aç →
              </a>
            </article>
          ))}
          {publicItems && !publicItems.length && <p className="muted empty">Henüz herkese açık sunum yok. İlk paylaşan sen ol!</p>}
        </div>
      )}
      {shareFor && <ShareDialog onClose={() => setShareFor(null)} />}
      {merging && (
        <MergeDialog
          ids={picked}
          onClose={() => setMerging(false)}
          onDone={(m) => {
            setPicked([]);
            flash(m);
          }}
        />
      )}
      {splitting && <SplitDialog id={splitting} onClose={() => setSplitting(null)} onDone={flash} />}
      {msg && (
        <div className="toast" role="status">
          {msg}
        </div>
      )}
    </main>
  );
}
