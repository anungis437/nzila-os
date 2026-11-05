/**
 * Authority store — canonical audit bridge.
 *
 * Authority mutations are written to the canonical, hash-chained
 * `public.audit_logs` through the SAME executor, so the audit row lives and dies
 * with the business mutation. The existing `appendCanonicalAuditLog` is reused
 * unchanged (its chain hashing, per-organization advisory lock and ordering are
 * the guarantees being preserved); only its transaction handle is adapted.
 *
 * Each audit row names the exact `ue_authority_events` it covers. A deferred
 * constraint trigger in the database (platform 0013) refuses COMMIT for any
 * authority event that no canonical audit row names, so forgetting to call this
 * cannot silently succeed.
 */
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { appendCanonicalAuditLog } from '@/lib/audit/canonical-audit-chain'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { POLICY_VERSION } from '../ontology'
import { isUuid, type SqlExecutor } from './executor'

const dialect = new PgDialect()

/** Adapts a SqlExecutor to the `execute(sql)` shape appendCanonicalAuditLog expects. */
export function asRlsTx(exec: SqlExecutor): RLSTx {
  return {
    execute: async (query: SQL) => {
      const { sql, params } = dialect.sqlToQuery(query)
      return (await exec.query(sql, params as unknown[])).rows
    },
  } as unknown as RLSTx
}

export interface AuthorityAuditInput {
  organizationId: string
  /** Verb after the `authority.` prefix, e.g. `mandate.issue`. */
  action: string
  resourceType: string
  resourceId?: string | null
  details?: Record<string, unknown>
}

/**
 * Appends one canonical audit row covering every authority event of the current
 * transaction that no audit row names yet. Returns the covered event ids, or an
 * empty list (and writes nothing) when the operation produced no event.
 */
export async function auditAuthorityMutation(exec: SqlExecutor, input: AuthorityAuditInput): Promise<string[]> {
  if (!isUuid(input.organizationId)) throw new Error('audit requires an organization uuid')
  const events = (
    await exec.query<{ id: string; txid: string }>(
      `SELECT e.id::text AS id, e.txid::text AS txid
         FROM ue_authority_events e
        WHERE e.organization_id = $1::uuid AND e.txid = txid_current()
          AND NOT EXISTS (
            SELECT 1 FROM public.audit_logs a
             WHERE a.organization_id = e.organization_id AND a.created_at >= e.occurred_at
               AND a.action LIKE 'authority.%' AND (a.details -> 'authorityEventIds') ? e.id::text)
        ORDER BY e.event_seq`,
      [input.organizationId],
    )
  ).rows
  if (events.length === 0) return []
  const actor = (await exec.query<{ u: string | null }>(`SELECT nullif(current_setting('app.current_user_id', true), '') AS u`)).rows[0]?.u ?? null
  await appendCanonicalAuditLog(asRlsTx(exec), {
    organizationId: input.organizationId,
    action: `authority.${input.action}`,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    userId: actor,
    details: {
      ...(input.details ?? {}),
      authorityEventIds: events.map((e) => e.id),
      authorityTxid: events[0].txid,
      policyVersion: POLICY_VERSION,
    },
  })
  return events.map((e) => e.id)
}

export interface AuditReconciliation {
  eventsWithoutAudit: string[]
  auditRowsWithUnknownEvents: string[]
  chainBreaks: string[]
}

/**
 * Reconciles the two evidence systems for one organization: every authority
 * event must be named by a canonical audit row, every id an authority audit row
 * names must be a real event, and the organization's hash chain must be intact
 * (each row's previous_hash equals the prior row's content_hash).
 *
 * This is an integrity check and must read every event, so it runs as the
 * migration owner or another role that bypasses row-level security. Run as the
 * tenant runtime role it sees only the events that role may read: since cache 0047
 * an event of a governance review is hidden from a principal who has no part in
 * that review, and an audit row naming such an event would be reported as unknown.
 */
export async function reconcileAuthorityAudit(exec: SqlExecutor, organizationId: string): Promise<AuditReconciliation> {
  const missing = await exec.query<{ id: string }>(
    `SELECT e.id::text AS id FROM ue_authority_events e
      WHERE e.organization_id = $1::uuid
        AND NOT EXISTS (SELECT 1 FROM public.audit_logs a
          WHERE a.organization_id = e.organization_id AND a.action LIKE 'authority.%'
            AND (a.details -> 'authorityEventIds') ? e.id::text)`,
    [organizationId],
  )
  const unknown = await exec.query<{ id: string }>(
    `SELECT a.id::text AS id FROM public.audit_logs a
      WHERE a.organization_id = $1::uuid AND a.action LIKE 'authority.%'
        AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(a.details -> 'authorityEventIds') x
                     WHERE NOT EXISTS (SELECT 1 FROM ue_authority_events e WHERE e.organization_id = a.organization_id AND e.id::text = x))`,
    [organizationId],
  )
  const chain = await exec.query<{ id: string }>(
    `SELECT id::text AS id FROM (
        SELECT id, previous_hash, lag(content_hash) OVER (ORDER BY created_at, id) AS expected
          FROM public.audit_logs WHERE organization_id = $1::uuid) t
      WHERE previous_hash IS DISTINCT FROM expected`,
    [organizationId],
  )
  return {
    eventsWithoutAudit: missing.rows.map((r) => r.id),
    auditRowsWithUnknownEvents: unknown.rows.map((r) => r.id),
    chainBreaks: chain.rows.map((r) => r.id),
  }
}
