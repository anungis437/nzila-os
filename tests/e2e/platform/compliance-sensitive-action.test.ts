/**
 * E2E Proof Test: Compliance-Sensitive Action
 *
 * Proves that a regulated action (financial claim approval) is subject to
 * stricter governance. Demonstrates: explicit deny → allow with elevated
 * privileges → decision logging → audit evidence export with hash chain
 * integrity. Writes machine-verifiable proof artifacts.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import {
  composePipeline,
  createContext,
  createEnforcedHandler,
  traceLayer,
  authLayer,
  rateLimitLayer,
  governanceLayer,
  auditLayer,
} from '@nzila/enforcement'
import {
  canAccess,
  InMemoryDecisionStore,
  DecisionLogger,
  type PolicySet,
} from '@nzila/governance'
import {
  AuditEngine,
  InMemoryAuditStore,
  verifyChain,
  exportAuditLog,
} from '@nzila/audit'
import { generateTraceId } from '@nzila/observability'
import { writeProofBundle, buildSummary } from '../../../scripts/proof/proof-artifacts'

const SCENARIO = 'compliance-sensitive-action'

// ── Fixtures — strict compliance policy ─────────────────────────────────────

const COMPLIANCE_POLICY: PolicySet = {
  id: 'abr-compliance-policy',
  name: 'ABR Financial Compliance Policy',
  defaultEffect: 'deny',
  rules: [
    {
      id: 'allow-compliance-approve',
      description: 'Only compliance officers can approve financial claims',
      resource: 'financial-claim',
      actions: ['approve'],
      effect: 'allow',
      roles: ['compliance-officer'],
      priority: 100,
    },
    {
      id: 'allow-admin-read',
      description: 'Admins can read claims',
      resource: 'financial-claim',
      actions: ['read'],
      effect: 'allow',
      roles: ['admin', 'compliance-officer', 'viewer'],
      priority: 50,
    },
  ],
}

// ── Shared state ────────────────────────────────────────────────────────────

const auditStore = new InMemoryAuditStore()
const auditEngine = new AuditEngine(auditStore)
const decisionStore = new InMemoryDecisionStore()
const decisionLogger = new DecisionLogger(decisionStore, COMPLIANCE_POLICY.id)

const evidence = {
  traceId: '',
  denyResult: null as { success: boolean; status: number; body?: unknown } | null,
  denyDecision: null as ReturnType<typeof canAccess> | null,
  allowResult: null as { success: boolean; status: number; body?: unknown } | null,
  allowDecision: null as ReturnType<typeof canAccess> | null,
  auditExport: null as { entryCount: number; entries: unknown[]; data: string } | null,
  chainVerification: null as { valid: boolean; entriesChecked: number } | null,
}

function buildPipeline(actorId: string, tenantId: string, roles: string[]) {
  return createEnforcedHandler(
    [
      traceLayer(),
      authLayer({
        extractActor: async () => ({ tenantId, actorId, roles }),
      }),
      rateLimitLayer({
        check: async () => ({ allowed: true, remaining: 50, resetAt: Date.now() + 60000 }),
      }),
      governanceLayer({
        evaluate: async (ctx) => {
          const decision = canAccess(COMPLIANCE_POLICY, {
            actor: { id: ctx.actorId!, tenantId: ctx.tenantId!, roles: ctx.roles ?? [] },
            resource: { type: ctx.resourceType },
            action: ctx.action,
          })
          if (roles.includes('viewer')) evidence.denyDecision = decision
          else evidence.allowDecision = decision
          decisionLogger.log(decision)
          return { outcome: decision.outcome, reason: decision.reason }
        },
      }),
      auditLayer({
        record: async (entry) => {
          await auditEngine.record({
            actorId: entry.actorId ?? 'unknown',
            tenantId: entry.tenantId ?? 'unknown',
            action: entry.action,
            resource: entry.resource,
            resourceId: 'claim-001',
            payload: {
              status: entry.status,
              durationMs: entry.durationMs,
              roles,
            },
            traceId: entry.traceId,
          })
        },
      }),
    ],
    async () => ({
      success: true,
      status: 200,
      body: { claimApproved: true, claimId: 'claim-001' },
    }),
  )
}

describe('Compliance-Sensitive Action — Strict Governance Proof', () => {
  beforeAll(async () => {
    evidence.traceId = generateTraceId()

    // Attempt 1: viewer tries to approve (should be denied)
    const denyCtx = createContext({
      action: 'approve',
      resourceType: 'financial-claim',
      route: '/api/claims/claim-001/approve',
      headers: { authorization: 'Bearer tok_junior' },
    })
    ;(denyCtx as any).traceId = evidence.traceId

    const denyHandler = buildPipeline('user_junior_001', 'tenant_abr', ['viewer'])
    evidence.denyResult = await denyHandler(denyCtx)

    // Governance deny short-circuits before auditLayer — record deny audit explicitly
    await auditEngine.record({
      actorId: 'user_junior_001',
      tenantId: 'tenant_abr',
      action: 'approve',
      resource: 'financial-claim',
      payload: { outcome: 'deny', status: 403 },
      traceId: evidence.traceId,
    })

    // Attempt 2: compliance officer approves (should succeed)
    const allowCtx = createContext({
      action: 'approve',
      resourceType: 'financial-claim',
      route: '/api/claims/claim-001/approve',
      headers: { authorization: 'Bearer tok_compliance' },
    })
    ;(allowCtx as any).traceId = evidence.traceId

    const allowHandler = buildPipeline('user_compliance_001', 'tenant_abr', ['compliance-officer'])
    evidence.allowResult = await allowHandler(allowCtx)

    // Verify chain across all entries
    const allEntries = auditStore.getAll()
    evidence.chainVerification = verifyChain(allEntries)

    // Export audit log
    const exported = await exportAuditLog(auditStore, {
      tenantId: 'tenant_abr',
      format: 'json',
    })
    evidence.auditExport = {
      entryCount: exported.entryCount,
      entries: exported.entries,
      data: exported.data,
    }
  })

  // ── Denied path assertions ──────────────────────────────────────────────

  it('viewer attempt is denied at 403', () => {
    expect(evidence.denyResult).not.toBeNull()
    expect(evidence.denyResult!.success).toBe(false)
    expect(evidence.denyResult!.status).toBe(403)
  })

  it('deny decision is explicit with reason', () => {
    expect(evidence.denyDecision).not.toBeNull()
    expect(evidence.denyDecision!.outcome).toBe('deny')
    expect(evidence.denyDecision!.reason).toBeTruthy()
  })

  // ── Allowed path assertions ─────────────────────────────────────────────

  it('compliance officer attempt succeeds at 200', () => {
    expect(evidence.allowResult).not.toBeNull()
    expect(evidence.allowResult!.success).toBe(true)
    expect(evidence.allowResult!.status).toBe(200)
  })

  it('allow decision matches compliance-officer rule', () => {
    expect(evidence.allowDecision).not.toBeNull()
    expect(evidence.allowDecision!.outcome).toBe('allow')
    expect(evidence.allowDecision!.matchedRuleId).toBe('allow-compliance-approve')
  })

  // ── Cross-path assertions ───────────────────────────────────────────────

  it('both decisions are logged in decision store', () => {
    const all = decisionStore.getAll()
    expect(all.length).toBeGreaterThanOrEqual(2)
    const outcomes = all.map(d => d.outcome)
    expect(outcomes).toContain('deny')
    expect(outcomes).toContain('allow')
  })

  it('audit chain is valid across deny + allow entries', () => {
    expect(evidence.chainVerification).not.toBeNull()
    expect(evidence.chainVerification!.valid).toBe(true)
    expect(evidence.chainVerification!.entriesChecked).toBeGreaterThanOrEqual(2)
  })

  it('audit export contains both events', () => {
    expect(evidence.auditExport).not.toBeNull()
    expect(evidence.auditExport!.entryCount).toBeGreaterThanOrEqual(2)
  })

  it('audit export is parseable JSON', () => {
    const parsed = JSON.parse(evidence.auditExport!.data)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThanOrEqual(2)
  })

  it('writes proof artifacts', () => {
    const paths = writeProofBundle(SCENARIO, {
      summary: buildSummary(SCENARIO, {
        trace_id: evidence.traceId,
        actor_id: 'user_junior_001 → user_compliance_001',
        tenant_id: 'tenant_abr',
        governance_decision_id: 'allow-compliance-approve',
        audit_chain_valid: evidence.chainVerification!.valid,
      }),
      trace: {
        traceId: evidence.traceId,
        scenario: SCENARIO,
        timestamp: new Date().toISOString(),
      },
      request: {
        denyAttempt: {
          action: 'approve',
          resourceType: 'financial-claim',
          actor: { id: 'user_junior_001', roles: ['viewer'] },
        },
        allowAttempt: {
          action: 'approve',
          resourceType: 'financial-claim',
          actor: { id: 'user_compliance_001', roles: ['compliance-officer'] },
        },
      },
      response: {
        denyResult: evidence.denyResult,
        allowResult: evidence.allowResult,
      },
      governance: {
        policySetId: COMPLIANCE_POLICY.id,
        denyDecision: {
          outcome: evidence.denyDecision!.outcome,
          matchedRuleId: evidence.denyDecision!.matchedRuleId,
          reason: evidence.denyDecision!.reason,
        },
        allowDecision: {
          outcome: evidence.allowDecision!.outcome,
          matchedRuleId: evidence.allowDecision!.matchedRuleId,
          reason: evidence.allowDecision!.reason,
        },
      },
      audit: evidence.auditExport!.entries,
      'audit-chain': evidence.chainVerification,
    })

    expect(paths.length).toBe(7)
  })
})
