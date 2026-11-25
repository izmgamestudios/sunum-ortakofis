// client/src/lib/nav.ts — navigate to a view and optionally scroll to / flash a [data-anchor] section
import { useApp } from '../store';
import type { View } from '../types';

export function goTo(view: View, anchor?: string): void {
  useApp.getState().setView(view);
  if (!anchor) return;
  let tries = 0;
  const seek = () => {
    const el = document.querySelector<HTMLElement>(`[data-anchor="${anchor}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.remove('flash');
      void el.offsetWidth; // restart animation
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1800);
    } else if (tries++ < 30) requestAnimationFrame(seek);
  };
  requestAnimationFrame(seek);
}

/** Cross-component commands (shortcuts / search → components that own the DOM). */
export const APP_EVENTS = {
  import: 'sunum:import',
  fullscreen: 'sunum:fullscreen',
} as const;

export const emit = (name: string) => window.dispatchEvent(new CustomEvent(name));
