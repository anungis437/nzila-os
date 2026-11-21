// External matter document download: the route serves the file itself (no bearer link), the access is durably audited before any byte
// leaves the server and names the bytes delivered, the bytes are withheld whenever the audit cannot be written, and a refused grant
// releases nothing. Real SQL semantics and legacy authorization queries/evaluator run; identity/context and blob transport are synthetic.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { createHash } from 'node:crypto';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import * as representationSchema from '@/db/schema/representation-authority-schema';

const ORG = '11111111-1111-4111-8111-111111111111';
const MATTER = '00000000-0000-4000-8000-0000000000a1';
const DOC = '00000000-0000-4000-8000-000000000001';
const REP = 'external-rep-1';
const AUTHORITY = '00000000-0000-4000-8000-0000000000c1';
const MATTER_GRANT = '00000000-0000-4000-8000-0000000000c2';
const DOCUMENT_GRANT = '00000000-0000-4000-8000-0000000000c3';
const REP_ORG = '00000000-0000-4000-8000-0000000000c4';
const FILE_BYTES = Buffer.from('FILE-BYTES-0123');
const FILE_HASH = createHash('sha256').update(FILE_BYTES).digest('hex');

const state = vi.hoisted(() => ({ db: null as unknown, allowed: true, sasFails: false, tooLarge: false, signed: [] as string[],
  afterRead: null as null | (() => Promise<void>), replacement: null as Buffer | null }));

vi.mock('@/db/db', () => ({ db: new Proxy({}, { get: (_t, p) => { const d = state.db as Record<PropertyKey, unknown> | null; const v = d?.[p]; return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(d) : v; } }) }));
vi.mock('@/lib/external-resource-middleware', () => ({
  withExternalMatterResourceAuth: (_options: unknown, handler: (...args: unknown[]) => unknown) => (request: Request, params?: unknown) =>
    handler(request, {
      actor: { userId: REP, representativeOrganizationId: REP_ORG },
      organizationId: ORG, matterType: 'grievance', matterId: MATTER, authorityId: AUTHORITY, matterGrantId: MATTER_GRANT,
    }, params),
}));
vi.mock('@/lib/external-resource-route-utils', () => ({
  badExternalResourceRequest: () => new Response(JSON.stringify({ error: 'bad' }), { status: 400 }),
  externalForbidden: () => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
  resolveExternalDocumentResource: () => ({ organizationId: ORG, matterType: 'grievance', matterId: MATTER }),
}));
vi.mock('@/lib/blob-client', () => {
  class BlobTooLargeError extends Error {}
  return {
    BlobTooLargeError,
    readBlobBounded: async (path: string) => {
      if (state.sasFails) throw new Error('storage down');
      if (state.tooLarge) throw new BlobTooLargeError('too large');
      state.signed.push(path);
      await state.afterRead?.();
      return state.replacement ?? Buffer.from('FILE-BYTES-0123');
    },
  };
});
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_c: unknown, work: (tx: unknown) => Promise<unknown>) => (state.db as { transaction: (f: (t: unknown) => Promise<unknown>) => Promise<unknown> }).transaction((t) => work(t)),
}));

const { createDocumentDatabase, resetDocumentDatabase } = await import('@/lib/documents/test-support/pglite-document-database');
const { GET: externalDownload } = await import('@/app/api/external/documents/[id]/download/route');

let pg: PGlite;
const q = (text: string, params: unknown[] = []) => pg.query(text, params);
const get = async (docId = DOC) => {
  if (!state.allowed) await q("UPDATE external_document_access_grants SET status='revoked',revoked_at=now() WHERE id=$1", [DOCUMENT_GRANT]);
  return externalDownload(new Request(`https://t.test/api/external/documents/${docId}/download`), { id: docId });
};
const audit = async () => (await q('SELECT action, user_id, resource_id, metadata FROM audit_security.audit_logs')).rows as Array<{ action: string; user_id: string | null; resource_id: string; metadata: Record<string, unknown> }>;

