// client/src/components/Header.tsx
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store';
import { exportJson, exportMarkdown, exportSnmtdz, importFile, SNMTDZ_EXT } from '../lib/io';
import { APP_EVENTS } from '../lib/nav';

export function BetaBadge() {
  return <span className="beta-badge">Beta · Erken Erişim</span>;
}

export function Logo({ small = false }: { small?: boolean }) {
  return <img src="/teknodoz-logo.svg" alt="Teknodoz" className={`logo ${small ? 'logo--sm' : ''}`} />;
}

/** Close a popover on outside click / Escape. */
export function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  };
  const node = toast ? (
    <div className="toast" role="status">
      {toast}
    </div>
  ) : null;
  return { flash, node };
}

export function FileMenu() {
  const pres = useApp((s) => s.pres);
  const setView = useApp((s) => s.setView);
  const load = useApp((s) => s.loadPresentation);
  const newPres = useApp((s) => s.newPresentation);
  const openTemplates = useApp((s) => s.openTemplates);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const { flash, node } = useToast();

  useEffect(() => {
    const open = () => fileRef.current?.click();
    window.addEventListener(APP_EVENTS.import, open);
    return () => window.removeEventListener(APP_EVENTS.import, open);
  }, []);

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
    <div className="header-actions" ref={ref}>
      <input
        ref={fileRef}
        type="file"
        hidden
        accept={`${SNMTDZ_EXT},.json,application/json`}
        onChange={(e) => {
          onImport(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button className="icon-btn icon-btn--ghost" onClick={() => setOpen((m) => !m)} aria-expanded={open} aria-haspopup="menu" aria-label="Dosya menüsü" title="Dosya">
        📁
      </button>
      {open && (
        <div className="menu" role="menu" onClick={() => setOpen(false)}>
          <button role="menuitem" onClick={() => confirm('Yeni sunum açılsın mı? Mevcut sunum dışa aktarılmadıysa kaybolur.') && newPres()}>
            🆕 Yeni sunum
          </button>
          <button role="menuitem" onClick={() => fileRef.current?.click()}>
            📥 İçe aktar (.snmtdz / .json)
          </button>
          <hr />
          <button role="menuitem" onClick={() => exportSnmtdz(pres).then(() => flash('.snmtdz indirildi'))}>
            💾 Dışa aktar .snmtdz
          </button>
          <button role="menuitem" onClick={() => exportJson(pres)}>
            🧾 Dışa aktar JSON
          </button>
          <button role="menuitem" onClick={() => exportMarkdown(pres)}>
            📝 Dışa aktar Markdown
          </button>
          <button role="menuitem" onClick={() => setView('report')}>
            📄 PDF rapor (Rapor sekmesi)
          </button>
          <hr />
          <button role="menuitem" onClick={() => openTemplates()}>
            📚 Şablonlar
          </button>
          <button role="menuitem" onClick={() => useApp.getState().openHelp('guide')}>
            📖 Kılavuz & yardım
          </button>
          <button role="menuitem" onClick={() => useApp.getState().openHelp('faq')}>
            ❓ SSS
          </button>
          <button role="menuitem" onClick={() => useApp.getState().setShortcutsOpen(true)}>
            ⌨️ Kısayollar
          </button>
          <button role="menuitem" onClick={() => setView('credits')}>
            🙏 Credits
          </button>
        </div>
      )}
      {node}
    </div>
  );
}
