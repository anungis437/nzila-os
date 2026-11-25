import { describe, expect, it } from 'vitest'
import { hasDocumentContextAccess } from './document-member-scope'
import { isDocumentVisibleByPolicy, toGovernanceLabel, type GovernancePrivacyLabel } from './document-governance-service'

const base = {
  isStaff: false,
  canViewCase: false,
  hasExplicitGrant: false,
  linkedEntityType: null as string | null,
  linkedEntityId: null as string | null,
  privacyLabel: 'team_confidential',
  uploadedBy: 'someone-else',
  userId: 'member-1',
}
const visible = (overrides: Partial<typeof base> & { canViewPrivateDocuments?: boolean }) => {
  const input = { ...base, ...overrides }
  return isDocumentVisibleByPolicy(toGovernanceLabel({ privacyLabel: input.privacyLabel as GovernancePrivacyLabel }), {
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
    expect(visible({ linkedEntityType: 'case', linkedEntityId: 'case-1', uploadedBy: 'member-1' })).toBe(false)
    expect(visible({ linkedEntityType: 'case', linkedEntityId: 'case-1', privacyLabel: 'public_internal' })).toBe(false)
    expect(visible({ linkedEntityType: 'case', linkedEntityId: 'case-1', canViewCase: true })).toBe(true)
  })

  it('a representative role opens organization-level documents but never a case-linked one', () => {
    expect(visible({ isStaff: true })).toBe(true)
    expect(visible({ isStaff: true, linkedEntityType: 'case', linkedEntityId: 'case-1' })).toBe(false)
    expect(visible({ isStaff: true, linkedEntityType: 'case', linkedEntityId: 'case-1', privacyLabel: 'public_internal' })).toBe(false)
    expect(visible({ isStaff: true, linkedEntityType: 'case', linkedEntityId: 'case-1', canViewCase: true })).toBe(true)
  })

  it('an explicit document grant still opens an unlinked document, and only an unlinked one by itself', () => {
    expect(visible({ hasExplicitGrant: true })).toBe(true)
    expect(visible({ hasExplicitGrant: true, linkedEntityType: 'case', linkedEntityId: 'case-1' })).toBe(false)
  })

  it('never matches a missing uploader to a missing user', () => {
    expect(hasDocumentContextAccess({ ...base, uploadedBy: null, userId: '' })).toBe(false)
  })

  it.each(['member', 'policy_library', 'template_library', 'collective_agreement', 'other'])('applies organization document scope to a verified non-case %s link', linkedEntityType => {
    const link = { linkedEntityType, linkedEntityId: 'non-case-entity' }
    expect(visible({ ...link, isStaff: true })).toBe(true)
    expect(visible({ ...link, uploadedBy: 'member-1' })).toBe(true)
    expect(visible({ ...link, privacyLabel: 'public_internal' })).toBe(true)
    expect(visible({ ...link, hasExplicitGrant: true })).toBe(true)
    expect(visible(link)).toBe(false)
    expect(visible({ ...link, privacyLabel: 'privileged', uploadedBy: 'member-1' })).toBe(false)
  })

  it.each(['case', 'grievance'])('requires live case access for the %s semantic type even with office, uploader and grant eligibility', linkedEntityType => {
    expect(visible({ linkedEntityType, linkedEntityId: 'case-1', isStaff: true, uploadedBy: 'member-1', hasExplicitGrant: true })).toBe(false)
    expect(visible({ linkedEntityType, linkedEntityId: 'case-1', canViewCase: true })).toBe(true)
  })

  it.each([[null, 'case-1'], ['case', null], ['policy_library', null], ['unknown', 'case-1']])('denies malformed %s/%s before every eligibility shortcut', (linkedEntityType, linkedEntityId) => {
    expect(hasDocumentContextAccess({ ...base, linkedEntityType, linkedEntityId, isStaff: true, canViewCase: true, hasExplicitGrant: true })).toBe(false)
  })
})
