import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const state = vi.hoisted(() => ({
  db: null as unknown,
  steward: true,
  caseAccess: {
    isPrimaryOwner: false,
    canViewCase: false,
    canViewPrivateDocuments: false,
  },
  process: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: (role: string, handler: (request: Request, context: unknown) => unknown) => {
    return async (request: Request, context: unknown) => {
      if (role === 'steward' && !state.steward) {
        return new Response(JSON.stringify({ code: 'FORBIDDEN' }), { status: 403 });
      }
      return handler(request, context);
    };
  },
}));

vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: vi.fn(async () => undefined),
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

vi.mock('@/lib/services/document-service', () => ({
  processDocumentOCR: (...args: unknown[]) => state.process(...args),
}));

const { POST } = await import('@/app/api/documents/[id]/ocr/route');

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const DOC_OPEN = '33333333-3333-4333-8333-333333333333';
const DOC_FOREIGN = '44444444-4444-4444-8444-444444444444';
const DOC_PRIVILEGED = '55555555-5555-4555-8555-555555555555';
const DOC_LINKED = '66666666-6666-4666-8666-666666666666';
const GRIEVANCE = '77777777-7777-4777-8777-777777777777';
const USER = 'steward-1';

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
    `INSERT INTO documents (id, organization_id, title, name, filename, file_url, mime_type, privacy_label)
     VALUES ($1, $2, $3, $3, 'note.pdf', 'https://stored.example/note.pdf', 'application/pdf', $4)`,
    [id, organizationId, privacyLabel, privacyLabel],
  );
}

