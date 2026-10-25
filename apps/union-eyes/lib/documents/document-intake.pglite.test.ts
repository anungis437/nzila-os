// Temporary document intake (Contract 1) and repository create/version acceptance (Contract 2) against real PostgreSQL
// semantics (PGlite): the actual platform migration 0022 (its CHECKs, unique indexes and plpgsql guard triggers), real
// transactions and row locks, real audit persistence, and fault injection at the audit table. Only the object store,
// the case kernel and the session are stood in for. PGlite has no runtime roles, so row-level security is not
// exercised here; tenant isolation is asserted through the explicit organization predicates every query carries.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const USER = 'member-1';
const OTHER = 'member-2';

const state = vi.hoisted(() => ({
  db: null as unknown,
  blobs: new Map<string, Buffer>(),
  removed: [] as string[],
  putFails: false,
  removeFails: false,
  storage: null as unknown as {
    put: (key: string, bytes: Buffer, type: string) => Promise<void>;
    read: (key: string) => Promise<Buffer>;
    remove: (key: string) => Promise<void>;
  },
}));

state.storage = {
  put: async (key, bytes) => {
    if (state.putFails) throw new Error('scanner unavailable');
    state.blobs.set(key, bytes);
  },
  read: async (key) => {
    const blob = state.blobs.get(key);
    if (!blob) throw new Error('BlobNotFound');
    return blob;
  },
  remove: async (key) => {
    state.removed.push(key);
    if (state.removeFails) throw new Error('storage unavailable documents/secret/path');
    state.blobs.delete(key);
  },
};

vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: (handler: (...args: unknown[]) => unknown) => handler,
}));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: vi.fn(async () => undefined) }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: async (role: string) => role === 'member' }));
vi.mock('@/db/db', () => ({
  db: new Proxy({}, {
    get(_target, property) {
      const database = state.db as Record<PropertyKey, unknown> | null;
      const value = database ? database[property] : undefined;
      return typeof value === 'function' ? value.bind(database) : value;
    },
  }),
}));
vi.mock('@/lib/db/with-rls-context', () => {
  const run = async (work: (tx: unknown) => Promise<unknown>) =>
    (state.db as { transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> }).transaction((tx) => work(tx));
  return {
    withRLSContext: async (_context: unknown, work: (tx: unknown) => Promise<unknown>) => run(work),
    withSystemContext: async (work: (tx: unknown) => Promise<unknown>) => run(work),
  };
});
vi.mock('@/lib/services/case-access-service', () => ({
  getEffectiveCaseAccess: async () => ({ isPrimaryOwner: false, canViewCase: true, canViewPrivateDocuments: false, canModifyDocuments: false, canUploadDocuments: false }),
}));
vi.mock('@/lib/documents/intake-storage', () => ({ blobIntakeStorage: state.storage }));
vi.mock('@/lib/blob-client', () => ({
  generateSasUrl: async (container: string, path: string) => `https://uestore.blob.core.windows.net/${container}/${path}?sig=test`,
  downloadBuffer: async (_container: string, path: string) => {
    const blob = state.blobs.get(path);
    if (!blob) throw new Error('BlobNotFound');
    return blob;
  },
  computeSha256: (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex'),
}));

const lifecycle = await import('@/lib/documents/intake-lifecycle');
const { POST: createDocument } = await import('@/app/api/documents/repository/route');
const { POST: appendVersion } = await import('@/app/api/documents/repository/[id]/versions/route');
const { createDocumentDatabase, resetDocumentDatabase } = await import('@/lib/documents/test-support/pglite-document-database');

const { openIntake, checkIntakeForAcceptance, bindIntakeInTx, cancelIntake, expireDueIntakes, finalizeIntakeObjects, runIntakeReaper, IntakeConflictError, INTAKE_MAX_DELETION_ATTEMPTS } = lifecycle;

let pg: PGlite;
const q = (text: string, params: unknown[] = []) => pg.query(text, params);
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const database = () => state.db as ReturnType<typeof drizzle> & { transaction: ReturnType<typeof drizzle>['transaction'] };
const minutes = (n: number) => n * 60_000;

const auditActions = async () => (await q(`SELECT action FROM audit_security.audit_logs`)).rows.map((row) => (row as { action: string }).action).sort();
const failAudit = async (action: string) => { await q(`INSERT INTO audit_fault_actions(action) VALUES ($1)`, [action]); };
const intakeRow = async (intakeId: string) => (await q(`SELECT * FROM document_intakes WHERE id = $1`, [intakeId])).rows[0] as Record<string, unknown>;

async function addDocument(docId: string, org = ORG_A, uploadedBy = USER) {
  await q(
    `INSERT INTO documents (id, organization_id, title, name, filename, file_url, file_type, mime_type, privacy_label, uploaded_by, status)
     VALUES ($1, $2, 'T', 'T', 'f.pdf', 'https://uestore.blob.core.windows.net/union-eyes/legacy', 'pdf', 'application/pdf', 'team_confidential', $3, 'active')`,
    [docId, org, uploadedBy],
  );
}

const open = (bytes: string | Buffer, extra: Partial<Parameters<typeof openIntake>[0]> = {}) =>
  openIntake(
    { organizationId: ORG_A, userId: USER, operation: 'create_document', filename: 'a.pdf', mimeType: 'application/pdf', bytes: Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes), ...extra },
    state.storage,
  );

