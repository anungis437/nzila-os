/**
 * Financial mandate lifecycle with segregation of duties.
 *
 * Issuance, activation and revocation go through the authority kernel. This module adds the financial-specific
 * refusals the kernel's generic mandate path does not state: the issuer cannot be the holder, the approver is a
 * third person, the holder activates, and an expired term is not activated. No route here issues a mandate from a
 * request body. Until `issueFinancialMandate` succeeds against a live issuance rule, `FINANCIAL_MANDATES_NOT_ISSUED`
 * remains the answer for financial operations.
 *
 * Expiration is the `expires_at` fact. The mandate status check allows only active, suspended and revoked, so this
 * module does not invent an expired status. A past term is not live and cannot be activated.
 */
import type { SqlExecutor } from '@/lib/authority/store/executor'
import { AuthorityStoreError } from '@/lib/authority/store/executor'
import { acceptInstrument, changeMandate, issueMandate, type IssueMandateInput } from '@/lib/authority/store/lifecycle'
import type { EnforcementDeps } from '@/lib/authority/store/enforce'

const FINANCIAL_POWERS = ['view', 'prepare', 'approve', 'execute', 'reconcile', 'audit'] as const

export class FinancialMandateLifecycleError extends Error {
  constructor(
    readonly code: 'SEGREGATION_OF_DUTIES' | 'NOT_LIVE' | 'EXPIRED' | 'NOT_HOLDER' | 'INVALID_TERM',
    message: string,
  ) {
    super(message)
    this.name = 'FinancialMandateLifecycleError'
  }
}

export interface FinancialMandateParties {
  issuerUserId: string
  holderUserId: string
  approverUserId: string
}

export function assertFinancialSegregation(parties: FinancialMandateParties): void {
  const { issuerUserId, holderUserId, approverUserId } = parties
  if (!issuerUserId || !holderUserId || !approverUserId) {
    throw new FinancialMandateLifecycleError('SEGREGATION_OF_DUTIES', 'A financial mandate names an issuer, a holder and a distinct approver.')
  }
  if (issuerUserId === holderUserId || issuerUserId === approverUserId || holderUserId === approverUserId) {
    throw new FinancialMandateLifecycleError('SEGREGATION_OF_DUTIES', 'The issuer, the holder and the approver of a financial mandate are three different people.')
  }
}

export type FinancialMandatePhase = 'not_yet_effective' | 'live' | 'expired' | 'revoked' | 'suspended'

export function financialMandatePhase(
  row: { status: string; revokedAt?: Date | null; effectiveAt: Date; expiresAt: Date },
  now: Date,
): FinancialMandatePhase {
  if (row.revokedAt || row.status === 'revoked') return 'revoked'
  if (row.status === 'suspended') return 'suspended'
  if (row.expiresAt <= now) return 'expired'
  if (row.effectiveAt > now) return 'not_yet_effective'
  return 'live'
}

export interface IssueFinancialMandateInput extends Omit<IssueMandateInput, 'kind'> {
  approverUserId: string
}

export async function issueFinancialMandate(exec: SqlExecutor, deps: EnforcementDeps, input: IssueFinancialMandateInput) {
  assertFinancialSegregation(input)
  if (input.expiresAt <= input.effectiveAt) {
    throw new FinancialMandateLifecycleError('INVALID_TERM', 'A financial mandate expires after it becomes effective.')
  }
  if (input.powers.length === 0 || input.powers.some((power) => !(FINANCIAL_POWERS as readonly string[]).includes(power))) {
    throw new FinancialMandateLifecycleError('INVALID_TERM', 'A financial mandate lists only view, prepare, approve, execute, reconcile or audit.')
  }
  if (input.monetaryLimitMinor !== undefined && input.monetaryLimitMinor !== null && !input.currency) {
    throw new FinancialMandateLifecycleError('INVALID_TERM', 'A monetary limit names its currency.')
  }
  return issueMandate(exec, deps, {
    ...input,
    kind: 'financial',
    justification: input.justification ?? `approved by ${input.approverUserId}`,
  })
}

