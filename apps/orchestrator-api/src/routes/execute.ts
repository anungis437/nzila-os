/**
 * Orchestrator API — Workflow Execution Routes
 *
 * POST /execute            — Submit a workflow execution (requires CP authorization)
 * GET  /execute/:runId     — Get run status
 * POST /execute/:runId/cancel — Cancel a running workflow
 * GET  /execute            — List runs (filterable by orgId, workflowId, status)
 *
 * All executions must carry a Control Plane authorization decision ID.
 * Policy-deaf: this engine never evaluates policy.
 */
import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  executeWorkflow,
  cancelWorkflowRun,
  retryWorkflowRun,
  getWorkflowRun,
  listWorkflowRuns,
} from '../execution-engine.js'
import { WorkflowTriggerRequestSchema, ExecutionStatusSchema } from '@nzila/platform-contracts/control-system'
import { createLogger } from '@nzila/os-core'
import { PlaybookName } from '../contract.js'
import {
  evaluateDomainPolicies,
  evaluatePoliciesWithResolution,
  toPolicyContext,
  type DomainName,
  type PolicyDecisionLevel,
} from '@nzila/policies'
import { getOperatingEvidenceService } from '@nzila/operating-evidence'

const logger = createLogger('orchestrator:routes:execute')

const ExecuteBodySchema = WorkflowTriggerRequestSchema.extend({
  workflowId: PlaybookName,
  /** Decision ID from Control Plane authorization (required for live execution) */
  authorizationDecisionId: z.string().uuid().optional(),
})

