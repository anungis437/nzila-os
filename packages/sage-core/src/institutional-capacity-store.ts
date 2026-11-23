// ─── @nzila/sage-core — SQL-backed institutional capacity / recusal store ────
//
// Trusted reads of office holdings and conflict attestations. Absence of a
// conflict attestation is UNAVAILABLE (null), never an implied "clear".

import type { SageSqlClient } from './sql-client'
import type { SageInstitutionalCapacityStore } from './institutional-capacity'
import { invalidInput } from './service-errors'

function requireNonEmpty(value: string, label: string): string {
  if (!value.trim()) invalidInput(`${label} required`)
  return value.trim()
}

/**
 * PostgreSQL capacity store. Callers should construct this with the same
 * transactional `SageSqlClient` used for mandate FOR UPDATE locking.
 */
export class SqlSageInstitutionalCapacityStore implements SageInstitutionalCapacityStore {
  constructor(
    private readonly sql: SageSqlClient,
    private readonly evaluatedAt: string = new Date().toISOString(),
  ) {}

  async resolveActivePosition(input: {
    orgId: string
    workspaceId: string
    actorId: string
  }): Promise<string | null> {
    const orgId = requireNonEmpty(input.orgId, 'orgId')
    const workspaceId = requireNonEmpty(input.workspaceId, 'workspaceId')
    const actorId = requireNonEmpty(input.actorId, 'actorId')

    const { rows } = await this.sql.query<{ position_id: string }>(
      `select position_id
         from sage_institutional_office_holding
        where org_id = $1
          and workspace_id = $2::uuid
          and actor_id = $3
          and status = 'active'
          and revoked_at is null
          and effective_at <= $4::timestamptz
          and expires_at > $4::timestamptz
        order by effective_at desc
        limit 2`,
      [orgId, workspaceId, actorId, this.evaluatedAt],
    )
    // Ambiguous multi-office holdings fail closed (null) until succession/policy chooses.
    if (rows.length !== 1) return null
    return rows[0]!.position_id
  }

  async resolveConflictOrRecusal(input: {
    orgId: string
    workspaceId: string
    actorId: string
    resourceId: string
    action: string
  }): Promise<boolean | null> {
    const orgId = requireNonEmpty(input.orgId, 'orgId')
    const workspaceId = requireNonEmpty(input.workspaceId, 'workspaceId')
    const actorId = requireNonEmpty(input.actorId, 'actorId')
    const resourceId = requireNonEmpty(input.resourceId, 'resourceId')
    const action = requireNonEmpty(input.action, 'action')

    // Prefer exact action scope; fall back to resource-wide '*'.
    const { rows } = await this.sql.query<{ conflicted: boolean; action_scope: string }>(
      `select conflicted, action_scope
         from sage_institutional_conflict_attestation
        where org_id = $1
          and workspace_id = $2::uuid
          and actor_id = $3
          and resource_id = $4
          and action_scope in ($5, '*')
          and revoked_at is null
          and effective_at <= $6::timestamptz
          and expires_at > $6::timestamptz
        order by case when action_scope = $5 then 0 else 1 end, attested_at desc
        limit 1`,
      [orgId, workspaceId, actorId, resourceId, action, this.evaluatedAt],
    )
    if (rows.length === 0) return null
    return rows[0]!.conflicted === true
  }
}

/** Seed helpers for LOCAL_TESTED / PGlite proofs — not HTTP admission paths. */
export async function insertInstitutionalOfficeHolding(
  sql: SageSqlClient,
  input: {
    orgId: string
    workspaceId: string
    actorId: string
    positionId: string
    instrumentRef: string
    instrumentVersion: string
    effectiveAt: string
    expiresAt: string
    createdBy: string
    status?: 'active' | 'suspended' | 'revoked' | 'expired'
  },
): Promise<{ id: string }> {
  const { rows } = await sql.query<{ id: string }>(
    `insert into sage_institutional_office_holding (
       org_id, workspace_id, actor_id, position_id,
       instrument_ref, instrument_version, status,
       effective_at, expires_at, created_by
     ) values (
       $1, $2::uuid, $3, $4, $5, $6, $7,
       $8::timestamptz, $9::timestamptz, $10
     )
     returning id`,
    [
      input.orgId,
      input.workspaceId,
      input.actorId,
      input.positionId,
      input.instrumentRef,
      input.instrumentVersion,
      input.status ?? 'active',
      input.effectiveAt,
      input.expiresAt,
      input.createdBy,
    ],
  )
  return { id: rows[0]!.id }
}

export async function insertInstitutionalConflictAttestation(
  sql: SageSqlClient,
  input: {
    orgId: string
    workspaceId: string
    actorId: string
    resourceId: string
    actionScope: string
    conflicted: boolean
    instrumentRef: string
    instrumentVersion: string
    attestedBy: string
    attestedAt: string
    effectiveAt: string
    expiresAt: string
  },
): Promise<{ id: string }> {
  const { rows } = await sql.query<{ id: string }>(
    `insert into sage_institutional_conflict_attestation (
       org_id, workspace_id, actor_id, resource_id, action_scope,
       conflicted, instrument_ref, instrument_version,
       attested_by, attested_at, effective_at, expires_at
     ) values (
       $1, $2::uuid, $3, $4, $5,
       $6, $7, $8,
       $9, $10::timestamptz, $11::timestamptz, $12::timestamptz
     )
     returning id`,
    [
      input.orgId,
      input.workspaceId,
      input.actorId,
      input.resourceId,
      input.actionScope,
      input.conflicted,
      input.instrumentRef,
      input.instrumentVersion,
      input.attestedBy,
      input.attestedAt,
      input.effectiveAt,
      input.expiresAt,
    ],
  )
  return { id: rows[0]!.id }
}
