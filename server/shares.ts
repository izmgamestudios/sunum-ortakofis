// server/shares.ts — shared presentations: file storage, owner keys, link roles, passwords, signed access tokens
import express, { type Request, type Response, type Router } from 'express';
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Server } from 'socket.io';
import { createAuth, inviteMail, normEmail, type Auth } from './auth.js';

export type Visibility = 'private' | 'link' | 'public' | 'password' | 'invite';
export type LinkRole = 'viewer' | 'editor';
export type Role = 'owner' | LinkRole;

interface ShareMeta {
  id: string;
  title: string;
  presenter: string;
  stepCount: number;
  visibility: Visibility;
  linkRole: LinkRole;
  ownerKeyHash: string;
  passwordHash?: string;
  passwordSalt?: string;
  /** invite-only: who may open it (logged in with that e-mail) and with which role */
  invites?: Invite[];
  /** bumped on every settings change → invalidates issued tokens */
  gen: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  bytes: number;
}

interface Invite {
  email: string;
  role: LinkRole;
}

const MAX_INVITES = 200;
const MAX_SHARES = 5000;
const MAX_TOTAL_BYTES = 3 * 1024 * 1024 * 1024; // 3 GB
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const VIS: Visibility[] = ['private', 'link', 'public', 'password', 'invite'];
const ROLES: LinkRole[] = ['viewer', 'editor'];

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

function newId(len = 10): string {
  const abc = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(randomBytes(len), (x) => abc[x % abc.length]).join('');
}

/** Minimal shape check — content is rendered with React / canvas (no HTML), size is capped by the body parser. */
function validPresentation(p: unknown): p is { title?: string; presenter?: string; steps: unknown[] } {
  if (!p || typeof p !== 'object') return false;
  const steps = (p as { steps?: unknown }).steps;
  return Array.isArray(steps) && steps.length >= 1 && steps.length <= 60;
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max) : '');

