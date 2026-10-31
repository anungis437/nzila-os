import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const file = join(process.cwd(), 'db/migrations-platform/0039_committee_memberships_shape.sql')
const statements = readFileSync(file, 'utf8')
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter((s) => s && !s.split('\n').every((l) => l.startsWith('--')))

const run = async (pg: PGlite) => {
  for (const sql of statements) await pg.exec(sql)
}

describe('platform migration 0039_committee_memberships_shape on PGlite', () => {
  let pg: PGlite
  beforeEach(async () => {
    pg = new PGlite()
  })
  afterEach(async () => {
    await pg.close()
  })

  it('fails closed when the relation does not exist', async () => {
    await expect(run(pg)).rejects.toThrow(/does not exist/)
  })

  it('adds the declared columns to an empty stub, enforces required ones, and is idempotent', async () => {
    await pg.exec('CREATE TABLE committee_memberships (id uuid primary key, committee_id uuid not null, created_at timestamptz default now(), updated_at timestamptz default now())')
    await run(pg)
    await run(pg)
    const cols = await pg.query<{ column_name: string; is_nullable: string }>(
      `SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'committee_memberships'`,
    )
    const byName = new Map(cols.rows.map((c) => [c.column_name, c.is_nullable]))
    for (const name of ['member_id', 'role', 'status', 'start_date', 'appointed_by', 'meetings_attended']) {
      expect(byName.has(name)).toBe(true)
    }
    expect(byName.get('member_id')).toBe('NO')
  })

  it('does not invent values for rows that already exist', async () => {
    await pg.exec('CREATE TABLE committee_memberships (id uuid primary key, committee_id uuid not null)')
    await pg.exec(`INSERT INTO committee_memberships (id, committee_id) VALUES (gen_random_uuid(), gen_random_uuid())`)
    await run(pg)
    const row = await pg.query<{ member_id: string | null }>('SELECT member_id FROM committee_memberships')
    expect(row.rows[0].member_id).toBeNull()
    const nullable = await pg.query<{ is_nullable: string }>(
      `SELECT is_nullable FROM information_schema.columns WHERE table_name = 'committee_memberships' AND column_name = 'member_id'`,
    )
    expect(nullable.rows[0].is_nullable).toBe('YES')
  })
})
