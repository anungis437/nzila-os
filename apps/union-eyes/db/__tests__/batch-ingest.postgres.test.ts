/**
 * The batch ingestion on real PostgreSQL, as the tenant runtime role (UE-CONV-H-014).
 *
 * lib/ingestion/batch-ingest.ts and post-import-verification.ts (POST /api/admin/ingest) were written against columns the database never had (a case's external id,
 * its source system, its import batch; a document's source, external id and case) and cast to enum types that are plain varchar, so every record failed on its first
 * statement and nothing noticed: the unit tests mock db.execute. The mismatch census (scripts/runtime/mismatch-census.ts) found it. Platform 0077 adds the columns;
 * this runs the real import over the real tables, inside a tenant transaction as union_eyes_runtime under FORCE row-level security, as the route does. What it holds:
 *   - an import writes the case, its timeline and its documents; a document is the canonical set (a documents row, its first version when it has a file, and the
 *     document_links row that makes it the case's), and every row names its source system, its batch and when it was imported;
 *   - an import is idempotent: the same records again change the same rows (one case per organization, source system and external id; one document likewise, also
 *     when the source gave it no id) and add no copy;
 *   - the same external id from another source system, or from another organization, is another case, and one organization never sees the other's;
 *   - a record that fails leaves nothing behind and the records after it still import (each record runs in a savepoint: one failed statement would otherwise abort
 *     the whole tenant transaction);
 *   - the post-import verification counts the batch, and fails it for a document no case owns, a partial outcome, or a batch outside the organization's scope;
 *   - a re-import never overwrites a case changed in the platform after its last import, nor takes over a platform case with the same key: the record fails with a conflict;
 *   - a record without its historical filed date, with an undated timeline event, or with an unknown procedural stage is refused before anything is written;
 *   - the database refuses what the writer relies on being true: an external id with no source system, a second case with the same key.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { createHash, randomUUID } from 'node:crypto'
import pg from 'pg'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { serializeRawDates } from '@/db/driver-dates'
import { installNativeBusinessContext, withNativeCanonicalActor } from '../../scripts/runtime/native-canonical-fixture'
import { seedDeclaredCanonicalActor } from './native-declared-actor'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const state = vi.hoisted(() => ({ tx: null as unknown }))

// The ingestion modules use the ambient `db`: inside a tenant request that is the request's own transaction, which is what this binds it to.
vi.mock('@/db/db', () => ({
  db: new Proxy(
    {},
    {
      get: (_target, property) => {
        const bound = state.tx as Record<PropertyKey, unknown> | null
        if (!bound) throw new Error('no tenant transaction is bound')
        const value = bound[property]
        return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(bound) : value
      },
    },
  ),
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

const ingest = URL ? await import('@/lib/ingestion/batch-ingest') : null
const verification = URL ? await import('@/lib/ingestion/post-import-verification') : null
const manifests = URL ? await import('@/lib/ingestion/source-manifest') : null
const evidence = URL ? await import('@/lib/ingestion/document-evidence') : null

const SOURCE = 'legacy-case-system'
const IMPORTER = 'importer-1'

function codeOf(error: unknown): string | undefined {
  let current = error as { code?: unknown; cause?: unknown } | undefined
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (typeof current.code === 'string' && /^[0-9A-Z]{5}$/.test(current.code)) return current.code
    current = current.cause as typeof current
  }
  return undefined
}

describe.skipIf(!URL)('the batch ingestion over the real grievance, document and timeline tables', () => {
  const sfx = randomUUID().slice(0, 8)
  const ORG = randomUUID()
  const OTHER = randomUUID()
  let admin: pg.Client
  let client: ReturnType<typeof postgres>
  let run: <T>(organizationId: string, work: () => Promise<T>) => Promise<T>

  const record = (organizationId: string, externalId: string, extra: Record<string, unknown> = {}) => ({
    external_case_id: externalId,
    type: 'contract',
    status: 'filed',
    title: `Case ${externalId}`,
    description: `Description of case ${externalId}`,
    organization_id: organizationId,
    grievant_name: 'Pat Member',
    filed_date: '2026-01-10',
    ...extra,
  })
  type Extra = { sourceManifestId?: string; valueMapping?: { priority?: Record<string, string>; step?: Record<string, string> } }
  const options = (organizationId: string, sourceSystem = SOURCE, extra: Extra = {}) => ({ organizationId, sourceSystem, createdBy: IMPORTER, continueOnError: true, ...extra })
  const importAs = (organizationId: string, records: Array<ReturnType<typeof record>>, sourceSystem = SOURCE, extra: Extra = {}) =>
    run(organizationId, () => ingest!.ingestGrievanceBatch(records as never, options(organizationId, sourceSystem, extra)))
  const sha = (text: string) => createHash('sha256').update(text).digest('hex')
  const rows = async (query: string, params: unknown[] = []) => (await admin.query(query, params)).rows

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    client = postgres(URL!, { max: 4, onnotice: () => undefined })
    const db = drizzle(client)
    serializeRawDates(client)
    // The importer is a live administrator of each organization, and the import runs in the importer's own verified business session,
    // as the route's tenant transaction does (canonical V2: ue_v2_verified_business_session).
    run = (organizationId, work) =>
      withNativeCanonicalActor(IMPORTER, organizationId, (binding) => db.transaction(async (tx) => {
        await tx.execute(sql.raw('SET LOCAL ROLE union_eyes_runtime'))
        await tx.execute(sql`SELECT set_config('app.current_org_id', ${organizationId}, true), set_config('app.current_user_id', ${IMPORTER}, true)`)
        await installNativeBusinessContext((statement) => tx.execute(statement), binding)
        state.tx = tx
        try {
          return await work()
        } finally {
          state.tx = null
        }
      }))
    for (const [id, name] of [
      [ORG, 'Ingest Fixture Local'],
      [OTHER, 'Another Local'],
    ]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [id, name, `ing-${sfx}-${id.slice(0, 6)}`],
      )
      await seedDeclaredCanonicalActor(admin, IMPORTER, id, 'admin')
    }
  }, 120_000)

  afterAll(async () => {
    await client?.end({ timeout: 5 }).catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  let firstBatch: string

  it('imports a case with its timeline and documents, and every row names where it came from', async () => {
    const result = await importAs(ORG, [
      record(ORG, 'C-1', {
        timeline: [{ date: '2026-01-11', action: 'acknowledged', actor: 'Steward', notes: 'Acknowledged by the steward' }],
        documents: [
          { external_id: 'D-1', name: 'Grievance form.pdf', file_type: 'pdf', file_url: 'https://files.example.test/form.pdf' },
          { name: 'Phone note', file_type: 'note' },
        ],
      }),
      record(ORG, 'C-2'),
    ])
    expect(result).toMatchObject({ status: 'completed', totalRecords: 2, succeeded: 2, failed: 0 })
    firstBatch = result.batchId
    expect(firstBatch).toMatch(/^[0-9a-f-]{36}$/)

    const cases = await rows(`SELECT id::text id, external_case_id, source_system, import_batch_id::text batch, length(import_fingerprint) fingerprint, imported_at IS NOT NULL imported, type, status, grievance_number, grievant_name FROM grievances WHERE organization_id = $1 ORDER BY external_case_id`, [ORG])
    expect(cases).toHaveLength(2)
    expect(cases[0]).toMatchObject({ external_case_id: 'C-1', source_system: SOURCE, batch: firstBatch, fingerprint: 64, imported: true, type: 'contract', status: 'filed', grievant_name: 'Pat Member' })
    expect(cases[0].grievance_number).toMatch(/^IMP-[0-9a-f]{10}-C-1$/)

    const events = await rows(`SELECT event_type, count(*)::int n FROM grievance_timeline_events WHERE organization_id = $1 AND import_batch_id = $2 GROUP BY event_type ORDER BY event_type`, [ORG, firstBatch])
    // Only the source's own history: the import writes no synthetic event into it (MIG-03).
    expect(events).toEqual([{ event_type: 'acknowledged', n: 1 }])

    const docs = await rows(`SELECT id::text id, name, file_type, document_type, source_system, external_document_id, import_batch_id::text batch, imported_at IS NOT NULL imported, uploaded_by, privacy_label FROM documents WHERE organization_id = $1 AND import_batch_id = $2 ORDER BY name`, [ORG, firstBatch])
    expect(docs.map((d) => d.name)).toEqual(['Grievance form.pdf', 'Phone note'])
    expect(docs[0]).toMatchObject({ source_system: SOURCE, external_document_id: 'D-1', batch: firstBatch, imported: true, uploaded_by: IMPORTER, privacy_label: 'team_confidential', file_type: 'pdf' })
    expect(docs[1].external_document_id).toMatch(/^derived:[0-9a-f]{32}$/)

    const versions = await rows(`SELECT document_id::text document_id, version_no, storage_key, content_hash FROM document_versions WHERE organization_id = $1 AND document_id = ANY($2::uuid[])`, [ORG, docs.map((d) => d.id)])
    expect(versions).toEqual([{ document_id: docs[0].id, version_no: 1, storage_key: 'https://files.example.test/form.pdf', content_hash: `unverified:${docs[0].id}` }])

    const links = await rows(`SELECT document_id::text document_id, linked_entity_type, linked_entity_id::text linked_entity_id, linked_by FROM document_links WHERE organization_id = $1 AND document_id = ANY($2::uuid[]) ORDER BY document_id`, [ORG, docs.map((d) => d.id)])
    expect(links).toHaveLength(2)
    for (const link of links) expect(link).toMatchObject({ linked_entity_type: 'grievance', linked_entity_id: cases[0].id, linked_by: IMPORTER })

    const tracked = await rows(`SELECT r.external_id, r.status, r.entity_id::text entity_id FROM ingestion_records r WHERE r.batch_id = $1 ORDER BY r.record_index`, [firstBatch])
    expect(tracked).toEqual([
      { external_id: 'C-1', status: 'succeeded', entity_id: cases[0].id },
      { external_id: 'C-2', status: 'succeeded', entity_id: cases[1].id },
    ])
    expect((await rows(`SELECT status, succeeded, failed FROM ingestion_batches WHERE id = $1`, [firstBatch]))[0]).toEqual({ status: 'completed', succeeded: 2, failed: 0 })
  })

  it('verifies the batch it wrote, as the same runtime role, and does not pass it without a source manifest or verified document content', async () => {
    const verified = await run(ORG, () => verification!.verifyImportBatch(firstBatch))
    expect(verified.passed).toBe(false)
    expect(verified.checks.map((c) => c.check)).toEqual(['source_manifest_missing', 'document_content_unverified'])
    expect(verified.summary).toEqual({
      grievancesImported: 2, timelineEventsCreated: 1, documentsLinked: 2, orphanDocuments: 0, stuckRecords: 0,
      documentsContentVerified: 0, documentsReferenceOnly: 2, sourceManifestId: null, predecessorBatchId: null, successorBatchId: null,
    })
  })

  it('keeps the raw source values, their mapping and the import observation apart from the case history (MIG-02, MIG-03)', async () => {
    const provenance = await rows(`SELECT p.external_case_id, p.source_status_raw, p.source_priority_raw, p.source_step_raw, p.mapped_status, p.mapped_priority, p.mapped_step,
        p.observed_at = g.imported_at observed_at_import, length(p.record_fingerprint) fp, p.record_fingerprint = g.import_fingerprint same_fp
      FROM ue_ingestion_record_provenance p JOIN grievances g ON g.id = p.grievance_id WHERE p.batch_id = $1 ORDER BY 1`, [firstBatch])
    expect(provenance).toEqual([
      { external_case_id: 'C-1', source_status_raw: 'filed', source_priority_raw: null, source_step_raw: null, mapped_status: 'filed', mapped_priority: 'medium', mapped_step: null, observed_at_import: true, fp: 64, same_fp: true },
      { external_case_id: 'C-2', source_status_raw: 'filed', source_priority_raw: null, source_step_raw: null, mapped_status: 'filed', mapped_priority: 'medium', mapped_step: null, observed_at_import: true, fp: 64, same_fp: true },
    ])
    expect((await rows(`SELECT count(*)::int n FROM grievance_timeline_events WHERE organization_id = $1 AND event_type = 'imported'`, [ORG]))[0].n).toBe(0)
    // An unknown priority is refused before anything is written; an explicitly mapped one is stored with its raw value.
    expect(await importAs(ORG, [record(ORG, 'M-0', { priority: 'P1' })])).toMatchObject({ status: 'failed', batchId: '' })
    const mapped = await importAs(ORG, [record(ORG, 'M-1', { priority: 'P1', step: 'stage-two' })], SOURCE, { valueMapping: { priority: { P1: 'urgent' }, step: { 'stage-two': 'step_2' } } })
    expect(mapped).toMatchObject({ status: 'completed', succeeded: 1 })
    expect((await rows(`SELECT g.priority, g.step, p.source_priority_raw, p.source_step_raw FROM grievances g JOIN ue_ingestion_record_provenance p ON p.grievance_id = g.id WHERE g.organization_id = $1 AND g.external_case_id = 'M-1'`, [ORG]))[0])
      .toEqual({ priority: 'urgent', step: 'step_2', source_priority_raw: 'P1', source_step_raw: 'stage-two' })
    expect((await rows(`SELECT mapping_digest <> (SELECT mapping_digest FROM ue_ingestion_batch_manifests WHERE batch_id = $2) differs FROM ue_ingestion_batch_manifests WHERE batch_id = $1`, [mapped.batchId, firstBatch]))[0].differs).toBe(true)
    await expect(admin.query(`UPDATE ue_ingestion_record_provenance SET source_status_raw = 'x' WHERE batch_id = $1`, [firstBatch])).rejects.toThrow(/UE_INGESTION_RECORD_IMMUTABLE/)
  })

  it('is idempotent: the same records again change the same rows and add no copy', async () => {
    const before = await rows(`SELECT id::text id, grievance_number FROM grievances WHERE organization_id = $1 ORDER BY external_case_id`, [ORG])
    const documentsBefore = await rows(`SELECT id::text id FROM documents WHERE organization_id = $1 ORDER BY id`, [ORG])
    const corrected = (status: string) => record(ORG, 'C-1', {
      title: 'Case C-1, corrected',
      status,
      timeline: [{ date: '2026-01-11', action: 'acknowledged', actor: 'Steward', notes: 'Acknowledged by the steward' }],
      documents: [
        { external_id: 'D-1', name: 'Grievance form (signed).pdf', file_type: 'pdf', file_url: 'https://files.example.test/form.pdf' },
        { name: 'Phone note', file_type: 'note' },
      ],
    })

    // An import is not a case handler: canonical V2 lets only an actor with case:transition authority over the case change its status
    // (ue_guard_case_closure_write, CASE_TRANSITION_AUTHORITY_REQUIRED). A re-import that would move an existing case's status fails that
    // record and leaves nothing of it; the record after it still imports.
    const moved = await importAs(ORG, [corrected('investigating'), record(ORG, 'C-2')])
    expect(moved).toMatchObject({ status: 'partial', succeeded: 1, failed: 1 })
    expect(moved.errors.map((e) => e.externalId)).toEqual(['C-1'])
    const untouched = await rows(`SELECT id::text id, grievance_number, title, status, import_batch_id::text batch FROM grievances WHERE organization_id = $1 AND external_case_id = 'C-1'`, [ORG])
    expect(untouched).toEqual([{ id: before[0].id, grievance_number: before[0].grievance_number, title: 'Case C-1', status: 'filed', batch: firstBatch }])
    expect((await rows(`SELECT name FROM documents WHERE organization_id = $1 AND external_document_id = 'D-1'`, [ORG]))[0].name).toBe('Grievance form.pdf')

    const second = await importAs(ORG, [corrected('filed'), record(ORG, 'C-2')])
    expect(second).toMatchObject({ status: 'completed', succeeded: 2, failed: 0 })
    expect(second.batchId).not.toBe(firstBatch)

    const after = await rows(`SELECT id::text id, grievance_number, title, status, import_batch_id::text batch FROM grievances WHERE organization_id = $1 ORDER BY external_case_id`, [ORG])
    expect(after.map((r) => ({ id: r.id, grievance_number: r.grievance_number }))).toEqual(before)
    expect(after[0]).toMatchObject({ title: 'Case C-1, corrected', status: 'filed', batch: second.batchId })
    expect(await rows(`SELECT id::text id FROM documents WHERE organization_id = $1 ORDER BY id`, [ORG])).toEqual(documentsBefore)
    expect((await rows(`SELECT name FROM documents WHERE organization_id = $1 AND external_document_id = 'D-1'`, [ORG]))[0].name).toBe('Grievance form (signed).pdf')
    expect((await rows(`SELECT count(*)::int n FROM document_versions WHERE organization_id = $1`, [ORG]))[0].n).toBe(1)
    expect((await rows(`SELECT count(*)::int n FROM document_links WHERE organization_id = $1`, [ORG]))[0].n).toBe(2)
    // The acknowledged event is unchanged, so it is not copied.
    expect(await rows(`SELECT event_type, count(*)::int n FROM grievance_timeline_events WHERE grievance_id = $1 GROUP BY event_type ORDER BY event_type`, [before[0].id])).toEqual([
      { event_type: 'acknowledged', n: 1 },
    ])
    // Each batch is the successor of the one before it from this source: one chain, sealed and immutable (MIG-11).
    const chain = await rows(`SELECT batch_id::text batch, predecessor_batch_id::text predecessor, outcome, sealed_at IS NOT NULL sealed FROM ue_ingestion_batch_manifests WHERE batch_id = ANY($1::uuid[])`, [[moved.batchId, second.batchId]])
    expect(chain).toEqual(expect.arrayContaining([
      expect.objectContaining({ batch: second.batchId, predecessor: moved.batchId, outcome: 'completed', sealed: true }),
      expect.objectContaining({ batch: moved.batchId, outcome: 'partial', sealed: true }),
    ]))
    await expect(admin.query(`UPDATE ue_ingestion_batch_manifests SET outcome = 'completed' WHERE batch_id = $1`, [moved.batchId])).rejects.toThrow(/UE_INGESTION_BATCH_MANIFEST_IMMUTABLE/)
    await expect(admin.query(`DELETE FROM ue_ingestion_batch_manifests WHERE batch_id = $1`, [moved.batchId])).rejects.toThrow(/UE_INGESTION_BATCH_MANIFEST_RETAINED/)
    // A second successor of the same batch (a fork) is refused by the database.
    const forkBatch = (await admin.query(`INSERT INTO ingestion_batches (organization_id, source_system, status) VALUES ($1, $2, 'processing') RETURNING id::text`, [ORG, SOURCE])).rows[0].id
    await expect(admin.query(`INSERT INTO ue_ingestion_batch_manifests (batch_id, organization_id, source_system, predecessor_batch_id, record_count, record_digest, mapping_digest)
      VALUES ($1, $2, $3, $4, 0, $5, $5)`, [forkBatch, ORG, SOURCE, moved.batchId, sha('x')])).rejects.toSatisfy((error) => codeOf(error) === '23505')
  })

  it('treats the same external id from another source system, or another organization, as another case', async () => {
    const elsewhere = await importAs(ORG, [record(ORG, 'C-1')], 'second-system')
    expect(elsewhere).toMatchObject({ status: 'completed', succeeded: 1 })
    const mine = await rows(`SELECT source_system, grievance_number FROM grievances WHERE organization_id = $1 AND external_case_id = 'C-1' ORDER BY source_system`, [ORG])
    expect(mine.map((r) => r.source_system)).toEqual([SOURCE, 'second-system'])
    expect(new Set(mine.map((r) => r.grievance_number)).size).toBe(2)

    const theirs = await importAs(OTHER, [record(OTHER, 'C-1')])
    expect(theirs).toMatchObject({ status: 'completed', succeeded: 1 })
    expect((await rows(`SELECT count(*)::int n FROM grievances WHERE organization_id = $1`, [OTHER]))[0].n).toBe(1)
    // Row-level security: each organization's own session reads only its own cases.
    const seenByOther = await run(OTHER, async () => Array.from(await (state.tx as { execute: (q: unknown) => Promise<Iterable<{ organization_id: string }>> }).execute(sql`SELECT organization_id::text FROM grievances WHERE external_case_id = 'C-1'`)))
    expect(seenByOther.map((r) => r.organization_id)).toEqual([OTHER])
    const seenByOrg = await run(ORG, async () => Array.from(await (state.tx as { execute: (q: unknown) => Promise<Iterable<{ organization_id: string }>> }).execute(sql`SELECT organization_id::text FROM grievances WHERE external_case_id = 'C-1'`)))
    expect(seenByOrg.map((r) => r.organization_id).sort()).toEqual([ORG, ORG])
  })

  it('fails a record that names another organization, and imports the rest', async () => {
    const result = await importAs(ORG, [record(OTHER, 'X-1'), record(ORG, 'X-2')])
    expect(result).toMatchObject({ status: 'partial', succeeded: 1, failed: 1 })
    expect(result.errors[0]).toMatchObject({ externalId: 'X-1' })
    expect(result.errors[0].error).toMatch(/Organization mismatch/)
    expect((await rows(`SELECT count(*)::int n FROM grievances WHERE external_case_id = 'X-1'`))[0].n).toBe(0)
  })

  it('leaves nothing of a record that fails, and the records after it still import', async () => {
    // A case number from the source that another case already holds: the database refuses the second one (grievance_number is unique across organizations).
    const held = (await rows(`SELECT grievance_number FROM grievances WHERE organization_id = $1 AND external_case_id = 'C-2'`, [ORG]))[0].grievance_number as string
    const result = await importAs(ORG, [
      record(ORG, 'Y-1'),
      record(ORG, 'Y-2', { grievance_number: held, documents: [{ name: 'Left behind?', file_type: 'pdf', file_url: 'https://files.example.test/y2.pdf' }] }),
      record(ORG, 'Y-3'),
    ])
    expect(result).toMatchObject({ status: 'partial', totalRecords: 3, succeeded: 2, failed: 1 })
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toMatchObject({ externalId: 'Y-2' })
    expect(result.errors[0].error).toMatch(/grievance_number|duplicate key/)
    expect((await rows(`SELECT external_case_id FROM grievances WHERE organization_id = $1 AND external_case_id LIKE 'Y-%' ORDER BY 1`, [ORG])).map((r) => r.external_case_id)).toEqual(['Y-1', 'Y-3'])
    expect((await rows(`SELECT count(*)::int n FROM documents WHERE organization_id = $1 AND name = 'Left behind?'`, [ORG]))[0].n).toBe(0)
    expect((await rows(`SELECT external_id, status FROM ingestion_records WHERE batch_id = $1 ORDER BY record_index`, [result.batchId]))).toEqual([
      { external_id: 'Y-1', status: 'succeeded' },
      { external_id: 'Y-2', status: 'failed' },
      { external_id: 'Y-3', status: 'succeeded' },
    ])
  })

  it('rejects a status a grievance cannot hold before it writes anything', async () => {
    const result = await importAs(ORG, [record(ORG, 'Z-1', { status: 'pending_documentation' })])
    expect(result).toMatchObject({ status: 'failed', succeeded: 0, batchId: '' })
    expect(result.errors[0].error).toMatch(/20 characters/)
    expect((await rows(`SELECT count(*)::int n FROM grievances WHERE external_case_id = 'Z-1'`))[0].n).toBe(0)
  })

  it('finds a document that no case owns', async () => {
    const orphan = (await rows(`SELECT d.id::text id FROM documents d WHERE d.organization_id = $1 AND d.external_document_id = 'D-1'`, [ORG]))[0].id as string
    await admin.query(`DELETE FROM document_links WHERE document_id = $1`, [orphan])
    const latest = (await rows(`SELECT import_batch_id::text batch FROM documents WHERE id = $1`, [orphan]))[0].batch as string
    const verified = await run(ORG, () => verification!.verifyImportBatch(latest))
    // An orphan document blocks: the batch does not pass verification.
    expect(verified.passed).toBe(false)
    expect(verified.checks).toEqual(expect.arrayContaining([expect.objectContaining({ check: 'orphan_documents', severity: 'error', count: 1 })]))
    expect(verified.summary.orphanDocuments).toBe(1)
  })

  it('does not overwrite a case changed in the platform after its last import: the record fails with a conflict and the change stays', async () => {
    const first = await importAs(ORG, [record(ORG, 'E-1')])
    expect(first).toMatchObject({ status: 'completed', succeeded: 1 })
    const stamped = (await rows(`SELECT updated_at = imported_at same FROM grievances WHERE organization_id = $1 AND external_case_id = 'E-1'`, [ORG]))[0]
    expect(stamped.same).toBe(true)

    // A platform write after the import (a handler's correction) moves updated_at past imported_at.
    await admin.query(`UPDATE grievances SET title = 'Corrected by the handler', updated_at = imported_at + interval '1 minute' WHERE organization_id = $1 AND external_case_id = 'E-1'`, [ORG])

    const again = await importAs(ORG, [record(ORG, 'E-1', { title: 'Source title' }), record(ORG, 'E-2')])
    expect(again).toMatchObject({ status: 'partial', succeeded: 1, failed: 1 })
    expect(again.errors[0]).toMatchObject({ externalId: 'E-1' })
    expect(again.errors[0].error).toMatch(/changed after its last import/)
    const kept = await rows(`SELECT title, import_batch_id::text batch FROM grievances WHERE organization_id = $1 AND external_case_id = 'E-1'`, [ORG])
    expect(kept).toEqual([{ title: 'Corrected by the handler', batch: first.batchId }])
    expect((await rows(`SELECT count(*)::int n FROM grievance_timeline_events WHERE import_batch_id = $1 AND grievance_id = (SELECT id FROM grievances WHERE organization_id = $2 AND external_case_id = 'E-1')`, [again.batchId, ORG]))[0].n).toBe(0)

    // The partial batch does not pass verification.
    const verified = await run(ORG, () => verification!.verifyImportBatch(again.batchId))
    expect(verified.passed).toBe(false)
    expect(verified.checks.map((c) => c.check)).toContain('batch_incomplete')
  })

  it('a case created in the platform with the same external key is never taken over by an import', async () => {
    await admin.query(
      `INSERT INTO grievances (id, created_at, updated_at, grievance_number, description, organization_id, title, type, status, priority, has_legal_implications, is_arbitration_eligible, is_confidential, is_group_grievance, external_case_id, source_system)
       VALUES (gen_random_uuid(), now(), now(), $1, 'd', $2, 'Platform case', 'individual', 'filed', 'medium', false, false, false, false, 'P-1', $3)`,
      [`KEY-${randomUUID().slice(0, 8)}`, ORG, SOURCE],
    )
    const result = await importAs(ORG, [record(ORG, 'P-1')])
    expect(result).toMatchObject({ status: 'failed', succeeded: 0, failed: 1 })
    expect(result.errors[0].error).toMatch(/changed after its last import/)
    expect((await rows(`SELECT title, import_batch_id FROM grievances WHERE organization_id = $1 AND external_case_id = 'P-1'`, [ORG]))).toEqual([{ title: 'Platform case', import_batch_id: null }])
  })

  it('refuses a record without a historical filed date, or with an undated or unknown-stage history, before it writes anything', async () => {
    for (const bad of [
      record(ORG, 'H-1', { filed_date: undefined }),
      record(ORG, 'H-2', { timeline: [{ date: '', action: 'acknowledged', actor: 'Steward' }] }),
      record(ORG, 'H-3', { step: 'second_level_hearing' }),
    ]) {
      const result = await importAs(ORG, [bad])
      expect(result).toMatchObject({ status: 'failed', succeeded: 0, batchId: '' })
    }
    expect((await rows(`SELECT count(*)::int n FROM grievances WHERE organization_id = $1 AND external_case_id LIKE 'H-%'`, [ORG]))[0].n).toBe(0)
  })

  it('verification fails for a batch the organization cannot see (another organization\'s, or none)', async () => {
    const theirs = (await rows(`SELECT id::text id FROM ingestion_batches WHERE organization_id = $1 LIMIT 1`, [OTHER]))[0].id as string
    for (const batchId of [theirs, randomUUID()]) {
      const verified = await run(ORG, () => verification!.verifyImportBatch(batchId))
      expect(verified.passed).toBe(false)
      expect(verified.checks.map((c) => c.check)).toContain('batch_not_found')
      expect(verified.summary.grievancesImported).toBe(0)
    }
  })

  it('the database refuses an external id with no source system, and a second case with the same key', async () => {
    const insert = (columns: string, values: unknown[]) =>
      admin.query(
        `INSERT INTO grievances (id, created_at, updated_at, grievance_number, description, organization_id, title, type, status, priority, has_legal_implications, is_arbitration_eligible, is_confidential, is_group_grievance, ${columns})
         VALUES (gen_random_uuid(), now(), now(), $1, 'd', $2, 't', 'individual', 'filed', 'medium', false, false, false, false, ${values.map((_, i) => `$${i + 3}`).join(', ')})`,
        [`KEY-${randomUUID().slice(0, 8)}`, ORG, ...values],
      )
    await expect(insert('external_case_id', ['NO-SOURCE'])).rejects.toSatisfy((error) => codeOf(error) === '23514')
    await expect(insert('external_case_id, source_system', ['C-2', SOURCE])).rejects.toSatisfy((error) => codeOf(error) === '23505')
    await expect(
      admin.query(
        `INSERT INTO documents (organization_id, name, file_url, file_type, uploaded_by, external_document_id) VALUES ($1, 'n', 'u', 'pdf', 'u', 'NO-SOURCE')`,
        [ORG],
      ),
    ).rejects.toSatisfy((error) => codeOf(error) === '23514')
    await expect(
      admin.query(
        `INSERT INTO documents (organization_id, name, file_url, file_type, uploaded_by, source_system, external_document_id) VALUES ($1, 'n', 'u', 'pdf', 'u', $2, 'D-1')`,
        [ORG, SOURCE],
      ),
    ).rejects.toSatisfy((error) => codeOf(error) === '23505')
  })

  it('does not overwrite a document changed in the platform, or swap the content a source declared for it (MIG-04, MIG-05)', async () => {
    const doc = { external_id: 'DD-1', name: 'Original.pdf', file_type: 'pdf', file_url: 'https://files.example.test/dd1.pdf', sha256: sha('dd1') }
    expect(await importAs(ORG, [record(ORG, 'DOC-1', { documents: [doc] })])).toMatchObject({ status: 'completed' })
    expect((await rows(`SELECT updated_at = imported_at same FROM documents WHERE organization_id = $1 AND external_document_id = 'DD-1'`, [ORG]))[0].same).toBe(true)
    // The same declaration again is a no-op re-import.
    expect(await importAs(ORG, [record(ORG, 'DOC-1', { documents: [doc] })])).toMatchObject({ status: 'completed' })
    const swapped = await importAs(ORG, [record(ORG, 'DOC-1', { documents: [{ ...doc, sha256: sha('other bytes') }] })])
    expect(swapped).toMatchObject({ status: 'failed', failed: 1 })
    expect(swapped.errors[0].error).toMatch(/different declared digest/)
    await admin.query(`UPDATE documents SET name = 'Renamed by a handler', updated_at = imported_at + interval '1 minute' WHERE organization_id = $1 AND external_document_id = 'DD-1'`, [ORG])
    const overwrite = await importAs(ORG, [record(ORG, 'DOC-1', { documents: [doc] })])
    expect(overwrite).toMatchObject({ status: 'failed', failed: 1 })
    expect(overwrite.errors[0].error).toMatch(/changed after its last import/)
    expect((await rows(`SELECT name FROM documents WHERE organization_id = $1 AND external_document_id = 'DD-1'`, [ORG]))[0].name).toBe('Renamed by a handler')
  })

  it('passes verification only once a declared source manifest reconciles and every document\'s bytes match their declared digest (MIG-05, MIG-07)', async () => {
    const VERIFIED = 'verified-system'
    const declared = await run(ORG, () => manifests!.declareSourceManifest({ organizationId: ORG, sourceSystem: VERIFIED, caseIds: ['V-1'], expectedDocumentCount: 2, declaredBy: IMPORTER }))
    // The same declaration is the same manifest.
    expect((await run(ORG, () => manifests!.declareSourceManifest({ organizationId: ORG, sourceSystem: VERIFIED, caseIds: ['V-1'], expectedDocumentCount: 2, declaredBy: IMPORTER }))).manifestId).toBe(declared.manifestId)
    await expect(admin.query(`UPDATE ue_ingestion_source_manifests SET expected_document_count = 0 WHERE id = $1`, [declared.manifestId])).rejects.toThrow(/UE_INGESTION_RECORD_IMMUTABLE/)
    const result = await importAs(ORG, [record(ORG, 'V-1', { documents: [
      { external_id: 'VD-1', name: 'Form.pdf', file_type: 'pdf', file_url: 'https://files.example.test/v1.pdf', sha256: sha('form bytes') },
      { external_id: 'VD-2', name: 'Letter.pdf', file_type: 'pdf', file_url: 'https://files.example.test/v2.pdf', sha256: sha('letter bytes') },
    ] })], VERIFIED, { sourceManifestId: declared.manifestId })
    expect(result).toMatchObject({ status: 'completed', succeeded: 1 })
    const docIds = Object.fromEntries((await rows(`SELECT external_document_id, id::text id FROM documents WHERE organization_id = $1 AND source_system = $2`, [ORG, VERIFIED])).map((r) => [r.external_document_id, r.id]))

    let verified = await run(ORG, () => verification!.verifyImportBatch(result.batchId))
    expect(verified.checks.map((c) => c.check)).toEqual(['document_content_unverified'])
    expect(verified.summary).toMatchObject({ sourceManifestId: declared.manifestId, documentsReferenceOnly: 2, documentsContentVerified: 0 })

    const bytes = (text: string) => new TextEncoder().encode(text)
    expect(await run(ORG, () => evidence!.verifyImportedDocumentContent({ organizationId: ORG, documentId: docIds['VD-1'], bytes: bytes('form bytes'), verifiedBy: IMPORTER })))
      .toMatchObject({ status: 'verified', state: 'digest_verified', byteSize: 10 })
    verified = await run(ORG, () => verification!.verifyImportBatch(result.batchId))
    expect(verified.checks.map((c) => c.check)).toEqual(['document_content_unverified'])
    expect(await run(ORG, () => evidence!.verifyImportedDocumentContent({ organizationId: ORG, documentId: docIds['VD-2'], bytes: bytes('letter bytes'), verifiedBy: IMPORTER })))
      .toMatchObject({ status: 'verified' })
    verified = await run(ORG, () => verification!.verifyImportBatch(result.batchId))
    expect(verified.passed).toBe(true)
    expect(verified.checks).toEqual([])
    expect(verified.summary).toMatchObject({ documentsContentVerified: 2, documentsReferenceOnly: 0 })

    // Verified once: a second verification is refused, and the evidence cannot be rewritten. No scanner has passed it, so it is not available content.
    expect(await run(ORG, () => evidence!.verifyImportedDocumentContent({ organizationId: ORG, documentId: docIds['VD-1'], bytes: bytes('other'), verifiedBy: IMPORTER })))
      .toEqual({ status: 'refused', reason: 'ALREADY_DECIDED', state: 'digest_verified' })
    await expect(admin.query(`UPDATE ue_imported_document_evidence SET verification_state = 'reference_only', verified_digest = NULL, verified_at = NULL, byte_size = NULL WHERE document_id = $1`, [docIds['VD-1']])).rejects.toThrow(/UE_IMPORTED_DOCUMENT_EVIDENCE_IMMUTABLE/)
    expect(await run(ORG, () => evidence!.isImportedDocumentContentAvailable(ORG, docIds['VD-1']))).toBe(false)
  })

  it('fails a batch that does not reconcile with its manifest, and records mismatched bytes as a mismatch (MIG-05, MIG-07)', async () => {
    const SYS = 'reconcile-system'
    const declared = await run(ORG, () => manifests!.declareSourceManifest({ organizationId: ORG, sourceSystem: SYS, caseIds: ['R-1', 'R-2'], expectedDocumentCount: 1, declaredBy: IMPORTER }))
    const result = await importAs(ORG, [record(ORG, 'R-1', { documents: [{ external_id: 'RD-1', name: 'R.pdf', file_type: 'pdf', file_url: 'https://files.example.test/r.pdf', sha256: sha('r bytes') }] }), record(ORG, 'R-3')], SYS, { sourceManifestId: declared.manifestId })
    expect(result).toMatchObject({ status: 'completed', succeeded: 2 })
    const doc = (await rows(`SELECT id::text id FROM documents WHERE organization_id = $1 AND external_document_id = 'RD-1'`, [ORG]))[0].id
    expect(await run(ORG, () => evidence!.verifyImportedDocumentContent({ organizationId: ORG, documentId: doc, bytes: new TextEncoder().encode('tampered'), verifiedBy: IMPORTER })))
      .toMatchObject({ status: 'mismatch', state: 'digest_mismatch' })
    const verified = await run(ORG, () => verification!.verifyImportBatch(result.batchId))
    expect(verified.passed).toBe(false)
    expect(verified.checks.map((c) => c.check).sort()).toEqual(['document_digest_mismatch', 'source_manifest_missing_cases', 'source_manifest_unexpected_cases'])
    expect(verified.checks.find((c) => c.check === 'source_manifest_missing_cases')?.details).toEqual(['R-2'])
    expect(verified.checks.find((c) => c.check === 'source_manifest_unexpected_cases')?.details).toEqual(['R-3'])
    // A document without a declared digest can never be verified.
    const plain = (await rows(`SELECT id::text id FROM documents WHERE organization_id = $1 AND name = 'Phone note' LIMIT 1`, [ORG]))[0].id
    expect(await run(ORG, () => evidence!.verifyImportedDocumentContent({ organizationId: ORG, documentId: plain, bytes: new Uint8Array(), verifiedBy: IMPORTER })))
      .toMatchObject({ status: 'refused', reason: 'SOURCE_DIGEST_REQUIRED' })
  })

  it('binds a source manifest to its organization: another organization cannot import against it', async () => {
    const declared = await run(ORG, () => manifests!.declareSourceManifest({ organizationId: ORG, sourceSystem: 'bound-system', caseIds: ['B-1'], expectedDocumentCount: 0, declaredBy: IMPORTER }))
    await expect(importAs(OTHER, [record(OTHER, 'B-1')], 'bound-system', { sourceManifestId: declared.manifestId })).rejects.toBeDefined()
    expect((await rows(`SELECT count(*)::int n FROM grievances WHERE organization_id = $1 AND external_case_id = 'B-1'`, [OTHER]))[0].n).toBe(0)
  })
})
