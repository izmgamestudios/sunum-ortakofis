// server/userlib.ts — per-account presentation library ("Sunumlarım" synced across devices)
// Storage: DATA_DIR/users/<sha256(email)>/{index.json, <id>.json}; deletions kept as tombstones so offline devices don't resurrect them.
import express, { type Request, type Router } from 'express';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Server } from 'socket.io';
import type { Auth } from './auth.js';

interface Item {
  id: string;
  title: string;
  presenter: string;
  stepCount: number;
  updatedAt: number;
  version: number;
  bytes: number;
  deleted?: boolean;
}

const MAX_ITEMS = 500;
const MAX_USER_BYTES = 400 * 1024 * 1024; // 400 MB per account
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const SOCKET_TOKEN_TTL = 5 * 60 * 1000;

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max) : '');
function validPresentation(p: unknown): p is { id?: string; title?: string; presenter?: string; steps: unknown[]; updatedAt?: number } {
  if (!p || typeof p !== 'object') return false;
  const steps = (p as { steps?: unknown }).steps;
  return Array.isArray(steps) && steps.length >= 1 && steps.length <= 60;
}

export function createUserLib(io: Server, dataDir: string, auth: Auth, secret: string): Router {
  const base = path.join(dataDir, 'users');
  mkdirSync(base, { recursive: true, mode: 0o700 });
  const userKey = (email: string) => sha(`${email}`).slice(0, 40);
  const dirOf = (email: string) => {
    const d = path.join(base, userKey(email));
    if (!existsSync(d)) mkdirSync(d, { recursive: true, mode: 0o700 });
    return d;
  };
  const room = (email: string) => `user:${userKey(email)}`;

  // per-user index cache + write queue
  const indexes = new Map<string, Item[]>();
  const loadIndex = (email: string): Item[] => {
    const k = userKey(email);
    let idx = indexes.get(k);
    if (!idx) {
      const f = path.join(dirOf(email), 'index.json');
      try {
        idx = existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as Item[]) : [];
      } catch {
        idx = [];
      }
      indexes.set(k, idx);
    }
    return idx;
  };
  const queues = new Map<string, Promise<unknown>>();
  const queued = <T>(email: string, job: () => Promise<T>): Promise<T> => {
    const k = userKey(email);
    const next = (queues.get(k) ?? Promise.resolve()).then(job, job);
    queues.set(k, next.catch(() => undefined));
    return next;
  };
  async function atomicWrite(file: string, content: string) {
    const tmp = `${file}.${randomBytes(4).toString('hex')}.tmp`;
    await writeFile(tmp, content, { mode: 0o600 });
    await rename(tmp, file);
  }
  const saveIndex = (email: string) => atomicWrite(path.join(dirOf(email), 'index.json'), JSON.stringify(loadIndex(email)));
  const used = (email: string) => loadIndex(email).reduce((a, i) => a + (i.deleted ? 0 : i.bytes), 0);

  /* socket: join the account room with a short-lived token (the socket handshake predates the login cookie) */
  const signJoin = (email: string) => {
    const body = Buffer.from(JSON.stringify({ k: userKey(email), exp: Date.now() + SOCKET_TOKEN_TTL })).toString('base64url');
    return `${body}.${createHmac('sha256', `${secret}:userlib`).update(body).digest('base64url')}`;
  };
  io.on('connection', (socket) => {
    socket.on('user:join', (p: { token?: string }) => {
      const [body, sig] = String(p?.token ?? '').split('.');
      if (!body || !sig || !safeEq(sig, createHmac('sha256', `${secret}:userlib`).update(body).digest('base64url'))) return;
      try {
        const t = JSON.parse(Buffer.from(body, 'base64url').toString()) as { k: string; exp: number };
        if (t.exp > Date.now() && /^[0-9a-f]{40}$/.test(t.k)) socket.join(`user:${t.k}`);
      } catch {
        /* ignore */
      }
    });
    socket.on('user:leave', () => [...socket.rooms].filter((r) => r.startsWith('user:')).forEach((r) => socket.leave(r)));
  });

  const r = express.Router();
  r.use(express.json({ limit: '32mb' }));
  const emailOf = (req: Request) => auth.emailOf(req.headers.cookie);
  r.use((req, res, next) => (emailOf(req) ? next() : res.status(401).json({ error: 'Giriş yapman gerekiyor.' })));

  r.get('/socket-token', (req, res) => res.json({ token: signJoin(emailOf(req)!) }));

  r.get('/presentations', (req, res) => {
    const email = emailOf(req)!;
    res.json({ items: loadIndex(email), used: used(email), quota: MAX_USER_BYTES });
  });

  r.get('/presentations/:id', async (req, res) => {
    const email = emailOf(req)!;
    const item = loadIndex(email).find((i) => i.id === req.params.id && !i.deleted);
    if (!item) return res.status(404).json({ error: 'Sunum hesabında bulunamadı.' });
    const presentation = JSON.parse(await readFile(path.join(dirOf(email), `${item.id}.json`), 'utf8'));
    res.json({ presentation, version: item.version });
  });

  r.put('/presentations/:id', async (req, res) => {
    const email = emailOf(req)!;
    const id = req.params.id;
    if (!ID_RE.test(id)) return res.status(400).json({ error: 'Geçersiz kimlik' });
    const { presentation, baseVersion, force } = req.body ?? {};
    if (!validPresentation(presentation)) return res.status(400).json({ error: 'Geçersiz sunum' });
    const json = JSON.stringify({ ...presentation, id });
    const result = await queued(email, async () => {
      const idx = loadIndex(email);
      const cur = idx.find((i) => i.id === id);
      const live = cur && !cur.deleted;
      if (live && !force && baseVersion !== cur!.version) return { conflict: cur!.version };
      if (!live && idx.filter((i) => !i.deleted).length >= MAX_ITEMS) return { full: 'Hesapta en fazla 500 sunum olabilir.' };
      if (used(email) - (live ? cur!.bytes : 0) + json.length > MAX_USER_BYTES) return { full: 'Hesap depolama alanı doldu (400 MB). Büyük medyaları kaldır ya da eski sunumları sil.' };
      await atomicWrite(path.join(dirOf(email), `${id}.json`), json);
      const item: Item = {
        id,
        title: str(presentation.title, 120) || 'Adsız sunum',
        presenter: str(presentation.presenter, 80),
        stepCount: presentation.steps.length,
        updatedAt: Date.now(),
        version: (cur?.version ?? 0) + 1,
        bytes: json.length,
      };
      if (cur) Object.assign(cur, item, { deleted: undefined });
      else idx.unshift(item);
      await saveIndex(email);
      return { item };
    });
    if ('conflict' in result) return res.status(409).json({ error: 'Bu sunum başka bir cihazda değişti.', version: result.conflict });
    if ('full' in result) return res.status(507).json({ error: result.full });
    io.to(room(email)).emit('lib:changed', { id, version: result.item.version, by: req.get('x-device') ?? '' });
    res.json({ version: result.item.version, updatedAt: result.item.updatedAt });
  });

  r.delete('/presentations/:id', async (req, res) => {
    const email = emailOf(req)!;
    const id = req.params.id;
    const version = await queued(email, async () => {
      const cur = loadIndex(email).find((i) => i.id === id);
      if (!cur || cur.deleted) return null;
      cur.deleted = true;
      cur.version++;
      cur.bytes = 0;
      cur.updatedAt = Date.now();
      await unlink(path.join(dirOf(email), `${id}.json`)).catch(() => undefined);
      await saveIndex(email);
      return cur.version;
    });
    if (version !== null) io.to(room(email)).emit('lib:changed', { id, version, deleted: true, by: req.get('x-device') ?? '' });
    res.json({ ok: true });
  });

  return r;
}
