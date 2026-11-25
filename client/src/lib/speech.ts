// client/src/lib/speech.ts
import { create } from 'zustand';
import { useApp } from '../store';
import { readAsDataUrl } from './io';
import { uid } from './factory';
import { useSettings } from './settings';

/* Minimal typings — Web Speech API is not in lib.dom for all TS versions */
interface SRAlternative {
  transcript: string;
}
interface SRResult {
  isFinal: boolean;
  0: SRAlternative;
}
interface SREvent {
  resultIndex: number;
  results: ArrayLike<SRResult>;
}
interface SRErrorEvent {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SRCtor = new () => SpeechRecognitionLike;

function getCtor(): SRCtor | null {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const SPEECH_LANGS = [
  { code: 'tr-TR', label: 'Türkçe' },
  { code: 'en-US', label: 'English' },
  { code: 'de-DE', label: 'Deutsch' },
  { code: 'ar-SA', label: 'العربية' },
] as const;

const ERRORS: Record<string, string> = {
  'not-allowed': 'Mikrofon izni verilmedi. Tarayıcı adres çubuğundan izin ver.',
  'service-not-allowed': 'Tarayıcı konuşma tanıma servisine izin vermiyor (HTTPS veya localhost gerekir).',
  'audio-capture': 'Mikrofon bulunamadı.',
  network: 'Konuşma tanıma servisine ulaşılamadı (internet gerekli).',
};

interface SpeechState {
  supported: boolean;
  listening: boolean;
  recording: boolean;
  keepAudio: boolean;
  lang: string;
  interim: string;
  error: string | null;
  lastMatches: string[];
  start: () => Promise<void>;
  stop: () => void;
  setLang: (l: string) => void;
  setKeepAudio: (v: boolean) => void;
}

let recognizer: SpeechRecognitionLike | null = null;
let wantListening = false;
let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let matchTimer: ReturnType<typeof setTimeout> | undefined;

export const useSpeech = create<SpeechState>((set, get) => ({
  supported: typeof window !== 'undefined' && !!getCtor(),
  listening: false,
  recording: false,
  keepAudio: false,
  lang: 'tr-TR',
  interim: '',
  error: null,
  lastMatches: [],

  setLang: (lang) => {
    set({ lang });
    if (get().listening) {
      get().stop();
      void get().start();
    }
  },

  setKeepAudio: (keepAudio) => set({ keepAudio }),

  start: async () => {
    const Ctor = getCtor();
    set({ error: null });
    if (get().keepAudio) await startRecording();
    if (!Ctor) {
      if (!get().keepAudio) set({ error: 'Bu tarayıcı canlı konuşma tanımayı desteklemiyor (Chrome, Edge veya Safari kullan). Metni elle yapıştırabilirsin.' });
      return;
    }
    wantListening = true;
    const rec = new Ctor();
    rec.lang = get().lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0].transcript;
        if (r.isFinal) {
          const matches = useApp.getState().addTranscript(text, 'speech');
          if (matches.length) {
            set({ lastMatches: matches });
            clearTimeout(matchTimer);
            matchTimer = setTimeout(() => set({ lastMatches: [] }), 3500);
          }
        } else interim += text;
      }
      set({ interim });
    };
    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      wantListening = false;
      set({ error: ERRORS[e.error] ?? `Konuşma tanıma hatası: ${e.error}` });
    };
    // Chrome ends sessions after silence / ~60s — restart transparently while user wants it
    rec.onend = () => {
      if (wantListening && recognizer === rec) {
        try {
          rec.start();
          return;
        } catch {
          /* fallthrough */
        }
      }
      if (recognizer === rec) set({ listening: false, interim: '' });
    };
    recognizer = rec;
    try {
      rec.start();
      set({ listening: true });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Başlatılamadı' });
    }
  },

  stop: () => {
    wantListening = false;
    recognizer?.stop();
    recognizer = null;
    set({ listening: false, interim: '' });
    stopRecording();
  },
}));

async function startRecording(): Promise<void> {
  if (mediaRecorder || typeof MediaRecorder === 'undefined') return;
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
    const stream = mediaStream;
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined);
    const parts: Blob[] = [];
    const stepIdx = useApp.getState().live.stepIndex;
    const startedAt = Date.now();
    mediaRecorder = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size) parts.push(e.data);
    };
    rec.onstop = async () => {
      const type = rec.mimeType || 'audio/webm';
      const blob = new Blob(parts, { type });
      stream.getTracks().forEach((t) => t.stop());
      if (!mediaRecorder) useSpeech.setState({ recording: false });
      // skip accidental sub-second recordings (size thresholds vary by codec)
      if (Date.now() - startedAt < 1000 || !blob.size) return;
      const ext = type.includes('mp4') ? 'm4a' : 'webm';
      const name = `ses-kaydi-adim-${stepIdx + 1}-${new Date().toLocaleTimeString('tr-TR').replace(/:/g, '-')}.${ext}`;
      const dataUrl = await readAsDataUrl(blob);
      useApp.getState().updateStep(stepIdx, (s) => ({
        attachments: [...s.attachments, { id: uid(), kind: 'audio', name, mime: type, size: blob.size, dataUrl }],
      }));
    };
    rec.start(1000);
    useSpeech.setState({ recording: true });
  } catch {
    useSpeech.setState({ error: 'Ses kaydı başlatılamadı (mikrofon izni?).' });
  }
}

function stopRecording(): void {
  const rec = mediaRecorder;
  // detach synchronously so a new recording can start before the old onstop fires
  mediaRecorder = null;
  mediaStream = null;
  if (rec && rec.state !== 'inactive') rec.stop();
}

/**
 * Listening follows the timer: starts when a step starts (auto-listen), pauses during breaks and while paused,
 * resumes with the step, stops at the end. Each step also gets its own audio file.
 */
let lastStep = -1;
let lastPhase = '';
let lastPaused = false;
/** set by Transcript when the presenter starts/stops by hand during the current step */
export const listenOverride = { stoppedByHand: false };
useApp.subscribe((s) => {
  const { phase, stepIndex } = s.live;
  const paused = !!s.live.pausedAt;
  if (phase === lastPhase && stepIndex === lastStep && paused === lastPaused) return;
  const stepChanged = stepIndex !== lastStep && lastStep !== -1;
  const phaseChanged = phase !== lastPhase;
  lastStep = stepIndex;
  lastPhase = phase;
  lastPaused = paused;
  const sp = useSpeech.getState();
  if (stepChanged || phaseChanged) listenOverride.stoppedByHand = false;
  if (phase === 'done' || phase === 'idle') {
    if (sp.listening || sp.recording) sp.stop();
    return;
  }
  const want = phase === 'step' && !paused && useSettings.getState().autoListen && !listenOverride.stoppedByHand;
  if (want && !sp.listening && !sp.recording && sp.supported) {
    void sp.start();
    return;
  }
  if ((phase === 'break' || paused) && useSettings.getState().autoListen && (sp.listening || sp.recording)) {
    sp.stop();
    return;
  }
  if (stepChanged && sp.recording && phase === 'step') {
    stopRecording();
    setTimeout(() => void startRecording(), 300);
  }
});
