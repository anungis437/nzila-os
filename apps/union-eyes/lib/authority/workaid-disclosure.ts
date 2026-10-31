/**
 * WorkAid union-side disclosure boundary: vocabulary, limits and counsel-facing shapes (no I/O).
 *
 * Two EXTERNAL gates stay outside this repository and are deliberately not simulated here:
 *   1. Counsel-side activation: a counsel-side system exists, authenticates counsel and holds the issuer allow-list
 *      that `authenticateCounselAssertion` checks. Until then no counsel verifier is configured and counsel access
 *      is refused (fail closed).
 *   2. Key custody (UE-CONV-G-003): the keys that sign counsel assertions are held and rotated by the counsel-side
 *      operator. Nothing in this repository can sign, mint or verify them.
 * Everything below is the union's side of the line: what a member may consent to, what may be disclosed, and what
 * counsel is allowed to see of it.
 */
import { createHash } from 'node:crypto'
import type { DocumentInfoClass } from './document-class'

/** Closed vocabulary. There is no wildcard and no free-text category: an unknown category is a refusal. */
export const WORKAID_CATEGORIES = ['case_summary', 'case_timeline', 'documents', 'member_identity'] as const
export type WorkAidCategory = (typeof WORKAID_CATEGORIES)[number]

/**
 * Only information the member can themselves release may be authorised by the member's consent: their own
 * non-privileged submissions and records the institution has formally released to them. The union's working file,
 * third-party restricted information and legal-privilege material need a separate, union-side release that this
 * boundary does not provide, so they are never shareable here.
 */
export const SHAREABLE_DOCUMENT_CLASSES: readonly DocumentInfoClass[] = ['member_submission', 'member_disclosable']

export const MAX_CONSENT_TERM_DAYS = 365
export const MAX_PURPOSE_LENGTH = 500

export type WorkAidRefusalCode =
  | 'CONSENT_TEXT_UNAVAILABLE'
  | 'CONSENT_TEXT_NOT_ACKNOWLEDGED'
  | 'CATEGORY_NOT_ALLOWED'
  | 'CONSENT_TERM_INVALID'
  | 'CONSENT_NOT_LIVE'
  | 'CASE_NOT_OWNED_BY_MEMBER'
  | 'CASE_ALREADY_REFERRED'
  | 'DOCUMENT_NOT_SHAREABLE'
  | 'DOCUMENT_NOT_AUTHORISED'
  | 'MATTER_NOT_FOUND'
  | 'NOT_THE_CONSENTING_MEMBER'
  | 'COUNSEL_ACCESS_REFUSED'
  | 'REFERRAL_SCOPE_EXCEEDED'

export const sha256Hex = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex')

/** Validates and canonicalises a category list: non-empty, known, no wildcard, de-duplicated and sorted. */
export function normaliseCategories(input: readonly string[] | undefined): WorkAidCategory[] {
  if (!input || input.length === 0) throw new Error('CATEGORY_NOT_ALLOWED: explicit categories are required')
  const out = new Set<WorkAidCategory>()
  for (const c of input) {
    if (!(WORKAID_CATEGORIES as readonly string[]).includes(c)) throw new Error(`CATEGORY_NOT_ALLOWED: "${c}" is not a WorkAid disclosure category`)
    out.add(c as WorkAidCategory)
  }
  return [...out].sort()
}

/** What counsel may be told about the consent that bounds everything else it sees. */
export interface CounselConsentView {
  categories: readonly WorkAidCategory[]
  purpose: string
  expiresAt: string
  textVersion: string
}

export interface CounselDocumentItem {
  /** Opaque, matter-scoped item reference. NOT the document id. */
  itemRef: string
  classification: DocumentInfoClass
  authorisedUntil: string
}

/**
 * The ONLY shape counsel receives. It is built by explicit field copy: the member id, the underlying case id, the
 * referrer, document ids and titles never appear in it. `matterId` is the pseudonymous matter identifier: a random
 * server-generated uuid that encodes nothing about the member or the case, and the id counsel assertions bind to.
 */
export interface CounselManifest {
  matterId: string
  referredAt: string
  consent: CounselConsentView
  /** Categories released by live shares, always a subset of the consent. */
  releasedCategories: readonly WorkAidCategory[]
  memberIdentityDisclosure: 'authorised' | 'not_authorised'
  documents: readonly CounselDocumentItem[]
  /** Stated on every manifest so no consumer mistakes a union-side record for counsel-side acknowledgement. */
  counselSideState: 'union_record_only'
}
