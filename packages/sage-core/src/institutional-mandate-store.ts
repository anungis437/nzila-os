// ─── @nzila/sage-core — institutional mandate store (server-only) ────────────
//
// Trusted repository adapter that loads institutionally controlled mandate
// facts. Callers must NEVER pass browser-supplied verification labels, amounts,
// issuer identity, or effective dates into evaluateSageInstitutionalMandate.
// This module is the only approved source of SageVerifiedInstitutionalMandate
// rows for consequential admission.

import type { SageSqlClient } from './sql-client'
import type {
  SageInstitutionalAction,
  SageMandateStatus,
  SageVerifiedInstitutionalMandate,
} from './institutional-authority'
import { SAGE_INSTITUTIONAL_ACTIONS } from './institutional-authority'
import { conflict, invalidInput, notFound, orgBoundary } from './service-errors'

export type SageMandateRow = {
  id: string
  org_id: string
  workspace_id: string
  principal_actor_id: string
  position_id: string
  resource_id: string
  permitted_actions: unknown
  instrument_ref: string
  instrument_version: string
  issuer_actor_id: string
  monetary_limit_minor: string | number | null
  currency: string | null
  verification_status: 'verified' | 'unverified' | 'rejected'
  attested_at: string | Date
  accepted_at: string | Date | null
  effective_at: string | Date
  expires_at: string | Date
  revoked_at: string | Date | null
  status: SageMandateStatus
}

export type SageResourceCommitmentRow = {
  id: string
  org_id: string
  workspace_id: string
  resource_id: string
  mandate_id: string
  currency: string
  amount_minor: string | number
  idempotency_key: string
  committed_by_actor_id: string
  committed_at: string | Date
  instrument_ref: string
  instrument_version: string
}

export type SageInstitutionalActionRow = {
  id: string
  org_id: string
  workspace_id: string
  mandate_id: string
  action: SageInstitutionalAction
  resource_id: string
  actor_id: string
  position_id: string
  instrument_ref: string
  instrument_version: string
  idempotency_key: string
  decision_reason: string
  commitment_id: string | null
  safe_payload_json: unknown
  occurred_at: string | Date
}

function toIso(value: string | Date | null): string | null {
  if (value === null) return null
  if (value instanceof Date) return value.toISOString()
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) invalidInput('invalid institutional timestamp')
  return new Date(parsed).toISOString()
}

function parseActions(raw: unknown): SageInstitutionalAction[] {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? (JSON.parse(raw) as unknown)
      : null
  if (!Array.isArray(values)) invalidInput('mandate permitted_actions must be an array')
  const allowed = new Set<string>(SAGE_INSTITUTIONAL_ACTIONS)
  const out: SageInstitutionalAction[] = []
  for (const value of values) {
    if (typeof value !== 'string' || !allowed.has(value)) {
      invalidInput('mandate contains an unrecognized permitted action')
    }
    out.push(value as SageInstitutionalAction)
  }
  return out
}

function asMinor(value: string | number | null | undefined): number | undefined {
  if (value === null || value === undefined) return undefined
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isSafeInteger(n) || n < 0) invalidInput('unsafe monetary minor unit')
  return n
}

export function mapMandateRow(row: SageMandateRow): SageVerifiedInstitutionalMandate {
  return {
    id: row.id,
    orgId: row.org_id,
    principalActorId: row.principal_actor_id,
    positionId: row.position_id,
    resourceId: row.resource_id,
    permittedActions: parseActions(row.permitted_actions),
    instrumentRef: row.instrument_ref,
    instrumentVersion: row.instrument_version,
    issuerActorId: row.issuer_actor_id,
    monetaryLimitMinor: asMinor(row.monetary_limit_minor),
    currency: row.currency ?? undefined,
    verificationStatus: row.verification_status,
    attestedAt: toIso(row.attested_at)!,
    acceptedAt: toIso(row.accepted_at),
    effectiveAt: toIso(row.effective_at)!,
    expiresAt: toIso(row.expires_at)!,
    revokedAt: toIso(row.revoked_at),
    status: row.status,
  }
}

/**
 * Load exactly one mandate by ID inside the caller's tenant. Ambiguous or
 * cross-tenant results fail closed.
 */