async function openOk(bytes: string | Buffer, extra: Partial<Parameters<typeof openIntake>[0]> = {}) {
  const result = await open(bytes, extra);
  if (!result.ok) throw new Error(`intake not opened: ${result.kind}`);
  const row = await intakeRow(result.intake.intakeId);
  return { view: result.intake, key: row.storage_key as string, hash: row.content_hash as string };
}

/** What the create/version routes do in their transaction: a version that holds the key, then the bind. */
const acceptInTx = (intakeId: string, docId: string, versionNo = 1, org = ORG_A, user = USER) =>
  database().transaction(async (tx) => {
    // Inside the transaction every statement must go through tx: PGlite serialises on one connection.
    const rows = (await tx.execute(sql`SELECT storage_key, content_hash FROM document_intakes WHERE id = ${intakeId}`)) as unknown as { rows: Array<{ storage_key: string; content_hash: string }> };
    const row = rows.rows[0];
    const versionId = crypto.randomUUID();
    await tx.execute(sql`INSERT INTO document_versions (id, organization_id, document_id, version_no, storage_key, content_hash, uploaded_by)
                         VALUES (${versionId}, ${org}, ${docId}, ${versionNo}, ${row.storage_key}, ${row.content_hash}, ${user})`);
    await bindIntakeInTx(tx as never, { organizationId: org, userId: user, intakeId, documentId: docId, versionId });
    return versionId;
  });

const post = (body: Record<string, unknown>, user = USER) =>
  createDocument(new Request('https://t.test/api/documents/repository', { method: 'POST', body: JSON.stringify(body) }), { organizationId: ORG_A, userId: user });
const append = (docId: string, body: Record<string, unknown>, user = USER) =>
  appendVersion(new Request(`https://t.test/api/documents/repository/${docId}/versions`, { method: 'POST', body: JSON.stringify(body) }), { organizationId: ORG_A, userId: user }, { id: docId });
const createBody = (intakeId: string, extra: Record<string, unknown> = {}) => ({
  title: 'Filed', filename: 'a.pdf', intakeId, documentType: 'ocr_upload', privacyLabel: 'team_confidential', ...extra,
});

beforeAll(async () => {
  process.env.AZURE_STORAGE_ACCOUNT_NAME = 'uestore';
  delete process.env.UE_CANONICAL_BOOTSTRAP_V2;
  pg = await createDocumentDatabase();
  state.db = drizzle(pg);
});

afterAll(async () => { await pg.close(); });

beforeEach(async () => {
  await resetDocumentDatabase(pg);
  state.blobs.clear();
  state.removed.length = 0;
  state.putFails = false;
  state.removeFails = false;
});

