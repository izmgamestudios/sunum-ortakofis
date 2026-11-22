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

const PORT = Number(process.env.PORT ?? 3001);
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

interface Room {
  code: string;
  presenterToken: string;
  createdAt: number;
  lastActivity: number;
  state: PublicState;
}

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
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'data:', 'blob:', 'https:'],
        frameSrc: ["'self'", 'blob:', 'https://www.youtube-nocookie.com', 'https://player.vimeo.com'],
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
const io = new Server(httpServer, {
  maxHttpBufferSize: 16 * 1024,
  cors: IS_PROD ? undefined : { origin: true },
});

io.on('connection', (socket: Socket) => {
  const chatBucket: RateBucket = { tokens: 5, updatedAt: Date.now() };
  const reactBucket: RateBucket = { tokens: 10, updatedAt: Date.now() };
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
    ack({ ok: true, name, state: room.state });
    io.to(room.code).emit('room:count', io.sockets.adapter.rooms.get(room.code)?.size ?? 0);
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
    if (joinedCode && rooms.has(joinedCode)) {
      io.to(joinedCode).emit('room:count', io.sockets.adapter.rooms.get(joinedCode)?.size ?? 0);
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

httpServer.listen(PORT, () => {
  console.log(`Teknodoz Sunum server → http://localhost:${PORT}`);
});
