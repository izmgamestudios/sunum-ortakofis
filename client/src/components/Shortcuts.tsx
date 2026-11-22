// client/src/components/Shortcuts.tsx — shortcut table/modal + global keyboard handler
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store';
import { useTheme } from '../lib/theme';
import { useSettings } from '../lib/settings';
import { exportSnmtdz } from '../lib/io';
import { APP_EVENTS, emit } from '../lib/nav';
import { SHORTCUTS, keyLabel, type ShortcutScope } from '../lib/shortcuts';
import { foldTr } from '../lib/speechMatch';

export function ShortcutsTable({ filter = '' }: { filter?: string }) {
  const f = foldTr(filter);
  const scopes = Array.from(new Set(SHORTCUTS.map((s) => s.scope))) as ShortcutScope[];
  return (
    <div className="kbd-groups">
      {scopes.map((scope) => {
        const rows = SHORTCUTS.filter((s) => s.scope === scope && (!f || foldTr(`${s.label} ${s.keys.flat().join(' ')}`).includes(f)));
        if (!rows.length) return null;
        return (
          <section key={scope} className="kbd-group">
            <h3>{scope}</h3>
            <table className="kbd-table">
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>{s.label}</td>
                    <td className="kbd-keys">
                      {s.keys.map((combo, i) => (
                        <span key={i} className="kbd-combo">
                          {i > 0 && <span className="muted"> / </span>}
                          {combo.map((k, j) => (
                            <span key={j}>
                              {j > 0 && <span className="muted"> + </span>}
                              <kbd>{keyLabel(k)}</kbd>
                            </span>
                          ))}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

export function ShortcutsModal() {
  const open = useApp((s) => s.shortcutsOpen);
  const setOpen = useApp((s) => s.setShortcutsOpen);
  const [q, setQ] = useState('');
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label="Klavye kısayolları"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // handle Esc here: propagation is stopped so typing doesn't trigger global shortcuts
          if (e.key === 'Escape') setOpen(false);
          e.stopPropagation();
        }}
      >
        <header className="modal-head">
          <h2>⌨️ Klavye kısayolları</h2>
          <button className="icon-btn icon-btn--ghost" onClick={() => setOpen(false)} aria-label="Kapat">
            ✕
          </button>
        </header>
        <div className="modal-tools">
          <input className="input" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Kısayol ara: tam ekran, geri al, not…" />
        </div>
        <div className="modal-scroll">
          <ShortcutsTable filter={q} />
        </div>
      </div>
    </div>
  );
}

const THEME_CYCLE = { light: 'dark', dark: 'system', system: 'light' } as const;

/** App-wide shortcuts. Typing in inputs is respected except for Mod+K / Mod+S. */
export function useGlobalShortcuts() {
  const gPending = useRef<number>(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const app = useApp.getState();
      const mod = e.ctrlKey || e.metaKey;
      const typing = !!(e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable]');
      const key = e.key.toLowerCase();

      if (mod && key === 'k') {
        e.preventDefault();
        app.setSearchOpen(!app.searchOpen);
        return;
      }
      if (mod && key === 's') {
        e.preventDefault();
        void exportSnmtdz(app.pres);
        return;
      }
      if (typing || app.searchOpen) return;
      if (mod && key === 'o') {
        e.preventDefault();
        emit(APP_EVENTS.import);
        return;
      }
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        if (app.live.phase === 'step' || app.live.phase === 'break') app.setView('live');
        else app.start();
        return;
      }
      if (mod || e.altKey) return;

      // "g" then a letter → section
      if (Date.now() - gPending.current < 1200) {
        gPending.current = 0;
        const target = { h: () => app.setView('setup'), s: () => app.setView('live'), r: () => app.setView('report'), t: () => app.openTemplates(), m: () => app.openTemplates('cerceve'), y: () => app.openHelp('guide') }[key];
        if (target) {
          e.preventDefault();
          target();
        }
        return;
      }
      // canvas owns single-letter keys while focused
      if ((e.target as HTMLElement).closest?.('.board-surface-wrap, .slides')) return;

      if (e.key === '/') {
        e.preventDefault();
        app.setSearchOpen(true);
      } else if (e.key === '?') {
        e.preventDefault();
        app.setShortcutsOpen(true);
      } else if (e.key === 'T' && e.shiftKey) {
        const { mode, setMode } = useTheme.getState();
        setMode(THEME_CYCLE[mode]);
      } else if (key === 'g' && !e.shiftKey) {
        gPending.current = Date.now();
      } else if (app.view === 'live' && key === 'f') {
        emit(APP_EVENTS.fullscreen);
      } else if (app.view === 'live' && key === 'b') {
        const s = useSettings.getState();
        s.set({ bell: !s.bell });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
