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
 *   - the post-import verification counts the batch and finds a document no case owns;
 *   - the database refuses what the writer relies on being true: an external id with no source system, a second case with the same key.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { serializeRawDates } from '@/db/driver-dates'

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
  const options = (organizationId: string, sourceSystem = SOURCE) => ({ organizationId, sourceSystem, createdBy: IMPORTER, continueOnError: true })
  const importAs = (organizationId: string, records: Array<ReturnType<typeof record>>, sourceSystem = SOURCE) =>
    run(organizationId, () => ingest!.ingestGrievanceBatch(records as never, options(organizationId, sourceSystem)))
  const rows = async (query: string, params: unknown[] = []) => (await admin.query(query, params)).rows

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    client = postgres(URL!, { max: 4, onnotice: () => undefined })
    const db = drizzle(client)
    serializeRawDates(client)
    run = (organizationId, work) =>
      db.transaction(async (tx) => {
        await tx.execute(sql.raw('SET LOCAL ROLE union_eyes_runtime'))
        await tx.execute(sql`SELECT set_config('app.current_org_id', ${organizationId}, true), set_config('app.current_user_id', ${IMPORTER}, true)`)
        state.tx = tx
        try {
          return await work()
        } finally {
          state.tx = null
        }
      })
    for (const [id, name] of [
      [ORG, 'Ingest Fixture Local'],
      [OTHER, 'Another Local'],
    ]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [id, name, `ing-${sfx}-${id.slice(0, 6)}`],
      )
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
    expect(events).toEqual([
      { event_type: 'acknowledged', n: 1 },
      { event_type: 'imported', n: 2 },
    ])

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

  it('verifies the batch it wrote, as the same runtime role', async () => {
    const verified = await run(ORG, () => verification!.verifyImportBatch(firstBatch))
    expect(verified.passed).toBe(true)
    expect(verified.checks).toEqual([])
    expect(verified.summary).toEqual({ grievancesImported: 2, timelineEventsCreated: 3, documentsLinked: 2, orphanDocuments: 0, stuckRecords: 0 })
  })

  it('is idempotent: the same records again change the same rows and add no copy', async () => {
    const before = await rows(`SELECT id::text id, grievance_number FROM grievances WHERE organization_id = $1 ORDER BY external_case_id`, [ORG])
    const documentsBefore = await rows(`SELECT id::text id FROM documents WHERE organization_id = $1 ORDER BY id`, [ORG])
    const second = await importAs(ORG, [
      record(ORG, 'C-1', {
        title: 'Case C-1, corrected',
        status: 'investigating',
        timeline: [{ date: '2026-01-11', action: 'acknowledged', actor: 'Steward', notes: 'Acknowledged by the steward' }],
        documents: [
          { external_id: 'D-1', name: 'Grievance form (signed).pdf', file_type: 'pdf', file_url: 'https://files.example.test/form.pdf' },
          { name: 'Phone note', file_type: 'note' },
        ],
      }),
      record(ORG, 'C-2'),
    ])
    expect(second).toMatchObject({ status: 'completed', succeeded: 2, failed: 0 })
    expect(second.batchId).not.toBe(firstBatch)

    const after = await rows(`SELECT id::text id, grievance_number, title, status, import_batch_id::text batch FROM grievances WHERE organization_id = $1 ORDER BY external_case_id`, [ORG])
    expect(after.map((r) => ({ id: r.id, grievance_number: r.grievance_number }))).toEqual(before)
    expect(after[0]).toMatchObject({ title: 'Case C-1, corrected', status: 'investigating', batch: second.batchId })
    expect(await rows(`SELECT id::text id FROM documents WHERE organization_id = $1 ORDER BY id`, [ORG])).toEqual(documentsBefore)
    expect((await rows(`SELECT name FROM documents WHERE organization_id = $1 AND external_document_id = 'D-1'`, [ORG]))[0].name).toBe('Grievance form (signed).pdf')
    expect((await rows(`SELECT count(*)::int n FROM document_versions WHERE organization_id = $1`, [ORG]))[0].n).toBe(1)
    expect((await rows(`SELECT count(*)::int n FROM document_links WHERE organization_id = $1`, [ORG]))[0].n).toBe(2)
    // The acknowledged event is unchanged; the imported event names the status the case now has, so it is a new event.
    expect(await rows(`SELECT event_type, count(*)::int n FROM grievance_timeline_events WHERE grievance_id = $1 GROUP BY event_type ORDER BY event_type`, [before[0].id])).toEqual([
      { event_type: 'acknowledged', n: 1 },
      { event_type: 'imported', n: 2 },
    ])
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
    expect(verified.passed).toBe(true)
    expect(verified.checks).toMatchObject([{ check: 'orphan_documents', severity: 'warning', count: 1 }])
    expect(verified.summary.orphanDocuments).toBe(1)
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
})
