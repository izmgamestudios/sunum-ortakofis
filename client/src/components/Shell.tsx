// client/src/components/Shell.tsx
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccountChip } from './Account';
import { RecordConsent } from './Recordings';
import { useApp } from '../store';
import { useTheme, type ThemeMode } from '../lib/theme';
import { buildReport, fmtDuration } from '../lib/report';
import { CATEGORIES, TEMPLATES, type TemplateCategory } from '../lib/templates';
import { FRAMEWORKS } from '../lib/frameworks';
import { MAX_STEPS } from '../lib/factory';
import type { View } from '../types';
import { BetaBadge, FileMenu, Logo, useDismiss } from './Header';
import { SearchPalette, SearchTrigger } from './Search';
import { ShareDialog } from './ShareDialog';
import { useCloud, pullNow, pushNow } from '../lib/cloud';
import { useLibrary } from '../lib/library';
import { ShortcutsModal, useGlobalShortcuts } from './Shortcuts';
import { FAQS, GUIDE } from '../lib/help';
import { keyLabel } from '../lib/shortcuts';
import { APP_VERSION, AUTHOR, REPO } from '../lib/about';

/* ------------------------------------------------------------------ */
/* Announcement bar                                                    */
/* ------------------------------------------------------------------ */
const ANNOUNCE_KEY = 'teknodoz-sunum:announce-dismissed:v2';

