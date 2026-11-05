/**
 * Keywords shared by every clause in a comparison.
 *
 * A keyword is a word of at least four letters that is not a stop word and appears in the text of every compared clause; they are
 * ranked by how often they occur across the clauses. With fewer than two clauses nothing is shared, so the answer is empty by
 * definition, not by omission.
 */
const STOP_WORDS = new Set([
  'that', 'this', 'with', 'from', 'shall', 'will', 'have', 'been', 'which', 'their', 'there', 'where', 'when', 'than', 'such', 'each', 'other', 'under',
  'also', 'into', 'upon', 'them', 'they', 'were', 'what', 'would', 'could', 'should', 'only', 'more', 'most', 'some', 'any', 'all',
  'dans', 'pour', 'avec', 'sont', 'cette', 'cela', 'ainsi', 'leur', 'leurs', 'sera', 'seront', 'ont', 'les', 'des', 'une', 'aux', 'par', 'sur', 'qui', 'que',
  'tout', 'tous', 'toute', 'toutes', 'plus', 'moins', 'sans', 'sous', 'entre', 'dont', 'mais', 'comme', 'doit', 'doivent', 'peut', 'peuvent',
]);

const WORD = /[\p{L}]{4,}/gu;

export function commonKeywords(texts: ReadonlyArray<string | null | undefined>, limit = 10): string[] {
  if (texts.length < 2) return [];
  const perText = texts.map((text) => {
    const counts = new Map<string, number>();
    for (const match of (text ?? '').toLowerCase().matchAll(WORD)) {
      const word = match[0];
      if (!STOP_WORDS.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    return counts;
  });
  const shared = [...perText[0].keys()].filter((word) => perText.every((counts) => counts.has(word)));
  const total = (word: string) => perText.reduce((sum, counts) => sum + (counts.get(word) ?? 0), 0);
  return shared.sort((a, b) => total(b) - total(a) || a.localeCompare(b)).slice(0, limit);
}
