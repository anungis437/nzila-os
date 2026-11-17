import { sql } from 'drizzle-orm'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { appendCanonicalAuditLog, appendCanonicalPlatformAuditLog } from './canonical-audit-chain'
import {
  AuditPrefixVerifier, DAILY_AUDIT_SEAL_ACTION, auditSealKeyFingerprint,
  createDailyAuditSeal, verifyDailyAuditSeal, type AuditSealRecord,
} from './daily-audit-seal'

const PAGE_SIZE = 100
const MAX_SCAN_MS = 25_000
export const MAX_AUDIT_SEAL_AGE_MS = 25 * 60 * 60_000

/** JSON produced by PostgreSQL preserves microseconds and inet/UUID values;
 * converting selected timestamps through the JS driver would change a seal. */
export async function inspectAuditPartition(
  tx: RLSTx, organizationId: string | null, keys: ReadonlyMap<string, string>, asOf = new Date(),
) {
  const started = Date.now()
  const partition = organizationId === null ? sql`organization_id IS NULL` : sql`organization_id = ${organizationId}::uuid`
  const verifier = new AuditPrefixVerifier(organizationId, asOf.getTime())
  let cursor: { id: string; at: string } | undefined
  let latestSeal: { id: string; sealedAt: string; day: string } | null = null
  // Capture a finite prefix. Concurrent append-only writers need not wait for
  // a monitoring read; a sealing writer holds the partition lock separately.
  const [tip] = await tx.execute<{ id: string; at: string }>(sql`
    SELECT id::text, created_at::text AS at FROM public.audit_logs WHERE ${partition}
    ORDER BY created_at DESC, id DESC LIMIT 1`)
  while (tip) {
    if (Date.now() - started > MAX_SCAN_MS) throw new Error('UE_AUDIT_SEAL_SCAN_TIMEOUT')
    const after = cursor ? sql`AND (created_at, id) > (${cursor.at}::timestamptz, ${cursor.id}::uuid)` : sql``
    const rows = await tx.execute<{ event: AuditSealRecord | null; at: string }>(sql`
      SELECT CASE WHEN pg_column_size(a) <= 262144 THEN to_jsonb(a) ELSE NULL END AS event,
        created_at::text AS at FROM public.audit_logs a
      WHERE ${partition} ${after} AND (created_at, id) <= (${tip.at}::timestamptz, ${tip.id}::uuid)
      ORDER BY created_at, id LIMIT ${PAGE_SIZE}`)
    if (!rows.length) break
    for (const { event } of rows) {
      if (!event) throw new Error('UE_AUDIT_SEAL_EVENT_SIZE_LIMIT')
      if (event.action === DAILY_AUDIT_SEAL_ACTION) {
        const manifest = verifyDailyAuditSeal({ record: event, prefix: verifier.snapshot(),
          previousSealRecordId: latestSeal?.id ?? null, keys })
        latestSeal = { id: event.id, sealedAt: manifest.sealedAt, day: manifest.day }
      }
      verifier.append(event)
    }
    const last = rows[rows.length - 1]
    if (!last.event) throw new Error('UE_AUDIT_SEAL_EVENT_SIZE_LIMIT')
    cursor = { id: last.event.id, at: last.at }
    if (cursor.id === tip.id) break
  }
  if (tip && cursor?.id !== tip.id) throw new Error('UE_AUDIT_SEAL_PREFIX_CHANGED')
  return { prefix: verifier.snapshot(), latestSeal }
}

/** Call only inside a real SYSTEM transaction. The existing audit partition
 * lock plus the deterministic primary key serialize retries and duplicates.
 * The seal itself is the durable event: there is no detached success marker. */
export async function sealAuditPartition(tx: RLSTx, input: {
  organizationId: string | null; sourceSha: string; key: string
}) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`audit_logs:${input.organizationId ?? 'platform'}`}, 0))`)
  const [clock] = await tx.execute<{ at: string }>(sql`SELECT clock_timestamp()::text AS at`)
  const sealedAt = new Date(clock.at)
  const keys = new Map([[auditSealKeyFingerprint(input.key), input.key]])
  const inspected = await inspectAuditPartition(tx, input.organizationId, keys, sealedAt)
  if (inspected.latestSeal?.day === sealedAt.toISOString().slice(0, 10)) {
    return { created: false, recordId: inspected.latestSeal.id, sealedAt: inspected.latestSeal.sealedAt }
  }
  const seal = createDailyAuditSeal({ prefix: inspected.prefix, sealedAt,
    previousSealRecordId: inspected.latestSeal?.id ?? null, sourceSha: input.sourceSha, key: input.key })
  const entry = { action: DAILY_AUDIT_SEAL_ACTION, resourceType: 'audit_checkpoint',
    resourceId: seal.recordId, details: { manifest: seal.manifest, signature: seal.signature } }
  if (input.organizationId === null) await appendCanonicalPlatformAuditLog(tx, entry, { recordId: seal.recordId })
  else await appendCanonicalAuditLog(tx, { ...entry, organizationId: input.organizationId }, { recordId: seal.recordId })
  return { created: true, recordId: seal.recordId, sealedAt: seal.manifest.sealedAt }
}

export function auditSealFreshness(sealedAt: string | null, now = Date.now()) {
  const at = sealedAt === null ? NaN : Date.parse(sealedAt)
  const ageMs = now - at
  return Number.isFinite(at) && ageMs >= -5 * 60_000 && ageMs <= MAX_AUDIT_SEAL_AGE_MS
}

/** A bounded, explicit census of partitions that contain real audit events.
 * NULL is always included so platform work is sealed even before its first event. */
export async function auditPartitions(tx: RLSTx): Promise<(string | null)[]> {
  const rows = await tx.execute<{ id: string | null }>(sql`
    SELECT DISTINCT organization_id::text AS id FROM public.audit_logs
    ORDER BY id NULLS FIRST LIMIT 1001`)
  if (rows.length > 1000) throw new Error('UE_AUDIT_SEAL_PARTITION_LIMIT')
  return [null, ...rows.flatMap(row => row.id === null ? [] : [row.id])]
}
