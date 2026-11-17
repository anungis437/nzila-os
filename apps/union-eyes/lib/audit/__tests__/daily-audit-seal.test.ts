import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { canonicalAuditContentHash } from '../canonical-audit-chain'
import { AuditPrefixVerifier, DAILY_AUDIT_SEAL_ACTION, auditSealKeyFingerprint,
  createDailyAuditSeal, verifyDailyAuditSeal, type AuditSealRecord } from '../daily-audit-seal'

const org = randomUUID()
const key = 'synthetic-daily-seal-unit-key-only-123456'
const sourceSha = 'a'.repeat(40)
const now = new Date('2026-11-17T01:00:00Z')
function event(previous: string | null = null, details = {}): AuditSealRecord {
  const row: AuditSealRecord = { id: randomUUID(), audit_id: randomUUID(), organization_id: org,
    created_at: '2026-11-17T00:00:00.123456+00:00', updated_at: '2026-11-17T00:00:00.123456+00:00',
    action: 'case.created', resource_type: 'claim', resource_id: randomUUID(), user_id: randomUUID(),
    ip_address: '203.0.113.1', user_agent: 'synthetic', correlation_id: null, details,
    changes: {}, content_hash: null, previous_hash: previous }
  row.content_hash = canonicalAuditContentHash({ action: row.action!, resourceType: row.resource_type!,
    resourceId: row.resource_id!, userId: row.user_id!, correlationId: '', details, previousHash: previous })
  return row
}
function checkpoint() {
  const row = event(null, { label: 'é😀', amount: 2 })
  const verifier = new AuditPrefixVerifier(org, now.getTime())
  verifier.append(row)
  const prefix = verifier.snapshot()
  const seal = createDailyAuditSeal({ prefix, sealedAt: now, previousSealRecordId: null, sourceSha, key })
  const record = { ...event(prefix.tipHash), id: seal.recordId, created_at: now.toISOString(),
    action: DAILY_AUDIT_SEAL_ACTION, details: { manifest: seal.manifest, signature: seal.signature } }
  return { row, prefix, seal, record, keys: new Map([[auditSealKeyFingerprint(key), key]]) }
}

describe('keyed daily audit checkpoints', () => {
  it('verifies the exact prefix including PostgreSQL microsecond timestamps', () => {
    const c = checkpoint()
    expect(verifyDailyAuditSeal({ ...c, previousSealRecordId: null })).toEqual(c.seal.manifest)
    expect(c.seal.manifest.throughCreatedAt).toContain('.123456')
  })
  it('uses one stable database identity per partition and UTC day', () => {
    const c = checkpoint()
    const retry = createDailyAuditSeal({ prefix: c.prefix, sealedAt: new Date('2026-11-17T03:00Z'),
      previousSealRecordId: null, sourceSha, key })
    expect(retry.recordId).toBe(c.seal.recordId)
    expect(retry.signature).not.toBe(c.seal.signature)
  })
  it.each(['id', 'audit_id', 'created_at', 'ip_address', 'user_agent', 'changes'])(
    'detects changes to %s even when the old content hash does not cover that field', field => {
      const c = checkpoint()
      const verifier = new AuditPrefixVerifier(org, now.getTime())
      const replacement = { ...c.row, [field]: field.endsWith('id') ? randomUUID() :
        field === 'created_at' ? '2026-11-17T00:00:01.123456+00:00' : field === 'changes' ? { forged: true } : 'modified' }
      verifier.append(replacement)
      expect(() => verifyDailyAuditSeal({ ...c, prefix: verifier.snapshot(), previousSealRecordId: null })).toThrow('PREFIX_INVALID')
    })
  it('detects both ordinary hash corruption and whole-prefix rehashing without the key', () => {
    const c = checkpoint()
    const bad = new AuditPrefixVerifier(org, now.getTime())
    expect(() => bad.append({ ...c.row, details: { forged: true } })).toThrow('EVENT_HASH_INVALID')
    const forged = event(null, { forged: true })
    const rebuilt = new AuditPrefixVerifier(org, now.getTime()); rebuilt.append(forged)
    const fabricated = { ...c.record, details: { ...c.record.details,
      manifest: { ...c.seal.manifest, ...rebuilt.snapshot() } } }
    expect(() => verifyDailyAuditSeal({ record: fabricated, prefix: rebuilt.snapshot(), keys: c.keys,
      previousSealRecordId: null })).toThrow('SIGNATURE_INVALID')
  })
  it('refuses missing retained keys, foreign partitions, missing predecessors and future events', () => {
    const c = checkpoint()
    expect(() => verifyDailyAuditSeal({ ...c, keys: new Map(), previousSealRecordId: null })).toThrow('RETAINED_KEY_UNAVAILABLE')
    expect(() => verifyDailyAuditSeal({ ...c, previousSealRecordId: randomUUID() })).toThrow('PREDECESSOR_INVALID')
    expect(() => new AuditPrefixVerifier(null).append(c.row)).toThrow('SCOPE_INVALID')
    expect(() => new AuditPrefixVerifier(org, 0).append(c.row)).toThrow('CLOCK_INVALID')
  })
  it('refuses an incomplete record, duplicate event and an unkeyed manifest', () => {
    const c = checkpoint()
    const verifier = new AuditPrefixVerifier(org, now.getTime()); verifier.append(c.row)
    expect(() => verifier.append(c.row)).toThrow('SCOPE_INVALID')
    const { changes: _changes, ...incomplete } = c.row
    expect(() => new AuditPrefixVerifier(org, now.getTime()).append(incomplete as AuditSealRecord)).toThrow('FIELD_MISSING')
    expect(() => createDailyAuditSeal({ prefix: c.prefix, sealedAt: now, previousSealRecordId: null, sourceSha, key: '' })).toThrow('KEY_UNAVAILABLE')
  })
})