function AnnouncementBar() {
  const openTemplates = useApp((s) => s.openTemplates);
  const items = [
    { text: 'Yeni: Ctrl+K ile her şeyi ara — menüler, ayarlar, şablonlar, modeller, kılavuz ve kendi içeriğin.', cta: 'Kılavuzu aç', go: () => useApp.getState().openHelp('guide', 'arama-kisayol-tema') },
    { text: `Yeni: ${FRAMEWORKS.length} düşünme modeli (Ikigai, SWOT, OKR…) — şablon olarak ya da tuvale düzenlenebilir infografik olarak.`, cta: 'Modellere git', go: () => openTemplates('cerceve') },
    { text: `${Object.keys(CATEGORIES).length} kategoride ${TEMPLATES.length} hazır şablonla 1 dakikada sunuma başla.`, cta: 'Şablonlara git', go: () => openTemplates() },
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

export function ThemeSwitcher() {
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
  const { openHelp, setView, setShortcutsOpen } = useApp.getState();
  const links: { icon: string; title: string; desc: string; run: () => void }[] = [
    { icon: '📖', title: 'Kılavuz', desc: `${GUIDE.length} adım adım rehber makalesi`, run: () => openHelp('guide') },
    { icon: '❓', title: 'Sıkça Sorulan Sorular', desc: `${FAQS.length} soru: döküm, canlı oda, tuval, veri`, run: () => openHelp('faq') },
    { icon: '⌨️', title: 'Klavye kısayolları', desc: 'Ctrl+K arama, G+harf gezinme, tuval tuşları', run: () => setShortcutsOpen(true) },
    { icon: '🩺', title: 'Sorun giderme', desc: 'Zil, mikrofon, PDF, bağlantı, 502…', run: () => openHelp('troubleshoot') },
    { icon: '🛟', title: 'Destek', desc: 'Sistem bilgisi, geri bildirim', run: () => openHelp('support') },
    { icon: '🌍', title: '1 piksel = 1 insan', desc: 'Dünya nüfusu kadar piksel: ekran ölçüsü, adım adım açılan resim', run: () => setView('pixels') },
    { icon: '🙏', title: 'Hakkında & Credits', desc: 'Geliştirici, iletişim, açık kaynak (GitHub)', run: () => setView('credits') },
  ];
  return (
    <div className="mega-grid mega-grid--resources">
      <div className="mega-cats mega-cats--2">
        {links.map((l) => (
          <button
            key={l.title}
            className="mega-link"
            onClick={() => {
              l.run();
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
        <p className="mega-title">Sık kullanılan kısayollar</p>
        <ul className="kbd-list small">
          <li>
            <kbd>{keyLabel('Mod')}</kbd> + <kbd>K</kbd> her şeyi ara
          </li>
          <li>
            <kbd>→</kbd> / <kbd>←</kbd> adım · <kbd>Boşluk</kbd> duraklat
          </li>
          <li>
            <kbd>F</kbd> tam ekran · <kbd>B</kbd> zil
          </li>
          <li>
            <kbd>G</kbd> <kbd>T</kbd> şablonlar · <kbd>G</kbd> <kbd>Y</kbd> yardım
          </li>
          <li>
            <kbd>?</kbd> tüm liste
          </li>
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */
/** Cloud sync state of the open presentation (only shown when it is shared). */
function CloudChip() {
  const presId = useApp((s) => s.pres.id);
  const link = useLibrary((s) => s.entries.find((e) => e.id === presId)?.cloud);
  const status = useCloud((s) => s.status);
  if (!link) return null;
  const map: Record<string, [string, string]> = {
    saving: ['⏳', 'Kaydediliyor…'],
    saved: ['☁️', 'Buluta kaydedildi'],
    conflict: ['⚠️', 'Çakışma'],
    error: ['⚠️', 'Kaydedilemedi'],
    deleted: ['🚫', 'Paylaşım kaldırıldı'],
    readonly: ['🔒', 'Düzenleme izni yok'],
    local: ['☁️', 'Bulut'],
  };
  const [icon, label] = map[status] ?? map.saved;
  return (
    <span className={`cloud-chip cloud-chip--${status}`} title={`${label} · ${link.role === 'owner' ? 'sahibisin' : 'düzenleyicisin'}`}>
      {icon} <span className="cloud-chip-label">{link.role === 'editor' ? '✏️ ' : ''}{label}</span>
    </span>
  );
}

function CloudBanner() {
  const { status, message } = useCloud();
  if (!['conflict', 'error', 'deleted', 'readonly'].includes(status)) return null;
  return (
    <div className={`cloud-banner cloud-banner--${status}`} role="alert">
      <span>⚠️ {message}</span>
      {status === 'conflict' && (
        <span className="row gap-s">
          <button className="btn btn-sm" onClick={() => void pullNow()}>⬇️ Sunucudakini yükle</button>
          <button className="btn btn-sm" onClick={() => confirm('Sunucudaki değişikliklerin üzerine yazılsın mı?') && void pushNow(true)}>⬆️ Benimkini kaydet</button>
        </span>
      )}
      {status === 'error' && (
        <button className="btn btn-sm" onClick={() => void pushNow(false)}>↻ Tekrar dene</button>
      )}
    </div>
  );
}

function SiteHeader() {
  const view = useApp((s) => s.view);
  const phase = useApp((s) => s.live.phase);
  const setView = useApp((s) => s.setView);
  const setDrawer = useApp((s) => s.setDrawer);
  const start = useApp((s) => s.start);
  const [mega, setMega] = useState<Mega>(null);
  const [shareOpen, setShareOpen] = useState(false);
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
          {navBtn('library', 'Sunumlarım')}
          {navBtn('setup', 'Hazırlık')}
          {navBtn('live', 'Sunum')}
          {navBtn('report', 'Rapor')}
          {megaBtn('templates', 'Şablonlar', ['templates'])}
          {megaBtn('resources', 'Kaynaklar', ['faq', 'credits', 'pixels'])}
          {mega && (
            <div className="mega" role="region" aria-label={mega === 'templates' ? 'Şablonlar menüsü' : 'Kaynaklar menüsü'}>
              {mega === 'templates' ? <TemplatesMega onPick={() => setMega(null)} /> : <ResourcesMega onPick={() => setMega(null)} />}
            </div>
          )}
        </nav>

        <div className="header-right">
          <AccountChip />
          <CloudChip />
          <button className="btn btn-ghost header-share" onClick={() => setShareOpen(true)} title="Paylaş: özel / bağlantıyla / herkese açık / şifreli">
            🔗 <span className="hide-md">Paylaş</span>
          </button>
          <SearchTrigger />
          <ThemeSwitcher />
          <FileMenu />
          <button
            className="btn btn-dark header-cta"
            onClick={() => (isLive ? setView('live') : start())}
            title={isLive ? 'Sunuma dön' : 'Sunumu başlat'}
          >
            <span className="hide-md">{isLive ? 'Sunuma dön' : 'Sunumu başlat'}</span>
            <span aria-hidden>{isLive ? '↩' : '→'}</span>
          </button>
        </div>
      </div>
      {shareOpen && <ShareDialog onClose={() => setShareOpen(false)} />}
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
  const helpTab = useApp((s) => s.helpTab);
  const { setView, setActiveStep, setStepCount, openTemplates, start, openHelp } = useApp.getState();
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

      <NavGroup title="Sunumlarım">
        {item('🗂️ Tüm sunumlarım', view === 'library', () => setView('library'))}
        {item('🌍 Keşfet (herkese açık)', false, () => setView('library'))}
      </NavGroup>

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

      <NavGroup title="Yardım" defaultOpen={view === 'faq' || view === 'credits'}>
        {item('📖 Kılavuz', view === 'faq' && helpTab === 'guide', () => openHelp('guide'))}
        {item('❓ SSS', view === 'faq' && helpTab === 'faq', () => openHelp('faq'))}
        {item('⌨️ Kısayollar', false, () => useApp.getState().setShortcutsOpen(true))}
        {item('🩺 Sorun giderme', view === 'faq' && helpTab === 'troubleshoot', () => openHelp('troubleshoot'))}
        {item('🛟 Destek', view === 'faq' && helpTab === 'support', () => openHelp('support'))}
        {item('🌍 1 piksel = 1 insan', view === 'pixels', () => setView('pixels'))}
        {item('🙏 Hakkında & Credits', view === 'credits', () => setView('credits'))}
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
            {link('Kılavuz', () => useApp.getState().openHelp('guide'))}
            {link('SSS', () => useApp.getState().openHelp('faq'))}
            {link('Kısayollar', () => useApp.getState().setShortcutsOpen(true))}
            {link('Sorun giderme', () => useApp.getState().openHelp('troubleshoot'))}
            {link('.snmtdz formatı', () => useApp.getState().openHelp('guide', 'disa-aktarma'))}
            {link('1 piksel = 1 insan', () => setView('pixels'))}
            {link('Hakkında & Credits', () => setView('credits'))}
          </ul>
        </div>
        <div>
          <p className="footer-title">Teknodoz · Açık kaynak</p>
          <ul className="small">
            <li>
              <a className="footer-link" href={REPO.url} target="_blank" rel="noopener noreferrer">
                ⭐ GitHub — katkılarınızı bekliyoruz
              </a>
            </li>
            <li>
              <a className="footer-link" href={AUTHOR.linkedin} target="_blank" rel="noopener noreferrer">
                💼 {AUTHOR.name}
              </a>
            </li>
            <li>
              <a className="footer-link" href={AUTHOR.whatsapp} target="_blank" rel="noopener noreferrer">
                💬 WhatsApp
              </a>{' '}
              ·{' '}
              <a className="footer-link" href={`mailto:${AUTHOR.email}`}>
                ✉️ E-posta
              </a>
            </li>
            <li className="muted">v{APP_VERSION} · verilerin cihazında kalır</li>
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
  const { setView, setDrawer, start } = useApp.getState();
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
      {tab('Sunumlarım', '🗂️', view === 'library', () => setView('library'))}
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
  useGlobalShortcuts();
  const focus = view === 'live'; // presentation mode: maximise stage
  const showContext = view === 'setup' || view === 'report';
  return (
    <div className={`app view-${view} ${focus ? 'is-focus' : 'with-bottom'}`}>
      {!focus && <AnnouncementBar />}
      <SiteHeader />
      <CloudBanner />
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
      <SearchPalette />
      <ShortcutsModal />
      <RecordConsent />
    </div>
  );
}
