// client/src/lib/settings.ts — per-device preferences (not part of the presentation file)
import { create } from 'zustand';

export interface Settings {
  bell: boolean;
  /** first warning chime N seconds before the step ends */
  bellWarnSec: 10 | 30 | 60;
  volume: number;
  /** canvas = everything on one canvas (HUD, panels as overlays); classic = canvas + sidebar */
  liveLayout: 'canvas' | 'classic';
  /** start listening (speech-to-text) when the presentation starts; pause with the timer */
  autoListen: boolean;
}

const KEY = 'teknodoz-sunum:settings';
const DEFAULTS: Settings = { bell: true, bellWarnSec: 10, volume: 0.6, liveLayout: 'canvas', autoListen: true };

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

export const useSettings = create<Settings & { set: (p: Partial<Settings>) => void }>((set, get) => ({
  ...load(),
  set: (p) => {
    set(p);
    const { bell, bellWarnSec, volume, liveLayout, autoListen } = { ...get(), ...p };
    try {
      localStorage.setItem(KEY, JSON.stringify({ bell, bellWarnSec, volume, liveLayout, autoListen }));
    } catch {
      /* private mode */
    }
  },
}));
