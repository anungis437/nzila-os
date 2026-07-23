/**
 * Phase 0B.2R §7 — Platform-scoped audit event emitter.
 *
 * This is the sanctioned entry point for writing to `public.audit_events`
 * (PLATFORM_OWNED_EXCLUSIVE per Phase 0B.2R §5). Every callsite that needs
 * to append a row to `audit_events` MUST go through this helper —
 * direct `db.insert(auditEvents)` calls are forbidden because they
 * bypass the platform-tenant resolution contract (Option D same-UUID
 * FK documented in `apps/union-eyes/lib/organizations/platform-tenant.ts`).
 *
 * The helper:
 *   1. Calls `requirePlatformTenantId(input.organizationId)` — throws
 *      `PlatformTenantMappingRequired` when the organization is not a
 *      platform participant. This is fail-closed: no silent fallback,
 *      no substitution of a default org. Callers that hit this error
 *      MUST provision the organization via `provisionPlatformParticipant`
 *      or route the workflow to a code path that does not require a
 *      platform-scoped tenant.
 *   2. Inserts into `public.audit_events` using the resolved tenant id
 *      as `org_id`. The FK `org_id → orgs(id)` is guaranteed to hold
 *      because provisioning enforces the same-UUID invariant.
 *   3. Returns the inserted `id`, resolved `orgId`, and computed `hash`
 *      so callers can chain further audit events by passing `hash` as
 *      the `previousHash` of the next event.
 *
 * @module apps/union-eyes/lib/audit/platform-audit-events
 */

import { createHash } from 'crypto'
import { sql } from 'drizzle-orm'
import { db } from '@/db/db'
import { requirePlatformTenantId } from '@/lib/organizations/platform-tenant'

type Executor = typeof db

export interface EmitPlatformAuditEventInput {
  /**
   * Application-schema organization id (`organizations.id`). The helper
   * resolves this to the platform-side `platform_tenant_id` via
   * `requirePlatformTenantId`. Must be a valid UUID.
   */
  organizationId: string
  /**
   * User (or service principal id) that performed the action. Free-form
   * text — resolvers upstream are responsible for normalising this to
   * an auth-domain identifier.
   */
  actorUserId: string
  /**
   * Role of the actor at the time of the action (optional).
   */
  actorRole?: string
  /**
   * Action verb, dotted namespace (e.g. `pilot.bootstrap`, `case.created`).
   */
  action: string
  /**
   * Type of the target resource (e.g. `organization`, `case`, `grievance`).
   */
  targetType: string
  /**
   * Target resource id, when the action operates on a specific row.
   * Must be a valid UUID when supplied.
   */
  targetId?: string
  /**
   * Pre-image of the mutated resource (optional).
   */
  beforeJson?: Record<string, unknown>
  /**
   * Post-image of the mutated resource (optional).
   */
  afterJson?: Record<string, unknown>
  /**
   * Hash of the previous audit event in a linked chain (optional).
   * When provided, downstream verifiers can reconstruct the append-only
   * chain by following `previous_hash` → prior `hash`.
   */
  previousHash?: string
}

export interface EmittedPlatformAuditEvent {
  /** Newly-inserted audit_events.id (UUID). */
  id: string
  /** Resolved platform tenant id used as audit_events.org_id (UUID). */
  orgId: string
  /** SHA-256 hash of the canonical event payload (linkage-only-v0). */
  hash: string
}

/**
 * Compute the linkage-only-v0 hash for an audit event payload.
 *
 * Canonical order matches the JSON key order below — any change to this
 * function is a breaking hash-version bump and MUST update `hash_version`
 * on the target row.
 */
function computeLinkageHash(payload: {
  orgId: string
  actorUserId: string
  action: string
  targetType: string
  targetId: string | null
  beforeJson: Record<string, unknown> | null
  afterJson: Record<string, unknown> | null
  previousHash: string | null
}): string {
  const canonical = JSON.stringify(payload)
  return createHash('sha256').update(canonical).digest('hex')
}

/**
 * Emit a platform-scoped audit event.
 *
 * See module docs above for the full contract. Returns the inserted row's
 * id + the resolved platform tenant id + the computed linkage hash.
 *
 * Throws:
 *   * `PlatformTenantMappingRequired` — organization is not a platform
 *     participant (fail-closed; do not fall back).
 *   * `Error` — INSERT did not return an id (indicates a schema
 *     mismatch — either the audit_events immutability trigger fired
 *     or the RETURNING clause was silently dropped).
 */
export async function emitPlatformAuditEvent(
  input: EmitPlatformAuditEventInput,
  tx: Executor = db,
): Promise<EmittedPlatformAuditEvent> {
  const orgId = await requirePlatformTenantId(input.organizationId, tx)

  const hash = computeLinkageHash({
    orgId,
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId ?? null,
    beforeJson: input.beforeJson ?? null,
    afterJson: input.afterJson ?? null,
    previousHash: input.previousHash ?? null,
  })

  const beforeParam = input.beforeJson ? JSON.stringify(input.beforeJson) : null
  const afterParam = input.afterJson ? JSON.stringify(input.afterJson) : null

  const result = await tx.execute(sql`
    INSERT INTO public.audit_events (
      org_id,
      actor_user_id,
      actor_role,
      action,
      target_type,
      target_id,
      before_json,
      after_json,
      hash,
      previous_hash
    ) VALUES (
      ${orgId}::uuid,
      ${input.actorUserId},
      ${input.actorRole ?? null},
      ${input.action},
      ${input.targetType},
      ${input.targetId ?? null}::uuid,
      ${beforeParam}::jsonb,
      ${afterParam}::jsonb,
      ${hash},
      ${input.previousHash ?? null}
    )
    RETURNING id
  `)

  // postgres.js returns arrays directly for db.execute(sql`...`)
  const rows = result as unknown as Array<{ id: string }>
  const id = rows[0]?.id
  if (!id) {
    throw new Error(
      'emitPlatformAuditEvent: INSERT INTO public.audit_events did not return id. Check schema drift or immutability trigger interference.',
    )
  }

  return { id, orgId, hash }
}
