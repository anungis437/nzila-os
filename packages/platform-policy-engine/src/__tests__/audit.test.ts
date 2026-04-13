import { describe, it, expect } from 'vitest'
import { recordPolicyAudit, getOrgPolicyAudit } from '../audit'
import type {
  PolicyAuditEntry,
  PolicyEnginePorts,
  PolicyEvaluationOutput,
} from '../types'

function makePorts(auditEntries: PolicyAuditEntry[] = []): PolicyEnginePorts {
  return {
    async listPolicyFiles() {
      return []
    },
    async loadPolicyFile() {
      return ''
    },
    async recordAudit(entry: PolicyAuditEntry) {
      auditEntries.push(entry)
    },
    async loadAuditEntries(orgId: string, limit = 100) {
      return auditEntries.filter((e) => e.orgId === orgId).slice(0, limit)
    },
  }
}

describe('recordPolicyAudit', () => {
  it('creates and persists an audit entry', async () => {
    const entries: PolicyAuditEntry[] = []
    const ports = makePorts(entries)

    const output: PolicyEvaluationOutput = {
      evaluationId: 'eval-1',
      policyId: 'policy-1',
      input: {
        policyId: 'policy-1',
        actor: { userId: 'u1', roles: ['member'] },
        action: 'payout.create',
        resource: '/api/finance/payouts',
        context: { amount: 1000 },
        orgId: '00000000-0000-0000-0000-000000000001',
        environment: 'prod',
      },
      decisions: [],
      overallResult: 'pass',
      evaluatedAt: new Date().toISOString(),
      durationMs: 1,
    }

    const saved = await recordPolicyAudit(output, ports)
    expect(saved.evaluationId).toBe('eval-1')
    expect(entries).toHaveLength(1)
    expect(entries[0].policyId).toBe('policy-1')
  })
})

describe('getOrgPolicyAudit', () => {
  it('returns entries for an org with limit', async () => {
    const seed: PolicyAuditEntry[] = [
      {
        id: 'a1',
        evaluationId: 'e1',
        policyId: 'p1',
        actor: { userId: 'u1', roles: ['member'] },
        action: 'x',
        resource: 'r',
        overallResult: 'pass',
        decisions: [],
        orgId: '00000000-0000-0000-0000-000000000001',
        environment: 'prod',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'a2',
        evaluationId: 'e2',
        policyId: 'p2',
        actor: { userId: 'u2', roles: ['member'] },
        action: 'y',
        resource: 'r2',
        overallResult: 'fail',
        decisions: [],
        orgId: '00000000-0000-0000-0000-000000000001',
        environment: 'prod',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'a3',
        evaluationId: 'e3',
        policyId: 'p3',
        actor: { userId: 'u3', roles: ['member'] },
        action: 'z',
        resource: 'r3',
        overallResult: 'pass',
        decisions: [],
        orgId: '00000000-0000-0000-0000-000000000099',
        environment: 'prod',
        timestamp: new Date().toISOString(),
      },
    ]
    const ports = makePorts(seed)

    const entries = await getOrgPolicyAudit('00000000-0000-0000-0000-000000000001', ports, 1)
    expect(entries).toHaveLength(1)
    expect(entries[0].orgId).toBe('00000000-0000-0000-0000-000000000001')
  })
})
