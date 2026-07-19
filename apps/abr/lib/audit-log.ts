import { createHash } from 'node:crypto';

import { sql } from 'drizzle-orm';

import { platformDb } from '@nzila/db/platform';
import { createLogger } from '@nzila/os-core';

const logger = createLogger('abr-audit');

/**
 * Canonical hash version tag persisted in `audit_events.hash_version` for
 * every row written by this module.
 *
 * Any row tagged 'canonical-v1' MUST be independently reconstructable from
 * the persisted columns (`org_id`, `actor_user_id`, `actor_role`, `action`,
 * `target_type`, `target_id`, `after_json`, `occurred_at`, `previous_hash`)
 * using {@link buildCanonicalPayload} + {@link computeCanonicalHash}. Rows
 * tagged 'linkage-only-v0' are legacy: chain linkage remains verifiable via
 * `previous_hash` but full recomputation does not apply because the writer
 * did not persist the ephemeral timestamp it hashed. See migration
 * `0032_audit_events_canonical_hash.sql`.
 */
export const CANONICAL_HASH_VERSION = 'canonical-v1' as const;

export interface AbrAuditEvent {
  action: string;
  actorUserId: string;
  orgId: string;
  entityType: string;
  recordId?: string;
  details?: Record<string, unknown>;
}

/**
 * Canonical payload fields that are fed to SHA-256. Every field here MUST
 * be persisted on the row so that the exact same object can be reconstructed
 * later. Do not add fields to this shape without adding a new
 * `hash_version` and a migration column for the new field.
 *
 * Canonical serialisation rules (canonical-v1):
 *   - Keys are emitted in strict ASCII sort order (see {@link CANONICAL_KEY_ORDER}).
 *   - JSON.stringify with no space argument, no replacer.
 *   - Nulls are preserved (never elided).
 *   - `afterJson` is passed as its raw object shape; the same object shape
 *     is persisted in `audit_events.after_json` via jsonb. Field ordering
 *     inside `afterJson` is preserved as authored by the caller (opaque
 *     from the hash contract's point of view).
 *   - `hashTimestamp` is the exact ISO-8601 string persisted in
 *     `audit_events.occurred_at`. It is generated once per event and
 *     included in both the hash input and the row.
 *   - Strings are UTF-8 (JSON.stringify escapes non-ASCII to \uXXXX; both
 *     the writer and any verifier MUST use JSON.stringify with these
 *     defaults so byte-equality holds).
 *
 * Hash input:
 *     sha256(JSON.stringify({ payload: canonical, previousHash }))
 *
 * where `canonical` is the object returned by {@link buildCanonicalPayload}
 * and `previousHash` is the parent row's `hash` (or `null` for the first
 * row in an org's chain). The wrapper object is written with the fixed
 * key order `{ payload, previousHash }`.
 */
export interface CanonicalAuditPayload {
  action: string;
  actorClerkUserId: string;
  actorRole: string | null;
  afterJson: Record<string, unknown> | null;
  hashTimestamp: string;
  hashVersion: typeof CANONICAL_HASH_VERSION;
  orgId: string;
  targetId: string | null;
  targetType: string;
}

/**
 * Fixed ASCII-sorted key order for {@link CanonicalAuditPayload}. Do not
 * reorder without bumping {@link CANONICAL_HASH_VERSION}.
 */
export const CANONICAL_KEY_ORDER: readonly (keyof CanonicalAuditPayload)[] = [
  'action',
  'actorClerkUserId',
  'actorRole',
  'afterJson',
  'hashTimestamp',
  'hashVersion',
  'orgId',
  'targetId',
  'targetType',
] as const;

export interface CanonicalPayloadInput {
  action: string;
  actorClerkUserId: string;
  actorRole: string | null;
  afterJson: Record<string, unknown> | null;
  hashTimestamp: string;
  orgId: string;
  targetId: string | null;
  targetType: string;
}

/**
 * Produces a {@link CanonicalAuditPayload} with keys inserted in
 * {@link CANONICAL_KEY_ORDER}. Because `JSON.stringify` preserves insertion
 * order, this guarantees a deterministic byte sequence for hashing
 * regardless of the caller's field-construction order.
 */
