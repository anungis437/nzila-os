import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { logger } from '@/lib/logger';
import { getEffectiveCaseAccess } from '@/lib/services/case-access-service';
import type { DocumentAuthorizationActor } from '@/lib/services/document-authorization-service';
import { getCaseIntelligenceConfig } from '@/services/case-intelligence/ml-relevance-service';
import { computeTokenOverlapSimilarity } from '@/services/case-intelligence/similarity-provider';
import type { CaseSnapshot, IntelligenceContext, SimilarCaseResult } from '@/services/case-intelligence/types';

async function getCaseSnapshot(caseId: string, orgId: string) {
  const [caseRow] = await db
    .select({
      id: grievances.id,
      grievanceNumber: grievances.grievanceNumber,
      title: grievances.title,
      description: grievances.description,
      type: grievances.type,
      status: grievances.status,
      grievantId: grievances.grievantId,
      employerId: grievances.employerId,
      workplaceId: grievances.workplaceId,
      cbaId: grievances.cbaId,
      createdBy: grievances.createdBy,
      awardSummary: grievances.background,
      organizationId: grievances.organizationId,
      createdAt: grievances.createdAt,
    })
    .from(grievances)
    .where(and(eq(grievances.id, caseId), eq(grievances.organizationId, orgId)))
    .limit(1);

  return (caseRow ?? null) as CaseSnapshot | null;
}

export async function findSimilarCases(params: {
  context: IntelligenceContext;
  actor: DocumentAuthorizationActor;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(params.limit ?? 10, 50));
  const config = await getCaseIntelligenceConfig(params.context);
  if (!config.patternsEnabled) {
    return [] as SimilarCaseResult[];
  }

  const currentCase = await getCaseSnapshot(params.context.caseId, params.context.orgId);
  if (!currentCase) {
    return [] as SimilarCaseResult[];
  }

  const candidates = await db
    .select({
      id: grievances.id,
      grievanceNumber: grievances.grievanceNumber,
      title: grievances.title,
      description: grievances.description,
      type: grievances.type,
      status: grievances.status,
      grievantId: grievances.grievantId,
      employerId: grievances.employerId,
      workplaceId: grievances.workplaceId,
      cbaId: grievances.cbaId,
      createdBy: grievances.createdBy,
      awardSummary: grievances.background,
      organizationId: grievances.organizationId,
      createdAt: grievances.createdAt,
    })
    .from(grievances)
    .where(
      and(
        eq(grievances.organizationId, params.context.orgId),
        sql`${grievances.id} <> ${params.context.caseId}::uuid`,
      ),
    )
    .orderBy(desc(grievances.createdAt))
    .limit(100);

  const results: SimilarCaseResult[] = [];
  for (const candidate of candidates as CaseSnapshot[]) {
    const access = params.actor.isStewardPlus
      ? { canViewCase: true }
      : await getEffectiveCaseAccess({
          organizationId: params.context.orgId,
          grievanceId: candidate.id,
          userId: params.actor.userId,
        });

    if (!params.actor.isStewardPlus && candidate.createdBy !== params.actor.userId && !access.canViewCase) {
      continue;
    }

    const matchedDimensions = {
      grievanceType: candidate.type === currentCase.type,
      agreement: Boolean(candidate.cbaId && candidate.cbaId === currentCase.cbaId),
      employerOrWorksite: Boolean(
        (candidate.employerId && candidate.employerId === currentCase.employerId) ||
          (candidate.workplaceId && candidate.workplaceId === currentCase.workplaceId),
      ),
      summarySimilarity: computeTokenOverlapSimilarity(
        `${currentCase.title} ${currentCase.description} ${currentCase.awardSummary ?? ''}`,
        `${candidate.title} ${candidate.description} ${candidate.awardSummary ?? ''}`,
      ) >= 0.2,
      sameMember: Boolean(candidate.grievantId && candidate.grievantId === currentCase.grievantId),
    };

    const score =
      (matchedDimensions.grievanceType ? 25 : 0) +
      (matchedDimensions.agreement ? 25 : 0) +
      (matchedDimensions.employerOrWorksite ? 20 : 0) +
      (matchedDimensions.summarySimilarity ? 15 : 0) +
      (matchedDimensions.sameMember ? 15 : 0);

    if (score === 0) continue;

    const matchReasons = [
      matchedDimensions.grievanceType ? 'Same grievance type' : null,
      matchedDimensions.agreement ? 'Same agreement' : null,
      matchedDimensions.employerOrWorksite ? 'Same employer/worksite' : null,
      matchedDimensions.summarySimilarity ? 'Summary similarity' : null,
      matchedDimensions.sameMember ? 'Same member' : null,
    ].filter(Boolean) as string[];

    logger.info('Case intelligence similar-case ranked', {
      caseId: params.context.caseId,
      candidateCaseId: candidate.id,
      score,
      reasons: matchReasons,
    });

    results.push({
      caseId: candidate.id,
      score,
      matchReasons,
      matchedDimensions,
      title: candidate.title,
      grievanceNumber: candidate.grievanceNumber ?? undefined,
      status: candidate.status ?? undefined,
    });
  }

  return results.sort((left, right) => right.score - left.score).slice(0, limit);
}
