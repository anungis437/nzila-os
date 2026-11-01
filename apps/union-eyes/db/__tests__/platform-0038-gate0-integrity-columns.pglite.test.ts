import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(fileURLToPath(new URL('../../', import.meta.url)), 'db/migrations-platform')
const statements = (file: string) =>
  readFileSync(join(dir, file), 'utf8')
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean)

async function run(pg: PGlite, file: string) {
  for (const sql of statements(file)) await pg.exec(sql)
}

const STUBS = `
  CREATE TABLE kpi_configurations (id uuid primary key default gen_random_uuid(), organization_id uuid not null);
  CREATE TABLE employer_contacts (id uuid primary key default gen_random_uuid(), organization_id uuid not null, employer_id uuid not null, is_primary boolean default false, is_active boolean default true);
  CREATE TABLE committee_meetings (id uuid primary key default gen_random_uuid(), minutes_approved_by text);
  CREATE TABLE cms_pages (id uuid primary key default gen_random_uuid());
  CREATE TABLE exit_interviews (id uuid primary key default gen_random_uuid(), reviewed_by text);
  CREATE TABLE sso_providers (id uuid primary key default gen_random_uuid(), organization_id uuid not null);
`
const ORG = '11111111-1111-4111-8111-111111111111'
const EMP = '22222222-2222-4222-8222-222222222222'

