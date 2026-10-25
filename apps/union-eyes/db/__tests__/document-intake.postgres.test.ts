/**
 * Temporary document intake, reviewed transcription and signature acknowledgment against the COMBINED deployed schema
 * (Django `migrate` + the approved Drizzle bootstrap, which applies platform 0022/0023 and RLS 0022), with the real
 * application code running as the runtime and system roles under forced row-level security and the exact grants the
 * storage-authority manifest activates. Nothing is mirrored.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a FRESH disposable database (same
 * preparation as thread-assignment.postgres.test.ts). The suite installs a fault trigger on the audit table of that
 * disposable database. Not a staging isolation pass, not a credentialed acceptance, and no object store is involved.
 */
import { randomUUID, createHash } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { seedMembership, type Db } from './authority-kernel-harness'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

const state = vi.hoisted(() => ({ db: null as unknown }))

type Tx = { execute: (q: unknown) => Promise<unknown> }
async function inRole<T>(role: 'union_eyes_runtime' | 'union_eyes_system', org: string, user: string, work: (tx: unknown) => Promise<T>): Promise<T> {
  return (state.db as { transaction: (f: (tx: Tx) => Promise<T>) => Promise<T> }).transaction(async (tx) => {
    await tx.execute(sql.raw(`SET LOCAL ROLE ${role}`))
    await tx.execute(sql`SELECT set_config('app.current_user_id', ${user}, true), set_config('app.current_org_id', ${org}, true)`)
    return work(tx)
  })
}
const context = vi.hoisted(() => ({ org: '', user: '' }))

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (arg: { organizationId: string } | ((tx: unknown) => Promise<unknown>), work?: (tx: unknown) => Promise<unknown>) => {
    const org = typeof arg === 'function' ? context.org : arg.organizationId
    return inRole('union_eyes_runtime', org, context.user, (typeof arg === 'function' ? arg : (work as (tx: unknown) => Promise<unknown>)))
  },
  withSystemContext: async (work: (tx: unknown) => Promise<unknown>) => inRole('union_eyes_system', '', '', work),
}))

const lifecycle = URL ? await import('@/lib/documents/intake-lifecycle') : null
const transcripts = URL ? await import('@/lib/documents/transcripts') : null

