/** Both retained spellings name a canonical case and require the same kernel authority. */
export const DOCUMENT_CASE_LINK_TYPES = ['case', 'grievance'] as const;
export type DocumentCaseLinkType = typeof DOCUMENT_CASE_LINK_TYPES[number];

/** Existing repository link vocabulary; an unknown stored type never becomes an unlinked document. */
export const DOCUMENT_LINK_TYPES = [
  ...DOCUMENT_CASE_LINK_TYPES,
  'member', 'policy_library', 'template_library', 'collective_agreement', 'other',
] as const;

export function isCaseDocumentLinkType(value: unknown): value is DocumentCaseLinkType {
  return DOCUMENT_CASE_LINK_TYPES.some((type) => type === value);
}

export function isDocumentLinkWellFormed(type: unknown, id: unknown): boolean {
  if (type == null && id == null) return true;
  return DOCUMENT_LINK_TYPES.some((known) => known === type) &&
    typeof id === 'string' && id.length > 0 && id.trim() === id;
}
