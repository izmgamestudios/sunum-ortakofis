// client/src/components/IntroOutro.tsx — opening (cover) and closing (thanks + contact) screens, their editor, and per-gap break toggles
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { hasBreakAfter, useApp } from '../store';
import type { Attachment, ContactKind, ContactLink, IntroConfig, OutroConfig, Presentation } from '../types';
import { fileToAttachment } from '../lib/io';

export const CONTACT_META: Record<ContactKind, { icon: string; label: string; placeholder: string }> = {
  email: { icon: '✉️', label: 'E-posta', placeholder: 'ad@ornek.com' },
  phone: { icon: '📞', label: 'Telefon', placeholder: '0541 000 00 00' },
  whatsapp: { icon: '💬', label: 'WhatsApp', placeholder: '905410000000' },
  website: { icon: '🌐', label: 'Web sitesi', placeholder: 'https://…' },
  linkedin: { icon: '💼', label: 'LinkedIn', placeholder: 'https://www.linkedin.com/in/…' },
  instagram: { icon: '📸', label: 'Instagram', placeholder: 'kullaniciadi' },
  x: { icon: '𝕏', label: 'X (Twitter)', placeholder: 'kullaniciadi' },
  youtube: { icon: '▶️', label: 'YouTube', placeholder: '@kanal' },
  github: { icon: '🐙', label: 'GitHub', placeholder: 'kullaniciadi' },
  other: { icon: '🔗', label: 'Bağlantı', placeholder: 'https://…' },
};

const isUrl = (v: string) => /^https?:\/\//i.test(v);
const handle = (v: string) => v.trim().replace(/^@/, '');

/** safe href for a contact (only mailto:, tel:, https://) — null when the value can't be turned into one */
export function contactHref(c: ContactLink): string | null {
  const v = c.value.trim();
  if (!v) return null;
  switch (c.kind) {
    case 'email':
      return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(v) ? `mailto:${v}` : null;
    case 'phone': {
      const d = v.replace(/[^\d+]/g, '');
      return d.length >= 7 ? `tel:${d}` : null;
    }
    case 'whatsapp': {
      if (isUrl(v)) return v;
      let d = v.replace(/\D/g, '');
      if (d.startsWith('0')) d = `90${d.slice(1)}`; // TR local → international
      return d.length >= 10 ? `https://wa.me/${d}` : null;
    }
    case 'linkedin':
      return isUrl(v) ? v : `https://www.linkedin.com/in/${encodeURIComponent(handle(v))}`;
    case 'instagram':
      return isUrl(v) ? v : `https://instagram.com/${encodeURIComponent(handle(v))}`;
    case 'x':
      return isUrl(v) ? v : `https://x.com/${encodeURIComponent(handle(v))}`;
    case 'youtube':
      return isUrl(v) ? v : `https://youtube.com/@${encodeURIComponent(handle(v))}`;
    case 'github':
      return isUrl(v) ? v : `https://github.com/${encodeURIComponent(handle(v))}`;
    default:
      return isUrl(v) ? v : isUrl(`https://${v}`) && /\./.test(v) ? `https://${v}` : null;
  }
}

const imgSrc = (a?: Attachment) => a?.dataUrl ?? a?.url;

/* ------------------------------------------------------------------ */
/* Screens                                                            */
/* ------------------------------------------------------------------ */
export function IntroScreen({ pres, onStart }: { pres: Presentation; onStart?: () => void }) {
  const intro = pres.intro;
  const src = imgSrc(intro?.image);
  return (
    <section className="io-screen io-intro" aria-label="Sunum girişi">
      {src && <img className="io-cover" src={src} alt="Sunum tanıtım görseli" />}
      <div className="io-text">
        <h1>{intro?.title || pres.title}</h1>
        {intro?.subtitle && <p className="io-sub">{intro.subtitle}</p>}
        <p className="io-meta">
          {pres.presenter && <>🎤 {pres.presenter}</>}
          {pres.presenter && pres.audience && ' · '}
          {pres.audience && <>👥 {pres.audience}</>}
        </p>
        <p className="muted small">
          {pres.steps.length} adım · {Math.round(pres.steps.reduce((a, s) => a + s.durationSec, 0) / 60)} dk
        </p>
        {onStart && (
          <button className="btn btn-primary btn-lg" onClick={onStart} autoFocus>
            ▶ Başlayalım
          </button>
        )}
      </div>
    </section>
  );
}

