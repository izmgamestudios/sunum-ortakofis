// client/src/components/SlideViewer.tsx — image slider + page-by-page PDF reader
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Attachment } from '../types';
import { loadPdf, pdfPageToDataUrl, renderPdfPage } from '../lib/pdf';
import { uid } from '../lib/factory';
import { youTubeEmbed } from '../lib/io';
import { MediaView } from './Media';

interface Props {
  attachments: Attachment[];
  /** attachment to show first (e.g. double-clicked on the canvas) */
  focusId?: string | null;
  onPinExisting?: (a: Attachment) => void;
  onPinNew?: (a: Attachment) => void;
  onAddClick?: () => void;
}

const VISUAL: Attachment['kind'][] = ['image', 'pdf', 'video', 'link', 'audio'];
const ICON: Record<string, string> = { image: '🖼️', pdf: '📄', video: '🎬', audio: '🎧', link: '🔗', file: '📎' };

function PdfReader({ att, page, zoom, onPages }: { att: Attachment; page: number; zoom: number; onPages: (n: number) => void }) {
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setDoc(null);
    setError(null);
    loadPdf(att)
      .then((d) => {
        if (!alive) return;
        setDoc(d);
        onPages(d.numPages);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'PDF açılamadı'));
    return () => {
      alive = false;
    };
  }, [att]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!doc || !canvas.current || width < 50) return;
    let alive = true;
    setLoading(true);
    renderPdfPage(doc, Math.min(page, doc.numPages), canvas.current, Math.min(width - 16, 1100), zoom)
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Sayfa çizilemedi'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [doc, page, width, zoom]);

  return (
    <div ref={holder} className="pdf-reader">
      {error ? (
        <p className="error">📄 {error}</p>
      ) : (
        <>
          {(!doc || loading) && <p className="pdf-loading muted">⏳ Sayfa hazırlanıyor…</p>}
          <canvas ref={canvas} className="pdf-page" aria-label={`${att.name} — sayfa ${page}`} />
        </>
      )}
    </div>
  );
}

