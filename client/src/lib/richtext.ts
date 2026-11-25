// client/src/lib/richtext.ts — allow-list HTML sanitizer + plain-text helpers for step rich text

const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'TEMPLATE', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'SELECT', 'NOSCRIPT', 'IMG', 'VIDEO', 'AUDIO']);
const KEEP = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'P', 'DIV', 'BR', 'SPAN', 'FONT', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'SUB', 'SUP', 'HR', 'MARK']);
const STYLE_PROPS = new Set(['text-align', 'color', 'background-color', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line']);
const SAFE_VALUE = /^[#(),.%\w\s'"-]{1,80}$/;

function cleanStyle(style: string): string {
  return style
    .split(';')
    .map((d) => {
      const i = d.indexOf(':');
      if (i < 0) return '';
      const prop = d.slice(0, i).trim().toLowerCase();
      const val = d.slice(i + 1).trim();
      if (!STYLE_PROPS.has(prop) || !SAFE_VALUE.test(val) || /url\s*\(|expression|javascript/i.test(val)) return '';
      return `${prop}: ${val}`;
    })
    .filter(Boolean)
    .join('; ');
}

function cleanNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  const tag = el.tagName.toUpperCase();
  if (DROP.has(tag)) return null;
  const kids = () => Array.from(el.childNodes).map((c) => cleanNode(c, doc)).filter((c): c is Node => !!c);
  if (!KEEP.has(tag)) {
    // unknown wrapper → keep its children only
    const frag = doc.createDocumentFragment();
    kids().forEach((k) => frag.appendChild(k));
    return frag;
  }
  const out = doc.createElement(tag.toLowerCase());
  const style = el.getAttribute('style');
  if (style) {
    const s = cleanStyle(style);
    if (s) out.setAttribute('style', s);
  }
  if (tag === 'FONT') {
    const color = el.getAttribute('color');
    const size = el.getAttribute('size');
    const face = el.getAttribute('face');
    if (color && /^#?[\w]{3,20}$/.test(color)) out.setAttribute('color', color);
    if (size && /^[1-7]$/.test(size)) out.setAttribute('size', size);
    if (face && /^[\w\s,'"-]{1,60}$/.test(face)) out.setAttribute('face', face);
  }
  if (tag === 'A') {
    const href = el.getAttribute('href') ?? '';
    if (/^(https?:|mailto:)/i.test(href.trim())) {
      out.setAttribute('href', href.trim());
      out.setAttribute('target', '_blank');
      out.setAttribute('rel', 'noopener noreferrer');
    }
  }
  kids().forEach((k) => out.appendChild(k));
  return out;
}

/** Keep only formatting markup (bold, size, colour, alignment, lists, links). Everything executable is dropped. */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const box = doc.createElement('div');
  Array.from(doc.body.childNodes).forEach((n) => {
    const c = cleanNode(n, doc);
    if (c) box.appendChild(c);
  });
  return box.innerHTML;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** plain text → minimal HTML (line breaks kept) */
export function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

/** HTML → plain text (search, speech matching, PDF report, exports) */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-3]|li|blockquote)>/gi, '$&\n')}</body>`, 'text/html');
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}
