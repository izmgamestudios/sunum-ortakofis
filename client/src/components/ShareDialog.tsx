// client/src/components/ShareDialog.tsx — owner chooses visibility, link role, password; editors see the link only
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { useApp } from '../store';
import { useLibrary, type LinkRole, type Visibility } from '../lib/library';
import { shareCurrent, shareUrl, unshare, updateSettings } from '../lib/cloud';

const VIS: { id: Visibility; icon: string; title: string; desc: string }[] = [
  { id: 'private', icon: '🔒', title: 'Özel', desc: 'Yalnızca sen. Bağlantı çalışmaz; bulut kopyası sende kalır.' },
  { id: 'link', icon: '🔗', title: 'Bağlantıya sahip olanlar', desc: 'Listelenmez; bağlantıyı bilen herkes açabilir.' },
  { id: 'public', icon: '🌍', title: 'Herkese açık', desc: 'Keşfet sayfasında listelenir, herkes açabilir.' },
  { id: 'password', icon: '🔑', title: 'Şifreli', desc: 'Bağlantı + şifre gerekir.' },
];

const ROLES: { id: LinkRole; icon: string; title: string; desc: string }[] = [
  { id: 'viewer', icon: '👀', title: 'Sadece izleme (anonim)', desc: 'Sunumu salt okunur görür: adımlar, tuval, medya. Değiştiremez.' },
  { id: 'editor', icon: '✏️', title: 'Düzenleme (admin)', desc: 'Bağlantıyla gelen herkes sunumu değiştirebilir. Ayarları ve silmeyi yalnızca sen yaparsın.' },
];

