// Download issuance (B1-B3) and version append (B4) against real PostgreSQL semantics (PGlite): real constraints, real
// transactions and row locks, real audit persistence, real storage-reference validation. Only the blob store, the case
// kernel and the session are stood in for.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const USER = 'member-1';

const state = vi.hoisted(() => ({
  db: null as unknown,
  blobs: new Map<string, Buffer>(),
  sasFailFor: new Set<string>(),
  sas: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: (handler: (...args: unknown[]) => unknown) => handler,
}));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: vi.fn(async () => undefined) }));
vi.mock('@/lib/api-auth-guard', () => ({
  hasMinRole: async (role: string) => role === 'member',
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
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_context: unknown, work: (tx: unknown) => Promise<unknown>) =>
    (state.db as { transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> }).transaction((tx) => work(tx)),
}));
vi.mock('@/lib/services/case-access-service', () => ({
  getEffectiveCaseAccess: async () => ({ isPrimaryOwner: false, canViewCase: false, canViewPrivateDocuments: false, canModifyDocuments: false }),
}));
vi.mock('@/lib/blob-client', () => ({
  generateSasUrl: async (container: string, path: string) => {
    state.sas(container, path);
    if (state.sasFailFor.has(path)) throw new Error('storage down');
    return `https://uestore.blob.core.windows.net/${container}/${path}?sig=test`;
  },
  downloadBuffer: async (_container: string, path: string) => {
    const blob = state.blobs.get(path);
    if (!blob) throw new Error('BlobNotFound');
    return blob;
  },
  computeSha256: (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex'),
}));

const { POST: bulkPost } = await import('@/app/api/documents/repository/downloads/route');
const { GET: download } = await import('@/app/api/documents/[id]/download/route');
const { POST: appendVersion } = await import('@/app/api/documents/repository/[id]/versions/route');
const { backfillLegacyDocumentVersions } = await import('@/lib/documents/legacy-storage-backfill');

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const OWN = 'https://uestore.blob.core.windows.net/union-eyes';

let pg: PGlite;
const q = (sql: string, params: unknown[] = []) => pg.query(sql, params);

async function addDocument(docId: string, org: string, opts: { label?: string; fileUrl?: string | null; storageKey?: string | null; deleted?: boolean; uploadedBy?: string } = {}) {
  await q(
    `INSERT INTO documents (id, organization_id, title, name, filename, file_url, mime_type, privacy_label, uploaded_by, deleted_at)
     VALUES ($1, $2, 'T', 'T', 'f.pdf', $3, 'application/pdf', $4, $5, $6)`,
    [docId, org, opts.fileUrl ?? null, opts.label ?? 'team_confidential', opts.uploadedBy ?? USER, opts.deleted ? new Date().toISOString() : null],
  );
  if (opts.storageKey !== null && opts.storageKey !== undefined) {
    await q(
      `INSERT INTO document_versions (id, organization_id, document_id, version_no, storage_key, content_hash, uploaded_by)
       VALUES (gen_random_uuid(), $1, $2, 1, $3, $4, $5)`,
      [org, docId, opts.storageKey, sha(opts.storageKey), USER],
    );
  }
}

const auditRows = async () =>
  (await q(`SELECT action, resource_id, user_id, metadata FROM audit_security.audit_logs ORDER BY created_at, audit_id`)).rows as Array<{
    action: string; resource_id: string | null; user_id: string | null; metadata: { route?: string };
  }>;

const getOne = (docId: string) =>
  download(new Request(`https://t.test/api/documents/${docId}/download`), { organizationId: ORG_A, userId: USER }, { id: docId });
const bulk = (documentIds: unknown) =>
  bulkPost(
    new Request('https://t.test/api/documents/repository/downloads', { method: 'POST', body: JSON.stringify({ documentIds }) }),
    { organizationId: ORG_A, userId: USER },
  );
const append = (docId: string, body: Record<string, unknown>) =>
  appendVersion(
    new Request(`https://t.test/api/documents/repository/${docId}/versions`, { method: 'POST', body: JSON.stringify(body) }),
    { organizationId: ORG_A, userId: USER },
    { id: docId },
  );

beforeAll(async () => {
  process.env.AZURE_STORAGE_ACCOUNT_NAME = 'uestore';
  delete process.env.UE_CANONICAL_BOOTSTRAP_V2;
  pg = new PGlite();
  await pg.exec(`
    CREATE SCHEMA audit_security;
    CREATE TABLE audit_security.audit_logs (
      audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid,
      user_id varchar(255),
      action varchar(100) NOT NULL CHECK (action != ''),
      resource_type varchar(50) NOT NULL,
      resource_id uuid,
      old_values jsonb, new_values jsonb, ip_address varchar(45), user_agent text, session_id uuid, correlation_id uuid,
      severity varchar(20) DEFAULT 'info', outcome varchar(20) DEFAULT 'success', error_message text,
      metadata jsonb DEFAULT '{}'::jsonb,
      archived boolean NOT NULL DEFAULT false, archived_at timestamptz, archived_path text,
      created_at timestamptz DEFAULT now()
    );
    CREATE FUNCTION audit_security.refuse_marked() RETURNS trigger AS $$
    BEGIN
      IF NEW.resource_id = '00000000-0000-4000-8000-000000000099' THEN RAISE EXCEPTION 'injected audit fault'; END IF;
      RETURN NEW;
    END $$ LANGUAGE plpgsql;
    CREATE TRIGGER inject_fault BEFORE INSERT ON audit_security.audit_logs FOR EACH ROW EXECUTE FUNCTION audit_security.refuse_marked();
    CREATE TABLE documents (
      id uuid PRIMARY KEY, organization_id uuid NOT NULL, title text, name text NOT NULL, filename text, file_url text,
      mime_type text, privacy_label text NOT NULL, uploaded_by text, metadata jsonb DEFAULT '{}'::jsonb,
      updated_at timestamp NOT NULL DEFAULT now(), deleted_at timestamp
    );
    CREATE TABLE document_links (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, document_id uuid NOT NULL,
      linked_entity_type text NOT NULL, linked_entity_id uuid NOT NULL
    );
    CREATE TABLE document_access_grants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, document_id uuid NOT NULL, user_id text NOT NULL,
      status text NOT NULL, can_view boolean NOT NULL, can_download boolean NOT NULL, revoked_at timestamptz, expires_at timestamptz
    );
    CREATE TABLE document_versions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL, document_id uuid NOT NULL REFERENCES documents(id),
      version_no integer NOT NULL, storage_key text NOT NULL, content_hash text NOT NULL, uploaded_by text NOT NULL,
      uploaded_at timestamptz NOT NULL DEFAULT now(), metadata jsonb DEFAULT '{}'::jsonb
    );
    CREATE UNIQUE INDEX idx_document_versions_unique ON document_versions (document_id, version_no);
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
  state.blobs.clear();
  state.sasFailFor.clear();
  state.sas.mockClear();
  await pg.exec('TRUNCATE document_versions, document_links, document_access_grants, documents, audit_security.audit_logs CASCADE');
});

afterAll(async () => {
  await pg?.close();
});

describe('B2: a stored URL is a pointer to be verified, never a link to be returned', () => {
  it('re-signs a legacy URL that points into the organization\'s own storage', async () => {
    await addDocument(id(1), ORG_A, { fileUrl: `${OWN}/documents/${ORG_A}/legacy.pdf?sig=expired` });
    const response = await getOne(id(1));
    expect(response.status).toBe(200);
    const url = (await response.json()).data.downloadUrl as string;
    expect(url).toBe(`${OWN}/union-eyes/documents/${ORG_A}/legacy.pdf?sig=test`.replace('/union-eyes/union-eyes', '/union-eyes'));
    expect(url).not.toContain('expired');
    expect(state.sas).toHaveBeenCalledWith('union-eyes', `documents/${ORG_A}/legacy.pdf`);
    expect(await auditRows()).toHaveLength(1);
  });

  it.each([
    ['an external URL', 'https://evil.example/legacy.pdf'],
    ['an external URL shaped like ours', `https://evil.example/union-eyes/documents/${ORG_A}/legacy.pdf`],
    ['another tenant\'s file', `${OWN}/documents/${ORG_B}/legacy.pdf`],
    ['a traversal into another tenant', `${OWN}/documents/${ORG_A}/../${ORG_B}/legacy.pdf`],
    ['a missing location', ''],
  ])('issues nothing for %s, signs nothing and records no access', async (_label, fileUrl) => {
    await addDocument(id(2), ORG_A, { fileUrl: fileUrl || null });
    const response = await getOne(id(2));
    const text = JSON.stringify(await response.json());
    expect(response.status).toBe(502);
    expect(text).not.toContain('evil.example');
    expect(text).not.toContain(ORG_B);
    expect(state.sas).not.toHaveBeenCalled();
    expect(await auditRows()).toHaveLength(0);
  });

  it('issues nothing when a version row names a key outside the organization', async () => {
    await addDocument(id(3), ORG_A, { storageKey: `documents/${ORG_B}/stolen.pdf` });
    expect((await getOne(id(3))).status).toBe(502);
    expect(state.sas).not.toHaveBeenCalled();
    expect(await auditRows()).toHaveLength(0);
  });
});

