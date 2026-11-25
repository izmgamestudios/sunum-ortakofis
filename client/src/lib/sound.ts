// client/src/lib/sound.ts — synthesized bell (Web Audio, no asset files)
let ctx: AudioContext | null = null;

/** Must run inside a user gesture once (browsers block audio until then). */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* audio unavailable */
  }
}

/** Inharmonic partials of a small bell, exponential decay. */
function strike(freq: number, at: number, dur: number, gain: number): void {
  if (!ctx) return;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(gain, at + 0.01);
  out.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  out.connect(ctx.destination);
  [
    [1, 1],
    [2.76, 0.45],
    [5.4, 0.22],
    [8.93, 0.1],
  ].forEach(([ratio, g]) => {
    const o = ctx!.createOscillator();
    const pg = ctx!.createGain();
    o.type = 'sine';
    o.frequency.value = freq * ratio;
    pg.gain.value = g;
    o.connect(pg).connect(out);
    o.start(at);
    o.stop(at + dur + 0.05);
  });
}

export type BellKind = 'warn' | 'tick' | 'end';

export function bell(kind: BellKind, volume = 0.6): void {
  unlockAudio();
  if (!ctx || ctx.state !== 'running') return;
  const t = ctx.currentTime + 0.02;
  const v = Math.max(0, Math.min(1, volume)) * 0.5;
  if (kind === 'tick') strike(1568, t, 0.18, v * 0.5);
  else if (kind === 'warn') {
    strike(880, t, 1.4, v);
    strike(1175, t + 0.25, 1.2, v * 0.7);
  } else {
    strike(660, t, 1.8, v);
    strike(880, t + 0.35, 1.8, v);
    strike(1320, t + 0.7, 2.2, v * 0.8);
  }
}
