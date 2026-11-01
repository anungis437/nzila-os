/**
 * F06 R4 on real PostgreSQL — the signature expiry sweep under the real roles.
 *
 * The overdue documents are found by the SYSTEM role (a cross-organization SELECT on signature_documents only, the grant the storage-authority
 * manifest now declares) and each is expired inside its own organization as the RUNTIME role under row-level security, with the trail event and
 * the platform audit record in the same transaction. Proves the grant and policies are sufficient, that nothing outside the sweep's
 * authority is touched, and that organizations stay isolated.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 * Needs UE_CANONICAL_BOOTSTRAP_V2=1 (the canonical audit ledger, where a system actor is recorded under the organization).
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const holder = vi.hoisted(() => ({ pool: null as unknown }))

vi.mock('@/db', () => ({ db: {} }))
vi.mock('@/lib/services/notification-service', () => ({ NotificationService: {} }))
vi.mock('@/lib/services/document-storage-service', () => ({ default: class {} }))
vi.mock('@/lib/blob-client', () => ({ readBlobBounded: vi.fn() }))
vi.mock('@/lib/db/with-rls-context', () => {
  const run = async <T,>(role: string, org: string | null, fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const client = await (holder.pool as pg.Pool).connect()
    try {
      // A drizzle TRANSACTION object, as the application's withRLSContext hands out, so a nested transaction (the audit trail's own) is a
      // savepoint inside this one and not a second COMMIT of it.
      return await drizzle(client).transaction(async (tx) => {
        await tx.execute(sql.raw(`SET LOCAL ROLE ${role}`))
        if (org) await tx.execute(sql`SELECT set_config('app.current_org_id', ${org}, true)`)
        return fn(tx)
      })
    } finally {
      client.release()
    }
  }
  return {
    withSystemContext: <T,>(fn: (tx: unknown) => Promise<T>) => run('union_eyes_system', null, fn),
    withRLSContext: <T,>(ctx: { organizationId: string }, fn: (tx: unknown) => Promise<T>) => run('union_eyes_runtime', ctx.organizationId, fn),
  }
})

describe.skipIf(!URL)('signature expiry sweep on real PostgreSQL as the application roles', () => {
  let admin: pg.Client
  let pool: pg.Pool
  const orgA = randomUUID()
  const orgB = randomUUID()
  const ids = { aOverdue: randomUUID(), aOpen: randomUUID(), aDone: randomUUID(), aProvider: randomUUID(), bOverdue: randomUUID() }

  const doc = (id: string, org: string, status: string, expires: string, provider = 'internal') =>
    admin.query(
      `INSERT INTO signature_documents (id, organization_id, title, document_type, file_url, file_name, file_size_bytes, file_hash, provider, status, sent_by, expires_at)
       VALUES ($1, $2, 'T', 'contract', 'u', 'f.pdf', 1, 'h', $3, $4, 'sender', $5::timestamp)`,
      [id, org, provider, status, expires],
    )
  const signer = (document: string, status: string, order: number) =>
    admin.query(`INSERT INTO document_signers (document_id, email, name, signing_order, status) VALUES ($1, $2, 'S', $3, $4)`, [document, `s${order}@example.test`, order, status])
  const statusOf = async (id: string) => (await admin.query('SELECT status::text FROM signature_documents WHERE id = $1', [id])).rows[0].status as string

  beforeAll(async () => {
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    pool = new pg.Pool({ connectionString: URL, max: 4 })
    holder.pool = pool
    for (const [org, slug] of [[orgA, `sx-a-${orgA.slice(0, 6)}`], [orgB, `sx-b-${orgB.slice(0, 6)}`]]) {
      await admin.query(`INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
        VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1) ON CONFLICT (id) DO NOTHING`, [org, slug, slug])
    }
    // What the storage-authority manifest now grants the system role for this table (the bootstrap applies it from the manifest).
    await admin.query('GRANT SELECT ON signature_documents TO union_eyes_system')
    await doc(ids.aOverdue, orgA, 'sent', '2020-01-01 00:00:00')
    await doc(ids.aOpen, orgA, 'sent', '2999-01-01 00:00:00')
    await doc(ids.aDone, orgA, 'completed', '2020-01-01 00:00:00')
    await doc(ids.aProvider, orgA, 'sent', '2020-01-01 00:00:00', 'docusign')
    await doc(ids.bOverdue, orgB, 'viewed', '2020-01-01 00:00:00')
    await signer(ids.aOverdue, 'signed', 1)
    await signer(ids.aOverdue, 'pending', 2)
    await signer(ids.aOverdue, 'viewed', 3)
    await signer(ids.bOverdue, 'sent', 1)
  }, 120_000)

  afterAll(async () => {
    await pool?.end().catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  it('finds overdue internal documents across organizations as the system role and expires each under its own organization', async () => {
    const { SignatureService } = await import('../../lib/signature/signature-service')
    const report = await SignatureService.expireOverdue({ now: new Date('2026-11-01T00:00:00Z'), pageSize: 100 })

    expect(report.failures).toEqual([])
    expect(report.truncated).toBe(false)
    expect(report.expired).toBeGreaterThanOrEqual(2)

    expect(await statusOf(ids.aOverdue)).toBe('expired')
    expect(await statusOf(ids.bOverdue)).toBe('expired')
    // current, final and provider-held documents are untouched
    expect(await statusOf(ids.aOpen)).toBe('sent')
    expect(await statusOf(ids.aDone)).toBe('completed')
    expect(await statusOf(ids.aProvider)).toBe('sent')

    const signers = (await admin.query('SELECT status::text FROM document_signers WHERE document_id = $1 ORDER BY signing_order', [ids.aOverdue])).rows.map((r) => r.status)
    expect(signers).toEqual(['signed', 'expired', 'expired'])
  })

  it('records the trail event and one platform audit record per document, under that document\'s organization', async () => {
    const trail = (await admin.query(`SELECT document_id, event_type FROM signature_audit_trail WHERE document_id = ANY($1::uuid[]) AND event_type = 'document_expired'`, [[ids.aOverdue, ids.bOverdue]])).rows
    expect(trail.map((r) => r.document_id).sort()).toEqual([ids.aOverdue, ids.bOverdue].sort())

    const audits = (await admin.query(`SELECT organization_id, user_id, resource_id FROM public.audit_logs WHERE action = 'signature.document.expire' AND resource_id = ANY($1::text[])`, [[ids.aOverdue, ids.bOverdue]])).rows
    expect(audits.map((r) => [r.resource_id, r.organization_id, r.user_id]).sort()).toEqual(
      [[ids.aOverdue, orgA, 'system:signature-expiry'], [ids.bOverdue, orgB, 'system:signature-expiry']].sort(),
    )
  })

  it('is idempotent: a second run finds nothing to expire and writes no further records', async () => {
    const before = Number((await admin.query(`SELECT count(*)::int AS n FROM public.audit_logs WHERE action = 'signature.document.expire'`)).rows[0].n)
    const { SignatureService } = await import('../../lib/signature/signature-service')
    const report = await SignatureService.expireOverdue({ now: new Date('2026-11-01T00:00:00Z') })

    expect(report.expired).toBe(0)
    expect(Number((await admin.query(`SELECT count(*)::int AS n FROM public.audit_logs WHERE action = 'signature.document.expire'`)).rows[0].n)).toBe(before)
  })

  it('abandons a document\'s whole expiry when its audit record cannot be written, reports it, and still expires the others', async () => {
    const failing = randomUUID()
    const fine = randomUUID()
    await doc(failing, orgA, 'sent', '2020-01-01 00:00:00')
    await signer(failing, 'pending', 1)
    await doc(fine, orgA, 'sent', '2020-01-01 00:00:00')
    await admin.query(`CREATE OR REPLACE FUNCTION public.ue_fault_sig_expiry() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.action = 'signature.document.expire' AND NEW.resource_id = '${failing}' THEN RAISE EXCEPTION 'injected audit fault'; END IF; RETURN NEW; END $$`)
    await admin.query('CREATE TRIGGER ue_fault_sig_expiry BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.ue_fault_sig_expiry()')
    try {
      const { SignatureService } = await import('../../lib/signature/signature-service')
      const report = await SignatureService.expireOverdue({ now: new Date('2026-11-01T00:00:00Z') })

      expect(report.failures.map((f) => f.documentId)).toEqual([failing])
      expect(report.failures[0].reason).toMatch(/injected audit fault/)
      // the failed document is exactly as it was: status, signer and trail all rolled back together
      expect(await statusOf(failing)).toBe('sent')
      expect((await admin.query('SELECT status::text FROM document_signers WHERE document_id = $1', [failing])).rows[0].status).toBe('pending')
      expect((await admin.query(`SELECT count(*)::int AS n FROM signature_audit_trail WHERE document_id = $1 AND event_type = 'document_expired'`, [failing])).rows[0].n).toBe(0)
      expect(await statusOf(fine)).toBe('expired')
    } finally {
      await admin.query('DROP TRIGGER IF EXISTS ue_fault_sig_expiry ON public.audit_logs')
      await admin.query('DROP FUNCTION IF EXISTS public.ue_fault_sig_expiry()')
    }
  })

  it('cannot be run by the tenant role across organizations: the system grant is read-only and the runtime role sees only its own organization', async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE union_eyes_system')
      await expect(client.query(`UPDATE signature_documents SET status = 'voided'`)).rejects.toThrow(/permission denied/)
      await client.query('ROLLBACK')

      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE union_eyes_runtime')
      await client.query(`SELECT set_config('app.current_org_id', $1, true)`, [orgA])
      const visible = (await client.query('SELECT organization_id FROM signature_documents WHERE id = ANY($1::uuid[])', [[ids.aOverdue, ids.bOverdue]])).rows
      expect(visible.map((r) => r.organization_id)).toEqual([orgA])
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  })
})
