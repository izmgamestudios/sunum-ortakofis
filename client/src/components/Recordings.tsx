// client/src/components/Recordings.tsx — start-of-presentation recording consent + report section (audio + transcript .docx)
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store';
import { useSpeech } from '../lib/speech';
import { useSettings } from '../lib/settings';
import { deleteRecording, listRecordings, useRecordings, type Recording } from '../lib/recordings';
import { screenRecSupported, useScreenRec } from '../lib/media';
import { buildDocx, type DocBlock } from '../lib/docx';
import { downloadBlob, formatBytes, slugify } from '../lib/io';
import { fmtDuration } from '../lib/report';
import type { Presentation } from '../types';

type Choice = 'audio' | 'text' | 'none';

/** Asked every time a presentation starts. Only this device's microphone (the presenter) is ever recorded. */
export function RecordConsent() {
  const open = useApp((s) => s.recordPrompt);
  const close = () => useApp.setState({ recordPrompt: false });
  const supported = useSpeech((s) => s.supported);
  const canRecord = typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  const choose = (c: Choice) => {
    useSpeech.getState().setKeepAudio(c === 'audio');
    useSettings.getState().set({ autoListen: c !== 'none' });
    close();
    useApp.getState().beginRun();
  };
  return createPortal(
    <div className="modal-backdrop" onClick={close}>
      <div className="modal consent-modal" role="dialog" aria-modal="true" aria-labelledby="consent-title" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h2 id="consent-title">🎙️ Kayıt alınsın mı?</h2>
          <button className="icon-btn icon-btn--ghost" onClick={close} aria-label="Vazgeç">
            ✕
          </button>
        </header>
        <div className="modal-scroll stack">
          <p className="muted small">
            (Yalnızca <b>sunum yapan kişinin mikrofonu</b> — bu cihazın mikrofonu — kaydedilir. Sunumu izleyenlerin ve konukların sesi <b>kaydedilmez</b>.) Kayıtlar yalnızca bu
            cihazda saklanır; buluta, paylaşım bağlantısına ya da .snmtdz dosyasına eklenmez. Sunum bitince Rapor’dan ses dosyalarını ve yazıya dökülmüş metni (.docx) indirebilirsin.
          </p>
          <div className="consent-grid">
            <button className="choice" onClick={() => choose('audio')} disabled={!canRecord} autoFocus>
              <span className="choice-ico">🔴</span>
              <b>Evet — sesimi kaydet ve yazıya dök</b>
              <small>Her adım ayrı ses dosyası + otomatik döküm{!supported ? ' (bu tarayıcıda döküm yok, yalnızca ses)' : ''}.</small>
            </button>
            <button className="choice" onClick={() => choose('text')} disabled={!supported}>
              <span className="choice-ico">📝</span>
              <b>Sadece yazıya dök</b>
              <small>Ses dosyası saklanmaz; konuşma metne çevrilir, tombala kelimeleri işaretlenir.</small>
            </button>
            <button className="choice" onClick={() => choose('none')}>
              <span className="choice-ico">🚫</span>
              <b>Hayır, kayıt alma</b>
              <small>Mikrofon kullanılmaz. İstersen sunum sırasında Dinleme panelinden açabilirsin.</small>
            </button>
          </div>
          {!canRecord && <p className="warn small">Bu tarayıcı ses kaydını desteklemiyor.</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** transcript → Word document */
export function transcriptDocx(pres: Presentation): Blob {
  const start = pres.run.startedAt ?? pres.createdAt;
  const blocks: DocBlock[] = [
    { kind: 'title', text: pres.title },
    {
      kind: 'p',
      muted: true,
      text: [pres.presenter && `Sunan: ${pres.presenter}`, pres.audience && `Kitle: ${pres.audience}`, `Tarih: ${new Date(start).toLocaleString('tr-TR')}`].filter(Boolean).join(' · '),
    },
    { kind: 'p', muted: true, text: 'Konuşmadan yazıya döküm — Teknodoz Sunum (Beta)' },
  ];
  pres.steps.forEach((st, i) => {
    const segs = pres.transcript.filter((t) => t.stepIndex === i);
    blocks.push({ kind: 'h1', text: `${i + 1}. ${st.title}` });
    if (!segs.length) blocks.push({ kind: 'p', muted: true, text: '(Bu adımda döküm yok.)' });
    segs.forEach((t) =>
      blocks.push({
        kind: 'line',
        time: fmtDuration(Math.round(t.at / 1000)),
        text: `${t.source === 'manual' ? '[elle] ' : ''}${t.text}${t.matches.length ? `  — ✓ ${t.matches.join(', ')}` : ''}`,
      }),
    );
  });
  const words = pres.transcript.reduce((a, t) => a + t.text.split(/\s+/).filter(Boolean).length, 0);
  blocks.push({ kind: 'h2', text: 'Özet' }, { kind: 'p', text: `${pres.transcript.length} bölüm · ${words} kelime · ${pres.run.autoMarked} otomatik işaretleme` });
  return buildDocx(blocks, { title: pres.title, author: pres.presenter || 'Teknodoz Sunum' });
}

export function RecordingsSection() {
  const pres = useApp((s) => s.pres);
  const version = useRecordings((s) => s.version);
  const [recs, setRecs] = useState<Recording[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    void listRecordings(pres.id).then((r) => alive && setRecs(r));
    return () => {
      alive = false;
    };
  }, [pres.id, version]);

  useEffect(() => {
    const next: Record<string, string> = {};
    recs.forEach((r) => (next[r.id] = URL.createObjectURL(r.blob)));
    setUrls(next);
    return () => Object.values(next).forEach((u) => URL.revokeObjectURL(u));
  }, [recs]);

  const total = recs.reduce((a, r) => a + r.size, 0);
  const downloadAll = async () => {
    for (const r of recs) {
      downloadBlob(r.blob, r.name);
      await new Promise((res) => setTimeout(res, 350)); // browsers throttle rapid downloads
    }
  };

  if (!recs.length && !pres.transcript.length) return null;
  return (
    <section data-anchor="report-recordings" className="recordings">
      <h2>🎧 Ses, ekran kaydı & döküm</h2>
      <div className="row gap-s wrap no-print">
        {pres.transcript.length > 0 && (
          <button className="btn btn-primary" onClick={() => downloadBlob(transcriptDocx(pres), `${slugify(pres.title)}-dokum.docx`)}>
            📄 Dökümü indir (.docx)
          </button>
        )}
        {recs.length > 1 && (
          <button className="btn" onClick={downloadAll}>
            ⬇️ Tüm kayıtlar ({recs.length} · {formatBytes(total)})
          </button>
        )}
      </div>
      {recs.length > 0 ? (
        <ul className="rec-list">
          {recs.map((r) => (
            <li key={r.id} className="rec-item">
              <div className="rec-meta">
                <b>{r.kind === 'screen' ? '🎬 Ekran kaydı' : `${r.stepIndex + 1}. ${r.stepTitle}`}</b>
                <small className="muted">
                  {new Date(r.startedAt).toLocaleTimeString('tr-TR')} · {fmtDuration(Math.round(r.durationMs / 1000))} · {formatBytes(r.size)}
                </small>
              </div>
              {urls[r.id] &&
                (r.kind === 'screen' ? (
                  <video controls preload="metadata" src={urls[r.id]} className="no-print rec-video" />
                ) : (
                  <audio controls preload="metadata" src={urls[r.id]} className="no-print" />
                ))}
              <span className="row gap-s no-print">
                <button className="btn btn-sm" onClick={() => downloadBlob(r.blob, r.name)}>
                  ⬇️ İndir
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => confirm('Bu ses kaydı silinsin mi?') && void deleteRecording(pres.id, r.id)} aria-label="Kaydı sil">
                  🗑️
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">Kayıt yok — sunum başlarken “Evet, sesimi kaydet” seçilirse her adım ayrı bir ses dosyası, ⏺ Ekran kaydı ile de video olarak burada listelenir.</p>
      )}
      <p className="muted small">🔒 Ses kayıtları yalnızca bu cihazda saklanır; paylaşım bağlantısına ve .snmtdz dosyasına eklenmez.</p>
    </section>
  );
}

/** ⏺ screen recording toggle (live HUD) */
export function ScreenRecButton() {
  const { active, startedAt, error, withMic, start, stop, setWithMic } = useScreenRec();
  const [, tick] = useState(0);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
  useEffect(() => {
    if (error) alert(error);
  }, [error]);
  if (!screenRecSupported) return null;
  if (active)
    return (
      <button className="btn btn-sm screenrec is-on" onClick={stop} title="Ekran kaydını durdur — Rapor’dan indirilir">
        <span className="listen-dot is-on" /> {fmtDuration(Math.round((Date.now() - (startedAt ?? Date.now())) / 1000))} <span className="hide-sm">Durdur</span>
      </button>
    );
  return (
    <span className="screenrec-wrap">
      <button className="btn btn-sm screenrec" onClick={() => setMenu((m) => !m)} aria-expanded={menu} title="Ekran videosu kaydet">
        ⏺ <span className="hide-sm">Ekran kaydı</span>
      </button>
      {menu && (
        <span className="screenrec-menu" role="dialog" aria-label="Ekran kaydı">
          <label className="switch small">
            <input type="checkbox" checked={withMic} onChange={(e) => setWithMic(e.target.checked)} />
            <span>🎙️ Mikrofonumu da kaydet (parazit temizlemeli)</span>
          </label>
          <small className="muted">Açılan pencerede bu sekmeyi, bir pencereyi ya da tüm ekranı seç. Sekme sesini de almak için “Sekme sesini paylaş”ı işaretle.</small>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setMenu(false);
              void start();
            }}
          >
            ⏺ Kaydı başlat
          </button>
        </span>
      )}
    </span>
  );
}
