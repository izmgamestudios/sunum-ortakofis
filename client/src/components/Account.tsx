// client/src/components/Account.tsx — e-mail code login, account chip (header) and sync banner (library)
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { requestCode, verifyCode } from '../lib/auth';
import { logout, migrateLocal, onLogin, syncDown, unlinkedCount, useAccount } from '../lib/account';
import { useLibrary } from '../lib/library';
import { formatBytes } from '../lib/io';
import { useDismiss } from './Header';

/** two-step e-mail → 6-digit code form */
export function LoginForm({ onDone, intro }: { onDone: (email: string) => void; intro?: React.ReactNode }) {
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dev, setDev] = useState(false);
  const send = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await requestCode(email);
      setDev(!!r.dev);
      setCode('');
      setStage('code');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Kod gönderilemedi');
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await verifyCode(email, code);
      onDone(r.email);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Giriş yapılamadı');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="stack login-form">
      {intro}
      {stage === 'email' ? (
        <>
          <input className="input" type="email" autoFocus autoComplete="email" value={email} placeholder="E-posta adresin" onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && email && send()} aria-label="E-posta" />
          <button className="btn btn-primary" disabled={!email || busy} onClick={send}>
            {busy ? '⏳' : 'Kod gönder →'}
          </button>
        </>
      ) : (
        <>
          <p className="small">
            <b>{email}</b> adresine 6 haneli kod gönderdik.{' '}
            <button className="link-btn" onClick={() => setStage('email')}>
              değiştir
            </button>
          </p>
          {dev && <p className="warn small">Geliştirme modu: e-posta ayarı yok, kod sunucu günlüğünde.</p>}
          <input
            className="input code-input"
            inputMode="numeric"
            autoFocus
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            placeholder="••••••"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && verify()}
            aria-label="6 haneli kod"
          />
          <button className="btn btn-primary" disabled={code.length !== 6 || busy} onClick={verify}>
            {busy ? '⏳' : 'Giriş yap'}
          </button>
          <button className="link-btn small" onClick={send} disabled={busy}>
            Kodu yeniden gönder
          </button>
        </>
      )}
      {err && <p className="error small">{err}</p>}
    </div>
  );
}

export function LoginDialog({ onClose }: { onClose: () => void }) {
  const [migrate, setMigrate] = useState<number | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const done = async (email: string) => {
    await onLogin(email);
    const n = unlinkedCount();
    if (n > 0) setMigrate(n);
    else onClose();
  };
  const runMigrate = async () => {
    setProgress('⏳ Taşınıyor…');
    await migrateLocal((d, t) => setProgress(`⏳ ${d}/${t} sunum taşındı…`));
    setProgress('✅ Taşındı');
    setTimeout(onClose, 700);
  };
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal login-modal" role="dialog" aria-modal="true" aria-label="Giriş yap" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>{migrate === null ? '☁️ Giriş yap' : '📦 Bu cihazdaki sunumlar'}</h2>
          <button className="icon-btn icon-btn--ghost" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </header>
        <div className="modal-scroll stack">
          {migrate === null ? (
            <LoginForm
              onDone={done}
              intro={
                <p className="muted small">
                  Şifre yok: e-postana gelen 6 haneli kodla girersin. Giriş yapınca sunumların hesabına kaydedilir ve <b>her cihazda aynı “Sunumlarım”</b> görünür. Ses ve ekran kayıtları
                  cihazında kalır.
                </p>
              }
            />
          ) : (
            <>
              <p>
                Bu cihazda hesabına bağlı olmayan <b>{migrate}</b> sunum var. Hesabına taşırsan diğer cihazlarında da görünür; bu cihazdaki kopyalar da yerinde kalır.
              </p>
              {progress ? (
                <p>{progress}</p>
              ) : (
                <div className="row gap-s wrap">
                  <button className="btn btn-primary" onClick={runMigrate}>
                    📦 Hesabıma taşı
                  </button>
                  <button className="btn btn-ghost" onClick={onClose}>
                    Şimdilik değil
                  </button>
                </div>
              )}
              <p className="muted small">Bundan sonra oluşturduğun sunumlar otomatik olarak hesabına kaydedilir.</p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

const ICON: Record<string, string> = { off: '👤', idle: '☁️', syncing: '🔄', error: '⚠️' };

/** header chip: sign in / account menu */
export function AccountChip() {
  const { email, sync, message, lastSync } = useAccount();
  const [open, setOpen] = useState(false);
  const [login, setLogin] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  // the dialog must outlive the signed-out chip (it continues with the "move my presentations" step)
  const dialog = login && <LoginDialog onClose={() => setLogin(false)} />;
  // same element tree signed in or out, so the dialog keeps its state across the login
  const short = email ? email.replace(/^(.{3}).*(@.*)$/, '$1…$2') : '';
  return (
    <div className="account-wrap" ref={ref}>
      {!email ? (
        <button className="btn btn-ghost account-chip" onClick={() => setLogin(true)} title="Giriş yap — sunumların her cihazında olsun">
          👤 <span className="hide-md">Giriş</span>
        </button>
      ) : (
        <button className={`btn btn-ghost account-chip is-${sync}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} title={message ?? `Hesap: ${email}`}>
          {ICON[sync]} <span className="hide-md truncate">{short}</span>
        </button>
      )}
      {email && open && (
        <div className="account-menu" role="menu">
          <p className="small">
            <b>{email}</b>
          </p>
          <p className="small muted">
            {sync === 'syncing' ? '🔄 Senkronlanıyor…' : sync === 'error' ? `⚠️ ${message}` : `☁️ Senkron${lastSync ? ` · ${new Date(lastSync).toLocaleTimeString('tr-TR')}` : ''}`}
          </p>
          {message && sync !== 'error' && <p className="small">{message}</p>}
          <button className="btn btn-sm" role="menuitem" onClick={() => void syncDown()}>
            ↻ Şimdi senkronla
          </button>
          <button className="btn btn-sm btn-ghost" role="menuitem" onClick={() => (setOpen(false), void logout())}>
            ⎋ Çıkış yap
          </button>
        </div>
      )}
      {dialog}
    </div>
  );
}

/** library banner: sign-in prompt, migration, quota */
export function SyncBanner() {
  const { email, used, quota, message, sync } = useAccount();
  const entries = useLibrary((s) => s.entries);
  const unlinked = entries.filter((e) => !e.account).length;
  const [login, setLogin] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  const dialog = login && <LoginDialog onClose={() => setLogin(false)} />;
  if (!email)
    return (
      <div className="sync-banner">
        <span>☁️ Giriş yap, sunumların <b>her cihazda</b> aynı olsun. Şifre yok, e-postana kod gelir.</span>
        <button className="btn btn-primary btn-sm" onClick={() => setLogin(true)}>
          Giriş yap
        </button>
        {dialog}
      </div>
    );
  return (
    <div className={`sync-banner is-on ${sync === 'error' ? 'is-error' : ''}`}>
      <span>
        ☁️ <b>{email}</b> · {quota ? `${formatBytes(used)} / ${formatBytes(quota)}` : 'senkron açık'}
        {message && <> · {message}</>}
      </span>
      {unlinked > 0 && (
        <button
          className="btn btn-sm"
          disabled={!!busy}
          onClick={async () => {
            setBusy('⏳');
            await migrateLocal((d, t) => mounted.current && setBusy(`⏳ ${d}/${t}`));
            if (mounted.current) setBusy(null);
          }}
        >
          {busy ?? `📦 Bu cihazdaki ${unlinked} sunumu hesabıma taşı`}
        </button>
      )}
      {dialog}
    </div>
  );
}