describe('platform migration 0038_gate0_integrity_columns on PGlite', () => {
  let pg: PGlite
  beforeEach(async () => {
    pg = new PGlite()
    await pg.exec(STUBS)
  })
  afterEach(async () => {
    await pg.close()
  })

  it('adds the columns without inventing a value for existing rows, and is idempotent', async () => {
    await pg.exec(`INSERT INTO kpi_configurations (organization_id) VALUES ('${ORG}')`)
    await run(pg, '0038_gate0_integrity_columns.sql')
    await run(pg, '0038_gate0_integrity_columns.sql')
    const kpi = await pg.query<{ direction: string | null }>('SELECT direction FROM kpi_configurations')
    expect(kpi.rows[0].direction).toBeNull()
    const cols = await pg.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns WHERE column_name IN ('direction','minutes_recorded_by','submitted_by') ORDER BY 1,2`,
    )
    expect(cols.rows.map((r) => `${r.table_name}.${r.column_name}`)).toEqual([
      'cms_pages.submitted_by',
      'committee_meetings.minutes_recorded_by',
      'exit_interviews.submitted_by',
      'kpi_configurations.direction',
    ])
  })

  it('accepts only the two KPI directions', async () => {
    await run(pg, '0038_gate0_integrity_columns.sql')
    await pg.exec(`INSERT INTO kpi_configurations (organization_id, direction) VALUES ('${ORG}', 'lower_is_better')`)
    await expect(pg.exec(`INSERT INTO kpi_configurations (organization_id, direction) VALUES ('${ORG}', 'sideways')`)).rejects.toThrow(/kpi_configurations_direction_chk/)
  })

  it('allows only one active primary contact per employer, but any number of others', async () => {
    await run(pg, '0038_gate0_integrity_columns.sql')
    await pg.exec(`INSERT INTO employer_contacts (organization_id, employer_id, is_primary) VALUES ('${ORG}', '${EMP}', true)`)
    await expect(pg.exec(`INSERT INTO employer_contacts (organization_id, employer_id, is_primary) VALUES ('${ORG}', '${EMP}', true)`)).rejects.toThrow(/employer_contacts_one_primary_per_employer_idx/)
    await pg.exec(`INSERT INTO employer_contacts (organization_id, employer_id, is_primary) VALUES ('${ORG}', '${EMP}', false), ('${ORG}', '${EMP}', false)`)
    await pg.exec(`INSERT INTO employer_contacts (organization_id, employer_id, is_primary, is_active) VALUES ('${ORG}', '${EMP}', true, false)`)
    await pg.exec(`INSERT INTO employer_contacts (organization_id, employer_id, is_primary) VALUES ('${ORG}', '33333333-3333-4333-8333-333333333333', true)`)
  })

  it('refuses to apply over an employer that already has two primary contacts', async () => {
    await pg.exec(`INSERT INTO employer_contacts (organization_id, employer_id, is_primary) VALUES ('${ORG}', '${EMP}', true), ('${ORG}', '${EMP}', true)`)
    await expect(run(pg, '0038_gate0_integrity_columns.sql')).rejects.toThrow(/more than one active primary contact/)
  })

  it('refuses approval and review by the person who recorded or submitted', async () => {
    await run(pg, '0038_gate0_integrity_columns.sql')
    await pg.exec(`INSERT INTO committee_meetings (minutes_recorded_by, minutes_approved_by) VALUES ('a', 'b')`)
    await expect(pg.exec(`INSERT INTO committee_meetings (minutes_recorded_by, minutes_approved_by) VALUES ('a', 'a')`)).rejects.toThrow(/committee_meetings_minutes_independent_chk/)
    await pg.exec(`INSERT INTO exit_interviews (submitted_by, reviewed_by) VALUES ('a', 'b')`)
    await expect(pg.exec(`INSERT INTO exit_interviews (submitted_by, reviewed_by) VALUES ('a', 'a')`)).rejects.toThrow(/exit_interviews_review_independent_chk/)
  })

  it('evolves a Django-owned SSO stub without fabricating provider identifiers', async () => {
    await pg.exec(`INSERT INTO sso_providers (organization_id) VALUES ('${ORG}')`)
    await run(pg, '0038_gate0_integrity_columns.sql')
    await run(pg, '0038_gate0_integrity_columns.sql')
    const rows = await pg.query<{ saml_entity_id: string | null; oidc_issuer: string | null; oidc_client_id: string | null }>(
      'SELECT saml_entity_id, oidc_issuer, oidc_client_id FROM sso_providers',
    )
    expect(rows.rows).toEqual([{ saml_entity_id: null, oidc_issuer: null, oidc_client_id: null }])
  })

  it('allows one SSO provider per organization and entity id, and per organization, issuer and client', async () => {
    await run(pg, '0038_gate0_integrity_columns.sql')
    await pg.exec(`INSERT INTO sso_providers (organization_id, saml_entity_id) VALUES ('${ORG}', 'urn:a')`)
    await expect(pg.exec(`INSERT INTO sso_providers (organization_id, saml_entity_id) VALUES ('${ORG}', 'urn:a')`)).rejects.toThrow(/sso_providers_org_saml_entity_idx/)
    await pg.exec(`INSERT INTO sso_providers (organization_id, oidc_issuer, oidc_client_id) VALUES ('${ORG}', 'https://i', 'c1')`)
    await expect(pg.exec(`INSERT INTO sso_providers (organization_id, oidc_issuer, oidc_client_id) VALUES ('${ORG}', 'https://i', 'c1')`)).rejects.toThrow(/sso_providers_org_oidc_issuer_client_idx/)
    await pg.exec(`INSERT INTO sso_providers (organization_id, oidc_issuer, oidc_client_id) VALUES ('${ORG}', 'https://i', 'c2')`)
  })

  it('evolves only the relations present and fails closed when a Drizzle-lineage relation is missing', async () => {
    await pg.exec('DROP TABLE exit_interviews; DROP TABLE sso_providers;')
    await run(pg, '0038_gate0_integrity_columns.sql')
    await pg.exec('DROP TABLE cms_pages;')
    await expect(run(pg, '0038_gate0_integrity_columns.sql')).rejects.toThrow(/fail-closed/)
  })

  it('rolls back to the earlier shape', async () => {
    await run(pg, '0038_gate0_integrity_columns.sql')
    await run(pg, '0038_gate0_integrity_columns.rollback.sql')
    const cols = await pg.query(`SELECT 1 FROM information_schema.columns WHERE column_name IN ('direction','minutes_recorded_by','submitted_by')`)
    expect(cols.rows).toHaveLength(0)
    await pg.exec(`INSERT INTO employer_contacts (organization_id, employer_id, is_primary) VALUES ('${ORG}', '${EMP}', true), ('${ORG}', '${EMP}', true)`)
  })
})
