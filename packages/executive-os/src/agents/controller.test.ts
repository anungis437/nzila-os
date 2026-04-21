import { describe, it, expect } from 'vitest'
import { controllerAgent, type ControllerSignal } from './controller.js'

function sig(o: Partial<ControllerSignal> = {}): ControllerSignal {
  return { openPeriods: [], overdueTasks: [], openExceptions: [], ...o }
}

describe('controllerAgent', () => {
  it('reports clean close when nothing pending', async () => {
    const r = await controllerAgent.run({ orgId: 'o', input: sig() })
    expect(r.summary).toMatch(/on track/i)
    expect(r.insights).toHaveLength(0)
  })

  it('flags stale period past SLA as warn, double SLA as critical', async () => {
    const r = await controllerAgent.run({
      orgId: 'o',
      input: sig({
        openPeriods: [
          { periodId: 'p1', periodLabel: '2026-01', endDate: '2026-01-31', status: 'in_progress', daysSincePeriodEnd: 12 },
          { periodId: 'p2', periodLabel: '2025-12', endDate: '2025-12-31', status: 'in_progress', daysSincePeriodEnd: 30 },
        ],
      }),
    })
    const sevs = r.insights.map((i) => i.severity)
    expect(sevs).toContain('warn')
    expect(sevs).toContain('critical')
  })

  it('emits chase actions for overdue tasks (top 5)', async () => {
    const tasks = Array.from({ length: 7 }, (_, i) => ({
      taskId: `t${i}`,
      periodLabel: '2026-01',
      taskName: `Task ${i}`,
      assignedTo: 'u1',
      daysOverdue: i + 1,
    }))
    const r = await controllerAgent.run({ orgId: 'o', input: sig({ overdueTasks: tasks }) })
    expect(r.actions.filter((a) => a.title.startsWith('Chase'))).toHaveLength(5)
  })

  it('escalates critical exceptions and warns on high', async () => {
    const r = await controllerAgent.run({
      orgId: 'o',
      input: sig({
        openExceptions: [
          { exceptionId: 'e1', periodLabel: '2026-01', title: 'Cash mismatch', severity: 'critical', ageDays: 4 },
          { exceptionId: 'e2', periodLabel: '2026-01', title: 'Untied AR', severity: 'high', ageDays: 6 },
        ],
      }),
    })
    expect(r.actions.find((a) => a.riskLevel === 'critical')).toBeDefined()
    expect(r.insights.find((i) => i.title.includes('high-severity'))).toBeDefined()
  })
})
