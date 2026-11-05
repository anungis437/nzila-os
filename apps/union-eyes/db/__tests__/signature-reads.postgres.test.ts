/**
 * F03-B on real PostgreSQL: cross-tenant isolation of the e-signature reads (lib/signature/signature-service.ts).
 *
 * DEF-0B11-SOC-SIGNATURE-READS-AND-ACCESS-CHECK-USE-THE-BARE-DB-HANDLE-WITH-NO-ORGANIZATION-PREDICATE-AND-ACCEPT-ANY-USER-ID-A-SENDER-TYPED-AS-SIGNER.
 * The service helpers run unmodified as the real union_eyes_runtime role under FORCE row-level security, bound to the caller's authenticated
 * organization the way the routes bind them. A user of another organization who was typed in as a signer (the finding's scenario, inserted
 * directly because the request path now refuses it) reads nothing of the document, its signers or its trail:
 *   - the access check, the status, the audit trail and the audit report answer "not found" for the document of another organization;
 *   - the tables themselves show that user no row and refuse their update and insert, so the isolation is provable at the database and not only
 *     from the service code;
 *   - the sender and a signer of the document's own organization still read it, so the refusals are not a broken read path;
 *   - the system role holds no privilege on the signer or trail tables, so no cross-tenant system read of them exists to misuse;
 *   - the signing, reminder and \"my documents\" paths read the signer and its document on the organization's own transaction too (they used the
 *     shared handle, which under row-level security finds no row at all, and nothing bound it to the caller's organization).
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
// The user is the authenticated session user: the real withRLSContext takes app.current_user_id from the session, and the audit insert policy
// requires the audit row's user to be that user.
const state = vi.hoisted(() => ({ pool: null as unknown, schema: null as unknown, user: '' }))

async function inRole<T>(organizationId: string, userId: string, work: (tx: unknown) => Promise<T>): Promise<T> {
  const client = await (state.pool as pg.Pool).connect()
  try {
    return await drizzle(client, { schema: state.schema as never }).transaction(async (tx) => {
      await tx.execute(sql.raw('SET LOCAL ROLE union_eyes_runtime'))
      await tx.execute(sql`SELECT set_config('app.current_org_id', ${organizationId}, true), set_config('app.current_user_id', ${userId}, true)`)
      return work(tx)
    })
  } finally {
    client.release()
  }
}

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (ctx: { organizationId: string; userId?: string }, work: (tx: unknown) => Promise<unknown>) => inRole(ctx.organizationId, ctx.userId ?? state.user, work),
  withSystemContext: () => { throw new Error('the signature reads never use the system role') },
}))
vi.mock('@/db', () => ({ db: new Proxy({}, { get() { throw new Error('the signature reads never use the shared handle') } }) }))
vi.mock('@/lib/services/notification-service', () => ({ NotificationService: class {} }))
vi.mock('@/lib/services/document-storage-service', () => ({ default: class {} }))
vi.mock('@/lib/signature/providers', () => ({ default: { getProvider: () => ({}), getDefaultProvider: () => ({}) } }))

const service = URL ? await import('@/lib/signature/signature-service') : null

describe.skipIf(!URL)('the e-signature reads on the combined schema, as the real runtime role', () => {
  const sfx = randomUUID().slice(0, 8)
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const DOC = randomUUID()
  const U = { sender: `sg-sender-${sfx}`, signer: `sg-signer-${sfx}`, foreign: `sg-foreign-${sfx}` }
  let admin: pg.Client
  let pool: pg.Pool
  let signerRow: string
  let foreignSignerRow: string

  const raw = async <T = Record<string, unknown>>(org: string, user: string, query: ReturnType<typeof sql>) =>
    inRole(org, user, async (tx) => (await (tx as { execute: (q: unknown) => Promise<{ rows: T[] }> }).execute(query)).rows)
  const count = async (org: string, user: string, table: string) =>
    Number((await raw<{ n: string }>(org, user, sql.raw(`SELECT count(*)::text n FROM ${table} WHERE ${table === 'signature_documents' ? 'id' : 'document_id'} = '${DOC}'`)))[0].n)

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    pool = new pg.Pool({ connectionString: URL, max: 4 })
    state.pool = pool
    state.schema = await import('@/db/schema')
    for (const [org, slug] of [[ORG_A, `sg-a-${sfx}`], [ORG_B, `sg-b-${sfx}`]]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [org, slug, slug],
      )
    }
    await admin.query(
      `INSERT INTO signature_documents (id, organization_id, title, document_type, file_url, file_name, file_size_bytes, file_hash, provider, status, sent_by, require_authentication, sequential_signing, allow_decline, allow_reassign, created_at, updated_at)
       VALUES ($1,$2,'Settlement','agreement','https://files.example/a.pdf','a.pdf',10,'hash','internal','sent',$3,false,false,true,false,now(),now())`,
      [DOC, ORG_A, U.sender],
    )
    const insertSigner = async (user: string, name: string, order: number) =>
      (await admin.query(
        `INSERT INTO document_signers (id, document_id, user_id, email, name, signing_order, status, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'pending', now(), now()) RETURNING id::text id`,
        [DOC, user, `${user}@example.test`, name, order],
      )).rows[0].id as string
    signerRow = await insertSigner(U.signer, 'Sam Signer', 1)
    // The finding's scenario: a sender typed the user id of a person from another organization as a signer.
    foreignSignerRow = await insertSigner(U.foreign, 'Frankie Foreign', 2)
    await admin.query(
      `INSERT INTO signature_audit_trail (id, document_id, event_type, event_description, timestamp, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, 'document_sent', 'Sent for signature', now(), now(), now())`,
      [DOC],
    )
  }, 120_000)

  afterAll(async () => {
    await pool?.end().catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  it('the sender and a signer of the document\'s organization read it', async () => {
    const { SignatureService } = service!
    expect(await SignatureService.verifyDocumentAccess(DOC, U.sender, ORG_A)).toBe(true)
    expect(await SignatureService.verifyDocumentAccess(DOC, U.signer, ORG_A)).toBe(true)
    expect(await SignatureService.getDocumentSender(DOC, ORG_A)).toBe(U.sender)
    expect(await SignatureService.getDocumentStatus(DOC, ORG_A)).toMatchObject({ id: DOC })
  })

  it('answers "not found" for the document of another organization, even to a user typed in as a signer', async () => {
    const { SignatureService, AuditTrailService } = service!
    expect(await SignatureService.verifyDocumentAccess(DOC, U.foreign, ORG_B)).toBe(false)
    expect(await SignatureService.verifyDocumentAccess(DOC, U.sender, ORG_B)).toBe(false)
    expect(await SignatureService.getDocumentSender(DOC, ORG_B)).toBeNull()
    await expect(SignatureService.getDocumentStatus(DOC, ORG_B)).rejects.toThrow('Document not found')
    expect(await AuditTrailService.getDocumentAudit(DOC, ORG_B)).toEqual([])
    expect((await AuditTrailService.getDocumentAudit(DOC, ORG_A)).length).toBeGreaterThan(0)
    await expect(AuditTrailService.generateAuditReport(DOC, ORG_B)).rejects.toThrow('Document not found')
  })

  it('shows another organization no document, signer or trail row, and refuses its update and insert', async () => {
    for (const table of ['signature_documents', 'document_signers', 'signature_audit_trail']) {
      expect(await count(ORG_B, U.foreign, table), table).toBe(0)
      expect(await count(ORG_A, U.sender, table), table).toBeGreaterThan(0)
    }
    expect(await raw(ORG_B, U.foreign, sql`UPDATE document_signers SET status = 'signed' WHERE id = ${foreignSignerRow}::uuid RETURNING id`)).toEqual([])
    expect((await admin.query(`SELECT status FROM document_signers WHERE id = $1`, [foreignSignerRow])).rows[0].status).toBe('pending')
    await expect(raw(ORG_B, U.foreign, sql`INSERT INTO signature_audit_trail (id, document_id, event_type, event_description, timestamp, created_at, updated_at) VALUES (gen_random_uuid(), ${DOC}::uuid, 'document_signed', 'forged', now(), now(), now())`)).rejects.toThrow()
    expect((await admin.query(`SELECT count(*)::int n FROM signature_audit_trail WHERE document_id = $1 AND event_type = 'document_signed'`, [DOC])).rows[0].n).toBe(0)
    expect(signerRow).toBeTruthy()
  })

  it('leaves no cross-tenant system read of the signer and trail tables to misuse: the system role holds no privilege on them', async () => {
    for (const table of ['document_signers', 'signature_audit_trail']) {
      const privileges = await admin.query(`SELECT has_table_privilege('union_eyes_system', $1::regclass, 'SELECT') AS sel, has_table_privilege('union_eyes_system', $1::regclass, 'UPDATE') AS upd`, [table])
      expect(privileges.rows[0], table).toEqual({ sel: false, upd: false })
    }
  })

  it('shows why the shared handle could not serve these paths: outside an organization\'s context the runtime role sees no signer or document at all', async () => {
    expect(await raw('', U.signer, sql.raw(`SELECT id FROM document_signers WHERE id = '${signerRow}'::uuid`))).toEqual([])
    expect(await raw('', U.signer, sql.raw(`SELECT id FROM signature_documents WHERE id = '${DOC}'::uuid`))).toEqual([])
    expect(await raw(ORG_A, U.signer, sql.raw(`SELECT id FROM document_signers WHERE id = '${signerRow}'::uuid`))).toHaveLength(1)
  })

  it('lists a user\'s documents inside the organization only', async () => {
    const { SignatureService } = service!
    const asSigner = await SignatureService.getUserDocuments(U.signer, ORG_A)
    expect(asSigner.toSign.map((row) => row.document.id)).toContain(DOC)
    expect(asSigner.sent).toEqual([])
    expect((await SignatureService.getUserDocuments(U.sender, ORG_A)).sent.map((row) => row.id)).toContain(DOC)
    for (const user of [U.sender, U.signer, U.foreign]) {
      expect(await SignatureService.getUserDocuments(user, ORG_B), user).toEqual({ sent: [], toSign: [] })
    }
    await expect(SignatureService.getUserDocuments(U.signer, '')).rejects.toThrow('Organization context required')
  })

  it('lets only the sender remind a signer who has not signed, inside the sender\'s organization', async () => {
    const { SignatureService } = service!
    const reminders = async () => Number((await admin.query(`SELECT count(*)::int n FROM signature_audit_trail WHERE document_id = $1 AND event_type = 'reminder_sent'`, [DOC])).rows[0].n)
    await expect(SignatureService.sendReminder(foreignSignerRow, U.sender, ORG_B)).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'Signer not found' })
    await expect(SignatureService.sendReminder(foreignSignerRow, U.signer, ORG_A)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await reminders()).toBe(0)
    await SignatureService.sendReminder(foreignSignerRow, U.sender, ORG_A)
    expect(await reminders()).toBe(1)
  })

  it('records a signature only for the signer themself, found inside the organization they are authenticated in', async () => {
    const { SignatureService } = service!
    state.user = U.signer
    const input = { signatureImageUrl: 'data:image/png;base64,iVBORw0KGgo=', signatureType: 'electronic' as const }
    const status = async (id: string) => (await admin.query(`SELECT status FROM document_signers WHERE id = $1`, [id])).rows[0].status as string
    // Another organization's session finds nothing, even for a real signer id and the signer's own user id.
    await expect(SignatureService.recordSignature({ ...input, signerId: signerRow, actorUserId: U.signer, organizationId: ORG_B })).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'Signer not found' })
    // Inside the organization, only the person the row names may sign it.
    await expect(SignatureService.recordSignature({ ...input, signerId: signerRow, actorUserId: U.sender, organizationId: ORG_A })).rejects.toMatchObject({ code: 'FORBIDDEN', message: expect.stringContaining('not authorized') })
    await expect(SignatureService.recordSignature({ ...input, signerId: signerRow, actorUserId: U.signer, organizationId: '' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await status(signerRow)).toBe('pending')
    expect((await admin.query(`SELECT count(*)::int n FROM signature_audit_trail WHERE document_id = $1 AND event_type = 'document_signed'`, [DOC])).rows[0].n).toBe(0)

    const signed = await SignatureService.recordSignature({ ...input, signerId: signerRow, actorUserId: U.signer, organizationId: ORG_A })
    expect(signed).toMatchObject({ id: signerRow, status: 'signed' })
    expect(await status(signerRow)).toBe('signed')
    expect((await admin.query(`SELECT count(*)::int n FROM signature_audit_trail WHERE document_id = $1 AND event_type = 'document_signed'`, [DOC])).rows[0].n).toBe(1)
    // A signature already given is not overwritten, and the other signer, who has not signed, is untouched.
    await expect(SignatureService.recordSignature({ ...input, signerId: signerRow, actorUserId: U.signer, organizationId: ORG_A })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(await status(foreignSignerRow)).toBe('pending')
    state.user = ''
  })
})
