import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const state = vi.hoisted(() => ({
  db: null as unknown,
  member: true,
  steward: false,
  caseAccess: {
    isPrimaryOwner: false,
    canViewCase: false,
    canViewPrivateDocuments: false,
  },
  sas: vi.fn(async () => 'https://storage.example/signed.pdf'),
}));

vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: (handler: (...args: unknown[]) => unknown) => handler,
}));

vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: vi.fn(async () => undefined),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  hasMinRole: async (role: string) => (role === 'member' ? state.member : role === 'steward' ? state.steward : false),
}));

vi.mock('@/db/db', () => ({
  db: new Proxy({}, {
    get(_target, property) {
      const database = state.db as Record<PropertyKey, unknown> | null;
      const value = database ? database[property] : undefined;
      return typeof value === 'function' ? value.bind(database) : value;
    },
  }),
}));

vi.mock('@/lib/services/case-access-service', () => ({
  getEffectiveCaseAccess: async () => state.caseAccess,
}));

vi.mock('@/lib/blob-client', () => ({
  generateSasUrl: (...args: unknown[]) => state.sas(...args),
}));

const { GET } = await import('@/app/api/documents/[id]/download/route');

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const DOC_OPEN = '33333333-3333-4333-8333-333333333333';
const DOC_FOREIGN = '44444444-4444-4444-8444-444444444444';
const DOC_PRIVILEGED = '55555555-5555-4555-8555-555555555555';
const DOC_LINKED = '66666666-6666-4666-8666-666666666666';
const GRIEVANCE = '77777777-7777-4777-8777-777777777777';
const USER = 'member-1';

let pg: PGlite;
const previousAuditFlag = process.env.UE_CANONICAL_BOOTSTRAP_V2;

async function resetRole() {
  await pg.exec('RESET ROLE');
}

async function asTenant(organizationId: string) {
  await resetRole();
  await pg.query(`SELECT set_config('app.current_org', $1, false)`, [organizationId]);
  await pg.exec('SET ROLE doc_runtime');
}

async function insertDocument(id: string, organizationId: string, privacyLabel: string) {
  await pg.query(
    `INSERT INTO documents
      (id, organization_id, title, name, filename, file_url, mime_type, privacy_label, uploaded_by)
     VALUES ($1, $2, $3, $3, 'note.pdf', 'https://stored.example/note.pdf', 'application/pdf', $4, $5)`,
    [id, organizationId, privacyLabel, privacyLabel, USER],
  );
  await pg.query(
    `INSERT INTO document_versions
      (id, organization_id, document_id, version_no, storage_key, content_hash, uploaded_by)
     VALUES ($1, $2, $3, 1, $4, 'hash', $5)`,
    [crypto.randomUUID(), organizationId, id, `documents/${organizationId}/${id}.pdf`, USER],
  );
}

