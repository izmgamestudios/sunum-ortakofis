// client/src/lib/io.ts
import type { Attachment, AttachmentKind, Presentation } from '../types';
import { normalizePresentation, uid } from './factory';
import { EMOTIONS } from './catalog';
import { buildReport, fmtDuration } from './report';

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const SNMTDZ_EXT = '.snmtdz';

export function slugify(s: string): string {
  const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', İ: 'i', Ö: 'o', Ş: 's', Ü: 'u' };
  return (
    s
      .replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => map[c] ?? c)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'sunum'
  );
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------- .snmtdz: gzip-compressed JSON with a format marker ---------- */
async function gzip(text: string): Promise<Blob> {
  if (typeof CompressionStream === 'undefined') return new Blob([text], { type: 'application/json' });
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

async function gunzip(buf: ArrayBuffer): Promise<string> {
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

export async function exportSnmtdz(p: Presentation): Promise<void> {
  const payload = JSON.stringify({ ...p, format: 'snmtdz', version: 1, exportedAt: Date.now(), app: 'Teknodoz Sunum Beta' });
  const blob = await gzip(payload);
  downloadBlob(new Blob([blob], { type: 'application/x-snmtdz' }), `${slugify(p.title)}${SNMTDZ_EXT}`);
}

export function exportJson(p: Presentation): void {
  downloadBlob(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }), `${slugify(p.title)}.json`);
}

export async function importFile(file: File): Promise<Presentation> {
  if (file.size > 200 * 1024 * 1024) throw new Error('Dosya çok büyük (200 MB üstü).');
  const buf = await file.arrayBuffer();
  const head = new Uint8Array(buf.slice(0, 2));
  const text = head[0] === 0x1f && head[1] === 0x8b ? await gunzip(buf) : new TextDecoder().decode(buf);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Dosya okunamadı: geçerli bir .snmtdz / .json değil.');
  }
  return normalizePresentation(parsed);
}

/* ---------- attachments ---------- */
export function kindFromMime(mime: string, name: string): AttachmentKind {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'file';
}

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export async function fileToAttachment(file: File): Promise<Attachment> {
  if (file.size > MAX_FILE_BYTES) throw new Error(`"${file.name}" 15 MB sınırını aşıyor.`);
  return {
    id: uid(),
    kind: kindFromMime(file.type, file.name),
    name: file.name,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    dataUrl: await readAsDataUrl(file),
  };
}

export function linkToAttachment(raw: string): Attachment {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error('Geçerli bir URL gir (https://…).');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Sadece http/https bağlantıları desteklenir.');
  const path = url.pathname.toLowerCase();
  const kind: AttachmentKind = /\.(png|jpe?g|gif|webp|svg)$/.test(path)
    ? 'image'
    : /\.(mp4|webm|ogg|mov)$/.test(path)
      ? 'video'
      : /\.(mp3|wav|m4a|oga)$/.test(path)
        ? 'audio'
        : path.endsWith('.pdf')
          ? 'pdf'
          : 'link';
  return { id: uid(), kind, name: url.hostname + url.pathname, mime: 'text/uri-list', size: 0, url: url.toString() };
}

export function youTubeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname.includes('youtu.be')) id = u.pathname.slice(1);
    else if (u.hostname.includes('youtube.com')) id = u.searchParams.get('v') ?? (u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : null);
    return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = head.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream';
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function attachmentSrc(a: Attachment): string | undefined {
  return a.dataUrl ?? a.url;
}

