// client/src/components/AudienceView.tsx — public page for anonymous viewers (?join=CODE)
import { useEffect, useMemo, useRef, useState } from 'react';
import { emitAck, getSocket } from '../lib/socket';
import { REACTIONS } from '../lib/catalog';
import { applyView, BOARD_H, BOARD_W, drawElement } from '../lib/canvasDraw';
import type { Attachment, CanvasElement, CanvasView, ChatMessage } from '../types';
import { BetaBadge, Logo } from './Header';
import { ThemeSwitcher } from './Shell';

interface PublicState {
  title: string;
  stepIndex: number;
  stepCount: number;
  phase: 'idle' | 'step' | 'break' | 'done';
  roleplay?: string;
  chatLocked: boolean;
}

interface CanvasSnapshot {
  stepIndex: number;
  elements: CanvasElement[];
  atts: { id: string; kind: Attachment['kind']; name: string; url?: string }[];
  at: number;
}

type Tab = 'canvas' | 'chat' | 'suggest';
type LiveView = CanvasView & { stepIndex: number };

/** Read-only mirror of the presenter's canvas: follows the presenter's zoom / pan unless the viewer zooms on their own. */
function CanvasWatch({ snap, assets, view }: { snap: CanvasSnapshot | null; assets: Record<string, string>; view: LiveView | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(600);
  const [zoom, setZoom] = useState(1);
  const [follow, setFollow] = useState(true);
  const presenterView = follow && view && snap && view.stepIndex === snap.stepIndex ? view : undefined;
  const ownZoom = (z: number) => {
    setFollow(false);
    setZoom(z);
  };
  const [tick, setTick] = useState(0);
  const atts = useMemo<Attachment[]>(
    () => (snap?.atts ?? []).map((a) => ({ id: a.id, kind: a.kind, name: a.name, mime: '', size: 0, dataUrl: assets[a.id], url: a.url })),
    [snap, assets],
  );

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const cssW = follow ? w : w * zoom;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(cssW * dpr);
    c.height = Math.round(((cssW * BOARD_H) / BOARD_W) * dpr);
    c.style.width = `${cssW}px`;
    c.style.height = `${(cssW * BOARD_H) / BOARD_W}px`;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    applyView(ctx, cssW, dpr, presenterView);
    (snap?.elements ?? []).forEach((el) => drawElement(ctx, el, atts, () => setTick((t) => t + 1)));
  }, [snap, atts, w, zoom, tick, follow, presenterView]);

  const fullscreen = () => {
    const el = wrap.current?.parentElement as (HTMLElement & { webkitRequestFullscreen?: () => void }) | null;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else if (el.requestFullscreen) void el.requestFullscreen().catch(() => undefined);
    else el.webkitRequestFullscreen?.();
  };

  return (
    <div className="watch">
      <div className="watch-bar">
        <span className="live-dot" aria-hidden /> <b>Canlı tuval</b>
        {snap && <span className="muted small">· {snap.stepIndex + 1}. adım</span>}
        <span className="watch-tools">
          {follow ? (
            <span className="small muted" title="Sunucu yakınlaştırıp kaydırdıkça senin ekranın da aynısını gösterir">
              🎯 Sunucuyu takip ediyor{presenterView && Math.abs(presenterView.zoom - 1) > 0.01 ? ` · ${Math.round(presenterView.zoom * 100)}%` : ''}
            </span>
          ) : (
            <button className="btn btn-sm" onClick={() => (setFollow(true), setZoom(1))} title="Sunucunun gördüğü görünüme dön">
              🎯 Sunucuyu takip et
            </button>
          )}
          <button className="icon-btn icon-btn--ghost" onClick={() => ownZoom(Math.max(1, (follow ? 1 : zoom) - 0.5))} disabled={follow || zoom <= 1} aria-label="Uzaklaştır">
            −
          </button>
          <button className="icon-btn icon-btn--ghost" onClick={() => ownZoom(Math.min(3, (follow ? 1 : zoom) + 0.5))} disabled={!follow && zoom >= 3} aria-label="Kendin yakınlaştır" title="Kendin yakınlaştır (takipten çıkar)">
            ＋
          </button>
          <button className="icon-btn icon-btn--ghost" onClick={fullscreen} aria-label="Tam ekran" title="Tam ekran">
            ⛶
          </button>
        </span>
      </div>
      <div ref={wrap} className="watch-scroll">
        <canvas ref={canvas} aria-label="Sunucunun tuvali (yalnızca izleme)" />
        {!snap?.elements.length && <p className="watch-empty muted">Sunucu tuvale bir şey eklediğinde burada canlı görünecek.</p>}
      </div>
    </div>
  );
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
  const [people, setPeople] = useState<string[]>([]);
  const [showPeople, setShowPeople] = useState(false);
  const [snap, setSnap] = useState<CanvasSnapshot | null>(null);
  const [assets, setAssets] = useState<Record<string, string>>({});
  const [liveView, setLiveView] = useState<LiveView | null>(null);
  const [tab, setTab] = useState<Tab>('canvas');
  const [unread, setUnread] = useState(0);
  const [nick, setNick] = useState('');
  const [connected, setConnected] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  const flash = (m: string) => {
    setNotice(m);
    setTimeout(() => setNotice(null), 2500);
  };

  const join = async (c = code) => {
    setError(null);
    try {
      const r = await emitAck<{ ok: boolean; name?: string; state?: PublicState; error?: string }>('audience:join', { code: c });
      if (!r.ok) throw new Error(r.error ?? 'Katılılamadı');
      setName(r.name ?? 'Anonim');
      setState(r.state ?? null);
      setJoined(true);
      const u = new URL(window.location.href);
      u.searchParams.set('join', c);
      window.history.replaceState(null, '', u);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sunucuya ulaşılamadı');
    }
  };

  useEffect(() => {
    const s = getSocket();
    const on = {
      state: (st: PublicState) => setState(st),
      'chat:message': (m: ChatMessage) => {
        setMsgs((prev) => [...prev, m].slice(-300));
        if (tabRef.current !== 'chat') setUnread((u) => u + 1);
      },
      'chat:error': (m: string) => flash(m),
      'room:closed': () => {
        setJoined(false);
        setError('Oda kapandı.');
      },
      'room:people': (p: { names: string[] }) => setPeople(p.names),
      canvas: (c: CanvasSnapshot) => setSnap(c),
      'canvas:view': (v: LiveView) => setLiveView(v),
      'canvas:asset': (a: { id: string; dataUrl: string }) => setAssets((prev) => ({ ...prev, [a.id]: a.dataUrl })),
      connect: () => setConnected(true),
      disconnect: () => setConnected(false),
    } as const;
    (Object.keys(on) as (keyof typeof on)[]).forEach((k) => s.on(k, on[k] as (...a: unknown[]) => void));
    if (initialCode) join(initialCode);
    return () => (Object.keys(on) as (keyof typeof on)[]).forEach((k) => s.off(k, on[k] as (...a: unknown[]) => void));
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

  useEffect(() => {
    if (tab === 'chat') {
      setUnread(0);
      endRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [msgs.length, tab]);

  const send = () => {
    if (!text.trim()) return;
    getSocket().emit('chat:send', { text: text.trim() });
    setText('');
  };
  const suggest = () => {
    if (!word.trim()) return;
    getSocket().emit('word:suggest', { word: word.trim() });
    setWord('');
    flash('Kelimen sunucuya iletildi 🎱');
  };
  const rename = async () => {
    if (!nick.trim()) return;
    const r = await emitAck<{ ok: boolean; name?: string; error?: string }>('audience:rename', { name: nick.trim() }).catch(() => ({ ok: false, error: 'Bağlantı yok' }) as const);
    if (r.ok && 'name' in r && r.name) {
      setName(r.name);
      setNick('');
      flash(`Artık “${r.name}” olarak görünüyorsun`);
    } else flash(('error' in r && r.error) || 'Değiştirilemedi');
  };

  const header = (
    <header className="aud-head">
      <a href="/" className="aud-logo" aria-label="Teknodoz Sunum ana sayfa">
        <Logo small />
      </a>
      <BetaBadge />
      <span className="aud-head-right">
        {joined && (
          <button className="people-btn" onClick={() => setShowPeople((v) => !v)} aria-expanded={showPeople}>
            👥 {people.length}
          </button>
        )}
        <ThemeSwitcher />
      </span>
    </header>
  );

  if (!joined) {
    return (
      <div className="aud-page">
        {header}
        <main className="audience audience--join">
          <div className="join-card card">
            <p className="eyebrow">Canlı sunuma katıl</p>
            <h1>Oda kodunu gir</h1>
            <p className="muted">Tamamen anonim. Tuvali canlı izle, soru sor, tepki ver, kelime öner.</p>
            <input
              className="input room-input"
              value={code}
              maxLength={6}
              placeholder="ODA KODU"
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && join()}
              aria-label="Oda kodu"
            />
            <button className="btn btn-primary btn-lg" disabled={code.length !== 6} onClick={() => join()}>
              Katıl →
            </button>
            {error && <p className="error">{error}</p>}
            <p className="small muted">
              Sunum mu yapacaksın? <a href="/">Teknodoz Sunum’u aç</a>
            </p>
          </div>
        </main>
      </div>
    );
  }

  const phaseText =
    state?.phase === 'break' ? '🫁 Mola — birlikte nefes alalım' : state?.phase === 'done' ? '🏁 Sunum bitti, teşekkürler!' : state?.phase === 'step' ? `${state.stepIndex + 1}. adım anlatılıyor` : 'Sunum birazdan başlıyor';

  const chat = (
    <section className="card stack aud-chat">
      <div className="chat-list chat-list--aud" role="log" aria-live="polite">
        {msgs.map((m) => (
          <div key={m.id} className={`msg ${m.fromPresenter ? 'msg--presenter' : ''} ${m.name === name ? 'msg--me' : ''}`}>
            <span className="msg-name">{m.fromPresenter ? '🎤 ' : ''}{m.name}</span>
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
          <input className="input" value={text} maxLength={500} placeholder="Anonim mesaj / soru…" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} aria-label="Mesaj" />
          <button className="btn btn-primary" onClick={send}>
            Gönder
          </button>
        </div>
      )}
    </section>
  );

  const suggestCard = (
    <section className="card stack">
      <h2 className="card-title">🎱 Tombalaya kelime öner</h2>
      <p className="muted small">Sunucu önerini konuşmasına bağlayabilir.</p>
      <div className="row gap-s">
        <input className="input" value={word} maxLength={40} placeholder="Bir kelime…" onChange={(e) => setWord(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && suggest()} aria-label="Kelime" />
        <button className="btn" onClick={suggest}>
          Öner
        </button>
      </div>
      <h2 className="card-title">🪪 Takma adın</h2>
      <p className="muted small">
        Şu an <b>{name}</b> olarak görünüyorsun. İstersen değiştir (gerçek adın gerekmez).
      </p>
      <div className="row gap-s">
        <input className="input" value={nick} maxLength={24} placeholder="Yeni takma ad" onChange={(e) => setNick(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && rename()} aria-label="Takma ad" />
        <button className="btn" onClick={rename}>
          Kaydet
        </button>
      </div>
    </section>
  );

  return (
    <div className="aud-page">
      {header}
      {showPeople && (
        <div className="people-pop card" role="dialog" aria-label="Katılımcılar">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b>👥 {people.length} katılımcı</b>
            <button className="icon-btn icon-btn--ghost" onClick={() => setShowPeople(false)} aria-label="Kapat">
              ✕
            </button>
          </div>
          <ul className="people-list">
            {people.map((n, i) => (
              <li key={`${n}-${i}`} className={n === name ? 'is-me' : ''}>
                {n}
                {n === name ? ' (sen)' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      <main className="audience audience--live">
        <section className="aud-state card">
          <div className="row gap-s wrap" style={{ justifyContent: 'space-between' }}>
            <h1>{state?.title ?? 'Sunum'}</h1>
            <span className={`live-pill ${connected ? '' : 'is-off'}`}>{connected ? '● CANLI' : '○ bağlanıyor…'}</span>
          </div>
          {state && state.stepCount > 0 && (
            <ol className="step-dots step-dots--sm">
              {Array.from({ length: state.stepCount }, (_, i) => (
                <li key={i} className={`step-dot ${i < state.stepIndex ? 'is-done' : ''} ${i === state.stepIndex ? 'is-current' : ''}`}>
                  <span className="dot-num">{i + 1}</span>
                </li>
              ))}
            </ol>
          )}
          <p className="muted small">
            {phaseText} · Sen: <b>{name}</b>
          </p>
          {state?.roleplay && <p className="rp-sentence small">{state.roleplay}</p>}
        </section>

        <div className="aud-tabs show-md-down" role="tablist">
          {(
            [
              ['canvas', '🎨 Tuval'],
              ['chat', `💬 Sohbet${unread ? ` (${unread})` : ''}`],
              ['suggest', '🎱 Öneri'],
            ] as const
          ).map(([t, l]) => (
            <button key={t} role="tab" aria-selected={tab === t} className={`side-tab ${tab === t ? 'is-active' : ''}`} onClick={() => setTab(t)}>
              {l}
            </button>
          ))}
        </div>

        <div className="aud-grid">
          <div className={`aud-col-main ${tab === 'canvas' ? '' : 'hide-mobile'}`}>
            <section className="card">
              <CanvasWatch snap={snap} assets={assets} view={liveView} />
            </section>
          </div>
          <div className="aud-col-side">
            <div className={tab === 'chat' ? '' : 'hide-mobile'}>{chat}</div>
            <div className={tab === 'suggest' ? '' : 'hide-mobile'}>{suggestCard}</div>
          </div>
        </div>
      </main>

      <div className="reaction-dock" role="group" aria-label="Tepkiler">
        {REACTIONS.map((r) => (
          <button key={r} className="reaction" onClick={() => getSocket().emit('reaction:send', { emoji: r })} aria-label={`Tepki ${r}`}>
            {r}
          </button>
        ))}
      </div>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
    </div>
  );
}
