// client/src/lib/outline.ts
import type { TopicNode } from '../types';
import { createNode } from './factory';

/** Parse an indented outline ("  - item") into a tree. 2 spaces or a tab = one level. */
export function parseOutline(text: string): TopicNode[] {
  const roots: TopicNode[] = [];
  const stack: { depth: number; node: TopicNode }[] = [];
  text.split('\n').forEach((raw) => {
    if (!raw.trim()) return;
    const indent = raw.match(/^[\t ]*/)![0].replace(/\t/g, '  ').length;
    const depth = Math.floor(indent / 2);
    const node = createNode(raw.trim().replace(/^([-*•]|\d+[.)])\s+/, ''));
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    if (stack.length) stack[stack.length - 1].node.children.push(node);
    else roots.push(node);
    stack.push({ depth, node });
  });
  return roots;
}
