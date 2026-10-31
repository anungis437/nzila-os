/** A `%term%` pattern with the LIKE wildcards in the term taken literally, so user text cannot widen a search. */
export function likeContaining(term: string): string {
  return `%${term.replace(/[\\%_]/g, '\\$&')}%`
}

export const SEARCH_TERM_MAX_LENGTH = 100
