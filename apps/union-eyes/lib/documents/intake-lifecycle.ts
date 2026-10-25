/**
 * Temporary document intake lifecycle (open -> accepted | expired | cancelled).
 *
 * An uploaded object is not a document. Until a document or version atomically takes it, it is a temporary intake:
 * a server-issued record bound to the authenticated principal, the organization, the EXACT server-chosen storage key,
 * the checksum, MIME type and size the server computed from the bytes, and the operation it is for. The client is
 * given an intake id and the facts about the file; it is never given, and can never supply, the storage key.
 *
 * Guarantees (the database enforces the ones marked DB):
 *  - A key is chosen by the server from the intake id (DB: key_ck). Nothing a client sends names an object.
 *  - Acceptance binds the intake to the document version in the SAME transaction that creates it, and only to the
 *    version holding this exact key and checksum (DB trigger). An intake can be accepted once (DB: terminal state,
 *    unique accepted_version_id). A replay by the same principal returns the original result without a second write.
 *  - An accepted object can never be cancelled, expired or deleted: no cleanup path touches an object that any
 *    document version references (DB trigger), and cleanup reads the key from the row, never from a request.
 *  - The intake row is written before the object, so no object exists without a row. A row whose upload failed is
 *    cancelled; an abandoned row expires, and its object is deleted by a retryable, recorded step that tolerates a
 *    failing storage service: the row keeps deletion_failed with the attempt count and is retried.
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { withRLSContext, withSystemContext, type RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { documentIntakes, documentVersions, type DocumentIntake } from '@/db/schema/documents-schema';

export const INTAKE_TTL_MINUTES = 30;
export const INTAKE_MAX_BYTES = 50 * 1024 * 1024;
export const INTAKE_MAX_DELETION_ATTEMPTS = 10;
const RETRY_AFTER_MINUTES = 5;
export const SYSTEM_REAPER_ACTOR = 'system:document-intake-reaper';

export interface IntakeStorage {
  /** Stores the bytes at exactly this key (the implementation scans them). */
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  read(key: string): Promise<Buffer>;
  /** Removes exactly this key; absence is success. */
  remove(key: string): Promise<void>;
}

/** What a client may know about an intake. The storage key is not among it. */
export interface IntakeView {
  intakeId: string;
  status: DocumentIntake['status'];
  operation: DocumentIntake['operation'];
  targetDocumentId: string | null;
  filename: string;
  mimeType: string;
  size: number;
  checksum: string;
  createdAt: string;
  expiresAt: string;
  acceptedDocumentId: string | null;
  acceptedVersionId: string | null;
}

export const toIntakeView = (row: DocumentIntake): IntakeView => ({
  intakeId: row.id,
  status: row.status,
  operation: row.operation,
  targetDocumentId: row.targetDocumentId,
  filename: row.originalFilename,
  mimeType: row.mimeType,
  size: Number(row.sizeBytes),
  checksum: row.contentHash,
  createdAt: row.createdAt.toISOString(),
  expiresAt: row.expiresAt.toISOString(),
  acceptedDocumentId: row.acceptedDocumentId,
  acceptedVersionId: row.acceptedVersionId,
});

export const sha256Bytes = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

export const intakeStorageKey = (organizationId: string, intakeId: string): string =>
  `documents/${organizationId}/intake/${intakeId}/${randomBytes(8).toString('hex')}`;

