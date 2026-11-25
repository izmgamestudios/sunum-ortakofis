// client/src/lib/media.ts — cleaned-up microphone (noise reduction) and screen recording
import { create } from 'zustand';
import { useApp } from '../store';
import { uid } from './factory';
import { addRecording } from './recordings';
import { useSettings } from './settings';

export interface MicChain {
  stream: MediaStream;
  stop: () => void;
}

/**
 * Microphone with background-noise reduction:
 *  1. browser DSP (noise suppression, echo cancellation, auto gain)
 *  2. band-pass for speech: high-pass 90 Hz (hum, rumble, desk knocks), low-pass 7.5 kHz (hiss)
 *  3. adaptive noise gate: tracks the room's noise floor and turns the volume down between words
 *  4. gentle compressor so quiet and loud passages end up at a similar level
 */
export async function cleanMic(noiseReduce = useSettings.getState().noiseReduce): Promise<MicChain> {
  const raw = await navigator.mediaDevices.getUserMedia({
    audio: { noiseSuppression: noiseReduce, echoCancellation: noiseReduce, autoGainControl: true, channelCount: 1 },
  });
  if (!noiseReduce || typeof AudioContext === 'undefined') return { stream: raw, stop: () => raw.getTracks().forEach((t) => t.stop()) };

  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(raw);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 90;
  hp.Q.value = 0.7;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 7500;
  lp.Q.value = 0.7;
  const gate = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -28;
  comp.knee.value = 12;
  comp.ratio.value = 3.5;
  comp.attack.value = 0.005;
  comp.release.value = 0.2;
  const makeup = ctx.createGain();
  makeup.gain.value = 1.4;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  const dest = ctx.createMediaStreamDestination();
  src.connect(hp).connect(lp);
  lp.connect(analyser);
  lp.connect(gate).connect(comp).connect(makeup).connect(dest);

  // adaptive gate: noise floor follows the quietest level, opens ~3.5× above it
  const buf = new Float32Array(analyser.fftSize);
  let floor = 0.004;
  let open = false;
  let hold = 0;
  const timer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    floor = rms < floor ? floor * 0.9 + rms * 0.1 : floor * 0.999 + rms * 0.001;
    floor = Math.min(Math.max(floor, 0.0008), 0.05);
    const loud = rms > floor * 3.5;
    if (loud) hold = 12; // ~240 ms hold so word endings aren't chopped
    else if (hold > 0) hold--;
    const want = loud || hold > 0;
    if (want !== open) {
      open = want;
      const t = ctx.currentTime;
      gate.gain.cancelScheduledValues(t);
      gate.gain.setTargetAtTime(open ? 1 : 0.06, t, open ? 0.01 : 0.12);
    }
  }, 20);

  return {
    stream: dest.stream,
    stop: () => {
      clearInterval(timer);
      raw.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Screen recording                                                   */
/* ------------------------------------------------------------------ */
interface ScreenRecState {
  active: boolean;
  startedAt: number | null;
  error: string | null;
  withMic: boolean;
  start: () => Promise<void>;
  stop: () => void;
  setWithMic: (v: boolean) => void;
}

let recorder: MediaRecorder | null = null;
let cleanup: (() => void) | null = null;

export const screenRecSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== 'undefined';

export const useScreenRec = create<ScreenRecState>((set, get) => ({
  active: false,
  startedAt: null,
  error: null,
  withMic: true,
  setWithMic: (withMic) => set({ withMic }),

  start: async () => {
    if (recorder || !screenRecSupported) return;
    set({ error: null });
    let display: MediaStream;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
    } catch {
      set({ error: 'Ekran paylaşımı iptal edildi ya da izin verilmedi.' });
      return;
    }
    let mic: MicChain | null = null;
    if (get().withMic) mic = await cleanMic().catch(() => null);

    // mix tab/system audio + presenter microphone into one track
    const ctx = new AudioContext();
    const mixDest = ctx.createMediaStreamDestination();
    if (display.getAudioTracks().length) ctx.createMediaStreamSource(new MediaStream(display.getAudioTracks())).connect(mixDest);
    if (mic) ctx.createMediaStreamSource(mic.stream).connect(mixDest);
    const tracks = [...display.getVideoTracks(), ...(display.getAudioTracks().length || mic ? mixDest.stream.getAudioTracks() : [])];
    const out = new MediaStream(tracks);

    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
    const rec = new MediaRecorder(out, mime ? { mimeType: mime, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 96_000 } : undefined);
    const parts: Blob[] = [];
    const startedAt = Date.now();
    const { pres, live } = useApp.getState();
    const presId = pres.id;
    const stepIndex = live.stepIndex;
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
    rec.onstop = async () => {
      const type = rec.mimeType || 'video/webm';
      const blob = new Blob(parts, { type });
      if (blob.size && Date.now() - startedAt > 1000) {
        const ext = type.includes('mp4') ? 'mp4' : 'webm';
        const name = `ekran-kaydi-${new Date(startedAt).toLocaleString('tr-TR').replace(/[.:\s/]+/g, '-')}.${ext}`;
        await addRecording({ id: uid(), presId, stepIndex, stepTitle: 'Ekran kaydı', name, mime: type, size: blob.size, startedAt, durationMs: Date.now() - startedAt, blob, kind: 'screen' }).catch(() =>
          set({ error: 'Ekran kaydı cihaza kaydedilemedi (depolama dolu olabilir).' }),
        );
      }
    };
    cleanup = () => {
      display.getTracks().forEach((t) => t.stop());
      mic?.stop();
      void ctx.close();
    };
    // the browser's own "Stop sharing" button ends the recording too
    display.getVideoTracks()[0]?.addEventListener('ended', () => get().stop());
    rec.start(1000);
    recorder = rec;
    set({ active: true, startedAt });
  },

  stop: () => {
    const rec = recorder;
    recorder = null;
    if (rec && rec.state !== 'inactive') rec.stop();
    cleanup?.();
    cleanup = null;
    set({ active: false, startedAt: null });
  },
}));
