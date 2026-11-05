import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const statements = readFileSync(join(process.cwd(), 'db/migrations-platform/0043_knowledge_transfer_owner.sql'), 'utf8')
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter((s) => s && !s.split('\n').every((l) => l.startsWith('--')))
const run = async (pg: PGlite) => {
  for (const sql of statements) await pg.exec(sql)
}

describe('platform migration 0043_knowledge_transfer_owner on PGlite', () => {
  let pg: PGlite
  beforeEach(() => {
    pg = new PGlite()
  })
  afterEach(async () => {
    await pg.close()
  })

  it('adds a nullable created_by to both tables without inventing an author, and is idempotent', async () => {
    await pg.exec(`
      CREATE TABLE ue_copilot_conversations (id uuid primary key default gen_random_uuid(), organization_id uuid not null, updated_at timestamptz default now());
      CREATE TABLE ue_reasoning_sessions (id uuid primary key default gen_random_uuid(), organization_id uuid not null, updated_at timestamptz default now());
      INSERT INTO ue_copilot_conversations (organization_id) VALUES (gen_random_uuid());
      INSERT INTO ue_reasoning_sessions (organization_id) VALUES (gen_random_uuid());
    `)
    await run(pg)
    await run(pg)
    for (const table of ['ue_copilot_conversations', 'ue_reasoning_sessions']) {
      const row = await pg.query<{ created_by: string | null }>(`SELECT created_by FROM ${table}`)
      expect(row.rows).toEqual([{ created_by: null }])
    }
    const cols = await pg.query<{ is_nullable: string }>(`SELECT is_nullable FROM information_schema.columns WHERE column_name = 'created_by' AND table_name IN ('ue_copilot_conversations','ue_reasoning_sessions')`)
    expect(cols.rows).toHaveLength(2)
    expect(cols.rows.every((c) => c.is_nullable === 'YES')).toBe(true)
  })

  it('does not match a row with no creator to any user, which is how legacy rows stay hidden', async () => {
    await pg.exec(`CREATE TABLE ue_copilot_conversations (id uuid primary key default gen_random_uuid(), organization_id uuid not null, updated_at timestamptz default now())`)
    await pg.exec(`INSERT INTO ue_copilot_conversations (organization_id) VALUES ('11111111-1111-4111-8111-111111111111')`)
    await run(pg)
    const seen = await pg.query(`SELECT id FROM ue_copilot_conversations WHERE created_by = 'user-1'`)
    expect(seen.rows).toHaveLength(0)
  })

  it('skips relations that do not exist', async () => {
    const bare = new PGlite()
    await run(bare)
    await bare.close()
  })
})