const clean = (error: unknown): string => (error instanceof Error ? error.message : 'unknown').slice(0, 200).replace(/documents\/[^\s"']*/g, '[object]');

export type OpenIntakeResult =
  | { ok: true; intake: IntakeView }
  | { ok: false; kind: 'invalid' | 'upload_failed'; error?: unknown };

export async function openIntake(
  input: {
    organizationId: string;
    userId: string;
    operation: DocumentIntake['operation'];
    targetDocumentId?: string | null;
    filename: string;
    mimeType: string;
    bytes: Buffer;
    now?: Date;
  },
  storage: IntakeStorage,
): Promise<OpenIntakeResult> {
  const { organizationId, userId, bytes } = input;
  if (bytes.length === 0 || bytes.length > INTAKE_MAX_BYTES || !input.filename || !input.mimeType) return { ok: false, kind: 'invalid' };
  if ((input.operation === 'append_version') !== Boolean(input.targetDocumentId)) return { ok: false, kind: 'invalid' };

  const id = randomUUID();
  const key = intakeStorageKey(organizationId, id);
  const now = input.now ?? new Date();
  const hash = sha256Bytes(bytes);

  // The row first: every object that will ever exist has a row that says who it belongs to and when it lapses.
  const row = await withRLSContext({ organizationId }, async (tx) => {
    const [created] = await tx
      .insert(documentIntakes)
      .values({
        id,
        organizationId,
        principalUserId: userId,
        operation: input.operation,
        targetDocumentId: input.targetDocumentId ?? null,
        storageKey: key,
        originalFilename: input.filename.slice(0, 255),
        mimeType: input.mimeType,
        sizeBytes: bytes.length,
        contentHash: hash,
        status: 'open',
        objectState: 'present',
        createdAt: now,
        expiresAt: new Date(now.getTime() + INTAKE_TTL_MINUTES * 60_000),
      })
      .returning();
    await persistAtomicAudit(tx, {
      organizationId,
      userId,
      action: 'document.intake.open',
      resourceType: 'document_intakes',
      resourceId: id,
      details: { operation: input.operation, size: bytes.length, mimeType: input.mimeType, checksum: hash, targetDocumentId: input.targetDocumentId ?? null },
    });
    return created;
  });

  try {
    await storage.put(key, bytes, input.mimeType);
  } catch (error) {
    // Nothing was stored (or the scan refused it): close the row so it can never be accepted.
    await withRLSContext({ organizationId }, async (tx) => {
      const updated = await tx
        .update(documentIntakes)
        .set({ status: 'cancelled', cancelledAt: new Date(), objectState: 'deleted' })
        .where(and(eq(documentIntakes.id, id), eq(documentIntakes.organizationId, organizationId), eq(documentIntakes.status, 'open')))
        .returning({ id: documentIntakes.id });
      if (updated.length > 0) {
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'document.intake.cancel',
          resourceType: 'document_intakes',
          resourceId: id,
          details: { reason: 'upload_failed' },
        });
      }
    });
    // Best effort: a partial write may have left bytes; the reaper's exact-key step is not needed for a row that is
    // already 'deleted', so remove here and let a failure be visible in logs only.
    await storage.remove(key).catch(() => undefined);
    return { ok: false, kind: 'upload_failed', error };
  }
  return { ok: true, intake: toIntakeView(row) };
}

export type AcceptanceCheck =
  | { ok: true; replay: false; intake: DocumentIntake }
  | { ok: true; replay: true; intake: DocumentIntake }
  | { ok: false; kind: 'not_found' | 'not_open' | 'expired' | 'operation_mismatch' | 'object_missing' | 'object_changed'; status?: DocumentIntake['status'] };

/**
 * Everything that can be judged before the transaction: ownership, state, expiry, intended operation and that the
 * object is still exactly the one the server recorded. The binding itself happens in bindIntakeInTx, which re-judges
 * state under a row lock, so a race between two acceptances (or an acceptance and a cancellation) has one winner.
 */
export async function checkIntakeForAcceptance(
  input: { organizationId: string; userId: string; intakeId: string; operation: DocumentIntake['operation']; targetDocumentId?: string | null; now?: Date },
  storage: IntakeStorage,
): Promise<AcceptanceCheck> {
  const row = await withRLSContext({ organizationId: input.organizationId }, async (tx) =>
    (
      await tx
        .select()
        .from(documentIntakes)
        .where(and(eq(documentIntakes.id, input.intakeId), eq(documentIntakes.organizationId, input.organizationId)))
        .limit(1)
    )[0],
  );
  // Another principal's intake is indistinguishable from one that does not exist.
  if (!row || row.principalUserId !== input.userId) return { ok: false, kind: 'not_found' };
  if (row.operation !== input.operation || (row.targetDocumentId ?? null) !== (input.targetDocumentId ?? null)) {
    return { ok: false, kind: 'operation_mismatch' };
  }
  if (row.status === 'accepted') return { ok: true, replay: true, intake: row };
  if (row.status !== 'open') return { ok: false, kind: 'not_open', status: row.status };
  if ((input.now ?? new Date()).getTime() >= row.expiresAt.getTime()) return { ok: false, kind: 'expired', status: 'open' };

  let bytes: Buffer;
  try {
    bytes = await storage.read(row.storageKey);
  } catch {
    return { ok: false, kind: 'object_missing' };
  }
  if (bytes.length !== Number(row.sizeBytes) || sha256Bytes(bytes) !== row.contentHash) return { ok: false, kind: 'object_changed' };
  return { ok: true, replay: false, intake: row };
}

export class IntakeConflictError extends Error {
  readonly code = 'INTAKE_NOT_OPEN';
  constructor() {
    super('The intake is no longer open');
    this.name = 'IntakeConflictError';
  }
}

/**
 * Binds the intake to the document and version created in this transaction. Throws IntakeConflictError, rolling the
 * whole acceptance back (document, version, link, audit), when the intake is no longer open under the row lock.
 */
