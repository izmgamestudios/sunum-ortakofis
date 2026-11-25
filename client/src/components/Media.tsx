// client/src/components/Media.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Attachment } from '../types';
import { dataUrlToBlob, downloadAttachment, fileToAttachment, formatBytes, linkToAttachment, youTubeEmbed } from '../lib/io';

const KIND_ICON: Record<Attachment['kind'], string> = { image: '🖼️', pdf: '📄', video: '🎬', audio: '🎧', link: '🔗', file: '📎' };

/** PDFs can't be iframed from data: URLs in Chromium — convert to a blob: URL. */
function usePdfUrl(a: Attachment): string | undefined {
  const url = useMemo(() => (a.kind === 'pdf' && a.dataUrl ? URL.createObjectURL(dataUrlToBlob(a.dataUrl)) : a.url), [a]);
  useEffect(() => () => {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

export function MediaView({ a }: { a: Attachment }) {
  const pdfUrl = usePdfUrl(a);
  const src = a.dataUrl ?? a.url;
  switch (a.kind) {
    case 'image':
      return <img className="media-el" src={src} alt={a.name} loading="lazy" />;
    case 'video':
      return <video className="media-el" src={src} controls playsInline preload="metadata" />;
    case 'audio':
      return <audio className="media-audio" src={src} controls preload="metadata" />;
    case 'pdf':
      return <iframe className="media-el media-pdf" src={pdfUrl} title={a.name} />;
    case 'link': {
      const yt = a.url ? youTubeEmbed(a.url) : null;
      if (yt) return <iframe className="media-el media-video" src={yt} title={a.name} allow="encrypted-media; picture-in-picture" allowFullScreen />;
      return (
        <a className="link-card" href={a.url} target="_blank" rel="noopener noreferrer">
          🔗 <span>{a.url}</span>
        </a>
      );
    }
    default:
      return (
        <button className="btn" onClick={() => downloadAttachment(a)}>
          📎 {a.name} indir
        </button>
      );
  }
}

interface PanelProps {
  attachments: Attachment[];
  onChange?: (next: Attachment[]) => void;
}

export function MediaPanel({ attachments, onChange }: PanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(attachments[0]?.id ?? null);
  const editable = !!onChange;

  const addFiles = async (files: FileList | null) => {
    if (!files?.length || !onChange) return;
    setBusy(true);
    setError(null);
    const added: Attachment[] = [];
    for (const f of Array.from(files)) {
      try {
        added.push(await fileToAttachment(f));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    onChange([...attachments, ...added]);
    if (added[0]) setOpenId(added[0].id);
    setBusy(false);
  };

  const addLink = () => {
    if (!onChange || !link.trim()) return;
    try {
      const a = linkToAttachment(link);
      onChange([...attachments, a]);
      setOpenId(a.id);
      setLink('');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const open = attachments.find((a) => a.id === openId);

  return (
    <div className="media-panel">
      {editable && (
        <div
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            accept="image/*,application/pdf,video/*,audio/*,.txt,.md,.csv,.pptx,.docx,.xlsx"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? 'Yükleniyor…' : '⬆️ Dosya yükle'}
          </button>
          <span className="muted small">PNG · JPG · PDF · Video · Ses (≤15 MB) — ya da sürükle bırak</span>
          <div className="row gap-s link-row">
            <input
              className="input"
              placeholder="https://… (YouTube, web sayfası, görsel URL)"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addLink()}
              inputMode="url"
            />
            <button className="btn" onClick={addLink}>
              🔗 Ekle
            </button>
          </div>
          {error && <p className="error small">{error}</p>}
        </div>
      )}
      {attachments.length === 0 ? (
        <p className="muted empty">{editable ? 'Henüz medya eklenmedi.' : 'Bu adımda medya yok.'}</p>
      ) : (
        <>
          <ul className="chips">
            {attachments.map((a) => (
              <li key={a.id} className={`chip ${a.id === openId ? 'is-active' : ''}`}>
                <button className="chip-main" onClick={() => setOpenId(a.id)} title={a.name}>
                  {KIND_ICON[a.kind]} <span className="truncate">{a.name}</span>
                  {a.size > 0 && <span className="muted small"> · {formatBytes(a.size)}</span>}
                </button>
                <button className="chip-x" onClick={() => downloadAttachment(a)} aria-label="İndir / aç">
                  ⬇
                </button>
                {editable && (
                  <button className="chip-x" onClick={() => onChange!(attachments.filter((x) => x.id !== a.id))} aria-label="Kaldır">
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
          {open && (
            <div className="media-stage">
              <MediaView a={open} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