export function OutroScreen({ pres, actions }: { pres: Presentation; actions?: React.ReactNode }) {
  const outro = pres.outro;
  const src = imgSrc(outro?.image);
  const links = (outro?.contacts ?? []).map((c) => ({ c, href: contactHref(c) })).filter((x) => x.href);
  const qrTarget = links.find((x) => ['linkedin', 'website', 'other', 'instagram', 'x', 'youtube', 'github'].includes(x.c.kind))?.href;
  const qrRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (qrTarget && qrRef.current) QRCode.toCanvas(qrRef.current, qrTarget, { width: 150, margin: 1 }).catch(() => undefined);
  }, [qrTarget]);
  return (
    <section className="io-screen io-outro" aria-label="Kapanış ve iletişim">
      {src && <img className="io-cover io-cover--sm" src={src} alt="Kapanış görseli" />}
      <h1 className="io-thanks">{outro?.message || 'Teşekkürler!'}</h1>
      {pres.presenter && <p className="io-meta">🎤 {pres.presenter}</p>}
      {links.length > 0 && (
        <div className="io-contact">
          <ul className="io-links">
            {links.map(({ c, href }, i) => (
              <li key={i}>
                <a href={href!} target={href!.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
                  <span className="io-ico" aria-hidden>
                    {CONTACT_META[c.kind].icon}
                  </span>
                  <span>
                    <small>{c.label || CONTACT_META[c.kind].label}</small>
                    <b>{c.value.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</b>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          {qrTarget && (
            <figure className="io-qr">
              <canvas ref={qrRef} aria-label="İletişim QR kodu" />
              <figcaption className="small muted">Tara, bağlan</figcaption>
            </figure>
          )}
        </div>
      )}
      {actions && <div className="row gap-s wrap center">{actions}</div>}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Editor (setup)                                                     */
/* ------------------------------------------------------------------ */
function ImagePick({ value, onChange, label }: { value?: Attachment; onChange: (a?: Attachment) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return alert('Lütfen bir görsel seç (PNG, JPG, WebP, SVG).');
    setBusy(true);
    try {
      onChange(await fileToAttachment(f));
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const src = imgSrc(value);
  return (
    <div className="io-pick">
      {src ? <img src={src} alt={label} /> : <span className="io-pick-empty">🖼️</span>}
      <div className="row gap-s wrap">
        <button className="btn btn-sm" onClick={() => ref.current?.click()} disabled={busy}>
          {busy ? '⏳' : src ? '🔁 Değiştir' : `📂 ${label}`}
        </button>
        {src && (
          <button className="btn btn-sm btn-ghost" onClick={() => onChange(undefined)}>
            🗑️ Kaldır
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => (void pick(e.target.files?.[0]), (e.target.value = ''))} />
    </div>
  );
}

export function IntroOutroEditor() {
  const pres = useApp((s) => s.pres);
  const updatePres = useApp((s) => s.updatePres);
  const [preview, setPreview] = useState<'intro' | 'outro' | null>(null);
  const intro: IntroConfig = pres.intro ?? { enabled: false };
  const outro: OutroConfig = pres.outro ?? { enabled: false, message: 'Teşekkürler!', contacts: [] };
  const setIntro = (p: Partial<IntroConfig>) => updatePres({ intro: { ...intro, ...p } });
  const setOutro = (p: Partial<OutroConfig>) => updatePres({ outro: { ...outro, ...p } });
  const setContact = (i: number, p: Partial<ContactLink>) => setOutro({ contacts: outro.contacts.map((c, j) => (j === i ? { ...c, ...p } : c)) });

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPreview(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  return (
    <div className="stack">
      <fieldset className="fs">
        <legend>
          <label className="switch">
            <input type="checkbox" checked={intro.enabled} onChange={(e) => setIntro({ enabled: e.target.checked })} />
            <span>🎬 Giriş (intro)</span>
          </label>
        </legend>
        {intro.enabled && (
          <div className="stack">
            <p className="muted small">Sunum başlayınca önce bu tanıtım ekranı gelir; 1. adımın süresi “Başlayalım”a basınca işler.</p>
            <ImagePick value={intro.image} onChange={(image) => setIntro({ image })} label="Tanıtım görseli" />
            <input className="input" placeholder={`Başlık (boşsa: ${pres.title})`} value={intro.title ?? ''} onChange={(e) => setIntro({ title: e.target.value || undefined })} />
            <input className="input" placeholder="Alt başlık — etkinlik, tarih, slogan…" value={intro.subtitle ?? ''} onChange={(e) => setIntro({ subtitle: e.target.value || undefined })} />
            <button className="btn btn-sm btn-ghost" onClick={() => setPreview('intro')}>
              👁️ Önizle
            </button>
          </div>
        )}
      </fieldset>

      <fieldset className="fs">
        <legend>
          <label className="switch">
            <input type="checkbox" checked={outro.enabled} onChange={(e) => setOutro({ enabled: e.target.checked })} />
            <span>🙏 Kapanış (outro)</span>
          </label>
        </legend>
        {outro.enabled && (
          <div className="stack">
            <p className="muted small">Son adım bitince teşekkür ve iletişim ekranı gelir; rapor oradan bir tık.</p>
            <ImagePick value={outro.image} onChange={(image) => setOutro({ image })} label="Kapanış görseli" />
            <input className="input" placeholder="Teşekkürler!" value={outro.message} onChange={(e) => setOutro({ message: e.target.value })} />
            <div className="io-contacts-edit">
              {outro.contacts.map((c, i) => (
                <div key={i} className="io-contact-row">
                  <select className="seg-select" value={c.kind} onChange={(e) => setContact(i, { kind: e.target.value as ContactKind })} aria-label="Bağlantı türü">
                    {(Object.keys(CONTACT_META) as ContactKind[]).map((k) => (
                      <option key={k} value={k}>
                        {CONTACT_META[k].icon} {CONTACT_META[k].label}
                      </option>
                    ))}
                  </select>
                  <input
                    className={`input ${c.value && !contactHref(c) ? 'is-invalid' : ''}`}
                    placeholder={CONTACT_META[c.kind].placeholder}
                    value={c.value}
                    onChange={(e) => setContact(i, { value: e.target.value })}
                    aria-label={CONTACT_META[c.kind].label}
                  />
                  <button className="icon-btn icon-btn--ghost" onClick={() => setOutro({ contacts: outro.contacts.filter((_, j) => j !== i) })} aria-label="Kaldır">
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="row gap-s wrap">
              {(['email', 'phone', 'whatsapp', 'linkedin', 'instagram', 'website'] as ContactKind[]).map((k) => (
                <button key={k} className="btn btn-sm" onClick={() => setOutro({ contacts: [...outro.contacts, { kind: k, value: '' }] })}>
                  ＋ {CONTACT_META[k].icon} {CONTACT_META[k].label}
                </button>
              ))}
              <button className="btn btn-sm" onClick={() => setOutro({ contacts: [...outro.contacts, { kind: 'x', value: '' }] })}>
                ＋ diğer…
              </button>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={() => setPreview('outro')}>
              👁️ Önizle
            </button>
          </div>
        )}
      </fieldset>

      {preview && (
        <div className="modal-backdrop" onClick={() => setPreview(null)}>
          <div className="modal io-preview" role="dialog" aria-modal="true" aria-label="Önizleme" onClick={(e) => e.stopPropagation()}>
            <button className="icon-btn icon-btn--ghost io-preview-x" onClick={() => setPreview(null)} aria-label="Kapat">
              ✕
            </button>
            {preview === 'intro' ? <IntroScreen pres={pres} /> : <OutroScreen pres={pres} />}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Per-gap transition switch (between step i and i+1)                */
/* ------------------------------------------------------------------ */
export function GapToggle({ index, compact = false }: { index: number; compact?: boolean }) {
  const pres = useApp((s) => s.pres);
  const toggle = useApp((s) => s.toggleBreakAfter);
  const on = hasBreakAfter(pres, index);
  const label = `${index + 1} → ${index + 2} arası geçiş molası: ${on ? 'açık' : 'kapalı'} (değiştirmek için tıkla)`;
  return (
    <button className={`gap-toggle ${on ? 'is-on' : 'is-off'} ${compact ? 'gap-toggle--sm' : ''}`} onClick={() => toggle(index)} aria-pressed={on} aria-label={label} title={label}>
      <span aria-hidden>{on ? '🫁' : '⏭'}</span>
      {!compact && <small>{on ? 'mola' : 'geç'}</small>}
    </button>
  );
}
