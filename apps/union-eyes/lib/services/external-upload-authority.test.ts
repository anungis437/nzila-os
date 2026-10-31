import { describe, expect, it } from 'vitest'
import { deriveExternalUploadGrant, externalUploadLabelAllowed, type ExternalMatterGrantSnapshot } from './external-upload-authority'

const NOW = new Date('2026-10-26T13:30:00.000Z')
const ACTOR = 'rep-user'
const ISSUER = 'union-issuer'

function grant(over: Partial<ExternalMatterGrantSnapshot> = {}): ExternalMatterGrantSnapshot {
  return {
    id: 'matter-grant',
    authorityId: 'authority',
    organizationId: 'org',
    userId: ACTOR,
    representativeOrganizationId: 'rep-org',
    matterType: 'grievance',
    matterId: 'matter',
    status: 'active',
    revokedAt: null,
    expiresAt: null,
    canUploadDocuments: true,
    canViewDocuments: true,
    canDownloadDocuments: false,
    grantedBy: ISSUER,
    ...over,
  }
}

const input = (row: ExternalMatterGrantSnapshot | null, over: Partial<Parameters<typeof deriveExternalUploadGrant>[0]> = {}) =>
  deriveExternalUploadGrant({
    actorUserId: ACTOR,
    grant: row,
    authorityId: 'authority',
    matterGrantId: 'matter-grant',
    organizationId: 'org',
    representativeOrganizationId: 'rep-org',
    matterType: 'grievance',
    matterId: 'matter',
    now: NOW,
    ...over,
  })

function denial(row: ExternalMatterGrantSnapshot | null, over: Partial<Parameters<typeof deriveExternalUploadGrant>[0]> = {}) {
  const result = input(row, over)
  if (result.ok) throw new Error('expected the upload to be refused')
  return result.reason
}

describe('external upload authority', () => {
  it('copies view and download from the matter grant and keeps the union issuer', () => {
    expect(input(grant({ canViewDocuments: true, canDownloadDocuments: false }))).toEqual({
      ok: true,
      grant: { grantedBy: ISSUER, canView: true, canDownload: false, canShare: false },
    })
    const downloaded = input(grant({ canViewDocuments: false, canDownloadDocuments: true }))
    expect(downloaded.ok && downloaded.grant).toMatchObject({
      canView: false,
      canDownload: true,
      canShare: false,
    })
  })

  it('refuses a missing, revoked, expired, or mismatched grant', () => {
    expect(denial(null)).toBe('matter_grant_missing')
    expect(denial(grant({ revokedAt: NOW }))).toBe('matter_grant_invalid')
    expect(denial(grant({ status: 'expired' }))).toBe('matter_grant_invalid')
    expect(denial(grant({ expiresAt: new Date('2026-10-26T13:00:00.000Z') }))).toBe('matter_grant_invalid')
    expect(denial(grant({ matterId: 'other' }))).toBe('matter_grant_invalid')
    expect(denial(grant({ canUploadDocuments: false }))).toBe('upload_not_granted')
  })

  it('refuses a grant the representative issued to themselves', () => {
    expect(denial(grant({ grantedBy: ACTOR }))).toBe('self_issued')
    expect(denial(grant({ grantedBy: '  ' }))).toBe('self_issued')
  })

  it('refuses privilege labels and accepts the working labels', () => {
    expect(externalUploadLabelAllowed('privileged')).toBe(false)
    expect(externalUploadLabelAllowed('highly_sensitive')).toBe(false)
    expect(externalUploadLabelAllowed('case_restricted')).toBe(true)
    expect(externalUploadLabelAllowed('team_confidential')).toBe(true)
    expect(externalUploadLabelAllowed('lro_confidential')).toBe(true)
  })
})
