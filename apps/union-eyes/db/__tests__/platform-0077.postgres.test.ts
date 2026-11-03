/**
 * Platform 0077, the ingestion traceability columns, applies, applies again and rolls back (UE-CONV-H-014).
 *
 * A rollback that has never run is a claim, not a property. Every case runs inside a transaction that is rolled back, so the database the other native tests share is
 * left as the bootstrap built it. What this holds:
 *   - the bootstrap built nine nullable columns (five on grievances, four on documents), four indexes and two constraints, each tagged for the rollback;
 *   - applying again changes nothing;
 *   - the rollback removes exactly those and applying after it restores the same catalog;
 *   - the rollback refuses while an imported row exists, and removes nothing;
 *   - a column that already existed with the same shape is left alone (untagged, so the rollback leaves it too), and one with another type is refused.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const platform = (file: string) => readFileSync(join(__dirname, '..', 'migrations-platform', file), 'utf8').replace(/\r\n/g, '\n')

const COLUMNS = [
  'documents.external_document_id',
  'documents.import_batch_id',
  'documents.imported_at',
  'documents.source_system',
  'grievances.external_case_id',
  'grievances.import_batch_id',
  'grievances.import_fingerprint',
  'grievances.imported_at',
  'grievances.source_system',
]
const INDEXES = ['idx_documents_import_batch_id', 'idx_grievances_import_batch_id', 'ux_documents_org_source_external_document', 'ux_grievances_org_source_external_case']
const CONSTRAINTS = ['documents_external_document_names_source', 'grievances_external_case_names_source']

describe.skipIf(!URL)('platform 0077 on the combined schema', () => {
  const up = platform('0077_ingestion_traceability.sql')
  const down = platform('0077_ingestion_traceability.rollback.sql')
  let admin: pg.Client

  const inTransaction = async (work: () => Promise<void>) => {
    await admin.query('BEGIN')
    try {
      await work()
    } finally {
      await admin.query('ROLLBACK')
    }
  }
  const messageOf = async (work: () => Promise<unknown>) => {
    try {
      await work()
      return 'no error'
    } catch (error) {
      return (error as Error).message
    }
  }

  // What the migration is about, as the catalog holds it: the columns with their type, the indexes and constraints with their definition, and each one's tag.
  const snapshot = async () => {
    const columns = (
      await admin.query(
        `SELECT c.relname || '.' || a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS not_null, col_description(c.oid, a.attnum) AS tag
           FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = ANY($1) AND a.attnum > 0 AND NOT a.attisdropped AND c.relname || '.' || a.attname = ANY($2)
          ORDER BY 1`,
        [['grievances', 'documents'], COLUMNS],
      )
    ).rows
    const indexes = (
      await admin.query(
        `SELECT i.indexname AS name, i.indexdef AS definition, obj_description(format('public.%I', i.indexname)::regclass, 'pg_class') AS tag FROM pg_indexes i WHERE i.schemaname = 'public' AND i.indexname = ANY($1) ORDER BY 1`,
        [INDEXES],
      )
    ).rows
    const constraints = (
      await admin.query(
        `SELECT c.conname AS name, pg_get_constraintdef(c.oid) AS definition, obj_description(c.oid, 'pg_constraint') AS tag FROM pg_constraint c WHERE c.conname = ANY($1) ORDER BY 1`,
        [CONSTRAINTS],
      )
    ).rows
    return { columns, indexes, constraints }
  }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
  }, 60_000)

  afterAll(async () => {
    await admin?.end().catch(() => undefined)
  })

  it('starts as the bootstrap built it: nine nullable tagged columns, four tagged indexes and two tagged constraints', async () => {
    const built = await snapshot()
    expect(built.columns.map((c) => c.name)).toEqual(COLUMNS)
    for (const column of built.columns) {
      expect(column.not_null, `${column.name} is nullable`).toBe(false)
      expect(column.tag).toBe('platform-migration:ingestion_traceability:column')
    }
    expect(Object.fromEntries(built.columns.map((c) => [c.name, c.type]))).toMatchObject({
      'grievances.external_case_id': 'character varying(255)',
      'grievances.import_fingerprint': 'character varying(64)',
      'grievances.source_system': 'character varying(100)',
      'grievances.imported_at': 'timestamp with time zone',
      'grievances.import_batch_id': 'uuid',
      'documents.external_document_id': 'character varying(255)',
      'documents.source_system': 'character varying(100)',
      'documents.imported_at': 'timestamp with time zone',
      'documents.import_batch_id': 'uuid',
    })
    expect(built.indexes.map((i) => i.name)).toEqual(INDEXES)
    expect(built.indexes.map((i) => i.tag)).toEqual(INDEXES.map(() => 'platform-migration:ingestion_traceability:index'))
    const byName = Object.fromEntries(built.indexes.map((i) => [i.name, i.definition as string]))
    expect(byName.ux_grievances_org_source_external_case).toMatch(/^CREATE UNIQUE INDEX \S+ ON public\.grievances USING btree \(organization_id, source_system, external_case_id\) WHERE \(external_case_id IS NOT NULL\)$/)
    expect(byName.ux_documents_org_source_external_document).toMatch(/^CREATE UNIQUE INDEX \S+ ON public\.documents USING btree \(organization_id, source_system, external_document_id\) WHERE \(external_document_id IS NOT NULL\)$/)
    expect(built.constraints.map((c) => c.name)).toEqual(CONSTRAINTS)
    expect(built.constraints.map((c) => c.tag)).toEqual(CONSTRAINTS.map(() => 'platform-migration:ingestion_traceability:constraint'))
    expect(built.constraints.map((c) => c.definition)).toEqual(['CHECK (((external_document_id IS NULL) OR (source_system IS NOT NULL)))', 'CHECK (((external_case_id IS NULL) OR (source_system IS NOT NULL)))'])
  })

  it('applies again and changes nothing', async () => {
    const before = await snapshot()
    await inTransaction(async () => {
      await admin.query(up)
      await admin.query(up)
      expect(await snapshot()).toEqual(before)
    })
  })

  it('rolls back to the schema before it, and applying after it restores the same catalog', async () => {
    const before = await snapshot()
    await inTransaction(async () => {
      await admin.query(down)
      expect(await snapshot()).toEqual({ columns: [], indexes: [], constraints: [] })
      await admin.query(down)
      await admin.query(up)
      expect(await snapshot()).toEqual(before)
    })
    expect(await snapshot()).toEqual(before)
  })

  it('refuses its rollback while an imported row exists, and removes nothing', async () => {
    const before = await snapshot()
    const org = randomUUID()
    await inTransaction(async () => {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,'R','r-${org.slice(0, 8)}','local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [org],
      )
      await admin.query(
        `INSERT INTO documents (organization_id, name, file_url, file_type, uploaded_by, source_system, external_document_id) VALUES ($1,'n','u','pdf','u','legacy','D-1')`,
        [org],
      )
      expect(await messageOf(() => admin.query(down))).toMatch(/rollback refuses: public\.documents\.(external_document_id|source_system) holds imported data/)
    })
    await inTransaction(async () => {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,'R','r-${org.slice(0, 8)}','local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [org],
      )
      await admin.query(
        `INSERT INTO grievances (id, created_at, updated_at, grievance_number, description, organization_id, title, type, status, priority, has_legal_implications, is_arbitration_eligible, is_confidential, is_group_grievance, external_case_id, source_system)
         VALUES (gen_random_uuid(), now(), now(), $1, 'd', $2, 't', 'individual', 'filed', 'medium', false, false, false, false, 'C-1', 'legacy')`,
        [`RB-${org.slice(0, 8)}`, org],
      )
      expect(await messageOf(() => admin.query(down))).toMatch(/rollback refuses: public\.grievances\.(external_case_id|source_system) holds imported data/)
    })
    expect(await snapshot()).toEqual(before)
  })

  it('leaves a column that already existed with the same shape alone, untagged, and refuses one with another type', async () => {
    await inTransaction(async () => {
      await admin.query(down)
      await admin.query(`ALTER TABLE public.grievances ADD COLUMN external_case_id varchar(255)`)
      await admin.query(up)
      const rows = (await admin.query(`SELECT col_description('public.grievances'::regclass, a.attnum) AS tag FROM pg_attribute a WHERE a.attrelid = 'public.grievances'::regclass AND a.attname = 'external_case_id'`)).rows
      expect(rows).toEqual([{ tag: null }])
      await admin.query(down)
      const after = (await admin.query(`SELECT count(*)::int AS n FROM pg_attribute a WHERE a.attrelid = 'public.grievances'::regclass AND a.attname = 'external_case_id' AND NOT a.attisdropped`)).rows
      expect(after).toEqual([{ n: 1 }])
    })
    await inTransaction(async () => {
      await admin.query(down)
      await admin.query(`ALTER TABLE public.grievances ADD COLUMN import_batch_id text`)
      expect(await messageOf(() => admin.query(up))).toMatch(/public\.grievances\.import_batch_id is text, not uuid/)
    })
  })
})