export function downloadAttachment(a: Attachment): void {
  if (a.dataUrl) downloadBlob(dataUrlToBlob(a.dataUrl), a.name);
  else if (a.url) window.open(a.url, '_blank', 'noopener,noreferrer');
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/* ---------- Markdown ---------- */
export function toMarkdown(p: Presentation): string {
  const r = buildReport(p);
  const lines: string[] = [];
  lines.push(`# ${p.title}`, '');
  if (p.presenter) lines.push(`**Sunan:** ${p.presenter}  `);
  if (p.audience) lines.push(`**Hedef kitle:** ${p.audience}  `);
  lines.push(`**Tarih:** ${new Date(p.run.startedAt ?? p.createdAt).toLocaleString('tr-TR')}`, '');
  lines.push('## Özet', '', `- Planlanan: ${fmtDuration(r.plannedSec)}`, `- Gerçekleşen: ${fmtDuration(r.actualSec)}`, `- Zaman skoru: ${r.timeScore}/100`, `- Not: ${p.notes.length} · Sohbet: ${p.chat.length} · Tepki: ${r.reactionTotal}`, '');
  lines.push('## Adımlar', '');
  p.steps.forEach((s, i) => {
    const sr = r.steps[i];
    lines.push(`### ${i + 1}. ${s.title}`, '', `- Süre: ${fmtDuration(s.durationSec)} planlı / ${sr?.actualSec != null ? fmtDuration(sr.actualSec) : '—'} gerçekleşen`);
    if (sr?.roleplay) lines.push(`- Rol: ${sr.roleplay}`);
    if (s.drawnWords.length) lines.push(`- Çekilen kelimeler: ${s.drawnWords.join(', ')}`);
    if (s.text) lines.push('', s.text);
    lines.push('');
  });
  if (p.notes.length) {
    lines.push('## Notlar & Alıntılar', '');
    p.notes.forEach((n) => lines.push(`- [${fmtDuration(Math.round(n.at / 1000))} · Adım ${n.stepIndex + 1} · ${n.kind}] ${n.text}`));
    lines.push('');
  }
  if (p.chat.length) {
    lines.push('## Anonim Sohbet', '');
    p.chat.forEach((c) => lines.push(`- **${c.name}** (${new Date(c.at).toLocaleTimeString('tr-TR')}): ${c.text}`));
    lines.push('');
  }
  const sw = r.swot;
  lines.push('## SWOT', '');
  (
    [
      ['Güçlü yönler', sw.strengths],
      ['Zayıf yönler', sw.weaknesses],
      ['Fırsatlar', sw.opportunities],
      ['Tehditler', sw.threats],
    ] as const
  ).forEach(([t, items]) => {
    lines.push(`### ${t}`, '', ...(items.length ? items.map((x) => `- ${x}`) : ['- —']), '');
  });
  if (p.reflection) lines.push('## Öz değerlendirme', '', p.reflection, '');
  const usedEmotions = r.emotionsUsed.map((e) => EMOTIONS[e]?.label ?? e).join(', ');
  if (usedEmotions) lines.push(`_Kullanılan duygular: ${usedEmotions}_`, '');
  lines.push('---', '_Teknodoz Sunum · Beta Erken Erişim_');
  return lines.join('\n');
}

export function exportMarkdown(p: Presentation): void {
  downloadBlob(new Blob([toMarkdown(p)], { type: 'text/markdown;charset=utf-8' }), `${slugify(p.title)}.md`);
}

/* ---------- PDF (rasterised — keeps Turkish glyphs intact without embedding fonts) ---------- */
export async function exportElementToPdf(el: HTMLElement, filename: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
  el.classList.add('pdf-capture');
  try {
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: 900 });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const imgW = pageW - margin * 2;
    const pxPerMm = canvas.width / imgW;
    const sliceHpx = Math.floor((pageH - margin * 2) * pxPerMm);
    for (let y = 0, page = 0; y < canvas.height; y += sliceHpx, page++) {
      const h = Math.min(sliceHpx, canvas.height - y);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = h;
      slice.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (page > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, h / pxPerMm);
      pdf.setFontSize(8);
      pdf.setTextColor(140);
      pdf.text(`Teknodoz Sunum - Beta - ${page + 1}`, pageW - margin, pageH - 3, { align: 'right' });
    }
    pdf.save(filename);
  } finally {
    el.classList.remove('pdf-capture');
  }
}
