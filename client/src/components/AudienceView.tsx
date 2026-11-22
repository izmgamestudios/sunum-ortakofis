// client/src/components/AudienceView.tsx
import { useEffect, useRef, useState } from 'react';
import { emitAck, getSocket } from '../lib/socket';
import { REACTIONS } from '../lib/catalog';
import type { ChatMessage } from '../types';
import { BetaBadge, Logo } from './Header';

interface PublicState {
  title: string;
  stepIndex: number;
  stepCount: number;
  phase: 'idle' | 'step' | 'break' | 'done';
  roleplay?: string;
  chatLocked: boolean;
}

export function AudienceView({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState('');
  const [state, setState] = useState<PublicState | null>(null);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [word, setWord] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const join = async (c = code) => {
    setError(null);
    try {
      const r = await emitAck<{ ok: boolean; name?: string; state?: PublicState; error?: string }>('audience:join', { code: c });
      if (!r.ok) throw new Error(r.error ?? 'Katılılamadı');
      setName(r.name ?? 'Anonim');
      setState(r.state ?? null);
      setJoined(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sunucuya ulaşılamadı');
    }
  };

  useEffect(() => {
    const s = getSocket();
    const onState = (st: PublicState) => setState(st);
    const onMsg = (m: ChatMessage) => setMsgs((prev) => [...prev, m].slice(-300));
    const onErr = (m: string) => {
      setNotice(m);
      setTimeout(() => setNotice(null), 2500);
    };
    const onClosed = () => {
      setJoined(false);
      setError('Oda kapandı.');
    };
    s.on('state', onState);
    s.on('chat:message', onMsg);
    s.on('chat:error', onErr);
    s.on('room:closed', onClosed);
    if (initialCode) join(initialCode);
    return () => {
      s.off('state', onState);
      s.off('chat:message', onMsg);
      s.off('chat:error', onErr);
      s.off('room:closed', onClosed);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // re-join after reconnect
  useEffect(() => {
    const s = getSocket();
    const onConnect = () => joined && join();
    s.on('connect', onConnect);
    return () => {
      s.off('connect', onConnect);
    };
  }, [joined]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => endRef.current?.scrollIntoView({ block: 'end' }), [msgs.length]);

  const send = () => {
    if (!text.trim()) return;
    getSocket().emit('chat:send', { text: text.trim() });
    setText('');
  };

  const suggest = () => {
    if (!word.trim()) return;
    getSocket().emit('word:suggest', { word: word.trim() });
    setWord('');
    setNotice('Kelimen sunucuya iletildi 🎱');
    setTimeout(() => setNotice(null), 2000);
  };

  if (!joined) {
    return (
      <main className="audience audience--join">
        <Logo />
        <BetaBadge />
        <h1>Sunuma katıl</h1>
        <p className="muted">Tamamen anonim. Soru sor, tepki ver, kelime öner.</p>
        <input
          className="input room-input"
          value={code}
          maxLength={6}
          placeholder="ODA KODU"
          autoCapitalize="characters"
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && join()}
        />
        <button className="btn btn-primary btn-lg" disabled={code.length !== 6} onClick={() => join()}>
          Katıl
        </button>
        {error && <p className="error">{error}</p>}
      </main>
    );
  }

  return (
    <main className="audience">
      <header className="aud-head">
        <Logo small />
        <span className="muted small">
          Sen: <b>{name}</b>
        </span>
      </header>
      <section className="aud-state card">
        <h1>{state?.title ?? 'Sunum'}</h1>
        {state && state.stepCount > 0 && (
          <>
            <ol className="step-dots step-dots--sm">
              {Array.from({ length: state.stepCount }, (_, i) => (
                <li key={i} className={`step-dot ${i < state.stepIndex ? 'is-done' : ''} ${i === state.stepIndex ? 'is-current' : ''}`}>
                  <span>{i + 1}</span>
                </li>
              ))}
            </ol>
            <p className="muted small">
              {state.phase === 'break' ? '🫁 Mola — birlikte nefes alalım' : state.phase === 'done' ? '🏁 Sunum bitti, teşekkürler!' : state.phase === 'step' ? `${state.stepIndex + 1}. adım anlatılıyor` : 'Sunum birazdan başlıyor'}
            </p>
          </>
        )}
        {state?.roleplay && <p className="rp-sentence small">{state.roleplay}</p>}
      </section>

      <div className="reaction-bar" role="group" aria-label="Tepkiler">
        {REACTIONS.map((r) => (
          <button key={r} className="reaction" onClick={() => getSocket().emit('reaction:send', { emoji: r })}>
            {r}
          </button>
        ))}
      </div>

      <section className="card stack">
        <div className="chat-list chat-list--aud" role="log" aria-live="polite">
          {msgs.map((m) => (
            <div key={m.id} className={`msg ${m.fromPresenter ? 'msg--presenter' : ''} ${m.name === name ? 'msg--me' : ''}`}>
              <span className="msg-name">{m.name}</span>
              <span className="msg-text">{m.text}</span>
            </div>
          ))}
          {!msgs.length && <p className="muted empty">Henüz mesaj yok. İlk soruyu sen sor!</p>}
          <div ref={endRef} />
        </div>
        {state?.chatLocked ? (
          <p className="muted small center-text">🔒 Sunucu sohbeti şu an kilitledi.</p>
        ) : (
          <div className="row gap-s">
            <input className="input" value={text} maxLength={500} placeholder="Anonim mesaj / soru…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
            <button className="btn btn-primary" onClick={send}>
              Gönder
            </button>
          </div>
        )}
      </section>

      <section className="card stack">
        <h2 className="card-title">🎱 Tombalaya kelime öner</h2>
        <div className="row gap-s">
          <input className="input" value={word} maxLength={40} placeholder="Bir kelime…" onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && suggest()} />
          <button className="btn" onClick={suggest}>
            Öner
          </button>
        </div>
      </section>
      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
