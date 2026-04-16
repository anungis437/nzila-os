import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { hasMinRole } from '@/lib/api-auth-guard';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { auditDataAccess } from '@/lib/audit-logger';
import { withOrganizationAuth } from '@/lib/organization-middleware';
import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';
import { logger } from '@/lib/logger';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import { buildCaseGraph } from '@/services/case-intelligence/case-knowledge-graph-service';
import { findSimilarCases } from '@/services/case-intelligence/case-pattern-detection-service';
import { findPrecedentDocuments } from '@/services/case-intelligence/precedent-matching-service';
import { getRelatedDocuments } from '@/services/case-intelligence/related-documents-service';
import type { IntelligenceResponse } from '@/services/case-intelligence/types';

export const GET = withOrganizationAuth(async (_request, context, params?: { id: string }) => {
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
  const effectiveAccess = await getEffectiveCaseAccess({
    organizationId,
    grievanceId: params.id,
    userId,
  });

  if (!isStewardPlus && grievance.createdBy !== userId && !effectiveAccess.canViewCase) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, 'You do not have access to this grievance');
  }

  const intelligenceContext = {
    caseId: params.id,
    orgId: organizationId,
    actorId: userId,
  };
  const actor = {
    userId,
    isStewardPlus,
  };

  const relatedDocuments = await getRelatedDocuments({
    context: intelligenceContext,
    actor,
    limit: 12,
  });
  const similarCases = await findSimilarCases({
    context: intelligenceContext,
    actor,
    limit: 8,
  });
  const precedentDocuments = await findPrecedentDocuments({
    context: intelligenceContext,
    actor,
    similarCases,
    limit: 8,
  });
  const graph = await buildCaseGraph({
    context: intelligenceContext,
    actor,
  });

  const response: IntelligenceResponse = {
    graph,
    relatedDocuments,
    similarCases,
    precedentDocuments,
  };

  logger.info('Case intelligence response prepared', {
    caseId: params.id,
    relatedDocumentCount: relatedDocuments.length,
    similarCaseCount: similarCases.length,
    precedentDocumentCount: precedentDocuments.length,
    graphNodeCount: graph.nodes.length,
    graphEdgeCount: graph.edges.length,
  });

  await auditDataAccess({
    userId,
    organizationId,
    resource: 'case_intelligence',
    resourceId: params.id,
    action: 'read',
    details: {
      relatedDocumentCount: relatedDocuments.length,
      similarCaseCount: similarCases.length,
      precedentDocumentCount: precedentDocuments.length,
    },
  });

  return standardSuccessResponse(response);
});
