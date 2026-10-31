import { describe, expect, it } from 'vitest'
import { jobBody, jobResponse } from '../job-result'

// Gate 0 F01 (DEF-0B6-SYS-PER-CAPITA-CRON-REPORTS-SUCCESS-AND-SWALLOWS-ORG-FAILURES,
// DEF-0B6-SYS-EXTERNAL-DATA-SYNC-FAILURES-ANSWER-HTTP-200-AND-LOG-COMPLETED,
// DEF-0B11-PRP-REWARDS-CRON-REPORTS-SUCCESS-FOR-UNKNOWN-TASKS-AND-FAILED-ORGANIZATIONS):
// a scheduler decides from the HTTP status, so a run with any failure must not be a 200.
const ok = { job: 'j', attempted: 3, succeeded: 3, failures: [] as { scope: string; reason: string }[] }

describe('job result', () => {
  it('answers 200 with the counts when nothing failed', async () => {
    const response = jobResponse(ok)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toMatchObject({ success: true, job: 'j', attempted: 3, succeeded: 3, failed: 0 })
    expect(body).not.toHaveProperty('failures')
  })

  it('answers 500 with every count and the failing scopes when any unit failed, keeping what succeeded', async () => {
    const response = jobResponse({ ...ok, succeeded: 2, failures: [{ scope: 'org-1', reason: 'calculation failed' }] })
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({
      success: false, attempted: 3, succeeded: 2, failed: 1, failures: [{ scope: 'org-1', reason: 'calculation failed' }],
    })
  })

  it('reports a run that attempted nothing with explicit zero counts rather than an unexplained success', async () => {
    await expect(jobResponse({ job: 'j', attempted: 0, succeeded: 0, failures: [] }).json()).resolves.toMatchObject({ success: true, attempted: 0, succeeded: 0 })
  })

  it('bounds the failures it echoes, and carries caller details alongside', () => {
    const many = Array.from({ length: 200 }, (_, i) => ({ scope: `org-${i}`, reason: 'x' }))
    const body = jobBody({ ...ok, succeeded: 0, failures: many, details: { overdueMarked: 4 } })
    expect(body.failed).toBe(200)
    expect((body as { failures: unknown[] }).failures).toHaveLength(50)
    expect(body).toMatchObject({ overdueMarked: 4 })
  })
})
