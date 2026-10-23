/**
 * Non-staff document scope.
 *
 * The label policy (`isDocumentVisibleByPolicy`) treats an unlinked document as case-accessible
 * for everyone, so by default any organization member could list and download any unlinked
 * `team_confidential` document uploaded by anyone. For callers below steward, an unlinked document is
 * accessible only when it is shared with all members (`public_internal`) or the caller uploaded it.
 * Case-linked documents continue to require case access, and staff keep their existing scope.
 */
export function hasDocumentContextAccess(input: {
  isStewardPlus: boolean
  canViewCase: boolean
  linkedEntityId: string | null | undefined
  privacyLabel: string | null | undefined
  uploadedBy: string | null | undefined
  userId: string
}): boolean {
  if (input.isStewardPlus || input.canViewCase) return true
  if (input.linkedEntityId) return false
  if (input.privacyLabel === 'public_internal') return true
  return Boolean(input.uploadedBy) && input.uploadedBy === input.userId
}
