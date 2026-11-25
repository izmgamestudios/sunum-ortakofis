// server/auth.ts — passwordless e-mail login (6-digit code) for invite-only shares; session = signed httpOnly cookie
import express, { type Request, type Router } from 'express';
import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import nodemailer, { type Transporter } from 'nodemailer';

const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
export const COOKIE = 'tsess';

const EMAIL_RE = /^[^\s@<>()",;:]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;
export const normEmail = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const e = v.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
};

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  (header ?? '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

export interface Auth {
  router: Router;
  /** logged-in e-mail for an HTTP request or a socket handshake cookie header */
  emailOf: (cookieHeader: string | undefined) => string | null;
  /** best-effort mail (invites); resolves false when mail isn't configured */
  send: (to: string, subject: string, text: string, html: string) => Promise<boolean>;
  mailReady: boolean;
}

export function createAuth(secret: string, isProd: boolean): Auth {
  const host = process.env.SMTP_HOST ?? (process.env.SMTP_USER?.endsWith('@gmail.com') ? 'smtp.gmail.com' : '');
  const user = process.env.SMTP_USER ?? '';
  const pass = process.env.SMTP_PASS ?? '';
  const from = process.env.MAIL_FROM || (user ? `Teknodoz Sunum <${user}>` : '');
  const port = Number(process.env.SMTP_PORT ?? 465);
  const transporter: Transporter | null = host && user && pass ? nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } }) : null;
  if (!transporter) console.warn('[auth] SMTP_USER / SMTP_PASS not set — login codes are only printed to this log (development).');
  else {
    const masked = user.replace(/^(.{2}).*(@.*)$/, '$1***$2');
    console.log(`[auth] SMTP ready: ${host}:${port} as ${masked}`);
    // verify the login once at startup so a wrong app password shows up in the log right away
    transporter.verify().then(
      () => console.log('[auth] SMTP login OK'),
      (e: unknown) => console.error(`[auth] SMTP login FAILED: ${e instanceof Error ? e.message : String(e)}`),
    );
  }

  const send = async (to: string, subject: string, text: string, html: string) => {
    if (!transporter) {
      console.log(`[auth] (no SMTP) mail to ${to}: ${subject}\n${text}`);
      return false;
    }
    await transporter.sendMail({ from, to, subject, text, html });
    return true;
  };

  /* ---------- codes (in memory) ---------- */
  const codes = new Map<string, { hash: string; exp: number; tries: number }>();
  const hits = new Map<string, { n: number; reset: number }>();
  const limited = (key: string, max: number, windowMs: number) => {
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) {
      hits.set(key, { n: 1, reset: now + windowMs });
      return false;
    }
    return ++h.n > max;
  };
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of codes) if (v.exp < now) codes.delete(k);
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, 60_000).unref();

  /* ---------- session cookie ---------- */
  const signSession = (email: string) => {
    const body = Buffer.from(JSON.stringify({ e: email, exp: Date.now() + SESSION_TTL_MS })).toString('base64url');
    return `${body}.${createHmac('sha256', `${secret}:session`).update(body).digest('base64url')}`;
  };
  const emailOf = (cookieHeader: string | undefined): string | null => {
    const tok = parseCookies(cookieHeader)[COOKIE];
    if (!tok) return null;
    const [body, sig] = tok.split('.');
    if (!body || !sig || !safeEq(sig, createHmac('sha256', `${secret}:session`).update(body).digest('base64url'))) return null;
    try {
      const t = JSON.parse(Buffer.from(body, 'base64url').toString()) as { e: string; exp: number };
      return t.exp > Date.now() ? normEmail(t.e) : null;
    } catch {
      return null;
    }
  };
  const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, secure: isProd, path: '/', maxAge: SESSION_TTL_MS };

  const r = express.Router();
  r.use(express.json({ limit: '4kb' }));
  const ip = (req: Request) => req.ip ?? 'x';

  r.get('/me', (req, res) => {
    const email = emailOf(req.headers.cookie);
    res.json({ email, mailReady: !!transporter });
  });

  r.post('/request', async (req, res) => {
    const email = normEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: 'Geçerli bir e-posta adresi yaz.' });
    if (limited(`req:${ip(req)}`, 10, 15 * 60 * 1000) || limited(`req:${email}`, 5, 15 * 60 * 1000)) return res.status(429).json({ error: 'Çok fazla kod istendi. 15 dakika sonra tekrar dene.' });
    if (!transporter && isProd) return res.status(503).json({ error: 'E-posta gönderimi henüz yapılandırılmadı (sunucu yöneticisi SMTP ayarlarını eklemeli).' });
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    codes.set(email, { hash: sha256(`${email}:${code}:${secret}`), exp: Date.now() + CODE_TTL_MS, tries: 0 });
    const text = `Teknodoz Sunum giriş kodun: ${code}\n\nKod 10 dakika geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.`;
    const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0f172a"><h2 style="margin:0 0 8px">Teknodoz Sunum</h2><p>Giriş kodun:</p><p style="font-size:32px;font-weight:800;letter-spacing:6px;background:#f1f5f9;border-radius:12px;padding:14px 18px;text-align:center">${code}</p><p style="color:#64748b;font-size:13px">Kod 10 dakika geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p></div>`;
    try {
      const sent = await send(email, `Giriş kodun: ${code}`, text, html);
      res.json({ ok: true, dev: !sent });
    } catch (e) {
      console.error('[auth] mail failed', e instanceof Error ? e.message : e);
      res.status(502).json({ error: 'Kod e-postası gönderilemedi. Biraz sonra tekrar dene.' });
    }
  });

  r.post('/verify', (req, res) => {
    const email = normEmail(req.body?.email);
    const code = typeof req.body?.code === 'string' ? req.body.code.replace(/\D/g, '') : '';
    if (!email || code.length !== 6) return res.status(400).json({ error: 'E-posta ve 6 haneli kod gerekli.' });
    if (limited(`ver:${ip(req)}`, 30, 15 * 60 * 1000)) return res.status(429).json({ error: 'Çok fazla deneme. Biraz sonra tekrar dene.' });
    const c = codes.get(email);
    if (!c || c.exp < Date.now()) return res.status(400).json({ error: 'Kodun süresi doldu ya da istenmedi. Yeni kod iste.' });
    if (++c.tries > MAX_ATTEMPTS) {
      codes.delete(email);
      return res.status(429).json({ error: 'Çok fazla yanlış deneme. Yeni kod iste.' });
    }
    if (!safeEq(sha256(`${email}:${code}:${secret}`), c.hash)) return res.status(401).json({ error: 'Kod yanlış.' });
    codes.delete(email);
    res.cookie(COOKIE, signSession(email), cookieOpts);
    res.json({ email });
  });

  r.post('/logout', (_req, res) => {
    res.clearCookie(COOKIE, { ...cookieOpts, maxAge: undefined });
    res.json({ ok: true });
  });

  return { router: r, emailOf, send, mailReady: !!transporter };
}

/** invitation mail body */
export function inviteMail(title: string, presenter: string, link: string, role: 'viewer' | 'editor') {
  const what = role === 'editor' ? 'düzenlemen' : 'izlemen';
  const text = `${presenter || 'Bir kullanıcı'} seni “${title}” sunumunu ${what} için davet etti.\n\n${link}\n\nAçarken bu e-posta adresine gelen kodla giriş yapacaksın.`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f172a"><h2 style="margin:0 0 8px">📧 Sunum daveti</h2><p><b>${esc(presenter || 'Bir kullanıcı')}</b> seni <b>“${esc(title)}”</b> sunumunu ${what} için davet etti.</p><p><a href="${esc(link)}" style="display:inline-block;background:linear-gradient(135deg,#3b8bf7,#a93bf5);color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Sunumu aç</a></p><p style="color:#64748b;font-size:13px">Açarken bu e-posta adresine gelen 6 haneli kodla giriş yapacaksın.</p></div>`;
  return { text, html };
}
