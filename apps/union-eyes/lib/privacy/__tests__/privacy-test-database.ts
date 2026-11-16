// Local PostgreSQL regression fixture. Session verification and combined native schema are qualified separately.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { vi } from 'vitest'
import { sql } from 'drizzle-orm'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import type { RLSTx } from '@/lib/db/with-rls-context'
import type { PrivacyIdentity } from '../request-contract'

const migration = (name: string) => readFileSync(join(__dirname, '../../../db/migrations-platform', name), 'utf8')
let pg: PGlite
let db: ReturnType<typeof drizzle>
export async function privacyTestDatabase() {
  vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
  pg = new PGlite()
  await pg.exec(`
    CREATE TYPE message_status AS ENUM ('sent','delivered','read');
    CREATE TYPE message_type AS ENUM ('text','file','system');
    CREATE TABLE message_threads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subject text NOT NULL, member_id text NOT NULL, staff_id text,
      organization_id uuid NOT NULL, status text NOT NULL DEFAULT 'open', priority text DEFAULT 'normal', category text,
      is_archived boolean DEFAULT false, last_message_at timestamp, created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
      sender_id text NOT NULL, sender_role text NOT NULL, message_type message_type NOT NULL DEFAULT 'text', content text,
      file_url text, file_name text, file_size text, status message_status NOT NULL DEFAULT 'sent', read_at timestamp,
      is_edited boolean DEFAULT false, edited_at timestamp, metadata text, created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now());
    CREATE TABLE in_app_notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz,
      user_id text NOT NULL, organization_id uuid, title text, message text, type text NOT NULL DEFAULT 'info',
      action_label text, action_url text, data jsonb, read boolean NOT NULL DEFAULT false, read_at timestamp, expires_at timestamp);
    CREATE TABLE organization_members (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, user_id text NOT NULL, role text NOT NULL,
      status text NOT NULL DEFAULT 'active', deleted_at timestamptz);
    CREATE SCHEMA audit_security;
    CREATE TABLE audit_security.audit_logs(
      audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid, user_id varchar(255),
      action varchar(100) NOT NULL, resource_type varchar(50) NOT NULL, resource_id uuid, old_values jsonb, new_values jsonb,
      ip_address varchar(45), user_agent text, session_id uuid, correlation_id uuid, severity varchar(20) DEFAULT 'info',
      outcome varchar(20) DEFAULT 'success', error_message text, metadata jsonb DEFAULT '{}'::jsonb,
      archived boolean NOT NULL DEFAULT false, archived_at timestamptz, archived_path text, created_at timestamptz DEFAULT now());
  `)
  for (const file of ['0014_message_thread_triage.sql', '0025_message_thread_lifecycle_and_retention.sql']) {
    for (const statement of migration(file).split('--> statement-breakpoint')) {
      if (statement.replace(/--.*$/gm, '').trim()) await pg.exec(statement)
    }
  }
  // The privileges the storage-authority manifest grants, and nothing more.
  await pg.exec(`
    CREATE ROLE rt NOLOGIN;
    GRANT USAGE ON SCHEMA audit_security TO rt;
    GRANT SELECT, INSERT, UPDATE ON message_threads TO rt;
    GRANT SELECT, INSERT ON messages, in_app_notifications, message_thread_assignments, message_thread_lifecycle TO rt;
    GRANT SELECT, INSERT, UPDATE ON triage_designations, message_retention_policies, message_thread_reads TO rt;
    GRANT SELECT ON organization_members TO rt;
    GRANT SELECT, INSERT ON audit_security.audit_logs TO rt;
    SET ROLE rt;
  `)
  db = drizzle(pg)
  await pg.exec('RESET ROLE')
  const plan = JSON.parse(readFileSync(join(__dirname, '../../../../../docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8')) as {statements:Array<{sql:string}>}
  for (const name of ['gdpr_data_requests','user_consents']) {
    const statement = plan.statements.find(row => row.sql.startsWith('CREATE TABLE \"'+name+'\" '))
    if (!statement) throw new Error('Missing canonical privacy table')
    await pg.exec(statement.sql)
    await pg.exec(`GRANT SELECT, INSERT, UPDATE ON ${name} TO rt`)
  }
  await pg.exec(`ALTER TABLE gdpr_data_requests ENABLE ROW LEVEL SECURITY; ALTER TABLE gdpr_data_requests FORCE ROW LEVEL SECURITY;
    CREATE POLICY subject_only ON gdpr_data_requests TO rt USING (organization_id=nullif(current_setting('app.current_organization_id',true),'')::uuid AND user_id=nullif(current_setting('app.current_user_id',true),'')) WITH CHECK (organization_id=nullif(current_setting('app.current_organization_id',true),'')::uuid AND user_id=nullif(current_setting('app.current_user_id',true),''));
    SET ROLE rt;`)
  const as = <T>(actor:PrivacyIdentity, work:(tx:RLSTx)=>Promise<T>) => db.transaction(async tx => {
    await tx.execute(sql`SELECT set_config('app.current_organization_id',${actor.organizationId},true), set_config('app.current_user_id',${actor.userId},true)`)
    return work(tx as unknown as RLSTx)
  })
  const owner = async <T>(work:()=>Promise<T>) => { await pg.exec('RESET ROLE');try{return await work()}finally{await pg.exec('SET ROLE rt')} }
  return {pg,db,as,owner,close:()=>pg.close()}
}
