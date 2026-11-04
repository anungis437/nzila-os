/**
 * API Route: Retry Failed Ingestion Records
 * POST /api/admin/ingest/retry
 *
 * Re-processes failed records from a specific batch.
 * Respects idempotency — records that already succeeded are skipped.
 * Powers the Retry Mechanism (§3).
 */

import { withApi, z, ApiError } from '@/lib/api/framework';
import { eq, and, inArray, sql } from 'drizzle-orm';
import {
  ingestionBatches,
  ingestionRecords,
} from '@/db/schema/ingestion-schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

const retryBodySchema = z.object({
  batch_id: z.guid(),
  record_ids: z.array(z.guid()).min(1).max(500).optional(),
});

export const POST = withApi(
  {
    auth: { minRole: 'admin' },
    body: retryBodySchema,
    openapi: {
      tags: ['Admin', 'Ingestion'],
      summary: 'Retry failed ingestion records',
      description:
        'Re-processes failed records from a batch. If record_ids is omitted, retries all failed records in the batch.',
    },
  },
  async ({ body, userId, organizationId }) => {
    if (!organizationId) {
      throw ApiError.badRequest('Organization context required');
    }

    // The batch lookup, the failed-record read, the reset and the audit record are one tenant transaction (runtime role, the caller's
    // organization): every failed record is re-queued with its audit record, or none is.
    const failedCount = await withRLSContext({ organizationId }, async (tx) => {
      const [batch] = await tx
        .select({ id: ingestionBatches.id })
        .from(ingestionBatches)
        .where(
          and(
            eq(ingestionBatches.id, body.batch_id),
            eq(ingestionBatches.organizationId, organizationId),
          ),
        );

      if (!batch) {
        throw ApiError.notFound('Batch not found');
      }

      const conditions = [
        eq(ingestionRecords.batchId, body.batch_id),
        eq(ingestionRecords.status, 'failed'),
      ];
      if (body.record_ids) {
        conditions.push(inArray(ingestionRecords.id, body.record_ids));
      }

      const failedRecords = await tx
        .select({ id: ingestionRecords.id })
        .from(ingestionRecords)
        .where(and(...conditions));

      if (failedRecords.length === 0) {
        return 0;
      }

      await tx
        .update(ingestionRecords)
        .set({ status: 'pending', errorMessage: null, errorDetails: null, processedAt: null })
        .where(
          and(
            eq(ingestionRecords.batchId, body.batch_id),
            sql`${ingestionRecords.batchId} IN (SELECT id FROM ingestion_batches WHERE organization_id = ${organizationId})`,
            inArray(ingestionRecords.id, failedRecords.map((record) => record.id)),
          ),
        );
      await persistAtomicAudit(tx, {
        userId: userId ?? 'system:ingest-retry',
        organizationId,
        resourceType: 'ingestion_batch',
        resourceId: body.batch_id,
        action: 'ingest.retry',
        details: { recordCount: failedRecords.length, recordIds: body.record_ids ?? 'all_failed' },
      });
      return failedRecords.length;
    });

    if (failedCount === 0) {
      return {
        retried: 0,
        queued: 0,
        succeeded: 0,
        failed: 0,
        message: 'No failed records found to queue for retry',
      };
    }

    // Re-queuing is NOT processing: report pending work, never a successful replay.
    // The legacy 'retried' count is retained as an alias for callers already using it.
    return {
      retried: failedCount,
      queued: failedCount,
      succeeded: 0,
      failed: 0,
      message: `${failedCount} records queued for retry; processing has not completed`,
    };
  },
);
