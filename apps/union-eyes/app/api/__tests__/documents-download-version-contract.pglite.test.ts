// Download issuance (B1-B3) and version append (B4) against real PostgreSQL semantics (PGlite): real constraints, real
// transactions and row locks, real audit persistence, real storage-reference validation. Only the blob store, the case
// kernel and the session are stood in for.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { NextRequest } from 'next/server';
import { caller, resetCaller } from './support/with-api-stub';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const USER = 'member-1';

const state = vi.hoisted(() => ({
  db: null as unknown,
  blobs: new Map<string, Buffer>(),
  sasFailFor: new Set<string>(),
  sas: vi.fn(),
  read: vi.fn(),
  readHook: null as null | ((path: string) => void | Promise<void>),
  transactionDepth: 0,
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
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
    (state.db as { transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> }).transaction(async (tx) => {
      state.transactionDepth++;
      try { return await work(tx); }
      finally { state.transactionDepth--; }
    }),
}));
vi.mock('@/lib/services/case-access-service', () => ({
  getEffectiveCaseAccess: async () => ({ isPrimaryOwner: false, canViewCase: false, canViewPrivateDocuments: false, canModifyDocuments: false }),
}));
vi.mock('@/lib/blob-client', () => ({
  BlobTooLargeError: class BlobTooLargeError extends Error {
    constructor(public readonly sizeBytes: number, public readonly maxBytes: number) {
      super('Synthetic bounded blob read refusal');
      this.name = 'BlobTooLargeError';
    }
  },
  readBlobBounded: state.read,
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
const { GET: content } = await import('@/app/api/documents/[id]/content/route');
const { POST: appendVersion } = await import('@/app/api/documents/repository/[id]/versions/route');
const { backfillLegacyDocumentVersions } = await import('@/lib/documents/legacy-storage-backfill');
const { BlobTooLargeError } = await import('@/lib/blob-client');
const { verifyDocumentDownloadLease } = await import('@/lib/documents/download-lease');

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const OWN = 'https://uestore.blob.core.windows.net/union-eyes';
const ORIGINAL_ENV = {
  AZURE_STORAGE_ACCOUNT_NAME: process.env.AZURE_STORAGE_ACCOUNT_NAME,
  UE_CANONICAL_BOOTSTRAP_V2: process.env.UE_CANONICAL_BOOTSTRAP_V2,
  EVIDENCE_SEAL_KEY: process.env.EVIDENCE_SEAL_KEY,
};
const SYNTHETIC_SEAL_KEY = 'synthetic-document-download-test-key-only-20261123';

let pg: PGlite;
const q = (sql: string, params: unknown[] = []) => pg.query(sql, params);

async function addDocument(docId: string, org: string, opts: {
  label?: string; fileUrl?: string | null; storageKey?: string | null; deleted?: boolean; uploadedBy?: string;
  contentHash?: string; sizeBytes?: number; documentHash?: string;
} = {}) {
  await q(
    `INSERT INTO documents (id, organization_id, title, name, filename, file_url, mime_type, privacy_label, uploaded_by, deleted_at, size_bytes, sha256)
     VALUES ($1, $2, 'T', 'T', 'f.pdf', $3, 'application/pdf', $4, $5, $6, $7, $8)`,
    [docId, org, opts.fileUrl ?? null, opts.label ?? 'team_confidential', opts.uploadedBy ?? USER, opts.deleted ? new Date().toISOString() : null, opts.sizeBytes ?? null, opts.documentHash ?? null],
  );
  if (opts.storageKey !== null && opts.storageKey !== undefined) {
    await q(
      `INSERT INTO document_versions (id, organization_id, document_id, version_no, storage_key, content_hash, uploaded_by, metadata)
       VALUES (gen_random_uuid(), $1, $2, 1, $3, $4, $5, $6::jsonb)`,
      [org, docId, opts.storageKey, opts.contentHash ?? sha(opts.storageKey), USER, JSON.stringify(opts.sizeBytes === undefined ? {} : { sizeBytes: opts.sizeBytes })],
    );
  }
}

const auditRows = async () =>
  (await q(`SELECT action, resource_id, user_id, metadata FROM audit_security.audit_logs ORDER BY created_at, audit_id`)).rows as Array<{
    action: string; resource_id: string | null; user_id: string | null; metadata: { route?: string };
  }>;

// The wrapper resolves the caller (organization A's member) and the route params; each call below is that caller's request.
const asCaller = (userId = USER, organizationId = ORG_A) => {
  resetCaller();
  caller.organizationId = organizationId;
  caller.userId = userId;
  caller.role = 'member';
};
const getOne = (docId: string) => {
  asCaller();
  return download(new NextRequest(`https://t.test/api/documents/${docId}/download`), { params: { id: docId } });
};
const bulk = (documentIds: unknown) => {
  asCaller();
  return bulkPost(
    new NextRequest('https://t.test/api/documents/repository/downloads', { method: 'POST', body: JSON.stringify({ documentIds }) }),
  );
};
const append = (docId: string, body: Record<string, unknown>) => {
  asCaller();
  return appendVersion(
    new NextRequest(`https://t.test/api/documents/repository/${docId}/versions`, { method: 'POST', body: JSON.stringify(body) }),
    { params: { id: docId } },
  );
};
const readContent = (docId: string, url: string, userId = USER, organizationId = ORG_A) => {
  asCaller(userId, organizationId);
  return content(new NextRequest(new URL(url, 'https://t.test')), { params: { id: docId } });
};
const issuedUrl = async (docId: string) => {
  const response = await getOne(docId);
  expect(response.status).toBe(200);
  const body = await response.json();
  const url = new URL(body.data.downloadUrl, 'https://t.test');
  expect(url.origin).toBe('https://t.test');
  expect(url.pathname).toBe(`/api/documents/${docId}/content`);
  expect(url.searchParams.get('lease')).toBeTruthy();
  expect(JSON.stringify(body)).not.toMatch(/blob\.core\.windows\.net|sig=|documents%2F/);
  return body.data.downloadUrl as string;
};

beforeAll(async () => {
  process.env.AZURE_STORAGE_ACCOUNT_NAME = 'uestore';
  process.env.EVIDENCE_SEAL_KEY = SYNTHETIC_SEAL_KEY;
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
    CREATE TABLE document_test_audit_faults (document_id uuid NOT NULL, action text NOT NULL);
    CREATE FUNCTION audit_security.refuse_marked() RETURNS trigger AS $$
    BEGIN
      IF NEW.resource_id = '00000000-0000-4000-8000-000000000099'
        OR EXISTS (SELECT 1 FROM document_test_audit_faults WHERE document_id=NEW.resource_id AND action=NEW.action)
      THEN RAISE EXCEPTION 'injected audit fault'; END IF;
      RETURN NEW;
    END $$ LANGUAGE plpgsql;
    CREATE TRIGGER inject_fault BEFORE INSERT ON audit_security.audit_logs FOR EACH ROW EXECUTE FUNCTION audit_security.refuse_marked();
    CREATE TABLE grievances (id uuid PRIMARY KEY, organization_id uuid NOT NULL);
    CREATE TABLE documents (
      id uuid PRIMARY KEY, organization_id uuid NOT NULL, title text, name text NOT NULL, filename text, file_url text,
      mime_type text, privacy_label text NOT NULL, uploaded_by text, metadata jsonb DEFAULT '{}'::jsonb,
      size_bytes bigint, file_size integer, sha256 text, checksum text,
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
  await q('TRUNCATE grievances');
  state.blobs.clear();
  state.sasFailFor.clear();
  state.sas.mockClear();
  state.readHook = null;
  state.read.mockReset().mockImplementation(async (path: string, maxBytes: number) => {
    if (state.transactionDepth !== 0) throw new Error('Storage I/O must not hold a database transaction');
    const stored = state.blobs.get(path);
    if (!stored) throw new Error('BlobNotFound');
    const bytes = Buffer.from(stored);
    await state.readHook?.(path);
    if (bytes.length > maxBytes) throw new BlobTooLargeError(bytes.length, maxBytes);
    return bytes;
  });
  process.env.EVIDENCE_SEAL_KEY = SYNTHETIC_SEAL_KEY;
  await pg.exec('TRUNCATE document_versions, document_links, document_access_grants, documents, document_test_audit_faults, audit_security.audit_logs CASCADE');
});

afterAll(async () => {
  await pg?.close();
  for (const [name, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe('B2: a stored URL is a pointer to be verified, never a link to be returned', () => {
  it('issues an actor-bound application link for a legacy pointer into the organization\'s own storage', async () => {
    await addDocument(id(1), ORG_A, { fileUrl: `${OWN}/documents/${ORG_A}/legacy.pdf?sig=expired` });
    const url = await issuedUrl(id(1));
    expect(url).not.toContain('expired');
    expect(state.sas).not.toHaveBeenCalled();
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
    await addDocument(id(13), ORG_A, { storageKey: `documents/${ORG_B}/unverified-thirteen.pdf` });
    await addDocument(id(14), ORG_A, { storageKey: `documents/${ORG_A}/fourteen.pdf` });

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
      [id(13)]: 'storage_unverified',
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

  it('does not call issued links delivered: a later storage failure leaves only the successful byte response served', async () => {
    const path = `documents/${ORG_A}/bulk-readable.pdf`;
    state.blobs.set(path, Buffer.from('readable bulk bytes'));
    await addDocument(id(41), ORG_A, { storageKey: path, contentHash: sha('readable bulk bytes') });
    await addDocument(id(42), ORG_A, { storageKey: `documents/${ORG_A}/bulk-unavailable.pdf` });
    const { data } = await (await bulk([id(41), id(42)])).json();
    expect(data).toMatchObject({ atomic: false, requested: 2, issued: 2, failed: 0 });
    expect(state.read).not.toHaveBeenCalled();
    expect((await auditRows()).map(row => row.action)).toEqual(['document.download', 'document.download']);
    expect((await readContent(id(41), data.items[0].downloadUrl)).status).toBe(200);
    const unavailable = await readContent(id(42), data.items[1].downloadUrl);
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers.get('content-disposition')).toBeNull();
    expect((await auditRows()).filter(row => row.action === 'document.download_served').map(row => row.resource_id)).toEqual([id(41)]);
  });

  it('fails closed for every item when the application-link signing key is unavailable', async () => {
    await addDocument(id(43), ORG_A, { storageKey: `documents/${ORG_A}/forty-three.pdf` });
    await addDocument(id(44), ORG_A, { storageKey: `documents/${ORG_A}/forty-four.pdf` });
    delete process.env.EVIDENCE_SEAL_KEY;
    const { data } = await (await bulk([id(43), id(44)])).json();
    expect(data).toMatchObject({ atomic: false, status: 'none', requested: 2, issued: 0, failed: 2 });
    expect(data.items.map((item: { outcome: string }) => item.outcome)).toEqual(['storage_unavailable', 'storage_unavailable']);
    expect(data.items.every((item: { downloadUrl?: string }) => !item.downloadUrl)).toBe(true);
    expect(await auditRows()).toHaveLength(0);
    expect(state.read).not.toHaveBeenCalled();
  });
});

describe('private application byte delivery: exact artifact, current authority and committed access audit', () => {
  const versioned = async (docId: string, text: string, extra: { uploadedBy?: string; label?: string; sizeBytes?: number } = {}) => {
    const path = `documents/${ORG_A}/${docId}.pdf`;
    const bytes = Buffer.from(text);
    state.blobs.set(path, bytes);
    await addDocument(docId, ORG_A, { storageKey: path, contentHash: sha(text), sizeBytes: bytes.length, ...extra });
    return { path, bytes };
  };
  const grant = async (docId: string) => q(`INSERT INTO document_access_grants
    (organization_id,document_id,user_id,status,can_view,can_download) VALUES($1,$2,$3,'active',true,true)`, [ORG_A, docId, USER]);
  const served = async () => (await auditRows()).filter(row => row.action === 'document.download_served');

  it('serves the exact version bytes and records their real digest, size, actor and integrity basis', async () => {
    const { path, bytes } = await versioned(id(160), 'exact private artifact');
    const url = await issuedUrl(id(160));
    expect(state.sas).not.toHaveBeenCalled();
    expect(state.read).not.toHaveBeenCalled();
    const response = await readContent(id(160), url);
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    expect(response.headers.get('content-length')).toBe(String(bytes.length));
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-disposition')).toContain('attachment;');
    expect(state.read).toHaveBeenCalledWith(path, 50 * 1024 * 1024);
    const rows = await served();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ resource_id: id(160), user_id: USER, metadata: {
      checksumSha256: sha('exact private artifact'), sizeBytes: bytes.length,
      versionNo: 1, integrityBasis: 'stored_version_hash', delivery: 'application_response_authorized',
    } });
  });

  it('delivers bytes with a valid Unicode filename at the former UTF-16 truncation boundary', async () => {
    const { bytes } = await versioned(id(185), 'Unicode filename content');
    await q('UPDATE documents SET filename=$1 WHERE id=$2', ['a'.repeat(199) + '😀.pdf', id(185)]);
    const response = await readContent(id(185), await issuedUrl(id(185)));
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    const disposition = response.headers.get('content-disposition');
    expect(decodeURIComponent(disposition!.split("UTF-8''")[1])).toBe('a'.repeat(199) + '😀');
    expect(await served()).toHaveLength(1);
  });

  it.each(['policy_library', 'template_library', 'collective_agreement', 'member', 'other'])('delivers the uploader’s authorized non-case %s document', async linkType => {
    const { bytes } = await versioned(id(186), 'ordinary organization document');
    await q('INSERT INTO document_links (organization_id,document_id,linked_entity_type,linked_entity_id) VALUES($1,$2,$3,$4)', [ORG_A, id(186), linkType, id(190)]);
    const response = await readContent(id(186), await issuedUrl(id(186)));
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    expect(await served()).toHaveLength(1);
  });

  it('does not open a legacy mislabelled case document through non-case scope', async () => {
    await versioned(id(187), 'case-restricted despite a wrong old link spelling', { label: 'public_internal' });
    await q('INSERT INTO grievances(id,organization_id) VALUES($1,$2)', [id(191), ORG_A]);
    await q('INSERT INTO document_links (organization_id,document_id,linked_entity_type,linked_entity_id) VALUES($1,$2,$3,$4)', [ORG_A, id(187), 'policy_library', id(191)]);
    expect((await getOne(id(187))).status).toBe(403);
    expect(state.read).not.toHaveBeenCalled();
    expect(await auditRows()).toHaveLength(0);
  });

  it('keeps another uploader’s confidential non-case document private', async () => {
    await versioned(id(188), 'confidential non-case bytes', { uploadedBy: 'someone-else' });
    await q('INSERT INTO document_links (organization_id,document_id,linked_entity_type,linked_entity_id) VALUES($1,$2,$3,$4)', [ORG_A, id(188), 'policy_library', id(192)]);
    expect((await getOne(id(188))).status).toBe(403);
    expect(state.read).not.toHaveBeenCalled();
    expect(await auditRows()).toHaveLength(0);
  });

  it('keeps an original link pinned to its old reviewed version after a new version is appended', async () => {
    const original = await versioned(id(161), 'version one');
    const oldUrl = await issuedUrl(id(161));
    const nextPath = `documents/${ORG_A}/version-two.pdf`;
    state.blobs.set(nextPath, Buffer.from('version two'));
    const appended = await append(id(161), { blobPath: nextPath, contentHash: sha('version two'), expectedVersionNo: 1 });
    expect(appended.status).toBe(200);
    const newUrl = await issuedUrl(id(161));
    const old = await readContent(id(161), oldUrl);
    const current = await readContent(id(161), newUrl);
    expect(old.status).toBe(200);
    expect(current.status).toBe(200);
    expect(Buffer.from(await old.arrayBuffer())).toEqual(original.bytes);
    expect(Buffer.from(await current.arrayBuffer())).toEqual(Buffer.from('version two'));
    expect((await served()).map(row => row.metadata)).toEqual([
      expect.objectContaining({ versionNo: 1, checksumSha256: sha('version one') }),
      expect.objectContaining({ versionNo: 2, checksumSha256: sha('version two') }),
    ]);
  });

  it('rejects another actor, tenant or document before private storage is read', async () => {
    await versioned(id(162), 'publicly shared within this organization', { label: 'public_internal' });
    const url = await issuedUrl(id(162));
    for (const [documentId, actor, organization] of [[id(162), 'another-member', ORG_A], [id(162), USER, ORG_B], [id(163), USER, ORG_A]]) {
      const response = await readContent(documentId, url, actor, organization);
      expect(response.status).toBe(403);
      expect(response.headers.get('content-disposition')).toBeNull();
    }
    expect(state.read).not.toHaveBeenCalled();
    expect(await served()).toHaveLength(0);
  });

  it('rechecks a revoked real SQL grant instead of treating the old link as authority', async () => {
    await versioned(id(164), 'grant-scoped private bytes', { uploadedBy: 'other-uploader' });
    await grant(id(164));
    const url = await issuedUrl(id(164));
    await q("UPDATE document_access_grants SET status='revoked',revoked_at=now() WHERE document_id=$1", [id(164)]);
    expect((await readContent(id(164), url)).status).toBe(403);
    expect(state.read).not.toHaveBeenCalled();
    expect(await served()).toHaveLength(0);
  });

  it('withholds already fetched bytes when the grant is revoked while storage is being read', async () => {
    await versioned(id(165), 'bytes fetched before a revocation', { uploadedBy: 'other-uploader' });
    await grant(id(165));
    const url = await issuedUrl(id(165));
    state.readHook = async () => { await q("UPDATE document_access_grants SET status='revoked',revoked_at=now() WHERE document_id=$1", [id(165)]); };
    const response = await readContent(id(165), url);
    expect(response.status).toBe(403);
    expect(response.headers.get('content-disposition')).toBeNull();
    expect(state.read).toHaveBeenCalledOnce();
    expect(await served()).toHaveLength(0);
  });

  it('withholds bytes if the pinned storage artifact changes during the storage read', async () => {
    await versioned(id(166), 'approved original bytes');
    const url = await issuedUrl(id(166));
    state.readHook = async () => {
      await q('UPDATE document_versions SET storage_key=$2,content_hash=$3 WHERE document_id=$1', [id(166), `documents/${ORG_A}/replacement.pdf`, sha('replacement')]);
    };
    expect((await readContent(id(166), url)).status).toBe(403);
    expect(state.read).toHaveBeenCalledOnce();
    expect(await served()).toHaveLength(0);
  });

  it.each(['bytes differ from the stored hash', 'bytes differ from the stored size'])('releases nothing when %s', async reason => {
    const { path } = await versioned(id(167), 'approved content');
    if (reason.includes('hash')) state.blobs.set(path, Buffer.from('substituted content'));
    else await q('UPDATE document_versions SET metadata=$2::jsonb WHERE document_id=$1', [id(167), JSON.stringify({ sizeBytes: 1 })]);
    const url = await issuedUrl(id(167));
    const response = await readContent(id(167), url);
    expect(response.status).toBe(503);
    expect(response.headers.get('content-disposition')).toBeNull();
    expect(await served()).toHaveLength(0);
  });

  it('checks an oversized stored size before storage and also refuses a bounded-reader overflow', async () => {
    const { path } = await versioned(id(168), 'small original');
    await q('UPDATE document_versions SET metadata=$2::jsonb WHERE document_id=$1', [id(168), JSON.stringify({ sizeBytes: 50 * 1024 * 1024 + 1 })]);
    const oversized = await issuedUrl(id(168));
    expect((await readContent(id(168), oversized)).status).toBe(413);
    expect(state.read).not.toHaveBeenCalled();
    await q('UPDATE document_versions SET metadata=$2::jsonb WHERE document_id=$1', [id(168), JSON.stringify({ sizeBytes: state.blobs.get(path)!.length })]);
    const current = await issuedUrl(id(168));
    state.read.mockRejectedValueOnce(new BlobTooLargeError(50 * 1024 * 1024 + 1, 50 * 1024 * 1024));
    expect((await readContent(id(168), current)).status).toBe(413);
    expect(await served()).toHaveLength(0);
  });

  it('keeps the original capsule expiry before and after a slow storage read', async () => {
    await versioned(id(169), 'expiring private bytes');
    const url = await issuedUrl(id(169));
    const token = new URL(url, 'https://t.test').searchParams.get('lease')!;
    const lease = verifyDocumentDownloadLease(token, { organizationId: ORG_A, userId: USER, documentId: id(169) });
    const originalNow = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(lease.expiresAt);
    try {
      expect((await readContent(id(169), url)).status).toBe(403);
      expect(state.read).not.toHaveBeenCalled();
      clock.mockReturnValue(originalNow);
      state.readHook = () => { clock.mockReturnValue(lease.expiresAt); };
      expect((await readContent(id(169), url)).status).toBe(403);
      expect(state.read).toHaveBeenCalledOnce();
      expect(await served()).toHaveLength(0);
    } finally { clock.mockRestore(); }
  });

  it('releases no bytes when the actual served-access audit insert fails, preserving the original issuance record', async () => {
    await versioned(id(170), 'never release unaudited bytes');
    const url = await issuedUrl(id(170));
    await q('INSERT INTO document_test_audit_faults(document_id,action) VALUES($1,$2)', [id(170), 'document.download_served']);
    const response = await readContent(id(170), url);
    expect(response.status).toBe(503);
    expect(response.headers.get('content-disposition')).toBeNull();
    expect(state.read).toHaveBeenCalledOnce();
    expect(await served()).toHaveLength(0);
    expect((await auditRows()).map(row => row.action)).toEqual(['document.download']);
  });

  it.each([
    { label: 'legacy reference only', storedHash: false, integrityBasis: 'verified_legacy_storage_reference' },
    { label: 'legacy document with a stored hash', storedHash: true, integrityBasis: 'stored_document_hash' },
  ])('preserves truthful compatibility for $label without claiming a version hash', async ({ storedHash, integrityBasis }) => {
    const path = `documents/${ORG_A}/legacy-content.pdf`, bytes = Buffer.from('legacy private bytes');
    state.blobs.set(path, bytes);
    await addDocument(id(171), ORG_A, { fileUrl: `${OWN}/${path}?sig=expired`, ...(storedHash ? { documentHash: sha('legacy private bytes') } : {}) });
    const url = await issuedUrl(id(171));
    const response = await readContent(id(171), url);
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    expect((await served())[0].metadata).toMatchObject({ versionId: null, versionNo: null, integrityBasis, checksumSha256: sha('legacy private bytes') });
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
