import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { withApi, ApiError, zUUID } from '@/lib/api/framework';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { auditDataAccess } from '@/lib/audit-logger';
import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';
import { logger } from '@/lib/logger';
import { buildCaseGraph } from '@/services/case-intelligence/case-knowledge-graph-service';
import { findSimilarCases } from '@/services/case-intelligence/case-pattern-detection-service';
import { findPrecedentDocuments } from '@/services/case-intelligence/precedent-matching-service';
import { getRelatedDocuments } from '@/services/case-intelligence/related-documents-service';
import type { IntelligenceResponse } from '@/services/case-intelligence/types';
import { productionGrievanceCondition } from '@/lib/pilot/demo-provenance';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    entitlement: 'grievance_case_suite',
    // Every read below goes through the ambient handle, so the handler runs in the caller's organization transaction.
    rlsOrgContext: true,
    openapi: { tags: ['Grievances'], summary: 'Case intelligence for a grievance' },
  },
  async ({ params, organizationId, userId }) => {
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
      .where(and(eq(grievances.id, caseId), eq(grievances.organizationId, organizationId), productionGrievanceCondition()))
      .limit(1);

    if (!grievance) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, 'Grievance not found');
    }

    const effectiveAccess = await getEffectiveCaseAccess({
      organizationId,
      grievanceId: caseId,
      userId,
    });

    if (grievance.createdBy !== userId && !effectiveAccess.canViewCase) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'You do not have access to this grievance');
    }

    const intelligenceContext = {
      caseId,
      orgId: organizationId,
      actorId: userId,
    };
    const actor = {
      userId,
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
      caseId,
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
      resourceId: caseId,
      action: 'read',
      details: {
        relatedDocumentCount: relatedDocuments.length,
        similarCaseCount: similarCases.length,
        precedentDocumentCount: precedentDocuments.length,
      },
    });

    return standardSuccessResponse(response);
  },
);
