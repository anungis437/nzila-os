/**
 * API Route: Batch Case Ingestion
 * POST /api/admin/ingest
 *
 * Hardened endpoint for importing real-world grievance/case data.
 * Supports dry-run validation, idempotent upserts, and full traceability.
 *
 * Request body:
 * {
 *   source_system: string,
 *   dry_run?: boolean,
 *   continue_on_error?: boolean,
 *   records: IngestionGrievanceRecord[]
 * }
 */

import { withApi, z, ApiError } from '@/lib/api/framework';
import { withOrgOwnedContext as withSystemContext } from '@/lib/db/org-owned-context';
import {
  ingestGrievanceBatch,
  type IngestionGrievanceRecord,
} from '@/lib/ingestion';
import { performAuditedOperation, OperationAuditError } from '@/lib/audit/operation-audit';
import { verifyImportBatch, type VerificationResult } from '@/lib/ingestion/post-import-verification';

const timelineEventSchema = z.object({
  date: z.string().optional(),
  action: z.string(),
  actor: z.string().optional(),
  notes: z.string().optional(),
});

const documentSchema = z.object({
  external_id: z.string().optional(),
  name: z.string(),
  file_url: z.string().optional(),
  file_type: z.string().optional(),
});

const recordSchema = z.object({
  external_case_id: z.string().min(1),
  grievance_number: z.string().optional(),
  type: z.string().min(1),
  status: z.string().min(1),
  priority: z.string().optional(),
  step: z.string().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  grievant_name: z.string().optional(),
  grievant_email: z.string().email().optional(),
  organization_id: z.guid(),
  incident_date: z.string().optional(),
  filed_date: z.string().optional(),
  assigned_to: z.string().optional(),
  filed_by: z.string().optional(),
  source_system: z.string().optional(),
  timeline: z.array(timelineEventSchema).optional(),
  documents: z.array(documentSchema).optional(),
});

const ingestBodySchema = z.object({
  source_system: z.string().min(1).max(100),
  dry_run: z.boolean().optional().default(false),
  continue_on_error: z.boolean().optional().default(true),
  records: z.array(recordSchema).min(1).max(5000),
});

export const POST = withApi(
  {
    auth: { minRole: 'admin' },
    body: ingestBodySchema,
    openapi: {
      tags: ['Admin', 'Ingestion'],
      summary: 'Batch ingest grievance cases',
      description:
        'Import grievance/case records with full idempotency, FSM mapping, ' +
        'timeline dedup, and traceability. Supports dry_run for validation-only.',
    },
  },
  async ({ body, userId, organizationId }) => {
    if (!organizationId) {
      throw ApiError.badRequest('Organization context required');
    }

    // Verify all records belong to this org
    const mismatch = body.records.find(
      (r: { organization_id: string }) => r.organization_id !== organizationId,
    );
    if (mismatch) {
      throw ApiError.forbidden(
        `Record external_case_id '${mismatch.external_case_id}' targets ` +
        `org '${mismatch.organization_id}' but request org is '${organizationId}'`,
      );
    }

    const ingest = () =>
      withSystemContext(async () =>
        ingestGrievanceBatch(body.records as IngestionGrievanceRecord[], {
          organizationId,
          sourceSystem: body.source_system,
          createdBy: userId ?? 'system',
          dryRun: body.dry_run,
          continueOnError: body.continue_on_error,
        }),
      );

    // A real import creates cases in bulk: the intent is recorded before any case exists. A dry run writes nothing.
    let result: Awaited<ReturnType<typeof ingest>>;
    try {
      result = body.dry_run
        ? await ingest()
        : await performAuditedOperation(
            {
              organizationId,
              userId,
              action: 'admin.case_ingest',
              resourceType: 'ingestion_batch',
              details: { sourceSystem: body.source_system, recordCount: body.records.length, continueOnError: body.continue_on_error },
            },
            ingest,
          );
    } catch (error) {
      if (error instanceof OperationAuditError) throw ApiError.conflict(error.message);
      throw error;
    }

    // Post-import verification for non-dry-run completed batches
    let verification: VerificationResult | null = null;
    if (!body.dry_run && result.batchId && result.batchId !== 'dry-run') {
      verification = await withSystemContext(async () =>
        verifyImportBatch(result.batchId),
      );
    }

    return {
      ...result,
      verification,
    };
  },
);
