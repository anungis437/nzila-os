import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Stable under monorepo-root and app-local Vitest execution.
const dir = fileURLToPath(new URL('../migrations-platform/', import.meta.url))
const statements = (file: string) =>
  readFileSync(join(dir, file), 'utf8')
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s && !s.split('\n').every((l) => l.startsWith('--')))
const run = async (pg: PGlite, file = '0046_row_integrity.sql') => {
  for (const sql of statements(file)) await pg.exec(sql)
}

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

describe('platform migration 0046_row_integrity on PGlite', () => {
  let pg: PGlite
  beforeEach(async () => {
    pg = new PGlite()
    await pg.exec(`
      CREATE TABLE member_jurisdiction_preferences (id uuid primary key default gen_random_uuid(), user_id text not null, organization_id uuid not null);
      CREATE TABLE employers (id uuid primary key default gen_random_uuid(), organization_id uuid not null, parent_company_id uuid references employers(id));
      CREATE TABLE external_document_access_grants (id uuid primary key default gen_random_uuid(), document_id uuid not null);
    `)
  })
  afterEach(async () => {
    await pg.close()
  })

  it('makes a second preference row for one member and organization impossible', async () => {
    await run(pg)
    await pg.query(`INSERT INTO member_jurisdiction_preferences (user_id, organization_id) VALUES ('u1', $1)`, [A])
    await pg.query(`INSERT INTO member_jurisdiction_preferences (user_id, organization_id) VALUES ('u1', $1)`, [B])
    await expect(pg.query(`INSERT INTO member_jurisdiction_preferences (user_id, organization_id) VALUES ('u1', $1)`, [A])).rejects.toThrow(/duplicate key/)
  })

  it('fails closed, rewriting nothing, when duplicate preference rows already exist', async () => {
    await pg.query(`INSERT INTO member_jurisdiction_preferences (user_id, organization_id) VALUES ('u1', $1), ('u1', $1)`, [A])
    await expect(run(pg)).rejects.toThrow(/more than one jurisdiction preference row/)
    expect((await pg.query('SELECT count(*)::int AS n FROM member_jurisdiction_preferences')).rows[0]).toMatchObject({ n: 2 })
  })

  it('refuses an employer parent from another organization and a self-parent, and accepts the same organization', async () => {
    await run(pg)
    const parentA = (await pg.query<{ id: string }>(`INSERT INTO employers (organization_id) VALUES ($1) RETURNING id`, [A])).rows[0].id
    const parentB = (await pg.query<{ id: string }>(`INSERT INTO employers (organization_id) VALUES ($1) RETURNING id`, [B])).rows[0].id
    await pg.query(`INSERT INTO employers (organization_id, parent_company_id) VALUES ($1, $2)`, [A, parentA])
    await expect(pg.query(`INSERT INTO employers (organization_id, parent_company_id) VALUES ($1, $2)`, [A, parentB])).rejects.toThrow(/same organization/)
    const child = (await pg.query<{ id: string }>(`INSERT INTO employers (organization_id) VALUES ($1) RETURNING id`, [A])).rows[0].id
    await expect(pg.query(`UPDATE employers SET parent_company_id = $2 WHERE id = $1`, [child, parentB])).rejects.toThrow(/same organization/)
    await expect(pg.query(`UPDATE employers SET parent_company_id = id WHERE id = $1`, [child])).rejects.toThrow(/own parent/)
    await pg.query(`UPDATE employers SET parent_company_id = $2 WHERE id = $1`, [child, parentA])
  })

  it('fails closed when a cross-organization parent already exists', async () => {
    const p = (await pg.query<{ id: string }>(`INSERT INTO employers (organization_id) VALUES ($1) RETURNING id`, [B])).rows[0].id
    await pg.query(`INSERT INTO employers (organization_id, parent_company_id) VALUES ($1, $2)`, [A, p])
    await expect(run(pg)).rejects.toThrow(/parent of another organization/)
  })

  it('adds a nullable, positive version pin to external document grants and keeps existing grants unpinned', async () => {
    await pg.query(`INSERT INTO external_document_access_grants (document_id) VALUES (gen_random_uuid())`)
    await run(pg)
    await run(pg)
    const existing = (await pg.query<{ document_version_no: number | null }>('SELECT document_version_no FROM external_document_access_grants')).rows
    expect(existing).toEqual([{ document_version_no: null }])
    await pg.query(`INSERT INTO external_document_access_grants (document_id, document_version_no) VALUES (gen_random_uuid(), 2)`)
    await expect(pg.query(`INSERT INTO external_document_access_grants (document_id, document_version_no) VALUES (gen_random_uuid(), 0)`)).rejects.toThrow(/positive/)
  })

  it('skips relations that do not exist and is idempotent', async () => {
    const empty = new PGlite()
    await run(empty)
    await empty.close()
    await run(pg)
    await run(pg)
  })

  it('rolls back what it added', async () => {
    await run(pg)
    for (const sql of statements('0046_row_integrity.rollback.sql')) await pg.exec(sql)
    await pg.query(`INSERT INTO member_jurisdiction_preferences (user_id, organization_id) VALUES ('u1', $1), ('u1', $1)`, [A])
    const columns = (await pg.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'external_document_access_grants' AND column_name = 'document_version_no'`)).rows
    expect(columns).toHaveLength(0)
  })
})
