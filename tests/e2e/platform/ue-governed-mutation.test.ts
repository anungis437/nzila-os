/**
 * E2E Proof Test: UE Governed Mutation
 *
 * Executes a full governed mutation through the enforcement pipeline and
 * verifies every control layer fires correctly. Writes machine-verifiable
 * proof artifacts.
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
  GENESIS_HASH,
} from '@nzila/audit'
import {
  generateTraceId,
} from '@nzila/observability'
import { writeProofBundle, buildSummary } from '../../../scripts/proof/proof-artifacts'

const SCENARIO = 'ue-governed-mutation'

// ── Fixtures ────────────────────────────────────────────────────────────────

const POLICY_SET: PolicySet = {
  id: 'ue-financial-policy',
  name: 'Union Eyes Financial Policy',
  defaultEffect: 'deny',
  rules: [
    {
      id: 'allow-admin-all',
      description: 'Admin can perform any action',
      resource: '*',
      actions: ['*'],
      effect: 'allow',
      roles: ['admin'],
      priority: 100,
    },
    {
      id: 'allow-member-read',
      description: 'Members can read financial records',
      resource: 'financial-record',
      actions: ['read'],
      effect: 'allow',
      roles: ['member'],
      priority: 50,
    },
  ],
}

// ── Collected evidence ──────────────────────────────────────────────────────

const evidence = {
  traceId: '',
  actorId: '',
  tenantId: '',
  governanceDecision: null as ReturnType<typeof canAccess> | null,
  auditEntries: [] as Array<Record<string, unknown>>,
  rateLimitResult: null as { allowed: boolean; remaining: number; resetAt: number } | null,
}

describe('UE Governed Mutation — Full Pipeline Proof', () => {
  const auditStore = new InMemoryAuditStore()
  const auditEngine = new AuditEngine(auditStore)
  const decisionStore = new InMemoryDecisionStore()
  const decisionLogger = new DecisionLogger(decisionStore, POLICY_SET.id)

  let pipelineResult: { success: boolean; status: number; body?: unknown }

  beforeAll(async () => {
    const traceId = generateTraceId()
    evidence.traceId = traceId

    const ctx = createContext({
      action: 'update',
      resourceType: 'financial-record',
      route: '/api/financial-records/fr-001',
      headers: {
        authorization: 'Bearer tok_admin_001',
        'x-tenant-id': 'tenant_ue_main',
      },
      body: JSON.stringify({ status: 'approved', amount: 15000 }),
    })
    // Override traceId for determinism
    ;(ctx as { traceId: string }).traceId = traceId

    const handler = createEnforcedHandler(
      [
        traceLayer(),
        authLayer({
          extractActor: async (headers) => {
            const token = headers.authorization?.replace('Bearer ', '')
            if (token !== 'tok_admin_001') return null
            const actor = { tenantId: 'tenant_ue_main', actorId: 'user_admin_001', roles: ['admin'] }
            evidence.actorId = actor.actorId
            evidence.tenantId = actor.tenantId
            return actor
          },
        }),
        rateLimitLayer({
          check: async (tenantId, route) => {
            const result = { allowed: true, remaining: 99, resetAt: Date.now() + 60000 }
            evidence.rateLimitResult = result
            return result
          },
        }),
        governanceLayer({
          evaluate: async (evalCtx) => {
            const decision = canAccess(POLICY_SET, {
              actor: { id: evalCtx.actorId!, tenantId: evalCtx.tenantId!, roles: evalCtx.roles ?? [] },
              resource: { type: evalCtx.resourceType },
              action: evalCtx.action,
            })
            evidence.governanceDecision = decision
            decisionLogger.log(decision)
            return { outcome: decision.outcome, reason: decision.reason }
          },
        }),
        auditLayer({
          record: async (entry) => {
            const auditEntry = await auditEngine.record({
              actorId: entry.actorId ?? 'unknown',
              tenantId: entry.tenantId ?? 'unknown',
              action: entry.action,
              resource: entry.resource,
              resourceId: entry.resourceId,
              payload: {
                status: entry.status,
                durationMs: entry.durationMs,
              },
              traceId: entry.traceId,
            })
            evidence.auditEntries.push(auditEntry as unknown as Record<string, unknown>)
          },
        }),
      ],
      async (handlerCtx) => ({
        success: true,
        status: 200,
        body: { mutationApplied: true, recordId: 'fr-001' },
      }),
    )

    pipelineResult = await handler(ctx)
  })

  it('pipeline returns success', () => {
    expect(pipelineResult.success).toBe(true)
    expect(pipelineResult.status).toBe(200)
  })

  it('trace_id is present', () => {
    expect(evidence.traceId).toBeTruthy()
    expect(evidence.traceId.length).toBeGreaterThan(0)
  })

  it('actor resolved correctly', () => {
    expect(evidence.actorId).toBe('user_admin_001')
  })

  it('tenant resolved correctly', () => {
    expect(evidence.tenantId).toBe('tenant_ue_main')
  })

  it('governance decision is allow', () => {
    expect(evidence.governanceDecision).not.toBeNull()
    expect(evidence.governanceDecision!.outcome).toBe('allow')
    expect(evidence.governanceDecision!.matchedRuleId).toBe('allow-admin-all')
  })

  it('rate limit checked and allowed', () => {
    expect(evidence.rateLimitResult).not.toBeNull()
    expect(evidence.rateLimitResult!.allowed).toBe(true)
    expect(evidence.rateLimitResult!.remaining).toBe(99)
  })

  it('audit entry recorded', () => {
    expect(evidence.auditEntries.length).toBeGreaterThanOrEqual(1)
    const entry = evidence.auditEntries[0]
    expect(entry).toHaveProperty('hash')
    expect(entry).toHaveProperty('prevHash')
  })

  it('audit chain is valid from genesis', () => {
    const chain = verifyChain(evidence.auditEntries as any)
    expect(chain.valid).toBe(true)
    expect(chain.entriesChecked).toBe(evidence.auditEntries.length)
  })

  it('audit entry links to genesis hash', () => {
    const first = evidence.auditEntries[0]
    expect(first.prevHash).toBe(GENESIS_HASH)
  })

  it('writes proof artifacts', () => {
    const govDecision = evidence.governanceDecision!
    const chain = verifyChain(evidence.auditEntries as any)

    const paths = writeProofBundle(SCENARIO, {
      summary: buildSummary(SCENARIO, {
        trace_id: evidence.traceId,
        actor_id: evidence.actorId,
        tenant_id: evidence.tenantId,
        governance_decision_id: govDecision.matchedRuleId,
        audit_event_id: (evidence.auditEntries[0] as any)?.id ?? null,
        audit_chain_valid: chain.valid,
      }),
      trace: {
        traceId: evidence.traceId,
        startedAt: new Date().toISOString(),
      },
      request: {
        action: 'update',
        resourceType: 'financial-record',
        route: '/api/financial-records/fr-001',
        headers: { authorization: 'Bearer tok_admin_001', 'x-tenant-id': 'tenant_ue_main' },
        body: { status: 'approved', amount: 15000 },
      },
      response: pipelineResult,
      governance: {
        policySetId: POLICY_SET.id,
        outcome: govDecision.outcome,
        matchedRuleId: govDecision.matchedRuleId,
        reason: govDecision.reason,
        evaluatedAt: govDecision.evaluatedAt,
        durationMs: govDecision.durationMs,
      },
      audit: evidence.auditEntries,
      'audit-chain': chain,
    })

    expect(paths.length).toBe(7)
  })
})