describe.skipIf(!URL)('document intake, transcripts and signature acknowledgment on the combined deployed schema', () => {
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const USER_A = `doc-a-${randomUUID().slice(0, 8)}`
  const USER_B = `doc-b-${randomUUID().slice(0, 8)}`
  const REVIEWER = `doc-r-${randomUUID().slice(0, 8)}`
  let admin: pg.Client
  let pool: pg.Pool
  const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
  const count = async (query: string, params: unknown[] = []) => Number((await admin.query(query, params)).rows[0].n)
  const act = (org: string, user: string) => { context.org = org; context.user = user }

  const blobs = new Map<string, Buffer>()
  const removed: string[] = []
  let removeFails = false
  const storage = {
    put: async (key: string, bytes: Buffer) => { blobs.set(key, bytes) },
    read: async (key: string) => { const b = blobs.get(key); if (!b) throw new Error('missing'); return b },
    remove: async (key: string) => { removed.push(key); if (removeFails) throw new Error('storage down documents/secret'); blobs.delete(key) },
  }

  const refused = async (work: Promise<unknown>, pattern: RegExp) => {
    const error = (await work.then(() => null, (e: unknown) => e)) as { message?: string; cause?: { message?: string } } | null
    expect(error, 'expected the statement to be refused').not.toBeNull()
    expect(`${error!.message} ${error!.cause?.message ?? ''}`).toMatch(pattern)
  }
  const failAudit = (action: string) => admin.query(`INSERT INTO ue_audit_faults(action) VALUES ($1) ON CONFLICT DO NOTHING`, [action])
  const clearFaults = () => admin.query(`DELETE FROM ue_audit_faults`)
  const auditCount = async (action: string, org = ORG_A) =>
    count(`SELECT count(*) AS n FROM audit_security.audit_logs WHERE action = $1 AND organization_id = $2`, [action, org])

  async function seedDocument(docId: string, org: string, uploader: string, keySuffix: string) {
    await admin.query(
      `INSERT INTO documents (id, created_at, updated_at, organization_id, org_id, name, title, filename, file_url, file_type, mime_type, privacy_label, uploaded_by, status, access_level, contains_legal_privilege, contains_medical_sensitive, contains_pii, is_confidential)
       VALUES ($1, now(), now(), $2, $2, 'T', 'T', 'f.pdf', 'https://x', 'pdf', 'application/pdf', 'team_confidential', $3, 'active', 'standard', false, false, false, false)`,
      [docId, org, uploader],
    )
    const key = `documents/${org}/seed-${keySuffix}`
    await admin.query(
      `INSERT INTO document_versions (id, organization_id, document_id, version_no, storage_key, content_hash, uploaded_by) VALUES (gen_random_uuid(), $1, $2, 1, $3, $4, $5)`,
      [org, docId, key, sha(key), uploader],
    )
    return key
  }

  async function openAs(org: string, user: string, content: string, now?: Date) {
    act(org, user)
    const opened = await lifecycle!.openIntake({ organizationId: org, userId: user, operation: 'create_document', filename: 'a.pdf', mimeType: 'application/pdf', bytes: Buffer.from(content), now }, storage)
    if (!opened.ok) throw new Error(`not opened: ${opened.kind}`)
    const row = (await admin.query(`SELECT storage_key, content_hash FROM document_intakes WHERE id = $1`, [opened.intake.intakeId])).rows[0]
    return { id: opened.intake.intakeId, key: row.storage_key as string, hash: row.content_hash as string }
  }

  /** The create route's transaction: a version that holds the intake's object, then the bind, then the document audit. */
  async function acceptAs(org: string, user: string, intakeId: string, docId: string) {
    act(org, user)
    const intake = (await admin.query(`SELECT storage_key, content_hash FROM document_intakes WHERE id = $1`, [intakeId])).rows[0]
    return inRole('union_eyes_runtime', org, user, async (tx) => {
      const t = tx as { execute: (q: unknown) => Promise<unknown> }
      await t.execute(sql`INSERT INTO documents (id, created_at, updated_at, organization_id, org_id, name, title, filename, file_url, file_type, mime_type, privacy_label, uploaded_by, status, access_level, contains_legal_privilege, contains_medical_sensitive, contains_pii, is_confidential)
        VALUES (${docId}, now(), now(), ${org}, ${org}, 'T', 'T', 'f.pdf', 'https://x', 'pdf', 'application/pdf', 'team_confidential', ${user}, 'active', 'standard', false, false, false, false)`)
      const versionId = randomUUID()
      await t.execute(sql`INSERT INTO document_versions (id, organization_id, document_id, version_no, storage_key, content_hash, uploaded_by)
        VALUES (${versionId}, ${org}, ${docId}, 1, ${intake.storage_key}, ${intake.content_hash}, ${user})`)
      await lifecycle!.bindIntakeInTx(tx as never, { organizationId: org, userId: user, intakeId, documentId: docId, versionId })
      return versionId
    })
  }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    pool = new pg.Pool({ connectionString: URL, max: 4 })
    state.db = drizzle(pool)
    const d: Db = { exec: (s) => admin.query(s), query: (s, p) => admin.query(s, p as unknown[]) as never }
    for (const [org, slug] of [[ORG_A, `doc-a-${randomUUID().slice(0, 6)}`], [ORG_B, `doc-b-${randomUUID().slice(0, 6)}`]]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [org, slug, slug],
      )
    }
    await seedMembership(d, USER_A, ORG_A, 'member')
    await seedMembership(d, REVIEWER, ORG_A, 'member')
    await seedMembership(d, USER_B, ORG_B, 'member')
    // Fault injection on the disposable database's audit table, so rollback is proven against the real audit path.
    await admin.query(`CREATE TABLE IF NOT EXISTS ue_audit_faults (action text PRIMARY KEY)`)
    await admin.query(`GRANT SELECT ON ue_audit_faults TO PUBLIC`)
    await admin.query(`CREATE OR REPLACE FUNCTION ue_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF EXISTS (SELECT 1 FROM ue_audit_faults WHERE action = NEW.action) THEN RAISE EXCEPTION 'injected audit fault'; END IF; RETURN NEW; END $$`)
    await admin.query(`DROP TRIGGER IF EXISTS ue_audit_fault_trg ON audit_security.audit_logs`)
    await admin.query(`CREATE TRIGGER ue_audit_fault_trg BEFORE INSERT ON audit_security.audit_logs FOR EACH ROW EXECUTE FUNCTION ue_audit_fault()`)
  }, 120_000)

  afterAll(async () => {
    await pool?.end()
    await admin?.end()
  })

  it('applies the manifest privileges: runtime may not delete or truncate; the system role may only read and update', async () => {
    const grants = (await admin.query(
      `SELECT grantee, string_agg(privilege_type::text, ',' ORDER BY privilege_type) AS p FROM information_schema.role_table_grants
        WHERE table_name = 'document_intakes' AND grantee IN ('union_eyes_runtime','union_eyes_system') GROUP BY grantee`,
    )).rows
    expect(Object.fromEntries(grants.map((g) => [g.grantee, g.p]))).toEqual({ union_eyes_runtime: 'INSERT,SELECT,UPDATE', union_eyes_system: 'SELECT,UPDATE' })
    for (const table of ['document_transcript_revisions', 'document_transcript_publications']) {
      const p = (await admin.query(`SELECT string_agg(privilege_type::text, ',' ORDER BY privilege_type) AS p FROM information_schema.role_table_grants WHERE table_name = $1 AND grantee = 'union_eyes_runtime'`, [table])).rows[0].p
      expect(p).toBe('INSERT,SELECT')
    }
    const forced = (await admin.query(`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('document_intakes','document_transcript_revisions','document_transcript_publications') ORDER BY 1`)).rows
    expect(forced.every((r) => r.relrowsecurity && r.relforcerowsecurity)).toBe(true)
  })

  it('opens an intake as the runtime role under RLS: visible to its tenant only, forgeries refused', async () => {
    const intake = await openAs(ORG_A, USER_A, 'native bytes')
    expect(await count(`SELECT count(*) AS n FROM document_intakes WHERE id = $1 AND status = 'open' AND principal_user_id = $2`, [intake.id, USER_A])).toBe(1)
    expect(await auditCount('document.intake.open')).toBe(1)
    // Another tenant sees nothing of it, and cannot touch or forge into this one.
    expect(await inRole('union_eyes_runtime', ORG_B, USER_B, async (tx) => ((await (tx as Tx).execute(sql`SELECT count(*)::int AS n FROM document_intakes`)) as { rows: Array<{ n: number }> }).rows[0].n)).toBe(0)
    await refused(inRole('union_eyes_runtime', ORG_B, USER_B, (tx) => (tx as Tx).execute(sql`UPDATE document_intakes SET deletion_error = 'x' WHERE id = ${intake.id}`).then((r) => { if ((r as { rowCount: number }).rowCount === 0) throw new Error('no rows visible: row-level security'); })), /row-level security/)
    await refused(inRole('union_eyes_runtime', ORG_B, USER_B, (tx) => (tx as Tx).execute(sql`INSERT INTO document_intakes (id, organization_id, principal_user_id, operation, storage_key, original_filename, mime_type, size_bytes, content_hash, expires_at)
      VALUES (${randomUUID()}, ${ORG_A}, ${USER_B}, 'create_document', 'documents/x', 'a', 'application/pdf', 1, ${sha('x')}, now() + interval '5 minutes')`)), /row-level security|violates/)
    // The runtime role cannot delete an intake even in its own tenant.
    await refused(inRole('union_eyes_runtime', ORG_A, USER_A, (tx) => (tx as Tx).execute(sql`DELETE FROM document_intakes WHERE id = ${intake.id}`)), /permission denied/)
    // A failed audit stores no object and no row.
    await failAudit('document.intake.open')
    const before = blobs.size
    await expect(openAs(ORG_A, USER_A, 'will not be stored')).rejects.toThrow()
    expect(blobs.size).toBe(before)
    await clearFaults()
  })

  it('accepts once, atomically with the document and its audit, and rolls everything back when the audit fails', async () => {
    const intake = await openAs(ORG_A, USER_A, 'to accept')
    await failAudit('document.intake.accept')
    await expect(acceptAs(ORG_A, USER_A, intake.id, randomUUID())).rejects.toThrow()
    expect(await count(`SELECT count(*) AS n FROM document_intakes WHERE id = $1 AND status = 'open'`, [intake.id])).toBe(1)
    expect(await count(`SELECT count(*) AS n FROM document_versions WHERE storage_key = $1`, [intake.key])).toBe(0)
    await clearFaults()

    const docId = randomUUID()
    const versionId = await acceptAs(ORG_A, USER_A, intake.id, docId)
    expect(await count(`SELECT count(*) AS n FROM document_intakes WHERE id = $1 AND status = 'accepted' AND object_state = 'attached' AND accepted_version_id = $2`, [intake.id, versionId])).toBe(1)
    expect(await auditCount('document.intake.accept')).toBeGreaterThanOrEqual(1)

    // A replay by the same principal is recognised; another principal never learns the intake exists.
    act(ORG_A, USER_A)
    expect(await lifecycle!.checkIntakeForAcceptance({ organizationId: ORG_A, userId: USER_A, intakeId: intake.id, operation: 'create_document' }, storage)).toMatchObject({ ok: true, replay: true })
    expect(await lifecycle!.checkIntakeForAcceptance({ organizationId: ORG_A, userId: REVIEWER, intakeId: intake.id, operation: 'create_document' }, storage)).toEqual({ ok: false, kind: 'not_found' })
    expect(await lifecycle!.checkIntakeForAcceptance({ organizationId: ORG_B, userId: USER_B, intakeId: intake.id, operation: 'create_document' }, storage)).toEqual({ ok: false, kind: 'not_found' })

    // An accepted intake is terminal and its object can never be cancelled or marked for deletion.
    expect(await lifecycle!.cancelIntake({ organizationId: ORG_A, userId: USER_A, intakeId: intake.id })).toEqual({ ok: false, kind: 'accepted' })
    await refused(inRole('union_eyes_runtime', ORG_A, USER_A, (tx) => (tx as Tx).execute(sql`UPDATE document_intakes SET status = 'cancelled', cancelled_at = now(), object_state = 'deleted', accepted_at = NULL, accepted_document_id = NULL, accepted_version_id = NULL WHERE id = ${intake.id}`)), /terminal|accepted/)
    await refused(inRole('union_eyes_system', '', '', (tx) => (tx as Tx).execute(sql`UPDATE document_intakes SET object_state = 'deletion_pending' WHERE id = ${intake.id}`)), /terminal|illegal|cannot/)
  })

  it('lets exactly one of two truly concurrent acceptances win, on separate connections', async () => {
    const intake = await openAs(ORG_A, USER_A, 'race')
    const outcomes = await Promise.allSettled([
      acceptAs(ORG_A, USER_A, intake.id, randomUUID()),
      acceptAs(ORG_A, USER_A, intake.id, randomUUID()),
    ])
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1)
    expect(outcomes.filter((o) => o.status === 'rejected')).toHaveLength(1)
    expect(await count(`SELECT count(*) AS n FROM document_versions WHERE storage_key = $1`, [intake.key])).toBe(1)
  })

  afterEach(() => { delete process.env.UE_CANONICAL_BOOTSTRAP_V2 })

  it('reconciles abandoned uploads as the system role: expires, deletes the exact object, records a failed deletion and retries, never touches accepted objects', async () => {
    const lapsed = await openAs(ORG_A, USER_A, 'lapsed', new Date(Date.now() - 3 * 3_600_000))
    const lapsedB = await openAs(ORG_B, USER_B, 'lapsed other tenant', new Date(Date.now() - 3 * 3_600_000))
    const live = await openAs(ORG_A, USER_A, 'still live')
    const acceptedBefore = await count(`SELECT count(*) AS n FROM document_intakes WHERE status = 'accepted'`)

    // Outside Canonical V2 the audit fallback is audit_security.audit_logs, which the system role cannot write. The
    // reaper then fails closed: nothing is expired, because nothing may change without its audit record.
    await expect(lifecycle!.expireDueIntakes()).rejects.toThrow()
    expect(await count(`SELECT count(*) AS n FROM document_intakes WHERE id = $1 AND status = 'open'`, [lapsed.id])).toBe(1)

    // Under Canonical V2 (the deployed mode) the system role appends to the hash-chained public.audit_logs.
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
    removeFails = true
    removed.length = 0
    const first = await lifecycle!.runIntakeReaper(storage)
    expect(first.expired).toBeGreaterThanOrEqual(2)
    expect(first.deletionFailed).toBeGreaterThanOrEqual(2)
    for (const lapsedIntake of [lapsed, lapsedB]) {
      const row = (await admin.query(`SELECT status, object_state, deletion_attempts, deletion_error FROM document_intakes WHERE id = $1`, [lapsedIntake.id])).rows[0]
      expect(row).toMatchObject({ status: 'expired', object_state: 'deletion_failed', deletion_attempts: 1 })
      expect(String(row.deletion_error)).not.toContain('documents/secret')
      expect(blobs.has(lapsedIntake.key)).toBe(true)
    }

    removeFails = false
    const later = new Date(Date.now() + 15 * 60_000)
    const second = await lifecycle!.finalizeIntakeObjects(storage, { now: later })
    expect(second.objectsDeleted).toBeGreaterThanOrEqual(2)
    expect(blobs.has(lapsed.key)).toBe(false)
    expect(blobs.has(lapsedB.key)).toBe(false)
    expect(blobs.has(live.key)).toBe(true)
    // Only the lapsed intakes' own keys were removed.
    expect(removed.filter((k) => ![lapsed.key, lapsedB.key].includes(k))).toEqual([])
    expect(await count(`SELECT count(*) AS n FROM document_intakes WHERE status = 'accepted'`)).toBe(acceptedBefore)
    expect(await count(`SELECT count(*) AS n FROM public.audit_logs WHERE action IN ('document.intake.expire','document.intake.object_deleted','document.intake.object_deletion_failed') AND organization_id IN ($1, $2)`, [ORG_A, ORG_B])).toBeGreaterThanOrEqual(6)
  })

  describe('reviewed transcription', () => {
    const DOC = randomUUID()
    const OTHER_DOC = randomUUID()
    const extract = (user = USER_A) =>
      inRole('union_eyes_runtime', ORG_A, user, (tx) =>
        transcripts!.recordMachineExtraction(tx as never, { organizationId: ORG_A, userId: user, documentId: DOC, classification: 'team_confidential', text: 'machine text', engine: 'tesseract', engineVersion: '5', language: 'en', confidence: 0.9 }))
    const revise = (expected: number, text: string, review: boolean, user: string) =>
      inRole('union_eyes_runtime', ORG_A, user, (tx) =>
        transcripts!.saveHumanRevision(tx as never, { organizationId: ORG_A, userId: user, documentId: DOC, classification: 'team_confidential', expectedRevisionNo: expected, text, review }))
    const publish = (revisionNo: number) =>
      inRole('union_eyes_runtime', ORG_A, REVIEWER, (tx) =>
        transcripts!.publishTranscriptAsEvidence(tx as never, { organizationId: ORG_A, userId: REVIEWER, documentId: DOC, linkedCaseId: randomUUID(), revisionNo, purpose: 'exhibit' }))

    beforeAll(async () => {
      await seedDocument(DOC, ORG_A, USER_A, 'transcript')
      await seedDocument(OTHER_DOC, ORG_B, USER_B, 'other-tenant')
    })

    it('records a machine extraction beside the original and refuses a cross-tenant write', async () => {
      expect(await extract()).toMatchObject({ ok: true, created: true })
      expect(await count(`SELECT count(*) AS n FROM document_transcript_revisions WHERE document_id = $1 AND revision_no = 1 AND state = 'machine_extraction'`, [DOC])).toBe(1)
      expect(await count(`SELECT count(*) AS n FROM document_versions WHERE document_id = $1`, [DOC])).toBe(1)
      // The other tenant's context cannot read this document's revisions or write into its document.
      expect(await inRole('union_eyes_runtime', ORG_B, USER_B, async (tx) => ((await (tx as Tx).execute(sql`SELECT count(*)::int AS n FROM document_transcript_revisions`)) as { rows: Array<{ n: number }> }).rows[0].n)).toBe(0)
      await refused(
        inRole('union_eyes_runtime', ORG_B, USER_B, (tx) => transcripts!.recordMachineExtraction(tx as never, { organizationId: ORG_A, userId: USER_B, documentId: DOC, classification: 'team_confidential', text: 'forged', engine: 'x', engineVersion: '1', language: 'en', confidence: 0.5 })),
        /row-level security|violates|no_version|undefined|Cannot read/,
      ).catch(async () => {
        // The application reports no version visible to that tenant rather than writing; either way nothing is written.
        expect(await count(`SELECT count(*) AS n FROM document_transcript_revisions WHERE text = 'forged'`)).toBe(0)
      })
    })

    it('keeps revisions linear, independent and immutable at the database, as the runtime role', async () => {
      expect(await revise(1, 'draft', false, USER_A)).toMatchObject({ ok: true, revision: { revisionNo: 2 } })
      expect(await revise(1, 'stale', false, REVIEWER)).toMatchObject({ ok: false, kind: 'stale' })
      expect(await revise(2, 'self reviewed', true, USER_A)).toMatchObject({ ok: false, kind: 'self_review' })
      expect(await revise(2, 'reviewed', true, REVIEWER)).toMatchObject({ ok: true, revision: { revisionNo: 3, state: 'human_reviewed', reviewedBy: REVIEWER } })
      await refused(inRole('union_eyes_runtime', ORG_A, USER_A, (tx) => (tx as Tx).execute(sql`UPDATE document_transcript_revisions SET text = 'rewritten' WHERE document_id = ${DOC}`)), /permission denied/)
      await refused(inRole('union_eyes_runtime', ORG_A, USER_A, (tx) => (tx as Tx).execute(sql`DELETE FROM document_transcript_revisions WHERE document_id = ${DOC}`)), /permission denied/)
      // A gap in the sequence and a wrong text hash are refused by the table itself, even from the runtime role.
      await refused(inRole('union_eyes_runtime', ORG_A, USER_A, (tx) => (tx as Tx).execute(sql`INSERT INTO document_transcript_revisions (organization_id, document_id, version_id, revision_no, base_revision_no, state, text, text_hash, source_content_hash, classification, authored_by)
        SELECT ${ORG_A}, ${DOC}, id, 9, 3, 'human_draft', 'x', ${sha('x')}, content_hash, 'team_confidential', ${USER_A} FROM document_versions WHERE document_id = ${DOC}`)), /contiguous|linear|revision|violates/)
      await refused(inRole('union_eyes_runtime', ORG_A, USER_A, (tx) => (tx as Tx).execute(sql`INSERT INTO document_transcript_revisions (organization_id, document_id, version_id, revision_no, base_revision_no, state, text, text_hash, source_content_hash, classification, authored_by)
        SELECT ${ORG_A}, ${DOC}, id, 4, 3, 'human_draft', 'x', ${sha('not x')}, content_hash, 'team_confidential', ${USER_A} FROM document_versions WHERE document_id = ${DOC}`)), /hash|violates|check/)
    })

    it('commits a revision only with its audit record', async () => {
      await failAudit('document.transcript.draft')
      await expect(revise(3, 'audit will fail', false, USER_A)).rejects.toThrow()
      expect(await count(`SELECT count(*) AS n FROM document_transcript_revisions WHERE document_id = $1`, [DOC])).toBe(3)
      await clearFaults()
    })

    it('publishes only the head reviewed revision, once, append-only', async () => {
      expect(await publish(3)).toMatchObject({ ok: true })
      expect(await publish(3)).toMatchObject({ ok: false, kind: 'already_published' })
      expect(await auditCount('document.transcript.publish_as_evidence')).toBe(1)
      await refused(inRole('union_eyes_runtime', ORG_A, REVIEWER, (tx) => (tx as Tx).execute(sql`UPDATE document_transcript_publications SET purpose = 'changed'`)), /permission denied/)
      await refused(inRole('union_eyes_runtime', ORG_A, REVIEWER, (tx) => (tx as Tx).execute(sql`DELETE FROM document_transcript_publications`)), /permission denied/)
    })
  })

  describe('signature provider acknowledgment', () => {
    it('refuses an acknowledgment without an external envelope, and keeps a recorded one immutable', async () => {
      const profile = (await admin.query(`SELECT user_id FROM user_management.users WHERE user_id = $1`, [USER_A])).rows[0]?.user_id
      expect(profile).toBe(USER_A)
      const insert = (provider: string, envelope: string | null, ack: string | null) =>
        admin.query(
          `INSERT INTO signature_documents (id, organization_id, title, document_type, file_url, file_name, file_size_bytes, file_hash, provider, provider_envelope_id, status, sent_by, provider_acknowledged_at)
           VALUES ($1, $2, 't', 'agreement', 'u', 'f', 1, $3, $4::signature_provider, $5, 'completed', $6, $7)`,
          [randomUUID(), ORG_A, 'a'.repeat(64), provider, envelope, USER_A, ack],
        )
      const dbError = async (work: Promise<unknown>) => (await work.then(() => null, (e: Error) => e))
      const fk = await dbError(insert('internal', 'env-1', '2026-02-20T14:15:16Z'))
      expect(String(fk?.message)).toMatch(/signature_documents_provider_ack_ck|violates check/)
      expect(String((await dbError(insert('docusign', null, '2026-02-20T14:15:16Z')))?.message)).toMatch(/signature_documents_provider_ack_ck|violates check/)
      const id = randomUUID()
      await admin.query(
        `INSERT INTO signature_documents (id, organization_id, title, document_type, file_url, file_name, file_size_bytes, file_hash, provider, provider_envelope_id, status, sent_by, provider_acknowledged_at)
         VALUES ($1, $2, 't', 'agreement', 'u', 'f', 1, $3, 'docusign', 'env-2', 'completed', $4, '2026-02-20T14:15:16Z')`,
        [id, ORG_A, 'a'.repeat(64), USER_A],
      ).catch((e) => { throw new Error(`insert of a valid acknowledged document failed: ${e.message}`) })
      expect(String((await dbError(admin.query(`UPDATE signature_documents SET provider_acknowledged_at = now() WHERE id = $1`, [id])))?.message)).toMatch(/immutable/)
      expect(String((await dbError(admin.query(`UPDATE signature_documents SET provider_acknowledged_at = NULL WHERE id = $1`, [id])))?.message)).toMatch(/immutable/)
    })
  })
})
