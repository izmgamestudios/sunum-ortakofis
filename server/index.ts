// server/index.ts
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import { createServer } from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { Server, type Socket } from 'socket.io';
import type { Router } from 'express';
import { createShareRouter } from './shares.js';
import { createUserLib } from './userlib.js';

const PORT = Number(process.env.PORT ?? 3001);
/** Behind a reverse proxy (CloudPanel/nginx) bind to 127.0.0.1 so the app port is not publicly reachable. */
const HOST = process.env.HOST ?? '0.0.0.0';
// optional secrets (SMTP for e-mail login codes, …) from the project's .env — git-ignored, survives deploys
const ENV_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env');
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
  console.log(`[env] loaded ${ENV_FILE}`);
}
const IS_PROD = process.env.NODE_ENV === 'production';
const ROOM_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_MSG_LEN = 500;
const MAX_ROOMS = 2000;
const ALLOWED_REACTIONS = ['👏', '❤️', '😂', '🤯', '🔥', '🤔', '👍', '🎉'] as const;

const ADJECTIVES = ['Meraklı', 'Neşeli', 'Sakin', 'Cesur', 'Hızlı', 'Bilge', 'Uykucu', 'Parlak', 'Gizemli', 'Yaratıcı', 'Sevimli', 'Dalgın'];
const ANIMALS = ['Baykuş', 'Tilki', 'Panda', 'Yunus', 'Kartal', 'Kedi', 'Sincap', 'Penguen', 'Kaplumbağa', 'Ahtapot', 'Kirpi', 'Flamingo'];

interface PublicState {
  title: string;
  stepIndex: number;
  stepCount: number;
  phase: 'idle' | 'step' | 'break' | 'done';
  roleplay?: string;
  chatLocked: boolean;
}

interface CanvasSnapshot {
  stepIndex: number;
  elements: unknown[];
  atts: { id: string; kind: string; name: string; url?: string }[];
  at: number;
}

interface Room {
  code: string;
  presenterToken: string;
  createdAt: number;
  lastActivity: number;
  state: PublicState;
  /** socket id → anonymous display name (audience only) */
  people: Map<string, string>;
  canvas: CanvasSnapshot | null;
  /** attachment id → downscaled image data URL, insertion-ordered for eviction */
  assets: Map<string, string>;
  assetBytes: number;
  /** presenter's canvas zoom / pan; watch-only viewers follow it */
  view: CanvasView | null;
}

interface CanvasView {
  stepIndex: number;
  zoom: number;
  ox: number;
  oy: number;
}

const MAX_CANVAS_JSON = 1_500_000;
const MAX_ASSET_BYTES = 1_600_000;
const MAX_ROOM_ASSET_BYTES = 25_000_000;
const ATT_KINDS = ['image', 'pdf', 'video', 'audio', 'link', 'file'];
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

interface RateBucket {
  tokens: number;
  updatedAt: number;
}

const rooms = new Map<string, Room>();

function makeCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    const bytes = randomBytes(6);
    code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  } while (rooms.has(code));
  return code;
}

function anonName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const b = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${a} ${b} #${Math.floor(10 + Math.random() * 90)}`;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function cleanText(input: unknown, max = MAX_MSG_LEN): string | null {
  if (typeof input !== 'string') return null;
  // strip control chars (keep newlines), collapse whitespace runs
  const t = input.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (!t) return null;
  return t.slice(0, max);
}

function normalizeCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const c = input.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(c) ? c : null;
}

/** Token bucket rate limiter: `rate` tokens / second, up to `burst`. */
function allow(bucket: RateBucket, rate: number, burst: number): boolean {
  const now = Date.now();
  bucket.tokens = Math.min(burst, bucket.tokens + ((now - bucket.updatedAt) / 1000) * rate);
  bucket.updatedAt = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 'loopback');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'data:', 'blob:', 'https:'],
        frameSrc: ["'self'", 'blob:', 'https:'],
        objectSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        workerSrc: ["'self'", 'blob:'],
        // allow plain-http LAN usage (phones joining via http://192.168.x.x)
        upgradeInsecureRequests: null,
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(compression());