export async function bindIntakeInTx(
  tx: RLSTx,
  input: { organizationId: string; userId: string; intakeId: string; documentId: string; versionId: string },
): Promise<void> {
  const updated = await tx
    .update(documentIntakes)
    .set({ status: 'accepted', objectState: 'attached', acceptedAt: new Date(), acceptedDocumentId: input.documentId, acceptedVersionId: input.versionId })
    .where(
      and(
        eq(documentIntakes.id, input.intakeId),
        eq(documentIntakes.organizationId, input.organizationId),
        eq(documentIntakes.principalUserId, input.userId),
        eq(documentIntakes.status, 'open'),
        sql`${documentIntakes.expiresAt} > now()`,
      ),
    )
    .returning({ id: documentIntakes.id });
  if (updated.length === 0) throw new IntakeConflictError();
  await persistAtomicAudit(tx, {
    organizationId: input.organizationId,
    userId: input.userId,
    action: 'document.intake.accept',
    resourceType: 'document_intakes',
    resourceId: input.intakeId,
    details: { documentId: input.documentId, versionId: input.versionId },
  });
}

export type CancelResult =
  | { ok: true; intake: IntakeView; changed: boolean }
  | { ok: false; kind: 'not_found' | 'accepted' | 'expired' };

/** Cancels the principal's own open intake. An accepted intake cannot be cancelled; its object is a document's. */
export async function cancelIntake(input: { organizationId: string; userId: string; intakeId: string }): Promise<CancelResult> {
  return withRLSContext({ organizationId: input.organizationId }, async (tx): Promise<CancelResult> => {
    const [row] = await tx
      .select()
      .from(documentIntakes)
      .where(and(eq(documentIntakes.id, input.intakeId), eq(documentIntakes.organizationId, input.organizationId)))
      .for('update');
    if (!row || row.principalUserId !== input.userId) return { ok: false, kind: 'not_found' };
    if (row.status === 'accepted') return { ok: false, kind: 'accepted' };
    if (row.status === 'cancelled') return { ok: true, intake: toIntakeView(row), changed: false };
    if (row.status === 'expired') return { ok: false, kind: 'expired' };
    const [updated] = await tx
      .update(documentIntakes)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(and(eq(documentIntakes.id, row.id), eq(documentIntakes.organizationId, input.organizationId), eq(documentIntakes.status, 'open')))
      .returning();
    await persistAtomicAudit(tx, {
      organizationId: input.organizationId,
      userId: input.userId,
      action: 'document.intake.cancel',
      resourceType: 'document_intakes',
      resourceId: row.id,
      details: { reason: 'cancelled_by_principal' },
    });
    return { ok: true, intake: toIntakeView(updated), changed: true };
  });
}

export async function getOwnIntake(input: { organizationId: string; userId: string; intakeId: string }): Promise<IntakeView | null> {
  const row = await withRLSContext({ organizationId: input.organizationId }, async (tx) =>
    (
      await tx
        .select()
        .from(documentIntakes)
        .where(and(eq(documentIntakes.id, input.intakeId), eq(documentIntakes.organizationId, input.organizationId), eq(documentIntakes.principalUserId, input.userId)))
        .limit(1)
    )[0],
  );
  return row ? toIntakeView(row) : null;
}

export interface ReaperReport {
  expired: number;
  objectsDeleted: number;
  deletionFailed: number;
  skipped: number;
}

/** Marks every lapsed open intake expired. System role; one audit record per intake. */
export async function expireDueIntakes(input: { now?: Date; limit?: number } = {}): Promise<number> {
  const limit = input.limit ?? 200;
  return withSystemContext(async (tx) => {
    const rtx = tx as unknown as RLSTx;
    const due = await rtx
      .select({ id: documentIntakes.id, organizationId: documentIntakes.organizationId })
      .from(documentIntakes)
      .where(and(eq(documentIntakes.status, 'open'), lte(documentIntakes.expiresAt, input.now ?? new Date())))
      .limit(limit)
      .for('update', { skipLocked: true });
    for (const intake of due) {
      const updated = await rtx
        .update(documentIntakes)
        .set({ status: 'expired', expiredAt: new Date() })
        .where(and(eq(documentIntakes.id, intake.id), eq(documentIntakes.organizationId, intake.organizationId), eq(documentIntakes.status, 'open')))
        .returning({ id: documentIntakes.id });
      if (updated.length === 0) continue;
      await persistAtomicAudit(rtx, {
        organizationId: intake.organizationId,
        userId: SYSTEM_REAPER_ACTOR,
        action: 'document.intake.expire',
        resourceType: 'document_intakes',
        resourceId: intake.id,
        details: { reason: 'lapsed_unaccepted' },
      });
    }
    return due.length;
  });
}

