/**
 * One case as GET /api/claims/{id} answers it: the columns lib/cases/claim-detail-query.ts selects, as the driver hands them back. Timestamps and numerics are text (the driver
 * parses none of them), and a column the schema leaves nullable is null when nothing was recorded, so a screen reads each of these as it is declared here, not as the form that
 * filled it in was shaped. The route, the screen and the test of the query (lib/cases/claim-detail-wire.test.ts) share this one declaration: a column added to the
 * query without being declared here, or declared here without being selected, fails that test.
 *
 * Types only: a screen imports this, so it takes nothing from the server.
 */
export interface ClaimAttachmentWire {
  url: string
  fileName: string
  fileSize: number
  fileType: string
  uploadedAt: string
  uploadedBy: string
}

export type ClaimDetailWire = {
  claimId: string
  claimNumber: string | null
  organizationId: string
  memberId: string | null
  isAnonymous: boolean | null
  claimType: string | null
  status: string
  priority: string
  incidentDate: string | null
  location: string | null
  description: string | null
  desiredOutcome: string | null
  /** jsonb: a list of uploads, or null on a row that never had one. */
  attachments: ClaimAttachmentWire[] | null
  witnessesPresent: boolean | null
  witnessDetails: string | null
  filedDate: string | null
  createdAt: string | null
  updatedAt: string | null
  assignedTo: string | null
  assignedAt: string | null
  aiScore: number | null
  aiAnalysis: unknown
  meritConfidence: number | null
  precedentMatch: number | null
  complexityScore: number | null
  /** numeric(14,2): text such as "1250.00". */
  claimAmount: string
  settlementAmount: string
  legalCosts: string
  courtCosts: string
  resolutionOutcome: string | null
  resolvedAt: string | null
  progress: number | null
  /**
   * The member's own record, from a left join: null when the person is no longer a member of the organization, and
   * null (with memberId) when the claim was filed anonymously and the reader is neither the filer nor a representative
   * directly on the case (lib/cases/claim-identity.ts). A screen tells the two apart by `isAnonymous`.
   */
  memberName: string | null
  memberEmail: string | null
  memberPhone: string | null
}

/** Every key of ClaimDetailWire, once: what the select list of the query must be. */
export const CLAIM_DETAIL_KEYS = [
  'claimId', 'claimNumber', 'organizationId', 'memberId', 'isAnonymous', 'claimType', 'status', 'priority', 'incidentDate', 'location', 'description', 'desiredOutcome',
  'attachments', 'witnessesPresent', 'witnessDetails', 'filedDate', 'createdAt', 'updatedAt', 'assignedTo', 'assignedAt', 'aiScore', 'aiAnalysis', 'meritConfidence',
  'precedentMatch', 'complexityScore', 'claimAmount', 'settlementAmount', 'legalCosts', 'courtCosts', 'resolutionOutcome', 'resolvedAt', 'progress', 'memberName',
  'memberEmail', 'memberPhone',
] as const satisfies readonly (keyof ClaimDetailWire)[]

/** Compile-time: a key of the type that the list leaves out makes this a type error. */
type UnlistedKey = Exclude<keyof ClaimDetailWire, (typeof CLAIM_DETAIL_KEYS)[number]>
export const CLAIM_DETAIL_KEYS_COMPLETE: [UnlistedKey] extends [never] ? true : never = true