// shared presentations API — registered before the SPA fallback; the router is attached once socket.io exists
let shareRouter: Router | null = null;
let authRouter: Router | null = null;
let meRouter: Router | null = null;
app.use('/api/me', (req, res, next) => (meRouter ? meRouter(req, res, next) : res.status(503).json({ error: 'Hazırlanıyor' })));
app.use('/api/auth', (req, res, next) => (authRouter ? authRouter(req, res, next) : res.status(503).json({ error: 'Hazırlanıyor' })));
app.use('/api/shares', (req, res, next) => (shareRouter ? shareRouter(req, res, next) : res.status(503).json({ error: 'Hazırlanıyor' })));
app.use('/api', (_req, res, next) => (_req.path === '/health' ? next() : res.status(404).json({ error: 'Bulunamadı' })));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, uptime: Math.round(process.uptime()) });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(__dirname, '../dist-client');
if (existsSync(clientDir)) {
  app.use(express.static(clientDir, { maxAge: IS_PROD ? '1h' : 0, index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
}

const httpServer = createServer(app);
function emitPeople(room: Room): void {
  const names = [...room.people.values()];
  io.to(room.code).emit('room:people', { count: names.length, names: names.slice(0, 300) });
}

const DATA_DIR = process.env.DATA_DIR ?? path.resolve(__dirname, '../data');

const io = new Server(httpServer, {
  // canvas snapshots and downscaled images (validated per event)
  maxHttpBufferSize: 2_500_000,
  cors: IS_PROD ? undefined : { origin: true },
});
const shares = createShareRouter(io, DATA_DIR, IS_PROD);
shareRouter = shares.router;
authRouter = shares.auth.router;
meRouter = createUserLib(io, DATA_DIR, shares.auth, shares.secret);


io.on('connection', (socket: Socket) => {
  const chatBucket: RateBucket = { tokens: 5, updatedAt: Date.now() };
  const reactBucket: RateBucket = { tokens: 10, updatedAt: Date.now() };
  const canvasBucket: RateBucket = { tokens: 10, updatedAt: Date.now() };
  const viewBucket: RateBucket = { tokens: 20, updatedAt: Date.now() };
  let joinedCode: string | null = null;
  let isPresenter = false;
  let name = anonName();

  socket.on('presenter:create', (payload: { title?: string }, ack?: (r: unknown) => void) => {
    if (typeof ack !== 'function') return;
    if (rooms.size >= MAX_ROOMS) return ack({ ok: false, error: 'Sunucu kapasitesi dolu.' });
    const code = makeCode();
    const room: Room = {
      code,
      presenterToken: randomUUID(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
      state: { title: cleanText(payload?.title, 120) ?? 'Sunum', stepIndex: 0, stepCount: 0, phase: 'idle', chatLocked: false },
      people: new Map(),
      canvas: null,
      assets: new Map(),
      assetBytes: 0,
      view: null,
    };
    rooms.set(code, room);
    joinedCode = code;
    isPresenter = true;
    name = 'Sunucu';
    socket.join(code);
    ack({ ok: true, code, token: room.presenterToken });
  });

  socket.on('presenter:resume', (payload: { code?: string; token?: string }, ack?: (r: unknown) => void) => {
    if (typeof ack !== 'function') return;
    const code = normalizeCode(payload?.code);
    const room = code ? rooms.get(code) : undefined;
    if (!room || typeof payload.token !== 'string' || !safeEqual(room.presenterToken, payload.token)) {
      return ack({ ok: false });
    }
    joinedCode = room.code;
    isPresenter = true;
    name = 'Sunucu';
    socket.join(room.code);
    ack({ ok: true, code: room.code });
    emitPeople(room);
  });

  socket.on('audience:join', (payload: { code?: string }, ack?: (r: unknown) => void) => {
    if (typeof ack !== 'function') return;
    const code = normalizeCode(payload?.code);
    const room = code ? rooms.get(code) : undefined;
    if (!room) return ack({ ok: false, error: 'Oda bulunamadı. Kodu kontrol et.' });
    joinedCode = room.code;
    isPresenter = false;
    socket.join(room.code);
    room.lastActivity = Date.now();
    room.people.set(socket.id, name);
    ack({ ok: true, name, state: room.state });
    // late joiners get the current canvas, then its images one by one
    if (room.canvas) socket.emit('canvas', room.canvas);
    if (room.view) socket.emit('canvas:view', room.view);
    for (const [id, dataUrl] of room.assets) socket.emit('canvas:asset', { id, dataUrl });
    io.to(room.code).emit('room:count', io.sockets.adapter.rooms.get(room.code)?.size ?? 0);
    emitPeople(room);
  });

  socket.on('audience:rename', (payload: { name?: string }, ack?: (r: unknown) => void) => {
    if (!joinedCode || isPresenter || typeof ack !== 'function') return;
    const room = rooms.get(joinedCode);
    if (!room) return;
    if (!allow(chatBucket, 0.5, 5)) return ack({ ok: false, error: 'Biraz yavaş 🙂' });
    const next = cleanText(payload?.name, 24)?.replace(/\s+/g, ' ');
    if (!next || next.length < 2) return ack({ ok: false, error: 'En az 2 karakter.' });
    if (/^sunucu$/i.test(next)) return ack({ ok: false, error: 'Bu isim kullanılamaz.' });
    name = next;
    room.people.set(socket.id, name);
    ack({ ok: true, name });
    emitPeople(room);
  });

  socket.on('canvas:update', (payload: Partial<CanvasSnapshot>) => {
    if (!isPresenter || !joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room || !allow(canvasBucket, 5, 10)) return;
    if (!Array.isArray(payload?.elements) || payload.elements.length > 3000 || !Number.isInteger(payload.stepIndex)) return;
    let size = 0;
    try {
      size = JSON.stringify(payload.elements).length;
    } catch {
      return;
    }
    if (size > MAX_CANVAS_JSON) return;
    const atts = (Array.isArray(payload.atts) ? payload.atts : [])
      .slice(0, 200)
      .filter((a) => a && typeof a.id === 'string' && a.id.length <= 64 && ATT_KINDS.includes(a.kind))
      .map((a) => ({
        id: a.id,
        kind: a.kind,
        name: cleanText(a.name, 120) ?? '',
        url: typeof a.url === 'string' && /^https?:\/\//.test(a.url) && a.url.length < 2000 ? a.url : undefined,
      }));
    room.canvas = { stepIndex: payload.stepIndex as number, elements: payload.elements, atts, at: Date.now() };
    room.lastActivity = Date.now();
    socket.to(room.code).emit('canvas', room.canvas);
  });

  socket.on('canvas:view', (payload: Partial<CanvasView>) => {
    if (!isPresenter || !joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room || !allow(viewBucket, 10, 20)) return;
    const { stepIndex, zoom, ox, oy } = payload ?? {};
    const num = (n: unknown, lo: number, hi: number) => typeof n === 'number' && Number.isFinite(n) && n >= lo && n <= hi;
    if (!Number.isInteger(stepIndex) || !num(zoom, 0.1, 10) || !num(ox, -20000, 20000) || !num(oy, -20000, 20000)) return;
    room.view = { stepIndex: stepIndex as number, zoom: zoom as number, ox: ox as number, oy: oy as number };
    socket.to(room.code).emit('canvas:view', room.view);
  });

  socket.on('canvas:asset', (payload: { id?: string; dataUrl?: string }) => {
    if (!isPresenter || !joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room || !allow(canvasBucket, 5, 10)) return;
    const { id, dataUrl } = payload ?? {};
    if (typeof id !== 'string' || id.length > 64 || typeof dataUrl !== 'string' || dataUrl.length > MAX_ASSET_BYTES || !IMAGE_DATA_URL.test(dataUrl)) return;
    const prev = room.assets.get(id);
    if (prev) room.assetBytes -= prev.length;
    room.assets.delete(id);
    room.assets.set(id, dataUrl);
    room.assetBytes += dataUrl.length;
    // evict oldest images beyond the per-room budget
    for (const [k, v] of room.assets) {
      if (room.assetBytes <= MAX_ROOM_ASSET_BYTES) break;
      room.assets.delete(k);
      room.assetBytes -= v.length;
    }
    socket.to(room.code).emit('canvas:asset', { id, dataUrl });
  });

  socket.on('state:update', (payload: Partial<PublicState>) => {
    if (!isPresenter || !joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room) return;
    const s = room.state;
    if (typeof payload.title === 'string') s.title = cleanText(payload.title, 120) ?? s.title;
    if (Number.isInteger(payload.stepIndex)) s.stepIndex = Math.max(0, Math.min(20, payload.stepIndex as number));
    if (Number.isInteger(payload.stepCount)) s.stepCount = Math.max(0, Math.min(20, payload.stepCount as number));
    if (payload.phase && ['idle', 'step', 'break', 'done'].includes(payload.phase)) s.phase = payload.phase;
    if (typeof payload.roleplay === 'string') s.roleplay = cleanText(payload.roleplay, 300) ?? undefined;
    if (typeof payload.chatLocked === 'boolean') s.chatLocked = payload.chatLocked;
    room.lastActivity = Date.now();
    socket.to(room.code).emit('state', s);
  });

  socket.on('chat:send', (payload: { text?: string }) => {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room) return;
    if (room.state.chatLocked && !isPresenter) return socket.emit('chat:error', 'Sohbet şu an kilitli.');
    if (!allow(chatBucket, 0.5, 5)) return socket.emit('chat:error', 'Biraz yavaş 🙂 Çok hızlı mesaj gönderiyorsun.');
    const text = cleanText(payload?.text);
    if (!text) return;
    room.lastActivity = Date.now();
    io.to(room.code).emit('chat:message', {
      id: randomUUID(),
      name,
      text,
      at: Date.now(),
      fromPresenter: isPresenter,
      stepIndex: room.state.stepIndex,
    });
  });

  socket.on('reaction:send', (payload: { emoji?: string }) => {
    if (!joinedCode) return;
    const emoji = payload?.emoji;
    if (typeof emoji !== 'string' || !(ALLOWED_REACTIONS as readonly string[]).includes(emoji)) return;
    if (!allow(reactBucket, 2, 10)) return;
    io.to(joinedCode).emit('reaction', { emoji, at: Date.now() });
  });

  socket.on('word:suggest', (payload: { word?: string }) => {
    if (!joinedCode || isPresenter) return;
    if (!allow(chatBucket, 0.5, 5)) return socket.emit('chat:error', 'Biraz yavaş 🙂');
    const word = cleanText(payload?.word, 40);
    if (!word) return;
    io.to(joinedCode).emit('word:suggested', { id: randomUUID(), word, name, at: Date.now() });
  });

  socket.on('disconnect', () => {
    const room = joinedCode ? rooms.get(joinedCode) : undefined;
    if (room) {
      room.people.delete(socket.id);
      io.to(room.code).emit('room:count', io.sockets.adapter.rooms.get(room.code)?.size ?? 0);
      emitPeople(room);
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > ROOM_TTL_MS) {
      io.to(code).emit('room:closed');
      io.in(code).socketsLeave(code);
      rooms.delete(code);
    }
  }
}, 10 * 60 * 1000).unref();

httpServer.listen(PORT, HOST, () => {
  console.log(`Teknodoz Sunum server → http://${HOST}:${PORT}`);
});
