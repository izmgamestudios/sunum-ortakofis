// client/src/components/AudienceInteract.tsx — audience side: answer live polls/quiz, see results; jurors join (PIN / e-mail) and score
import { useEffect, useState } from 'react';
import { emitAck, getSocket } from '../lib/socket';
import { QUESTION_KINDS } from '../lib/interact';
import { ResultView, Leaderboard } from './Interact';
import { LoginForm } from './Account';
import type { JuryCriterion, Question } from '../types';

interface ActivePoll {
  id: string;
  kind: Question['kind'];
  text: string;
  options: string[];
  stepIndex: number;
  endsAt: number | null;
}
interface Results {
  total: number;
  counts: number[];
  average: number | null;
  words: [string, number][];
  texts: string[];
  question: { id: string; kind: Question['kind']; text: string; options: string[] };
  correct: number | null;
  board: { rank: number; name: string; points: number; correct: number }[] | null;
}

/** stable anonymous id per browser (quiz points survive a reconnect) */
function voterId(): string {
  const K = 'teknodoz-sunum:voter';
  try {
    let v = localStorage.getItem(K);
    if (!v) {
      v = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32);
      localStorage.setItem(K, v);
    }
    return v;
  } catch {
    return Math.random().toString(36).slice(2, 18);
  }
}

export function sayHello() {
  getSocket().emit('interact:hello', { voterId: voterId() });
}

export function AudiencePoll({ myName }: { myName: string }) {
  const [active, setActive] = useState<ActivePoll | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [mine, setMine] = useState<number | string | null>(null);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [you, setYou] = useState<{ points: number; total: number; rank: number } | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const s = getSocket();
    const onState = (a: ActivePoll) => {
      setActive(a);
      setResults(null);
      setMine(null);
      setText('');
      setMsg(null);
      setYou(null);
    };
    const onResults = (r: Results) => {
      setActive(null);
      setResults(r);
    };
    const onYou = (y: { points: number; total: number; rank: number }) => setYou(y);
    s.on('poll:state', onState);
    s.on('poll:results', onResults);
    s.on('quiz:you', onYou);
    sayHello();
    return () => {
      s.off('poll:state', onState);
      s.off('poll:results', onResults);
      s.off('quiz:you', onYou);
    };
  }, []);
  useEffect(() => {
    if (!active?.endsAt) return;
    const i = setInterval(() => tick((x) => x + 1), 250);
    return () => clearInterval(i);
  }, [active?.endsAt]);

  const vote = async (answer: number | string) => {
    if (!active) return;
    const r = await emitAck<{ ok: boolean; error?: string }>('poll:vote', { qid: active.id, answer });
    if (r.ok) {
      setMine(answer);
      setMsg(active.kind === 'quiz' ? '✅ Cevabın alındı — süre bitince sonuç gelecek' : '✅ Yanıtın alındı');
      if (active.kind === 'cloud' || active.kind === 'open') setText('');
    } else setMsg(r.error ?? 'Gönderilemedi');
  };

  if (active) {
    const left = active.endsAt ? Math.max(0, Math.ceil((active.endsAt - Date.now()) / 1000)) : null;
    const locked = active.kind === 'quiz' && mine !== null;
    return (
      <section className="card aud-poll" aria-live="polite">
        <header className="row gap-s" style={{ justifyContent: 'space-between' }}>
          <span className="eyebrow">
            {QUESTION_KINDS[active.kind].icon} {QUESTION_KINDS[active.kind].label}
          </span>
          {left !== null && <span className={`poll-countdown ${left <= 5 ? 'is-low' : ''}`}>⏱️ {left} sn</span>}
        </header>
        <h2>{active.text}</h2>
        {active.kind === 'cloud' || active.kind === 'open' ? (
          <div className="row gap-s">
            <input
              className="input"
              value={text}
              maxLength={active.kind === 'cloud' ? 30 : 280}
              placeholder={active.kind === 'cloud' ? 'Tek kelime yaz' : 'Yanıtını yaz'}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && text.trim() && vote(text.trim())}
              aria-label="Yanıt"
            />
            <button className="btn btn-primary" disabled={!text.trim()} onClick={() => vote(text.trim())}>
              Gönder
            </button>
          </div>
        ) : (
          <div className={`aud-options ${active.kind === 'scale' ? 'is-scale' : ''}`}>
            {active.options.map((o, i) => (
              <button key={i} className={`aud-option ${mine === i ? 'is-picked' : ''}`} disabled={locked} onClick={() => vote(i)} aria-pressed={mine === i}>
                {active.kind === 'scale' ? '⭐'.repeat(i + 1) : o}
              </button>
            ))}
          </div>
        )}
        {msg && <p className="small">{msg}</p>}
      </section>
    );
  }
  if (results) {
    const q = results.question;
    const right = q.kind === 'quiz' && results.correct !== null && mine === results.correct;
    return (
      <section className="card aud-poll" aria-live="polite">
        <span className="eyebrow">📊 Sonuçlar · {results.total} yanıt</span>
        <h2>{q.text}</h2>
        {q.kind === 'quiz' && mine !== null && <p className={right ? 'quiz-right' : 'quiz-wrong'}>{right ? '🎉 Doğru!' : '❌ Bu sefer olmadı'}{you ? ` · +${you.points} puan · toplam ${you.total} · ${you.rank}. sıradasın` : ''}</p>}
        <ResultView kind={q.kind} options={q.options} data={results} correct={results.correct} />
        {results.board && <Leaderboard rows={results.board} you={myName} />}
        <button className="btn btn-sm btn-ghost" onClick={() => setResults(null)}>
          Kapat
        </button>
      </section>
    );
  }
  return null;
}