export function ShareDialog({ onClose }: { onClose: () => void }) {
  const pres = useApp((s) => s.pres);
  const link = useLibrary((s) => s.entries.find((e) => e.id === pres.id)?.cloud);
  const [visibility, setVisibility] = useState<Visibility>(link?.visibility ?? 'link');
  const [linkRole, setLinkRole] = useState<LinkRole>(link?.linkRole ?? 'viewer');
  const [password, setPassword] = useState('');
  const [includeReport, setIncludeReport] = useState(link?.includeReport ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const isOwner = !link || link.role === 'owner';
  const url = link ? shareUrl(link.shareId) : '';

  useEffect(() => {
    if (url && qrRef.current && link?.visibility !== 'private') QRCode.toCanvas(qrRef.current, url, { width: 150, margin: 1 }).catch(() => undefined);
  }, [url, link?.visibility]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = (text: string, what: string) =>
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const settings = { visibility, linkRole, password: password || undefined };
      if (!link) await shareCurrent(settings, includeReport);
      else await updateSettings(pres.id, settings, includeReport);
      setPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm('Paylaşım kaldırılsın mı? Bağlantı çalışmayı bırakır; sunum bu cihazda özel olarak kalır.')) return;
    setBusy(true);
    try {
      await unshare(pres.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kaldırılamadı');
    } finally {
      setBusy(false);
    }
  };

  // a new password is required unless the share is already password-protected
  const needsPw = visibility === 'password' && link?.visibility !== 'password';

  // portal: the sticky header uses backdrop-filter, which would trap a fixed-position modal inside it
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal share-modal" role="dialog" aria-modal="true" aria-label="Sunumu paylaş" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          e.stopPropagation();
        }}>
        <header className="modal-head">
          <h2>🔗 Paylaş — {pres.title}</h2>
          <button className="icon-btn icon-btn--ghost" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </header>
        <div className="modal-scroll stack">
          {!isOwner ? (
            <div className="callout">
              ✏️ Bu sunumu <b>düzenleme bağlantısıyla</b> açtın. Değişikliklerin herkesle senkronlanır; paylaşım ayarlarını ve silmeyi yalnızca sunum sahibi yapabilir.
            </div>
          ) : (
            <>
              <fieldset className="fs">
                <legend>Kimler görebilir?</legend>
                <div className="choice-grid">
                  {VIS.map((v) => (
                    <button key={v.id} className={`choice ${visibility === v.id ? 'is-active' : ''}`} onClick={() => setVisibility(v.id)} aria-pressed={visibility === v.id}>
                      <span className="choice-ico">{v.icon}</span>
                      <b>{v.title}</b>
                      <small>{v.desc}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
              {visibility === 'password' && (
                <label className="stack">
                  <span className="small muted">{link?.visibility === 'password' ? 'Yeni şifre (boş bırakırsan eskisi kalır)' : 'Şifre (en az 4 karakter)'}</span>
                  <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••" />
                </label>
              )}
              {visibility !== 'private' && (
                <fieldset className="fs">
                  <legend>Bağlantıyla gelenler ne yapabilir?</legend>
                  <div className="choice-grid choice-grid--2">
                    {ROLES.map((r) => (
                      <button key={r.id} className={`choice ${linkRole === r.id ? 'is-active' : ''}`} onClick={() => setLinkRole(r.id)} aria-pressed={linkRole === r.id}>
                        <span className="choice-ico">{r.icon}</span>
                        <b>{r.title}</b>
                        <small>{r.desc}</small>
                      </button>
                    ))}
                  </div>
                  {linkRole === 'editor' && (visibility === 'public' || visibility === 'link') && (
                    <p className="warn small">⚠️ {visibility === 'public' ? 'Herkese açık' : 'Bağlantıya sahip'} + düzenleme: bağlantıyı bulan herkes içeriği değiştirebilir. Ekip içi kullanım için “Şifreli” önerilir.</p>
                  )}
                </fieldset>
              )}
              <label className="switch small">
                <input type="checkbox" checked={includeReport} onChange={(e) => setIncludeReport(e.target.checked)} />
                <span>Rapor verilerini de paylaş (notlar, anonim sohbet, konuşma dökümü, skorlar)</span>
              </label>
              {error && <p className="error small">{error}</p>}
              <div className="row gap-s wrap">
                <button className="btn btn-primary" onClick={save} disabled={busy || (needsPw && password.length < 4)}>
                  {busy ? '⏳' : link ? '💾 Ayarları kaydet' : '☁️ Paylaş ve bağlantı oluştur'}
                </button>
                {link && (
                  <button className="btn btn-ghost" onClick={remove} disabled={busy}>
                    🗑️ Paylaşımı kaldır
                  </button>
                )}
              </div>
            </>
          )}

          {link && (
            <section className="share-link card">
              {link.visibility === 'private' ? (
                <p className="muted small">🔒 Şu an özel: bağlantı başkaları için çalışmıyor. Görünürlüğü değiştirip kaydet.</p>
              ) : (
                <div className="share-link-row">
                  <canvas ref={qrRef} className="share-qr" aria-label="Paylaşım QR kodu" />
                  <div className="stack">
                    <p className="small muted">
                      {VIS.find((v) => v.id === link.visibility)?.icon} {VIS.find((v) => v.id === link.visibility)?.title} · {ROLES.find((r) => r.id === link.linkRole)?.icon}{' '}
                      {ROLES.find((r) => r.id === link.linkRole)?.title}
                    </p>
                    <div className="row gap-s">
                      <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Paylaşım bağlantısı" />
                      <button className="btn" onClick={() => copy(url, 'link')}>
                        {copied === 'link' ? '✅' : '📋'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {isOwner && link.ownerKey && (
                <details className="owner-key">
                  <summary>🔐 Sahip anahtarını yedekle</summary>
                  <p className="small muted">
                    Sahiplik bu tarayıcıda saklanır. Başka cihazda sahip olarak açmak için bu metni sakla ve Sunumlarım → “Sahip anahtarıyla aç” ile kullan. Kimseyle paylaşma.
                  </p>
                  <div className="row gap-s">
                    <input className="input" readOnly value={`${link.shareId}:${link.ownerKey}`} onFocus={(e) => e.target.select()} aria-label="Sahip anahtarı" />
                    <button className="btn" onClick={() => copy(`${link.shareId}:${link.ownerKey}`, 'key')}>
                      {copied === 'key' ? '✅' : '📋'}
                    </button>
                  </div>
                </details>
              )}
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