describe('B1 on the single route, canonical V2 off: no url without a recorded access', () => {
  it('records the access, attributes it to the member, and issues the url', async () => {
    await addDocument(id(4), ORG_A, { storageKey: `documents/${ORG_A}/four.pdf` });
    expect((await getOne(id(4))).status).toBe(200);
    expect(await auditRows()).toEqual([
      expect.objectContaining({ action: 'document.download', resource_id: id(4), user_id: USER }),
    ]);
  });

  it('withholds the url when the audit write is refused', async () => {
    await addDocument(id(99), ORG_A, { storageKey: `documents/${ORG_A}/ninety-nine.pdf` });
    const response = await getOne(id(99));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('sig=');
    expect(await auditRows()).toHaveLength(0);
  });
});

describe('B3: a bulk download is N independent downloads with an honest report', () => {
  it('reports each document, issues and audits only what was authorized, and says it is not atomic', async () => {
    await addDocument(id(10), ORG_A, { storageKey: `documents/${ORG_A}/ten.pdf` });
    await addDocument(id(11), ORG_A, { label: 'privileged', storageKey: `documents/${ORG_A}/eleven.pdf` });
    await addDocument(id(12), ORG_B, { storageKey: `documents/${ORG_B}/twelve.pdf` });
    await addDocument(id(13), ORG_A, { storageKey: `documents/${ORG_A}/thirteen.pdf` });
    await addDocument(id(14), ORG_A, { storageKey: `documents/${ORG_A}/fourteen.pdf` });
    state.sasFailFor.add(`documents/${ORG_A}/thirteen.pdf`);

    const response = await bulk([id(10), id(11), id(12), id(13), id(14), id(15)]);
    expect(response.status).toBe(200);
    const { data } = await response.json();

    expect(data.atomic).toBe(false);
    expect(data.status).toBe('partial');
    expect(data.requested).toBe(6);
    expect(data.issued).toBe(2);
    expect(data.failed).toBe(4);
    const byId = Object.fromEntries(data.items.map((item: { documentId: string; outcome: string }) => [item.documentId, item.outcome]));
    expect(byId).toEqual({
      [id(10)]: 'issued',
      [id(11)]: 'denied',
      [id(12)]: 'not_found',
      [id(13)]: 'storage_unavailable',
      [id(14)]: 'issued',
      [id(15)]: 'not_found',
    });
    for (const item of data.items as Array<{ outcome: string; downloadUrl?: string }>) {
      expect(Boolean(item.downloadUrl)).toBe(item.outcome === 'issued');
    }

    // Exactly one access record per issued link, none for a denial, a miss or a storage failure.
    const rows = await auditRows();
    expect(rows.map((row) => row.resource_id).sort()).toEqual([id(10), id(14)]);
    expect(rows.every((row) => row.action === 'document.download' && row.metadata.route === '/api/documents/repository/downloads')).toBe(true);
  });

  it('withholds only the link whose own access record cannot be written', async () => {
    await addDocument(id(20), ORG_A, { storageKey: `documents/${ORG_A}/twenty.pdf` });
    await addDocument(id(99), ORG_A, { storageKey: `documents/${ORG_A}/ninety-nine.pdf` });
    await addDocument(id(21), ORG_A, { storageKey: `documents/${ORG_A}/twenty-one.pdf` });

    const { data } = await (await bulk([id(20), id(99), id(21)])).json();
    expect(data.status).toBe('partial');
    expect(data.items.map((item: { outcome: string }) => item.outcome)).toEqual(['issued', 'audit_failed', 'issued']);
    expect(data.items[1].downloadUrl).toBeUndefined();
    expect((await auditRows()).map((row) => row.resource_id)).toEqual([id(20), id(21)]);
  });

  it('reports a total failure as none, with no links', async () => {
    await addDocument(id(30), ORG_A, { label: 'privileged', storageKey: `documents/${ORG_A}/thirty.pdf` });
    const { data } = await (await bulk([id(30)])).json();
    expect(data).toMatchObject({ status: 'none', issued: 0, failed: 1 });
    expect(await auditRows()).toHaveLength(0);
  });

  it('collapses duplicate ids and refuses malformed, empty and oversized requests', async () => {
    await addDocument(id(40), ORG_A, { storageKey: `documents/${ORG_A}/forty.pdf` });
    const { data } = await (await bulk([id(40), id(40)])).json();
    expect(data.requested).toBe(1);
    expect(await auditRows()).toHaveLength(1);

    expect((await bulk([])).status).toBe(400);
    expect((await bulk(['not-a-uuid'])).status).toBe(400);
    expect((await bulk(Array.from({ length: 26 }, (_, i) => id(100 + i)))).status).toBe(400);
    expect((await bulk('nope')).status).toBe(400);
  });
});