interface MandateRow {
  principal_user_id: string
  granted_by: string
  approved_by: string | null
  status: string
  kind: string
  effective_at: Date | string
  expires_at: Date | string
  revoked_at: Date | string | null
}

async function loadFinancialMandate(exec: SqlExecutor, organizationId: string, mandateId: string): Promise<MandateRow> {
  const row = (
    await exec.query<MandateRow>(
      `SELECT principal_user_id, granted_by, approved_by, status, kind, effective_at, expires_at, revoked_at
         FROM ue_authority_mandates WHERE organization_id = $1::uuid AND id = $2::uuid`,
      [organizationId, mandateId],
    )
  ).rows[0]
  if (!row || row.kind !== 'financial') throw new FinancialMandateLifecycleError('NOT_LIVE', 'No financial mandate with that id is in this organization.')
  return row
}

/** The holder accepts the mandate. The issuer and the approver cannot activate it. An expired term is refused. */
export async function activateFinancialMandate(
  exec: SqlExecutor,
  input: { organizationId: string; mandateId: string; holderUserId: string },
): Promise<string> {
  const row = await loadFinancialMandate(exec, input.organizationId, input.mandateId)
  if (input.holderUserId !== row.principal_user_id) {
    throw new FinancialMandateLifecycleError('NOT_HOLDER', 'Only the holder activates a financial mandate.')
  }
  if (input.holderUserId === row.granted_by || input.holderUserId === row.approved_by) {
    throw new FinancialMandateLifecycleError('SEGREGATION_OF_DUTIES', 'The issuer and the approver do not activate the mandate they created.')
  }
  const phase = financialMandatePhase(
    {
      status: row.status,
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
      effectiveAt: new Date(row.effective_at),
      expiresAt: new Date(row.expires_at),
    },
    new Date(),
  )
  if (phase === 'expired') throw new FinancialMandateLifecycleError('EXPIRED', 'An expired financial mandate is not activated.')
  if (phase !== 'live' && phase !== 'not_yet_effective') {
    throw new FinancialMandateLifecycleError('NOT_LIVE', 'Only an unexpired financial mandate can be activated.')
  }
  return acceptInstrument(exec, {
    organizationId: input.organizationId,
    instrumentType: 'mandate',
    instrumentId: input.mandateId,
    holderUserId: input.holderUserId,
  })
}

/** Revocation stays on the kernel rule. The holder may surrender. A revoked or expired row is not treated as live. */
export async function revokeFinancialMandate(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  input: { organizationId: string; actorUserId: string; mandateId: string },
) {
  const row = await loadFinancialMandate(exec, input.organizationId, input.mandateId)
  const phase = financialMandatePhase(
    {
      status: row.status,
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
      effectiveAt: new Date(row.effective_at),
      expiresAt: new Date(row.expires_at),
    },
    new Date(),
  )
  if (phase === 'revoked') throw new AuthorityStoreError('ALREADY_TERMINAL', 'The financial mandate is already revoked.')
  return changeMandate(exec, deps, {
    organizationId: input.organizationId,
    issuerUserId: input.actorUserId,
    mandateId: input.mandateId,
    change: 'revoke',
  })
}

/** Lists financial mandates whose term has ended. Does not update a row and does not grant a power. */
export async function listExpiredFinancialMandates(exec: SqlExecutor, organizationId: string): Promise<string[]> {
  const rows = (
    await exec.query<{ id: string }>(
      `SELECT id::text AS id FROM ue_authority_mandates
        WHERE organization_id = $1::uuid AND kind = 'financial' AND status = 'active' AND revoked_at IS NULL
          AND expires_at <= now()`,
      [organizationId],
    )
  ).rows
  return rows.map((row) => row.id)
}
