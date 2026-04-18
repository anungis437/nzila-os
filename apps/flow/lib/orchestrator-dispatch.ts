/**
 * Flow -- Orchestrator Dispatch Client
 *
 * Submits domain workflow jobs to the Nzila Orchestrator API.
 * All dispatches are idempotent: the orchestrator deduplicates on
 * (orgId + workflowId + idempotencyKey). Callers may safely retry.
 *
 * Supported playbooks:
 *  - reminder_dispatch  -- schedule invoice and follow-up reminders
 *  - onboarding_trigger -- trigger new-org onboarding automation sequence
 */

import { randomUUID } from 'crypto'
import { logger } from '@/lib/logger'

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_API_URL ?? 'http://localhost:4000'
const ORCHESTRATOR_API_KEY = process.env.ORCHESTRATOR_API_KEY ?? ''

export type OrchestratorPlaybook = 'reminder_dispatch' | 'onboarding_trigger'

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
 * Never throws -- returns { ok: false, error } on failure so callers can
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
      triggeredBy: 'flow',
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
 * Dispatch reminder notifications for an overdue invoice or quote.
 * Idempotency key is scoped to entity + reminder cycle, so re-triggering
 * on the same day is a no-op.
 */
export async function dispatchInvoiceReminder(opts: {
  orgId: string
  actorId: string
  invoiceId: string
  reminderCycle: 'day_3' | 'day_7' | 'day_14' | 'day_30'
  recipientEmail: string
}): Promise<OrchestratorDispatchResult> {
  const today = new Date().toISOString().slice(0, 10)
  return dispatchOrchestratorWorkflow({
    orgId: opts.orgId,
    actorId: opts.actorId,
    playbook: 'reminder_dispatch',
    idempotencyKey: `reminder:invoice:${opts.invoiceId}:${opts.reminderCycle}:${today}`,
    payload: {
      entityType: 'invoice',
      entityId: opts.invoiceId,
      reminderCycle: opts.reminderCycle,
      recipientEmail: opts.recipientEmail,
    },
  })
}

/**
 * Trigger the onboarding automation sequence for a newly created organisation.
 * Safe to call once per org -- deduplicated on org creation event.
 */
export async function dispatchOnboardingTrigger(opts: {
  orgId: string
  actorId: string
  orgName: string
  planId: string
}): Promise<OrchestratorDispatchResult> {
  return dispatchOrchestratorWorkflow({
    orgId: opts.orgId,
    actorId: opts.actorId,
    playbook: 'onboarding_trigger',
    idempotencyKey: `onboarding:${opts.orgId}`,
    payload: {
      orgId: opts.orgId,
      orgName: opts.orgName,
      planId: opts.planId,
    },
  })
}