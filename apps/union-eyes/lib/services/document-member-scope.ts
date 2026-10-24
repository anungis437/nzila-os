/**
 * Non-staff document scope.
 *
 * The label policy (`isDocumentVisibleByPolicy`) treats an unlinked document as case-accessible
 * for everyone, so by default any organization member could list and download any unlinked
 * `team_confidential` document uploaded by anyone. An unlinked document is accessible only when
 * the caller holds an explicit document grant, is a representative (organization-level working
 * documents), the document is shared with all members (`public_internal`) or the caller uploaded it.
 *
 * Case-linked documents ALWAYS require case access: seniority is not a case relationship, so a
 * representative role alone never opens a document that belongs to a case.
 */
export function hasDocumentContextAccess(input: {
  /** Representative-level role. Eligibility for organization-level (unlinked) documents only. */
  isStaff: boolean
  canViewCase: boolean
  hasExplicitGrant: boolean
  linkedEntityId: string | null | undefined
  privacyLabel: string | null | undefined
  uploadedBy: string | null | undefined
  userId: string
}): boolean {
  if (input.canViewCase) return true
  if (input.linkedEntityId) return false
  if (input.isStaff || input.hasExplicitGrant) return true
  if (input.privacyLabel === 'public_internal') return true
  return Boolean(input.uploadedBy) && input.uploadedBy === input.userId
}