describe('intake open', () => {
  it('records the row before the object, under a server-issued key the client never sees', async () => {
    const { view, key, hash } = await openOk('hello');
    const row = await intakeRow(view.intakeId);
    expect(row).toMatchObject({ status: 'open', object_state: 'present', principal_user_id: USER, organization_id: ORG_A, operation: 'create_document', mime_type: 'application/pdf' });
    expect(Number(row.size_bytes)).toBe(5);
    expect(hash).toBe(sha('hello'));
    expect(key).toMatch(new RegExp(`^documents/${ORG_A}/intake/${view.intakeId}/[0-9a-f]{16}$`));
    expect(state.blobs.get(key)?.toString()).toBe('hello');
    expect(JSON.stringify(view)).not.toContain(key);
    expect(Object.keys(view)).not.toContain('storageKey');
    expect(await auditActions()).toEqual(['document.intake.open']);
  });

  it('closes the row when the object cannot be stored, so nothing can ever accept it', async () => {
    state.putFails = true;
    const result = await open('bytes');
    expect(result).toMatchObject({ ok: false, kind: 'upload_failed' });
    const [row] = (await q(`SELECT status, object_state FROM document_intakes`)).rows as Array<{ status: string; object_state: string }>;
    expect(row).toEqual({ status: 'cancelled', object_state: 'deleted' });
    expect(state.blobs.size).toBe(0);
    expect(await auditActions()).toEqual(['document.intake.cancel', 'document.intake.open']);
  });

  it('stores no object when the audit record cannot be written', async () => {
    await failAudit('document.intake.open');
    await expect(open('bytes')).rejects.toThrow();
    expect((await q(`SELECT 1 FROM document_intakes`)).rows).toHaveLength(0);
    expect(state.blobs.size).toBe(0);
  });

  it('rejects empty files and a target that does not match the operation', async () => {
    expect(await open(Buffer.alloc(0))).toMatchObject({ ok: false, kind: 'invalid' });
    expect(await open('x', { operation: 'append_version' })).toMatchObject({ ok: false, kind: 'invalid' });
    expect(await open('x', { operation: 'create_document', targetDocumentId: id(1) })).toMatchObject({ ok: false, kind: 'invalid' });
  });
});

describe('acceptance check', () => {
  const check = (intakeId: string, extra: Record<string, unknown> = {}) =>
    checkIntakeForAcceptance({ organizationId: ORG_A, userId: USER, intakeId, operation: 'create_document', ...extra }, state.storage);

  it('accepts the principal’s own open intake whose object is unchanged', async () => {
    const { view } = await openOk('hello');
    expect(await check(view.intakeId)).toMatchObject({ ok: true, replay: false });
  });

  it('treats another principal’s or another organization’s intake as not found', async () => {
    const { view } = await openOk('hello');
    expect(await check(view.intakeId, { userId: OTHER })).toEqual({ ok: false, kind: 'not_found' });
    expect(await check(view.intakeId, { organizationId: ORG_B })).toEqual({ ok: false, kind: 'not_found' });
    expect(await check(id(404))).toEqual({ ok: false, kind: 'not_found' });
  });

  it('refuses a different operation or target', async () => {
    const { view } = await openOk('hello');
    expect(await check(view.intakeId, { operation: 'append_version', targetDocumentId: id(1) })).toEqual({ ok: false, kind: 'operation_mismatch' });
  });

  it('refuses an expired intake and one whose object was replaced or removed', async () => {
    const old = await openOk('old', { now: new Date(Date.now() - minutes(120)) });
    expect(await check(old.view.intakeId)).toMatchObject({ ok: false, kind: 'expired' });

    const swapped = await openOk('original');
    state.blobs.set(swapped.key, Buffer.from('substituted'));
    expect(await check(swapped.view.intakeId)).toEqual({ ok: false, kind: 'object_changed' });

    const gone = await openOk('gone');
    state.blobs.delete(gone.key);
    expect(await check(gone.view.intakeId)).toEqual({ ok: false, kind: 'object_missing' });
  });
});

