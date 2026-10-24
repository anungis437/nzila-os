import { describe, expect, it } from 'vitest'
import { hasDocumentContextAccess } from './document-member-scope'
import { isDocumentVisibleByPolicy, toGovernanceLabel } from './document-governance-service'

const base = {
  isStaff: false,
  canViewCase: false,
  hasExplicitGrant: false,
  linkedEntityId: null as string | null,
  privacyLabel: 'team_confidential',
  uploadedBy: 'someone-else',
  userId: 'member-1',
}
const visible = (overrides: Partial<typeof base> & { canViewPrivateDocuments?: boolean }) => {
  const input = { ...base, ...overrides }
  return isDocumentVisibleByPolicy(toGovernanceLabel({ privacyLabel: input.privacyLabel ?? undefined }), {
    isOrgMember: true,
    isPrimaryOwner: false,
    hasCaseAccess: hasDocumentContextAccess(input),
    canViewPrivateDocuments: overrides.canViewPrivateDocuments ?? false,
    hasExplicitDocumentGrant: input.hasExplicitGrant,
  })
}

describe('document scope', () => {
  it("hides another user's unlinked team_confidential document from a member", () => {
    expect(visible({})).toBe(false)
  })

  it('shows a member their own upload and documents shared with all members', () => {
    expect(visible({ uploadedBy: 'member-1' })).toBe(true)
    expect(visible({ privacyLabel: 'public_internal' })).toBe(true)
  })

  it('does not widen sensitive labels even for the uploader or shared documents', () => {
    for (const label of ['privileged', 'highly_sensitive', 'lro_confidential']) {
      expect(visible({ privacyLabel: label, uploadedBy: 'member-1' })).toBe(false)
    }
  })

  it('requires case access for case-linked documents regardless of uploader or label', () => {
    expect(visible({ linkedEntityId: 'case-1', uploadedBy: 'member-1' })).toBe(false)
    expect(visible({ linkedEntityId: 'case-1', privacyLabel: 'public_internal' })).toBe(false)
    expect(visible({ linkedEntityId: 'case-1', canViewCase: true })).toBe(true)
  })

  it('a representative role opens organization-level documents but never a case-linked one', () => {
    expect(visible({ isStaff: true })).toBe(true)
    expect(visible({ isStaff: true, linkedEntityId: 'case-1' })).toBe(false)
    expect(visible({ isStaff: true, linkedEntityId: 'case-1', privacyLabel: 'public_internal' })).toBe(false)
    expect(visible({ isStaff: true, linkedEntityId: 'case-1', canViewCase: true })).toBe(true)
  })

  it('an explicit document grant still opens an unlinked document, and only an unlinked one by itself', () => {
    expect(visible({ hasExplicitGrant: true })).toBe(true)
    expect(visible({ hasExplicitGrant: true, linkedEntityId: 'case-1' })).toBe(false)
  })

  it('never matches a missing uploader to a missing user', () => {
    expect(hasDocumentContextAccess({ ...base, uploadedBy: null, userId: '' })).toBe(false)
  })
})
