import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(process.cwd(), 'db/migrations-platform')
const statements = (file: string) =>
  readFileSync(join(dir, file), 'utf8')
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s && !s.split('\n').every((l) => l.startsWith('--')))
const run = async (pg: PGlite, file = '0042_tenant_scoped_uniqueness.sql') => {
  for (const sql of statements(file)) await pg.exec(sql)
}

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

const TABLES: Array<[string, string]> = [
  ['collective_agreements', 'cba_number'],
  ['training_courses', 'course_code'],
  ['course_sessions', 'session_code'],
  ['member_certifications', 'certification_number'],
  ['workplace_incidents', 'incident_number'],
  ['safety_inspections', 'inspection_number'],
  ['hazard_reports', 'report_number'],
  ['ppe_equipment', 'item_number'],
  ['organizing_campaigns', 'campaign_code'],
]

describe('platform migration 0042_tenant_scoped_uniqueness on PGlite', () => {
  let pg: PGlite
  const create = async (unique: 'constraint' | 'index' | 'none') => {
    for (const [table, column] of TABLES) {
      await pg.exec(`CREATE TABLE ${table} (id uuid primary key default gen_random_uuid(), organization_id uuid not null, ${column} varchar(100) not null${unique === 'constraint' ? ` UNIQUE` : ''})`)
      if (unique === 'index') await pg.exec(`CREATE UNIQUE INDEX ${table}_${column}_idx ON ${table} (${column})`)
    }
  }
  const insert = (table: string, column: string, org: string, code: string) =>
    pg.query(`INSERT INTO ${table} (organization_id, ${column}) VALUES ($1::uuid, $2)`, [org, code])

  beforeEach(() => {
    pg = new PGlite()
  })
  afterEach(async () => {
    await pg.close()
  })

  it.each(['constraint', 'index'] as const)('lets two organizations use one code and still refuses a repeat inside one (%s)', async (kind) => {
    await create(kind)
    await insert('collective_agreements', 'cba_number', A, 'C-1')
    await expect(insert('collective_agreements', 'cba_number', B, 'C-1')).rejects.toThrow(/duplicate key/)
    await run(pg)
    for (const [table, column] of TABLES) {
      await insert(table, column, A, 'X-1')
      await insert(table, column, B, 'X-1')
      await expect(insert(table, column, A, 'X-1'), `${table} repeat`).rejects.toThrow(/duplicate key/)
    }
  })

  it('is idempotent and keeps existing rows', async () => {
    await create('constraint')
    await insert('training_courses', 'course_code', A, 'T-1')
    await run(pg)
    await run(pg)
    const rows = await pg.query<{ n: number }>('SELECT count(*)::int AS n FROM training_courses')
    expect(rows.rows[0].n).toBe(1)
    const unique = await pg.query<{ indexname: string }>(`SELECT indexname FROM pg_indexes WHERE tablename = 'training_courses' AND indexdef ILIKE '%UNIQUE%' AND indexname NOT LIKE '%pkey'`)
    expect(unique.rows.map((r) => r.indexname)).toEqual(['uq_training_courses_org_course_code'])
  })

  it('refuses to apply over a code one organization already holds twice, and changes nothing', async () => {
    await create('none')
    await insert('hazard_reports', 'report_number', A, 'R-1')
    await insert('hazard_reports', 'report_number', A, 'R-1')
    await expect(run(pg)).rejects.toThrow(/duplicate/)
    const rows = await pg.query<{ n: number }>('SELECT count(*)::int AS n FROM hazard_reports')
    expect(rows.rows[0].n).toBe(2)
  })

  it('fails closed on a table without organization_id, and skips relations that do not exist', async () => {
    await pg.exec('CREATE TABLE ppe_equipment (id uuid primary key, item_number varchar(50) unique)')
    await expect(run(pg)).rejects.toThrow(/no organization_id/)
    const bare = new PGlite()
    await run(bare)
    await bare.close()
  })

  it('rolls back to global uniqueness only when no code is shared between organizations', async () => {
    await create('constraint')
    await run(pg)
    await insert('organizing_campaigns', 'campaign_code', A, 'K-1')
    await insert('organizing_campaigns', 'campaign_code', B, 'K-1')
    await expect(run(pg, '0042_tenant_scoped_uniqueness.rollback.sql')).rejects.toThrow(/rollback refused/)
    await pg.exec(`DELETE FROM organizing_campaigns WHERE organization_id = '${B}'`)
    await run(pg, '0042_tenant_scoped_uniqueness.rollback.sql')
    await expect(insert('organizing_campaigns', 'campaign_code', B, 'K-1')).rejects.toThrow(/duplicate key/)
  })
})
