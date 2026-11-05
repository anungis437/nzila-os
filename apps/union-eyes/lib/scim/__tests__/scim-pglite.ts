/**
 * Test-only: a PGlite database that holds the relations platform 0059 builds on (the organization, the SCIM configuration and the four-column Django
 * stub of the event log) and then runs the REAL 0059 migration, unmodified. The SCIM data layer and the SCIM routes run their actual statements,
 * constraints and indexes against it, so a unit test proves the same shapes the native PostgreSQL test proves against the combined schema.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';

const PLATFORM = fileURLToPath(new URL('../../../db/migrations-platform/', import.meta.url));

export interface ScimDatabase {
  pg: PGlite;
  db: PgliteDatabase<Record<string, never>>;
  organization(id: string): Promise<void>;
  configuration(organizationId: string, overrides?: { enabled?: boolean; syncUsers?: boolean; deprovisionAction?: string; revoked?: boolean; expired?: boolean }): Promise<string>;
  reset(): Promise<void>;
}

export async function createScimDatabase(): Promise<ScimDatabase> {
  const pg = new PGlite();
  await pg.exec(`
    CREATE TABLE organizations (id uuid PRIMARY KEY);
    CREATE TABLE scim_configurations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations (id),
      enabled boolean NOT NULL DEFAULT false,
      sync_users boolean NOT NULL DEFAULT true,
      deprovision_action varchar(50) NOT NULL DEFAULT 'suspend',
      token_expires_at timestamptz,
      revoked_at timestamptz
    );
    CREATE TABLE scim_events_log (
      id uuid NOT NULL PRIMARY KEY,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      config_id uuid NOT NULL REFERENCES scim_configurations (id)
    );
  `);
  const migration = readFileSync(join(PLATFORM, '0059_scim_provisioned_users.sql'), 'utf8').replace(/\r\n/g, '\n');
  for (const statement of migration.split('--> statement-breakpoint')) {
    if (statement.replace(/--.*$/gm, '').trim()) await pg.exec(statement);
  }
  return {
    pg,
    db: drizzle(pg),
    async organization(id) {
      await pg.query('INSERT INTO organizations (id) VALUES ($1) ON CONFLICT DO NOTHING', [id]);
    },
    async configuration(organizationId, overrides = {}) {
      await pg.query('INSERT INTO organizations (id) VALUES ($1) ON CONFLICT DO NOTHING', [organizationId]);
      const result = await pg.query<{ id: string }>(
        `INSERT INTO scim_configurations (organization_id, enabled, sync_users, deprovision_action, token_expires_at, revoked_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          organizationId,
          overrides.enabled ?? true,
          overrides.syncUsers ?? true,
          overrides.deprovisionAction ?? 'suspend',
          overrides.expired ? new Date(Date.now() - 60_000).toISOString() : new Date(Date.now() + 30 * 86_400_000).toISOString(),
          overrides.revoked ? new Date().toISOString() : null,
        ],
      );
      return result.rows[0].id;
    },
    async reset() {
      await pg.exec('TRUNCATE scim_events_log, scim_provisioned_users, scim_configurations, organizations CASCADE');
    },
  };
}
