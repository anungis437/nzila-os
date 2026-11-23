import { describe, expect, it } from 'vitest'
import { buildSageEvidenceExportOptions } from '../export-evidence-options'
import type { SageEvidenceItemResponse } from '../evidence-schemas'

const base: SageEvidenceItemResponse = {
  id: 'evidence-1234567890',
  sourceId: 'source-sensitive-1',
  lifecycleState: 'linked',
  confidenceLevel: 'reported',
  excludedFromExternalReview: false,
  humanReviewRequired: true,
  createdAt: '2026-11-23T00:00:00.000Z',
  updatedAt: '2026-11-23T00:00:00.000Z',
}

describe('SAGE export evidence option truthfulness', () => {
  it('uses the lifecycle as a labelled state, never as an authorization level', () => {
    const result = buildSageEvidenceExportOptions([base])
    expect(result).toEqual([{ id: base.id, label: 'Evidence evidence (linked)' }])
    expect(result[0]).not.toHaveProperty('authorizationLevel')
    expect(JSON.stringify(result)).not.toContain('source-sensitive-1')
  })

  it('excludes resources explicitly marked unavailable for external review', () => {
    const entries = [
      base,
      { ...base, id: 'evidence-excluded', excludedFromExternalReview: true },
    ]
    expect(buildSageEvidenceExportOptions(entries).map((x) => x.id)).toEqual([base.id])
  })

  it('does not infer an authorization class from any lifecycle state', () => {
    const result = buildSageEvidenceExportOptions([
      { ...base, lifecycleState: 'draft' },
      { ...base, id: 'evidence-closed', lifecycleState: 'linked' },
    ])
    expect(result).toHaveLength(2)
    expect(result.every((x) => !('authorizationLevel' in x))).toBe(true)
  })
})
