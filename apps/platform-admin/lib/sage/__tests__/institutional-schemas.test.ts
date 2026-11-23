import { describe, expect, it } from 'vitest'
import { CreateInstitutionalResourceCommitRequest } from '../institutional-schemas'

describe('CreateInstitutionalResourceCommitRequest', () => {
  const valid = {
    mandateId: 'mandate-1',
    resourceId: 'procurement.engagement.alpha',
    requestedCommitMinor: 1_500_000,
  }

  it('admits a minimal opaque commit request', () => {
    expect(CreateInstitutionalResourceCommitRequest.parse(valid)).toEqual(valid)
  })

  it('admits an optional claimedPositionId without treating it as authority', () => {
    expect(
      CreateInstitutionalResourceCommitRequest.parse({
        ...valid,
        claimedPositionId: 'pos-1',
      }),
    ).toMatchObject({ claimedPositionId: 'pos-1' })
  })

  it('rejects browser-supplied verification labels, conflict facts and ledger totals', () => {
    const forged = CreateInstitutionalResourceCommitRequest.safeParse({
      ...valid,
      verificationStatus: 'verified',
      currency: 'CAD',
      totalCommittedMinorAfterAction: 1_500_000,
      instrumentAuthority: 'board',
      conflictOrRecusal: false,
      positionId: 'pos-authoritative',
    })
    expect(forged.success).toBe(false)
  })

  it('rejects non-positive commitment increments', () => {
    expect(
      CreateInstitutionalResourceCommitRequest.safeParse({
        ...valid,
        requestedCommitMinor: 0,
      }).success,
    ).toBe(false)
  })

  it('rejects missing mandate identifiers', () => {
    expect(
      CreateInstitutionalResourceCommitRequest.safeParse({
        resourceId: valid.resourceId,
        requestedCommitMinor: valid.requestedCommitMinor,
      }).success,
    ).toBe(false)
  })
})
