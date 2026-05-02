/**
 * Control Plane API — Governance Actions
 *
 * POST /api/control-plane/governance/actions        → create draft action
 * GET  /api/control-plane/governance/actions?orgId= → list actions for org
 * POST /api/control-plane/governance/actions/submit → submit for approval
 * POST /api/control-plane/governance/actions/decide → decide on approval
 * POST /api/control-plane/governance/actions/execute → execute approved action
 *
 * All governance mutations across the platform must flow through these endpoints.
 * Only the Control Plane evaluates policy and advances governance state.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireApiAuth, handleAuthError, parseUuidParam, RequestValidationError } from '@/lib/api-auth'
import {
  createGovernanceAction,
  submitGovernanceAction,
  decideApproval,
  executeGovernanceAction,
} from '@/server/governance/state-machine'
import { platformDb } from '@nzila/db/platform'
import { governanceActions } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { createLogger } from '@nzila/os-core'
import { enforceDecision } from '@nzila/decision-core'
import { createNarProofAdapter, getNarSigningSecret } from '@nzila/nar'
import { auditRecords } from '@nzila/db/schema'
import { desc } from 'drizzle-orm'

const logger = createLogger('control-plane:api:governance:actions')

const narProofAdapter = createNarProofAdapter({
  keyId: process.env.NAR_SIGNING_KEY_ID,
  getPreviousHash: async (organizationId) => {
    const rows = await platformDb
      .select({ hash: auditRecords.narHash })
      .from(auditRecords)
      .where(eq(auditRecords.organizationId, organizationId))
      .orderBy(desc(auditRecords.createdAt))
      .limit(1)
    return rows[0]?.hash
  },
  persistRecord: async (record) => {
    await platformDb.insert(auditRecords).values({
      id: record.id,
      decisionRecordId: record.decisionRecordId,
      organizationId: record.organizationId,
      decisionType: record.decisionType,
      actionType: record.actionType,
      actorId: record.actorId,
      actorType: record.actorType,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      policyId: record.policyId,
      policyVersion: record.policyVersion,
      inputHash: record.inputHash,
      outcomeHash: record.outcomeHash,
      payload: record.payload,
      narHash: record.seal.hash,
      narSignature: record.seal.signature,
      previousHash: record.seal.previousHash,
      keyId: record.seal.keyId,
      storageType: record.storage?.type,
      storageUri: record.storage?.uri,
      immutable: record.storage?.immutable,
      retentionUntil: record.storage?.retentionUntil ? new Date(record.storage.retentionUntil) : null,
      createdAt: new Date(record.createdAt),
    })
    return { auditRecordId: record.id }
  },
  getSigningSecret: getNarSigningSecret,
})

// ── Request schemas ──────────────────────────────────────────────────────────

const CreateActionSchema = z.object({
  operation: z.literal('create'),
  orgId: z.string().uuid(),
  actionType: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  createdBy: z.string().min(1),
})

const SubmitActionSchema = z.object({
  operation: z.literal('submit'),
  actionId: z.string().uuid(),
  orgId: z.string().uuid(),
  submittedBy: z.string().min(1),
  context: z
    .object({
      totalSharesOutstanding: z.number().optional(),
      quantity: z.number().optional(),
      amount: z.number().optional(),
      transferRestricted: z.boolean().optional(),
      rofrApplies: z.boolean().optional(),
    })
    .optional(),
})

const DecideApprovalSchema = z.object({
  operation: z.literal('decide'),
  actionId: z.string().uuid(),
  orgId: z.string().uuid(),
  approvalId: z.string().uuid(),
  decidedBy: z.string().min(1),
  decision: z.enum(['approved', 'rejected']),
  notes: z.string().optional(),
})

const ExecuteActionSchema = z.object({
  operation: z.literal('execute'),
  actionId: z.string().uuid(),
  orgId: z.string().uuid(),
  executedBy: z.string().min(1),
})

const GovernanceActionRequestSchema = z.discriminatedUnion('operation', [
  CreateActionSchema,
  SubmitActionSchema,
  DecideApprovalSchema,
  ExecuteActionSchema,
])

// ── POST — advance governance state machine ──────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    await requireApiAuth(request)

    const body = await request.json().catch(() => ({}))
    const parsed = GovernanceActionRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const req = parsed.data

    const actorId = req.operation === 'create'
      ? req.createdBy
      : req.operation === 'submit'
        ? req.submittedBy
        : req.operation === 'decide'
          ? req.decidedBy
          : req.executedBy

    const preflightDecision = await enforceDecision({
      decisionType: 'platform.governance.action.executed',
      organizationId: req.orgId,
      resourceId: req.operation === 'create' ? 'pending' : req.actionId,
      actor: {
        id: actorId,
        type: 'api',
        role: 'control-plane',
        authorityScope: ['governance:action:execute'],
      },
      authorityScope: ['governance:action:execute'],
      input: {
        operation: req.operation,
        orgId: req.orgId,
      },
      policy: {
        id: 'platform.governance.action',
        version: '1.0.0',
        domain: 'platform',
      },
      actionType: `governance:${req.operation}`,
      proofAdapter: narProofAdapter,
      emitAuditPayload: true,
    })

    if (!preflightDecision.allowed) {
      return NextResponse.json(
        { ok: false, error: { code: 'DECISION_VALIDATION_FAILED', message: 'Decision validation failed' }, decision: preflightDecision.decision },
        { status: 422 },
      )
    }

    switch (req.operation) {
      case 'create': {
        const result = await createGovernanceAction({
          orgId: req.orgId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          actionType: req.actionType as any,
          payload: req.payload,
          createdBy: req.createdBy,
        })
        if (!result.ok) {
          return NextResponse.json({ ok: false, error: result.error }, { status: 422 })
        }
        const recordedDecision = await enforceDecision({
          decisionType: 'platform.governance.action.executed',
          organizationId: req.orgId,
          resourceId: result.data.id,
          actor: {
            id: req.createdBy,
            type: 'api',
            role: 'control-plane',
            authorityScope: ['governance:action:execute'],
          },
          authorityScope: ['governance:action:execute'],
          input: { operation: req.operation, orgId: req.orgId },
          policy: { id: 'platform.governance.action', version: '1.0.0', domain: 'platform' },
          actionType: 'governance:create',
          proofAdapter: narProofAdapter,
          emitAuditPayload: true,
        })
        return NextResponse.json({ ok: true, data: result.data, decision: recordedDecision.decision }, { status: 201 })
      }

      case 'submit': {
        const result = await submitGovernanceAction({
          actionId: req.actionId,
          orgId: req.orgId,
          submittedBy: req.submittedBy,
          context: req.context,
        })
        if (!result.ok) {
          const status = result.error.code === 'POLICY_BLOCKED' ? 422 : result.error.code === 'NOT_FOUND' ? 404 : 409
          return NextResponse.json({ ok: false, error: result.error }, { status })
        }
        const recordedDecision = await enforceDecision({
          decisionType: 'platform.governance.action.executed',
          organizationId: req.orgId,
          resourceId: req.actionId,
          actor: { id: req.submittedBy, type: 'api', role: 'control-plane', authorityScope: ['governance:action:execute'] },
          authorityScope: ['governance:action:execute'],
          input: { operation: req.operation, orgId: req.orgId },
          policy: { id: 'platform.governance.action', version: '1.0.0', domain: 'platform' },
          actionType: 'governance:submit',
          proofAdapter: narProofAdapter,
          emitAuditPayload: true,
        })
        return NextResponse.json({ ok: true, data: result.data, decision: recordedDecision.decision })
      }

      case 'decide': {
        const result = await decideApproval({
          actionId: req.actionId,
          orgId: req.orgId,
          approvalId: req.approvalId,
          decidedBy: req.decidedBy,
          decision: req.decision,
          notes: req.notes,
        })
        if (!result.ok) {
          const status = result.error.code === 'NOT_FOUND' ? 404 : 409
          return NextResponse.json({ ok: false, error: result.error }, { status })
        }
        const recordedDecision = await enforceDecision({
          decisionType: 'platform.governance.action.executed',
          organizationId: req.orgId,
          resourceId: req.actionId,
          actor: { id: req.decidedBy, type: 'api', role: 'control-plane', authorityScope: ['governance:action:execute'] },
          authorityScope: ['governance:action:execute'],
          input: { operation: req.operation, orgId: req.orgId },
          policy: { id: 'platform.governance.action', version: '1.0.0', domain: 'platform' },
          actionType: 'governance:decide',
          proofAdapter: narProofAdapter,
          emitAuditPayload: true,
        })
        return NextResponse.json({ ok: true, data: result.data, decision: recordedDecision.decision })
      }

      case 'execute': {
        const result = await executeGovernanceAction({
          actionId: req.actionId,
          orgId: req.orgId,
          executedBy: req.executedBy,
        })
        if (!result.ok) {
          const status =
            result.error.code === 'NOT_FOUND' ? 404
            : result.error.code === 'INVALID_STATE' ? 409
            : result.error.code === 'APPROVALS_INCOMPLETE' ? 422
            : 500
          return NextResponse.json({ ok: false, error: result.error }, { status })
        }
        const recordedDecision = await enforceDecision({
          decisionType: 'platform.governance.action.executed',
          organizationId: req.orgId,
          resourceId: req.actionId,
          actor: { id: req.executedBy, type: 'api', role: 'control-plane', authorityScope: ['governance:action:execute'] },
          authorityScope: ['governance:action:execute'],
          input: { operation: req.operation, orgId: req.orgId },
          policy: { id: 'platform.governance.action', version: '1.0.0', domain: 'platform' },
          actionType: 'governance:execute',
          proofAdapter: narProofAdapter,
          emitAuditPayload: true,
        })
        return NextResponse.json({ ok: true, data: result.data, decision: recordedDecision.decision })
      }

      default: {
        return NextResponse.json({ ok: false, error: 'Unknown operation' }, { status: 400 })
      }
    }
  } catch (error) {
    if (error instanceof RequestValidationError) {
      logger.warn('Governance action validation failed', {
        details: error.details,
      })
    } else {
      logger.error('Governance action API error', {
        errorName: error instanceof Error ? error.name : 'unknown_error',
        message: error instanceof Error ? error.message : String(error),
      })
    }
    return handleAuthError(error)
  }
}

// ── GET — list governance actions for an org ─────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    await requireApiAuth(request)

    const rawOrgId = request.nextUrl.searchParams.get('orgId')
    if (!rawOrgId) {
      return NextResponse.json({ ok: false, error: 'orgId query param required' }, { status: 400 })
    }
    const orgId = parseUuidParam(rawOrgId, 'orgId')

    const actions = await platformDb
      .select()
      .from(governanceActions)
      .where(eq(governanceActions.orgId, orgId))
      .orderBy(governanceActions.createdAt)

    return NextResponse.json({ ok: true, data: actions })
  } catch (error) {
    if (error instanceof RequestValidationError) {
      logger.warn('Governance action list validation failed', {
        details: error.details,
      })
    }
    return handleAuthError(error)
  }
}
