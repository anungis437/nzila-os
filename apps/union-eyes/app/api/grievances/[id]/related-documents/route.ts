import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { db } from '@/db/db';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';
import { getRelatedDocuments } from '@/lib/services/case-related-documents-service';
import { buildCaseGraph } from '@/lib/services/case-knowledge-graph-service';
import { trackPilotEvent } from '@/lib/services/pilot-tracking';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  label: z.string().optional(),
  documentType: z.string().optional(),
  source: z.string().optional(),
  // z.coerce.boolean would read the text "false" as true.
  includeGraph: z.enum(['true', 'false', '1', '0']).transform((value) => value === 'true' || value === '1').optional(),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    entitlement: 'grievance_case_suite',
    // Every read below goes through the ambient handle, so the handler runs in the caller's organization transaction.
    rlsOrgContext: true,
    openapi: { tags: ['Grievances'], summary: 'Documents related to a grievance' },
  },
  async ({ request, params, organizationId, userId }) => {
    if (!organizationId || !userId) {
      throw ApiError.forbidden('Organization context required — select an organization before accessing this resource');
    }
    const caseId = params.id;
    if (!caseId || !zUUID.safeParse(caseId).success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid grievance ID');
    }

    const [grievance] = await db
      .select({
        id: grievances.id,
        createdBy: grievances.createdBy,
      })
      .from(grievances)
      .where(and(eq(grievances.id, caseId), eq(grievances.organizationId, organizationId)))
      .limit(1);

    if (!grievance) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, 'Grievance not found');
    }

    const access = await getEffectiveCaseAccess({
      organizationId,
      grievanceId: caseId,
      userId,
    });

    if (grievance.createdBy !== userId && !access.canViewCase) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'You do not have access to this grievance');
    }

    const query = querySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );

    if (!query.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid query parameters', query.error.flatten());
    }

    const related = await getRelatedDocuments({
      caseId,
      orgId: organizationId,
      actor: {
        userId,
      },
      limit: query.data.limit ?? 20,
    });

    const filtered = related.filter((doc) => {
      if (query.data.label && doc.privacyLabel !== query.data.label) return false;
      if (query.data.documentType && doc.documentType !== query.data.documentType) return false;
      if (query.data.source) {
        const sourceNeedle = query.data.source.toLowerCase();
        if (!doc.reasons.some((reason) => reason.toLowerCase().includes(sourceNeedle))) return false;
      }
      return true;
    });

    const graph = query.data.includeGraph
      ? await buildCaseGraph({
          caseId,
          orgId: organizationId,
          actor: {
            userId,
          },
        })
      : undefined;

    await trackPilotEvent({
      userId,
      organizationId,
      sessionId: `server:${caseId}`,
      eventType: 'document_accessed',
      metadata: {
        grievanceId: caseId,
        documentCount: filtered.length,
        includeGraph: !!query.data.includeGraph,
      },
    });

    return standardSuccessResponse({
      documents: filtered,
      total: filtered.length,
      graph,
    });
  },
);