export async function loadVerifiedInstitutionalMandate(
  sql: SageSqlClient,
  input: { orgId: string; workspaceId: string; mandateId: string },
): Promise<SageVerifiedInstitutionalMandate> {
  if (!input.orgId.trim() || !input.workspaceId.trim() || !input.mandateId.trim()) {
    invalidInput('mandate lookup requires org, workspace and mandate id')
  }
  const { rows } = await sql.query<SageMandateRow>(
    `select *
       from sage_institutional_mandate
      where id = $1
        and org_id = $2
        and workspace_id = $3`,
    [input.mandateId, input.orgId, input.workspaceId],
  )
  if (rows.length === 0) notFound('institutional mandate')
  if (rows.length !== 1) conflict('ambiguous institutional mandate')
  const mapped = mapMandateRow(rows[0]!)
  if (mapped.orgId !== input.orgId) orgBoundary()
  return mapped
}

/** Sum committed minor units for a resource/currency from the authoritative ledger. */
export async function sumResourceCommitmentsMinor(
  sql: SageSqlClient,
  input: { orgId: string; resourceId: string; currency: string },
): Promise<number> {
  const { rows } = await sql.query<{ total: string | number | null }>(
    `select coalesce(sum(amount_minor), 0) as total
       from sage_resource_commitment
      where org_id = $1
        and resource_id = $2
        and currency = $3`,
    [input.orgId, input.resourceId, input.currency],
  )
  return asMinor(rows[0]?.total ?? 0) ?? 0
}

/** Lock the mandate row for the duration of the admission transaction. */
export async function lockInstitutionalMandateForUpdate(
  sql: SageSqlClient,
  input: { orgId: string; workspaceId: string; mandateId: string },
): Promise<SageVerifiedInstitutionalMandate> {
  const { rows } = await sql.query<SageMandateRow>(
    `select *
       from sage_institutional_mandate
      where id = $1
        and org_id = $2
        and workspace_id = $3
      for update`,
    [input.mandateId, input.orgId, input.workspaceId],
  )
  if (rows.length !== 1) notFound('institutional mandate')
  return mapMandateRow(rows[0]!)
}

export type InsertInstitutionalMandateInput = {
  id?: string
  orgId: string
  workspaceId: string
  principalActorId: string
  positionId: string
  resourceId: string
  permittedActions: readonly SageInstitutionalAction[]
  instrumentRef: string
  instrumentVersion: string
  issuerActorId: string
  monetaryLimitMinor?: number
  currency?: string
  verificationStatus: 'verified' | 'unverified' | 'rejected'
  attestedAt: string
  acceptedAt: string | null
  effectiveAt: string
  expiresAt: string
  revokedAt?: string | null
  status: SageMandateStatus
  createdBy: string
}

/** Server-side seed/attestation insert. Not a public HTTP mutation surface. */
export async function insertInstitutionalMandate(
  sql: SageSqlClient,
  input: InsertInstitutionalMandateInput,
): Promise<SageVerifiedInstitutionalMandate> {
  const { rows } = await sql.query<SageMandateRow>(
    `insert into sage_institutional_mandate (
       id, org_id, workspace_id, principal_actor_id, position_id, resource_id,
       permitted_actions, instrument_ref, instrument_version, issuer_actor_id,
       monetary_limit_minor, currency, verification_status, attested_at, accepted_at,
       effective_at, expires_at, revoked_at, status, created_by
     ) values (
       coalesce($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6,
       $7::jsonb, $8, $9, $10,
       $11, $12, $13::sage_mandate_verification, $14::timestamptz, $15::timestamptz,
       $16::timestamptz, $17::timestamptz, $18::timestamptz, $19::sage_mandate_status, $20
     )
     returning *`,
    [
      input.id ?? null,
      input.orgId,
      input.workspaceId,
      input.principalActorId,
      input.positionId,
      input.resourceId,
      JSON.stringify(input.permittedActions),
      input.instrumentRef,
      input.instrumentVersion,
      input.issuerActorId,
      input.monetaryLimitMinor ?? null,
      input.currency ?? null,
      input.verificationStatus,
      input.attestedAt,
      input.acceptedAt,
      input.effectiveAt,
      input.expiresAt,
      input.revokedAt ?? null,
      input.status,
      input.createdBy,
    ],
  )
  return mapMandateRow(rows[0]!)
}

export async function revokeInstitutionalMandate(
  sql: SageSqlClient,
  input: { orgId: string; workspaceId: string; mandateId: string; revokedAt: string },
): Promise<SageVerifiedInstitutionalMandate> {
  const { rows } = await sql.query<SageMandateRow>(
    `update sage_institutional_mandate
        set status = 'revoked',
            revoked_at = $4::timestamptz,
            updated_at = $4::timestamptz
      where id = $1
        and org_id = $2
        and workspace_id = $3
        and status <> 'revoked'
      returning *`,
    [input.mandateId, input.orgId, input.workspaceId, input.revokedAt],
  )
  if (rows.length !== 1) notFound('institutional mandate')
  return mapMandateRow(rows[0]!)
}
