import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B93: dashboard measures, queue key and archived employer input', () => {
  it('measures the dashboard on event dates, not on when rows were created', () => {
    const route = src('app/api/health-safety/dashboard/route.ts')
    expect(route).toContain('max(incident_date)')
    expect(route).toContain('incident_date >= ${startDate}')
    expect(route).toContain('scheduled_date >= ${startDate}')
    expect(route).toContain('reported_date >= ${startDate}')
    expect(route).not.toContain('max(created_at)')
    expect(route).not.toContain('openHazards > 3')
  })

  it('reads the queue status key from a dedicated variable and never falls back to the shared AI key (#1118)', () => {
    const route = src('app/api/union-eyes/queue-status/route.ts')
    expect(route).toContain('const expected = process.env.QUEUE_STATUS_SERVICE_KEY')
    expect(route).toContain('expected === process.env.AI_SERVICE_KEY')
    expect(route).not.toMatch(/QUEUE_STATUS_SERVICE_KEY \|\|/)
    expect(route).toContain('constantTimeEquals(')
  })

  it('refuses timesheet input for an archived employer', () => {
    const route = src('app/api/employer-execution/timesheets/route.ts')
    expect(route).toContain('employer.status === "archived"')
  })
})
