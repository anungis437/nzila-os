// External matter document download: the access is durably audited before the storage link leaves the server, the
// link itself is never recorded, and the link is withheld whenever the audit cannot be written. Real PostgreSQL
// semantics (PGlite); the external authorization chain and the blob signer are stood in for.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const ORG = '11111111-1111-4111-8111-111111111111';
const MATTER = '00000000-0000-4000-8000-0000000000a1';
const DOC = '00000000-0000-4000-8000-000000000001';
const REP = 'external-rep-1';

const state = vi.hoisted(() => ({ db: null as unknown, allowed: true, sasFails: false, signed: [] as string[] }));

vi.mock('@/db/db', () => ({ db: new Proxy({}, { get: (_t, p) => { const d = state.db as Record<PropertyKey, unknown> | null; const v = d?.[p]; return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(d) : v; } }) }));
vi.mock('@/lib/external-resource-middleware', () => ({
  withExternalMatterResourceAuth: (_options: unknown, handler: (...args: unknown[]) => unknown) => (request: Request, params?: unknown) =>
    handler(request, {
      actor: { userId: REP, representativeOrganizationId: 'rep-org-1' },
      organizationId: ORG, matterType: 'grievance', matterId: MATTER, authorityId: 'auth-1', matterGrantId: 'grant-1',
    }, params),
}));
vi.mock('@/lib/external-resource-route-utils', () => ({
  badExternalResourceRequest: () => new Response(JSON.stringify({ error: 'bad' }), { status: 400 }),
  externalForbidden: () => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
  resolveExternalDocumentResource: () => ({ organizationId: ORG, matterType: 'grievance', matterId: MATTER }),
}));
vi.mock('@/lib/services/external-resource-authorization-service', () => ({
  authorizeExternalDocumentAccess: async () => ({ allowed: state.allowed }),
}));
vi.mock('@/lib/blob-client', () => ({
  generateSasUrl: async (_container: string, path: string) => {
    if (state.sasFails) throw new Error('storage down');
    state.signed.push(path);
    return `https://uestore.blob.core.windows.net/union-eyes/${path}?sig=SECRET-SIGNATURE`;
  },
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_c: unknown, work: (tx: unknown) => Promise<unknown>) => (state.db as { transaction: (f: (t: unknown) => Promise<unknown>) => Promise<unknown> }).transaction((t) => work(t)),
}));

const { createDocumentDatabase, resetDocumentDatabase } = await import('@/lib/documents/test-support/pglite-document-database');
const { GET: externalDownload } = await import('@/app/api/external/documents/[id]/download/route');

let pg: PGlite;
const q = (text: string, params: unknown[] = []) => pg.query(text, params);
const get = (docId = DOC) => externalDownload(new Request(`https://t.test/api/external/documents/${docId}/download`), { id: docId });
const audit = async () => (await q('SELECT action, user_id, resource_id, metadata FROM audit_security.audit_logs')).rows as Array<{ action: string; user_id: string | null; resource_id: string; metadata: Record<string, unknown> }>;

async function seed(link = true) {
  await q(`INSERT INTO documents (id, organization_id, title, name, filename, file_url, file_type, mime_type, privacy_label, uploaded_by, status)
           VALUES ($1, $2, 'Exhibit', 'Exhibit', 'e.pdf', 'https://x', 'pdf', 'application/pdf', 'team_confidential', 'staff-1', 'active')`, [DOC, ORG]);
  await q(`INSERT INTO document_versions (id, organization_id, document_id, version_no, storage_key, content_hash, uploaded_by)
           VALUES ('00000000-0000-4000-8000-0000000000b1', $1, $2, 1, $3, $4, 'staff-1'), ('00000000-0000-4000-8000-0000000000b2', $1, $2, 2, $5, $4, 'staff-1')`,
    [ORG, DOC, `documents/${ORG}/one`, 'a'.repeat(64), `documents/${ORG}/two`]);
  if (link) await q(`INSERT INTO document_links (id, organization_id, document_id, linked_entity_type, linked_entity_id, linked_by) VALUES (gen_random_uuid(), $1, $2, 'grievance', $3, 'staff-1')`, [ORG, DOC, MATTER]);
}

beforeAll(async () => { pg = await createDocumentDatabase(); state.db = drizzle(pg); });
afterAll(async () => { await pg.close(); });
beforeEach(async () => { await resetDocumentDatabase(pg); state.allowed = true; state.sasFails = false; state.signed.length = 0; });

describe('external matter document download', () => {
  it('records principal, organization, matter, document and version durably, then returns the link', async () => {
    await seed();
    const response = await get();
    expect(response.status).toBe(200);
    expect((await response.json()).data.downloadUrl).toContain('SECRET-SIGNATURE');
    const rows = await audit();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'document.external_download', user_id: REP, resource_id: DOC });
    expect(rows[0].metadata).toMatchObject({
      actorKind: 'external_representative', representativeOrganizationId: 'rep-org-1', authorityId: 'auth-1', matterGrantId: 'grant-1',
      matterType: 'grievance', matterId: MATTER, documentId: DOC, versionNo: 2,
    });
    expect(rows[0].metadata.versionId).toBe('00000000-0000-4000-8000-0000000000b2');
    expect(state.signed).toEqual([`documents/${ORG}/two`]);
  });

  it('never persists the link, its signature or the storage path', async () => {
    await seed();
    await get();
    const text = JSON.stringify(await audit());
    expect(text).not.toContain('SECRET-SIGNATURE');
    expect(text).not.toContain('sig=');
    expect(text).not.toContain(`documents/${ORG}`);
  });

  it('withholds the link when the mandatory audit cannot be written', async () => {
    await seed();
    await q(`INSERT INTO audit_fault_actions(action) VALUES ('document.external_download')`);
    const response = await get();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('SECRET-SIGNATURE');
    expect(await audit()).toHaveLength(0);
  });

  it('records no access when no link could be issued', async () => {
    await seed();
    state.sasFails = true;
    const response = await get();
    expect(response.status).toBe(503);
    expect(await audit()).toHaveLength(0);
  });

  it('issues nothing and records nothing when the external authorization chain refuses', async () => {
    await seed();
    state.allowed = false;
    const response = await get();
    expect(response.status).toBe(403);
    expect(state.signed).toEqual([]);
    expect(await audit()).toHaveLength(0);
  });

  it('issues nothing for a document that is not linked to the authorized matter', async () => {
    await seed(false);
    const response = await get();
    expect(response.status).toBe(404);
    expect(state.signed).toEqual([]);
    expect(await audit()).toHaveLength(0);
  });
});
