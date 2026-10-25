import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const state = vi.hoisted(() => ({
  db: null as unknown,
  steward: true,
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
const USER = '88888888-8888-4888-8888-888888888888';
const OTHER = '99999999-9999-4999-8999-999999999999';

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

async function insertDocument(id: string, organizationId: string, privacyLabel: string, uploadedBy = USER) {
  await resetRole();
  await pg.query(
    `INSERT INTO documents (id, organization_id, title, name, filename, file_url, mime_type, privacy_label, uploaded_by)
     VALUES ($1, $2, $3, $3, 'note.pdf', 'https://stored.example/note.pdf', 'application/pdf', $4, $5)`,
    [id, organizationId, privacyLabel, privacyLabel, uploadedBy],
  );
}

async function insertGrievance(unionRepId: string | null = OTHER) {
  await resetRole();
  await pg.query(
    `INSERT INTO grievances (id, organization_id, union_rep_id) VALUES ($1, $2, $3)`,
    [GRIEVANCE, ORG_A, unionRepId],
  );
}

async function linkDocument(documentId: string) {
  await resetRole();
  await pg.query(
    `INSERT INTO document_links (id, organization_id, document_id, linked_entity_type, linked_entity_id)
     VALUES ($1, $2, $3, 'grievance', $4)`,
    [crypto.randomUUID(), ORG_A, documentId, GRIEVANCE],
  );
}

async function insertAssignment(input: {
  userId?: string;
  status?: string;
  canUpload?: boolean;
  canViewPrivate?: boolean;
  expiresAt?: string | null;
}) {
  await resetRole();
  await pg.query(
    `INSERT INTO grievance_case_access_assignments (
      id, organization_id, grievance_id, user_id, access_role, granted_by, granted_at,
      expires_at, can_comment, can_upload_documents, can_edit_case_notes, can_draft_actions,
      can_view_private_documents, status, updated_at
    ) VALUES (
      $1, $2, $3, $4, 'read_only', $4, NOW(), $5, false, $6, false, false, $7, $8, NOW()
    )`,
    [
      crypto.randomUUID(),
      ORG_A,
      GRIEVANCE,
      input.userId ?? USER,
      input.expiresAt ?? null,
      input.canUpload ?? false,
      input.canViewPrivate ?? false,
      input.status ?? 'active',
    ],
  );
}

async function callOcr(organizationId: string, documentId: string, body?: unknown, userId = USER) {
  await asTenant(organizationId);
  return POST(
    new Request(`https://example.test/api/documents/${documentId}/ocr`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }),
    { organizationId, userId, params: { id: documentId } },
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
    CREATE TABLE grievances (
      id uuid PRIMARY KEY,
      organization_id uuid NOT NULL,
      union_rep_id uuid
    );
    CREATE TABLE grievance_case_access_assignments (
      id uuid PRIMARY KEY,
      organization_id uuid NOT NULL,
      grievance_id uuid NOT NULL,
      user_id text NOT NULL,
      access_role text NOT NULL,
      granted_by text NOT NULL,
      granted_at timestamptz NOT NULL,
      expires_at timestamptz,
      can_comment boolean NOT NULL,
      can_upload_documents boolean NOT NULL,
      can_edit_case_notes boolean NOT NULL,
      can_draft_actions boolean NOT NULL,
      can_view_private_documents boolean NOT NULL,
      status text NOT NULL,
      updated_at timestamptz NOT NULL
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
    ALTER TABLE grievances ENABLE ROW LEVEL SECURITY;
    ALTER TABLE grievances FORCE ROW LEVEL SECURITY;
    ALTER TABLE grievance_case_access_assignments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE grievance_case_access_assignments FORCE ROW LEVEL SECURITY;
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
    CREATE POLICY tenant_grievances ON grievances
      USING (organization_id::text = current_setting('app.current_org', true))
      WITH CHECK (organization_id::text = current_setting('app.current_org', true));
    CREATE POLICY tenant_assignments ON grievance_case_access_assignments
      USING (organization_id::text = current_setting('app.current_org', true))
      WITH CHECK (organization_id::text = current_setting('app.current_org', true));
    CREATE POLICY tenant_audit ON audit_logs
      USING (organization_id::text = current_setting('app.current_org', true))
      WITH CHECK (organization_id::text = current_setting('app.current_org', true));
    GRANT SELECT ON documents, document_links, document_access_grants, grievances, grievance_case_access_assignments TO doc_runtime;
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
    TRUNCATE documents, document_links, document_access_grants, grievances, grievance_case_access_assignments, audit_logs;
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
  it('extracts for the uploader under canonical audit and hides the other organization', async () => {
    await insertDocument(DOC_OPEN, ORG_A, 'team_confidential', USER);
    await insertDocument(DOC_FOREIGN, ORG_B, 'team_confidential', USER);
    await asTenant(ORG_A);
    const visible = await pg.query<{ id: string }>('SELECT id FROM documents ORDER BY id');
    expect(visible.rows.map((row) => row.id)).toEqual([DOC_OPEN]);

    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1';
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

  it('denies members, privileged documents, and another uploader in the same organization', async () => {
    await insertDocument(DOC_OPEN, ORG_A, 'team_confidential', OTHER);
    state.steward = false;
    const member = await callOcr(ORG_A, DOC_OPEN);
    expect(member.status).toBe(403);
    expect(state.process).not.toHaveBeenCalled();

    state.steward = true;
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1';
    const crossUser = await callOcr(ORG_A, DOC_OPEN, undefined, USER);
    expect(crossUser.status).toBe(403);

    await insertDocument(DOC_PRIVILEGED, ORG_A, 'privileged', USER);
    const steward = await callOcr(ORG_A, DOC_PRIVILEGED);
    expect(steward.status).toBe(403);
    expect(state.process).not.toHaveBeenCalled();
  });

  it('uses the kernel for unassigned, revoked, expired, and view-only case relationships', async () => {
    await insertGrievance();
    await insertDocument(DOC_LINKED, ORG_A, 'team_confidential', OTHER);
    await linkDocument(DOC_LINKED);
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1';

    const unassigned = await callOcr(ORG_A, DOC_LINKED);
    expect(unassigned.status).toBe(403);

    await insertAssignment({ status: 'revoked', canUpload: true });
    expect((await callOcr(ORG_A, DOC_LINKED)).status).toBe(403);

    await resetRole();
    await pg.exec('DELETE FROM grievance_case_access_assignments');
    await insertAssignment({ canUpload: true, expiresAt: new Date(Date.now() - 60_000).toISOString() });
    expect((await callOcr(ORG_A, DOC_LINKED)).status).toBe(403);

    await resetRole();
    await pg.exec('DELETE FROM grievance_case_access_assignments');
    await insertAssignment({ canUpload: false });
    expect((await callOcr(ORG_A, DOC_LINKED)).status).toBe(403);

    await insertDocument(DOC_PRIVILEGED, ORG_A, 'privileged', OTHER);
    await linkDocument(DOC_PRIVILEGED);
    await resetRole();
    await pg.exec('DELETE FROM grievance_case_access_assignments');
    await insertAssignment({ canUpload: true, canViewPrivate: false });
    expect((await callOcr(ORG_A, DOC_PRIVILEGED)).status).toBe(403);
    expect(state.process).not.toHaveBeenCalled();
  });

  it('allows kernel document authority and withholds text unless the audit write succeeds', async () => {
    await insertGrievance(USER);
    await insertDocument(DOC_PRIVILEGED, ORG_A, 'privileged', OTHER);
    await linkDocument(DOC_PRIVILEGED);
    const withheld = await callOcr(ORG_A, DOC_PRIVILEGED);
    expect(withheld.status).toBe(503);
    expect(JSON.stringify(await withheld.json())).not.toContain('draft-');

    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1';
    const allowed = await callOcr(ORG_A, DOC_PRIVILEGED);
    expect(allowed.status).toBe(200);
    await resetRole();
    await asTenant(ORG_A);
    const rows = await pg.query<{ action: string; details: Record<string, unknown> }>(
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
    await pg.exec('DELETE FROM grievances');
    await insertGrievance();
    await insertDocument(DOC_LINKED, ORG_A, 'team_confidential', OTHER);
    await linkDocument(DOC_LINKED);
    await insertAssignment({ canUpload: true });
    const assigned = await callOcr(ORG_A, DOC_LINKED);
    expect(assigned.status).toBe(200);

    await resetRole();
    await pg.exec('DROP TABLE audit_logs');
    const audit = await callOcr(ORG_A, DOC_LINKED);
    expect(audit.status).toBe(503);
    expect(JSON.stringify(await audit.json())).not.toContain('draft-');
  });

  it('rejects a forged identifier and repeated processing still does not persist text', async () => {
    const forged = await callOcr(ORG_A, 'not-a-uuid');
    expect(forged.status).toBe(400);
    expect(state.process).not.toHaveBeenCalled();

    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1';
    await insertDocument(DOC_OPEN, ORG_A, 'team_confidential', USER);
    expect((await callOcr(ORG_A, DOC_OPEN)).status).toBe(200);
    expect((await callOcr(ORG_A, DOC_OPEN)).status).toBe(200);
    expect(state.process).toHaveBeenCalledTimes(2);
    expect(state.process.mock.calls.every((call) => call[2].persistExtractedText === false)).toBe(true);
  });
});
