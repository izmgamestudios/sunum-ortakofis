// client/src/components/Header.tsx
import { useRef, useState } from 'react';
import { useApp } from '../store';
import { exportJson, exportMarkdown, exportSnmtdz, importFile, SNMTDZ_EXT } from '../lib/io';

export function BetaBadge() {
  return <span className="beta-badge">Beta · Erken Erişim</span>;
}

export function Logo({ small = false }: { small?: boolean }) {
  return <img src="/teknodoz-logo.png" alt="Teknodoz" className={`logo ${small ? 'logo--sm' : ''}`} />;
}

export function Header() {
  const view = useApp((s) => s.view);
  const pres = useApp((s) => s.pres);
  const setView = useApp((s) => s.setView);
  const load = useApp((s) => s.loadPresentation);
  const newPres = useApp((s) => s.newPresentation);
  const fileRef = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  };

  const onImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const p = await importFile(f);
      load(p);
      flash(`“${p.title}” içe aktarıldı ✅`);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'İçe aktarma başarısız');
    }
  };

  return (
    <header className="app-header">
      <div className="brand">
        <button className="logo-btn" onClick={() => setView('setup')} aria-label="Ana sayfa">
          <Logo small />
        </button>
        <BetaBadge />
      </div>
      <nav className="tabs" aria-label="Görünüm">
        <button className={`tab ${view === 'setup' ? 'is-active' : ''}`} onClick={() => setView('setup')} aria-label="Hazırlık">
          🛠️ <span className="hide-xs">Hazırlık</span>
        </button>
        <button className={`tab ${view === 'live' ? 'is-active' : ''}`} onClick={() => setView('live')} aria-label="Sunum">
          🎤 <span className="hide-xs">Sunum</span>
        </button>
        <button className={`tab ${view === 'report' ? 'is-active' : ''}`} onClick={() => setView('report')} aria-label="Rapor">
          📊 <span className="hide-xs">Rapor</span>
        </button>
      </nav>
      <div className="header-actions">
        <input ref={fileRef} type="file" hidden accept={`${SNMTDZ_EXT},.json,application/json`} onChange={(e) => { onImport(e.target.files?.[0]); e.target.value = ''; }} />
        <button className="btn btn-ghost" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu" aria-label="Dosya menüsü">
          📁 <span className="hide-xs">Dosya</span>
        </button>
        {menu && (
          <div className="menu" role="menu" onClick={() => setMenu(false)}>
            <button role="menuitem" onClick={() => confirm('Yeni sunum açılsın mı? Mevcut sunum dışa aktarılmadıysa kaybolur.') && newPres()}>🆕 Yeni sunum</button>
            <button role="menuitem" onClick={() => fileRef.current?.click()}>📥 İçe aktar (.snmtdz / .json)</button>
            <hr />
            <button role="menuitem" onClick={() => exportSnmtdz(pres).then(() => flash('.snmtdz indirildi'))}>💾 Dışa aktar .snmtdz</button>
            <button role="menuitem" onClick={() => exportJson(pres)}>🧾 Dışa aktar JSON</button>
            <button role="menuitem" onClick={() => exportMarkdown(pres)}>📝 Dışa aktar Markdown</button>
            <button role="menuitem" onClick={() => setView('report')}>📄 PDF rapor (Rapor sekmesi)</button>
            <hr />
            <button role="menuitem" onClick={() => setView('templates')}>📚 Şablonlar</button>
            <button role="menuitem" onClick={() => setView('faq')}>❓ SSS</button>
            <button role="menuitem" onClick={() => setView('credits')}>🙏 Credits</button>
          </div>
        )}
      </div>
      {toast && <div className="toast" role="status">{toast}</div>}
    </header>
  );
}
