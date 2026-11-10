import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const migrationsDir = join(__dirname, '..')
const migration = readFileSync(join(migrationsDir, '0084_ml_predictions_relax_legacy_not_null.sql'), 'utf8')
const rollback = readFileSync(join(migrationsDir, '0084_ml_predictions_relax_legacy_not_null.rollback.sql'), 'utf8')

let db: PGlite

afterEach(async () => {
  await db.close()
})

describe('migration 0084: ml_predictions relax legacy NOT NULL columns (DEF-0B9-ML-DECLARED-PREDICTION-SHAPE-CONFLICTS-WITH-THE-SQL-THAT-CREATES-THE-TABLE)', () => {
  describe('table created from the legacy shape (model_name/model_version/target_date NOT NULL, as the three historical migrations create it)', () => {
    beforeEach(async () => {
      db = new PGlite()
      await db.exec(`
        CREATE TABLE public.ml_predictions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id uuid NOT NULL,
          prediction_type text NOT NULL,
          model_name text NOT NULL,
          model_version text NOT NULL,
          target_date timestamp NOT NULL,
          predicted_value numeric NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `)
    })

    it('refuses an insert that omits the legacy columns before the migration runs (reproduces the defect)', async () => {
      await expect(
        db.query(
          `INSERT INTO ml_predictions (organization_id, prediction_type, predicted_value) VALUES (gen_random_uuid(), 'claims_volume', 10)`,
        ),
      ).rejects.toThrow(/null value in column "model_name"/)
    })

    it('accepts the same insert after the migration relaxes the three legacy columns', async () => {
      await db.exec(migration)
      await expect(
        db.query(
          `INSERT INTO ml_predictions (organization_id, prediction_type, predicted_value) VALUES (gen_random_uuid(), 'claims_volume', 10)`,
        ),
      ).resolves.toBeDefined()

      const columns = await db.query<{ column_name: string; is_nullable: string }>(
        `SELECT column_name, is_nullable FROM information_schema.columns
         WHERE table_name = 'ml_predictions' AND column_name IN ('model_name', 'model_version', 'target_date')
         ORDER BY column_name`,
      )
      expect(columns.rows.length).toBe(3)
      for (const row of columns.rows) expect(row.is_nullable).toBe('YES')
    })

    it('rollback restores NOT NULL when every row already has a value, and refuses when any row is null', async () => {
      await db.exec(migration)
      await db.query(
        `INSERT INTO ml_predictions (organization_id, prediction_type, model_name, model_version, target_date, predicted_value)
         VALUES (gen_random_uuid(), 'claims_volume', 'arima', 'v1', now(), 10)`,
      )
      await db.exec(rollback)
      const columns = await db.query<{ column_name: string; is_nullable: string }>(
        `SELECT column_name, is_nullable FROM information_schema.columns
         WHERE table_name = 'ml_predictions' AND column_name IN ('model_name', 'model_version', 'target_date')
         ORDER BY column_name`,
      )
      for (const row of columns.rows) expect(row.is_nullable).toBe('NO')

      // Now insert a row with nulls in the legacy columns (simulating new application writes after the
      // forward migration, before any rollback) and confirm rollback refuses rather than silently
      // restoring NOT NULL over existing null data.
      await db.exec(migration)
      await db.query(
        `INSERT INTO ml_predictions (organization_id, prediction_type, predicted_value) VALUES (gen_random_uuid(), 'claims_volume', 20)`,
      )
      await expect(db.exec(rollback)).rejects.toThrow(/model_name holds a null row/)
    })
  })

  describe('table created from the canonical Drizzle shape (no legacy columns at all)', () => {
    beforeEach(async () => {
      db = new PGlite()
      await db.exec(`
        CREATE TABLE public.ml_predictions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          organization_id uuid NOT NULL,
          prediction_type varchar(50) NOT NULL,
          prediction_date timestamp NOT NULL,
          predicted_value numeric NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `)
    })

    it('is a no-op: the migration and rollback both succeed without error and change no column', async () => {
      await db.exec(migration)
      await db.exec(rollback)
      const columns = await db.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'ml_predictions' ORDER BY column_name`,
      )
      expect(columns.rows.map((row) => row.column_name)).toEqual(
        ['created_at', 'id', 'organization_id', 'prediction_date', 'prediction_type', 'predicted_value'].sort(),
      )
    })
  })
})
