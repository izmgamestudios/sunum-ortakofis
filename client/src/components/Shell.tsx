// client/src/components/Shell.tsx
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApp } from '../store';
import { useTheme, type ThemeMode } from '../lib/theme';
import { buildReport, fmtDuration } from '../lib/report';
import { CATEGORIES, TEMPLATES, type TemplateCategory } from '../lib/templates';
import { MAX_STEPS } from '../lib/factory';
import type { View } from '../types';
import { BetaBadge, FileMenu, Logo, useDismiss } from './Header';

/* ------------------------------------------------------------------ */
/* Announcement bar                                                    */
/* ------------------------------------------------------------------ */
const ANNOUNCE_KEY = 'teknodoz-sunum:announce-dismissed:v2';

function AnnouncementBar() {
  const setView = useApp((s) => s.setView);
  const openTemplates = useApp((s) => s.openTemplates);
  const items = [
    { text: 'Yeni: konuşmanı canlı yazıya dök — tombala kelimeleri otomatik işaretlensin.', cta: 'SSS’de oku', go: () => setView('faq') },
    { text: '10 kategoride 20 hazır şablonla 1 dakikada sunuma başla.', cta: 'Şablonlara git', go: () => openTemplates() },
  ];
  const [i, setI] = useState(0);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(ANNOUNCE_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  const item = items[i];
  const close = () => {
    setHidden(true);
    try {
      localStorage.setItem(ANNOUNCE_KEY, '1');
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="announce" role="region" aria-label="Duyuru">
      <button className="announce-nav" onClick={() => setI((i - 1 + items.length) % items.length)} aria-label="Önceki duyuru">
        ‹
      </button>
      <p className="announce-text">
        <span className="announce-tag">Duyuru</span>
        <span>{item.text}</span>{' '}
        <button className="announce-cta" onClick={item.go}>
          {item.cta}
        </button>
      </p>
      <span className="announce-count hide-xs">
        {i + 1}/{items.length}
      </span>
      <button className="announce-nav" onClick={() => setI((i + 1) % items.length)} aria-label="Sonraki duyuru">
        ›
      </button>
      <button className="announce-nav" onClick={close} aria-label="Duyuruyu kapat">
        ✕
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Theme switcher                                                      */
/* ------------------------------------------------------------------ */
const THEME_OPTS: { id: ThemeMode; icon: string; label: string }[] = [
  { id: 'light', icon: '☀️', label: 'Açık' },
  { id: 'dark', icon: '🌙', label: 'Koyu' },
  { id: 'system', icon: '💻', label: 'Sistem' },
];

function ThemeSwitcher() {
  const { mode, resolved, setMode } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const icon = mode === 'system' ? '💻' : resolved === 'dark' ? '🌙' : '☀️';
  return (
    <div className="header-actions" ref={ref}>
      <button className="icon-btn icon-btn--ghost" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Tema" title="Tema">
        {icon}
      </button>
      {open && (
        <div className="menu menu--sm" role="menu">
          {THEME_OPTS.map((o) => (
            <button
              key={o.id}
              role="menuitemradio"
              aria-checked={mode === o.id}
              className={mode === o.id ? 'is-active' : ''}
              onClick={() => {
                setMode(o.id);
                setOpen(false);
              }}
            >
              {o.icon} {o.label}
              {mode === o.id && <span className="menu-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mega menus                                                          */
/* ------------------------------------------------------------------ */
type Mega = 'templates' | 'resources' | null;

function TemplatesMega({ onPick }: { onPick: () => void }) {
  const openTemplates = useApp((s) => s.openTemplates);
  const featured = TEMPLATES.filter((t) => ['pitch-deck', 'yapay-zeka-101', 'kendini-tanit'].includes(t.id));
  return (
    <div className="mega-grid">
      <div>
        <p className="mega-title">Kategoriler</p>
        <div className="mega-cats">
          {(Object.keys(CATEGORIES) as TemplateCategory[]).map((c) => (
            <button
              key={c}
              className="mega-link"
              onClick={() => {
                openTemplates(c);
                onPick();
              }}
            >
              <span className="mega-ico" style={{ background: `color-mix(in srgb, ${CATEGORIES[c].color} 15%, transparent)` }}>
                {CATEGORIES[c].emoji}
              </span>
              <span>
                <b>{CATEGORIES[c].label}</b>
                <small>{TEMPLATES.filter((t) => t.category === c).length} şablon</small>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="mega-side">
        <p className="mega-title">Öne çıkanlar</p>
        {featured.map((t) => (
          <button
            key={t.id}
            className="mega-feature"
            onClick={() => {
              openTemplates(t.category);
              onPick();
            }}
          >
            <b>
              {CATEGORIES[t.category].emoji} {t.title}
            </b>
            <small>{t.description}</small>
          </button>
        ))}
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            openTemplates();
            onPick();
          }}
        >
          Tüm şablonlar →
        </button>
      </div>
    </div>
  );
}

function ResourcesMega({ onPick }: { onPick: () => void }) {
  const setView = useApp((s) => s.setView);
  const links: { icon: string; title: string; desc: string; view: View }[] = [
    { icon: '❓', title: 'Sıkça Sorulan Sorular', desc: 'Döküm, canlı oda, veri gizliliği, dışa aktarma', view: 'faq' },
    { icon: '📊', title: 'Rapor & SWOT', desc: 'Skorlar, rozetler, otomatik SWOT analizi', view: 'report' },
    { icon: '📚', title: 'Şablon galerisi', desc: '20 hazır sunum iskeleti', view: 'templates' },
    { icon: '🙏', title: 'Credits', desc: 'Ekip, açık kaynak kütüphaneler, lisanslar', view: 'credits' },
  ];
  return (
    <div className="mega-grid mega-grid--resources">
      <div className="mega-cats mega-cats--2">
        {links.map((l) => (
          <button
            key={l.title}
            className="mega-link"
            onClick={() => {
              setView(l.view);
              onPick();
            }}
          >
            <span className="mega-ico">{l.icon}</span>
            <span>
              <b>{l.title}</b>
              <small>{l.desc}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="mega-side">
        <p className="mega-title">Klavye kısayolları</p>
        <ul className="kbd-list small">
          <li>
            <kbd>→</kbd> / <kbd>PgDn</kbd> sonraki adım
          </li>
          <li>
            <kbd>←</kbd> / <kbd>PgUp</kbd> önceki adım
          </li>
          <li>
            <kbd>Boşluk</kbd> duraklat / devam
          </li>
          <li>
            <kbd>Ctrl</kbd> + <kbd>Enter</kbd> not ekle
          </li>
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */
function SiteHeader() {
  const view = useApp((s) => s.view);
  const phase = useApp((s) => s.live.phase);
  const setView = useApp((s) => s.setView);
  const setDrawer = useApp((s) => s.setDrawer);
  const start = useApp((s) => s.start);
  const [mega, setMega] = useState<Mega>(null);
  const megaRef = useDismiss(mega !== null, () => setMega(null));
  const isLive = phase === 'step' || phase === 'break';

  useEffect(() => setMega(null), [view]);

  const navBtn = (v: View, label: string) => (
    <button className={`nav-link ${view === v ? 'is-active' : ''}`} onClick={() => setView(v)} aria-current={view === v ? 'page' : undefined}>
      {label}
    </button>
  );
  const megaBtn = (m: Exclude<Mega, null>, label: string, activeViews: View[]) => (
    <button
      className={`nav-link ${activeViews.includes(view) ? 'is-active' : ''} ${mega === m ? 'is-open' : ''}`}
      aria-expanded={mega === m}
      aria-haspopup="true"
      onClick={() => setMega(mega === m ? null : m)}
      onMouseEnter={() => setMega(m)}
    >
      {label} <span className="caret">▾</span>
    </button>
  );

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <button className="icon-btn icon-btn--ghost show-md-down" onClick={() => setDrawer(true)} aria-label="Menüyü aç">
          ☰
        </button>
        <button className="brand-block" onClick={() => setView('setup')} aria-label="Teknodoz Sunum ana sayfa">
          <Logo small />
          <span className="brand-text hide-xs">
            <b>Sunum</b>
            <small>Dijital sunum koçu</small>
          </span>
          <span className="beta-chip">BETA</span>
        </button>

        <nav className="main-nav show-lg-up" aria-label="Ana menü" ref={megaRef} onMouseLeave={() => setMega(null)}>
          {navBtn('setup', 'Hazırlık')}
          {navBtn('live', 'Sunum')}
          {navBtn('report', 'Rapor')}
          {megaBtn('templates', 'Şablonlar', ['templates'])}
          {megaBtn('resources', 'Kaynaklar', ['faq', 'credits'])}
          {mega && (
            <div className="mega" role="region" aria-label={mega === 'templates' ? 'Şablonlar menüsü' : 'Kaynaklar menüsü'}>
              {mega === 'templates' ? <TemplatesMega onPick={() => setMega(null)} /> : <ResourcesMega onPick={() => setMega(null)} />}
            </div>
          )}
        </nav>

        <div className="header-right">
          <ThemeSwitcher />
          <FileMenu />
          <button
            className="btn btn-dark header-cta"
            onClick={() => (isLive ? setView('live') : start())}
            title={isLive ? 'Sunuma dön' : 'Sunumu başlat'}
          >
            <span className="hide-sm">{isLive ? 'Sunuma dön' : 'Sunumu başlat'}</span>
            <span aria-hidden>{isLive ? '↩' : '→'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Context bar (title · readiness · score)                             */
/* ------------------------------------------------------------------ */
function ContextBar() {
  const pres = useApp((s) => s.pres);
  const newPresentation = useApp((s) => s.newPresentation);
  const report = useMemo(() => buildReport(pres), [pres]);
  const ready = pres.steps.filter((s) => s.text.trim() || s.attachments.length || s.canvas.length || s.words.length || s.topicTree.length).length;
  const pct = Math.round((ready / pres.steps.length) * 100);
  const total = pres.steps.reduce((a, s) => a + s.durationSec, 0);
  const hasRun = pres.run.steps.length > 0;
  return (
    <div className="context-bar">
      <div className="context-inner">
        <span className="context-ico" aria-hidden>
          🎤
        </span>
        <div className="context-title">
          <b className="truncate">{pres.title || 'Adsız sunum'}</b>
          <small className="truncate">
            {pres.steps.length} adım · {fmtDuration(total)} · {pres.breakConfig.mode === 'none' ? 'molasız' : 'molalı'}
          </small>
        </div>
        <div className="context-progress" title="Hazırlık: metin, medya, tuval veya konu akışı eklenmiş adımlar">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <small>Hazırlık</small>
            <small>%{pct}</small>
          </div>
          <div className="bar-track">
            <span style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="score-box" title={hasRun ? 'Son sunumun genel skoru' : 'Sunum yapılınca hesaplanır'}>
          <small>SKOR</small>
          <b>{hasRun ? report.overallScore : '—'}</b>
        </div>
        <button
          className="icon-btn icon-btn--ghost"
          onClick={() => confirm('Yeni boş sunum açılsın mı? Mevcut sunum dışa aktarılmadıysa kaybolur.') && newPresentation()}
          aria-label="Sıfırla / yeni sunum"
          title="Sıfırla"
        >
          ↻
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar navigation (desktop aside + mobile drawer)                  */
/* ------------------------------------------------------------------ */
function NavGroup({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="nav-group">
      <button className="nav-group-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="nav-dot" aria-hidden />
        <span className="truncate">{title}</span>
        <span className="caret">{open ? '▴' : '▾'}</span>
      </button>
      {open && <div className="nav-group-body">{children}</div>}
    </div>
  );
}

function SidebarNav() {
  const view = useApp((s) => s.view);
  const steps = useApp((s) => s.pres.steps);
  const activeStep = useApp((s) => s.activeStep);
  const phase = useApp((s) => s.live.phase);
  const liveStep = useApp((s) => s.live.stepIndex);
  const templateCategory = useApp((s) => s.templateCategory);
  const { setView, setActiveStep, setStepCount, openTemplates, start } = useApp.getState();
  const isLive = phase === 'step' || phase === 'break';

  const item = (label: ReactNode, active: boolean, onClick: () => void, extra?: ReactNode) => (
    <button className={`side-item ${active ? 'is-active' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined}>
      <span className="truncate">{label}</span>
      {extra}
    </button>
  );

  return (
    <nav className="side-nav" aria-label="Kenar menü">
      <button className="side-cta" onClick={() => (isLive ? setView('live') : start())}>
        ⚡ {isLive ? `Sunuma dön · ${liveStep + 1}. adım` : 'Sunumu başlat'}
      </button>

      <NavGroup title="Hazırlık">
        {item('⚙️ Genel ayarlar', false, () => setView('setup'))}
        {steps.map((s, i) =>
          item(
            <>
              <span className="side-num">{i + 1}</span> {s.title}
            </>,
            view === 'setup' && activeStep === i,
            () => setActiveStep(i),
            <small className="side-min">{Math.round(s.durationSec / 60)} dk</small>,
          ),
        )}
        {steps.length < MAX_STEPS &&
          item('＋ Adım ekle', false, () => {
            setStepCount(steps.length + 1);
            setActiveStep(steps.length);
          })}
      </NavGroup>

      <NavGroup title="Sunum & Rapor">
        {item('🎤 Canlı sunum', view === 'live', () => setView('live'))}
        {item('📊 Rapor & SWOT', view === 'report', () => setView('report'))}
      </NavGroup>

      <NavGroup title="Şablonlar" defaultOpen={view === 'templates'}>
        {item('📚 Tümü', view === 'templates' && templateCategory === 'all', () => openTemplates())}
        {(Object.keys(CATEGORIES) as TemplateCategory[]).map((c) =>
          item(`${CATEGORIES[c].emoji} ${CATEGORIES[c].label}`, view === 'templates' && templateCategory === c, () => openTemplates(c)),
        )}
      </NavGroup>

      <NavGroup title="Yardım" defaultOpen={false}>
        {item('❓ SSS', view === 'faq', () => setView('faq'))}
        {item('🙏 Credits', view === 'credits', () => setView('credits'))}
      </NavGroup>
    </nav>
  );
}

function Drawer() {
  const open = useApp((s) => s.drawerOpen);
  const setDrawer = useApp((s) => s.setDrawer);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, setDrawer]);
  if (!open) return null;
  return (
    <div className="drawer-backdrop" onClick={() => setDrawer(false)}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Menü" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <Logo small />
          <BetaBadge />
          <button className="icon-btn icon-btn--ghost" onClick={() => setDrawer(false)} aria-label="Menüyü kapat">
            ✕
          </button>
        </div>
        <SidebarNav />
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */
function SiteFooter() {
  const { setView, openTemplates } = useApp.getState();
  const link = (label: string, fn: () => void) => (
    <li>
      <button className="footer-link" onClick={fn}>
        {label}
      </button>
    </li>
  );
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <Logo small />
          <p className="small muted">Adım adım, kum saatli, rol yapma destekli sunum koçu. Provayı oyuna, sunumu alışkanlığa dönüştür.</p>
          <BetaBadge />
        </div>
        <div>
          <p className="footer-title">Ürün</p>
          <ul>
            {link('Hazırlık', () => setView('setup'))}
            {link('Canlı sunum', () => setView('live'))}
            {link('Rapor & SWOT', () => setView('report'))}
            {link('Şablonlar', () => openTemplates())}
          </ul>
        </div>
        <div>
          <p className="footer-title">Kaynaklar</p>
          <ul>
            {link('SSS', () => setView('faq'))}
            {link('Credits', () => setView('credits'))}
            {link('.snmtdz formatı', () => setView('faq'))}
          </ul>
        </div>
        <div>
          <p className="footer-title">Teknodoz</p>
          <ul className="small muted">
            <li>Topluluk odaklı ürün ekosistemi</li>
            <li>Verilerin cihazında kalır</li>
            <li>v0.2.0-beta</li>
          </ul>
        </div>
      </div>
      <p className="footer-copy small muted">© {new Date().getFullYear()} izmgamestudios · Teknodoz · MIT Lisansı</p>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile bottom navigation                                            */
/* ------------------------------------------------------------------ */
function BottomNav() {
  const view = useApp((s) => s.view);
  const phase = useApp((s) => s.live.phase);
  const { setView, openTemplates, setDrawer, start } = useApp.getState();
  const isLive = phase === 'step' || phase === 'break';
  const tab = (label: string, icon: string, active: boolean, fn: () => void) => (
    <button className={`bottom-tab ${active ? 'is-active' : ''}`} onClick={fn} aria-current={active ? 'page' : undefined}>
      <span className="bottom-ico" aria-hidden>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
  return (
    <nav className="bottom-nav" aria-label="Alt menü">
      {tab('Hazırlık', '🛠️', view === 'setup', () => setView('setup'))}
      {tab('Şablonlar', '📚', view === 'templates', () => openTemplates())}
      <button className="bottom-main" onClick={() => (isLive ? setView('live') : start())} aria-label={isLive ? 'Sunuma dön' : 'Sunumu başlat'}>
        {isLive ? '🎤' : '▶'}
      </button>
      {tab('Rapor', '📊', view === 'report', () => setView('report'))}
      {tab('Menü', '☰', false, () => setDrawer(true))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */
export function Shell({ children }: { children: ReactNode }) {
  const view = useApp((s) => s.view);
  const focus = view === 'live'; // presentation mode: maximise stage
  const showContext = view === 'setup' || view === 'report';
  return (
    <div className={`app view-${view} ${focus ? 'is-focus' : 'with-bottom'}`}>
      {!focus && <AnnouncementBar />}
      <SiteHeader />
      {showContext && <ContextBar />}
      <div className={`shell-body ${focus ? '' : 'has-sidebar'}`}>
        {!focus && (
          <aside className="sidebar show-lg-up">
            <SidebarNav />
          </aside>
        )}
        <div className="shell-main">{children}</div>
      </div>
      {!focus && <SiteFooter />}
      {!focus && <BottomNav />}
      <Drawer />
    </div>
  );
}
