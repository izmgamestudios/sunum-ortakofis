// client/src/lib/fwThumbs.ts — cached preview images of framework infographics
import { frameworkById } from './frameworks';
import { buildFramework } from './frameworkDraw';
import { renderBoard } from './canvasDraw';

const cache = new Map<string, Promise<string>>();

export function fwThumb(id: number, width = 360): Promise<string> {
  const key = `${id}@${width}`;
  let p = cache.get(key);
  if (!p) {
    const fw = frameworkById(id);
    p = fw ? renderBoard(buildFramework(fw), [], width) : Promise.resolve('');
    cache.set(key, p);
  }
  return p;
}
