import { describe, expect, it } from 'vitest'
import { reliabilityAgent, type ReliabilitySignal } from './reliability.js'

function run(input: ReliabilitySignal) {
  return reliabilityAgent.run({ orgId: 'org-1', input })
}

describe('reliabilityAgent', () => {
  it('no-signal summary when missing', async () => {
    const r = await reliabilityAgent.run({ orgId: 'org-1' })
    expect(r.summary).toMatch(/No reliability/i)
  })

  it('flags error-budget burn and escalates 3x over target as critical', async () => {
    const r = await run({
      routes: [
        { route: '/api/a', requestCount: 1000, errorRate: 0.05, p95LatencyMs: 100, errorBudgetTarget: 0.01 },
      ],
      incidents: [],
      openProblemsCount: 0,
    })
    const burn = r.insights.find((i) => /burning error budget/i.test(i.title))
    expect(burn?.severity).toBe('critical')
    expect(r.actions.some((a) => /Investigate error spike/i.test(a.title))).toBe(true)
  })

  it('flags p95 latency SLO misses', async () => {
    const r = await run({
      routes: [{ route: '/api/b', requestCount: 500, errorRate: 0, p95LatencyMs: 800, latencySloMs: 300 }],
      incidents: [],
      openProblemsCount: 0,
    })
    expect(r.insights.some((i) => /exceeding p95 latency/i.test(i.title))).toBe(true)
  })

  it('escalates open P1 incidents and SLA breaches', async () => {
    const r = await run({
      routes: [],
      incidents: [
        { ticketId: 't1', ticketNumber: 'INC-001', priority: 'p1_critical', status: 'in_progress', ageHours: 2, slaBreached: true, title: 'DB down' },
      ],
      openProblemsCount: 0,
    })
    expect(r.insights.find((i) => /open P1/i.test(i.title))?.severity).toBe('critical')
    expect(r.insights.some((i) => /past SLA/i.test(i.title))).toBe(true)
    expect(r.actions.some((a) => /Escalate P1/i.test(a.title))).toBe(true)
  })

  it('flags root-cause debt when problems are old', async () => {
    const r = await run({
      routes: [],
      incidents: [],
      openProblemsCount: 4,
      openProblemsAgeDaysP95: 45,
    })
    const prob = r.insights.find((i) => /unresolved problem/i.test(i.title))
    expect(prob?.severity).toBe('warn')
  })

  it('healthy when clean', async () => {
    const r = await run({ routes: [], incidents: [], openProblemsCount: 0 })
    expect(r.summary).toMatch(/healthy/i)
  })
})
