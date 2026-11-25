// server/interact.ts — live polls, quiz with leaderboard, pitch-day jury (PIN or invited e-mail)
import express, { type Router } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import type { Auth } from './auth.js';

export type QKind = 'choice' | 'yesno' | 'scale' | 'cloud' | 'open' | 'quiz';
interface Question {
  id: string;
  kind: QKind;
  text: string;
  options: string[];
  correct?: number;
  timeLimit?: number;
}
interface Vote {
  answer: number | string;
  at: number;
  name: string;
}
interface Active {
  q: Question;
  stepIndex: number;
  openedAt: number;
  endsAt: number | null;
  votes: Map<string, Vote>;
  timer?: ReturnType<typeof setTimeout>;
}
interface Criterion {
  id: string;
  label: string;
  weight: number;
}
interface JuryScore {
  scores: Record<string, number>;
  comment: string;
  name: string;
  at: number;
}
interface Jury {
  criteria: Criterion[];
  pin: string | null;
  emails: string[];
  jurors: Map<string, { name: string; email?: string; socketId: string }>;
  /** stepIndex → juror key → score */
  scores: Map<number, Map<string, JuryScore>>;
}
interface RoomInteract {
  presenters: Set<string>;
  active: Active | null;
  board: Map<string, { name: string; points: number; correct: number }>;
  jury: Jury | null;
}

