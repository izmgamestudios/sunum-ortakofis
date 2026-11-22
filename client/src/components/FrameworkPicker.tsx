// client/src/components/FrameworkPicker.tsx — insert one of 60 framework infographics onto the canvas
import { useEffect, useMemo, useState } from 'react';
import type { CanvasElement } from '../types';
import { FRAMEWORKS, FW_GROUPS, type Framework, type FwGroup } from '../lib/frameworks';
import { buildFramework } from '../lib/frameworkDraw';
import { fwThumb } from '../lib/fwThumbs';
import { foldTr as normalizeTr } from '../lib/speechMatch';

export function FwThumb({ id, width = 360, className = '' }: { id: number; width?: number; className?: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    fwThumb(id, width).then((s) => alive && setSrc(s));
    return () => {
      alive = false;
    };
  }, [id, width]);
  return src ? <img src={src} alt="" className={className} loading="lazy" /> : <div className={`${className} thumb-skeleton`} />;
}

interface Props {
  hasContent: boolean;
  onInsert: (els: CanvasElement[], replace: boolean) => void;
  onClose: () => void;
}

export function FrameworkPicker({ hasContent, onInsert, onClose }: Props) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<FwGroup | 'all'>('all');
  const [pick, setPick] = useState<Framework | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        pick ? setPick(null) : onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [pick, onClose]);

  const list = useMemo(() => {
    const nq = normalizeTr(q);
    return FRAMEWORKS.filter((f) => (group === 'all' || f.group === group) && (!nq || normalizeTr(`${f.name} ${f.subtitle} ${f.desc} ${f.parts.join(' ')}`).includes(nq)));
  }, [q, group]);

  const insert = (replace: boolean) => {
    if (!pick) return;
    onInsert(buildFramework(pick), replace);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" role="dialog" aria-modal="true" aria-label="Çerçeve ekle" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>🧩 Çerçeve & model ekle</h2>
          <button className="icon-btn icon-btn--ghost" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </header>
        {!pick ? (
          <>
            <div className="stack modal-tools">
              <input className="input" autoFocus placeholder={`🔍 ${FRAMEWORKS.length} model içinde ara: Ikigai, SWOT, OKR, Pomodoro…`} value={q} onChange={(e) => setQ(e.target.value)} />
              <div className="pill-grid">
                <button className={`pill pill--sm ${group === 'all' ? 'is-active' : ''}`} onClick={() => setGroup('all')}>
                  Tümü
                </button>
                {(Object.keys(FW_GROUPS) as FwGroup[]).map((g) => (
                  <button key={g} className={`pill pill--sm ${group === g ? 'is-active' : ''}`} onClick={() => setGroup(g)}>
                    {FW_GROUPS[g].emoji} {FW_GROUPS[g].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="fw-grid">
              {list.map((f) => (
                <button key={f.id} className="fw-card" onClick={() => setPick(f)} title={f.desc}>
                  <FwThumb id={f.id} width={320} className="fw-thumb" />
                  <b className="truncate">{f.name}</b>
                  <small className="truncate">{f.subtitle}</small>
                </button>
              ))}
              {!list.length && <p className="muted empty">Eşleşen model yok.</p>}
            </div>
          </>
        ) : (
          <div className="fw-detail">
            <FwThumb id={pick.id} width={960} className="fw-preview" />
            <div className="stack">
              <p className="eyebrow">
                {FW_GROUPS[pick.group].emoji} {FW_GROUPS[pick.group].label}
              </p>
              <h3>{pick.name}</h3>
              <p className="muted">{pick.subtitle}</p>
              <p>{pick.desc}</p>
              <ul className="chips">
                {pick.parts.map((p) => (
                  <li key={p} className="chip chip--static">
                    {p.split('\n')[0]}
                  </li>
                ))}
              </ul>
              <p className="muted small">Her daire, kutu ve yazı ayrı bir katman: seçip taşıyabilir, boyutlandırabilir, çift tıklayıp yazıları düzenleyebilirsin.</p>
              <div className="row gap-s wrap">
                <button className="btn btn-primary" onClick={() => insert(false)}>
                  ＋ Tuvale ekle
                </button>
                {hasContent && (
                  <button className="btn" onClick={() => confirm('Tuvaldeki mevcut her şey silinip yerine bu model konsun mu?') && insert(true)}>
                    ↺ Tuvali bununla değiştir
                  </button>
                )}
                <button className="btn btn-ghost" onClick={() => setPick(null)}>
                  ‹ Geri
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
