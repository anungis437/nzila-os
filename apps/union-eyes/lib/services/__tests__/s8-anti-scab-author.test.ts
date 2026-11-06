import { describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const statements = read('db/migrations-platform/0044_anti_scab_author.sql')
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter((s) => s && !s.split('\n').every((l) => l.startsWith('--')))

describe('S8 anti-scab violation author (platform 0044)', () => {
  it('adds a nullable text created_by without inventing an author, idempotently, and skips a missing relation', async () => {
    const pg = new PGlite()
    for (const sql of statements) await pg.exec(sql)
    await pg.exec(`CREATE TABLE anti_scab_violations (id uuid primary key default gen_random_uuid(), organization_id uuid not null)`)
    await pg.exec(`INSERT INTO anti_scab_violations (organization_id) VALUES (gen_random_uuid())`)
    for (let i = 0; i < 2; i++) for (const sql of statements) await pg.exec(sql)
    const row = await pg.query<{ created_by: string | null }>('SELECT created_by FROM anti_scab_violations')
    expect(row.rows).toEqual([{ created_by: null }])
    const col = await pg.query<{ data_type: string; is_nullable: string }>(`SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name = 'anti_scab_violations' AND column_name = 'created_by'`)
    expect(col.rows).toEqual([{ data_type: 'text', is_nullable: 'YES' }])
    await pg.close()
  })

  it('declares createdBy so the factory stamps the session user, and stops taking the reporter or the outcome from the body', () => {
    expect(read('db/schema/domains/health-safety/cnesst-schema.ts')).toMatch(/createdBy: text\("created_by"\)/)
    const collection = read('app/api/cnesst/anti-scab/route.ts')
    expect(collection).toContain('writableFields: [')
    for (const field of ['reportedById', 'reportedByName', 'resolved', 'penaltyAmount', 'tatComplaintFiled']) expect(collection).not.toContain(`'${field}'`)
    // The item PATCH is a dedicated, strict schema: authorship, the reporter and the organization are not fields it accepts.
    const item = read('app/api/cnesst/anti-scab/[id]/route.ts')
    const schema = item.slice(item.indexOf('const patchSchema'), item.indexOf('}).strict();'))
    expect(schema.length).toBeGreaterThan(0)
    for (const field of ['createdBy', 'reportedById', 'reportedByName', 'organizationId']) expect(schema).not.toContain(`${field}:`)
  })

  // DEF-0B4-OHS-ANTI-SCAB-RECORD-NO-AUTHOR-OR-CASE-AUTHORITY: a steward role is not authority over every violation file. Until the institutional
  // authority over these records is decided, list, item read and change are limited to the record's author.
  it('limits the list, the item read and the change to the principal who filed the violation', () => {
    const access = read('lib/services/anti-scab-access.ts')
    expect(access).toContain('eq(antiScabViolations.createdBy, userId)')
    expect(access).toContain('sql`false`')
    expect(read('app/api/cnesst/anti-scab/route.ts')).toContain('readConditionFor: ({ userId }) => antiScabAuthorCondition(userId)')
    const item = read('app/api/cnesst/anti-scab/[id]/route.ts')
    expect(item).toContain('readConditionFor: ({ userId }) => antiScabAuthorCondition(userId)')
    expect(item).toMatch(/\.update\(antiScabViolations\)[\s\S]*antiScabAuthorCondition\(userId\)[\s\S]*persistAtomicAudit\(tx,/)
    expect(item).toContain('retainOnDelete: true')
  })
})
