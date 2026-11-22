// client/src/components/StickyWall.tsx — audience chat, questions, word suggestions and notes as sticky notes
import { useMemo, useState } from 'react';
import { useApp } from '../store';
import { useRoom } from '../lib/room';
import { STICKY_COLORS } from '../lib/canvasDraw';

export type WallKind = 'chat' | 'question' | 'suggestion' | 'note' | 'presenter';

export interface WallItem {
  id: string;
  kind: WallKind;
  text: string;
  author: string;
  at: number;
  stepIndex: number;
}

export const WALL_META: Record<WallKind, { label: string; emoji: string; color: string }> = {
  question: { label: 'Sorular', emoji: '❓', color: STICKY_COLORS[1] },
  chat: { label: 'Sohbet', emoji: '💬', color: STICKY_COLORS[0] },
  suggestion: { label: 'Öneriler', emoji: '🎱', color: STICKY_COLORS[2] },
  note: { label: 'Notlarım', emoji: '📝', color: STICKY_COLORS[3] },
  presenter: { label: 'Sunucu', emoji: '🎤', color: STICKY_COLORS[4] },
};

/** All interactive inputs of the session, newest first. */
export function useWallItems(): WallItem[] {
  const chat = useApp((s) => s.pres.chat);
  const notes = useApp((s) => s.pres.notes);
  const startedAt = useApp((s) => s.pres.run.startedAt ?? 0);
  const suggestions = useRoom((s) => s.suggestions);
  const stepIndex = useApp((s) => s.live.stepIndex);
  return useMemo(() => {
    const items: WallItem[] = [
      ...chat.map((c) => ({
        id: c.id,
        kind: (c.fromPresenter ? 'presenter' : c.text.includes('?') ? 'question' : 'chat') as WallKind,
        text: c.text,
        author: c.name,
        at: c.at,
        stepIndex: c.stepIndex,
      })),
      ...suggestions.map((s) => ({ id: s.id, kind: 'suggestion' as const, text: s.word, author: s.name, at: s.at, stepIndex })),
      ...notes.map((n) => ({ id: n.id, kind: 'note' as const, text: n.text, author: 'Sen', at: startedAt + n.at, stepIndex: n.stepIndex })),
    ];
    return items.sort((a, b) => b.at - a.at);
  }, [chat, notes, suggestions, startedAt, stepIndex]);
}

function tilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 50) - 25) / 10; // −2.5° … +2.5°
}

interface Props {
  done: Set<string>;
  onToggleDone: (id: string) => void;
  onPin: (item: WallItem) => void;
}

export function StickyWall({ done, onToggleDone, onPin }: Props) {
  const items = useWallItems();
  const stepIndex = useApp((s) => s.live.stepIndex);
  const addNote = useApp((s) => s.addNote);
  const updateStep = useApp((s) => s.updateStep);
  const dismissSuggestion = useRoom((s) => s.dismissSuggestion);
  const [filter, setFilter] = useState<WallKind | 'all'>('all');
  const [onlyStep, setOnlyStep] = useState(false);
  const [draft, setDraft] = useState('');

  const scoped = onlyStep ? items.filter((i) => i.stepIndex === stepIndex) : items;
  const visible = filter === 'all' ? scoped : scoped.filter((i) => i.kind === filter);
  const count = (k: WallKind) => scoped.filter((i) => i.kind === k).length;

  return (
    <div className="wall">
      <div className="wall-bar">
        <div className="pill-grid">
          <button className={`pill pill--sm ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>
            Tümü {scoped.length}
          </button>
          {(Object.keys(WALL_META) as WallKind[]).map((k) =>
            count(k) ? (
              <button key={k} className={`pill pill--sm ${filter === k ? 'is-active' : ''}`} onClick={() => setFilter(k)}>
                {WALL_META[k].emoji} {WALL_META[k].label} {count(k)}
              </button>
            ) : null,
          )}
        </div>
        <label className="switch small">
          <input type="checkbox" checked={onlyStep} onChange={(e) => setOnlyStep(e.target.checked)} />
          <span>Bu adım</span>
        </label>
      </div>

      <div className="wall-grid" role="list">
        <form
          className="sticky sticky--compose"
          style={{ background: WALL_META.note.color }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            addNote('note', draft.trim());
            setDraft('');
          }}
        >
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="📝 Kendine not yaz…" rows={4} aria-label="Yeni not" onKeyDown={(e) => e.stopPropagation()} />
          <button className="btn btn-sm" type="submit">
            Yapıştır
          </button>
        </form>
        {visible.map((it) => (
          <article
            key={it.id}
            role="listitem"
            className={`sticky ${done.has(it.id) ? 'is-done' : ''}`}
            style={{ background: WALL_META[it.kind].color, transform: `rotate(${tilt(it.id)}deg)` }}
          >
            <header className="sticky-head">
              <span>
                {WALL_META[it.kind].emoji} {it.author}
              </span>
              <small>
                A{it.stepIndex + 1} · {new Date(it.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </small>
            </header>
            <p className="sticky-text">{it.text}</p>
            <footer className="sticky-actions">
              <button onClick={() => onPin(it)} title="Tuvale yapıştır">
                📌 Tuvale
              </button>
              {it.kind === 'suggestion' && (
                <button
                  onClick={() => {
                    updateStep(stepIndex, (s) => ({ words: s.words.includes(it.text) ? s.words : [...s.words, it.text] }));
                    dismissSuggestion(it.id);
                  }}
                  title="Bu adımın tombala torbasına ekle"
                >
                  🎱 Torbaya
                </button>
              )}
              <button onClick={() => onToggleDone(it.id)} title={done.has(it.id) ? 'Geri al' : 'Yanıtlandı / tamam'} aria-pressed={done.has(it.id)}>
                {done.has(it.id) ? '↺' : '✓'}
              </button>
            </footer>
          </article>
        ))}
        {!visible.length && (
          <p className="muted empty wall-empty">
            Henüz izleyici girdisi yok. “Oda” sekmesinden canlı oda açınca sohbet, sorular ve kelime önerileri burada not kağıdı olarak belirir.
          </p>
        )}
      </div>
    </div>
  );
}
