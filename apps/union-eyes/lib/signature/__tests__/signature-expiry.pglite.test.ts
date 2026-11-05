// F06 R4 — overdue signature requests are expired by a sweep, not only when somebody happens to try to sign them. Real SQL (PGlite): the
// documents found, the organization each change is made under, the signers lapsed, the trail and audit records, and the documents left alone.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'

const state = vi.hoisted(() => ({
  db: null as unknown,
  audit: [] as Array<Record<string, unknown>>,
  scopes: [] as string[],
  failFor: null as string | null,
}))

vi.mock('@/db', () => ({
  db: new Proxy({}, { get: (_t, p) => { const d = state.db as Record<PropertyKey, unknown> | null; const v = d?.[p]; return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(d) : v } }),
}))
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (fn: (tx: unknown) => unknown) => { state.scopes.push('system'); return fn(state.db) },
  withRLSContext: async (ctx: { organizationId: string }, fn: (tx: unknown) => unknown) => {
    state.scopes.push(ctx.organizationId)
    return fn(state.db)
  },
}))
vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: async (_tx: unknown, entry: Record<string, unknown>) => {
    if (state.failFor && entry.resourceId === state.failFor) throw new Error('audit down')
    state.audit.push(entry)
  },
}))
vi.mock('@/lib/services/notification-service', () => ({ NotificationService: {} }))
vi.mock('@/lib/services/document-storage-service', () => ({ default: class {} }))
vi.mock('@/lib/blob-client', () => ({ readBlobBounded: vi.fn() }))

import { SignatureService } from '../signature-service'

const ORG_A = '11111111-1111-4111-8111-111111111111'
const ORG_B = '22222222-2222-4222-8222-222222222222'
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
let pg: PGlite

const NOW = new Date('2026-11-01T12:00:00Z')
const PAST = '2026-10-01T00:00:00'
const FUTURE = '2026-12-01T00:00:00'

const doc = (n: number, org: string, status: string, expires: string | null, provider = 'internal') =>
  pg.query(`INSERT INTO signature_documents (id, organization_id, status, provider, expires_at) VALUES ($1, $2, $3, $4, $5)`, [id(n), org, status, provider, expires])
const signer = (n: number, document: number, status: string) =>
  pg.query(`INSERT INTO document_signers (id, document_id, status) VALUES ($1, $2, $3)`, [id(n), id(document), status])
const statusOf = async (n: number) => (await pg.query(`SELECT status FROM signature_documents WHERE id = $1`, [id(n)])).rows[0] as { status: string }
const signersOf = async (document: number) => (await pg.query(`SELECT status FROM document_signers WHERE document_id = $1 ORDER BY id`, [id(document)])).rows.map((r) => (r as { status: string }).status)

beforeAll(async () => {
  pg = new PGlite()
  state.db = drizzle(pg)
  await pg.exec(`
    CREATE TABLE signature_documents (id uuid primary key, organization_id uuid not null, status text not null, provider text not null,
      expires_at timestamp, updated_at timestamp not null default now());
    CREATE TABLE document_signers (id uuid primary key, document_id uuid not null, status text not null, updated_at timestamp not null default now());
    CREATE TABLE signature_audit_trail (
      id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      document_id uuid, signer_id uuid, event_type text not null, event_description text not null, actor_user_id text, actor_email text,
      actor_role text, ip_address text, user_agent text, timestamp timestamp not null default now(), geolocation jsonb, metadata jsonb, hash_chain text);
  `)
})
afterAll(async () => { await pg.close() })
beforeEach(async () => {
  state.audit.length = 0
  state.scopes.length = 0
  state.failFor = null
  await pg.exec('TRUNCATE signature_documents, document_signers, signature_audit_trail')
})

