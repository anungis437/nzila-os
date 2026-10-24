/**
 * Authority Kernel — information classification for documents attached to a case.
 *
 * A case file is not one thing. Whether a principal may read a record depends on WHAT KIND of information it is,
 * not only on their relationship to the case. Seven classes are distinguished; each maps to exactly one kernel
 * action, and the action is what relationships, mandates and delegations are matched against.
 *
 *   member_submission       the principal's OWN non-privileged submission          -> case:read_own_submission
 *   member_disclosable      union records the institution has formally released    -> case:read
 *                           to the member
 *   union_working           the union's operational file (notes, strategy, drafts)  -> case:read_internal
 *   union_restricted        working records restricted to the handling             -> case:read_internal
 *                           representatives
 *   third_party_restricted  personal, medical, disciplinary or third-party          -> case:read_third_party_restricted
 *                           information about someone other than the reader
 *   privileged              legal-privilege material                                -> case:read_privileged
 *   counsel_controlled      held by external counsel (WorkAid)                      -> never reachable
 *
 * PROVISIONAL: the mapping from stored labels to classes is an INSTITUTIONAL policy decision. The default below is
 * deliberately conservative and carries `approvedBy: null`: it releases nothing to a member except their own
 * submissions, and it never treats a word such as "public" as member-disclosable. An institution adopts its own
 * policy by supplying a `DocumentClassPolicy` whose `approvedBy` names the approving body; the kernel never
 * activates a classification on its own authority.
 */
import type { Action } from './ontology'

export type DocumentInfoClass =
  | 'member_submission'
  | 'member_disclosable'
  | 'union_working'
  | 'union_restricted'
  | 'third_party_restricted'
  | 'privileged'
  | 'counsel_controlled'

export interface ClassifiableDocument {
  uploadedBy: string | null
  /** documents.privacy_label (null when absent). */
  label: string | null
  containsLegalPrivilege: boolean
  /** Medical, disciplinary or member-PII flags: information that may concern someone other than the reader. */
  thirdPartySensitive: boolean
}

export interface DocumentClassPolicy {
  readonly version: string
  /** The institutional body that approved this mapping. `null` marks the provisional default. */
  readonly approvedBy: string | null
  /** Labels the institution has formally released to the member. Empty in the default. */
  readonly memberDisclosableLabels: readonly string[]
  /** Labels reserved to the handling representatives. */
  readonly restrictedLabels: readonly string[]
  /** Labels that denote third-party restricted information. */
  readonly thirdPartyLabels: readonly string[]
  /** Labels that denote legal privilege. */
  readonly privilegedLabels: readonly string[]
}

export const DEFAULT_DOCUMENT_CLASS_POLICY: DocumentClassPolicy = {
  version: 'ue-document-class/provisional-1',
  approvedBy: null,
  memberDisclosableLabels: [],
  restrictedLabels: ['lro_confidential'],
  thirdPartyLabels: ['case_restricted'],
  privilegedLabels: ['privileged', 'highly_sensitive'],
}

/**
 * Class of a document for a reader. Precedence is strictly from most to least protected, so that a document that is
 * both flagged sensitive and labelled otherwise lands in the more protected class.
 */
export function classifyDocument(doc: ClassifiableDocument, readerId: string, policy: DocumentClassPolicy = DEFAULT_DOCUMENT_CLASS_POLICY): DocumentInfoClass {
  const label = doc.label ?? ''
  if (doc.containsLegalPrivilege || policy.privilegedLabels.includes(label)) return 'privileged'
  // The reader's own non-privileged submission is theirs whatever it contains; it is not "third party" to them.
  if (doc.uploadedBy !== null && doc.uploadedBy === readerId) return 'member_submission'
  if (doc.thirdPartySensitive || policy.thirdPartyLabels.includes(label)) return 'third_party_restricted'
  if (policy.restrictedLabels.includes(label)) return 'union_restricted'
  if (policy.memberDisclosableLabels.includes(label)) return 'member_disclosable'
  return 'union_working'
}

export function actionForClass(cls: DocumentInfoClass): Action | null {
  switch (cls) {
    case 'member_submission':
      return 'case:read_own_submission'
    case 'member_disclosable':
      return 'case:read'
    case 'union_working':
    case 'union_restricted':
      return 'case:read_internal'
    case 'third_party_restricted':
      return 'case:read_third_party_restricted'
    case 'privileged':
      return 'case:read_privileged'
    case 'counsel_controlled':
      return null
  }
}
