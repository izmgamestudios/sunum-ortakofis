// client/src/lib/pdf.ts — lazy pdf.js loader (legacy build → older Safari/Chrome too)
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { Attachment } from '../types';
import { dataUrlToBlob } from './io';

let lib: Promise<typeof import('pdfjs-dist')> | null = null;
const docs = new Map<string, Promise<PDFDocumentProxy>>();

function loadLib() {
  if (!lib) {
    lib = Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]).then(([m, w]) => {
      m.GlobalWorkerOptions.workerSrc = w.default;
      return m as unknown as typeof import('pdfjs-dist');
    });
  }
  return lib;
}

export function loadPdf(a: Attachment): Promise<PDFDocumentProxy> {
  let p = docs.get(a.id);
  if (!p) {
    p = (async () => {
      const pdfjs = await loadLib();
      let data: Uint8Array;
      if (a.dataUrl) data = new Uint8Array(await dataUrlToBlob(a.dataUrl).arrayBuffer());
      else if (a.url) data = new Uint8Array(await (await fetch(a.url)).arrayBuffer());
      else throw new Error('PDF verisi yok');
      return pdfjs.getDocument({ data }).promise;
    })();
    p.catch(() => docs.delete(a.id));
    docs.set(a.id, p);
  }
  return p;
}

/** Render a page into the given canvas, fitting `cssWidth`. Returns the page aspect (h/w). */
export async function renderPdfPage(doc: PDFDocumentProxy, pageNo: number, canvas: HTMLCanvasElement, cssWidth: number, zoom = 1): Promise<number> {
  const page = await doc.getPage(pageNo);
  const base = page.getViewport({ scale: 1 });
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const scale = ((cssWidth * zoom) / base.width) * dpr;
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
  canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
  await page.render({ canvas, viewport }).promise;
  return base.height / base.width;
}

/** Page → PNG data URL (to pin a page onto the whiteboard). */
export async function pdfPageToDataUrl(doc: PDFDocumentProxy, pageNo: number, width = 1400): Promise<string> {
  const c = document.createElement('canvas');
  const page = await doc.getPage(pageNo);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / base.width });
  c.width = Math.floor(viewport.width);
  c.height = Math.floor(viewport.height);
  await page.render({ canvas: c, viewport }).promise;
  return c.toDataURL('image/jpeg', 0.85);
}
