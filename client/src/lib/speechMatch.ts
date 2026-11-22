// client/src/lib/speechMatch.ts
/** Pure Turkish-aware text helpers for transcript ↔ keyword matching (no DOM deps → unit-testable). */

export const FILLER_WORDS = ['ııı', 'ıı', 'ı', 'eee', 'ee', 'ımm', 'hmm', 'şey', 'yani', 'aslında', 'hani', 'işte', 'falan', 'filan', 'açıkçası', 'resmen'];

export function normalizeTr(s: string): string {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/[â]/g, 'a')
    .replace(/[î]/g, 'i')
    .replace(/[û]/g, 'u')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(s: string): string[] {
  const n = normalizeTr(s);
  return n ? n.split(' ') : [];
}

/**
 * Turkish is agglutinative: "girişim" → "girişimciler", "kitap" → "kitabı" (consonant softening).
 * A keyword matches a token when the token starts with the keyword, or (len ≥ 5) with the keyword minus its last letter.
 */
function tokenMatches(token: string, kw: string): boolean {
  if (token === kw) return true;
  if (kw.length >= 3 && token.startsWith(kw)) return true;
  if (kw.length >= 5 && token.startsWith(kw.slice(0, -1))) return true;
  return false;
}

/** Returns the candidates (original spelling) that are mentioned in `text`. Multi-word phrases need every word in order. */
export function findMentions(text: string, candidates: string[]): string[] {
  const tokens = tokenize(text);
  if (!tokens.length) return [];
  return candidates.filter((c) => {
    const kws = tokenize(c);
    if (!kws.length) return false;
    if (kws.length === 1) return tokens.some((t) => tokenMatches(t, kws[0]));
    for (let i = 0; i <= tokens.length - kws.length; i++) {
      if (kws.every((kw, j) => tokenMatches(tokens[i + j], kw))) return true;
    }
    return false;
  });
}

export interface SpeechStats {
  words: number;
  fillers: number;
  fillerRate: number;
  topFillers: [string, number][];
}

export function speechStats(texts: string[]): SpeechStats {
  const counts = new Map<string, number>();
  let words = 0;
  let fillers = 0;
  texts.forEach((t) =>
    tokenize(t).forEach((tok) => {
      words++;
      if (FILLER_WORDS.includes(tok)) {
        fillers++;
        counts.set(tok, (counts.get(tok) ?? 0) + 1);
      }
    }),
  );
  return {
    words,
    fillers,
    fillerRate: words ? fillers / words : 0,
    topFillers: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}

/** Search folding: case-, accent- and dotted/dotless-i-insensitive ("Ikigai" ≈ "ikigai", "şablon" ≈ "sablon"). */
export function foldTr(s: string): string {
  return normalizeTr(s)
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