const KINDS: QKind[] = ['choice', 'yesno', 'scale', 'cloud', 'open', 'quiz'];
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const isId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{4,64}$/.test(v);
const EMAIL_RE = /^[^\s@<>()",;:]{1,64}@[a-z0-9.-]{1,190}\.[a-z]{2,24}$/i;

function sanitizeQuestion(raw: unknown): Question | null {
  const q = raw as Partial<Question> | null;
  if (!q || !isId(q.id) || !KINDS.includes(q.kind as QKind)) return null;
  const text = clean(q.text, 200);
  if (!text) return null;
  let options = Array.isArray(q.options) ? q.options.map((o) => clean(o, 80)).filter(Boolean).slice(0, 8) : [];
  if (q.kind === 'yesno') options = ['Evet', 'Hayır'];
  if (q.kind === 'scale') options = ['1', '2', '3', '4', '5'];
  if ((q.kind === 'choice' || q.kind === 'quiz') && options.length < 2) return null;
  const correct = q.kind === 'quiz' && Number.isInteger(q.correct) && (q.correct as number) >= 0 && (q.correct as number) < options.length ? (q.correct as number) : undefined;
  if (q.kind === 'quiz' && correct === undefined) return null;
  const timeLimit = q.kind === 'quiz' ? Math.max(5, Math.min(120, Math.round(Number(q.timeLimit) || 20))) : undefined;
  return { id: q.id, kind: q.kind as QKind, text, options, correct, timeLimit };
}

export interface InteractCtx {
  room: () => { code: string } | null;
  isPresenter: () => boolean;
  name: () => string;
}

export function createInteract(io: Server, auth: Auth, secret: string) {
  const state = new Map<string, RoomInteract>();
  const of = (code: string): RoomInteract => {
    let s = state.get(code);
    if (!s) {
      s = { presenters: new Set(), active: null, board: new Map(), jury: null };
      state.set(code, s);
    }
    return s;
  };
  const toPresenters = (code: string, ev: string, payload: unknown) => of(code).presenters.forEach((id) => io.to(id).emit(ev, payload));

  /* ---------- poll helpers ---------- */
  const publicQuestion = (a: Active) => ({ id: a.q.id, kind: a.q.kind, text: a.q.text, options: a.q.options, stepIndex: a.stepIndex, endsAt: a.endsAt, timeLimit: a.q.timeLimit ?? null });
  function tally(a: Active) {
    const counts = a.q.options.map(() => 0);
    const words = new Map<string, number>();
    const texts: string[] = [];
    let sum = 0;
    for (const v of a.votes.values()) {
      if (typeof v.answer === 'number') {
        counts[v.answer] = (counts[v.answer] ?? 0) + 1;
        sum += v.answer + 1;
      } else if (a.q.kind === 'cloud') {
        const w = v.answer.toLocaleLowerCase('tr-TR');
        words.set(w, (words.get(w) ?? 0) + 1);
      } else texts.push(v.answer);
    }
    return {
      qid: a.q.id,
      total: a.votes.size,
      counts,
      average: a.q.kind === 'scale' && a.votes.size ? Math.round((sum / a.votes.size) * 10) / 10 : null,
      words: [...words.entries()].sort((x, y) => y[1] - x[1]).slice(0, 40),
      texts: texts.slice(-60),
    };
  }
  const boardTop = (s: RoomInteract) =>
    [...s.board.entries()]
      .sort((a, b) => b[1].points - a[1].points)
      .slice(0, 10)
      .map(([, v], i) => ({ rank: i + 1, name: v.name, points: v.points, correct: v.correct }));

  function closePoll(code: string) {
    const s = of(code);
    const a = s.active;
    if (!a) return;
    clearTimeout(a.timer);
    s.active = null;
    const t = tally(a);
    let gained: Record<string, number> = {};
    if (a.q.kind === 'quiz' && a.q.correct !== undefined) {
      const limitMs = (a.q.timeLimit ?? 20) * 1000;
      for (const [voter, v] of a.votes) {
        const right = v.answer === a.q.correct;
        const pts = right ? 500 + Math.round(500 * Math.max(0, 1 - (v.at - a.openedAt) / limitMs)) : 0;
        const row = s.board.get(voter) ?? { name: v.name, points: 0, correct: 0 };
        row.name = v.name;
        row.points += pts;
        row.correct += right ? 1 : 0;
        s.board.set(voter, row);
        gained[voter] = pts;
      }
    } else gained = {};
    const results = { ...t, question: { id: a.q.id, kind: a.q.kind, text: a.q.text, options: a.q.options, stepIndex: a.stepIndex }, correct: a.q.correct ?? null, board: a.q.kind === 'quiz' ? boardTop(s) : null };
    io.to(code).emit('poll:results', results);
    // each quiz player learns their own points
    if (a.q.kind === 'quiz') for (const sock of io.sockets.adapter.rooms.get(code) ?? []) {
      const voter = io.sockets.sockets.get(sock)?.data.voterId as string | undefined;
      if (voter && voter in gained) io.to(sock).emit('quiz:you', { points: gained[voter], total: s.board.get(voter)?.points ?? 0, rank: [...s.board.entries()].sort((x, y) => y[1].points - x[1].points).findIndex(([k]) => k === voter) + 1 });
    }
  }

  /* ---------- jury ---------- */
  const juryOverview = (s: RoomInteract) => {
    const j = s.jury;
    if (!j) return null;
    const wsum = j.criteria.reduce((a, c) => a + c.weight, 0) || 1;
    const byStep = [...j.scores.entries()].map(([stepIndex, m]) => {
      const rows = [...m.values()];
      const avg: Record<string, number> = {};
      for (const c of j.criteria) {
        const vals = rows.map((r) => r.scores[c.id]).filter((x) => typeof x === 'number');
        avg[c.id] = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
      }
      const total = Math.round((j.criteria.reduce((a, c) => a + avg[c.id] * c.weight, 0) / wsum) * 100) / 100;
      return { stepIndex, avg, total, jurors: rows.length, comments: rows.filter((r) => r.comment).map((r) => ({ name: r.name, text: r.comment })) };
    });
    return { criteria: j.criteria, byStep, jurors: [...j.jurors.values()].map((x) => x.name) };
  };

  /* juror e-mail token (the socket handshake predates the e-mail login cookie) */
  const signJury = (email: string, code: string) => {
    const body = Buffer.from(JSON.stringify({ e: email, c: code, exp: Date.now() + 10 * 60 * 1000 })).toString('base64url');
    return `${body}.${createHmac('sha256', `${secret}:jury`).update(body).digest('base64url')}`;
  };
  const verifyJury = (tok: unknown, code: string): string | null => {
    const [body, sig] = String(tok ?? '').split('.');
    if (!body || !sig) return null;
    const want = createHmac('sha256', `${secret}:jury`).update(body).digest('base64url');
    if (want.length !== sig.length || !timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
    try {
      const t = JSON.parse(Buffer.from(body, 'base64url').toString()) as { e: string; c: string; exp: number };
      return t.exp > Date.now() && t.c === code ? t.e : null;
    } catch {
      return null;
    }
  };
  const router: Router = express.Router();
  router.get('/jury-token', (req, res) => {
    const email = auth.emailOf(req.headers.cookie);
    const code = String(req.query.code ?? '').toUpperCase();
    if (!email) return res.status(401).json({ error: 'Önce e-postanla giriş yap.' });
    const j = state.get(code)?.jury;
    if (!j) return res.status(404).json({ error: 'Bu odada jüri değerlendirmesi açık değil.' });
    if (!j.emails.includes(email)) return res.status(403).json({ error: `${email} bu odanın jüri listesinde değil.` });
    res.json({ token: signJury(email, code) });
  });

  /* ---------- per-socket handlers ---------- */
  function attach(socket: Socket, ctx: InteractCtx) {
    let tokens = 10;
    let refill = Date.now();
    const allow = (rate = 4, burst = 10) => {
      const now = Date.now();
      tokens = Math.min(burst, tokens + ((now - refill) / 1000) * rate);
      refill = now;
      if (tokens < 1) return false;
      tokens -= 1;
      return true;
    };
    const presenterRoom = () => (ctx.isPresenter() ? ctx.room() : null);

    socket.on('interact:hello', (p: { voterId?: unknown }) => {
      if (isId(p?.voterId)) socket.data.voterId = p.voterId;
      const room = ctx.room();
      if (!room) return;
      const s = of(room.code);
      if (ctx.isPresenter()) {
        s.presenters.add(socket.id);
        const o = juryOverview(s);
        if (o) socket.emit('jury:update', o);
      }
      if (s.active) socket.emit('poll:state', publicQuestion(s.active));
      if (s.jury) socket.emit('jury:open', { criteria: s.jury.criteria, pinMode: !!s.jury.pin, emailMode: s.jury.emails.length > 0 });
    });

    socket.on('poll:open', (p: { stepIndex?: unknown; question?: unknown }, ack?: (r: unknown) => void) => {
      const room = presenterRoom();
      const q = sanitizeQuestion(p?.question);
      if (!room || !q) return typeof ack === 'function' && ack({ ok: false, error: 'Soru geçersiz' });
      const s = of(room.code);
      s.presenters.add(socket.id);
      if (s.active) closePoll(room.code);
      const now = Date.now();
      const a: Active = { q, stepIndex: Number.isInteger(p.stepIndex) ? (p.stepIndex as number) : 0, openedAt: now, endsAt: q.timeLimit ? now + q.timeLimit * 1000 : null, votes: new Map() };
      if (q.timeLimit) a.timer = setTimeout(() => closePoll(room.code), q.timeLimit * 1000 + 300);
      s.active = a;
      io.to(room.code).emit('poll:state', publicQuestion(a));
      toPresenters(room.code, 'poll:tally', tally(a));
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('poll:close', () => {
      const room = presenterRoom();
      if (room) closePoll(room.code);
    });

    socket.on('poll:reset-board', () => {
      const room = presenterRoom();
      if (room) of(room.code).board.clear();
    });

    socket.on('poll:vote', (p: { qid?: unknown; answer?: unknown }, ack?: (r: unknown) => void) => {
      const reply = (r: unknown) => typeof ack === 'function' && ack(r);
      const room = ctx.room();
      if (!room || ctx.isPresenter() || !allow()) return reply({ ok: false });
      const voter = socket.data.voterId as string | undefined;
      const a = of(room.code).active;
      if (!voter || !a || a.q.id !== p?.qid) return reply({ ok: false, error: 'Soru kapandı.' });
      if (a.endsAt && Date.now() > a.endsAt + 500) return reply({ ok: false, error: 'Süre doldu.' });
      if (a.q.kind === 'quiz' && a.votes.has(voter)) return reply({ ok: false, error: 'Cevabın alındı.' });
      let answer: number | string;
      if (a.q.kind === 'cloud' || a.q.kind === 'open') {
        answer = clean(p.answer, a.q.kind === 'cloud' ? 30 : 280);
        if (!answer) return reply({ ok: false });
      } else {
        const n = Number(p.answer);
        if (!Number.isInteger(n) || n < 0 || n >= a.q.options.length) return reply({ ok: false });
        answer = n;
      }
      a.votes.set(voter, { answer, at: Date.now(), name: ctx.name() });
      toPresenters(room.code, 'poll:tally', tally(a));
      reply({ ok: true });
    });

    /* jury */
    socket.on('jury:config', (p: { criteria?: unknown; pin?: unknown; emails?: unknown; enabled?: unknown }, ack?: (r: unknown) => void) => {
      const room = presenterRoom();
      if (!room) return;
      const s = of(room.code);
      s.presenters.add(socket.id);
      if (p?.enabled === false) {
        s.jury = null;
        return typeof ack === 'function' && ack({ ok: true });
      }
      const criteria = (Array.isArray(p?.criteria) ? p.criteria : [])
        .map((c: { id?: unknown; label?: unknown; weight?: unknown }) => ({ id: isId(c?.id) ? (c.id as string) : '', label: clean(c?.label, 40), weight: Math.max(0, Math.min(10, Number(c?.weight) || 1)) }))
        .filter((c: Criterion) => c.id && c.label)
        .slice(0, 10);
      if (!criteria.length) return typeof ack === 'function' && ack({ ok: false, error: 'En az bir kriter gerekli' });
      const pin = typeof p.pin === 'string' && /^\d{4,8}$/.test(p.pin) ? p.pin : null;
      const emails = (Array.isArray(p.emails) ? p.emails : [])
        .map((e: unknown) => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
        .filter((e: string) => EMAIL_RE.test(e))
        .slice(0, 100);
      const prev = s.jury;
      s.jury = { criteria, pin, emails, jurors: prev?.jurors ?? new Map(), scores: prev?.scores ?? new Map() };
      // jurors whose access was removed are dropped
      for (const [k, j] of s.jury.jurors) if ((j.email && !emails.includes(j.email)) || (!j.email && !pin)) s.jury.jurors.delete(k);
      io.to(room.code).emit('jury:open', { criteria, pinMode: !!pin, emailMode: emails.length > 0 });
      toPresenters(room.code, 'jury:update', juryOverview(s));
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('jury:join', (p: { pin?: unknown; token?: unknown; name?: unknown }, ack?: (r: unknown) => void) => {
      const reply = (r: unknown) => typeof ack === 'function' && ack(r);
      const room = ctx.room();
      if (!room || !allow(1, 5)) return reply({ ok: false, error: 'Çok fazla deneme.' });
      const s = of(room.code);
      const j = s.jury;
      if (!j) return reply({ ok: false, error: 'Bu odada jüri değerlendirmesi açık değil.' });
      let key: string;
      let jname: string;
      let email: string | undefined;
      const viaEmail = verifyJury(p?.token, room.code);
      if (viaEmail && j.emails.includes(viaEmail)) {
        key = `e:${viaEmail}`;
        email = viaEmail;
        jname = clean(p?.name, 30) || viaEmail.split('@')[0];
      } else if (j.pin && typeof p?.pin === 'string' && p.pin.length === j.pin.length && timingSafeEqual(Buffer.from(p.pin), Buffer.from(j.pin))) {
        key = `p:${(socket.data.voterId as string) ?? socket.id}`;
        jname = clean(p?.name, 30) || `Jüri ${j.jurors.size + 1}`;
      } else return reply({ ok: false, error: 'PIN ya da jüri daveti doğrulanamadı.' });
      j.jurors.set(key, { name: jname, email, socketId: socket.id });
      socket.data.jurorKey = key;
      toPresenters(room.code, 'jury:update', juryOverview(s));
      reply({ ok: true, name: jname, criteria: j.criteria });
    });

    socket.on('jury:score', (p: { stepIndex?: unknown; scores?: unknown; comment?: unknown }, ack?: (r: unknown) => void) => {
      const reply = (r: unknown) => typeof ack === 'function' && ack(r);
      const room = ctx.room();
      const key = socket.data.jurorKey as string | undefined;
      if (!room || !key || !allow()) return reply({ ok: false });
      const s = of(room.code);
      const j = s.jury;
      const juror = j?.jurors.get(key);
      if (!j || !juror || !Number.isInteger(p?.stepIndex) || (p.stepIndex as number) < 0 || (p.stepIndex as number) > 60) return reply({ ok: false, error: 'Jüri oturumu geçersiz.' });
      const raw = (p.scores ?? {}) as Record<string, unknown>;
      const scores: Record<string, number> = {};
      for (const c of j.criteria) {
        const v = Number(raw[c.id]);
        if (!Number.isInteger(v) || v < 1 || v > 10) return reply({ ok: false, error: `“${c.label}” için 1–10 arası puan ver.` });
        scores[c.id] = v;
      }
      const m = j.scores.get(p.stepIndex as number) ?? new Map<string, JuryScore>();
      m.set(key, { scores, comment: clean(p.comment, 300), name: juror.name, at: Date.now() });
      j.scores.set(p.stepIndex as number, m);
      toPresenters(room.code, 'jury:update', juryOverview(s));
      reply({ ok: true });
    });

    socket.on('disconnect', () => {
      for (const s of state.values()) s.presenters.delete(socket.id);
    });
  }

  const forget = (code: string) => {
    clearTimeout(state.get(code)?.active?.timer);
    state.delete(code);
  };

  return { attach, router, forget };
}
