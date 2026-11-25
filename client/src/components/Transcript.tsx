// client/src/components/Transcript.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { listenOverride, SPEECH_LANGS, useSpeech } from '../lib/speech';
import { useSettings } from '../lib/settings';
import { speechStats } from '../lib/speechMatch';
import { fmtDuration } from '../lib/report';

/** Small pulsing indicator for the live top bar. */
/** red while listening / recording, green when stopped */
export function ListenDot() {
  const on = useSpeech((s) => s.listening || s.recording);
  return <span className={`listen-dot ${on ? 'is-on' : 'is-off'}`} role="img" aria-label={on ? 'Kayıt sürüyor' : 'Kayıt durdu'} title={on ? 'Kayıt sürüyor' : 'Kayıt durdu'} />;
}

export function MicIndicator() {
  const { listening, recording, lastMatches } = useSpeech();
  if (!listening && !recording) return null;
  return (
    <span className="mic-ind" title={listening ? 'Dinleniyor' : 'Kaydediliyor'}>
      <span className="mic-dot" /> {recording ? 'REC' : 'Dinliyor'}
      {lastMatches.length > 0 && <span className="mic-match">✨ {lastMatches.join(', ')}</span>}
    </span>
  );
}

export function TranscriptPanel() {
  const stepIndex = useApp((s) => s.live.stepIndex);
  const transcript = useApp((s) => s.pres.transcript);
  const startedAt = useApp((s) => s.pres.run.startedAt);
  const addTranscript = useApp((s) => s.addTranscript);
  const removeTranscript = useApp((s) => s.removeTranscript);
  const { supported, listening, recording, keepAudio, lang, interim, error, lastMatches, start, stop, setLang, setKeepAudio } = useSpeech();
  const [onlyStep, setOnlyStep] = useState(true);
  const { autoListen, noiseReduce, set: setSettings } = useSettings();
  const [manual, setManual] = useState('');
  const [manualHits, setManualHits] = useState<string[] | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const list = useMemo(() => (onlyStep ? transcript.filter((t) => t.stepIndex === stepIndex) : transcript), [transcript, onlyStep, stepIndex]);
  const stats = useMemo(() => speechStats([...list.map((t) => t.text), interim]), [list, interim]);
  const minutes = startedAt ? Math.max(1 / 60, (Date.now() - startedAt) / 60000) : 1;
  const wpm = onlyStep ? null : Math.round(stats.words / minutes);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [list.length, interim]);

  const submitManual = () => {
    if (!manual.trim()) return;
    setManualHits(addTranscript(manual, 'manual'));
    setManual('');
  };

  const active = listening || recording;

  return (
    <div className="panel stack transcript-panel">
      <div className="row gap-s wrap">
        <button
          className={`btn ${active ? 'btn-danger' : 'btn-primary'}`}
          onClick={() => {
            listenOverride.stoppedByHand = active;
            if (active) stop();
            else void start();
          }}
        >
          <ListenDot /> {active ? 'Dinlemeyi durdur' : 'Dinlemeye başla'}
        </button>
        <select className="seg-select" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Konuşma dili">
          {SPEECH_LANGS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <label className="switch small">
        <input type="checkbox" checked={autoListen} onChange={(e) => setSettings({ autoListen: e.target.checked })} />
        <span>⏱️ Sunum başlayınca otomatik dinle (molada ve duraklatınca durur, adım başlayınca devam eder)</span>
      </label>
      <label className="switch small">
        <input type="checkbox" checked={noiseReduce} disabled={recording} onChange={(e) => setSettings({ noiseReduce: e.target.checked })} />
        <span>🎚️ Dip ses / parazit temizleme (gürültü bastırma, uğultu ve tıslama filtresi, sessizlikte otomatik kısma)</span>
      </label>
      <label className="switch small">
        <input type="checkbox" checked={keepAudio} disabled={active} onChange={(e) => setKeepAudio(e.target.checked)} />
        <span>🔴 Sesimi de kaydet (yalnızca bu cihazın mikrofonu · her adım ayrı dosya · Rapor’dan indirilir)</span>
      </label>
      {!supported && <p className="muted small">ℹ️ Bu tarayıcı canlı yazıya dökmeyi desteklemiyor. Chrome / Edge / Safari önerilir; aşağıdan metin yapıştırabilirsin.</p>}
      {error && <p className="error small">{error}</p>}
      <p className="muted small">
        Konuşurken söylediğin <b>tombala kelimeleri</b> ve <b>konu ağacı başlıkları</b> otomatik işaretlenir. Ek almış halleri de yakalanır (girişim → girişimciler).
      </p>

      {lastMatches.length > 0 && (
        <div className="match-flash" role="status">
          ✨ Otomatik işaretlendi: <b>{lastMatches.join(', ')}</b>
        </div>
      )}

      <div className="row gap-s wrap stats-row small">
        <span className="stat-chip">🗣️ {stats.words} kelime</span>
        {wpm != null && <span className="stat-chip">⚡ {wpm} k/dk</span>}
        <span className={`stat-chip ${stats.fillerRate > 0.03 ? 'is-warn' : ''}`}>
          🫧 {stats.fillers} dolgu (%{(stats.fillerRate * 100).toFixed(1)})
        </span>
        {stats.topFillers[0] && <span className="stat-chip">en sık: “{stats.topFillers[0][0]}”</span>}
      </div>

      <label className="switch small">
        <input type="checkbox" checked={onlyStep} onChange={(e) => setOnlyStep(e.target.checked)} />
        <span>Sadece bu adım</span>
      </label>

      {listening && (
        <div className={`live-caption ${interim ? 'is-speaking' : ''}`} aria-live="polite">
          <span className="live-caption-head">
            <span className="listen-dot is-on" /> Canlı yazı
          </span>
          <p>
            {interim ? (
              <>
                {interim}
                <span className="caret" aria-hidden>
                  ▍
                </span>
              </>
            ) : (
              <span className="muted">Dinliyorum… konuştukça kelimeler burada anında belirir.</span>
            )}
          </p>
        </div>
      )}
      <div className="transcript-list" role="log" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className="seg">
            <span className="note-meta">
              {t.source === 'manual' ? '⌨️' : '🎙️'} {fmtDuration(t.at / 1000)} · A{t.stepIndex + 1}
            </span>
            <span className="seg-text">
              {t.text}
              {t.matches.length > 0 && <span className="seg-matches"> ✨ {t.matches.join(', ')}</span>}
            </span>
            <button className="chip-x" onClick={() => removeTranscript(t.id)} aria-label="Sil">
              ✕
            </button>
          </div>
        ))}
        {!list.length && !interim && !listening && <p className="muted empty">{active ? 'Ses kaydı sürüyor (yazıya dökme kapalı).' : 'Henüz döküm yok.'}</p>}
        <div ref={endRef} />
      </div>

      <details className="outline-import">
        <summary>⌨️ Metin yapıştır / elle ekle</summary>
        <textarea
          className="input"
          rows={3}
          value={manual}
          placeholder="Başka bir araçtan aldığın dökümü veya söylediklerini buraya yapıştır…"
          onChange={(e) => setManual(e.target.value)}
        />
        <button className="btn" onClick={submitManual}>
          Ekle ve eşleştir
        </button>
        {manualHits && <p className="small muted">{manualHits.length ? `✨ İşaretlendi: ${manualHits.join(', ')}` : 'Eşleşen kelime bulunamadı.'}</p>}
      </details>
    </div>
  );
}
