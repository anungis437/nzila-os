import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { hasMinRole } from '@/lib/api-auth-guard';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
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
  includeGraph: z.coerce.boolean().optional(),
});

export const GET = withOrganizationAuth(async (request, context, params?: { id: string }) => {
  const { organizationId, userId } = context;
  await requireEntitlement(organizationId, 'grievance_case_suite');

  if (!params?.id) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing grievance ID');
  }

  const canAccess = await hasMinRole('member');
  if (!canAccess) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'Unauthorized');
  }

  const [grievance] = await db
    .select({
      id: grievances.id,
      createdBy: grievances.createdBy,
    })
    .from(grievances)
    .where(and(eq(grievances.id, params.id), eq(grievances.organizationId, organizationId)))
    .limit(1);

  if (!grievance) {
    return standardErrorResponse(ErrorCode.NOT_FOUND, 'Grievance not found');
  }

  const isStewardPlus = await hasMinRole('steward');
  const access = await getEffectiveCaseAccess({
    organizationId,
    grievanceId: params.id,
    userId,
  });

  if (!isStewardPlus && grievance.createdBy !== userId && !access.canViewCase) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'You do not have access to this grievance');
  }

  const query = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );

  if (!query.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid query parameters', query.error.flatten());
  }

  const related = await getRelatedDocuments({
    caseId: params.id,
    orgId: organizationId,
    actor: {
      userId,
      isStewardPlus,
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
        caseId: params.id,
        orgId: organizationId,
        actor: {
          userId,
          isStewardPlus,
        },
      })
    : undefined;

  await trackPilotEvent({
    userId,
    organizationId,
    sessionId: `server:${params.id}`,
    eventType: 'document_accessed',
    metadata: {
      grievanceId: params.id,
      documentCount: filtered.length,
      includeGraph: !!query.data.includeGraph,
    },
  });

  return standardSuccessResponse({
    documents: filtered,
    total: filtered.length,
    graph,
  });
});