const ListQuerySchema = z.object({
  orgId: z.string().uuid().optional(),
  workflowId: z.string().optional(),
  status: ExecutionStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

function inferDomain(workflowId: string): DomainName {
  const value = workflowId.toLowerCase()
  if (value.includes('labour') || value.includes('payroll') || value.includes('pension')) return 'labour'
  if (value.includes('legal') || value.includes('compliance') || value.includes('contract')) return 'legal'
  if (value.includes('media') || value.includes('rights') || value.includes('content')) return 'media-rights'
  return 'commerce'
}

function buildEnforcementRequirements(level: PolicyDecisionLevel) {
  return {
    requiresConfirmationText: level === 'CHALLENGE',
    requiresJustification: level === 'CHALLENGE',
    requiresApproval: level === 'CHALLENGE',
    explicitOverrideHeader: level === 'BLOCK' ? 'x-policy-override-explicit' : null,
    explicitOverrideAcceptedValue: level === 'BLOCK' ? 'true' : null,
  }
}

export async function executeRoutes(app: FastifyInstance) {
  /**
   * POST /execute — Submit a workflow for execution.
   *
   * Body must conform to WorkflowTriggerRequest + authorizationDecisionId.
   * If dryRun=true, no actual execution occurs.
   * If dryRun=false, authorizationDecisionId is required.
   */
  app.post('/', async (req, reply) => {
    const orgHeader = getHeader(req.headers['x-org-id'])
    const actorHeader = getHeader(req.headers['x-actor-id'])
    if (!orgHeader || !actorHeader) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: 'MISSING_CONTEXT_HEADERS',
          message: 'x-org-id and x-actor-id headers are required for execution requests',
        },
      })
    }

    const parsed = ExecuteBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Invalid workflow execution request',
          details: parsed.error.flatten(),
        },
      })
    }

    const body = parsed.data
    const requestedPolicyVersion = getHeader(req.headers['x-policy-version']) ?? process.env.NZILA_POLICY_VERSION ?? 'v1'
    const actorRole = getHeader(req.headers['x-actor-role']) ?? 'ops'
    const domainHeader = getHeader(req.headers['x-policy-domain'])
    const overrideReason = getHeader(req.headers['x-policy-override-reason'])
    const ticketRef = getHeader(req.headers['x-policy-ticket-ref'])
    const domain = (domainHeader as DomainName | null) ?? inferDomain(body.workflowId)
    const explicitOverrideHeader = getHeader(req.headers['x-policy-override-explicit'])
    const confirmationText = getHeader(req.headers['x-policy-confirmation'])
    const justification = getHeader(req.headers['x-policy-justification'])

    const domainEval = evaluateDomainPolicies({
      orgId: body.orgId,
      actorId: body.initiatedBy.actorId,
      actorRole,
      domain,
      action: `execute:${body.workflowId}`,
      resource: `workflow:${body.workflowId}`,
      payload: body.payload as Record<string, unknown> | undefined,
      environment: (process.env.NODE_ENV === 'development' ? 'dev' : process.env.NODE_ENV === 'test' ? 'staging' : 'production'),
      overrideReason: overrideReason ?? undefined,
      ticketRef: ticketRef ?? undefined,
    })

    const contextual = evaluatePoliciesWithResolution(
      toPolicyContext({
        orgId: body.orgId,
        actorId: body.initiatedBy.actorId,
        actorRole,
        domain,
        action: `execute:${body.workflowId}`,
        resource: `workflow:${body.workflowId}`,
        payload: {
          ...(body.payload as Record<string, unknown> | undefined),
          sensitivity: String((body.payload as Record<string, unknown> | undefined)?.['sensitivity'] ?? 'high'),
          app: 'orchestrator-api',
          anomalyScore: Number((body.payload as Record<string, unknown> | undefined)?.['anomalyScore'] ?? 0),
          previousActions: Array.isArray((body.payload as Record<string, unknown> | undefined)?.['previousActions'])
            ? ((body.payload as Record<string, unknown> | undefined)?.['previousActions'] as string[])
            : [],
          overrideHistory: Array.isArray((body.payload as Record<string, unknown> | undefined)?.['overrideHistory'])
            ? ((body.payload as Record<string, unknown> | undefined)?.['overrideHistory'] as unknown[])
            : [],
          sessionId: String((body.payload as Record<string, unknown> | undefined)?.['sessionId'] ?? body.requestId),
        },
        environment:
          process.env.NODE_ENV === 'development'
            ? 'dev'
            : process.env.NODE_ENV === 'test'
              ? 'staging'
              : 'production',
        policyVersion: requestedPolicyVersion,
        overrideReason: overrideReason ?? undefined,
        ticketRef: ticketRef ?? undefined,
      }),
    )

    let finalDecision: PolicyDecisionLevel = contextual.resolution.finalDecision.level
    if (domainEval.blocked) {
      finalDecision = 'BLOCK'
    } else if (domainEval.requiresOverride && finalDecision !== 'BLOCK') {
      finalDecision = 'CHALLENGE'
    }

    const enforcementRequirements = buildEnforcementRequirements(finalDecision)
    const expectedConfirmation = `CONFIRM execute:${body.workflowId} workflow:${body.workflowId}`

    if (finalDecision === 'BLOCK' && explicitOverrideHeader !== 'true') {
      await getOperatingEvidenceService().record({
        app: 'orchestrator-api',
        domain,
        type: 'policy_violation',
        policyVersion: requestedPolicyVersion,
        severity: 'critical',
        payload: {
          workflowId: body.workflowId,
          orgId: body.orgId,
          actorId: body.initiatedBy.actorId,
          finalDecision,
          details: contextual.resolution,
        },
      })

      return reply.status(403).send({
        ok: false,
        error: {
          code: 'POLICY_BLOCKED',
          message: 'Execution blocked by policy. Explicit override header required.',
          details: {
            finalDecision,
            enforcementRequirements,
            trace: contextual.resolution.explanationTrace,
          },
        },
      })
    }

    if (finalDecision === 'CHALLENGE') {
      if (confirmationText !== expectedConfirmation || !justification) {
        return reply.status(409).send({
          ok: false,
          error: {
            code: 'POLICY_CHALLENGE_REQUIRED',
            message: 'Challenge decision requires confirmation and justification.',
            details: {
              expectedConfirmation,
              enforcementRequirements,
              trace: contextual.resolution.explanationTrace,
            },
          },
        })
      }
    }

    if (domainEval.requiresOverride && (!overrideReason || !ticketRef) && finalDecision !== 'CHALLENGE') {
      return reply.status(409).send({
        ok: false,
        error: {
          code: 'DOMAIN_OVERRIDE_REQUIRED',
          message: 'Override reason and ticket reference are required for governed override paths',
          details: domainEval,
        },
      })
    }
    if (orgHeader !== body.orgId) {
      return reply.status(403).send({
        ok: false,
        error: {
          code: 'ORG_SCOPE_MISMATCH',
          message: 'x-org-id header must match body.orgId',
        },
      })
    }
    if (actorHeader !== body.initiatedBy.actorId) {
      return reply.status(403).send({
        ok: false,
        error: {
          code: 'ACTOR_SCOPE_MISMATCH',
          message: 'x-actor-id header must match initiatedBy.actorId',
        },
      })
    }

    const decisionHeader = getHeader(req.headers['x-authorization-decision-id'])
    if (decisionHeader && body.authorizationDecisionId && decisionHeader !== body.authorizationDecisionId) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: 'DECISION_HEADER_MISMATCH',
          message: 'x-authorization-decision-id must match body.authorizationDecisionId',
        },
      })
    }

    if (!(body.executionContext?.dryRun ?? false) && !body.authorizationDecisionId && !decisionHeader) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: 'AUTHORIZATION_REQUIRED',
          message: 'authorizationDecisionId is required for non-dry-run execution',
        },
      })
    }

    const correlationId = (req.headers['x-correlation-id'] as string | undefined)
      ?? body.correlationEnvelope?.correlationId
      ?? randomUUID()

    logger.info('Execution request received', {
      workflowId: body.workflowId,
      orgId: body.orgId,
      requestId: body.requestId,
      initiatedBy: body.initiatedBy.actorId,
      dryRun: body.executionContext?.dryRun,
      correlationId,
      domain,
      domainRequiresOverride: domainEval.requiresOverride,
      policyDecision: finalDecision,
    })

    await getOperatingEvidenceService().record({
      app: 'orchestrator-api',
      domain,
      type: finalDecision === 'CHALLENGE' ? 'override' : 'request',
      policyVersion: requestedPolicyVersion,
      severity: finalDecision === 'WARN' ? 'high' : finalDecision === 'CHALLENGE' ? 'high' : 'low',
      payload: {
        workflowId: body.workflowId,
        dryRun: body.executionContext?.dryRun ?? false,
        actorId: body.initiatedBy.actorId,
        overrideApplied: Boolean(overrideReason && ticketRef),
        finalDecision,
        trace: contextual.resolution.explanationTrace,
      },
    })

    logger.info('Policy decision trace attached', {
      workflowId: body.workflowId,
      finalDecision,
      traceCount: contextual.resolution.explanationTrace.length,
    })

    const result = await executeWorkflow({
      ...body,
      authorizationDecisionId: body.authorizationDecisionId ?? decisionHeader ?? undefined,
      correlationEnvelope: {
        ...(body.correlationEnvelope ?? {}),
        requestId: body.requestId,
        correlationId,
        initiatedAt: new Date().toISOString(),
      },
    })

    const httpStatus = result.status === 'failed' || result.status === 'dead_lettered' ? 500 : 202
    return reply.status(result.idempotent ? 200 : httpStatus).send({
      ok: true,
      data: {
        ...result,
        policy: {
          domain,
          policyVersion: requestedPolicyVersion,
          requiresOverride: domainEval.requiresOverride,
          overrideApplied: Boolean(overrideReason && ticketRef),
          findings: domainEval.findings,
          finalDecision,
          trace: contextual.resolution.explanationTrace,
          enforcementRequirements,
        },
      },
    })
  })

  /**
   * GET /execute/:runId — Get a specific run's status and metadata.
   */
  app.get<{ Params: { runId: string } }>('/:runId', async (req, reply) => {
    const run = await getWorkflowRun(req.params.runId)
    if (!run) {
      return reply.status(404).send({
        ok: false,
        error: { code: 'RUN_NOT_FOUND', message: `Run ${req.params.runId} not found` },
      })
    }
    return { ok: true, data: run }
  })

  /**
   * POST /execute/:runId/retry — Retry a failed workflow run.
   */
  app.post<{ Params: { runId: string }; Body: { requestedBy?: string } }>(
    '/:runId/retry',
    async (req, reply) => {
      const run = await getWorkflowRun(req.params.runId)
      if (!run) {
        return reply.status(404).send({
          ok: false,
          error: { code: 'RUN_NOT_FOUND', message: `Run ${req.params.runId} not found` },
        })
      }

      const orgHeader = getHeader(req.headers['x-org-id'])
      if (!orgHeader || orgHeader !== run.orgId) {
        return reply.status(403).send({
          ok: false,
          error: {
            code: 'ORG_SCOPE_MISMATCH',
            message: 'x-org-id header must match the run org scope for retry',
          },
        })
      }

      const requestedBy = req.body?.requestedBy ?? getHeader(req.headers['x-actor-id']) ?? 'operator'
      const retried = await retryWorkflowRun(req.params.runId, requestedBy)
      if (!retried.retried) {
        return reply.status(409).send({
          ok: false,
          error: { code: 'CANNOT_RETRY', message: retried.reason ?? 'Cannot retry this run' },
        })
      }

      return { ok: true, data: { retried: true, run: retried.run } }
    },
  )

  /**
   * POST /execute/:runId/cancel — Cancel a workflow run.
   */
  app.post<{ Params: { runId: string }; Body: { cancelledBy?: string } }>(
    '/:runId/cancel',
    async (req, reply) => {
      const run = await getWorkflowRun(req.params.runId)
      if (!run) {
        return reply.status(404).send({
          ok: false,
          error: { code: 'RUN_NOT_FOUND', message: `Run ${req.params.runId} not found` },
        })
      }

      const orgHeader = getHeader(req.headers['x-org-id'])
      if (!orgHeader || orgHeader !== run.orgId) {
        return reply.status(403).send({
          ok: false,
          error: {
            code: 'ORG_SCOPE_MISMATCH',
            message: 'x-org-id header must match the run org scope for cancellation',
          },
        })
      }

      const cancelledBy = req.body?.cancelledBy ?? 'operator'
      const result = await cancelWorkflowRun(req.params.runId, cancelledBy)
      if (!result.cancelled) {
        return reply.status(409).send({
          ok: false,
          error: { code: 'CANNOT_CANCEL', message: result.reason ?? 'Cannot cancel this run' },
        })
      }
      return { ok: true, data: { cancelled: true, runId: req.params.runId } }
    },
  )

  /**
   * GET /execute — List workflow runs with optional filters.
   */
  app.get('/', async (req, reply) => {
    const parsed = ListQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: { code: 'INVALID_QUERY', message: 'Invalid query parameters' },
      })
    }

    const { orgId, workflowId, status, limit } = parsed.data
    const runs = await listWorkflowRuns({ orgId, workflowId, status, limit })
    return { ok: true, data: runs, count: runs.length }
  })
}

function getHeader(value: string | string[] | undefined): string | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}
