import type { Decision } from '../authorization.ts';

/**
 * Reference reproduction for WA-R3-005 / WA-R3-013 / WA-T090.
 * Authorization is evaluated BEFORE any title/filename matching, so a
 * restricted document's title is never scored, counted or compared for an
 * unauthorized caller (no hit, no autocomplete, no count, no timing difference
 * attributable to matching restricted text). Routed to the platform owner.
 */
export interface SearchableDocument {
  readonly id: string;
  readonly title: string;
}

export interface SearchResult {
  readonly hits: readonly { readonly id: string; readonly title: string }[];
}

export function authorizedDocumentSearch(input: {
  query: string;
  candidates: readonly SearchableDocument[];
  authorize: (doc: SearchableDocument) => Decision;
  match: (title: string, query: string) => boolean;
}): SearchResult {
  const hits: { id: string; title: string }[] = [];
  for (const doc of input.candidates) {
    if (!input.authorize(doc).allow) continue; // never reaches the matcher
    if (input.match(doc.title, input.query)) hits.push({ id: doc.id, title: doc.title });
  }
  return { hits };
}

/** The ordering used at 38a824918 (match first, filter after), for the failing reproduction. */
export function legacyMatchThenFilterSearch(input: {
  query: string;
  candidates: readonly SearchableDocument[];
  authorize: (doc: SearchableDocument) => Decision;
  match: (title: string, query: string) => boolean;
}): SearchResult & { readonly matchedBeforeAuthorization: number } {
  const matched = input.candidates.filter((d) => input.match(d.title, input.query));
  return { hits: matched.filter((d) => input.authorize(d).allow), matchedBeforeAuthorization: matched.length };
}