async function seed(link = true) {
  await q(`INSERT INTO representation_authorities(id,organization_id,matter_type,matter_id,represented_person_id,representative_user_id,representative_organization_id,
    scope,source,status,effective_at,expires_at,created_by) VALUES($1,$2,'grievance',$3,gen_random_uuid(),$4,$5,ARRAY['view','documents'],'Synthetic existing external authority','active',now()-interval '1 hour',now()+interval '1 hour','staff-1')`, [AUTHORITY, ORG, MATTER, REP, REP_ORG]);
  await q(`INSERT INTO external_matter_access_grants(id,authority_id,organization_id,matter_type,matter_id,user_id,representative_organization_id,can_view_documents,can_download_documents,granted_by,expires_at)
    VALUES($1,$2,$3,'grievance',$4,$5,$6,true,true,'staff-1',now()+interval '1 hour')`, [MATTER_GRANT, AUTHORITY, ORG, MATTER, REP, REP_ORG]);
  await q(`INSERT INTO documents (id, organization_id, title, name, filename, file_url, file_type, mime_type, privacy_label, uploaded_by, status)
           VALUES ($1, $2, 'Exhibit', 'Exhibit', 'e.pdf', 'https://x', 'pdf', 'application/pdf', 'team_confidential', 'staff-1', 'active')`, [DOC, ORG]);
  await q(`INSERT INTO document_versions (id, organization_id, document_id, version_no, storage_key, content_hash, uploaded_by)
           VALUES ('00000000-0000-4000-8000-0000000000b1', $1, $2, 1, $3, $4, 'staff-1'), ('00000000-0000-4000-8000-0000000000b2', $1, $2, 2, $5, $4, 'staff-1')`,
    [ORG, DOC, `documents/${ORG}/one`, FILE_HASH, `documents/${ORG}/two`]);
  await q('UPDATE document_versions SET metadata=$1', [{ sizeBytes: FILE_BYTES.length }]);
  await q(`INSERT INTO external_document_access_grants(id,authority_id,matter_grant_id,organization_id,matter_type,matter_id,document_id,user_id,representative_organization_id,
    can_view,can_download,document_version_no,granted_by,expires_at) VALUES($1,$2,$3,$4,'grievance',$5,$6,$7,$8,true,true,2,'staff-1',now()+interval '1 hour')`,
  [DOCUMENT_GRANT, AUTHORITY, MATTER_GRANT, ORG, MATTER, DOC, REP, REP_ORG]);
  if (link) await q(`INSERT INTO document_links (id, organization_id, document_id, linked_entity_type, linked_entity_id, linked_by) VALUES (gen_random_uuid(), $1, $2, 'grievance', $3, 'staff-1')`, [ORG, DOC, MATTER]);
}

beforeAll(async () => {
  pg = await createDocumentDatabase(); state.db = drizzle(pg);
  const ddl = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(representationSchema));
  for (const statement of ddl.filter(sql => !sql.startsWith('ALTER TABLE'))) await pg.exec(statement);
});
afterAll(async () => { await pg.close(); });
beforeEach(async () => {
  await pg.exec('DELETE FROM external_document_access_grants;DELETE FROM external_matter_access_grants;DELETE FROM representation_authorities');
  await resetDocumentDatabase(pg); state.allowed = true; state.sasFails = false; state.tooLarge = false; state.signed.length = 0;
  state.afterRead = null; state.replacement = null;
});

