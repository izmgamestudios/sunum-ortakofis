// client/src/lib/theme.ts
import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';
const KEY = 'teknodoz-sunum:theme';

function read(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const mql = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function apply(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  const dark = mode === 'dark' || (mode === 'system' && !!mql?.matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1020' : '#3b8bf7');
}

interface ThemeState {
  mode: ThemeMode;
  /** what is actually rendered right now */
  resolved: 'light' | 'dark';
  setMode: (m: ThemeMode) => void;
}

export const useTheme = create<ThemeState>((set) => ({
  mode: read(),
  resolved: read() === 'system' ? (mql?.matches ? 'dark' : 'light') : (read() as 'light' | 'dark'),
  setMode: (mode) => {
    try {
      if (mode === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, mode);
    } catch {
      /* private mode */
    }
    apply(mode);
    set({ mode, resolved: mode === 'system' ? (mql?.matches ? 'dark' : 'light') : mode });
  },
}));

apply(useTheme.getState().mode);
mql?.addEventListener('change', (e) => {
  if (useTheme.getState().mode === 'system') {
    apply('system');
    useTheme.setState({ resolved: e.matches ? 'dark' : 'light' });
  }
});
