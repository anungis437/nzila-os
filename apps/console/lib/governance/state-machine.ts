/**
 * Console — Governance Action Proxy
 *
 * The Console no longer owns governance state. All governance mutations
 * are delegated to the Control Plane via its authority API.
 *
 * Authority: apps/control-plane/app/api/control-plane/governance/actions/route.ts
 *
 * State flow (enforced by Control Plane):
 *   draft → pending_approval → approved → executed
 *                            ↘ rejected
 *
 * A governance action CANNOT transition to "executed" unless all
 * required approvals are in "approved" status — the Control Plane
 * enforces this gate.
 */
import { createLogger } from '@nzila/os-core'
import type {
  GovernanceActionType,
  PolicyEvaluation,
} from '@nzila/os-core'
import type { buildEvidencePackFromAction } from '@nzila/os-core/evidence/builder'

const logger = createLogger('console:governance:state-machine')

// ── Control Plane connection ──────────────────────────────────────────────

const CP_URL = process.env.CONTROL_PLANE_URL ?? 'http://localhost:3010'
const CP_KEY = process.env.CONTROL_PLANE_API_KEY ?? ''

async function callControlPlane<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch(
    `${CP_URL}/api/control-plane/governance/actions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CP_KEY,
      },
      body: JSON.stringify(body),
    },
  )

  if (!response.ok) {
    const text = await response.text().catch(() => '(no body)')
    logger.error('Control Plane governance call failed', {
      status: response.status,
      body: text,
      operation: body.operation,
    })
    const json = JSON.parse(text || '{}') as { error?: { code?: string; message?: string } }
    const err = json.error ?? { code: 'CP_ERROR', message: `HTTP ${response.status}` }
    throw Object.assign(new Error(err.message ?? 'Control Plane error'), { code: err.code })
  }

  const json = (await response.json()) as { ok: boolean; data: T; error?: unknown }
  if (!json.ok) {
    const err = json.error as { code?: string; message?: string } ?? {}
    throw Object.assign(new Error(err.message ?? 'Governance operation failed'), { code: err.code })
  }

  return json.data
}

// ── Types (preserved for callers) ────────────────────────────────────────

export interface CreateActionInput {
  orgId: string
  actionType: GovernanceActionType
  payload: Record<string, unknown>
  createdBy: string
}

export interface SubmitActionInput {
  actionId: string
  orgId: string
  submittedBy: string
  context?: {
    totalSharesOutstanding?: number
    quantity?: number
    amount?: number
    transferRestricted?: boolean
    rofrApplies?: boolean
  }
}

export interface ApproveActionInput {
  actionId: string
  orgId: string
  approvalId: string
  decidedBy: string
  decision: 'approved' | 'rejected'
  notes?: string
}

export interface ExecuteActionInput {
  actionId: string
  orgId: string
  executedBy: string
}

export interface GovernanceError {
  code: string
  message: string
  details?: unknown
}

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: GovernanceError }

// ── Proxy functions ───────────────────────────────────────────────────────

export async function createGovernanceAction(
  input: CreateActionInput,
): Promise<Result<{ id: string }>> {
  try {
    const data = await callControlPlane<{ id: string }>({ operation: 'create', ...input })
    return { ok: true, data }
  } catch (err) {
    const e = err as { code?: string; message?: string }
    return { ok: false, error: { code: e.code ?? 'CP_ERROR', message: e.message ?? 'Unknown error' } }
  }
}

export async function submitGovernanceAction(
  input: SubmitActionInput,
): Promise<Result<{ evaluation: PolicyEvaluation; approvalIds: string[] }>> {
  try {
    const data = await callControlPlane<{ evaluation: PolicyEvaluation; approvalIds: string[] }>({
      operation: 'submit',
      ...input,
    })
    return { ok: true, data }
  } catch (err) {
    const e = err as { code?: string; message?: string }
    return { ok: false, error: { code: e.code ?? 'CP_ERROR', message: e.message ?? 'Unknown error' } }
  }
}

export async function decideApproval(
  input: ApproveActionInput,
): Promise<Result<{ actionStatus: string }>> {
  try {
    const data = await callControlPlane<{ actionStatus: string }>({ operation: 'decide', ...input })
    return { ok: true, data }
  } catch (err) {
    const e = err as { code?: string; message?: string }
    return { ok: false, error: { code: e.code ?? 'CP_ERROR', message: e.message ?? 'Unknown error' } }
  }
}

export async function executeGovernanceAction(
  input: ExecuteActionInput,
): Promise<
  Result<{
    resolution: { title: string; bodyMarkdown: string } | null
    evidencePackRequest: ReturnType<typeof buildEvidencePackFromAction> | null
  }>
> {
  try {
    const data = await callControlPlane<{
      resolution: { title: string; bodyMarkdown: string } | null
      evidencePackRequest: ReturnType<typeof buildEvidencePackFromAction> | null
    }>({ operation: 'execute', ...input })
    return { ok: true, data }
  } catch (err) {
    const e = err as { code?: string; message?: string }
    return { ok: false, error: { code: e.code ?? 'CP_ERROR', message: e.message ?? 'Unknown error' } }
  }
}

// ── Utility: get action with its approvals (read from CP) ────────────────

export async function getGovernanceActionWithApprovals(
  actionId: string,
  orgId: string,
) {
  try {
    const response = await fetch(
      `${CP_URL}/api/control-plane/governance/actions?orgId=${encodeURIComponent(orgId)}`,
      { headers: { 'x-api-key': CP_KEY } },
    )
    if (!response.ok) return null
    const json = (await response.json()) as { ok: boolean; data: unknown[] }
    const actions = json.data ?? []
    const action = (actions as Array<{ id: string }>).find((a) => a.id === actionId)
    return action ?? null
  } catch {
    return null
  }
}