describe('external matter document download', () => {
  it('records principal, organization, matter, document, version and bytes delivered durably, then serves the file', async () => {
    await seed();
    const response = await get();
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('FILE-BYTES-0123');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-disposition')).toBe("attachment; filename*=UTF-8''e.pdf");
    expect(response.headers.get('content-type')).toBe('application/pdf');
    const rows = await audit();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'document.external_download', user_id: REP, resource_id: DOC });
    expect(rows[0].metadata).toMatchObject({
      actorKind: 'external_representative', representativeOrganizationId: REP_ORG, authorityId: AUTHORITY, matterGrantId: MATTER_GRANT,
      matterType: 'grievance', matterId: MATTER, documentId: DOC, versionNo: 2, delivery: 'served_by_route', sizeBytes: 15,
    });
    expect(rows[0].metadata.versionId).toBe('00000000-0000-4000-8000-0000000000b2');
    expect(state.signed).toEqual([`documents/${ORG}/two`]);
  });

  it('hands over no storage link and records neither the bytes nor the storage path', async () => {
    await seed();
    const response = await get();
    const body = Buffer.from(await response.arrayBuffer()).toString();
    expect(body).not.toContain('http');
    expect(body).not.toContain('sig=');
    const text = JSON.stringify(await audit());
    expect(text).not.toContain('FILE-BYTES');
    expect(text).not.toContain(`documents/${ORG}`);
  });

  it('withholds the bytes when the mandatory audit cannot be written', async () => {
    await seed();
    await q(`INSERT INTO audit_fault_actions(action) VALUES ('document.external_download')`);
    const response = await get();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('FILE-BYTES');
    expect(await audit()).toHaveLength(0);
  });

  it('records no access when the file could not be read', async () => {
    await seed();
    state.sasFails = true;
    const response = await get();
    expect(response.status).toBe(503);
    expect(await audit()).toHaveLength(0);
  });

  it('refuses a file over the streamed-read limit and records no access', async () => {
    await seed();
    state.tooLarge = true;
    const response = await get();
    expect(response.status).toBe(413);
    expect(await audit()).toHaveLength(0);
  });

  it('releases nothing and records a denial instead of successful access when the actual authorization chain refuses', async () => {
    await seed();
    state.allowed = false;
    const response = await get();
    expect(response.status).toBe(403);
    expect(state.signed).toEqual([]);
    const rows = await audit();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'external_authorization.denied', metadata: { reason: 'document_grant_missing' } });
  });

  it('issues nothing for a document that is not linked to the authorized matter', async () => {
    await seed(false);
    const response = await get();
    expect(response.status).toBe(404);
    expect(state.signed).toEqual([]);
    expect(await audit()).toHaveLength(0);
  });

  it('rechecks the actual grant after storage and withholds bytes after revocation or expiry', async () => {
    for (const change of ["status='revoked',revoked_at=now()", "expires_at=now()-interval '1 second'"]) {
      await pg.exec('DELETE FROM external_document_access_grants;DELETE FROM external_matter_access_grants;DELETE FROM representation_authorities');
      await resetDocumentDatabase(pg); await seed(); state.signed.length = 0;
      state.afterRead = async () => { await q(`UPDATE external_document_access_grants SET ${change} WHERE id=$1`, [DOCUMENT_GRANT]); };
      const response = await get();
      expect(response.status).toBe(403); expect(await response.text()).not.toContain('FILE-BYTES');
      expect((await audit()).filter(row => row.action === 'document.external_download')).toHaveLength(0);
    }
  });

  it.each([
    "UPDATE external_document_access_grants SET document_version_no=1",
    "UPDATE document_versions SET storage_key='substituted' WHERE version_no=2",
    "UPDATE document_versions SET content_hash=repeat('b',64) WHERE version_no=2",
    "UPDATE document_versions SET metadata='{\"sizeBytes\":1}' WHERE version_no=2",
    "DELETE FROM document_links",
  ])('releases no bytes after source changes during storage: %s', async statement => {
    await seed(); state.afterRead = async () => { await q(statement); };
    const response = await get();
    expect(response.status).toBe(403); expect(await response.text()).not.toContain('FILE-BYTES');
    expect((await audit()).filter(row => row.action === 'document.external_download')).toHaveLength(0);
  });

  it('refuses changed actual bytes and records no successful release', async () => {
    await seed(); state.replacement = Buffer.from('DIFFERENT BYTES');
    const response = await get(); expect(response.status).toBe(503);
    expect((await audit()).filter(row => row.action === 'document.external_download')).toHaveLength(0);
  });
});