export function SlideViewer({ attachments, focusId, onPinExisting, onPinNew, onAddClick }: Props) {
  const slides = useMemo(() => attachments.filter((a) => VISUAL.includes(a.kind)), [attachments]);
  const [idx, setIdx] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState<Record<string, number>>({});
  const [zoom, setZoom] = useState(1);
  const [pinning, setPinning] = useState(false);
  const swipe = useRef<number | null>(null);
  const cur = slides[Math.min(idx, slides.length - 1)];
  const numPages = cur?.kind === 'pdf' ? pages[cur.id] ?? 0 : 0;

  useEffect(() => {
    if (!focusId) return;
    const i = slides.findIndex((s) => s.id === focusId);
    if (i >= 0) {
      setIdx(i);
      setPage(1);
    }
  }, [focusId, slides]);

  useEffect(() => setZoom(1), [idx]);

  const go = (dir: 1 | -1) => {
    if (!cur) return;
    if (cur.kind === 'pdf' && numPages) {
      if (dir === 1 && page < numPages) return setPage(page + 1);
      if (dir === -1 && page > 1) return setPage(page - 1);
    }
    const next = (idx + dir + slides.length) % slides.length;
    setIdx(next);
    const target = slides[next];
    setPage(dir === -1 && target?.kind === 'pdf' && pages[target.id] ? pages[target.id] : 1);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (['ArrowRight', 'PageDown', 'ArrowLeft', 'PageUp', '+', '-', '='].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation(); // don't change the presentation step
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1);
      else if (e.key === '-') setZoom((z) => Math.max(0.5, z - 0.25));
      else setZoom((z) => Math.min(3, z + 0.25));
    }
  };

  const pin = async () => {
    if (!cur) return;
    if (cur.kind === 'image') return onPinExisting?.(cur);
    if (cur.kind === 'pdf') {
      setPinning(true);
      try {
        const doc = await loadPdf(cur);
        const dataUrl = await pdfPageToDataUrl(doc, page);
        onPinNew?.({ id: uid(), kind: 'image', name: `${cur.name.replace(/\.pdf$/i, '')} — s.${page}.jpg`, mime: 'image/jpeg', size: Math.round((dataUrl.length * 3) / 4), dataUrl });
      } finally {
        setPinning(false);
      }
      return;
    }
    onPinExisting?.(cur);
  };

  if (!cur) {
    return (
      <div className="slides slides--empty">
        <p className="muted">Bu adımda gösterilecek görsel, PDF veya video yok.</p>
        {onAddClick && (
          <button className="btn btn-primary" onClick={onAddClick}>
            ＋ Medya ekle
          </button>
        )}
      </div>
    );
  }

  const yt = cur.kind === 'link' && cur.url ? youTubeEmbed(cur.url) : null;

  return (
    <div className="slides" tabIndex={0} onKeyDown={onKey} aria-roledescription="slayt gösterisi" aria-label={`${cur.name}`}>
      <div className="slides-bar">
        <span className="slides-title truncate">
          {ICON[cur.kind]} {cur.name}
        </span>
        <span className="slides-count">
          {idx + 1}/{slides.length}
          {cur.kind === 'pdf' && numPages > 0 && ` · s. ${page}/${numPages}`}
        </span>
        <div className="seg">
          <button className="tool" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} aria-label="Uzaklaştır" title="Uzaklaştır (−)">－</button>
          <button className="tool tool--wide" onClick={() => setZoom(1)} title="Sığdır">{Math.round(zoom * 100)}%</button>
          <button className="tool" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} aria-label="Yakınlaştır" title="Yakınlaştır (+)">＋</button>
        </div>
        {(cur.kind === 'image' || cur.kind === 'pdf') && (onPinExisting || onPinNew) && (
          <button className="btn btn-sm" onClick={pin} disabled={pinning} title="Bu slaytı tuvale ekle — üzerine çizim yap">
            {pinning ? '⏳' : '📌'} <span className="hide-sm">Tuvale ekle</span>
          </button>
        )}
        {onAddClick && (
          <button className="btn btn-sm btn-ghost" onClick={onAddClick} title="Medya ekle">
            ＋
          </button>
        )}
      </div>

      <div
        className={`slides-stage ${zoom > 1 ? 'is-zoomed' : ''}`}
        onPointerDown={(e) => (swipe.current = e.clientX)}
        onPointerUp={(e) => {
          if (swipe.current != null && zoom <= 1 && Math.abs(e.clientX - swipe.current) > 60) go(e.clientX < swipe.current ? 1 : -1);
          swipe.current = null;
        }}
      >
        <button className="slide-nav slide-nav--prev" onClick={() => go(-1)} aria-label="Önceki">
          ‹
        </button>
        <div className="slide-content" key={`${cur.id}-${cur.kind === 'pdf' ? 'pdf' : 'm'}`}>
          {cur.kind === 'image' && (
            <img src={cur.dataUrl ?? cur.url} alt={cur.name} className="slide-img" style={{ transform: `scale(${zoom})` }} draggable={false} />
          )}
          {cur.kind === 'pdf' && <PdfReader att={cur} page={page} zoom={zoom} onPages={(n) => setPages((p) => ({ ...p, [cur.id]: n }))} />}
          {cur.kind === 'video' && <video src={cur.dataUrl ?? cur.url} controls playsInline className="slide-video" />}
          {cur.kind === 'audio' && (
            <div className="slide-audio">
              <span>🎧</span>
              <audio src={cur.dataUrl ?? cur.url} controls />
            </div>
          )}
          {cur.kind === 'link' &&
            (yt ? (
              <iframe src={yt} title={cur.name} className="slide-video" allow="encrypted-media; picture-in-picture" allowFullScreen />
            ) : cur.url && /^https?:\/\//i.test(cur.url) ? (
              <WebEmbed url={cur.url} name={cur.name} />
            ) : (
              <MediaView a={cur} />
            ))}
        </div>
        <button className="slide-nav slide-nav--next" onClick={() => go(1)} aria-label="Sonraki">
          ›
        </button>
      </div>

      {cur.kind === 'pdf' && numPages > 1 && (
        <div className="pdf-pager">
          <button className="btn btn-sm" onClick={() => setPage(1)} disabled={page === 1}>⏮</button>
          <button className="btn btn-sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>‹ Önceki</button>
          <label className="small">
            Sayfa{' '}
            <input
              className="input input--sm pager-input"
              type="number"
              min={1}
              max={numPages}
              value={page}
              onChange={(e) => setPage(Math.max(1, Math.min(numPages, Number(e.target.value) || 1)))}
            />{' '}
            / {numPages}
          </label>
          <button className="btn btn-sm" onClick={() => setPage((p) => Math.min(numPages, p + 1))} disabled={page === numPages}>Sonraki ›</button>
          <button className="btn btn-sm" onClick={() => setPage(numPages)} disabled={page === numPages}>⏭</button>
        </div>
      )}

      {slides.length > 1 && (
        <div className="thumbs" role="tablist" aria-label="Slaytlar">
          {slides.map((s, i) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={i === idx}
              className={`thumb-btn ${i === idx ? 'is-active' : ''}`}
              onClick={() => {
                setIdx(i);
                setPage(1);
              }}
              title={s.name}
            >
              {s.kind === 'image' ? <img src={s.dataUrl ?? s.url} alt="" loading="lazy" /> : <span>{ICON[s.kind]}</span>}
              <small className="truncate">{s.kind === 'pdf' && pages[s.id] ? `${pages[s.id]} s.` : s.name}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Live website inside the slide (sandboxed). Sites that forbid framing still get a one-click "open in new tab". */
function WebEmbed({ url: raw, name }: { url: string; name: string }) {
  // an https page can't frame plain http — upgrade the link
  const url = raw.replace(/^http:/i, 'https:');
  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    /* keep raw */
  }
  return (
    <div className="web-embed">
      <div className="web-embed-bar">
        <span className="web-embed-dot" aria-hidden />
        <span className="web-embed-url truncate">🔒 {host}</span>
        <a className="btn btn-sm" href={url} target="_blank" rel="noopener noreferrer">
          ↗ Yeni sekmede aç
        </a>
      </div>
      <iframe
        src={url}
        title={name}
        className="web-embed-frame"
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        allow="fullscreen; clipboard-write"
      />
      <p className="web-embed-note small muted">Site burada açılmıyorsa sahibi gömmeye izin vermiyordur — “Yeni sekmede aç” ile göster.</p>
    </div>
  );
}
