/**
 * The one supported authorization adapter between an authenticated application request and the authority kernel.
 *
 * Routes and services do not hand-roll role or ownership checks for a case. They run their work inside
 * `withRLSContext` (which binds the verified principal and organization to the transaction) and ask the kernel here.
 * The kernel then resolves, from authoritative storage: the active membership, the resource and its owning
 * organization, live relationships, mandates and delegations, institutional issuance rules, recusal, expiry and
 * revocation, and the data classification. Every failure to load, every missing source and every contradiction is a
 * denial: this adapter never converts an error into access.
 */
import { sql, type SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { RLSTx } from '@/lib/db/with-rls-context'
import type { Action, Decision } from '../ontology'
import { enforceAuthority, type EnforcementDeps } from './enforce'
import { activeMembershipSource } from './active-membership-source'
import type { SqlExecutor } from './executor'

/**
 * A JS array travels as one Postgres array literal (drizzle would otherwise expand it into a parameter list). A Date travels
 * as its ISO instant: the postgres driver cannot serialise a Date handed to it through a raw, untyped parameter.
 */
export function bind(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (!Array.isArray(value)) return value
  return `{${value.map((v) => (v === null ? 'NULL' : `"${String(v).replace(/["\\]/g, (c) => `\\${c}`)}"`)).join(',')}}`
}

/** Adapts the transaction `withRLSContext` hands out to the kernel's executor port, keeping bound parameters. */
export function drizzleExecutor(tx: RLSTx): SqlExecutor {
  return {
    async query<T = Record<string, unknown>>(text: string, params: unknown[] = []) {
      const chunks: SQL[] = []
      const pattern = /\$(\d+)/g
      let last = 0
      for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
        chunks.push(sql.raw(text.slice(last, match.index)))
        const index = Number(match[1]) - 1
        if (!(index in params)) throw new Error(`missing bound parameter $${index + 1}`)
        chunks.push(sql`${bind(params[index])}`)
        last = match.index + match[0].length
      }
      chunks.push(sql.raw(text.slice(last)))
      const result = (await tx.execute(sql.join(chunks, sql.raw('')))) as unknown
      const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])
      return { rows: rows as T[] }
    },
  }
}

export const kernelDeps: EnforcementDeps = { memberships: activeMembershipSource }

export interface KernelCaseRequest {
  userId: string
  organizationId: string
  caseId: string
  action: Action
}

/** A full kernel decision for a legal hold on one conversation, for the authenticated principal of `tx`. */
export function decideMessageRetention(
  tx: RLSTx,
  input: { userId: string; organizationId: string; action: 'message:adopt_retention' | 'message:read_retention_policy' },
  deps: EnforcementDeps = kernelDeps,
): Promise<Decision> {
  return enforceAuthority(
    drizzleExecutor(tx),
    deps,
    {
      principalUserId: input.userId,
      organizationId: input.organizationId,
      action: input.action,
      resource: { type: 'message_retention', id: input.organizationId, organizationId: input.organizationId },
    },
    { authenticated: true },
  )
}

export function decideMessageHold(
  tx: RLSTx,
  input: { userId: string; organizationId: string; threadId: string; action: 'message:place_legal_hold' | 'message:release_legal_hold' },
  deps: EnforcementDeps = kernelDeps,
): Promise<Decision> {
  return enforceAuthority(
    drizzleExecutor(tx),
    deps,
    {
      principalUserId: input.userId,
      organizationId: input.organizationId,
      action: input.action,
      resource: { type: 'message_thread', id: input.threadId, organizationId: input.organizationId },
    },
    { authenticated: true },
  )
}

export function decideCase(tx: RLSTx, input: KernelCaseRequest, deps: EnforcementDeps = kernelDeps): Promise<Decision> {
  return enforceAuthority(
    drizzleExecutor(tx),
    deps,
    {
      principalUserId: input.userId,
      organizationId: input.organizationId,
      action: input.action,
      resource: { type: 'case', id: input.caseId, organizationId: input.organizationId },
    },
    { authenticated: true },
  )
}

const dialect = new PgDialect()
export const toSqlText = (fragment: SQL): string => dialect.sqlToQuery(fragment).sql

/**
 * Set-based pre-filter for list queries: cases the user holds a LIVE, non-recused kernel relationship to, plus cases
 * they authored. It is NOT access: it only narrows what a list may enumerate. Reading or changing any one case still
 * needs a full kernel decision (capacity, mandate, rules, classification), so this predicate can never widen access.
 */
export function kernelCaseRelationshipScope(userId: string, caseIdColumn: SQL, organizationIdColumn: SQL): SQL {
  return sql`EXISTS (
    SELECT 1 FROM ue_authority_resource_relationships r
     WHERE r.resource_type = 'case'
       AND r.resource_id = ${caseIdColumn}
       AND r.organization_id = ${organizationIdColumn}
       AND r.principal_user_id = ${userId}
       AND r.status = 'active' AND r.revoked_at IS NULL
       AND r.effective_at <= now() AND (r.expires_at IS NULL OR r.expires_at > now())
       AND NOT EXISTS (
         SELECT 1 FROM ue_authority_recusals z
          WHERE z.organization_id = r.organization_id AND z.principal_user_id = r.principal_user_id
            AND z.resource_type = 'case' AND z.resource_id = r.resource_id AND z.lifted_at IS NULL)
  )`
}