/**
 * Deletes the objects of cancelled and expired intakes, one exact key at a time, from the key the row records. The
 * database refuses to mark an object that any version references. A storage failure is recorded on the row
 * (deletion_failed, attempts, a sanitized message) and retried later; it never marks the object deleted and never
 * blocks the other rows. Accepted intakes are not selectable here.
 */
export async function finalizeIntakeObjects(storage: IntakeStorage, input: { limit?: number; now?: Date } = {}): Promise<Pick<ReaperReport, 'objectsDeleted' | 'deletionFailed' | 'skipped'>> {
  const now = input.now ?? new Date();
  const retryBefore = new Date(now.getTime() - RETRY_AFTER_MINUTES * 60_000);
  const candidates = await withSystemContext(async (tx) =>
    (tx as unknown as RLSTx)
      .select({ id: documentIntakes.id, organizationId: documentIntakes.organizationId })
      .from(documentIntakes)
      .where(
        and(
          inArray(documentIntakes.status, ['cancelled', 'expired']),
          inArray(documentIntakes.objectState, ['present', 'deletion_pending', 'deletion_failed']),
          sql`${documentIntakes.deletionAttempts} < ${INTAKE_MAX_DELETION_ATTEMPTS}`,
          sql`(${documentIntakes.deletionAttemptedAt} IS NULL OR ${documentIntakes.deletionAttemptedAt} <= ${retryBefore})`,
        ),
      )
      .limit(input.limit ?? 100),
  );

  const report = { objectsDeleted: 0, deletionFailed: 0, skipped: 0 };
  for (const candidate of candidates) {
    // 1. Claim: move to deletion_pending under a lock and read the exact key from the row.
    const claimed = await withSystemContext(async (tx) => {
      const rtx = tx as unknown as RLSTx;
      const [row] = await rtx.select().from(documentIntakes).where(eq(documentIntakes.id, candidate.id)).for('update', { skipLocked: true });
      if (!row || !['cancelled', 'expired'].includes(row.status) || row.objectState === 'deleted' || row.objectState === 'attached') return null;
      // An object that a document version references is attached, not abandoned. (The database refuses this too; the
      // check here keeps a refusal from aborting the transaction.)
      const referenced = await rtx
        .select({ id: documentVersions.id })
        .from(documentVersions)
        .where(and(eq(documentVersions.organizationId, row.organizationId), eq(documentVersions.storageKey, row.storageKey)))
        .limit(1);
      if (referenced.length > 0) return null;
      await rtx.update(documentIntakes).set({ objectState: 'deletion_pending', deletionAttemptedAt: now }).where(and(eq(documentIntakes.id, row.id), eq(documentIntakes.organizationId, row.organizationId)));
      return { key: row.storageKey, organizationId: row.organizationId, attempts: row.deletionAttempts };
    });
    if (!claimed) {
      report.skipped += 1;
      continue;
    }

    // 2. Delete exactly that key.
    let failure: string | null = null;
    try {
      await storage.remove(claimed.key);
    } catch (error) {
      failure = clean(error);
    }

    // 3. Record the outcome.
    await withSystemContext(async (tx) => {
      const rtx = tx as unknown as RLSTx;
      if (failure === null) {
        await rtx.update(documentIntakes).set({ objectState: 'deleted', deletionError: null }).where(and(eq(documentIntakes.id, candidate.id), eq(documentIntakes.organizationId, claimed.organizationId)));
        await persistAtomicAudit(rtx, { organizationId: claimed.organizationId, userId: SYSTEM_REAPER_ACTOR, action: 'document.intake.object_deleted', resourceType: 'document_intakes', resourceId: candidate.id, details: {} });
      } else {
        await rtx
          .update(documentIntakes)
          .set({ objectState: 'deletion_failed', deletionAttempts: claimed.attempts + 1, deletionError: failure })
          .where(and(eq(documentIntakes.id, candidate.id), eq(documentIntakes.organizationId, claimed.organizationId)));
        await persistAtomicAudit(rtx, { organizationId: claimed.organizationId, userId: SYSTEM_REAPER_ACTOR, action: 'document.intake.object_deletion_failed', resourceType: 'document_intakes', resourceId: candidate.id, details: { attempts: claimed.attempts + 1 } }, 'failure');
      }
    });
    if (failure === null) report.objectsDeleted += 1;
    else report.deletionFailed += 1;
  }
  return report;
}

export async function runIntakeReaper(storage: IntakeStorage, input: { now?: Date } = {}): Promise<ReaperReport> {
  const expired = await expireDueIntakes({ now: input.now });
  const objects = await finalizeIntakeObjects(storage, { now: input.now });
  return { expired, ...objects };
}