describe('signature expiry sweep', () => {
  it('expires an overdue open internal request in its own organization, lapses its unsettled signers and records the trail and audit', async () => {
    await doc(1, ORG_A, 'sent', PAST)
    await signer(11, 1, 'signed'); await signer(12, 1, 'pending'); await signer(13, 1, 'viewed'); await signer(14, 1, 'declined')

    const report = await SignatureService.expireOverdue({ now: NOW })

    expect(report).toEqual({ scanned: 1, expired: 1, failures: [], truncated: false })
    expect((await statusOf(1)).status).toBe('expired')
    // a signature already given and a decline already made are kept; the unsettled signers lapse
    expect(await signersOf(1)).toEqual(['signed', 'expired', 'expired', 'declined'])
    expect((await pg.query(`SELECT event_type, metadata FROM signature_audit_trail WHERE document_id = $1`, [id(1)])).rows).toEqual([
      expect.objectContaining({ event_type: 'document_expired', metadata: expect.objectContaining({ signersLapsed: 2 }) }),
    ])
    expect(state.audit).toEqual([expect.objectContaining({ organizationId: ORG_A, userId: 'system:signature-expiry', action: 'signature.document.expire', resourceId: id(1) })])
    // found by system authority, changed under the document's own organization
    expect(state.scopes[0]).toBe('system')
    expect(state.scopes.slice(1)).toEqual([ORG_A])
  })

  it('leaves current, final, provider-held and no-expiry documents alone', async () => {
    await doc(1, ORG_A, 'sent', FUTURE)
    await doc(2, ORG_A, 'completed', PAST)
    await doc(3, ORG_A, 'voided', PAST)
    await doc(4, ORG_A, 'expired', PAST)
    await doc(5, ORG_A, 'sent', PAST, 'docusign')
    await doc(6, ORG_A, 'sent', null)

    const report = await SignatureService.expireOverdue({ now: NOW })

    expect(report).toMatchObject({ scanned: 0, expired: 0 })
    expect((await Promise.all([1, 2, 3, 4, 5, 6].map(statusOf))).map((r) => r.status)).toEqual(['sent', 'completed', 'voided', 'expired', 'sent', 'sent'])
    expect(state.audit).toEqual([])
  })

  it('expires documents of several organizations, each under its own organization', async () => {
    await doc(1, ORG_A, 'pending', PAST)
    await doc(2, ORG_B, 'sent', PAST)

    const report = await SignatureService.expireOverdue({ now: NOW })

    expect(report).toMatchObject({ scanned: 2, expired: 2 })
    expect(new Set(state.scopes.slice(1))).toEqual(new Set([ORG_A, ORG_B]))
    expect(state.audit.map((e) => [e.resourceId, e.organizationId])).toEqual([[id(1), ORG_A], [id(2), ORG_B]])
  })

  it('is idempotent: a second run finds nothing and writes nothing more', async () => {
    await doc(1, ORG_A, 'sent', PAST)
    await SignatureService.expireOverdue({ now: NOW })
    state.audit.length = 0

    expect(await SignatureService.expireOverdue({ now: NOW })).toMatchObject({ scanned: 0, expired: 0 })
    expect(state.audit).toEqual([])
    expect((await pg.query(`SELECT count(*)::int AS n FROM signature_audit_trail`)).rows[0]).toEqual({ n: 1 })
  })

  it('rolls one document back when its audit cannot be written, reports it, and still expires the rest', async () => {
    await doc(1, ORG_A, 'sent', PAST); await signer(11, 1, 'pending')
    await doc(2, ORG_A, 'sent', PAST)
    state.failFor = id(1)

    const report = await SignatureService.expireOverdue({ now: NOW })

    expect(report.expired).toBe(1)
    expect(report.failures).toEqual([{ documentId: id(1), reason: 'audit down' }])
    expect((await statusOf(2)).status).toBe('expired')
    // The mocked context here is not a transaction, so the failed document's rollback is proven natively
    // (db/__tests__/signature-expiry.postgres.test.ts); this case proves it is reported and does not stop the rest.
  })

  it('pages through more overdue documents than one page holds and says when it stopped at its bound', async () => {
    for (let n = 1; n <= 5; n += 1) await doc(n, ORG_A, 'sent', PAST)

    const paged = await SignatureService.expireOverdue({ now: NOW, pageSize: 2, maxPages: 10 })
    expect(paged).toMatchObject({ scanned: 5, expired: 5, truncated: false })

    for (let n = 11; n <= 15; n += 1) await doc(n, ORG_A, 'sent', PAST)
    const bounded = await SignatureService.expireOverdue({ now: NOW, pageSize: 2, maxPages: 2 })
    expect(bounded).toMatchObject({ scanned: 4, expired: 4, truncated: true })
  })
})
