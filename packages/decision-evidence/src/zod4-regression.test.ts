import { describe, expect, it } from 'vitest'
import { decisionEvidencePackInputSchema, evidenceRefSchema } from './schema'
describe('Zod 4 decision evidence contracts', () => {
  it('retains legacy UUID-format references while rejecting invalid identifiers', () => {
    const ref = { refId: '00000000-0000-0000-0000-000000000001', refType: 'governance-decision', description: 'Source evidence', capturedAt: '2026-11-02T12:00:00Z', classification: 'CONFIDENTIAL', hash: null }
    expect(evidenceRefSchema.safeParse(ref).success).toBe(true)
    expect(evidenceRefSchema.safeParse({ ...ref, refId: 'not-a-guid' }).success).toBe(false)
    expect(evidenceRefSchema.safeParse({ ...ref, classification: 'SECRET' }).success).toBe(false)
  })
  it('retains defaults without manufacturing approvals', () => {
    const input = { orgId: 'org-1', packType: 'decision-analysis', classification: 'CONFIDENTIAL', executiveSummary: 'Evaluated', decisionTitle: 'Decision', decisionOutcome: 'Proceed', timeline: [], evidenceRefs: [], scoringMatrix: null }
    const parsed = decisionEvidencePackInputSchema.parse(input)
    expect(parsed.schemaVersion).toBe('1.0.0')
    expect(parsed.approvers).toEqual([])
    expect(parsed.policyReplayOutputs).toEqual([])
    expect(decisionEvidencePackInputSchema.safeParse({ ...input, classification: 'INVALID' }).success).toBe(false)
  })
})
