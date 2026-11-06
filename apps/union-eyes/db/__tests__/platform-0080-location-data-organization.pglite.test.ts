import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// DEF-0B6-SYS-LOCATION-DELETION-LOG-FABRICATES-DATES-AND-HAS-NO-ORGANIZATION: platform 0080 on PGlite.
const dir = fileURLToPath(new URL('../migrations-platform/', import.meta.url))
const statements = (file: string) =>
  readFileSync(join(dir, file), 'utf8')
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s && !s.split('\n').every((l) => l.startsWith('--')))
const run = async (pg: PGlite, file: string) => {
  for (const sql of statements(file)) await pg.exec(sql)
}
const FORWARD = '0080_location_data_organization.sql'
const ROLLBACK = '0080_location_data_organization.rollback.sql'
const TABLES = ['geofence_events', 'location_deletion_log', 'location_tracking']

describe('platform migration 0080_location_data_organization on PGlite', () => {
  let pg: PGlite
  const columns = async () =>
    (await pg.query<{ table_name: string; data_type: string; is_nullable: string }>(
      `SELECT table_name, data_type, is_nullable FROM information_schema.columns WHERE column_name = 'organization_id' ORDER BY table_name`,
    )).rows

  beforeEach(async () => {
    pg = new PGlite()
    await pg.exec(`
      CREATE TABLE location_tracking (id uuid primary key default gen_random_uuid(), user_id varchar(255) not null);
      CREATE TABLE geofence_events (id uuid primary key default gen_random_uuid(), user_id varchar(255) not null);
      CREATE TABLE location_deletion_log (id uuid primary key default gen_random_uuid(), deletion_type varchar(50) not null);
      INSERT INTO location_tracking (user_id) VALUES ('legacy');
    `)
  })
  afterEach(async () => {
    await pg.close()
  })

  it('adds a nullable uuid organization_id to the three relations, leaves existing rows NULL, and is idempotent', async () => {
    await run(pg, FORWARD)
    await run(pg, FORWARD)
    expect(await columns()).toEqual(TABLES.map((table_name) => ({ table_name, data_type: 'uuid', is_nullable: 'YES' })))
    expect((await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM location_tracking WHERE organization_id IS NULL`)).rows[0].n).toBe(1)
  })

  it('fails closed when a relation is absent or already holds organization_id of another type', async () => {
    await pg.exec(`DROP TABLE geofence_events`)
    await expect(run(pg, FORWARD)).rejects.toThrow(/geofence_events does not exist/)
    await pg.exec(`CREATE TABLE geofence_events (id uuid primary key, organization_id text)`)
    await expect(run(pg, FORWARD)).rejects.toThrow(/is text, not uuid/)
  })

  it('the rollback refuses while a column holds an organization, and otherwise removes exactly what was added', async () => {
    await pg.exec(`ALTER TABLE location_deletion_log ADD COLUMN organization_id uuid`)
    await run(pg, FORWARD)
    await pg.exec(`INSERT INTO location_tracking (user_id, organization_id) VALUES ('u', '11111111-1111-4111-8111-111111111111')`)
    await expect(run(pg, ROLLBACK)).rejects.toThrow(/holds an organization/)
    expect(await columns()).toHaveLength(3)
    await pg.exec(`DELETE FROM location_tracking WHERE organization_id IS NOT NULL`)
    await run(pg, ROLLBACK)
    // The pre-existing column was not added (or tagged) by the migration, so the rollback keeps it.
    expect((await columns()).map((c) => c.table_name)).toEqual(['location_deletion_log'])
  })
})
