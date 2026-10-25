/**
 * Governed backfill of legacy document rows (tranche-1 integration, B2).
 *
 * A legacy document carries only a stored file URL and no version row. The download route will serve such a row only
 * while its URL validates as a pointer into the organization's own storage; this backfill gives the verified ones a
 * real version (storage key and a content hash computed from the stored bytes) so the URL stops mattering, and reports
 * the rest as unverifiable. It invents nothing: a URL that is external, foreign, malformed or unreadable is reported,
 * left untouched, and stays undownloadable until the institution decides what the file is.
 *
 * Dry run is the default. A real run records one audit entry per document it changes, in the same transaction.
 */
import { and, eq, notExists, sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { documents, documentVersions } from '@/db/schema/documents-schema';
import { StoredBlobError, resolveStoredBlob, verifiedLegacyBlobPath } from '@/lib/services/document-blob-integrity-service';

export type LegacyBackfillOutcome =
  | { documentId: string; result: 'would_migrate' | 'migrated'; blobPath: string }
  | { documentId: string; result: 'unverifiable'; reason: 'no_location' | 'not_own_storage' | 'unreadable' | 'storage_key_in_use' };

export interface LegacyBackfillReport {
  organizationId: string;
  dryRun: boolean;
  examined: number;
  migrated: number;
  unverifiable: number;
  outcomes: LegacyBackfillOutcome[];
}

export async function backfillLegacyDocumentVersions(input: {
  organizationId: string;
  actorId: string;
  dryRun?: boolean;
  limit?: number;
}): Promise<LegacyBackfillReport> {
  const { organizationId, actorId } = input;
  const dryRun = input.dryRun ?? true;
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);

  const candidates = await withRLSContext({ organizationId }, (tx) =>
    tx
      .select({ id: documents.id, fileUrl: documents.fileUrl })
      .from(documents)
      .where(
        and(
          eq(documents.organizationId, organizationId),
          sql`${documents.deletedAt} IS NULL`,
          notExists(
            tx
              .select({ one: sql`1` })
              .from(documentVersions)
              .where(and(eq(documentVersions.documentId, documents.id), eq(documentVersions.organizationId, organizationId))),
          ),
        ),
      )
      .limit(limit),
  );

  const outcomes: LegacyBackfillOutcome[] = [];
  for (const candidate of candidates) {
    if (!candidate.fileUrl) {
      outcomes.push({ documentId: candidate.id, result: 'unverifiable', reason: 'no_location' });
      continue;
    }
    const blobPath = verifiedLegacyBlobPath(candidate.fileUrl, organizationId);
    if (!blobPath) {
      outcomes.push({ documentId: candidate.id, result: 'unverifiable', reason: 'not_own_storage' });
      continue;
    }

    let resolved;
    try {
      resolved = await resolveStoredBlob({ organizationId, blobPath });
    } catch (error) {
      if (!(error instanceof StoredBlobError)) throw error;
      outcomes.push({ documentId: candidate.id, result: 'unverifiable', reason: 'unreadable' });
      continue;
    }

    if (dryRun) {
      outcomes.push({ documentId: candidate.id, result: 'would_migrate', blobPath });
      continue;
    }

    const written = await withRLSContext({ organizationId }, async (tx) => {
      const inUse = (
        await tx
          .select({ id: documentVersions.id })
          .from(documentVersions)
          .where(and(eq(documentVersions.organizationId, organizationId), eq(documentVersions.storageKey, blobPath)))
          .limit(1)
      )[0];
      if (inUse) return false;
      await tx.insert(documentVersions).values({
        organizationId,
        documentId: candidate.id,
        versionNo: 1,
        storageKey: blobPath,
        contentHash: resolved.contentHash,
        uploadedBy: actorId,
      });
      await persistAtomicAudit(tx, {
        organizationId,
        userId: actorId,
        action: 'document.legacy_version_backfill',
        resourceType: 'documents',
        resourceId: candidate.id,
        details: { contentHash: resolved.contentHash },
      });
      return true;
    });
    outcomes.push(
      written
        ? { documentId: candidate.id, result: 'migrated', blobPath }
        : { documentId: candidate.id, result: 'unverifiable', reason: 'storage_key_in_use' },
    );
  }

  const migrated = outcomes.filter((outcome) => outcome.result === 'migrated' || outcome.result === 'would_migrate').length;
  return { organizationId, dryRun, examined: candidates.length, migrated, unverifiable: outcomes.length - migrated, outcomes };
}
