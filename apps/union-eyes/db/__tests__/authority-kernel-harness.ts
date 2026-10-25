/**
 * Shared harness for the authority-kernel database tests (PGlite and real PostgreSQL).
 *
 * The fixture tables MIRROR relations this branch does not own. Each mirrors the
 * contract cited beside it; nothing here is a claim about a deployed database:
 *   user_management.users / organization_users   packages/db/src/auth-storage-authority/bootstrap-sql.ts,
 *                                                db/schema/user-management-schema.ts (user_id is varchar(255))
 *   public.platform_identity_bindings            packages/db/src/schema/platform-authorization.ts
 *   public.audit_logs                            backend/core/models.py AuditLogs (Django), 0011 direct-org RLS
 *   public.grievances                            db/schema/domains/claims/grievances.ts
 *   public.claims                                db/schema/claims-schema.ts (claim_id is the kernel case id)
 *   public.grievance_case_access_assignments     db/migrations-platform/0009_canonical_lineage_relations.sql
 *   public.documents / document_links            db/schema/documents-schema.ts
 *   public.payments                              db/schema/domains/finance/payments.ts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { authorityKernelEntries } from '../rls-storage-authority/authority-kernel'

export interface Db {
  exec(sql: string): Promise<unknown>
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
}

const APP_ROOT = resolve(__dirname, '..', '..')
export const read = (p: string) => readFileSync(resolve(APP_ROOT, p), 'utf8')
export const PLATFORM_SQL = read('db/migrations-platform/0013_authority_kernel_storage.sql')
export const RLS_SQL = read('db/migrations-cache/0020_authority_kernel_rls_closure.sql')
export const HELPER = read('db/migrations-cache/0010_tenant_isolation_rls_foundation.sql')
  .match(/CREATE OR REPLACE FUNCTION ue_create_direct_org_rls_policy\([\s\S]*?\$\$ LANGUAGE plpgsql;/)?.[0] as string
if (!HELPER) throw new Error('ue_create_direct_org_rls_policy not found')

const IDENTITY_FIXTURE_SQL = `
  CREATE SCHEMA IF NOT EXISTS user_management;
  CREATE TABLE user_management.users (
    user_id varchar(255) PRIMARY KEY, email varchar(255), is_active boolean DEFAULT true,
    lifecycle_state text NOT NULL DEFAULT 'active', is_system_admin boolean DEFAULT false);
  CREATE TABLE user_management.organization_users (
    organization_user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL,
    user_id varchar(255) NOT NULL, role varchar(50) NOT NULL DEFAULT 'member', is_active boolean DEFAULT true,
    CONSTRAINT ou_user_org_uq UNIQUE (user_id, organization_id));
  CREATE TABLE public.platform_identity_bindings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider varchar(80) NOT NULL, provider_subject varchar(512) NOT NULL,
    platform_user_id varchar(255) NOT NULL, state varchar(16) NOT NULL DEFAULT 'active', verified_at timestamptz NOT NULL DEFAULT now(),
    disabled_at timestamptz, revoked_at timestamptz, CONSTRAINT pib_uq UNIQUE (provider, provider_subject));
`

const BUSINESS_FIXTURE_SQL = `
  CREATE TABLE public.grievances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, created_by text,
    created_at timestamptz NOT NULL DEFAULT now(), is_confidential boolean DEFAULT false, has_legal_implications boolean DEFAULT false,
    union_rep_id uuid);
  CREATE TABLE public.claims (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), claim_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(), claim_number varchar(50),
    organization_id uuid NOT NULL, member_id varchar(255), assigned_to varchar(255), status text NOT NULL DEFAULT 'submitted',
    priority text NOT NULL DEFAULT 'medium', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    is_anonymous boolean DEFAULT false, claim_type text, incident_date timestamptz, location text, description text, desired_outcome text,
    attachments jsonb DEFAULT '[]', witnesses_present boolean DEFAULT false, witness_details text, filed_date timestamptz, assigned_at timestamptz,
    ai_score integer, ai_analysis jsonb, merit_confidence integer, precedent_match integer, complexity_score integer,
    claim_amount numeric DEFAULT 0, settlement_amount numeric DEFAULT 0, legal_costs numeric DEFAULT 0, court_costs numeric DEFAULT 0,
    resolution_outcome text, resolved_at timestamptz, progress integer DEFAULT 0);
  CREATE TYPE case_access_role AS ENUM ('secondary_lro','reviewer','read_only');
  CREATE TYPE case_access_status AS ENUM ('active','revoked','expired');
  CREATE TABLE public.grievance_case_access_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL, organization_id uuid NOT NULL, grievance_id uuid NOT NULL,
    user_id text NOT NULL, access_role case_access_role NOT NULL DEFAULT 'secondary_lro', granted_by text NOT NULL,
    granted_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz, can_comment boolean NOT NULL DEFAULT true,
    can_upload_documents boolean NOT NULL DEFAULT false, can_edit_case_notes boolean NOT NULL DEFAULT false,
    can_draft_actions boolean NOT NULL DEFAULT false, can_view_private_documents boolean NOT NULL DEFAULT false,
    status case_access_status NOT NULL DEFAULT 'active', updated_at timestamptz NOT NULL DEFAULT now());
  CREATE TABLE public.documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, uploaded_by text NOT NULL,
    privacy_label text NOT NULL DEFAULT 'team_confidential', contains_legal_privilege boolean DEFAULT false,
    contains_medical_sensitive boolean DEFAULT false, medical_sensitive boolean DEFAULT false,
    disciplinary_sensitive boolean DEFAULT false, member_pii boolean DEFAULT false);
  CREATE TABLE public.document_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL, linked_entity_type text NOT NULL, linked_entity_id uuid NOT NULL);
  CREATE TABLE public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, member_id varchar(255),
    amount numeric(19,2) NOT NULL, currency varchar(3) NOT NULL DEFAULT 'CAD');
`

/** Mirror of the Django-created audit_logs. Skipped when the real table already exists (see the Django audit suite). */
const AUDIT_FIXTURE_SQL = `
  CREATE TABLE public.audit_logs (
    id uuid PRIMARY KEY, audit_id uuid UNIQUE NOT NULL, created_at timestamptz NOT NULL, updated_at timestamptz NOT NULL,
    organization_id uuid, action varchar(100), resource_type varchar(255), resource_id varchar(255), user_id varchar(255),
    ip_address inet, user_agent text, correlation_id uuid, details jsonb DEFAULT '{}'::jsonb, changes jsonb DEFAULT '{}'::jsonb,
    content_hash varchar(64), previous_hash varchar(64));
  CREATE INDEX idx_ue_audit_logs_org_created ON public.audit_logs (organization_id, created_at);
`

