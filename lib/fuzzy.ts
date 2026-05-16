export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[\s\-_.,()/\\]+/)
    .filter(t => t.length > 1);
}

export function wordEditThreshold(word: string): number {
  return Math.max(1, Math.floor(word.length / 4));
}

export interface FuzzyMatch<T> {
  item: T;
  score: number;
}

export function fuzzyRank<T>(
  query: string,
  items: T[],
  getName: (item: T) => string,
): FuzzyMatch<T>[] {
  const qWords = tokenize(query);
  if (qWords.length === 0) return [];

  const matches: FuzzyMatch<T>[] = [];

  for (const item of items) {
    const nameWords = tokenize(getName(item));
    if (nameWords.length === 0) continue;

    let total = 0;
    let ok = true;

    for (const qw of qWords) {
      const threshold = wordEditThreshold(qw);
      let best = Infinity;
      for (const nw of nameWords) {
        const lenDiff = Math.abs(qw.length - nw.length);
        if (lenDiff > threshold) continue;
        const d = levenshtein(qw, nw);
        if (d < best) best = d;
        if (best === 0) break;
      }
      if (best > threshold) { ok = false; break; }
      total += best / qw.length;
    }

    if (ok) matches.push({ item, score: total });
  }

  matches.sort((a, b) => a.score - b.score);
  return matches;
}
