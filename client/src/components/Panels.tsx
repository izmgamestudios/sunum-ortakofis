// client/src/components/Panels.tsx
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../store';
import { useRoom } from '../lib/room';
import { joinUrl } from '../lib/socket';
import type { NoteKind } from '../types';
import { fmtDuration } from '../lib/report';

export const NOTE_KINDS: Record<NoteKind, { label: string; emoji: string }> = {
  note: { label: 'Not', emoji: '📝' },
  quote: { label: 'Alıntı', emoji: '❝' },
  action: { label: 'Aksiyon', emoji: '✅' },
  idea: { label: 'Fikir', emoji: '💡' },
  question: { label: 'Soru', emoji: '❓' },
};

export function NotesPanel() {
  const notes = useApp((s) => s.pres.notes);
  const stepIndex = useApp((s) => s.live.stepIndex);
  const addNote = useApp((s) => s.addNote);
  const removeNote = useApp((s) => s.removeNote);
  const [kind, setKind] = useState<NoteKind>('note');
  const [text, setText] = useState('');
  const [onlyStep, setOnlyStep] = useState(false);
  const list = (onlyStep ? notes.filter((n) => n.stepIndex === stepIndex) : notes).slice().reverse();

  const submit = () => {
    if (!text.trim()) return;
    addNote(kind, text.trim());
    setText('');
  };

  return (
    <div className="panel stack">
      <div className="pill-grid">
        {(Object.keys(NOTE_KINDS) as NoteKind[]).map((k) => (
          <button key={k} className={`pill pill--sm ${kind === k ? 'is-active' : ''}`} onClick={() => setKind(k)}>
            {NOTE_KINDS[k].emoji} {NOTE_KINDS[k].label}
          </button>
        ))}
      </div>
      <div className="row gap-s">
        <textarea
          className="input"
          rows={2}
          value={text}
          placeholder={`${NOTE_KINDS[kind].label} ekle… (Ctrl+Enter)`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && submit()}
        />
        <button className="btn btn-primary" onClick={submit} aria-label="Not ekle">
          ＋
        </button>
      </div>
      <label className="switch small">
        <input type="checkbox" checked={onlyStep} onChange={(e) => setOnlyStep(e.target.checked)} />
        <span>Sadece bu adım</span>
      </label>
      <ul className="note-list">
        {list.map((n) => (
          <li key={n.id} className={`note note--${n.kind}`}>
            <span className="note-meta">
              {NOTE_KINDS[n.kind].emoji} {fmtDuration(n.at / 1000)} · A{n.stepIndex + 1}
            </span>
            <span className="note-text">{n.text}</span>
            <button className="chip-x" onClick={() => removeNote(n.id)} aria-label="Sil">
              ✕
            </button>
          </li>
        ))}
        {!list.length && <li className="muted empty">Henüz not yok.</li>}
      </ul>
    </div>
  );
}

export function ChatPanel() {
  const chat = useApp((s) => s.pres.chat);
  const updateStep = useApp((s) => s.updateStep);
  const stepIndex = useApp((s) => s.live.stepIndex);
  const { code, sendChat, chatLocked, setChatLocked, suggestions, dismissSuggestion } = useRoom();
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [chat.length]);

  const submit = () => {
    if (!text.trim()) return;
    sendChat(text.trim());
    setText('');
  };

  return (
    <div className="panel stack chat-panel">
      {!code && <p className="muted small">ℹ️ Kitle için “Oda” sekmesinden canlı oda aç. Şu an mesajlar sadece yerelde tutuluyor.</p>}
      {code && (
        <label className="switch small">
          <input type="checkbox" checked={chatLocked} onChange={(e) => setChatLocked(e.target.checked)} />
          <span>🔒 Sohbeti kilitle</span>
        </label>
      )}
      {suggestions.length > 0 && (
        <div className="suggestions">
          <p className="small muted">Kitleden kelime önerileri — tombala torbasına ekle:</p>
          <ul className="word-cloud">
            {suggestions.map((s) => (
              <li key={s.id} className="ball ball--sm">
                <button
                  onClick={() => {
                    updateStep(stepIndex, (st) => ({ words: st.words.includes(s.word) ? st.words : [...st.words, s.word] }));
                    dismissSuggestion(s.id);
                  }}
                  title={`${s.name} önerdi`}
                >
                  ＋ {s.word}
                </button>
                <button onClick={() => dismissSuggestion(s.id)} aria-label="Yoksay">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="chat-list" role="log" aria-live="polite">
        {chat.map((m) => (
          <div key={m.id} className={`msg ${m.fromPresenter ? 'msg--me' : ''}`}>
            <span className="msg-name">{m.name}</span>
            <span className="msg-text">{m.text}</span>
            <span className="msg-time">{new Date(m.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
        {!chat.length && <p className="muted empty">Sohbet sessiz… İlk soruyu sen sor!</p>}
        <div ref={endRef} />
      </div>
      <div className="row gap-s">
        <input className="input" value={text} maxLength={500} placeholder="Mesaj yaz…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        <button className="btn btn-primary" onClick={submit}>
          Gönder
        </button>
      </div>
    </div>
  );
}

export function RoomPanel() {
  const { code, connected, count, error, open, close, people } = useRoom();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const url = code ? joinUrl(code) : '';

  useEffect(() => {
    if (code && canvasRef.current) QRCode.toCanvas(canvasRef.current, url, { width: 200, margin: 1 }).catch(() => undefined);
  }, [code, url]);

  if (!code) {
    return (
      <div className="panel stack center-text">
        <p>Kitlen telefonundan anonim olarak bağlanıp soru sorabilir, tepki verebilir ve tombala kelimesi önerebilir.</p>
        <button className="btn btn-primary btn-lg" onClick={open}>
          📡 Canlı oda aç
        </button>
        {error && <p className="error small">{error} — sunucu çalışıyor mu? (npm run dev)</p>}
      </div>
    );
  }
  return (
    <div className="panel stack center-text">
      <p className="eyebrow">Oda kodu</p>
      <p className="room-code">{code}</p>
      <canvas ref={canvasRef} className="qr" aria-label="Katılım QR kodu" />
      <div className="row gap-s center wrap">
        <button
          className="btn"
          onClick={() => {
            navigator.clipboard?.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? '✅ Kopyalandı' : '🔗 Bağlantıyı kopyala'}
        </button>
        <button className="btn btn-ghost" onClick={() => confirm('Oda kapatılsın mı?') && close()}>
          Odayı kapat
        </button>
      </div>
      <p className="muted small">
        {connected ? '🟢 Bağlı' : '🟠 Yeniden bağlanıyor…'} · 👥 {people.length || Math.max(0, count - 1)} katılımcı · 🎨 tuval canlı paylaşılıyor
      </p>
      {people.length > 0 && (
        <details className="people" open={people.length <= 12}>
          <summary>👥 Katılımcılar ({people.length})</summary>
          <ul className="people-list">
            {people.map((n, i) => (
              <li key={`${n}-${i}`}>{n}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