export function createShareRouter(io: Server, dataDir: string, isProd = false): { router: Router; auth: Auth } {
  const dir = path.join(dataDir, 'shares');
  mkdirSync(dir, { recursive: true, mode: 0o700 });

  // server secret for token signatures (env wins; otherwise persisted once)
  const secretFile = path.join(dataDir, '.share-secret');
  let secret = process.env.SHARE_SECRET ?? '';
  if (!secret) {
    if (existsSync(secretFile)) secret = readFileSync(secretFile, 'utf8').trim();
    else {
      secret = randomBytes(32).toString('hex');
      writeFileSync(secretFile, secret, { mode: 0o600 });
    }
  }

  const auth = createAuth(secret, isProd);

  // in-memory meta index (content stays on disk)
  const metas = new Map<string, ShareMeta>();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.meta.json'))) {
    try {
      const m = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as ShareMeta;
      metas.set(m.id, m);
    } catch {
      /* skip corrupt */
    }
  }
  const totalBytes = () => [...metas.values()].reduce((a, m) => a + m.bytes, 0);
  const metaPath = (id: string) => path.join(dir, `${id}.meta.json`);
  const dataPath = (id: string) => path.join(dir, `${id}.json`);

  // per-share write queue (no interleaved writes)
  const queues = new Map<string, Promise<unknown>>();
  const queued = <T>(id: string, job: () => Promise<T>): Promise<T> => {
    const prev = queues.get(id) ?? Promise.resolve();
    const next = prev.then(job, job);
    queues.set(id, next.catch(() => undefined));
    return next;
  };
  async function atomicWrite(file: string, content: string) {
    const tmp = `${file}.${randomBytes(4).toString('hex')}.tmp`;
    await writeFile(tmp, content, { mode: 0o600 });
    await rename(tmp, file);
  }
  const saveMeta = (m: ShareMeta) => atomicWrite(metaPath(m.id), JSON.stringify(m));

  /* ---------------- tokens ---------------- */
  function sign(id: string, role: LinkRole, gen: number): string {
    const body = b64url(JSON.stringify({ id, role, gen, exp: Date.now() + TOKEN_TTL_MS }));
    return `${body}.${b64url(createHmac('sha256', secret).update(body).digest())}`;
  }
  function verify(token: string | undefined, m: ShareMeta): LinkRole | null {
    if (!token) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig || !safeEq(sig, b64url(createHmac('sha256', secret).update(body).digest()))) return null;
    try {
      const t = JSON.parse(Buffer.from(body, 'base64url').toString()) as { id: string; role: LinkRole; gen: number; exp: number };
      if (t.id !== m.id || t.gen !== m.gen || t.exp < Date.now() || m.visibility === 'private') return null;
      return ROLES.includes(t.role) ? t.role : null;
    } catch {
      return null;
    }
  }
  function roleOf(req: Request, m: ShareMeta): Role | null {
    const key = req.get('x-owner-key');
    if (key && safeEq(sha256(key), m.ownerKeyHash)) return 'owner';
    const auth = req.get('authorization');
    return verify(auth?.startsWith('Bearer ') ? auth.slice(7) : undefined, m);
  }

  /* ---------------- rate limiting (password guessing, creation) ---------------- */
  const hits = new Map<string, { n: number; reset: number }>();
  function limited(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) {
      hits.set(key, { n: 1, reset: now + windowMs });
      return false;
    }
    h.n++;
    return h.n > max;
  }
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  }, 60_000).unref();

  function applySettings(m: ShareMeta, body: Record<string, unknown>): string | null {
    if (body.visibility !== undefined) {
      if (!VIS.includes(body.visibility as Visibility)) return 'Geçersiz görünürlük';
      m.visibility = body.visibility as Visibility;
    }
    if (body.linkRole !== undefined) {
      if (!ROLES.includes(body.linkRole as LinkRole)) return 'Geçersiz rol';
      m.linkRole = body.linkRole as LinkRole;
    }
    if (typeof body.password === 'string' && body.password) {
      if (body.password.length < 4 || body.password.length > 128) return 'Şifre 4–128 karakter olmalı';
      m.passwordSalt = randomBytes(16).toString('hex');
      m.passwordHash = scryptSync(body.password, m.passwordSalt, 32).toString('hex');
    }
    if (m.visibility === 'password' && !m.passwordHash) return 'Şifreli paylaşım için şifre gerekli';
    if (body.invites !== undefined) {
      if (!Array.isArray(body.invites) || body.invites.length > MAX_INVITES) return `En fazla ${MAX_INVITES} davetli eklenebilir`;
      const seen = new Map<string, Invite>();
      for (const raw of body.invites as { email?: unknown; role?: unknown }[]) {
        const email = normEmail(raw?.email);
        if (!email) return `Geçersiz e-posta: ${String(raw?.email ?? '').slice(0, 80)}`;
        seen.set(email, { email, role: ROLES.includes(raw?.role as LinkRole) ? (raw.role as LinkRole) : m.linkRole });
      }
      m.invites = [...seen.values()];
    }
    if (m.visibility === 'invite' && !m.invites?.length) return 'Davetli paylaşım için en az bir e-posta gir';
    m.gen++;
    return null;
  }

  const r = express.Router();
  r.use(express.json({ limit: '32mb' }));
  const ip = (req: Request) => req.ip ?? 'x';

  // public gallery
  r.get('/public', (_req, res) => {
    const list = [...metas.values()]
      .filter((m) => m.visibility === 'public')
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 100)
      .map(({ id, title, presenter, stepCount, updatedAt, linkRole }) => ({ id, title, presenter, stepCount, updatedAt, linkRole }));
    res.json({ items: list });
  });

  // create
  r.post('/', async (req: Request, res: Response) => {
    if (limited(`create:${ip(req)}`, 20, 60 * 60 * 1000)) return res.status(429).json({ error: 'Çok fazla paylaşım denemesi, biraz sonra tekrar dene.' });
    const { presentation, settings = {} } = req.body ?? {};
    if (!validPresentation(presentation)) return res.status(400).json({ error: 'Geçersiz sunum' });
    if (metas.size >= MAX_SHARES) return res.status(507).json({ error: 'Sunucu kapasitesi dolu' });
    const json = JSON.stringify(presentation);
    if (totalBytes() + json.length > MAX_TOTAL_BYTES) return res.status(507).json({ error: 'Sunucu depolama kapasitesi dolu' });
    const ownerKey = randomBytes(24).toString('base64url');
    let id = newId();
    while (metas.has(id)) id = newId();
    const now = Date.now();
    const m: ShareMeta = {
      id,
      title: str(presentation.title, 120) || 'Sunum',
      presenter: str(presentation.presenter, 80),
      stepCount: presentation.steps.length,
      visibility: 'link',
      linkRole: 'viewer',
      ownerKeyHash: sha256(ownerKey),
      gen: 0,
      version: 1,
      createdAt: now,
      updatedAt: now,
      bytes: json.length,
    };
    const err = applySettings(m, settings);
    if (err) return res.status(400).json({ error: err });
    await atomicWrite(dataPath(id), json);
    await saveMeta(m);
    metas.set(id, m);
    let notified = 0;
    if (m.visibility === 'invite' && settings?.notify === true && auth.mailReady) {
      const link = `${req.protocol}://${req.get('host')}/?s=${m.id}`;
      for (const inv of (m.invites ?? []).slice(0, 50)) {
        const { text, html } = inviteMail(m.title, m.presenter, link, inv.role);
        await auth.send(inv.email, `Davet: ${m.title}`, text, html).then((ok) => ok && notified++).catch(() => undefined);
      }
    }
    res.status(201).json({ id, ownerKey, version: m.version, visibility: m.visibility, linkRole: m.linkRole, notified, mailReady: auth.mailReady });
  });

  // meta (no content) — private shares are invisible to everyone but the owner
  r.get('/:id/meta', (req, res) => {
    const m = metas.get(req.params.id);
    const role = m ? roleOf(req, m) : null;
    if (!m || (m.visibility === 'private' && role !== 'owner')) return res.status(404).json({ error: 'Sunum bulunamadı ya da özel.' });
    const you = m.visibility === 'invite' ? auth.emailOf(req.headers.cookie) : null;
    res.json({
      id: m.id,
      title: m.title,
      presenter: m.presenter,
      stepCount: m.stepCount,
      visibility: m.visibility,
      linkRole: m.linkRole,
      needsPassword: m.visibility === 'password',
      needsLogin: m.visibility === 'invite',
      you,
      invited: you ? !!m.invites?.some((i) => i.email === you) : undefined,
      updatedAt: m.updatedAt,
      version: m.version,
      role,
    });
  });

  // exchange (optional) password for a signed link token
  r.post('/:id/access', (req, res) => {
    const m = metas.get(req.params.id);
    if (!m || m.visibility === 'private') return res.status(404).json({ error: 'Sunum bulunamadı ya da özel.' });
    if (m.visibility === 'password') {
      if (limited(`pw:${ip(req)}:${m.id}`, 8, 10 * 60 * 1000)) return res.status(429).json({ error: 'Çok fazla deneme. 10 dakika sonra tekrar dene.' });
      const pw = typeof req.body?.password === 'string' ? req.body.password : '';
      const hash = m.passwordSalt ? scryptSync(pw, m.passwordSalt, 32).toString('hex') : '';
      if (!m.passwordHash || !safeEq(hash, m.passwordHash)) return res.status(401).json({ error: 'Şifre yanlış.' });
    }
    if (m.visibility === 'invite') {
      const email = auth.emailOf(req.headers.cookie);
      if (!email) return res.status(401).json({ error: 'Bu sunum yalnızca davet edilenlere açık. E-postanla giriş yap.', needsLogin: true });
      if (limited(`inv:${ip(req)}`, 30, 10 * 60 * 1000)) return res.status(429).json({ error: 'Çok fazla deneme.' });
      const inv = m.invites?.find((i) => i.email === email);
      if (!inv) return res.status(403).json({ error: `Bu sunum ${email} ile paylaşılmamış.`, notInvited: true });
      return res.json({ token: sign(m.id, inv.role, m.gen), role: inv.role });
    }
    res.json({ token: sign(m.id, m.linkRole, m.gen), role: m.linkRole });
  });

  // content
  r.get('/:id', async (req, res) => {
    const m = metas.get(req.params.id);
    const role = m ? roleOf(req, m) : null;
    if (!m || !role) return res.status(m ? 403 : 404).json({ error: m ? 'Erişim yok' : 'Sunum bulunamadı' });
    const presentation = JSON.parse(await readFile(dataPath(m.id), 'utf8'));
    res.json({
      presentation,
      version: m.version,
      role,
      settings: role === 'owner' ? { visibility: m.visibility, linkRole: m.linkRole, hasPassword: !!m.passwordHash, invites: m.invites ?? [] } : undefined,
    });
  });

  // update content (owner or editor) with optimistic concurrency
  r.put('/:id', async (req, res) => {
    const m = metas.get(req.params.id);
    const role = m ? roleOf(req, m) : null;
    if (!m || !role) return res.status(m ? 403 : 404).json({ error: m ? 'Erişim yok' : 'Sunum bulunamadı' });
    if (role === 'viewer') return res.status(403).json({ error: 'Bu bağlantı yalnızca izleme izni veriyor.' });
    const { presentation, baseVersion, force } = req.body ?? {};
    if (!validPresentation(presentation)) return res.status(400).json({ error: 'Geçersiz sunum' });
    const result = await queued(m.id, async () => {
      if (!force && baseVersion !== m.version) return { conflict: true as const };
      const json = JSON.stringify(presentation);
      if (totalBytes() - m.bytes + json.length > MAX_TOTAL_BYTES) return { full: true as const };
      await atomicWrite(dataPath(m.id), json);
      m.version++;
      m.updatedAt = Date.now();
      m.bytes = json.length;
      m.title = str(presentation.title, 120) || m.title;
      m.presenter = str(presentation.presenter, 80);
      m.stepCount = presentation.steps.length;
      await saveMeta(m);
      return { ok: true as const };
    });
    if ('conflict' in result) return res.status(409).json({ error: 'Sunum başka biri tarafından güncellendi.', version: m.version });
    if ('full' in result) return res.status(507).json({ error: 'Depolama kapasitesi dolu' });
    io.to(`share:${m.id}`).emit('share:updated', { id: m.id, version: m.version, by: role });
    res.json({ version: m.version });
  });

  // settings (owner only)
  r.patch('/:id/settings', async (req, res) => {
    const m = metas.get(req.params.id);
    if (!m || roleOf(req, m) !== 'owner') return res.status(m ? 403 : 404).json({ error: 'Yalnızca sunum sahibi değiştirebilir.' });
    const before = new Set((m.invites ?? []).map((i) => i.email));
    const copy = { ...m };
    const err = applySettings(copy, req.body ?? {});
    if (err) return res.status(400).json({ error: err });
    Object.assign(m, copy);
    await queued(m.id, () => saveMeta(m));
    io.to(`share:${m.id}`).emit('share:settings', { id: m.id });
    const fresh = m.visibility === 'invite' && req.body?.notify === true ? (m.invites ?? []).filter((i) => !before.has(i.email)) : [];
    let notified = 0;
    if (fresh.length && auth.mailReady && !limited(`notify:${m.id}`, 10, 60 * 60 * 1000)) {
      const link = `${req.protocol}://${req.get('host')}/?s=${m.id}`;
      for (const inv of fresh.slice(0, 50)) {
        const { text, html } = inviteMail(m.title, m.presenter, link, inv.role);
        await auth.send(inv.email, `Davet: ${m.title}`, text, html).then((ok) => ok && notified++).catch(() => undefined);
      }
    }
    res.json({ visibility: m.visibility, linkRole: m.linkRole, hasPassword: !!m.passwordHash, invites: m.invites ?? [], notified, mailReady: auth.mailReady });
  });

  // delete (owner only)
  r.delete('/:id', async (req, res) => {
    const m = metas.get(req.params.id);
    if (!m || roleOf(req, m) !== 'owner') return res.status(m ? 403 : 404).json({ error: 'Yalnızca sunum sahibi silebilir.' });
    metas.delete(m.id);
    await queued(m.id, async () => {
      await unlink(dataPath(m.id)).catch(() => undefined);
      await unlink(metaPath(m.id)).catch(() => undefined);
    });
    io.to(`share:${m.id}`).emit('share:deleted', { id: m.id });
    res.json({ ok: true });
  });

  /* ---------------- live change notifications ---------------- */
  /** where the owner/editor currently is while presenting — read-only viewers can follow it */
  interface LivePos {
    id: string;
    phase: 'step' | 'break' | 'intro' | 'outro' | 'done';
    stepIndex: number;
    zoom: number;
    ox: number;
    oy: number;
    at: number;
  }
  const livePos = new Map<string, LivePos>();
  const LIVE_TTL_MS = 30 * 60 * 1000;
  const PHASES: LivePos['phase'][] = ['step', 'break', 'intro', 'outro', 'done'];
  const num = (n: unknown, lo: number, hi: number) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;

  io.on('connection', (socket) => {
    let tokens = 20;
    let refill = Date.now();
    socket.on('share:watch', (p: { id?: string; token?: string; ownerKey?: string }) => {
      const m = typeof p?.id === 'string' ? metas.get(p.id) : undefined;
      if (!m) return;
      const owner = typeof p.ownerKey === 'string' && safeEq(sha256(p.ownerKey), m.ownerKeyHash);
      if (owner || verify(p.token, m)) {
        socket.join(`share:${m.id}`);
        const pos = livePos.get(m.id);
        if (pos && Date.now() - pos.at < LIVE_TTL_MS) socket.emit('share:live', pos);
      }
    });
    // presenter position (owner or editor only), relayed to everyone watching the share
    socket.on('share:live', (p: Partial<LivePos> & { ownerKey?: string; token?: string }) => {
      const now = Date.now();
      tokens = Math.min(20, tokens + ((now - refill) / 1000) * 10);
      refill = now;
      if (tokens < 1) return;
      tokens -= 1;
      const m = typeof p?.id === 'string' ? metas.get(p.id) : undefined;
      if (!m || m.visibility === 'private') return;
      const owner = typeof p.ownerKey === 'string' && safeEq(sha256(p.ownerKey), m.ownerKeyHash);
      if (!owner && verify(p.token, m) !== 'editor') return;
      if (!PHASES.includes(p.phase as LivePos['phase']) || !Number.isInteger(p.stepIndex) || !num(p.stepIndex, 0, 50)) return;
      const z = num(p.zoom, 0.1, 10) ? (p.zoom as number) : 1;
      const pos: LivePos = { id: m.id, phase: p.phase as LivePos['phase'], stepIndex: p.stepIndex as number, zoom: z, ox: num(p.ox, -20000, 20000) ? (p.ox as number) : 0, oy: num(p.oy, -20000, 20000) ? (p.oy as number) : 0, at: now };
      livePos.set(m.id, pos);
      socket.to(`share:${m.id}`).emit('share:live', pos);
    });
    socket.on('share:unwatch', (p: { id?: string }) => typeof p?.id === 'string' && socket.leave(`share:${p.id}`));
  });

  return { router: r, auth };
}
