import { describe, expect, it } from 'vitest'
import { securityAgent, type SecuritySignal } from './security.js'

function run(input: SecuritySignal, now?: Date) {
  return securityAgent.run({ orgId: 'org-1', input, now })
}

describe('securityAgent', () => {
  it('no-signal when missing', async () => {
    const r = await securityAgent.run({ orgId: 'org-1' })
    expect(r.summary).toMatch(/No security/i)
  })

  it('escalates unwaived critical findings', async () => {
    const r = await run({
      findings: [
        { advisoryId: 'CVE-1', packageName: 'foo', severity: 'critical', waived: false },
      ],
    })
    const crit = r.insights.find((i) => /CRITICAL/i.test(i.title))
    expect(crit?.severity).toBe('critical')
    expect(r.actions.some((a) => /Remediate critical/i.test(a.title))).toBe(true)
  })

  it('warns on unwaived high findings', async () => {
    const r = await run({
      findings: [{ advisoryId: 'CVE-2', packageName: 'bar', severity: 'high', waived: false }],
    })
    expect(r.insights.some((i) => /HIGH/i.test(i.title))).toBe(true)
  })

  it('flags expired waivers as critical', async () => {
    const r = await run({
      findings: [
        { advisoryId: 'CVE-3', packageName: 'baz', severity: 'high', waived: true, daysUntilWaiverExpires: -5 },
      ],
    })
    const ex = r.insights.find((i) => /EXPIRED/i.test(i.title))
    expect(ex?.severity).toBe('critical')
  })

  it('warns on expiring-soon waivers', async () => {
    const r = await run({
      findings: [
        { advisoryId: 'CVE-4', packageName: 'baz', severity: 'medium', waived: true, daysUntilWaiverExpires: 5 },
      ],
      waiverWarnDays: 14,
    })
    expect(r.insights.some((i) => /expiring within/i.test(i.title))).toBe(true)
  })

  it('warns when scan is stale', async () => {
    const now = new Date('2026-04-20T00:00:00Z')
    const r = await run(
      {
        findings: [],
        lastScanAt: '2026-04-01T00:00:00Z',
        scanStaleDays: 7,
      },
      now,
    )
    expect(r.insights.some((i) => /scan stale/i.test(i.title))).toBe(true)
  })

  it('clean when nothing flagged', async () => {
    const r = await run({ findings: [] })
    expect(r.summary).toMatch(/clean/i)
  })

  it('flags overdue unresolved critical as critical', async () => {
    const r = await run({
      findings: [
        { advisoryId: 'CVE-OV1', packageName: 'pkg', severity: 'critical', waived: false, daysUntilDue: -3, status: 'open', owner: 'secops' },
      ],
    })
    const overdue = r.insights.find((i) => /past due date/i.test(i.title))
    expect(overdue?.severity).toBe('critical')
  })

  it('ignores overdue for resolved/suppressed findings', async () => {
    const r = await run({
      findings: [
        { advisoryId: 'CVE-R', packageName: 'pkg', severity: 'high', waived: false, daysUntilDue: -30, status: 'resolved', owner: 'x' },
      ],
    })
    expect(r.insights.some((i) => /past due/i.test(i.title))).toBe(false)
  })

  it('flags ownerless high/critical findings with assign-owner action', async () => {
    const r = await run({
      findings: [
        { advisoryId: 'CVE-NO', packageName: 'p', severity: 'high', waived: false, owner: null },
      ],
    })
    expect(r.insights.some((i) => /no owner/i.test(i.title))).toBe(true)
    expect(r.actions.some((a) => /Assign owner/i.test(a.title))).toBe(true)
  })
})