async function callDownload(organizationId: string, documentId: string, userId = USER) {
  await asTenant(organizationId);
  return GET(
    new Request(`https://example.test/api/documents/${documentId}/download`),
    { organizationId, userId },
    { id: documentId },
  );
}

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    CREATE ROLE doc_runtime;
    CREATE SCHEMA audit_security;
    CREATE TABLE audit_security.audit_logs (
      audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid,
      user_id varchar(255),
      action varchar(100) NOT NULL CHECK (action != ''),
      resource_type varchar(50) NOT NULL,
      resource_id uuid,
      old_values jsonb,
      new_values jsonb,
      ip_address varchar(45),
      user_agent text,
      session_id uuid,
      correlation_id uuid,
      severity varchar(20) DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
      outcome varchar(20) DEFAULT 'success' CHECK (outcome IN ('success', 'failure', 'error')),
      error_message text,
      metadata jsonb DEFAULT '{}'::jsonb,
      archived boolean NOT NULL DEFAULT false,
      archived_at timestamptz,
      archived_path text,
      created_at timestamptz DEFAULT now()
    );
    ALTER TABLE audit_security.audit_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE audit_security.audit_logs FORCE ROW LEVEL SECURITY;
    CREATE POLICY tenant_audit_security ON audit_security.audit_logs
      USING (organization_id::text = current_setting('app.current_org', true))
      WITH CHECK (organization_id::text = current_setting('app.current_org', true));
    GRANT USAGE ON SCHEMA audit_security TO doc_runtime;
    GRANT SELECT, INSERT ON audit_security.audit_logs TO doc_runtime;
    CREATE TABLE documents (
      id uuid PRIMARY KEY,
      organization_id uuid NOT NULL,
      title text,
      name text NOT NULL,
      filename text,
      file_url text,
      mime_type text,
      privacy_label text NOT NULL,
      uploaded_by text,
      deleted_at timestamptz
    );
    CREATE TABLE document_links (
      id uuid PRIMARY KEY,
      organization_id uuid NOT NULL,
      document_id uuid NOT NULL,
      linked_entity_type text NOT NULL,
      linked_entity_id uuid NOT NULL
    );
    CREATE TABLE document_access_grants (
      id uuid PRIMARY KEY,
      organization_id uuid NOT NULL,
      document_id uuid NOT NULL,
      user_id text NOT NULL,
      status text NOT NULL,
      can_view boolean NOT NULL,
      can_download boolean NOT NULL,
      revoked_at timestamptz,
      expires_at timestamptz
    );
    CREATE TABLE document_versions (
      id uuid PRIMARY KEY,
      organization_id uuid NOT NULL,
      document_id uuid NOT NULL,
      version_no integer NOT NULL,
      storage_key text NOT NULL,
      content_hash text NOT NULL,
      uploaded_by text NOT NULL
    );
    CREATE TABLE audit_logs (
      id uuid PRIMARY KEY,
      audit_id uuid NOT NULL UNIQUE,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      organization_id uuid NOT NULL,
      action text,
      resource_type text,
      resource_id text,
      user_id text,
      ip_address inet,
      user_agent text,
      details jsonb,
      changes jsonb,
      content_hash text,
      previous_hash text
    );
    ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
    ALTER TABLE documents FORCE ROW LEVEL SECURITY;
    ALTER TABLE document_links ENABLE ROW LEVEL SECURITY;
    ALTER TABLE document_links FORCE ROW LEVEL SECURITY;
    ALTER TABLE document_access_grants ENABLE ROW LEVEL SECURITY;
    ALTER TABLE document_access_grants FORCE ROW LEVEL SECURITY;
    ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE document_versions FORCE ROW LEVEL SECURITY;
    ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
    CREATE POLICY tenant_documents ON documents
      USING (organization_id::text = current_setting('app.current_org', true))
      WITH CHECK (organization_id::text = current_setting('app.current_org', true));
    CREATE POLICY tenant_links ON document_links
      USING (organization_id::text = current_setting('app.current_org', true))
      WITH CHECK (organization_id::text = current_setting('app.current_org', true));
    CREATE POLICY tenant_grants ON document_access_grants
      USING (organization_id::text = current_setting('app.current_org', true))
      WITH CHECK (organization_id::text = current_setting('app.current_org', true));
    CREATE POLICY tenant_versions ON document_versions
      USING (organization_id::text = current_setting('app.current_org', true))
      WITH CHECK (organization_id::text = current_setting('app.current_org', true));
    CREATE POLICY tenant_audit ON audit_logs
      USING (organization_id::text = current_setting('app.current_org', true))
      WITH CHECK (organization_id::text = current_setting('app.current_org', true));
    GRANT SELECT ON documents, document_links, document_access_grants, document_versions TO doc_runtime;
    GRANT SELECT, INSERT ON audit_logs TO doc_runtime;
  `);
  const database = drizzle(pg);
  state.db = new Proxy(database, {
    get(target, property) {
      if (property === 'execute') {
        return async (query: unknown) => {
          const result = await target.execute(query as never);
          return (result as { rows?: unknown[] }).rows ?? result;
        };
      }
      const value = target[property as keyof typeof target];
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
});

beforeEach(async () => {
  state.member = true;
  state.steward = false;
  state.caseAccess = { isPrimaryOwner: false, canViewCase: false, canViewPrivateDocuments: false };
  state.sas.mockClear();
  state.sas.mockResolvedValue('https://storage.example/signed.pdf');
  delete process.env.UE_CANONICAL_BOOTSTRAP_V2;
  await resetRole();
  await pg.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid PRIMARY KEY,
      audit_id uuid NOT NULL UNIQUE,
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      organization_id uuid NOT NULL,
      action text,
      resource_type text,
      resource_id text,
      user_id text,
      ip_address inet,
      user_agent text,
      details jsonb,
      changes jsonb,
      content_hash text,
      previous_hash text
    );
    ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT ON audit_logs TO doc_runtime;
  `);
  await pg.exec(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_audit') THEN
        CREATE POLICY tenant_audit ON audit_logs
          USING (organization_id::text = current_setting('app.current_org', true))
          WITH CHECK (organization_id::text = current_setting('app.current_org', true));
      END IF;
    END $$;
    TRUNCATE documents, document_links, document_access_grants, document_versions, audit_logs, audit_security.audit_logs;
  `);
});

afterEach(() => {
  if (previousAuditFlag === undefined) delete process.env.UE_CANONICAL_BOOTSTRAP_V2;
  else process.env.UE_CANONICAL_BOOTSTRAP_V2 = previousAuditFlag;
});

afterAll(async () => {
  await resetRole().catch(() => undefined);
  await pg?.close();
});

describe('GET /api/documents/[id]/download against PostgreSQL', () => {
  it('issues a signed url for an authorized member and hides the other organization', async () => {
    await insertDocument(DOC_OPEN, ORG_A, 'team_confidential');
    await insertDocument(DOC_FOREIGN, ORG_B, 'team_confidential');
    await asTenant(ORG_A);
    const visible = await pg.query<{ id: string }>('SELECT id FROM documents ORDER BY id');
    expect(visible.rows.map((row) => row.id)).toEqual([DOC_OPEN]);

    const allowed = await callDownload(ORG_A, DOC_OPEN);
    expect(allowed.status).toBe(200);
    const body = await allowed.json();
    expect(body.data.downloadUrl).toBe('https://storage.example/signed.pdf');

    const foreign = await callDownload(ORG_A, DOC_FOREIGN);
    expect(foreign.status).toBe(404);
    expect(state.sas).toHaveBeenCalledTimes(1);
  });

  it('denies a privileged document to a member and to a steward without a download grant', async () => {
    await insertDocument(DOC_PRIVILEGED, ORG_A, 'privileged');
    const member = await callDownload(ORG_A, DOC_PRIVILEGED);
    expect(member.status).toBe(403);

    state.steward = true;
    const steward = await callDownload(ORG_A, DOC_PRIVILEGED);
    expect(steward.status).toBe(403);
    expect(state.sas).not.toHaveBeenCalled();
  });

  it('denies an unassigned representative and an expired or revoked grant', async () => {
    await insertDocument(DOC_LINKED, ORG_A, 'privileged');
    await pg.query(
      `INSERT INTO document_links (id, organization_id, document_id, linked_entity_type, linked_entity_id)
       VALUES ($1, $2, $3, 'grievance', $4)`,
      [crypto.randomUUID(), ORG_A, DOC_LINKED, GRIEVANCE],
    );
    state.caseAccess = { isPrimaryOwner: false, canViewCase: false, canViewPrivateDocuments: false };
    const unassigned = await callDownload(ORG_A, DOC_LINKED, 'other-representative');
    expect(unassigned.status).toBe(403);

    state.caseAccess = { isPrimaryOwner: false, canViewCase: true, canViewPrivateDocuments: false };
    const caseReader = await callDownload(ORG_A, DOC_LINKED);
    expect(caseReader.status).toBe(403);

    await resetRole();
    await pg.query(
      `INSERT INTO document_access_grants
        (id, organization_id, document_id, user_id, status, can_view, can_download, revoked_at, expires_at)
       VALUES ($1, $2, $3, $4, 'active', true, true, NULL, NOW() - interval '1 hour')`,
      [crypto.randomUUID(), ORG_A, DOC_LINKED, USER],
    );
    const expired = await callDownload(ORG_A, DOC_LINKED);
    expect(expired.status).toBe(403);

    await resetRole();
    await pg.exec('DELETE FROM document_access_grants');
    await pg.query(
      `INSERT INTO document_access_grants
        (id, organization_id, document_id, user_id, status, can_view, can_download, revoked_at, expires_at)
       VALUES ($1, $2, $3, $4, 'revoked', true, true, NOW(), NULL)`,
      [crypto.randomUUID(), ORG_A, DOC_LINKED, USER],
    );
    const revoked = await callDownload(ORG_A, DOC_LINKED);
    expect(revoked.status).toBe(403);
    expect(state.sas).not.toHaveBeenCalled();
  });

  it('allows an explicit download grant and refuses view-only grants', async () => {
    await insertDocument(DOC_PRIVILEGED, ORG_A, 'privileged');
    await pg.query(
      `INSERT INTO document_access_grants
        (id, organization_id, document_id, user_id, status, can_view, can_download, revoked_at, expires_at)
       VALUES ($1, $2, $3, $4, 'active', true, false, NULL, NULL)`,
      [crypto.randomUUID(), ORG_A, DOC_PRIVILEGED, USER],
    );
    const viewOnly = await callDownload(ORG_A, DOC_PRIVILEGED);
    expect(viewOnly.status).toBe(403);

    await resetRole();
    await pg.exec('DELETE FROM document_access_grants');
    await pg.query(
      `INSERT INTO document_access_grants
        (id, organization_id, document_id, user_id, status, can_view, can_download, revoked_at, expires_at)
       VALUES ($1, $2, $3, $4, 'active', true, true, NULL, NULL)`,
      [crypto.randomUUID(), ORG_A, DOC_PRIVILEGED, USER],
    );
    const allowed = await callDownload(ORG_A, DOC_PRIVILEGED);
    expect(allowed.status).toBe(200);
    expect(state.sas).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed ids, missing storage, and a failed audit write without returning a url', async () => {
    const malformed = await GET(
      new Request('https://example.test/api/documents/not-a-uuid/download'),
      { organizationId: ORG_A, userId: USER },
      { id: 'not-a-uuid' },
    );
    expect(malformed.status).toBe(400);

    await insertDocument(DOC_OPEN, ORG_A, 'team_confidential');
    state.sas.mockRejectedValueOnce(new Error('storage down'));
    const storage = await callDownload(ORG_A, DOC_OPEN);
    expect(storage.status).toBe(502);
    expect(JSON.stringify(await storage.json())).not.toContain('https://storage.example');

    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1';
    await resetRole();
    await pg.exec('DROP TABLE audit_logs');
    const audit = await callDownload(ORG_A, DOC_OPEN);
    const auditBody = JSON.stringify(await audit.json());
    expect(audit.status).toBe(503);
    expect(auditBody).not.toContain('https://storage.example');
  });

  it('persists the download audit when canonical v2 is enabled', async () => {
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1';
    await insertDocument(DOC_OPEN, ORG_A, 'team_confidential');
    const response = await callDownload(ORG_A, DOC_OPEN);
    expect(response.status).toBe(200);
    await resetRole();
    await pg.query(`SELECT set_config('app.current_org', $1, false)`, [ORG_A]);
    await pg.exec('SET ROLE doc_runtime');
    const rows = await pg.query<{ action: string; resource_id: string }>('SELECT action, resource_id FROM audit_logs');
    expect(rows.rows).toEqual([{ action: 'document.download', resource_id: DOC_OPEN }]);
  });

  it('persists the download audit when canonical v2 is disabled, so the url never depends on a skipped audit', async () => {
    delete process.env.UE_CANONICAL_BOOTSTRAP_V2;
    await insertDocument(DOC_OPEN, ORG_A, 'team_confidential');
    const response = await callDownload(ORG_A, DOC_OPEN);
    expect(response.status).toBe(200);
    await resetRole();
    await pg.query(`SELECT set_config('app.current_org', $1, false)`, [ORG_A]);
    await pg.exec('SET ROLE doc_runtime');
    const rows = await pg.query<{ action: string; resource_id: string; user_id: string }>(
      'SELECT action, resource_id, user_id FROM audit_security.audit_logs',
    );
    expect(rows.rows).toEqual([{ action: 'document.download', resource_id: DOC_OPEN, user_id: USER }]);
  });

  it('withholds the url when the audit write fails with canonical v2 disabled (fault injection)', async () => {
    delete process.env.UE_CANONICAL_BOOTSTRAP_V2;
    await insertDocument(DOC_OPEN, ORG_A, 'team_confidential');
    await resetRole();
    await pg.exec('REVOKE INSERT ON audit_security.audit_logs FROM doc_runtime');
    try {
      const response = await callDownload(ORG_A, DOC_OPEN);
      expect(response.status).toBe(503);
      expect(JSON.stringify(await response.json())).not.toContain('https://storage.example');
    } finally {
      await resetRole();
      await pg.exec('GRANT SELECT, INSERT ON audit_security.audit_logs TO doc_runtime');
    }
    await pg.query(`SELECT set_config('app.current_org', $1, false)`, [ORG_A]);
    await pg.exec('SET ROLE doc_runtime');
    const rows = await pg.query('SELECT 1 FROM audit_security.audit_logs');
    expect(rows.rows).toHaveLength(0);
  });

  it('does not write an access record for a denied request', async () => {
    delete process.env.UE_CANONICAL_BOOTSTRAP_V2;
    await insertDocument(DOC_PRIVILEGED, ORG_A, 'privileged');
    const denied = await callDownload(ORG_A, DOC_PRIVILEGED);
    expect(denied.status).toBe(403);
    await resetRole();
    await pg.query(`SELECT set_config('app.current_org', $1, false)`, [ORG_A]);
    await pg.exec('SET ROLE doc_runtime');
    expect((await pg.query('SELECT 1 FROM audit_security.audit_logs')).rows).toHaveLength(0);
  });
});
