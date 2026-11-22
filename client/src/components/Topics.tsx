// client/src/components/Topics.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Step, TopicNode } from '../types';
import { createNode } from '../lib/factory';
import { parseOutline } from '../lib/outline';
import { WORD_BANK } from '../lib/catalog';
import { useApp } from '../store';

/* ---------------- tree helpers ---------------- */
function mapTree(nodes: TopicNode[], id: string, fn: (n: TopicNode) => TopicNode | null): TopicNode[] {
  return nodes.flatMap((n) => {
    if (n.id === id) {
      const r = fn(n);
      return r ? [r] : [];
    }
    return [{ ...n, children: mapTree(n.children, id, fn) }];
  });
}

/* ---------------- editors (setup) ---------------- */
export function TombalaEditor({ step, onChange }: { step: Step; onChange: (p: Partial<Step>) => void }) {
  const [input, setInput] = useState('');
  const add = (raw: string) => {
    const words = raw
      .split(/[,\n;]/)
      .map((w) => w.trim())
      .filter(Boolean)
      .filter((w) => !step.words.includes(w));
    if (words.length) onChange({ words: [...step.words, ...Array.from(new Set(words))].slice(0, 75) });
    setInput('');
  };
  const addRandom = () => {
    const pool = WORD_BANK.filter((w) => !step.words.includes(w));
    const picks = pool.sort(() => Math.random() - 0.5).slice(0, 9);
    onChange({ words: [...step.words, ...picks] });
  };
  return (
    <div className="stack">
      <p className="muted small">
        Sunum sırasında torbadan rastgele kelime çekilir; kelimeyi konuşmana bağladıkça işaretle. 3×3 kartta bir sıra dolunca <b>TOMBALA!</b> 🎉
      </p>
      <div className="row gap-s">
        <input
          className="input"
          value={input}
          placeholder="Kelime yaz, virgülle ayır…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add(input)}
        />
        <button className="btn" onClick={() => add(input)}>
          Ekle
        </button>
      </div>
      <div className="row gap-s wrap">
        <button className="btn btn-ghost" onClick={addRandom}>
          🎲 Hazır havuzdan 9 kelime
        </button>
        {step.words.length > 0 && (
          <button className="btn btn-ghost" onClick={() => onChange({ words: [] })}>
            Temizle
          </button>
        )}
      </div>
      <ul className="word-cloud">
        {step.words.map((w) => (
          <li key={w} className="ball ball--sm">
            {w}
            <button aria-label={`${w} sil`} onClick={() => onChange({ words: step.words.filter((x) => x !== w) })}>
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TreeEditNode({ node, depth, onTree, tree }: { node: TopicNode; depth: number; tree: TopicNode[]; onTree: (t: TopicNode[]) => void }) {
  return (
    <li>
      <div className="tree-row" style={{ paddingLeft: depth * 14 }}>
        <span className="tree-bullet">{depth === 0 ? '◆' : depth === 1 ? '◇' : '·'}</span>
        <input className="input input--inline" value={node.label} onChange={(e) => onTree(mapTree(tree, node.id, (n) => ({ ...n, label: e.target.value })))} aria-label="Başlık" />
        <button className="icon-btn" title="Alt başlık ekle" onClick={() => onTree(mapTree(tree, node.id, (n) => ({ ...n, children: [...n.children, createNode('Alt başlık')] })))}>
          ＋
        </button>
        <button className="icon-btn" title="Sil" onClick={() => onTree(mapTree(tree, node.id, () => null))}>
          ✕
        </button>
      </div>
      {node.children.length > 0 && (
        <ul className="tree">
          {node.children.map((c) => (
            <TreeEditNode key={c.id} node={c} depth={depth + 1} tree={tree} onTree={onTree} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function TreeEditor({ step, onChange }: { step: Step; onChange: (p: Partial<Step>) => void }) {
  const [outline, setOutline] = useState('');
  const onTree = (t: TopicNode[]) => onChange({ topicTree: t });
  return (
    <div className="stack">
      <p className="muted small">Konuyu iç içe kategorilere böl. Sunumda her başlığı işledikçe işaretle — rapor kapsama oranını hesaplar.</p>
      <ul className="tree">
        {step.topicTree.map((n) => (
          <TreeEditNode key={n.id} node={n} depth={0} tree={step.topicTree} onTree={onTree} />
        ))}
      </ul>
      <button className="btn btn-ghost" onClick={() => onTree([...step.topicTree, createNode('Ana başlık')])}>
        ＋ Ana başlık
      </button>
      <details className="outline-import">
        <summary>📋 Girintili listeden içe aktar</summary>
        <textarea
          className="input"
          rows={5}
          value={outline}
          placeholder={'Problem\n  Mevcut durum\n  Acı noktaları\nÇözüm\n  Demo'}
          onChange={(e) => setOutline(e.target.value)}
        />
        <button
          className="btn"
          onClick={() => {
            onTree([...step.topicTree, ...parseOutline(outline)]);
            setOutline('');
          }}
        >
          Ağaca ekle
        </button>
      </details>
    </div>
  );
}

/* ---------------- live ---------------- */
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export function TombalaLive({ index }: { index: number }) {
  const step = useApp((s) => s.pres.steps[index]);
  const drawWord = useApp((s) => s.drawWord);
  const toggleMark = useApp((s) => s.toggleMarkWord);
  const bingo = useApp((s) => s.bingo);
  const [rolling, setRolling] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const seenLines = useRef<Set<string>>(new Set());
  const card = useMemo(() => Array.from({ length: 9 }, (_, i) => step.words[i] ?? null), [step.words]);
  const last = step.drawnWords[step.drawnWords.length - 1];
  const remaining = step.words.length - step.drawnWords.length;

  useEffect(() => {
    seenLines.current = new Set();
  }, [index]);

  useEffect(() => {
    LINES.forEach((line) => {
      const key = line.join('-');
      const full = line.every((i) => card[i] && step.markedWords.includes(card[i]!));
      if (full && !seenLines.current.has(key)) {
        seenLines.current.add(key);
        bingo();
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 2500);
      }
    });
  }, [step.markedWords, card, bingo]);

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    setTimeout(() => {
      drawWord(index);
      setRolling(false);
    }, 700);
  };

  if (!step.words.length) return <p className="muted empty">Bu adım için tombala kelimesi girilmemiş. Kurulum ekranından ekleyebilirsin.</p>;

  return (
    <div className="stack tombala-live">
      <div className="row gap-m center">
        <div className={`ball ball--big ${rolling ? 'is-rolling' : ''}`} aria-live="polite">
          {rolling ? '🎱' : (last ?? '?')}
        </div>
        <div className="stack gap-s">
          <button className="btn btn-primary" onClick={roll} disabled={!remaining || rolling}>
            🎲 Kelime çek ({remaining})
          </button>
          {last && (
            <button className={`btn ${step.markedWords.includes(last) ? 'btn-success' : ''}`} onClick={() => toggleMark(index, last)}>
              {step.markedWords.includes(last) ? '✅ Bağlandı' : '☑️ Konuşmaya bağladım'}
            </button>
          )}
        </div>
      </div>
      {celebrate && <div className="bingo-banner">🎉 TOMBALA! 🎉</div>}
      <div className="bingo-card" role="grid" aria-label="Tombala kartı">
        {card.map((w, i) => (
          <button
            key={i}
            className={`bingo-cell ${w && step.markedWords.includes(w) ? 'is-marked' : ''} ${w && step.drawnWords.includes(w) ? 'is-drawn' : ''}`}
            disabled={!w}
            onClick={() => w && toggleMark(index, w)}
          >
            {w ?? '—'}
          </button>
        ))}
      </div>
      {step.drawnWords.length > 0 && (
        <ul className="word-cloud">
          {step.drawnWords.map((w) => (
            <li key={w}>
              <button className={`ball ball--sm ${step.markedWords.includes(w) ? 'is-marked' : ''}`} onClick={() => toggleMark(index, w)}>
                {w}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TreeLiveNode({ node, onToggle, depth }: { node: TopicNode; onToggle: (id: string) => void; depth: number }) {
  return (
    <li>
      <label className={`tree-row tree-row--live ${node.visited ? 'is-visited' : ''}`} style={{ paddingLeft: depth * 16 }}>
        <input type="checkbox" checked={!!node.visited} onChange={() => onToggle(node.id)} />
        <span>{node.label}</span>
      </label>
      {node.children.length > 0 && (
        <ul className="tree">
          {node.children.map((c) => (
            <TreeLiveNode key={c.id} node={c} onToggle={onToggle} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function TreeLive({ index }: { index: number }) {
  const step = useApp((s) => s.pres.steps[index]);
  const updateStep = useApp((s) => s.updateStep);
  if (!step.topicTree.length) return <p className="muted empty">Bu adım için konu ağacı yok.</p>;
  const toggle = (id: string) => updateStep(index, (s) => ({ topicTree: mapTree(s.topicTree, id, (n) => ({ ...n, visited: !n.visited })) }));
  return (
    <ul className="tree tree--live">
      {step.topicTree.map((n) => (
        <TreeLiveNode key={n.id} node={n} onToggle={toggle} depth={0} />
      ))}
    </ul>
  );
}
