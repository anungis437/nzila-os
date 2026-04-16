/**
 * API Route: Retry Failed Ingestion Records
 * POST /api/admin/ingest/retry
 *
 * Re-processes failed records from a specific batch.
 * Respects idempotency — records that already succeeded are skipped.
 * Powers the Retry Mechanism (§3).
 */

import { withApi, z, ApiError } from '@/lib/api/framework';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { db } from '@/db/db';
import { eq, and, inArray } from 'drizzle-orm';
import {
  ingestionBatches,
  ingestionRecords,
} from '@/db/schema/ingestion-schema';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';

const retryBodySchema = z.object({
  batch_id: z.string().uuid(),
  record_ids: z.array(z.string().uuid()).min(1).max(500).optional(),
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

    // Audit the retry attempt
    await auditLog({
      eventType: AuditEventType.DATA_BULK_UPDATE,
      severity: AuditSeverity.MEDIUM,
      userId: userId ?? undefined,
      organizationId,
      resource: 'ingestion_batch',
      resourceId: body.batch_id,
      action: 'retry',
      details: {
        recordCount: failedRecords.length,
        recordIds: body.record_ids ?? 'all_failed',
      },
      outcome: 'success',
    });

    // Mark records as pending for retry
    let retrySucceeded = 0;
    let retryFailed = 0;

    for (const record of failedRecords) {
      try {
        // Reset to pending
        await withSystemContext(async () =>
          db
            .update(ingestionRecords)
            .set({
              status: 'pending',
              errorMessage: null,
              errorDetails: null,
              processedAt: null,
            })
            .where(eq(ingestionRecords.id, record.id)),
        );
        retrySucceeded++;
      } catch {
        retryFailed++;
      }
    }

    return {
      retried: failedRecords.length,
      succeeded: retrySucceeded,
      failed: retryFailed,
      message: `${retrySucceeded} records queued for retry`,
    };
  },
);
