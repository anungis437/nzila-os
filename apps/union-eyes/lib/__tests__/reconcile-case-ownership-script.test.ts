import { describe, expect, it } from 'vitest'
import { exitCodeFor, parseArguments } from '../../scripts/reconcile-case-ownership'
import type { OwnershipReport } from '../authority/store/case-ownership'

const ORG = '11111111-1111-4111-8111-111111111111'
const report = (findings: OwnershipReport['findings']): OwnershipReport => ({
  organizationId: ORG,
  casesExamined: 3,
  findings,
  counts: { aligned: 0, backfill_candidate: 0, invalid_principal: 0, not_active_member: 0, not_handler_capacity: 0, kernel_assignee_differs: 0 },
  truncated: false,
})

describe('reconcile-case-ownership script', () => {
  it('requires an organization uuid and a sane limit', () => {
    expect(parseArguments([])).toEqual({ error: expect.stringContaining('--organization') })
    expect(parseArguments(['--organization=not-a-uuid'])).toEqual({ error: expect.stringContaining('--organization') })
    expect(parseArguments([`--organization=${ORG}`, '--limit=0'])).toEqual({ error: expect.stringContaining('--limit') })
    expect(parseArguments([`--organization=${ORG}`, '--limit=5001'])).toEqual({ error: expect.stringContaining('--limit') })
    expect(parseArguments([`--organization=${ORG}`, '--limit=25', '--json'])).toEqual({ organizationId: ORG, limit: 25, json: true, execute: false })
    expect(parseArguments([`--organization=${ORG}`])).toEqual({ organizationId: ORG, limit: undefined, json: false, execute: false })
  })

  it('refuses to execute without an issuer, an approved plan hash and a decision reference', () => {
    const hash = 'a'.repeat(64)
    expect(parseArguments([`--organization=${ORG}`, '--execute'])).toEqual({ error: expect.stringContaining('--issuer') })
    expect(parseArguments([`--organization=${ORG}`, '--execute', `--issuer=${ORG}`, `--approved-plan-hash=${hash}`])).toEqual({ error: expect.stringContaining('--decision-reference') })
    expect(parseArguments([`--organization=${ORG}`, '--execute', `--issuer=${ORG}`, '--approved-plan-hash=short', '--decision-reference=minute 12'])).toEqual({ error: expect.stringContaining('--approved-plan-hash') })
    expect(parseArguments([
      `--organization=${ORG}`,
      '--execute',
      `--issuer=${ORG}`,
      `--approved-plan-hash=${hash}`,
      '--decision-reference=executive minute 12',
    ])).toMatchObject({ execute: true, issuerUserId: ORG, approvedPlanHash: hash, decisionReference: 'executive minute 12' })
  })

  it('exits 1 on any drift, including an eligible backfill candidate, because a legacy owner is not authority', () => {
    expect(exitCodeFor(report([]))).toBe(0)
    expect(exitCodeFor(report([{ caseId: 'c', legacyOwner: 'u', kernelAssignees: [], kind: 'backfill_candidate', detail: 'x' }]))).toBe(1)
  })
})