describe('B4: a version is judged by the server against storage, hash, linkage and current state', () => {
  const bytes = (docId: string, text: string) => {
    const path = `documents/${ORG_A}/${docId}-${text}.pdf`;
    state.blobs.set(path, Buffer.from(text));
    return { path, hash: sha(text) };
  };

  it('appends a version whose hash the server computed from storage, and audits it in the same transaction', async () => {
    await addDocument(id(50), ORG_A, { storageKey: `documents/${ORG_A}/orig.pdf`, uploadedBy: USER });
    const next = bytes('50', 'second');
    const response = await append(id(50), { blobPath: next.path, contentHash: next.hash, expectedVersionNo: 1 });
    expect(response.status).toBe(200);

    const versions = (await q('SELECT version_no, storage_key, content_hash FROM document_versions WHERE document_id = $1 ORDER BY version_no', [id(50)])).rows;
    expect(versions[1]).toEqual({ version_no: 2, storage_key: next.path, content_hash: next.hash });
    expect(((await q('SELECT file_url FROM documents WHERE id = $1', [id(50)])).rows[0] as { file_url: string }).file_url).toContain(next.path);
    expect((await auditRows()).map((row) => row.action)).toEqual(['document.version_append']);
  });

  it('refuses a forged hash with 409 and records nothing', async () => {
    await addDocument(id(51), ORG_A, { storageKey: `documents/${ORG_A}/orig.pdf` });
    const next = bytes('51', 'real-content');
    const response = await append(id(51), { blobPath: next.path, contentHash: sha('something-else') });
    expect(response.status).toBe(409);
    expect((await q('SELECT 1 FROM document_versions WHERE document_id = $1', [id(51)])).rows).toHaveLength(1);
    expect(await auditRows()).toHaveLength(0);
  });

  it.each([
    ['an external URL', () => ({ fileUrl: 'https://evil.example/documents/x/a.pdf' })],
    ['an external URL shaped like ours', () => ({ fileUrl: `https://evil.example/union-eyes/documents/${ORG_A}/a.pdf` })],
    ['another tenant\'s blob path', () => ({ blobPath: `documents/${ORG_B}/a.pdf` })],
    ['traversal into another tenant', () => ({ blobPath: `documents/${ORG_A}/../${ORG_B}/a.pdf` })],
    ['a malformed hash', () => ({ blobPath: `documents/${ORG_A}/x.pdf`, contentHash: 'manual:1' })],
  ])('refuses %s with 400 and records nothing', async (_label, payload) => {
    await addDocument(id(52), ORG_A, { storageKey: `documents/${ORG_A}/orig.pdf` });
    const response = await append(id(52), payload());
    expect(response.status).toBe(400);
    expect((await q('SELECT 1 FROM document_versions WHERE document_id = $1', [id(52)])).rows).toHaveLength(1);
    expect(await auditRows()).toHaveLength(0);
  });

  it('refuses a stale update', async () => {
    await addDocument(id(53), ORG_A, { storageKey: `documents/${ORG_A}/orig.pdf` });
    expect((await append(id(53), { blobPath: bytes('53', 'v2').path, expectedVersionNo: 1 })).status).toBe(200);
    const stale = await append(id(53), { blobPath: bytes('53', 'v3').path, expectedVersionNo: 1 });
    expect(stale.status).toBe(409);
    expect((await q('SELECT 1 FROM document_versions WHERE document_id = $1', [id(53)])).rows).toHaveLength(2);
  });

  it('lets only one of two concurrent updates from the same base win', async () => {
    await addDocument(id(54), ORG_A, { storageKey: `documents/${ORG_A}/orig.pdf` });
    const a = bytes('54', 'left');
    const b = bytes('54', 'right');
    const results = await Promise.all([
      append(id(54), { blobPath: a.path, expectedVersionNo: 1 }),
      append(id(54), { blobPath: b.path, expectedVersionNo: 1 }),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([200, 409]);
    expect((await q('SELECT 1 FROM document_versions WHERE document_id = $1', [id(54)])).rows).toHaveLength(2);
  });

  it('refuses a file that another document version already holds (no content substitution between documents)', async () => {
    await addDocument(id(55), ORG_A, { storageKey: `documents/${ORG_A}/shared.pdf` });
    await addDocument(id(56), ORG_A, { storageKey: `documents/${ORG_A}/other-orig.pdf` });
    state.blobs.set(`documents/${ORG_A}/shared.pdf`, Buffer.from('shared'));
    const response = await append(id(56), { blobPath: `documents/${ORG_A}/shared.pdf` });
    expect(response.status).toBe(409);
    expect((await q('SELECT 1 FROM document_versions WHERE document_id = $1', [id(56)])).rows).toHaveLength(1);
  });

  it('is a 404 for a deleted document and for a document that is not the caller\'s', async () => {
    await addDocument(id(57), ORG_A, { storageKey: `documents/${ORG_A}/orig.pdf`, deleted: true });
    await addDocument(id(58), ORG_A, { storageKey: `documents/${ORG_A}/orig2.pdf`, uploadedBy: 'someone-else' });
    expect((await append(id(57), { blobPath: bytes('57', 'x').path })).status).toBe(404);
    expect((await append(id(58), { blobPath: bytes('58', 'x').path })).status).toBe(404);
  });

  it('honours a legal hold recorded on the document, re-read under the row lock', async () => {
    await addDocument(id(59), ORG_A, { storageKey: `documents/${ORG_A}/orig.pdf` });
    await q(`UPDATE documents SET metadata = '{"legalHold": {"active": true}}'::jsonb WHERE id = $1`, [id(59)]);
    const response = await append(id(59), { blobPath: bytes('59', 'x').path });
    expect(response.status).toBe(409);
    expect((await q('SELECT 1 FROM document_versions WHERE document_id = $1', [id(59)])).rows).toHaveLength(1);
  });
});

describe('B2: the governed legacy backfill', () => {
  const legacy = (docId: string, path: string) => {
    state.blobs.set(path, Buffer.from(path));
    return addDocument(docId, ORG_A, { fileUrl: `${OWN}/${path}?sig=old` });
  };

  it('is a dry run by default and writes nothing', async () => {
    await legacy(id(70), `documents/${ORG_A}/legacy-70.pdf`);
    const report = await backfillLegacyDocumentVersions({ organizationId: ORG_A, actorId: 'admin-1' });
    expect(report).toMatchObject({ dryRun: true, examined: 1, migrated: 1, unverifiable: 0 });
    expect(report.outcomes[0]).toMatchObject({ result: 'would_migrate' });
    expect((await q('SELECT 1 FROM document_versions')).rows).toHaveLength(0);
    expect(await auditRows()).toHaveLength(0);
  });

  it('gives a verified legacy row a real version with a server-computed hash, audited, and makes it downloadable', async () => {
    const path = `documents/${ORG_A}/legacy-71.pdf`;
    await legacy(id(71), path);
    const report = await backfillLegacyDocumentVersions({ organizationId: ORG_A, actorId: 'admin-1', dryRun: false });
    expect(report).toMatchObject({ dryRun: false, migrated: 1, unverifiable: 0 });
    const version = (await q('SELECT version_no, storage_key, content_hash FROM document_versions WHERE document_id = $1', [id(71)])).rows[0];
    expect(version).toEqual({ version_no: 1, storage_key: path, content_hash: sha(path) });
    expect((await auditRows()).map((row) => row.action)).toEqual(['document.legacy_version_backfill']);

    // A second run finds nothing left to do.
    expect(await backfillLegacyDocumentVersions({ organizationId: ORG_A, actorId: 'admin-1', dryRun: false })).toMatchObject({ examined: 0 });
    expect((await getOne(id(71))).status).toBe(200);
  });

  it('reports, and does not touch, rows it cannot verify', async () => {
    await addDocument(id(72), ORG_A, { fileUrl: 'https://evil.example/legacy.pdf' });
    await addDocument(id(73), ORG_A, { fileUrl: `${OWN}/documents/${ORG_B}/other.pdf` });
    await addDocument(id(74), ORG_A, { fileUrl: null });
    await addDocument(id(75), ORG_A, { fileUrl: `${OWN}/documents/${ORG_A}/missing.pdf` });
    const report = await backfillLegacyDocumentVersions({ organizationId: ORG_A, actorId: 'admin-1', dryRun: false });
    expect(report).toMatchObject({ examined: 4, migrated: 0, unverifiable: 4 });
    const reasons = Object.fromEntries(report.outcomes.map((o) => [o.documentId, (o as { reason?: string }).reason]));
    expect(reasons).toEqual({ [id(72)]: 'not_own_storage', [id(73)]: 'not_own_storage', [id(74)]: 'no_location', [id(75)]: 'unreadable' });
    expect((await q('SELECT 1 FROM document_versions')).rows).toHaveLength(0);
    expect(await auditRows()).toHaveLength(0);
  });

  it('does not touch another organization\'s documents or already-versioned or deleted ones', async () => {
    await addDocument(id(76), ORG_B, { fileUrl: `${OWN}/documents/${ORG_B}/b.pdf` });
    await addDocument(id(77), ORG_A, { storageKey: `documents/${ORG_A}/has-version.pdf`, fileUrl: `${OWN}/documents/${ORG_A}/has-version.pdf` });
    await addDocument(id(78), ORG_A, { deleted: true, fileUrl: `${OWN}/documents/${ORG_A}/deleted.pdf` });
    expect(await backfillLegacyDocumentVersions({ organizationId: ORG_A, actorId: 'admin-1', dryRun: false })).toMatchObject({ examined: 0 });
  });

  it('refuses a file already held by another version rather than sharing it', async () => {
    const path = `documents/${ORG_A}/shared-legacy.pdf`;
    state.blobs.set(path, Buffer.from(path));
    await addDocument(id(79), ORG_A, { storageKey: path });
    await addDocument(id(80), ORG_A, { fileUrl: `${OWN}/${path}` });
    const report = await backfillLegacyDocumentVersions({ organizationId: ORG_A, actorId: 'admin-1', dryRun: false });
    expect(report.outcomes).toEqual([expect.objectContaining({ documentId: id(80), result: 'unverifiable', reason: 'storage_key_in_use' })]);
  });
});
