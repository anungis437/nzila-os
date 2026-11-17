import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { canonicalAuditContentHash, canonicalPythonJson } from './canonical-audit-chain'

export const DAILY_AUDIT_SEAL_ACTION = 'operational.audit.daily_seal'
export const AUDIT_SEAL_MAX_RECORDS = 250_000
const HEX = /^[0-9a-f]{64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CLOCK_SKEW_MS = 5 * 60_000

// updated_at is administrative metadata, not part of the immutable event.
// This declared list also prevents a future schema addition from silently
// changing what an existing version-1 checkpoint attests to.
export const AUDIT_SEAL_FIELDS = [
  'id', 'audit_id', 'organization_id', 'created_at', 'action', 'resource_type',
  'resource_id', 'user_id', 'ip_address', 'user_agent', 'correlation_id',
  'details', 'changes', 'content_hash', 'previous_hash',
] as const

export type AuditSealRecord = Record<string, unknown> & {
  id: string; organization_id: string | null; created_at: string
  action: string | null; resource_type: string | null; resource_id: string | null
  user_id: string | null; correlation_id: string | null
  details: Record<string, unknown> | null; content_hash: string | null; previous_hash: string | null
}

export type AuditPrefix = {
  organizationId: string | null; coveredEntryCount: number; rootHash: string
  tipHash: string | null; throughAuditId: string | null; throughCreatedAt: string | null
}

export class AuditPrefixVerifier {
  private count = 0
  private tip: string | null = null
  private lastId: string | null = null
  private lastAt: string | null = null
  private readonly ids = new Set<string>()
  private readonly digest = createHash('sha256')

  constructor(readonly organizationId: string | null, private readonly asOf = Date.now()) {
    if (organizationId !== null && !UUID.test(organizationId)) throw new Error('UE_AUDIT_SEAL_ORGANIZATION_INVALID')
    this.digest.update(canonicalPythonJson({ domain: 'UE_AUDIT_PREFIX_V1', organizationId, fields: AUDIT_SEAL_FIELDS }))
  }

  append(record: AuditSealRecord): void {
    if (record.organization_id !== this.organizationId || !UUID.test(record.id) || this.ids.has(record.id)) throw new Error('UE_AUDIT_SEAL_RECORD_SCOPE_INVALID')
    if (++this.count > AUDIT_SEAL_MAX_RECORDS) throw new Error('UE_AUDIT_SEAL_HISTORY_LIMIT')
    const at = Date.parse(record.created_at)
    if (!Number.isFinite(at) || at > this.asOf + CLOCK_SKEW_MS) throw new Error('UE_AUDIT_SEAL_EVENT_CLOCK_INVALID')
    const previous = record.previous_hash || null
    if (previous !== this.tip || !record.content_hash || !HEX.test(record.content_hash)) throw new Error('UE_AUDIT_SEAL_CHAIN_INVALID')
    const expected = canonicalAuditContentHash({
      action: record.action ?? '', resourceType: record.resource_type ?? '',
      resourceId: record.resource_id ?? '', userId: record.user_id ?? '',
      correlationId: record.correlation_id ?? '', details: record.details ?? {}, previousHash: previous,
    })
    if (expected !== record.content_hash) throw new Error('UE_AUDIT_SEAL_EVENT_HASH_INVALID')
    const event: Record<string, unknown> = {}
    for (const field of AUDIT_SEAL_FIELDS) {
      if (!(field in record)) throw new Error('UE_AUDIT_SEAL_EVENT_FIELD_MISSING')
      event[field] = record[field]
    }
    this.digest.update('\n').update(canonicalPythonJson(event))
    this.ids.add(record.id)
    this.tip = record.content_hash
    this.lastId = record.id
    this.lastAt = record.created_at
  }

  snapshot(): AuditPrefix {
    return { organizationId: this.organizationId, coveredEntryCount: this.count,
      rootHash: this.digest.copy().digest('hex'), tipHash: this.tip,
      throughAuditId: this.lastId, throughCreatedAt: this.lastAt }
  }
}

const manifestSchema = z.object({
  version: z.literal(1),
  coverage: z.literal('CANONICAL_CHAIN_AND_DECLARED_IMMUTABLE_FIELDS'),
  organizationId: z.guid().nullable(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sealedAt: z.iso.datetime({ offset: true }),
  coveredEntryCount: z.number().int().min(0).max(AUDIT_SEAL_MAX_RECORDS),
  rootHash: z.string().regex(HEX), tipHash: z.string().regex(HEX).nullable(),
  throughAuditId: z.guid().nullable(), throughCreatedAt: z.iso.datetime({ offset: true }).nullable(),
  previousSealRecordId: z.guid().nullable(), sourceSha: z.string().regex(/^[0-9a-f]{40}$/),
  keyFingerprint: z.string().regex(HEX),
  fields: z.array(z.string()).refine(value => JSON.stringify(value) === JSON.stringify(AUDIT_SEAL_FIELDS)),
}).strict()

export type DailyAuditSealManifest = z.infer<typeof manifestSchema>

export function auditSealKeyFingerprint(key: string): string {
  if (key.trim().length < 32) throw new Error('UE_AUDIT_SEAL_KEY_UNAVAILABLE')
  return createHash('sha256').update(key).digest('hex')
}

export function dailyAuditSealId(organizationId: string | null, day: string): string {
  const bytes = createHash('sha256').update(`UE_AUDIT_DAILY_SEAL_ID_V1:${organizationId ?? 'platform'}:${day}`).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function signature(manifest: DailyAuditSealManifest, key: string): string {
  return createHmac('sha256', key).update('UE_AUDIT_DAILY_SEAL_V1\n').update(canonicalPythonJson(manifest)).digest('hex')
}

export function createDailyAuditSeal(input: {
  prefix: AuditPrefix; sealedAt: Date; previousSealRecordId: string | null; sourceSha: string; key: string
}) {
  const sealedAt = input.sealedAt.toISOString()
  const candidate = { ...input.prefix, version: 1, coverage: 'CANONICAL_CHAIN_AND_DECLARED_IMMUTABLE_FIELDS',
    day: sealedAt.slice(0, 10), sealedAt, previousSealRecordId: input.previousSealRecordId,
    sourceSha: input.sourceSha, keyFingerprint: auditSealKeyFingerprint(input.key), fields: [...AUDIT_SEAL_FIELDS] }
  const parsed = manifestSchema.safeParse(candidate)
  if (!parsed.success) throw new Error('UE_AUDIT_SEAL_MANIFEST_INVALID')
  return { recordId: dailyAuditSealId(parsed.data.organizationId, parsed.data.day),
    manifest: parsed.data, signature: signature(parsed.data, input.key) }
}

/** Verify a checkpoint against the actual prefix preceding its own ledger row.
 * Missing retained keys and unsupported historic data fail closed. No rows are
 * repaired, backdated, skipped or relabeled as fully chained. */
export function verifyDailyAuditSeal(input: {
  record: AuditSealRecord; prefix: AuditPrefix; previousSealRecordId: string | null
  keys: ReadonlyMap<string, string>
}): DailyAuditSealManifest {
  const { record, prefix } = input
  const parsed = manifestSchema.safeParse(record.details?.manifest)
  if (record.action !== DAILY_AUDIT_SEAL_ACTION || !parsed.success) throw new Error('UE_AUDIT_SEAL_MANIFEST_INVALID')
  const manifest = parsed.data
  const mac = record.details?.signature
  if (typeof mac !== 'string' || !HEX.test(mac)) throw new Error('UE_AUDIT_SEAL_SIGNATURE_INVALID')
  if (manifest.day !== manifest.sealedAt.slice(0, 10) || dailyAuditSealId(manifest.organizationId, manifest.day) !== record.id || record.organization_id !== manifest.organizationId) throw new Error('UE_AUDIT_SEAL_IDENTITY_INVALID')
  if (Math.abs(Date.parse(record.created_at) - Date.parse(manifest.sealedAt)) > CLOCK_SKEW_MS) throw new Error('UE_AUDIT_SEAL_CHECKPOINT_CLOCK_INVALID')
  for (const field of ['organizationId', 'coveredEntryCount', 'rootHash', 'tipHash', 'throughAuditId', 'throughCreatedAt'] as const) {
    if (manifest[field] !== prefix[field]) throw new Error('UE_AUDIT_SEAL_PREFIX_INVALID')
  }
  if (manifest.previousSealRecordId !== input.previousSealRecordId) throw new Error('UE_AUDIT_SEAL_PREDECESSOR_INVALID')
  const key = input.keys.get(manifest.keyFingerprint)
  if (!key || auditSealKeyFingerprint(key) !== manifest.keyFingerprint) throw new Error('UE_AUDIT_SEAL_RETAINED_KEY_UNAVAILABLE')
  if (!timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(signature(manifest, key), 'hex'))) throw new Error('UE_AUDIT_SEAL_SIGNATURE_INVALID')
  return manifest
}