const IDENTITY_GRANTS = `
  GRANT USAGE ON SCHEMA user_management TO union_eyes_runtime;
  GRANT SELECT ON user_management.users, user_management.organization_users, public.platform_identity_bindings TO union_eyes_runtime;
`

const GRANTS = `
  GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO union_eyes_runtime;
  GRANT SELECT ON public.claims TO union_eyes_runtime;
  GRANT SELECT ON public.grievances, public.grievance_case_access_assignments, public.documents, public.document_links, public.payments TO union_eyes_runtime;
`

export async function installAuthoritySchema(db: Db, options: { realAuditLogs?: boolean; canonicalIdentity?: boolean } = {}): Promise<void> {
  await db.exec(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_runtime') THEN
        CREATE ROLE union_eyes_runtime NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT NOLOGIN; END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_system') THEN
        CREATE ROLE union_eyes_system NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS INHERIT NOLOGIN; END IF;
    END $$;`)
  await db.exec(HELPER)
  // With canonicalIdentity the identity relations, roles and grants come from the real auth bootstrap instead.
  if (!options.canonicalIdentity) await db.exec(IDENTITY_FIXTURE_SQL)
  await db.exec(BUSINESS_FIXTURE_SQL)
  if (!options.realAuditLogs) await db.exec(AUDIT_FIXTURE_SQL)
  await db.exec(PLATFORM_SQL)
  await db.exec(RLS_SQL)
  for (const t of ['audit_logs', 'grievances', 'claims', 'grievance_case_access_assignments', 'documents', 'payments']) {
    await db.exec(`SELECT ue_create_direct_org_rls_policy('${t}')`)
  }
  if (!options.canonicalIdentity) await db.exec(IDENTITY_GRANTS)
  await db.exec(GRANTS)
  for (const e of authorityKernelEntries) {
    await db.exec(`GRANT ${e.requiredRuntimePrivileges.join(', ')} ON ${e.table} TO union_eyes_runtime`)
  }
}

// ── Test data ────────────────────────────────────────────────────────────────

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
export const ORG = uuid(0xa)
export const ORG_B = uuid(0xb)
export const newUuid = (() => { let n = 100000; return () => uuid(n++) })()

/** Internal principal ids are NOT uuids (legacy `user_xxx` ids exist); the fixtures reflect that. */
export const U = {
  president: 'user_president', vp: 'user_vice_president', treasurer: 'user_secretary_treasurer', officer: 'user_officer',
  steward: 'user_steward_a', steward2: 'user_steward_b', chief: 'user_chief_steward', member: 'user_member_1', member2: 'user_member_2',
  auditor: 'entra-oid-auditor-0001', reviewer: 'entra-oid-reviewer-0002', counsel: 'counsel-0001', clerk: 'user_clerk_1', stranger: 'user_stranger',
}

export const ROLE: Record<string, string> = {
  [U.president]: 'president', [U.vp]: 'vice_president', [U.treasurer]: 'secretary_treasurer', [U.officer]: 'officer',
  [U.steward]: 'steward', [U.steward2]: 'steward', [U.chief]: 'chief_steward', [U.member]: 'member', [U.member2]: 'member',
  [U.auditor]: 'member', [U.reviewer]: 'member', [U.clerk]: 'member',
}

export async function seedUser(db: Db, userId: string, over: { lifecycle?: string; active?: boolean; admin?: boolean } = {}): Promise<void> {
  await db.query(
    `INSERT INTO user_management.users (user_id, email, is_active, lifecycle_state, is_system_admin) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id) DO NOTHING`,
    [userId, `${userId}@example.test`, over.active ?? true, over.lifecycle ?? 'active', over.admin ?? false],
  )
}

export async function seedMembership(db: Db, userId: string, org: string, role: string, active = true): Promise<void> {
  await seedUser(db, userId)
  await db.query(
    `INSERT INTO user_management.organization_users (organization_id, user_id, role, is_active) VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role, is_active = EXCLUDED.is_active`,
    [org, userId, role, active],
  )
}

export async function seedBinding(
  db: Db,
  provider: string,
  subject: string,
  userId: string,
  over: { state?: string; verified?: boolean; disabled?: boolean; revoked?: boolean } = {},
): Promise<void> {
  await db.query(
    `INSERT INTO public.platform_identity_bindings (provider, provider_subject, platform_user_id, state, verified_at, disabled_at, revoked_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [provider, subject, userId, over.state ?? 'active', over.verified === false ? '1970-01-01' : new Date(), over.disabled ? new Date() : null, over.revoked ? new Date() : null],
  )
}

/** Seeds the standard cast in ORG with canonical roles. */
export async function seedCast(db: Db, org = ORG): Promise<void> {
  for (const [user, role] of Object.entries(ROLE)) await seedMembership(db, user, org, role)
}
