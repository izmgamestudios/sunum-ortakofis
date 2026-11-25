// client/src/components/Search.tsx — global search / command palette (Ctrl+K)
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../store';
import { buildIndex, foldChars, scoreItem, subsequence, TYPE_META, type SearchItem, type SearchType } from '../lib/searchIndex';
import { foldTr } from '../lib/speechMatch';
import { keyLabel } from '../lib/shortcuts';

type Sort = 'relevance' | 'az' | 'type';
const RECENT_KEY = 'teknodoz-sunum:recent-search';
const PER_GROUP = 6;

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}
function saveRecent(q: string) {
  try {
    const list = [q, ...loadRecent().filter((x) => x !== q)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Highlight every occurrence of each token; fall back to fuzzy character marks. */
function Highlight({ text, tokens, fuzzy = false }: { text: string; tokens: string[]; fuzzy?: boolean }): ReactNode {
  if (!tokens.length) return text;
  const folded = foldChars(text);
  const marks = new Array(text.length).fill(false);
  let any = false;
  tokens.forEach((tk) => {
    let i = folded.indexOf(tk);
    while (tk && i >= 0) {
      any = true;
      for (let k = i; k < i + tk.length; k++) marks[k] = true;
      i = folded.indexOf(tk, i + tk.length);
    }
  });
  if (!any && fuzzy && tokens.length === 1 && subsequence(folded, tokens[0])) {
    let j = 0;
    const tk = tokens[0];
    for (let i = 0; i < folded.length && j < tk.length; i++) if (folded[i] === tk[j]) (marks[i] = true), j++;
  }
  const out: ReactNode[] = [];
  let buf = '';
  let cur = false;
  for (let i = 0; i <= text.length; i++) {
    const m: boolean = i < text.length ? marks[i] : !cur;
    if (i === text.length || m !== cur) {
      if (buf) out.push(cur ? <mark key={i}>{buf}</mark> : <Fragment key={i}>{buf}</Fragment>);
      buf = '';
      cur = m;
    }
    if (i < text.length) buf += text[i];
  }
  return out;
}

/** Excerpt of the body around the first match. */
function excerpt(body: string | undefined, tokens: string[]): string | null {
  if (!body || !tokens.length) return null;
  const f = foldChars(body);
  const i = Math.min(...tokens.map((t) => f.indexOf(t)).filter((x) => x >= 0), Infinity);
  if (!isFinite(i)) return null;
  const start = Math.max(0, i - 40);
  return `${start > 0 ? '…' : ''}${body.slice(start, start + 140)}${start + 140 < body.length ? '…' : ''}`;
}

export function SearchTrigger() {
  const setOpen = useApp((s) => s.setSearchOpen);
  return (
    <>
      <button className="search-trigger show-lg-up" onClick={() => setOpen(true)} aria-label="Ara (Ctrl+K)">
        <span aria-hidden>🔍</span>
        <span className="search-trigger-text">Ara: menü, şablon, model, kılavuz…</span>
        <kbd>{keyLabel('Mod')} K</kbd>
      </button>
      <button className="icon-btn icon-btn--ghost show-md-down" onClick={() => setOpen(true)} aria-label="Ara" title="Ara (Ctrl+K)">
        🔍
      </button>
    </>
  );
}

export function SearchPalette() {
  const open = useApp((s) => s.searchOpen);
  const setOpen = useApp((s) => s.setSearchOpen);
  const pres = useApp((s) => s.pres);
  const [q, setQ] = useState('');
  const [type, setType] = useState<SearchType | 'all'>('all');
  const [sort, setSort] = useState<Sort>('relevance');
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState<SearchType | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // rebuild when opened (own content changes over time)
  const index = useMemo(() => (open ? buildIndex() : []), [open, pres]); // eslint-disable-line react-hooks/exhaustive-deps
  const tokens = useMemo(() => foldTr(q).split(' ').filter(Boolean), [q]);

  const results = useMemo(() => {
    if (!tokens.length) return [];
    return index
      .filter((i) => type === 'all' || i.type === type)
      .map((i) => ({ i, s: scoreItem(i, tokens) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s);
  }, [index, tokens, type]);

  const counts = useMemo(() => {
    const c: Partial<Record<SearchType, number>> = {};
    if (tokens.length)
      index.forEach((i) => {
        if (scoreItem(i, tokens) > 0) c[i.type] = (c[i.type] ?? 0) + 1;
      });
    return c;
  }, [index, tokens]);

  /** grouped (relevance / type) or flat (A→Z) */
  const groups = useMemo(() => {
    if (sort === 'az') return [{ type: null as SearchType | null, items: [...results].sort((a, b) => a.i.title.localeCompare(b.i.title, 'tr')).map((r) => r.i), total: results.length }];
    const by = new Map<SearchType, { items: SearchItem[]; best: number }>();
    results.forEach(({ i, s }) => {
      const g = by.get(i.type) ?? { items: [], best: 0 };
      g.items.push(i);
      g.best = Math.max(g.best, s);
      by.set(i.type, g);
    });
    return [...by.entries()]
      .sort((a, b) => (sort === 'type' ? TYPE_META[a[0]].order - TYPE_META[b[0]].order : b[1].best - a[1].best))
      .map(([t, g]) => ({ type: t as SearchType | null, items: type === 'all' && expanded !== t ? g.items.slice(0, PER_GROUP) : g.items.slice(0, 120), total: g.items.length }));
  }, [results, sort, type, expanded]);

  const flat = groups.flatMap((g) => g.items);

  useEffect(() => {
    if (open) {
      setActive(0);
      setType('all'); // a fresh search starts unfiltered (sort preference is kept)
      setExpanded(null);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [open]);
  useEffect(() => setActive(0), [q, type, sort]);
  useEffect(() => {
    listRef.current?.querySelector('.sr-item.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const close = () => setOpen(false);
  const run = (item: SearchItem) => {
    if (q.trim()) saveRecent(q.trim());
    close();
    item.run();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && flat[active]) {
      e.preventDefault();
      run(flat[active]);
    }
    e.stopPropagation();
  };

  const recent = loadRecent();
  const quick: [string, () => void][] = [
    ['▶ Sunumu başlat', () => useApp.getState().start()],
    ['📚 Şablonlar', () => useApp.getState().openTemplates()],
    ['🧩 66 model', () => useApp.getState().openTemplates('cerceve')],
    ['📖 Kılavuz', () => useApp.getState().openHelp('guide')],
    ['⌨️ Kısayollar', () => useApp.getState().setShortcutsOpen(true)],
  ];
  let idx = -1;

  return (
    <div className="search-backdrop" onMouseDown={close}>
      <div className="search-panel" role="dialog" aria-modal="true" aria-label="Arama" onMouseDown={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className="search-box">
          <span aria-hidden>🔍</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Menü, ayar, şablon, model, kılavuz, SSS, kısayol, kendi içeriğin…"
            aria-label="Ara"
            aria-controls="search-results"
            aria-activedescendant={flat[active] ? `sr-${flat[active].id}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          {q && (
            <button className="icon-btn icon-btn--ghost" onClick={() => setQ('')} aria-label="Temizle">
              ✕
            </button>
          )}
        </div>
        <div className="search-filters">
          <div className="pill-grid">
            <button className={`pill pill--sm ${type === 'all' ? 'is-active' : ''}`} onClick={() => setType('all')}>
              Tümü {tokens.length ? Object.values(counts).reduce((a, b) => a + (b ?? 0), 0) : ''}
            </button>
            {(Object.keys(TYPE_META) as SearchType[]).map((t) => (
              <button key={t} className={`pill pill--sm ${type === t ? 'is-active' : ''}`} onClick={() => setType(type === t ? 'all' : t)} disabled={!!tokens.length && !counts[t]}>
                {TYPE_META[t].icon} {TYPE_META[t].label}
                {tokens.length ? ` ${counts[t] ?? 0}` : ''}
              </button>
            ))}
          </div>
          <label className="sort-select small">
            Sırala
            <select className="seg-select" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="relevance">En alakalı</option>
              <option value="type">Türe göre</option>
              <option value="az">A → Z</option>
            </select>
          </label>
        </div>

        <div className="search-results" id="search-results" role="listbox" ref={listRef}>
          {!tokens.length ? (
            <div className="search-empty">
              {recent.length > 0 && (
                <>
                  <p className="sr-group">🕘 Son aramalar</p>
                  <div className="pill-grid">
                    {recent.map((r) => (
                      <button key={r} className="pill pill--sm" onClick={() => setQ(r)}>
                        {r}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <p className="sr-group">⚡ Hızlı erişim</p>
              <div className="pill-grid">
                {quick.map(([l, fn]) => (
                  <button
                    key={l}
                    className="pill pill--sm"
                    onClick={() => {
                      close();
                      fn();
                    }}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <p className="muted small">
                İpucu: “zil”, “nefes”, “ikigai”, “pdf”, “katman”, “tam ekran”, “kısayol”… · Türkçe karakter gerekmez (“sablon” → şablon).
              </p>
            </div>
          ) : !flat.length ? (
            <p className="muted empty">“{q}” için sonuç yok. Daha kısa ya da farklı bir kelime dene.</p>
          ) : (
            groups.map((g) => (
              <section key={g.type ?? 'flat'} className="sr-section">
                {g.type && (
                  <p className="sr-group">
                    {TYPE_META[g.type].icon} {TYPE_META[g.type].label} ({g.total})
                  </p>
                )}
                {g.items.map((item) => {
                  idx++;
                  const i = idx;
                  const ex = item.type === 'guide' || item.type === 'faq' || item.type === 'template' || item.type === 'model' || item.type === 'content' ? excerpt(item.body, tokens) : null;
                  return (
                    <button
                      key={item.id}
                      id={`sr-${item.id}`}
                      role="option"
                      aria-selected={i === active}
                      className={`sr-item ${i === active ? 'is-active' : ''}`}
                      onMouseMove={() => i !== active && setActive(i)}
                      onClick={() => run(item)}
                    >
                      <span className="sr-icon" aria-hidden>
                        {item.icon ?? TYPE_META[item.type].icon}
                      </span>
                      <span className="sr-main">
                        <b className="sr-title">
                          <Highlight text={item.title} tokens={tokens} fuzzy />
                        </b>
                        <small className="sr-path">
                          {sort === 'az' && <span className="sr-badge">{TYPE_META[item.type].label}</span>}
                          <Highlight text={item.path.join(' › ')} tokens={tokens} />
                        </small>
                        {ex && (
                          <small className="sr-excerpt">
                            <Highlight text={ex} tokens={tokens} />
                          </small>
                        )}
                      </span>
                      {item.type === 'shortcut' && item.body && <kbd className="sr-kbd">{item.body}</kbd>}
                    </button>
                  );
                })}
                {g.type && type === 'all' && g.total > g.items.length && (
                  <button className="sr-more" onClick={() => setExpanded(g.type)}>
                    Tümünü gör ({g.total}) ↓
                  </button>
                )}
              </section>
            ))
          )}
        </div>
        <footer className="search-foot small muted">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> gez
          </span>
          <span>
            <kbd>Enter</kbd> aç
          </span>
          <span>
            <kbd>Esc</kbd> kapat
          </span>
          <span className="hide-sm">
            <kbd>?</kbd> kısayollar
          </span>
        </footer>
      </div>
    </div>
  );
}
