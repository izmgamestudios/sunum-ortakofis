// client/src/lib/socket.ts
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: '/socket.io', transports: ['websocket', 'polling'], reconnectionDelayMax: 5000 });
  }
  return socket;
}

export function emitAck<T>(event: string, payload: unknown, timeoutMs = 5000): Promise<T> {
  const s = getSocket();
  return new Promise((resolve, reject) => {
    s.timeout(timeoutMs).emit(event, payload, (err: Error | null, res: T) => (err ? reject(err) : resolve(res)));
  });
}

export function joinUrl(code: string): string {
  const u = new URL(window.location.href);
  u.search = `?join=${code}`;
  u.hash = '';
  return u.toString();
}
