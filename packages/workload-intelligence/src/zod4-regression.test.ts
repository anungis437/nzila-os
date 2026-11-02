import { describe, expect, it } from 'vitest'
import { workItemSchema, intakeSubmissionSchema, officialWorkItemSchema } from './models/types'
describe('Zod 4 workload boundary', () => {
  const work = { id: 'work-1', orgId: 'org-1', type: 'grievance', title: 'Work', createdAt: '2026-11-02T00:00:00Z', stakeholders: [], urgencySignals: [], riskSignals: [], strategicSignals: [], metadata: { nested: { origin: 'member' } } }
  it('preserves nested record metadata and rejects arrays and empty org', () => {
    expect(workItemSchema.parse(work).metadata).toEqual(work.metadata)
    expect(workItemSchema.safeParse({ ...work, metadata: ['invalid'] }).success).toBe(false)
    expect(workItemSchema.safeParse({ ...work, orgId: '' }).success).toBe(false)
  })
  it('retains intake and official item status constraints', () => {
    const intake = { id: 'intake-1', orgId: 'org-1', submittedByMemberId: 'member-1', title: 'Intake', description: 'Description', submittedAt: '2026-11-02T00:00:00Z', attachments: [], urgencyIndicators: [], status: 'new', metadata: { source: 'portal' } }
    expect(intakeSubmissionSchema.safeParse(intake).success).toBe(true)
    expect(intakeSubmissionSchema.safeParse({ ...intake, status: 'unknown' }).success).toBe(false)
    const official = { ...work, createdByRepId: 'rep-1', status: 'active' }
    expect(officialWorkItemSchema.safeParse(official).success).toBe(true)
    expect(officialWorkItemSchema.safeParse({ ...official, status: 'new' }).success).toBe(false)
  })
})