function callOcr(organizationId: string, documentId: string, body?: unknown) {
  return POST(
    new Request(`https://example.test/api/documents/${documentId}/ocr`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }),
    { organizationId, userId: USER, params: { id: documentId } },
  );
}

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    CREATE ROLE doc_runtime;
    CREATE TABLE documents (
      id uuid PRIMARY KEY,
      organization_id uuid NOT NULL,
      title text,
      name text NOT NULL,
      filename text,
      file_url text,
      mime_type text,
      privacy_label text NOT NULL,
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
    CREATE POLICY tenant_audit ON audit_logs
      USING (organization_id::text = current_setting('app.current_org', true))
      WITH CHECK (organization_id::text = current_setting('app.current_org', true));
    GRANT SELECT ON documents, document_links, document_access_grants TO doc_runtime;
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
  state.steward = true;
  state.caseAccess = { isPrimaryOwner: false, canViewCase: false, canViewPrivateDocuments: false };
  state.process.mockReset();
  state.process.mockImplementation(async (id: string, organizationId: string, options: { persistExtractedText?: boolean }) => {
    expect(options).toEqual({ persistExtractedText: false });
    return {
      documentId: id,
      text: `draft-${organizationId}`,
      confidence: 3,
      language: 'en',
      metadata: { blobPath: `documents/${organizationId}/secret.pdf` },
    };
  });
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
    TRUNCATE documents, document_links, document_access_grants, audit_logs;
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

describe('POST /api/documents/[id]/ocr against PostgreSQL', () => {
  it('extracts for an authorized steward and hides the other organization', async () => {
    await insertDocument(DOC_OPEN, ORG_A, 'team_confidential');
    await insertDocument(DOC_FOREIGN, ORG_B, 'team_confidential');
    await asTenant(ORG_A);
    const visible = await pg.query<{ id: string }>('SELECT id FROM documents ORDER BY id');
    expect(visible.rows.map((row) => row.id)).toEqual([DOC_OPEN]);

    const allowed = await callOcr(ORG_A, DOC_OPEN, { organizationId: ORG_B, text: 'injected transcript' });
    expect(allowed.status).toBe(200);
    const body = await allowed.json();
    expect(body.data.text).toBe(`draft-${ORG_A}`);
    expect(body.data.authoritative).toBe(false);
    expect(body.data.persisted).toBe(false);
    expect(JSON.stringify(body)).not.toContain('secret.pdf');
    expect(JSON.stringify(body)).not.toContain('injected transcript');
    expect(state.process).toHaveBeenCalledWith(DOC_OPEN, ORG_A, { persistExtractedText: false });

    state.process.mockClear();
    const foreign = await callOcr(ORG_A, DOC_FOREIGN);
    expect(foreign.status).toBe(404);
    expect(JSON.stringify(await foreign.json())).not.toContain('draft-');
    expect(state.process).not.toHaveBeenCalled();
  });

  it('denies members, privileged documents, and expired or revoked grants', async () => {
    await insertDocument(DOC_OPEN, ORG_A, 'team_confidential');
    state.steward = false;
    const member = await callOcr(ORG_A, DOC_OPEN);
    expect(member.status).toBe(403);
    expect(state.process).not.toHaveBeenCalled();

    state.steward = true;
    await insertDocument(DOC_PRIVILEGED, ORG_A, 'privileged');
    const steward = await callOcr(ORG_A, DOC_PRIVILEGED);
    expect(steward.status).toBe(403);
    expect(state.process).not.toHaveBeenCalled();

    await insertDocument(DOC_LINKED, ORG_A, 'highly_sensitive');
    await pg.query(
      `INSERT INTO document_links (id, organization_id, document_id, linked_entity_type, linked_entity_id)
       VALUES ($1, $2, $3, 'grievance', $4)`,
      [crypto.randomUUID(), ORG_A, DOC_LINKED, GRIEVANCE],
    );
    const unassigned = await callOcr(ORG_A, DOC_LINKED);
    expect(unassigned.status).toBe(403);

    await resetRole();
    await pg.query(
      `INSERT INTO document_access_grants
        (id, organization_id, document_id, user_id, status, can_view, can_download, revoked_at, expires_at)
       VALUES ($1, $2, $3, $4, 'active', true, true, NULL, NOW() - interval '1 hour')`,
      [crypto.randomUUID(), ORG_A, DOC_PRIVILEGED, USER],
    );
    expect((await callOcr(ORG_A, DOC_PRIVILEGED)).status).toBe(403);

    await resetRole();
    await pg.exec('DELETE FROM document_access_grants');
    await pg.query(
      `INSERT INTO document_access_grants
        (id, organization_id, document_id, user_id, status, can_view, can_download, revoked_at, expires_at)
       VALUES ($1, $2, $3, $4, 'revoked', true, true, NOW(), NULL)`,
      [crypto.randomUUID(), ORG_A, DOC_PRIVILEGED, USER],
    );
    expect((await callOcr(ORG_A, DOC_PRIVILEGED)).status).toBe(403);
    expect(state.process).not.toHaveBeenCalled();
  });

  it('allows an active view grant and withholds text when the audit write fails', async () => {
    await insertDocument(DOC_PRIVILEGED, ORG_A, 'privileged');
    await pg.query(
      `INSERT INTO document_access_grants
        (id, organization_id, document_id, user_id, status, can_view, can_download, revoked_at, expires_at)
       VALUES ($1, $2, $3, $4, 'active', true, false, NULL, NULL)`,
      [crypto.randomUUID(), ORG_A, DOC_PRIVILEGED, USER],
    );
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1';
    const allowed = await callOcr(ORG_A, DOC_PRIVILEGED);
    expect(allowed.status).toBe(200);
    await resetRole();
    await asTenant(ORG_A);
    const rows = await pg.query<{ action: string; details: { persisted?: boolean } }>(
      'SELECT action, details FROM audit_logs',
    );
    expect(rows.rows).toEqual([{
      action: 'document.ocr.extract',
      details: {
        route: '/api/documents/[id]/ocr',
        privacyLabel: 'privileged',
        persisted: false,
        authoritative: false,
      },
    }]);
    expect(JSON.stringify(rows.rows)).not.toContain('draft-');

    await resetRole();
    await pg.exec('DROP TABLE audit_logs');
    const audit = await callOcr(ORG_A, DOC_PRIVILEGED);
    expect(audit.status).toBe(503);
    expect(JSON.stringify(await audit.json())).not.toContain('draft-');
  });

  it('rejects a forged identifier and repeated processing still does not persist text', async () => {
    const forged = await callOcr(ORG_A, 'not-a-uuid');
    expect(forged.status).toBe(400);
    expect(state.process).not.toHaveBeenCalled();

    await insertDocument(DOC_OPEN, ORG_A, 'team_confidential');
    expect((await callOcr(ORG_A, DOC_OPEN)).status).toBe(200);
    expect((await callOcr(ORG_A, DOC_OPEN)).status).toBe(200);
    expect(state.process).toHaveBeenCalledTimes(2);
    expect(state.process.mock.calls.every((call) => call[2].persistExtractedText === false)).toBe(true);
  });
});
