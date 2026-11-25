// client/src/components/RichText.tsx — small WYSIWYG editor (bold, size, font, colour, alignment, lists, links) on contentEditable
import { useEffect, useRef, useState } from 'react';
import { htmlToText, sanitizeHtml, textToHtml } from '../lib/richtext';

interface Props {
  /** stored HTML (sanitized again on every render) */
  html?: string;
  /** plain-text fallback when no HTML exists yet */
  text: string;
  onChange: (html: string, text: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  minHeight?: number;
}

const FONTS: [string, string][] = [
  ['Inter, system-ui, sans-serif', 'Sans'],
  ['Georgia, "Times New Roman", serif', 'Serif'],
  ['"Courier New", monospace', 'Mono'],
  ['"Trebuchet MS", sans-serif', 'Trebuchet'],
  ['"Comic Sans MS", "Comic Neue", cursive', 'El yazısı'],
];
const SIZES: [string, string][] = [
  ['2', 'Küçük'],
  ['3', 'Normal'],
  ['4', 'Büyük'],
  ['5', 'Çok büyük'],
  ['6', 'Başlık'],
  ['7', 'Afiş'],
];
const COLORS = ['#0f172a', '#64748b', '#ef4444', '#f59e0b', '#16a34a', '#3b8bf7', '#a93bf5', '#ec4899'];
const MARKS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', 'transparent'];

export function RichText({ html, text, onChange, placeholder = 'Yazmaya başla…', readOnly = false, className = '', minHeight = 180 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string | null>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const source = html ?? textToHtml(text);

  // sync from outside only when the value really changed elsewhere (keeps the caret while typing)
  useEffect(() => {
    const el = ref.current;
    if (!el || source === lastEmitted.current) return;
    el.innerHTML = sanitizeHtml(source);
    lastEmitted.current = source;
  }, [source]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const clean = sanitizeHtml(el.innerHTML);
    lastEmitted.current = clean;
    onChange(clean, htmlToText(clean));
  };

  const refreshState = () => {
    const q = (c: string) => {
      try {
        return document.queryCommandState(c);
      } catch {
        return false;
      }
    };
    setActive({ bold: q('bold'), italic: q('italic'), underline: q('underline'), strikeThrough: q('strikeThrough'), insertUnorderedList: q('insertUnorderedList'), insertOrderedList: q('insertOrderedList') });
  };

  const run = (cmd: string, value?: string) => {
    ref.current?.focus();
    try {
      document.execCommand('styleWithCSS', false, cmd === 'fontSize' ? 'false' : 'true');
    } catch {
      /* older engines */
    }
    document.execCommand(cmd, false, value);
    emit();
    refreshState();
  };

  const link = () => {
    const url = prompt('Bağlantı adresi (https://…)');
    if (!url) return;
    if (!/^(https?:\/\/|mailto:)/i.test(url.trim())) return alert('Yalnızca http(s) ya da mailto bağlantıları.');
    run('createLink', url.trim());
  };

  // keep pasted content clean
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const h = e.clipboardData.getData('text/html');
    const t = e.clipboardData.getData('text/plain');
    document.execCommand('insertHTML', false, h ? sanitizeHtml(h) : textToHtml(t));
    emit();
  };

  // keep focus in the editor while clicking toolbar buttons
  const keep = (e: React.MouseEvent) => e.preventDefault();
  const btn = (cmd: string, label: string, title: string, value?: string) => (
    <button type="button" className={`rt-btn ${active[cmd] ? 'is-active' : ''}`} onMouseDown={keep} onClick={() => run(cmd, value)} title={title} aria-label={title} aria-pressed={active[cmd] ?? undefined}>
      {label}
    </button>
  );

  if (readOnly) return <div className={`rt-view ${className}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(source) }} />;

  return (
    <div className={`rt ${className}`}>
      <div className="rt-toolbar" role="toolbar" aria-label="Metin biçimlendirme">
        <select className="rt-select" onMouseDown={(e) => e.stopPropagation()} onChange={(e) => (run('formatBlock', e.target.value), (e.target.value = ''))} defaultValue="" aria-label="Paragraf stili">
          <option value="" disabled>
            Stil
          </option>
          <option value="p">Paragraf</option>
          <option value="h1">Başlık 1</option>
          <option value="h2">Başlık 2</option>
          <option value="h3">Başlık 3</option>
          <option value="blockquote">Alıntı</option>
        </select>
        <select className="rt-select" onChange={(e) => (run('fontName', e.target.value), (e.target.value = ''))} defaultValue="" aria-label="Yazı tipi">
          <option value="" disabled>
            Yazı tipi
          </option>
          {FONTS.map(([v, l]) => (
            <option key={l} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select className="rt-select" onChange={(e) => (run('fontSize', e.target.value), (e.target.value = ''))} defaultValue="" aria-label="Boyut">
          <option value="" disabled>
            Boyut
          </option>
          {SIZES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <span className="rt-sep" />
        {btn('bold', 'B', 'Kalın (Ctrl+B)')}
        {btn('italic', 'I', 'İtalik (Ctrl+I)')}
        {btn('underline', 'U', 'Altı çizili (Ctrl+U)')}
        {btn('strikeThrough', 'S', 'Üstü çizili')}
        <span className="rt-sep" />
        {btn('justifyLeft', '⯇', 'Sola hizala')}
        {btn('justifyCenter', '≡', 'Ortala')}
        {btn('justifyRight', '⯈', 'Sağa hizala')}
        {btn('justifyFull', '☰', 'İki yana yasla')}
        <span className="rt-sep" />
        {btn('insertUnorderedList', '•', 'Madde işaretli liste')}
        {btn('insertOrderedList', '1.', 'Numaralı liste')}
        <button type="button" className="rt-btn" onMouseDown={keep} onClick={link} title="Bağlantı ekle" aria-label="Bağlantı ekle">
          🔗
        </button>
        <span className="rt-sep" />
        <span className="rt-colors" aria-label="Yazı rengi">
          {COLORS.map((c) => (
            <button key={c} type="button" className="rt-swatch" style={{ background: c }} onMouseDown={keep} onClick={() => run('foreColor', c)} title={`Yazı rengi ${c}`} aria-label={`Yazı rengi ${c}`} />
          ))}
        </span>
        <span className="rt-colors" aria-label="Vurgu">
          {MARKS.map((c) => (
            <button
              key={c}
              type="button"
              className={`rt-swatch rt-swatch--mark ${c === 'transparent' ? 'is-none' : ''}`}
              style={{ background: c }}
              onMouseDown={keep}
              onClick={() => run('hiliteColor', c)}
              title={c === 'transparent' ? 'Vurguyu kaldır' : `Vurgu ${c}`}
              aria-label={c === 'transparent' ? 'Vurguyu kaldır' : `Vurgu ${c}`}
            />
          ))}
        </span>
        <span className="rt-sep" />
        {btn('removeFormat', '⌫', 'Biçimi temizle')}
        {btn('undo', '↶', 'Geri al')}
        {btn('redo', '↷', 'Yinele')}
      </div>
      <div
        ref={ref}
        className="rt-editor rt-view"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Adım metni"
        data-placeholder={placeholder}
        style={{ minHeight }}
        onInput={emit}
        onPaste={onPaste}
        onKeyUp={refreshState}
        onMouseUp={refreshState}
      />
    </div>
  );
}
