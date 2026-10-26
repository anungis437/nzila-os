// POST /api/documents/[id]/ocr (Contract 3) against real PostgreSQL semantics (PGlite): the processing authority is
// resolved from the kernel, the document's classification and its grants; the extraction is read from the exact bytes
// the version hash names; and the machine revision commits with its audit record or not at all. The case kernel, the
// blob store and the text extractor are stood in for; this is not a substitute for real OCR bytes on a deployment.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const DOC = '00000000-0000-4000-8000-000000000001';
const CASE = '00000000-0000-4000-8000-0000000000c1';
const UPLOADER = 'member-uploader';
const PEER = 'member-peer';

type Kernel = { isPrimaryOwner: boolean; canViewCase: boolean; canViewPrivateDocuments: boolean; canProcessOcr: boolean; canModifyDocuments: boolean; canUploadDocuments: boolean };
const NO_KERNEL: Kernel = { isPrimaryOwner: false, canViewCase: false, canViewPrivateDocuments: false, canProcessOcr: false, canModifyDocuments: false, canUploadDocuments: false };

const state = vi.hoisted(() => ({
  db: null as unknown,
  blobs: new Map<string, Buffer>(),
  kernel: null as unknown,
  extractor: null as null | (() => Promise<unknown>),
  extractCalls: 0,
}));
state.kernel = NO_KERNEL;

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: (handler: (...args: unknown[]) => unknown) => handler }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: vi.fn(async () => undefined) }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: async (role: string) => role === 'member' }));
vi.mock('@/db/db', () => ({ db: new Proxy({}, { get: (_t, p) => { const d = state.db as Record<PropertyKey, unknown> | null; const v = d?.[p]; return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(d) : v; } }) }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_c: unknown, work: (tx: unknown) => Promise<unknown>) => (state.db as { transaction: (f: (t: unknown) => Promise<unknown>) => Promise<unknown> }).transaction((t) => work(t)),
}));
vi.mock('@/lib/services/case-access-service', () => ({ getEffectiveCaseAccess: async () => state.kernel }));
vi.mock('@/lib/blob-client', () => ({
  downloadBuffer: async (_container: string, path: string) => { const b = state.blobs.get(path); if (!b) throw new Error('BlobNotFound'); return b; },
  computeSha256: (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex'),
}));
vi.mock('@/lib/documents/ocr-extract', () => ({
  extractTextFromBytes: async (bytes: Buffer) => {
    state.extractCalls += 1;
    if (state.extractor) return state.extractor();
    return { text: `text of ${bytes.toString()}`, confidence: 0.9, language: 'en', engine: 'test-engine', engineVersion: '1', metadata: {} };
  },
}));

const { createDocumentDatabase, resetDocumentDatabase } = await import('@/lib/documents/test-support/pglite-document-database');
const { POST: ocr } = await import('@/app/api/documents/[id]/ocr/route');

let pg: PGlite;
const q = (text: string, params: unknown[] = []) => pg.query(text, params);
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const KEY = `documents/${ORG}/file-1`;
const run = (userId = PEER, docId = DOC, organizationId = ORG) =>
  ocr(new Request(`https://t.test/api/documents/${docId}/ocr`, { method: 'POST' }) as never, { organizationId, userId }, { id: docId });
const revisionCount = async () => (await q('SELECT 1 FROM document_transcript_revisions')).rows.length;
const audits = async () => (await q('SELECT action FROM audit_security.audit_logs')).rows.map((r) => (r as { action: string }).action);

async function seed(opts: { label?: string; linked?: boolean; bytes?: string; hashOf?: string; org?: string } = {}) {
  const bytes = opts.bytes ?? 'scan';
  state.blobs.set(KEY, Buffer.from(bytes));
  await q(`INSERT INTO documents (id, organization_id, title, name, filename, file_url, file_type, mime_type, privacy_label, uploaded_by, status)
           VALUES ($1, $2, 'T', 'T', 'f.pdf', 'https://x', 'pdf', 'application/pdf', $3, $4, 'active')`, [DOC, opts.org ?? ORG, opts.label ?? 'team_confidential', UPLOADER]);
  await q(`INSERT INTO document_versions (id, organization_id, document_id, version_no, storage_key, content_hash, uploaded_by)
           VALUES (gen_random_uuid(), $1, $2, 1, $3, $4, $5)`, [opts.org ?? ORG, DOC, KEY, sha(opts.hashOf ?? bytes), UPLOADER]);
  if (opts.linked) await q(`INSERT INTO document_links (id, organization_id, document_id, linked_entity_type, linked_entity_id, linked_by) VALUES (gen_random_uuid(), $1, $2, 'grievance', $3, $4)`, [ORG, DOC, CASE, UPLOADER]);
}

async function grant(userId: string, over: { canProcessOcr?: boolean; status?: string; expired?: boolean; revoked?: boolean } = {}) {
  await q(`INSERT INTO document_access_grants (id, organization_id, document_id, user_id, status, can_view, can_download, can_process_ocr, revoked_at, expires_at, granted_by)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, true, true, $5, $6, $7, 'staff-1')`,
    [ORG, DOC, userId, over.status ?? 'active', over.canProcessOcr ?? false, over.revoked ? new Date().toISOString() : null, over.expired ? new Date(Date.now() - 60_000).toISOString() : null]);
}

beforeAll(async () => { process.env.AZURE_STORAGE_ACCOUNT_NAME = 'uestore'; pg = await createDocumentDatabase(); state.db = drizzle(pg); });
afterAll(async () => { await pg.close(); });
beforeEach(async () => { await resetDocumentDatabase(pg); state.blobs.clear(); state.kernel = NO_KERNEL; state.extractor = null; state.extractCalls = 0; });

describe('who may process', () => {
  it('denies a document’s own uploader until the institution adopts a member policy', async () => {
    await seed();
    expect((await run(UPLOADER)).status).toBe(403);
    expect(state.extractCalls).toBe(0);
    expect(await revisionCount()).toBe(0);
  });

  it('denies a peer with only a view grant, however it was obtained', async () => {
    await seed();
    await grant(PEER, { canProcessOcr: false });
    expect((await run()).status).toBe(403);
    expect(state.extractCalls).toBe(0);
  });

  it('allows an unlinked document to be processed under an explicit processing grant, as a machine draft', async () => {
    await seed();
    await grant(PEER, { canProcessOcr: true });
    const response = await run();
    expect(response.status).toBe(200);
    const body = (await response.json()).data;
    expect(body).toMatchObject({ documentId: DOC, revisionNo: 1, state: 'machine_extraction', text: 'text of scan', authoritative: false, reviewRequired: true, created: true });
    expect(JSON.stringify(body)).not.toContain(KEY);
    expect(await revisionCount()).toBe(1);
    expect(await audits()).toEqual(['document.ocr.extract']);
    // The original is unchanged: its text column was never written.
    expect((await q('SELECT content_text FROM documents')).rows).toEqual([{ content_text: null }]);
  });

  it('refuses expired, revoked and inactive processing grants', async () => {
    await seed();
    await grant(PEER, { canProcessOcr: true, expired: true });
    await grant(PEER, { canProcessOcr: true, revoked: true });
    await grant(PEER, { canProcessOcr: true, status: 'revoked' });
    expect((await run()).status).toBe(403);
    expect(state.extractCalls).toBe(0);
  });

  it('allows a linked document under the kernel’s case:process_ocr, and only with a live case relationship', async () => {
    await seed({ linked: true });
    state.kernel = { ...NO_KERNEL, canViewCase: true, canViewPrivateDocuments: true, canProcessOcr: true };
    expect((await run()).status).toBe(200);
  });

  it('refuses a case participant who can view but not process, and a former participant whose relationship ended', async () => {
    await seed({ linked: true });
    state.kernel = { ...NO_KERNEL, canViewCase: true, canViewPrivateDocuments: true };
    expect((await run()).status).toBe(403);
    // Recusal, revocation or expiry remove canViewCase; a processing grant does not bring it back.
    await grant(PEER, { canProcessOcr: true });
    state.kernel = { ...NO_KERNEL, canViewCase: false, canProcessOcr: true };
    expect((await run()).status).toBe(403);
    expect(state.extractCalls).toBe(0);
  });

  it('lets a processing grant work on a linked case only for someone who still has a live case relationship', async () => {
    await seed({ linked: true });
    await grant(PEER, { canProcessOcr: true });
    state.kernel = { ...NO_KERNEL, canViewCase: true, canViewPrivateDocuments: true };
    expect((await run()).status).toBe(200);
  });

  it('never widens visibility: a restricted classification stays closed without the access the policy requires', async () => {
    await seed({ label: 'highly_sensitive', linked: true });
    state.kernel = { ...NO_KERNEL, canViewCase: true, canProcessOcr: true };
    expect((await run()).status).toBe(403);
    expect(state.extractCalls).toBe(0);
  });

  it('does not reveal another organization’s document, and refuses a malformed identifier', async () => {
    await seed({ org: OTHER_ORG });
    expect((await run()).status).toBe(404);
    expect((await run(PEER, 'not-a-uuid')).status).toBe(400);
  });
});

describe('what is recorded, and when text is withheld', () => {
  beforeEach(async () => { await seed(); await grant(PEER, { canProcessOcr: true }); });

  it('processes a version once: a repeat returns the recorded extraction and writes nothing more', async () => {
    await run();
    const again = await run();
    expect((await again.json()).data).toMatchObject({ created: false, revisionNo: 1 });
    expect(await revisionCount()).toBe(1);
    expect(await audits()).toEqual(['document.ocr.extract']);
  });

  it('withholds the text and records nothing when the mandatory audit cannot be written', async () => {
    await q(`INSERT INTO audit_fault_actions(action) VALUES ('document.ocr.extract')`);
    const response = await run();
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('text of scan');
    expect(await revisionCount()).toBe(0);
  });

  it('refuses to extract from bytes that are not the version’s recorded content', async () => {
    state.blobs.set(KEY, Buffer.from('substituted'));
    const response = await run();
    expect(response.status).toBe(409);
    expect(state.extractCalls).toBe(0);
    expect(await revisionCount()).toBe(0);
  });

  it('hides processor and storage failures and reports unsupported types as not implemented', async () => {
    state.extractor = async () => { throw new Error('OCR_UNSUPPORTED'); };
    expect((await run()).status).toBe(501);
    state.extractor = async () => { throw new Error('engine crashed at documents/secret'); };
    const failed = await run();
    expect(failed.status).toBe(502);
    expect(JSON.stringify(await failed.json())).not.toContain('documents/secret');
    state.extractor = null;
    state.blobs.clear();
    expect((await run()).status).toBe(502);
    expect(await revisionCount()).toBe(0);
  });

  it('refuses a storage location outside the organization', async () => {
    await q(`UPDATE document_versions SET storage_key = 'documents/other-org/file'`);
    expect((await run()).status).toBe(502);
    expect(state.extractCalls).toBe(0);
  });
});
