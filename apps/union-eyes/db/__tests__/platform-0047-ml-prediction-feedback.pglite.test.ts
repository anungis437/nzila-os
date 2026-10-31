import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('../migrations-platform/', import.meta.url))
const statements = (file: string) =>
  readFileSync(join(dir, file), 'utf8')
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s && !s.split('\n').every((l) => l.startsWith('--')))
const run = async (pg: PGlite, file = '0047_ml_prediction_feedback.sql') => {
  for (const sql of statements(file)) await pg.exec(sql)
}

const A = '11111111-1111-4111-8111-111111111111'
const P = '22222222-2222-4222-8222-222222222222'

describe('platform migration 0047_ml_prediction_feedback on PGlite', () => {
  let pg: PGlite
  beforeEach(async () => {
    pg = new PGlite()
    await pg.exec(`CREATE TABLE organizations (id uuid primary key); CREATE TABLE ml_predictions (id uuid primary key, organization_id uuid not null);`)
    await pg.query(`INSERT INTO organizations VALUES ($1)`, [A])
    await pg.query(`INSERT INTO ml_predictions VALUES ($1, $2)`, [P, A])
  })
  afterEach(async () => {
    await pg.close()
  })

  const feedback = (over: Record<string, unknown> = {}) =>
    pg.query(
      `INSERT INTO ml_prediction_feedback (organization_id, prediction_id, predicted_value, actual_breach, abs_error, resolution_hours) VALUES ($1, $2, 0.8, true, $3, $4)`,
      [A, P, over.absError ?? 0.2, over.resolutionHours ?? null],
    )

  it('allows one outcome per prediction and refuses a second', async () => {
    await run(pg)
    await feedback()
    await expect(feedback()).rejects.toThrow(/duplicate key/)
  })

  it('refuses an error outside 0 to 1 and negative resolution hours', async () => {
    await run(pg)
    await expect(feedback({ absError: 1.5 })).rejects.toThrow(/abs_error_check/)
    await expect(feedback({ resolutionHours: -1 })).rejects.toThrow(/resolution_check/)
  })

  it('cascades with the prediction and organization and is idempotent', async () => {
    await run(pg)
    await run(pg)
    await feedback()
    await pg.query(`DELETE FROM ml_predictions WHERE id = $1`, [P])
    expect((await pg.query('SELECT count(*)::int AS n FROM ml_prediction_feedback')).rows[0]).toMatchObject({ n: 0 })
  })

  it('fails closed when a parent table is missing', async () => {
    const empty = new PGlite()
    await expect(run(empty)).rejects.toThrow(/fail-closed/)
    await empty.close()
  })

  it('rolls back', async () => {
    await run(pg)
    for (const sql of statements('0047_ml_prediction_feedback.rollback.sql')) await pg.exec(sql)
    expect((await pg.query(`SELECT to_regclass('public.ml_prediction_feedback') AS r`)).rows[0]).toMatchObject({ r: null })
  })
})
