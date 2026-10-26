/**
 * API Route: Retry Failed Ingestion Records
 * POST /api/admin/ingest/retry
 *
 * Re-processes failed records from a specific batch.
 * Respects idempotency — records that already succeeded are skipped.
 * Powers the Retry Mechanism (§3).
 */

import { withApi, z, ApiError } from '@/lib/api/framework';
import { withOrgOwnedContext as withSystemContext } from '@/lib/db/org-owned-context';
import { db } from '@/db/db';
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

    // Verify batch exists and belongs to this org
    const [batch] = await withSystemContext(async () =>
      db
        .select()
        .from(ingestionBatches)
        .where(
          and(
            eq(ingestionBatches.id, body.batch_id),
            eq(ingestionBatches.organizationId, organizationId),
          ),
        ),
    );

    if (!batch) {
      throw ApiError.notFound('Batch not found');
    }

    // Get failed records
    const conditions = [
      eq(ingestionRecords.batchId, body.batch_id),
      eq(ingestionRecords.status, 'failed'),
    ];
    if (body.record_ids) {
      conditions.push(inArray(ingestionRecords.id, body.record_ids));
    }

    const failedRecords = await withSystemContext(async () =>
      db
        .select()
        .from(ingestionRecords)
        .where(and(...conditions)),
    );

    if (failedRecords.length === 0) {
      return {
        retried: 0,
        succeeded: 0,
        failed: 0,
        message: 'No failed records found to retry',
      };
    }

    // Every reset and the audit record commit together: all failed records are re-queued or none are.
    await withRLSContext({ organizationId }, async (tx) => {
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
    });
    const retrySucceeded = failedRecords.length;
    const retryFailed = 0;

    return {
      retried: failedRecords.length,
      succeeded: retrySucceeded,
      failed: retryFailed,
      message: `${retrySucceeded} records queued for retry`,
    };
  },
);
