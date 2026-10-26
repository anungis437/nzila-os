import { z } from 'zod';
import { NextResponse } from 'next/server';
import { withSystemAdminAuth } from '@/lib/api-auth-guard';
import { performAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit';
import { backfillLegacyDocumentVersions } from '@/lib/documents/legacy-storage-backfill';

/**
 * POST /api/admin/documents/legacy-backfill
 *
 * Gives legacy document rows whose stored URL verifies as this organization's own storage a real version, and reports
 * the rest as unverifiable. Runs in the administrator's acting organization. A dry run (the default) writes nothing;
 * a real run records its intent first and an audit entry per document it changes.
 */
const bodySchema = z.object({
  dryRun: z.boolean().default(true),
  limit: z.number().int().min(1).max(500).default(100),
}).strict();

export const POST = withSystemAdminAuth(async (request, context) => {
  const { organizationId, userId } = context as { organizationId?: string; userId?: string };
  if (!organizationId || !userId) {
    return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'An acting organization is required' } }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request' } }, { status: 400 });
  }
  const { dryRun, limit } = parsed.data;
  const run = () => backfillLegacyDocumentVersions({ organizationId, actorId: userId, dryRun, limit });

  try {
    const report = dryRun
      ? await run()
      : await performAuditedOperation(
          {
            organizationId,
            userId,
            action: 'admin.document_legacy_backfill',
            resourceType: 'documents',
            details: { limit },
          },
          run,
        );
    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    const refused = operationAuditResponse(error);
    if (refused) return NextResponse.json(refused.body, { status: refused.status });
    throw error;
  }
});