export function buildCanonicalPayload(input: CanonicalPayloadInput): CanonicalAuditPayload {
  const payload = {} as CanonicalAuditPayload;
  // Deliberate explicit key-by-key assignment in sorted order. Do not
  // replace with a spread — spread order depends on the input object.
  payload.action = input.action;
  payload.actorClerkUserId = input.actorClerkUserId;
  payload.actorRole = input.actorRole;
  payload.afterJson = input.afterJson;
  payload.hashTimestamp = input.hashTimestamp;
  payload.hashVersion = CANONICAL_HASH_VERSION;
  payload.orgId = input.orgId;
  payload.targetId = input.targetId;
  payload.targetType = input.targetType;
  return payload;
}

/**
 * Deterministic SHA-256 of the canonical payload wrapped with previousHash.
 * The wrapper uses fixed key order `{ payload, previousHash }`.
 *
 * Canonical serialisation is byte-deterministic:
 *   - Object keys are recursively sorted in ASCII order (via
 *     {@link canonicalStringify}). This tolerates PostgreSQL `jsonb`
 *     re-ordering of keys inside `afterJson`, so a verifier reading the
 *     row back from `jsonb` produces the same bytes as the writer.
 *   - Arrays preserve order (semantic).
 *   - Nulls are preserved.
 *   - UTF-8 encoding is explicit.
 *
 * A row tagged `canonical-v1` satisfies:
 *
 *     row.hash === computeCanonicalHash(
 *       buildCanonicalPayload({
 *         action: row.action,
 *         actorClerkUserId: row.actor_user_id,
 *         actorRole: row.actor_role,
 *         afterJson: row.after_json,
 *         hashTimestamp: row.occurred_at.toISOString(),
 *         orgId: row.org_id,
 *         targetId: row.target_id,
 *         targetType: row.target_type,
 *       }),
 *       row.previous_hash,
 *     )
 */
export function computeCanonicalHash(
  payload: CanonicalAuditPayload,
  previousHash: string | null,
): string {
  const wrapper = { payload, previousHash };
  return createHash('sha256').update(canonicalStringify(wrapper), 'utf8').digest('hex');
}

/**
 * Deterministic JSON serialiser: object keys are emitted in ASCII sort
 * order (recursively), arrays preserve order, primitives/nulls serialise
 * via `JSON.stringify`. This is the single serialisation authority for
 * canonical-v1 hashing so writer and verifier produce byte-identical
 * output regardless of runtime key-insertion order or `jsonb` storage
 * re-ordering.
 *
 * Reject `undefined` at the top level or inside objects/arrays: it is
 * ambiguous under JSON.stringify (either elided or serialised as `null`
 * inside arrays) and never appears in a canonical audit payload.
 */
export function canonicalStringify(value: unknown): string {
  if (value === undefined) {
    throw new Error('canonicalStringify: undefined is not a valid canonical value');
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item ?? null)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalStringify(v)}`)
      .join(',')}}`;
  }
  throw new Error(`canonicalStringify: unsupported value type ${typeof value}`);
}

type AuditWriter = (event: AbrAuditEvent) => Promise<{ id: string; hash: string; previousHash: string | null }>;

