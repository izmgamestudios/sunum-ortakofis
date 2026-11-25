// client/src/components/StepTools.tsx — "add template to an existing presentation", merge and split dialogs
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store';
import type { Presentation, Step } from '../types';
import { MAX_STEPS } from '../lib/factory';
import { addPresentation, loadPresentation, openPresentation, savePresentation, useLibrary } from '../lib/library';
import { appendSteps, mergePresentations, splitPresentation } from '../lib/merge';
import { presentationFromTemplate, type PresentationTemplate } from '../lib/templates';

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal steptools-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn icon-btn--ghost" onClick={onClose} aria-label="Kapat">
            ✕
          </button>
        </header>
        <div className="modal-scroll stack">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** checklist of steps (grouped by source), at most `max` can be ticked */
function StepChecklist({ groups, picked, setPicked, max }: { groups: { label: string; steps: Step[] }[]; picked: Set<string>; setPicked: (s: Set<string>) => void; max: number }) {
  const toggle = (id: string) => {
    const n = new Set(picked);
    if (n.has(id)) n.delete(id);
    else if (n.size < max) n.add(id);
    setPicked(n);
  };
  return (
    <div className="step-check">
      {groups.map((g) => (
        <fieldset key={g.label} className="fs">
          <legend>{g.label}</legend>
          {g.steps.map((s, i) => (
            <label key={s.id} className={`step-check-row ${!picked.has(s.id) && picked.size >= max ? 'is-disabled' : ''}`}>
              <input type="checkbox" checked={picked.has(s.id)} onChange={() => toggle(s.id)} disabled={!picked.has(s.id) && picked.size >= max} />
              <span className="timeline-num">{i + 1}</span>
              <span className="truncate">{s.title}</span>
              <small className="muted">{Math.round(s.durationSec / 6) / 10} dk</small>
            </label>
          ))}
        </fieldset>
      ))}
      <p className={`small ${picked.size >= max ? 'warn' : 'muted'}`}>
        {picked.size} adım seçili{picked.size >= max ? ` — teknik üst sınır (${max})` : ''}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function AddTemplateDialog({ template, onClose }: { template: PresentationTemplate; onClose: () => void }) {
  const current = useApp((s) => s.pres);
  const entries = useLibrary((s) => s.entries);
  const [targetId, setTargetId] = useState(current.id);
  const [target, setTarget] = useState<Presentation | null>(current);
  const tplSteps = useMemo(() => presentationFromTemplate(template).steps, [template]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (targetId === current.id) return setTarget(current);
    void loadPresentation(targetId).then(setTarget);
  }, [targetId, current]);
  const room = Math.max(0, MAX_STEPS - (target?.steps.length ?? 0));
  useEffect(() => setPicked(new Set(tplSteps.slice(0, room).map((s) => s.id))), [tplSteps, room]);

  const add = async () => {
    if (!target) return;
    const steps = tplSteps.filter((s) => picked.has(s.id));
    const { pres, added } = appendSteps(target, steps);
    if (target.id === current.id) useApp.getState().updatePres({ steps: pres.steps });
    else {
      await savePresentation(pres);
      await openPresentation(pres.id);
    }
    useApp.getState().setView('setup');
    onClose();
    if (added < steps.length) alert(`${added} adım eklendi; ${steps.length - added} adım teknik üst sınır (${MAX_STEPS}) yüzünden eklenmedi.`);
  };

  return (
    <Modal title={`➕ “${template.title}” şablonunu mevcut sunuma ekle`} onClose={onClose}>
      <label className="stack">
        <span className="small muted">Hangi sunuma eklensin?</span>
        <select className="seg-select" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          {entries.map((e) => (
            <option key={e.id} value={e.id}>
              {e.id === current.id ? '● ' : ''}
              {e.title} ({e.stepCount} adım)
            </option>
          ))}
        </select>
      </label>
      {room === 0 ? (
        <p className="warn small">Bu sunum teknik üst sınırda ({MAX_STEPS} adım). Önce sunumu ✂️ ayır.</p>
      ) : (
        <StepChecklist groups={[{ label: `Şablonun adımları — sona eklenir (şu an ${target?.steps.length ?? 0} adım)`, steps: tplSteps }]} picked={picked} setPicked={setPicked} max={room} />
      )}
      <div className="row gap-s wrap">
        <button className="btn btn-primary" onClick={add} disabled={!target || !picked.size}>
          ➕ {picked.size} adımı ekle
        </button>
        <button className="btn btn-ghost" onClick={onClose}>
          Vazgeç
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
export function MergeDialog({ ids, onClose, onDone }: { ids: string[]; onClose: () => void; onDone: (m: string) => void }) {
  const [sources, setSources] = useState<Presentation[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  useEffect(() => {
    void (async () => {
      const cur = useApp.getState().pres;
      await savePresentation(cur);
      const list = (await Promise.all(ids.map((id) => loadPresentation(id)))).filter((p): p is Presentation => !!p);
      setSources(list);
      setTitle(list.map((p) => p.title).join(' + '));
      setPicked(new Set(list.flatMap((p) => p.steps).map((s) => s.id)));
    })();
  }, [ids]);
  const merge = async () => {
    if (!sources) return;
    const steps = sources.flatMap((p) => p.steps).filter((s) => picked.has(s.id));
    const p = mergePresentations(sources, steps, title.trim());
    await addPresentation(p);
    await openPresentation(p.id);
    onDone(`“${p.title}” oluşturuldu (${p.steps.length} adım) — kaynak sunumlar olduğu gibi duruyor`);
    onClose();
  };
  return (
    <Modal title={`🔗 ${ids.length} sunumu birleştir`} onClose={onClose}>
      {!sources ? (
        <p className="muted">⏳</p>
      ) : (
        <>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Yeni sunumun başlığı" aria-label="Başlık" />
          <StepChecklist groups={sources.map((p) => ({ label: p.title, steps: p.steps }))} picked={picked} setPicked={setPicked} max={MAX_STEPS} />
          <p className="muted small">Adım sınırı yok: seçilen tüm adımlar (örneğin 8 + 5 = 13) bu sırayla yeni bir sunumda toplanır. Giriş ilk sunumdan, kapanış son sunumdan alınır; kaynak sunumlar değişmez.</p>
          <div className="row gap-s wrap">
            <button className="btn btn-primary" onClick={merge} disabled={!picked.size}>
              🔗 Birleştir ({picked.size} adım)
            </button>
            <button className="btn btn-ghost" onClick={onClose}>
              Vazgeç
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
export function SplitDialog({ id, onClose, onDone }: { id: string; onClose: () => void; onDone: (m: string) => void }) {
  const [p, setP] = useState<Presentation | null>(null);
  const [at, setAt] = useState(1);
  useEffect(() => {
    void (async () => {
      await savePresentation(useApp.getState().pres);
      const x = await loadPresentation(id);
      setP(x);
      if (x) setAt(Math.max(1, Math.floor(x.steps.length / 2)));
    })();
  }, [id]);
  const split = async () => {
    if (!p) return;
    const [a, b] = splitPresentation(p, at);
    await addPresentation(b);
    await addPresentation(a);
    onDone(`İkiye ayrıldı: “${a.title}” (${a.steps.length} adım) ve “${b.title}” (${b.steps.length} adım) — orijinal duruyor`);
    onClose();
  };
  return (
    <Modal title="✂️ Sunumu ayır" onClose={onClose}>
      {!p ? (
        <p className="muted">⏳</p>
      ) : p.steps.length < 2 ? (
        <p className="warn small">Ayırmak için en az 2 adım gerekir.</p>
      ) : (
        <>
          <p className="small muted">Kesme çizgisini seç: üstteki adımlar 1. sunuma, alttakiler 2. sunuma gider. Orijinal sunum olduğu gibi kalır.</p>
          <ol className="split-list">
            {p.steps.map((s, i) => (
              <li key={s.id} className={i < at ? 'is-a' : 'is-b'}>
                <span className="timeline-num">{i + 1}</span> <span className="truncate">{s.title}</span>
                <span className="split-tag">{i < at ? '1/2' : '2/2'}</span>
                {i < p.steps.length - 1 && (
                  <button className={`split-cut ${at === i + 1 ? 'is-active' : ''}`} onClick={() => setAt(i + 1)} aria-pressed={at === i + 1} title={`${i + 1}. adımdan sonra kes`}>
                    ✂️ buradan kes
                  </button>
                )}
              </li>
            ))}
          </ol>
          <div className="row gap-s wrap">
            <button className="btn btn-primary" onClick={split}>
              ✂️ Ayır ({at} + {p.steps.length - at} adım)
            </button>
            <button className="btn btn-ghost" onClick={onClose}>
              Vazgeç
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