/* ------------------------------------------------------------------ */
export function AudienceJury({ code, stepIndex, stepTitle }: { code: string; stepIndex: number; stepTitle: string }) {
  const [open, setOpen] = useState<{ criteria: JuryCriterion[]; pinMode: boolean; emailMode: boolean } | null>(null);
  const [me, setMe] = useState<{ name: string; criteria: JuryCriterion[] } | null>(null);
  const [mode, setMode] = useState<'pin' | 'email' | null>(null);
  const [pin, setPin] = useState('');
  const [jname, setJname] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const s = getSocket();
    const onOpen = (o: { criteria: JuryCriterion[]; pinMode: boolean; emailMode: boolean }) => setOpen(o);
    s.on('jury:open', onOpen);
    return () => {
      s.off('jury:open', onOpen);
    };
  }, []);
  // new pitch → fresh form
  useEffect(() => {
    setScores({});
    setComment('');
  }, [stepIndex]);

  const joinPin = async () => {
    setErr(null);
    const r = await emitAck<{ ok: boolean; name?: string; criteria?: JuryCriterion[]; error?: string }>('jury:join', { pin, name: jname });
    if (r.ok && r.criteria) setMe({ name: r.name ?? 'Jüri', criteria: r.criteria });
    else setErr(r.error ?? 'Girilemedi');
  };
  const joinEmail = async () => {
    setErr(null);
    try {
      const res = await fetch(`/api/live/jury-token?code=${encodeURIComponent(code)}`, { credentials: 'same-origin' });
      const body = (await res.json()) as { token?: string; error?: string };
      if (!res.ok || !body.token) throw new Error(body.error ?? 'Jüri listesinde değilsin');
      const r = await emitAck<{ ok: boolean; name?: string; criteria?: JuryCriterion[]; error?: string }>('jury:join', { token: body.token, name: jname });
      if (r.ok && r.criteria) setMe({ name: r.name ?? 'Jüri', criteria: r.criteria });
      else throw new Error(r.error ?? 'Girilemedi');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Girilemedi');
    }
  };
  const submit = async () => {
    setErr(null);
    const r = await emitAck<{ ok: boolean; error?: string }>('jury:score', { stepIndex, scores, comment });
    if (r.ok) setSent((x) => ({ ...x, [stepIndex]: true }));
    else setErr(r.error ?? 'Gönderilemedi');
  };

  if (!me && !open) return null;
  if (!me) {
    return (
      <section className="card stack aud-jury">
        <h3 className="card-title">⚖️ Jüri girişi</h3>
        {!open && <p className="muted small">Sunucu jüri değerlendirmesini açtığında burada giriş yapabilirsin. Jüri değilsen bu bölümü yok sayabilirsin.</p>}
        <input className="input" value={jname} maxLength={30} placeholder="Adın (isteğe bağlı)" onChange={(e) => setJname(e.target.value)} aria-label="Jüri adı" />
        <div className="row gap-s wrap">
          <button className={`btn btn-sm ${mode === 'pin' ? 'btn-primary' : ''}`} onClick={() => setMode('pin')}>
            🔢 PIN ile
          </button>
          <button className={`btn btn-sm ${mode === 'email' ? 'btn-primary' : ''}`} onClick={() => setMode('email')}>
            📧 E-postayla
          </button>
        </div>
        {mode === 'pin' && (
          <div className="row gap-s">
            <input className="input code-input" inputMode="numeric" maxLength={8} value={pin} placeholder="PIN" onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && pin && joinPin()} aria-label="Jüri PIN" />
            <button className="btn btn-primary" disabled={pin.length < 4} onClick={joinPin}>
              Gir
            </button>
          </div>
        )}
        {mode === 'email' && <LoginForm onDone={() => void joinEmail()} intro={<p className="muted small">Davet edildiğin e-postayı yaz; gelen kodla giriş yapınca jüri olarak eklenirsin.</p>} />}
        {err && <p className="error small">{err}</p>}
      </section>
    );
  }

  const complete = me.criteria.every((c) => scores[c.id]);
  return (
    <section className="card stack aud-jury">
      <h3 className="card-title">⚖️ Jüri: {me.name}</h3>
      <p className="small">
        Puanladığın pitch: <b>{stepTitle || `${stepIndex + 1}. adım`}</b>
      </p>
      {me.criteria.map((c) => (
        <div key={c.id} className="jury-crit">
          <span>
            {c.label}
            {c.weight !== 1 && <small className="muted"> ×{c.weight}</small>}
          </span>
          <div className="jury-scale" role="radiogroup" aria-label={c.label}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} role="radio" aria-checked={scores[c.id] === n} className={scores[c.id] === n ? 'is-active' : ''} onClick={() => setScores((x) => ({ ...x, [c.id]: n }))}>
                {n}
              </button>
            ))}
          </div>
        </div>
      ))}
      <textarea className="input" rows={2} maxLength={300} value={comment} placeholder="Kısa yorum (isteğe bağlı)" onChange={(e) => setComment(e.target.value)} aria-label="Yorum" />
      <button className="btn btn-primary" disabled={!complete} onClick={submit}>
        {sent[stepIndex] ? '✅ Gönderildi — güncelle' : 'Puanı gönder'}
      </button>
      {err && <p className="error small">{err}</p>}
    </section>
  );
}
