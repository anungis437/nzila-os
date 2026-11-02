import { describe, expect, it } from 'vitest'
import { ControlStatus, ControlStatusSchema, ReleaseEvidenceSchema, PilotReadinessReport } from './types'

describe('Zod 4 health governance status and evidence boundaries', () => {
  it('preserves enum values and staging evidence structure', () => {
    expect(ControlStatusSchema.parse(ControlStatus.IMPLEMENTED)).toBe(ControlStatus.IMPLEMENTED)
    expect(ReleaseEvidenceSchema.parse({ releaseId: 'release-1', app: 'veridian', environment: 'staging', date: '2026-11-02', controls: [] }).environment).toBe('staging')
  })
  it('rejects invented statuses, environments and malformed readiness reports', () => {
    expect(ControlStatusSchema.safeParse('APPROVED').success).toBe(false)
    expect(ReleaseEvidenceSchema.safeParse({ releaseId: 'release-1', app: 'veridian', environment: 'untrusted', date: '2026-11-02', controls: [] }).success).toBe(false)
    expect(PilotReadinessReport.safeParse({ organizationId: 'org-1', siteId: 'site-1', generatedAt: '2026-11-02', items: [], overallReady: 'yes' }).success).toBe(false)
  })
})
