/**
 * Test-only: a PGlite database with the real document tables (generated from the Drizzle declarations), the audit
 * schema, and the actual platform migration 0022 applied statement by statement. An audit fault switch lets a test
 * make a named audit action fail, which is how mandatory-audit rollback is proven against real transactions.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { documents, documentVersions, documentLinks, documentAccessGrants } from '@/db/schema/documents-schema';

export function ddl(table: Parameters<typeof getTableConfig>[0]): string {
  const config = getTableConfig(table);
  const columns = config.columns.map((column) => {
    const type = column.enumValues ? 'text' : column.getSQLType();
    let part = `"${column.name}" ${type}`;
    if (column.primary) part += type === 'uuid' ? ' PRIMARY KEY DEFAULT gen_random_uuid()' : ' PRIMARY KEY';
    else if (column.notNull && !column.hasDefault) part += ' NOT NULL';
    else if (column.hasDefault && type.startsWith('timestamp')) part += ' DEFAULT now()';
    return part;
  });
  return `CREATE TABLE "${config.name}" (${columns.join(', ')})`;
}

export async function createDocumentDatabase(): Promise<PGlite> {
  const pg = new PGlite();
  await pg.exec(`
    CREATE SCHEMA audit_security;
    CREATE TABLE audit_security.audit_logs (
      audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, user_id varchar(255),
      action varchar(100) NOT NULL CHECK (action != ''), resource_type varchar(50) NOT NULL, resource_id uuid,
      old_values jsonb, new_values jsonb, ip_address varchar(45), user_agent text, session_id uuid, correlation_id uuid,
      severity varchar(20) DEFAULT 'info', outcome varchar(20) DEFAULT 'success', error_message text,
      metadata jsonb DEFAULT '{}'::jsonb, archived boolean NOT NULL DEFAULT false, archived_at timestamptz, archived_path text,
      created_at timestamptz DEFAULT now()
    );
    CREATE TABLE audit_fault_actions (action text PRIMARY KEY);
    CREATE FUNCTION audit_security.refuse_faulted() RETURNS trigger AS $$
    BEGIN
      IF EXISTS (SELECT 1 FROM audit_fault_actions WHERE action = NEW.action) THEN RAISE EXCEPTION 'injected audit fault'; END IF;
      RETURN NEW;
    END $$ LANGUAGE plpgsql;
    CREATE TRIGGER inject_fault BEFORE INSERT ON audit_security.audit_logs FOR EACH ROW EXECUTE FUNCTION audit_security.refuse_faulted();
  `);
  for (const table of [documents, documentVersions, documentLinks, documentAccessGrants]) await pg.exec(ddl(table));
  await pg.exec('CREATE UNIQUE INDEX idx_document_versions_unique ON document_versions (document_id, version_no)');
  const migration = readFileSync(join(__dirname, '..', '..', '..', 'db', 'migrations-platform', '0022_document_intake_and_transcription.sql'), 'utf8');
  for (const statement of migration.split('--> statement-breakpoint')) if (statement.trim()) await pg.exec(statement);
  return pg;
}

/** Clears every table between tests. The intake guard refuses deletes by design, so it is switched off only here. */
export async function resetDocumentDatabase(pg: PGlite): Promise<void> {
  await pg.query('DELETE FROM audit_fault_actions');
  await pg.exec('TRUNCATE document_transcript_publications, document_transcript_revisions, document_links, document_access_grants, document_versions, documents, audit_security.audit_logs');
  await pg.exec('ALTER TABLE document_intakes DISABLE TRIGGER document_intakes_guard');
  await pg.exec('DELETE FROM document_intakes');
  await pg.exec('ALTER TABLE document_intakes ENABLE TRIGGER document_intakes_guard');
}
