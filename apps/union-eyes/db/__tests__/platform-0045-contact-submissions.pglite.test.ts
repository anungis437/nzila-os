import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const statements = readFileSync(join(process.cwd(), 'db/migrations-platform/0045_contact_submissions.sql'), 'utf8')
  .split('--> statement-breakpoint')
  .map((s) => s.trim())
  .filter((s) => s && !s.split('\n').every((l) => l.startsWith('--')))
const run = async (pg: PGlite) => {
  for (const sql of statements) await pg.exec(sql)
}

describe('platform migration 0045_contact_submissions on PGlite', () => {
  let pg: PGlite
  beforeEach(async () => {
    pg = new PGlite()
    await run(pg)
  })
  afterEach(async () => {
    await pg.close()
  })

  it('is idempotent and stores a submission with defaults: pending, received now, two-year retention', async () => {
    await run(pg)
    await pg.exec(`INSERT INTO contact_submissions (first_name, email) VALUES ('Sam', 'sam@example.test')`)
    const row = await pg.query<{ crm_status: string; years: string }>(
      `SELECT crm_status, round(extract(epoch FROM (retain_until - received_at)) / 86400 / 365)::text AS years FROM contact_submissions`,
    )
    expect(row.rows[0]).toEqual({ crm_status: 'pending', years: '2' })
  })

  it('refuses an unknown CRM status and an over-long field', async () => {
    await expect(pg.exec(`INSERT INTO contact_submissions (first_name, email, crm_status) VALUES ('S', 'a@b.c', 'sent')`)).rejects.toThrow(/check/i)
    await expect(pg.query(`INSERT INTO contact_submissions (first_name, email, message) VALUES ('S', 'a@b.c', $1)`, ['x'.repeat(2001)])).rejects.toThrow(/too long/i)
  })

  it('lists what has not reached the CRM through the partial index', async () => {
    await pg.exec(`INSERT INTO contact_submissions (first_name, email, crm_status) VALUES ('A','a@x.y','recorded'),('B','b@x.y','failed'),('C','c@x.y','pending')`)
    const unsynced = await pg.query<{ first_name: string }>(`SELECT first_name FROM contact_submissions WHERE crm_status <> 'recorded' ORDER BY first_name`)
    expect(unsynced.rows.map((r) => r.first_name)).toEqual(['B', 'C'])
  })
})
