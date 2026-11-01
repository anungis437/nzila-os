// The signature audit chain against real PostgreSQL semantics (PGlite): events logged one after another and at once form one chain, a
// stored row that is changed or removed breaks it where it was touched, and the seal written at completion is checked against it.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'

const state = vi.hoisted(() => ({ db: null as unknown, pg: null as unknown, audit: [] as Array<Record<string, unknown>> }))

vi.mock('@/db', () => ({
  db: new Proxy({}, { get: (_t, p) => { const d = state.db as Record<PropertyKey, unknown> | null; const v = d?.[p]; return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(d) : v } }),
}))
// Records the entry and writes it to the legacy audit table, the platform record the seal is later checked against.
vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: async (_tx: unknown, entry: Record<string, unknown>) => {
    state.audit.push(entry)
    await (state.pg as { query: (t: string, p: unknown[]) => Promise<unknown> }).query('INSERT INTO audit_security.audit_logs (organization_id, action, resource_id, metadata) VALUES ($1, $2, $3, $4)', [entry.organizationId, entry.action, entry.resourceId, JSON.stringify(entry.details)])
  },
}))
vi.mock('@/lib/services/notification-service', () => ({ NotificationService: {} }))
vi.mock('@/lib/services/document-storage-service', () => ({ default: class {} }))
vi.mock('@/lib/blob-client', () => ({ readBlobBounded: vi.fn() }))

import { AuditTrailService } from '../signature-service'

const DOC = '00000000-0000-4000-8000-0000000000d1'
const OTHER = '00000000-0000-4000-8000-0000000000d2'
const ORG = '11111111-1111-4111-8111-111111111111'
let pg: PGlite
const q = (text: string, params: unknown[] = []) => pg.query(text, params)
const trail = async (doc = DOC) =>
  (await q(`SELECT event_type, event_description, hash_chain, metadata FROM signature_audit_trail WHERE document_id = $1 ORDER BY (metadata->>'chainSeq')::int NULLS FIRST`, [doc])).rows as Array<{
    event_type: string; event_description: string; hash_chain: string | null; metadata: { chainSeq?: number; sealedHead?: string } | null
  }>

const log = (eventType: string, description = eventType, doc = DOC) =>
  AuditTrailService.log({ documentId: doc, eventType, eventDescription: description, actorUserId: 'user-1', ipAddress: '203.0.113.7', metadata: { signatureType: 'electronic' } })

beforeAll(async () => {
  pg = new PGlite()
  state.db = drizzle(pg)
  state.pg = pg
  await pg.exec(`
    CREATE SCHEMA audit_security;
    CREATE TABLE audit_security.audit_logs (organization_id uuid, action text, resource_id uuid, metadata jsonb);
    CREATE TABLE signature_audit_trail (
      id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      document_id uuid, signer_id uuid, event_type text not null, event_description text not null, actor_user_id text, actor_email text,
      actor_role text, ip_address text, user_agent text, timestamp timestamp not null default now(), geolocation jsonb, metadata jsonb, hash_chain text);
  `)
})
afterAll(async () => { await pg.close() })
beforeEach(async () => { state.audit.length = 0; await pg.exec('TRUNCATE signature_audit_trail; TRUNCATE audit_security.audit_logs') })

