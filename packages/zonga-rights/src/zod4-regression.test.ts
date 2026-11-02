import { describe, expect, it } from 'vitest'
import { CreateSplitAgreementSchema, FileDisputeSchema } from './types'
const split = { holderId: 'artist-1', holderName: 'Artist', role: 'writer', percentage: 100, rightsType: 'master' }
const agreement = { assetId: 'track-1', assetType: 'track', title: 'Track', splits: [split], effectiveFrom: '2026-01-01' }
describe('Zod 4 rights compatibility', () => {
  it('retains date coercion and optional defaults', () => {
    expect(CreateSplitAgreementSchema.parse(agreement).effectiveFrom).toBeInstanceOf(Date)
    expect(CreateSplitAgreementSchema.parse(agreement).notes).toBe('')
    expect(FileDisputeSchema.parse({ assetId: 'track-1', type: 'ownership', respondentId: 'artist-2', description: 'Ownership contested' }).evidenceIds).toEqual([])
  })
  it('rejects malformed rights input', () => {
    expect(CreateSplitAgreementSchema.safeParse({ ...agreement, splits: [{ ...split, percentage: 101 }] }).success).toBe(false)
    expect(CreateSplitAgreementSchema.safeParse({ ...agreement, assetType: 'forged' }).success).toBe(false)
    expect(CreateSplitAgreementSchema.safeParse({ ...agreement, effectiveFrom: 'invalid' }).success).toBe(false)
  })
})