describe('acceptance binds atomically, once', () => {
  it('binds the intake to the version that holds its object and writes the audit record', async () => {
    await addDocument(id(1));
    const { view } = await openOk('hello');
    const versionId = await acceptInTx(view.intakeId, id(1));
    expect(await intakeRow(view.intakeId)).toMatchObject({ status: 'accepted', object_state: 'attached', accepted_document_id: id(1), accepted_version_id: versionId });
    expect(await auditActions()).toEqual(['document.intake.accept', 'document.intake.open']);
  });

  it('returns the original result to a replay without writing again', async () => {
    await addDocument(id(1));
    const { view } = await openOk('hello');
    await acceptInTx(view.intakeId, id(1));
    const replay = await checkIntakeForAcceptance({ organizationId: ORG_A, userId: USER, intakeId: view.intakeId, operation: 'create_document' }, state.storage);
    expect(replay).toMatchObject({ ok: true, replay: true });
  });

  it('lets exactly one of two concurrent acceptances win and rolls the loser back completely', async () => {
    await addDocument(id(1));
    await addDocument(id(2));
    const { view } = await openOk('hello');
    const outcomes = await Promise.allSettled([acceptInTx(view.intakeId, id(1)), acceptInTx(view.intakeId, id(2))]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const loser = outcomes.find((outcome) => outcome.status === 'rejected') as PromiseRejectedResult;
    // The conflict is either the application's (row no longer open) or the database's (unique key / guard trigger).
    expect(loser.reason).toBeTruthy();
    expect((await q(`SELECT 1 FROM document_versions`)).rows).toHaveLength(1);
    expect((await q(`SELECT 1 FROM audit_security.audit_logs WHERE action = 'document.intake.accept'`)).rows).toHaveLength(1);
  });

  it('refuses a second acceptance with the application error and leaves nothing behind', async () => {
    await addDocument(id(1));
    await addDocument(id(2));
    const { view } = await openOk('hello');
    await acceptInTx(view.intakeId, id(1));
    await expect(
      database().transaction(async (tx) => {
        await bindIntakeInTx(tx as never, { organizationId: ORG_A, userId: USER, intakeId: view.intakeId, documentId: id(2), versionId: id(9) });
      }),
    ).rejects.toBeInstanceOf(IntakeConflictError);
  });

  it('rolls the version and the binding back when the acceptance audit cannot be written', async () => {
    await addDocument(id(1));
    const { view } = await openOk('hello');
    await failAudit('document.intake.accept');
    await expect(acceptInTx(view.intakeId, id(1))).rejects.toThrow();
    expect(await intakeRow(view.intakeId)).toMatchObject({ status: 'open', object_state: 'present', accepted_version_id: null });
    expect((await q(`SELECT 1 FROM document_versions`)).rows).toHaveLength(0);
  });

  it('cannot cancel an accepted intake, and cannot accept a cancelled one', async () => {
    await addDocument(id(1));
    const accepted = await openOk('a');
    await acceptInTx(accepted.view.intakeId, id(1));
    expect(await cancelIntake({ organizationId: ORG_A, userId: USER, intakeId: accepted.view.intakeId })).toEqual({ ok: false, kind: 'accepted' });

    const cancelled = await openOk('b');
    expect(await cancelIntake({ organizationId: ORG_A, userId: USER, intakeId: cancelled.view.intakeId })).toMatchObject({ ok: true, changed: true });
    await expect(acceptInTx(cancelled.view.intakeId, id(1), 2)).rejects.toBeInstanceOf(IntakeConflictError);
    expect((await q(`SELECT 1 FROM document_versions`)).rows).toHaveLength(1);
  });

  it('lets only the principal cancel, and cancelling twice changes nothing', async () => {
    const { view } = await openOk('a');
    expect(await cancelIntake({ organizationId: ORG_A, userId: OTHER, intakeId: view.intakeId })).toEqual({ ok: false, kind: 'not_found' });
    expect(await cancelIntake({ organizationId: ORG_B, userId: USER, intakeId: view.intakeId })).toEqual({ ok: false, kind: 'not_found' });
    expect(await cancelIntake({ organizationId: ORG_A, userId: USER, intakeId: view.intakeId })).toMatchObject({ ok: true, changed: true });
    expect(await cancelIntake({ organizationId: ORG_A, userId: USER, intakeId: view.intakeId })).toMatchObject({ ok: true, changed: false });
    expect(state.removed).toEqual([]);
  });
});

describe('database guard (applies to any writer, not only this application)', () => {
  const rejects = async (statement: string, params: unknown[] = []) => {
    let failed = false;
    try { await q(statement, params); } catch { failed = true; }
    expect(failed, statement).toBe(true);
  };

  it('keeps an accepted intake terminal and its object attached', async () => {
    await addDocument(id(1));
    const { view } = await openOk('a');
    await acceptInTx(view.intakeId, id(1));
    await rejects(`UPDATE document_intakes SET status = 'cancelled', cancelled_at = now(), object_state = 'deleted', accepted_at = NULL, accepted_document_id = NULL, accepted_version_id = NULL WHERE id = $1`, [view.intakeId]);
    await rejects(`UPDATE document_intakes SET object_state = 'deletion_pending' WHERE id = $1`, [view.intakeId]);
    await rejects(`DELETE FROM document_intakes WHERE id = $1`, [view.intakeId]);
    expect(await intakeRow(view.intakeId)).toMatchObject({ status: 'accepted', object_state: 'attached' });
  });

  it('refuses an acceptance by a version that does not hold the intake’s object and checksum', async () => {
    await addDocument(id(1));
    const { view, key } = await openOk('a');
    const foreignVersion = crypto.randomUUID();
    await q(`INSERT INTO document_versions (id, organization_id, document_id, version_no, storage_key, content_hash, uploaded_by) VALUES ($1, $2, $3, 1, $4, $5, $6)`,
      [foreignVersion, ORG_A, id(1), `documents/${ORG_A}/somewhere/else`, sha('other'), USER]);
    await rejects(`UPDATE document_intakes SET status = 'accepted', object_state = 'attached', accepted_at = now(), accepted_document_id = $2, accepted_version_id = $3 WHERE id = $1`, [view.intakeId, id(1), foreignVersion]);

    const sameKeyOtherHash = crypto.randomUUID();
    await q(`INSERT INTO document_versions (id, organization_id, document_id, version_no, storage_key, content_hash, uploaded_by) VALUES ($1, $2, $3, 2, $4, $5, $6)`,
      [sameKeyOtherHash, ORG_A, id(1), key, sha('tampered'), USER]);
    await rejects(`UPDATE document_intakes SET status = 'accepted', object_state = 'attached', accepted_at = now(), accepted_document_id = $2, accepted_version_id = $3 WHERE id = $1`, [view.intakeId, id(1), sameKeyOtherHash]);
    expect(await intakeRow(view.intakeId)).toMatchObject({ status: 'open' });
  });

  it('refuses an intake whose key is not the server-issued key for its id, or whose identity is edited', async () => {
    const { view } = await openOk('a');
    await rejects(
      `INSERT INTO document_intakes (id, organization_id, principal_user_id, operation, storage_key, original_filename, mime_type, size_bytes, content_hash, expires_at)
       VALUES (gen_random_uuid(), $1, $2, 'create_document', 'documents/' || $1 || '/anything', 'a', 'application/pdf', 1, $3, now() + interval '5 minutes')`,
      [ORG_A, USER, sha('x')],
    );
    await rejects(`UPDATE document_intakes SET storage_key = storage_key || 'x' WHERE id = $1`, [view.intakeId]);
    await rejects(`UPDATE document_intakes SET principal_user_id = 'someone-else' WHERE id = $1`, [view.intakeId]);
    await rejects(`UPDATE document_intakes SET expires_at = expires_at + interval '5 minutes' WHERE id = $1`, [view.intakeId]);
  });

  it('refuses to mark an object deleted while any version references it', async () => {
    await addDocument(id(1));
    const { view, key } = await openOk('a');
    await cancelIntake({ organizationId: ORG_A, userId: USER, intakeId: view.intakeId });
    await q(`INSERT INTO document_versions (id, organization_id, document_id, version_no, storage_key, content_hash, uploaded_by) VALUES (gen_random_uuid(), $1, $2, 1, $3, $4, $5)`,
      [ORG_A, id(1), key, sha('a'), USER]);
    await rejects(`UPDATE document_intakes SET object_state = 'deleted' WHERE id = $1`, [view.intakeId]);
  });

  it('does not let an open intake claim to be attached or deleted, or expire early', async () => {
    const { view } = await openOk('a');
    await rejects(`UPDATE document_intakes SET object_state = 'deleted' WHERE id = $1`, [view.intakeId]);
    await rejects(`UPDATE document_intakes SET status = 'expired', expired_at = now() WHERE id = $1`, [view.intakeId]);
  });
});

describe('expiry and abandoned-upload reconciliation', () => {
  it('expires lapsed intakes, deletes only their exact objects and never touches accepted or live ones', async () => {
    await addDocument(id(1));
    const lapsed = await openOk('lapsed', { now: new Date(Date.now() - minutes(120)) });
    const live = await openOk('live');
    const accepted = await openOk('accepted', { now: new Date(Date.now() - minutes(10)) });
    await acceptInTx(accepted.view.intakeId, id(1));

    const report = await runIntakeReaper(state.storage);
    expect(report).toEqual({ expired: 1, objectsDeleted: 1, deletionFailed: 0, skipped: 0 });
    expect(state.removed).toEqual([lapsed.key]);
    expect(state.blobs.has(live.key)).toBe(true);
    expect(state.blobs.has(accepted.key)).toBe(true);
    expect(await intakeRow(lapsed.view.intakeId)).toMatchObject({ status: 'expired', object_state: 'deleted' });
    expect(await intakeRow(live.view.intakeId)).toMatchObject({ status: 'open', object_state: 'present' });
    expect(await intakeRow(accepted.view.intakeId)).toMatchObject({ status: 'accepted', object_state: 'attached' });
    expect(await auditActions()).toEqual(expect.arrayContaining(['document.intake.expire', 'document.intake.object_deleted']));
  });

  it('records a failed storage deletion without losing the object’s identity, then retries it', async () => {
    const lapsed = await openOk('lapsed', { now: new Date(Date.now() - minutes(120)) });
    await expireDueIntakes();
    state.removeFails = true;
    expect(await finalizeIntakeObjects(state.storage)).toEqual({ objectsDeleted: 0, deletionFailed: 1, skipped: 0 });
    const failed = await intakeRow(lapsed.view.intakeId);
    expect(failed).toMatchObject({ object_state: 'deletion_failed', deletion_attempts: 1 });
    // The message is stored for operators, with any storage path removed.
    expect(String(failed.deletion_error)).not.toContain('documents/secret');
    expect(state.blobs.has(lapsed.key)).toBe(true);

    // Not retried immediately.
    state.removeFails = false;
    expect(await finalizeIntakeObjects(state.storage)).toEqual({ objectsDeleted: 0, deletionFailed: 0, skipped: 0 });
    const later = new Date(Date.now() + minutes(10));
    expect(await finalizeIntakeObjects(state.storage, { now: later })).toEqual({ objectsDeleted: 1, deletionFailed: 0, skipped: 0 });
    expect(await intakeRow(lapsed.view.intakeId)).toMatchObject({ object_state: 'deleted', deletion_error: null });
    expect(state.blobs.has(lapsed.key)).toBe(false);
  });

  it('gives up after the attempt bound instead of retrying forever', async () => {
    const lapsed = await openOk('lapsed', { now: new Date(Date.now() - minutes(120)) });
    await expireDueIntakes();
    state.removeFails = true;
    for (let attempt = 0; attempt < INTAKE_MAX_DELETION_ATTEMPTS + 2; attempt += 1) {
      await finalizeIntakeObjects(state.storage, { now: new Date(Date.now() + minutes(10 * (attempt + 1))) });
    }
    expect(await intakeRow(lapsed.view.intakeId)).toMatchObject({ object_state: 'deletion_failed', deletion_attempts: INTAKE_MAX_DELETION_ATTEMPTS });
  });

  it('is safe to run twice and resumes an interrupted deletion', async () => {
    const lapsed = await openOk('lapsed', { now: new Date(Date.now() - minutes(120)) });
    await expireDueIntakes();
    // A crash after the claim leaves the row deletion_pending.
    await q(`UPDATE document_intakes SET object_state = 'deletion_pending', deletion_attempted_at = now() - interval '1 hour' WHERE id = $1`, [lapsed.view.intakeId]);
    expect(await runIntakeReaper(state.storage)).toMatchObject({ objectsDeleted: 1 });
    expect(await runIntakeReaper(state.storage)).toEqual({ expired: 0, objectsDeleted: 0, deletionFailed: 0, skipped: 0 });
  });

  it('skips, and never deletes, an object that a version references even if its intake lapsed', async () => {
    await addDocument(id(1));
    const lapsed = await openOk('lapsed', { now: new Date(Date.now() - minutes(120)) });
    await expireDueIntakes();
    await q(`INSERT INTO document_versions (id, organization_id, document_id, version_no, storage_key, content_hash, uploaded_by) VALUES (gen_random_uuid(), $1, $2, 1, $3, $4, $5)`,
      [ORG_A, id(1), lapsed.key, lapsed.hash, USER]);
    expect(await finalizeIntakeObjects(state.storage)).toEqual({ objectsDeleted: 0, deletionFailed: 0, skipped: 1 });
    expect(state.removed).toEqual([]);
    expect(state.blobs.has(lapsed.key)).toBe(true);
  });

  it('does not expire an intake that was accepted before its expiry was recorded', async () => {
    await addDocument(id(1));
    const { view } = await openOk('a');
    await acceptInTx(view.intakeId, id(1));
    expect(await expireDueIntakes({ now: new Date(Date.now() + minutes(120)) })).toBe(0);
    expect(await intakeRow(view.intakeId)).toMatchObject({ status: 'accepted' });
  });
});

describe('repository create from an intake (mandatory audit in the same transaction)', () => {
  it('creates the document, its first version, the binding and the audit record together', async () => {
    const { view, key, hash } = await openOk('contents');
    const response = await post(createBody(view.intakeId));
    expect(response.status).toBe(200);
    const created = (await response.json()).data;
    expect(created).toMatchObject({ title: 'Filed', uploadedBy: USER, mimeType: 'application/pdf', fileSize: 8 });
    const versions = (await q(`SELECT storage_key, content_hash, version_no FROM document_versions WHERE document_id = $1`, [created.id])).rows;
    expect(versions).toEqual([{ storage_key: key, content_hash: hash, version_no: 1 }]);
    expect(await intakeRow(view.intakeId)).toMatchObject({ status: 'accepted', object_state: 'attached', accepted_document_id: created.id });
    expect(await auditActions()).toEqual(['document.intake.accept', 'document.intake.open', 'document.upload']);
  });

  it('uses the server’s record of the file, not what the client claims about it', async () => {
    const { view } = await openOk('contents');
    const response = await post(createBody(view.intakeId, { mimeType: 'image/png', fileSize: 999999 }));
    const created = (await response.json()).data;
    expect(created).toMatchObject({ mimeType: 'application/pdf', fileSize: 8 });
  });

  it('commits no document when the mandatory create audit fails, and leaves the intake open', async () => {
    const { view } = await openOk('contents');
    await failAudit('document.upload');
    await expect(post(createBody(view.intakeId))).rejects.toThrow();
    expect((await q(`SELECT 1 FROM documents`)).rows).toHaveLength(0);
    expect((await q(`SELECT 1 FROM document_versions`)).rows).toHaveLength(0);
    expect(await intakeRow(view.intakeId)).toMatchObject({ status: 'open', object_state: 'present' });
    await q(`DELETE FROM audit_fault_actions`);
    expect((await post(createBody(view.intakeId))).status).toBe(200);
  });

  it('commits no unlinked document without its audit record either', async () => {
    const stored = state.blobs;
    stored.set(`documents/${ORG_A}/legacy-file`, Buffer.from('legacy'));
    await failAudit('document.upload');
    await expect(
      post({ title: 'Legacy', filename: 'l.pdf', blobPath: `documents/${ORG_A}/legacy-file`, documentType: 'x', mimeType: 'application/pdf', privacyLabel: 'team_confidential' }),
    ).rejects.toThrow();
    expect((await q(`SELECT 1 FROM documents`)).rows).toHaveLength(0);
  });

  it('answers a replay with the original document and writes nothing twice', async () => {
    const { view } = await openOk('contents');
    const first = (await (await post(createBody(view.intakeId))).json()).data;
    const second = await post(createBody(view.intakeId));
    expect((await second.json()).data).toMatchObject({ id: first.id, replay: true });
    expect((await q(`SELECT 1 FROM documents`)).rows).toHaveLength(1);
    expect((await q(`SELECT 1 FROM document_versions`)).rows).toHaveLength(1);
  });

  it('refuses another principal’s intake, an expired one, a cancelled one and a substituted object', async () => {
    const mine = await openOk('mine');
    expect((await post(createBody(mine.view.intakeId), OTHER)).status).toBe(404);

    const old = await openOk('old', { now: new Date(Date.now() - minutes(120)) });
    expect((await post(createBody(old.view.intakeId))).status).toBe(409);

    const cancelled = await openOk('cancelled');
    await cancelIntake({ organizationId: ORG_A, userId: USER, intakeId: cancelled.view.intakeId });
    expect((await post(createBody(cancelled.view.intakeId))).status).toBe(409);

    state.blobs.set(mine.key, Buffer.from('substituted'));
    expect((await post(createBody(mine.view.intakeId))).status).toBe(409);
    expect((await q(`SELECT 1 FROM documents`)).rows).toHaveLength(0);
  });

  it('refuses an intake opened for a version, and never accepts a client-supplied storage path next to an intake', async () => {
    await addDocument(id(1));
    const forVersion = await openOk('v', { operation: 'append_version', targetDocumentId: id(1) });
    expect((await post(createBody(forVersion.view.intakeId))).status).toBe(409);
    const plain = await openOk('p');
    expect((await post(createBody(plain.view.intakeId, { blobPath: `documents/${ORG_A}/other` }))).status).toBe(400);
  });

  it('refuses to attach an intake object through the client-path route', async () => {
    const { key } = await openOk('contents');
    const response = await post({ title: 'T', filename: 'f.pdf', blobPath: key, documentType: 'x', mimeType: 'application/pdf', privacyLabel: 'team_confidential' });
    expect(response.status).toBe(400);
    expect((await q(`SELECT 1 FROM documents`)).rows).toHaveLength(0);
  });

  it('requires the kernel to allow evidence on the case a document is linked to', async () => {
    const { view } = await openOk('contents');
    const response = await post(createBody(view.intakeId, { linkedEntityType: 'grievance', linkedEntityId: id(7) }));
    expect(response.status).toBe(404);
    expect((await q(`SELECT 1 FROM documents`)).rows).toHaveLength(0);
    expect(await intakeRow(view.intakeId)).toMatchObject({ status: 'open' });
  });
});

describe('version append from an intake', () => {
  it('appends the version, binds the intake and audits in one transaction', async () => {
    await addDocument(id(1));
    const v1 = await openOk('one');
    await acceptInTx(v1.view.intakeId, id(1));
    const next = await openOk('two', { operation: 'append_version', targetDocumentId: id(1) });
    const response = await append(id(1), { intakeId: next.view.intakeId, expectedVersionNo: 1 });
    expect(response.status).toBe(200);
    const version = (await response.json()).data;
    expect(version).toMatchObject({ versionNo: 2, storageKey: next.key, contentHash: next.hash });
    expect(await intakeRow(next.view.intakeId)).toMatchObject({ status: 'accepted', accepted_document_id: id(1), accepted_version_id: version.id });
    expect(await auditActions()).toContain('document.version_append');
  });

  it('commits nothing when the append audit fails, and refuses a stale base', async () => {
    await addDocument(id(1));
    const v1 = await openOk('one');
    await acceptInTx(v1.view.intakeId, id(1));
    const next = await openOk('two', { operation: 'append_version', targetDocumentId: id(1) });
    await failAudit('document.version_append');
    await expect(append(id(1), { intakeId: next.view.intakeId })).rejects.toThrow();
    expect((await q(`SELECT 1 FROM document_versions WHERE document_id = $1`, [id(1)])).rows).toHaveLength(1);
    expect(await intakeRow(next.view.intakeId)).toMatchObject({ status: 'open' });
    await q(`DELETE FROM audit_fault_actions`);
    expect((await append(id(1), { intakeId: next.view.intakeId, expectedVersionNo: 5 })).status).toBe(409);
    expect(await intakeRow(next.view.intakeId)).toMatchObject({ status: 'open' });
  });

  it('refuses an intake opened for another document, or by another principal', async () => {
    await addDocument(id(1));
    await addDocument(id(2));
    const forTwo = await openOk('two', { operation: 'append_version', targetDocumentId: id(2) });
    expect((await append(id(1), { intakeId: forTwo.view.intakeId })).status).toBe(409);
    const other = await openOk('x', { operation: 'append_version', targetDocumentId: id(1), userId: OTHER });
    expect((await append(id(1), { intakeId: other.view.intakeId })).status).toBe(404);
    expect((await q(`SELECT 1 FROM document_versions`)).rows).toHaveLength(0);
  });

  it('answers a replay with the original version', async () => {
    await addDocument(id(1));
    const next = await openOk('two', { operation: 'append_version', targetDocumentId: id(1) });
    const first = (await (await append(id(1), { intakeId: next.view.intakeId })).json()).data;
    const again = (await (await append(id(1), { intakeId: next.view.intakeId })).json()).data;
    expect(again).toMatchObject({ id: first.id, replay: true });
    expect((await q(`SELECT 1 FROM document_versions`)).rows).toHaveLength(1);
  });
});