describe('signature audit chain on real SQL', () => {
  it('chains events one after another from sequence 1, each hash following the one before', async () => {
    await log('document_sent'); await log('document_signed'); await log('document_completed')

    const rows = await trail()
    expect(rows.map((r) => r.metadata?.chainSeq)).toEqual([1, 2, 3])
    expect(new Set(rows.map((r) => r.hash_chain)).size).toBe(3)
    expect(rows.every((r) => r.hash_chain?.startsWith('sha256:'))).toBe(true)
    expect(await AuditTrailService.verifyChain(DOC)).toMatchObject({ ok: true, chained: 3, legacyUnchained: 0 })
  })

  it('keeps one chain when events are logged at once', async () => {
    await Promise.all(Array.from({ length: 6 }, (_, i) => log(`event_${i}`)))

    const rows = await trail()
    expect(rows.map((r) => r.metadata?.chainSeq)).toEqual([1, 2, 3, 4, 5, 6])
    expect(await AuditTrailService.verifyChain(DOC)).toMatchObject({ ok: true, chained: 6 })
  })

  it('keeps two documents\' chains separate', async () => {
    await log('document_sent', 'a', DOC); await log('document_sent', 'b', OTHER); await log('document_signed', 'a2', DOC)

    expect((await trail(DOC)).map((r) => r.metadata?.chainSeq)).toEqual([1, 2])
    expect((await trail(OTHER)).map((r) => r.metadata?.chainSeq)).toEqual([1])
    expect((await AuditTrailService.verifyChain(OTHER)).ok).toBe(true)
  })

  it('detects an event whose description was changed in the table', async () => {
    await log('document_sent'); await log('document_signed'); await log('document_completed')
    await q(`UPDATE signature_audit_trail SET event_description = 'someone else signed' WHERE event_type = 'document_signed'`)

    expect(await AuditTrailService.verifyChain(DOC)).toMatchObject({ ok: false, brokenAtSeq: 2, reason: 'hash_mismatch' })
  })

  it('detects an event that was deleted from the middle', async () => {
    await log('document_sent'); await log('document_signed'); await log('document_completed')
    await q(`DELETE FROM signature_audit_trail WHERE event_type = 'document_signed'`)

    expect(await AuditTrailService.verifyChain(DOC)).toMatchObject({ ok: false, brokenAtSeq: 2, reason: 'sequence_gap' })
  })

  it('counts the trail from before chaining as unchained and chains new events after it', async () => {
    await q(`INSERT INTO signature_audit_trail (document_id, event_type, event_description) VALUES ($1, 'document_sent', 'before chaining')`, [DOC])
    await log('document_signed')

    expect(await AuditTrailService.verifyChain(DOC)).toMatchObject({ ok: true, chained: 1, legacyUnchained: 1 })
  })
})

describe('sealing at completion', () => {
  const integrity = async () => {
    const rows = (await q(`SELECT event_type, metadata FROM signature_audit_trail WHERE document_id = $1`, [DOC])).rows as Array<{ eventType: string; metadata: unknown }>
    return (AuditTrailService as unknown as { integrityStatement(d: string, l: Array<{ eventType: string; metadata: unknown }>, tx: unknown): Promise<Record<string, unknown>> })
      .integrityStatement(DOC, rows.map((r) => ({ eventType: (r as unknown as { event_type: string }).event_type, metadata: r.metadata })), state.db)
  }

  it('records the verified head as the last chained event and in the platform audit log', async () => {
    await log('document_sent'); await log('document_signed'); await log('document_completed')
    const before = await AuditTrailService.verifyChain(DOC)

    const result = await AuditTrailService.seal(DOC, ORG, state.db as never)

    expect(result).toMatchObject({ sealed: true, head: before.ok ? before.head : null })
    const rows = await trail()
    expect(rows.at(-1)).toMatchObject({ event_type: 'document_sealed' })
    expect(rows.at(-1)?.metadata?.sealedHead).toBe(before.ok ? before.head : null)
    expect(state.audit).toContainEqual(expect.objectContaining({ organizationId: ORG, action: 'signature.document.sealed', details: { chainHead: before.ok ? before.head : null, chainedEvents: 3 } }))
    expect(await integrity()).toMatchObject({ hashChained: true, chainVerified: true, sealed: true })
  })

  it('does not seal a trail whose chain does not verify', async () => {
    await log('document_sent'); await log('document_signed')
    await q(`UPDATE signature_audit_trail SET actor_user_id = 'someone-else' WHERE event_type = 'document_sent'`)

    expect(await AuditTrailService.seal(DOC, ORG, state.db as never)).toEqual({ sealed: false })
    expect(state.audit).toHaveLength(0)
    expect(await integrity()).toMatchObject({ chainVerified: false, sealed: false, brokenAtSequence: 1 })
  })

  it('does not call a trail sealed that was never sealed, and says so', async () => {
    await log('document_sent')

    const statement = await integrity()
    expect(statement).toMatchObject({ chainVerified: true, sealed: false })
    expect(String(statement.notice)).toContain('has not been sealed')
  })

  it('detects a forged seal as a broken chain', async () => {
    await log('document_sent'); await log('document_completed')
    await AuditTrailService.seal(DOC, ORG, state.db as never)
    await q(`UPDATE signature_audit_trail SET metadata = jsonb_set(metadata, '{sealedHead}', '"sha256:forged"') WHERE event_type = 'document_sealed'`)

    expect(await integrity()).toMatchObject({ chainVerified: false, sealed: false })
  })

  it('never describes a trail with no chained event as verified', async () => {
    await q(`INSERT INTO signature_audit_trail (document_id, event_type, event_description) VALUES ($1, 'document_sent', 'before chaining')`, [DOC])

    const statement = await integrity()
    expect(statement).toMatchObject({ hashChained: false, chainVerified: false, sealed: false, unchainedEvents: 1 })
    expect(String(statement.notice)).toContain('not tamper-evident')
  })
})