let auditWriterOverride: AuditWriter | null = null;
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveAuditOrgId(event: AbrAuditEvent): Promise<string> {
  const candidateOrgId = isUuid(event.orgId) ? event.orgId : null;
  const runtimeAllowsFallback =
    (process.env.PLAYWRIGHT_TEST_AUTH ?? '').toLowerCase() === 'true' ||
    (process.env.NODE_ENV ?? '').toLowerCase() !== 'production';

  if (candidateOrgId) {
    const exists = await platformDb.execute(sql`
      select id::text as id
      from orgs
      where id = ${candidateOrgId}::uuid
      limit 1
    `);
    if ((exists[0] as { id?: string } | undefined)?.id) {
      return candidateOrgId;
    }
    if (!runtimeAllowsFallback) {
      throw new Error('Audit org UUID is not present in orgs');
    }
  }

  const membershipRows = await platformDb.execute(sql`
    select organization_id::text as organization_id
    from user_management.organization_users
    where user_id = ${event.actorUserId}
      and is_active = true
    order by is_primary desc, created_at asc
    limit 1
  `);
  const membershipOrgId = (membershipRows[0] as { organization_id?: string } | undefined)?.organization_id ?? null;

  if (membershipOrgId && isUuid(membershipOrgId)) {
    const membershipOrgExists = await platformDb.execute(sql`
      select id::text as id
      from orgs
      where id = ${membershipOrgId}::uuid
      limit 1
    `);
    if ((membershipOrgExists[0] as { id?: string } | undefined)?.id) {
      return membershipOrgId;
    }
    if (!runtimeAllowsFallback) {
      throw new Error('Membership org UUID is not present in orgs');
    }
  }

  const fallbackRows = await platformDb.execute(sql`
    select id::text as id
    from orgs
    order by created_at asc
    limit 1
  `);
  const fallbackOrgId = (fallbackRows[0] as { id?: string } | undefined)?.id ?? null;
  if (fallbackOrgId) {
    return fallbackOrgId;
  }

  throw new Error('Unable to resolve platform org UUID for audit event');
}

const defaultAuditWriter: AuditWriter = async (event) => {
  const resolvedOrgId = await resolveAuditOrgId(event);

  const previousRows = await platformDb.execute(sql`
    select hash
    from audit_events
    where org_id = ${resolvedOrgId}
    order by created_at desc
    limit 1
  `);
  const previousHash = (previousRows[0] as { hash?: string } | undefined)?.hash ?? null;

  // Generate the canonical timestamp EXACTLY ONCE. This same string is
  // (a) included in the SHA-256 payload and (b) persisted in
  // `audit_events.occurred_at`. Persisting the same value is what allows
  // an independent verifier to recompute the hash from the row later.
  // Do not read `new Date().toISOString()` twice — the values would differ
  // by milliseconds and canonical recomputation would fail.
  const hashTimestamp = new Date().toISOString();
  const normalisedTargetId = event.recordId && isUuid(event.recordId) ? event.recordId : null;
  const normalisedAfterJson = event.details ?? null;

  const canonicalPayload = buildCanonicalPayload({
    action: event.action,
    actorClerkUserId: event.actorUserId,
    actorRole: null,
    afterJson: normalisedAfterJson,
    hashTimestamp,
    orgId: resolvedOrgId,
    targetId: normalisedTargetId,
    targetType: event.entityType,
  });
  const hash = computeCanonicalHash(canonicalPayload, previousHash);

  const inserted = await platformDb.execute(sql`
    insert into audit_events (
      org_id,
      actor_clerk_user_id,
      actor_role,
      action,
      target_type,
      target_id,
      after_json,
      hash,
      previous_hash,
      occurred_at,
      hash_version
    ) values (
      ${resolvedOrgId},
      ${event.actorUserId},
      ${null},
      ${event.action},
      ${event.entityType},
      ${normalisedTargetId}::uuid,
      ${normalisedAfterJson ? JSON.stringify(normalisedAfterJson) : null}::jsonb,
      ${hash},
      ${previousHash},
      ${hashTimestamp}::timestamptz,
      ${CANONICAL_HASH_VERSION}
    ) returning id, hash, previous_hash
  `);

  const row = inserted[0] as { id?: string; hash?: string; previous_hash?: string | null } | undefined;
  if (!row?.id || !row.hash) {
    throw new Error('Audit persistence returned no row');
  }

  return { id: row.id, hash: row.hash, previousHash: row.previous_hash ?? previousHash };
};

export function setAuditLogWriter(writer: AuditWriter | null): void {
  auditWriterOverride = writer;
}

async function persistAuditEvent(event: AbrAuditEvent): Promise<{ id: string; hash: string; previousHash: string | null }> {
  return (auditWriterOverride ?? defaultAuditWriter)(event);
}

export async function logAuditEvent(event: AbrAuditEvent): Promise<string> {
  const auditId = `abr_audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const result = await persistAuditEvent(event);
  logger.info('ABR audit event', {
    auditId,
    ...event,
    persistedId: result.id,
    hash: result.hash.slice(0, 12) + '…',
    timestamp: new Date().toISOString(),
  });

  return auditId;
}
