/**
 * Union Eyes — Orchestrator Dispatch Client
 *
 * Submits domain workflow jobs to the Nzila Orchestrator API.
 * All dispatches are idempotent: the orchestrator deduplicates on
 * (orgId + workflowId + idempotencyKey). Callers may safely retry.
 *
 * Supported playbooks:
 *  - evidence_seal    — seal and hash-chain a case evidence bundle
 *  - sla_escalation   — notify relevant parties of an SLA breach
 */

import { randomUUID } from 'crypto'
import { logger } from '@/lib/logger'

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_API_URL ?? 'http://localhost:4000'
const ORCHESTRATOR_API_KEY = process.env.ORCHESTRATOR_API_KEY ?? ''

export type OrchestratorPlaybook = 'evidence_seal' | 'sla_escalation'

export interface OrchestratorDispatchResult {
  ok: boolean
  runId?: string
  status?: string
  deduplicated?: boolean
  error?: string
}

interface DispatchOptions {
  orgId: string
  actorId: string
  playbook: OrchestratorPlaybook
  idempotencyKey: string
  correlationId?: string
  payload?: Record<string, unknown>
  dryRun?: boolean
}

/**
 * Dispatch a domain workflow to the orchestrator.
 * Never throws — returns { ok: false, error } on failure so callers can
 * decide whether to surface or swallow the error.
 */
export async function dispatchOrchestratorWorkflow(
  opts: DispatchOptions,
): Promise<OrchestratorDispatchResult> {
  const correlationId = opts.correlationId ?? randomUUID()
  const requestId = randomUUID()

  const body = {
    workflowId: opts.playbook,
    idempotencyKey: opts.idempotencyKey,
    dryRun: opts.dryRun ?? false,
    requestId,
    executionContext: {
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      triggeredBy: 'union-eyes',
      priority: 'normal' as const,
    },
    correlationEnvelope: {
      requestId,
      correlationId,
      workflowId: opts.playbook,
      orgId: opts.orgId,
      actorId: opts.actorId,
      initiatedAt: new Date().toISOString(),
    },
    payload: opts.payload ?? {},
  }

  try {
    const res = await fetch(`${ORCHESTRATOR_URL}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-id': opts.orgId,
        'x-actor-id': opts.actorId,
        'x-api-key': ORCHESTRATOR_API_KEY,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    })

    const json = (await res.json()) as {
      ok: boolean
      runId?: string
      status?: string
      deduplicated?: boolean
      error?: { code: string; message: string }
    }

    if (!json.ok) {
      logger.warn('[orchestrator-dispatch] dispatch rejected', { playbook: opts.playbook, error: json.error })
      return { ok: false, error: json.error?.message ?? 'orchestrator rejected dispatch' }
    }

    logger.info('[orchestrator-dispatch] dispatched', { playbook: opts.playbook, runId: json.runId, deduplicated: json.deduplicated })
    return { ok: true, runId: json.runId, status: json.status, deduplicated: json.deduplicated }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error('[orchestrator-dispatch] dispatch failed', { playbook: opts.playbook, err: message })
    return { ok: false, error: message }
  }
}

// --- Domain helpers ----------------------------------------------------------

/**
 * Seal the evidence bundle for a resolved or closed case.
 * Safe to call multiple times -- idempotency key is deterministic.
 */
export async function dispatchEvidenceSeal(opts: {
  orgId: string
  actorId: string
  caseId: string
  caseNumber: string
}): Promise<OrchestratorDispatchResult> {
  return dispatchOrchestratorWorkflow({
    orgId: opts.orgId,
    actorId: opts.actorId,
    playbook: 'evidence_seal',
    idempotencyKey: `evidence_seal:${opts.caseId}`,
    payload: { caseId: opts.caseId, caseNumber: opts.caseNumber },
  })
}

/**
 * Trigger an SLA escalation notification for a case that has breached its
 * response or resolution deadline.
 */
export async function dispatchSlaEscalation(opts: {
  orgId: string
  actorId: string
  caseId: string
  slaType: 'response_deadline' | 'resolution_deadline'
  breachedAt: string
}): Promise<OrchestratorDispatchResult> {
  return dispatchOrchestratorWorkflow({
    orgId: opts.orgId,
    actorId: opts.actorId,
    playbook: 'sla_escalation',
    idempotencyKey: `sla_escalation:${opts.caseId}:${opts.slaType}`,
    payload: {
      caseId: opts.caseId,
      slaType: opts.slaType,
      breachedAt: opts.breachedAt,
    },
  })
}