describe('the trail checked against the seal in the platform audit log', () => {
  const integrityOf = async (documentStatus = 'completed') => {
    const rows = (await q(`SELECT event_type, metadata FROM signature_audit_trail WHERE document_id = $1`, [DOC])).rows as Array<{ event_type: string; metadata: unknown }>
    return (AuditTrailService as unknown as { integrityStatement(d: string, l: Array<{ eventType: string; metadata: unknown }>, tx: unknown, c: { organizationId: string; documentStatus: string }): Promise<Record<string, unknown>> })
      .integrityStatement(DOC, rows.map((r) => ({ eventType: r.event_type, metadata: r.metadata })), state.db, { organizationId: ORG, documentStatus })
  }
  const sealed = async () => { await log('document_sent'); await log('document_signed'); await log('document_completed'); await AuditTrailService.seal(DOC, ORG, state.db as never) }

  it('corroborates an untouched sealed trail', async () => {
    await sealed()

    const statement = await integrityOf()
    expect(statement).toMatchObject({ chainVerified: true, sealed: true, sealRecord: 'corroborated' })
    expect(String(statement.notice)).toContain('matches the platform audit log')
  })

  it('shows the removal of the newest events even though the shortened chain still verifies', async () => {
    await sealed()
    await q(`DELETE FROM signature_audit_trail WHERE (metadata->>'chainSeq')::int >= 3`)

    expect(await AuditTrailService.verifyChain(DOC)).toMatchObject({ ok: true, chained: 2 })
    const statement = await integrityOf()
    expect(statement).toMatchObject({ chainVerified: true, sealed: false, sealRecord: 'history_missing' })
    expect(String(statement.notice)).toContain('may have been removed')
  })

  it('shows the removal of the seal event alone', async () => {
    await sealed()
    await q(`DELETE FROM signature_audit_trail WHERE event_type = 'document_sealed'`)

    expect(await integrityOf()).toMatchObject({ chainVerified: true, sealed: false, sealRecord: 'seal_event_missing' })
  })

  it('shows a rewritten and rechained trail by the head the platform recorded', async () => {
    await sealed()
    await q(`UPDATE audit_security.audit_logs SET metadata = jsonb_set(metadata, '{chainHead}', '"sha256:not-the-head"')`)

    expect(await integrityOf()).toMatchObject({ sealed: false, sealRecord: 'head_mismatch' })
  })

  it('says the seal could not be checked when the platform record is absent, and does not call that corroboration', async () => {
    await sealed()
    await q('TRUNCATE audit_security.audit_logs')

    const statement = await integrityOf()
    expect(statement).toMatchObject({ sealed: true, sealRecord: 'none' })
    expect(String(statement.notice)).toContain('could not be checked')
  })

  it('does not describe a completed but never sealed document as merely incomplete', async () => {
    await log('document_sent'); await log('document_completed')

    const statement = await integrityOf('completed')
    expect(statement).toMatchObject({ sealed: false, sealRecord: 'none' })
    expect(String(statement.notice)).toContain('has no seal')
    expect(String(statement.notice)).not.toContain('document is not complete')
  })

  it('reports an unreadable platform record as unavailable, and leaves the caller\'s transaction usable', async () => {
    await sealed()
    await q('ALTER TABLE audit_security.audit_logs RENAME TO audit_logs_away')
    try {
      expect(await integrityOf()).toMatchObject({ sealRecord: 'unavailable', chainVerified: true })
    } finally {
      await q('ALTER TABLE audit_security.audit_logs_away RENAME TO audit_logs')
    }
  })
})
