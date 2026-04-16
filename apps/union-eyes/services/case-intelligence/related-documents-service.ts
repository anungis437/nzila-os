import { and, desc, eq, or, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { grievanceCaseAccessAssignments } from '@/db/schema/domains/claims/grievance-lifecycle';
import { documents, documentLinks } from '@/db/schema/documents-schema';
import { logger } from '@/lib/logger';
import {
  filterAuthorizedDocumentsForActor,
  type DocumentAuthorizationActor,
} from '@/lib/services/document-authorization-service';
import { extractFeatures } from '@/services/case-intelligence/feature-extractor';
import { computeMlScore, getCaseIntelligenceConfig } from '@/services/case-intelligence/ml-relevance-service';
import { computeTokenOverlapSimilarity } from '@/services/case-intelligence/similarity-provider';
import { computeBaseScore, mergeScores } from '@/services/case-intelligence/scoring-engine';
import type { CaseSnapshot, DocumentCandidate, IntelligenceContext, RelatedDocumentRankResult } from '@/services/case-intelligence/types';

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
      employerName: grievances.employerName,
      workplaceId: grievances.workplaceId,
      workplaceName: grievances.workplaceName,
      cbaId: grievances.cbaId,
      cbaArticle: grievances.cbaArticle,
      unionRepId: grievances.unionRepId,
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

async function getAssignedLroIds(params: { organizationId: string; caseId: string; primaryLroId: string | null | undefined }) {
  const collaboratorRows = await db
    .select({ userId: grievanceCaseAccessAssignments.userId })
    .from(grievanceCaseAccessAssignments)
    .where(
      and(
        eq(grievanceCaseAccessAssignments.organizationId, params.organizationId),
        eq(grievanceCaseAccessAssignments.grievanceId, params.caseId),
        eq(grievanceCaseAccessAssignments.status, 'active'),
      ),
    );

  const ids = new Set<string>();
  if (params.primaryLroId) ids.add(params.primaryLroId);
  for (const row of collaboratorRows) ids.add(row.userId);
  return ids;
}

function titleForDocument(row: DocumentCandidate) {
  return row.title || row.filename || row.name || 'Untitled document';
}

function dedupeDocuments(rows: DocumentCandidate[]) {
  const map = new Map<string, DocumentCandidate>();
  for (const row of rows) {
    if (!map.has(row.id)) {
      map.set(row.id, row);
      continue;
    }

    const existing = map.get(row.id)!;
    const existingTags = new Set(existing.tags ?? []);
    for (const tag of row.tags ?? []) {
      existingTags.add(tag);
    }

    map.set(row.id, {
      ...existing,
      tags: [...existingTags],
      linkedEntityType: existing.linkedEntityType ?? row.linkedEntityType,
      linkedEntityId: existing.linkedEntityId ?? row.linkedEntityId,
    });
  }
  return [...map.values()];
}

function collectLinkedEntities(candidate: DocumentCandidate, currentCase: CaseSnapshot, similarCaseIds: Set<string>) {
  const entities = new Set<string>();
  if (candidate.linkedEntityType === 'grievance' && candidate.linkedEntityId === currentCase.id) {
    entities.add(`case:${currentCase.id}`);
  }
  if (currentCase.grievantId && candidate.linkedEntityType === 'member' && candidate.linkedEntityId === currentCase.grievantId) {
    entities.add(`member:${currentCase.grievantId}`);
  }
  if (currentCase.cbaId && candidate.linkedEntityType === 'collective_agreement' && candidate.linkedEntityId === currentCase.cbaId) {
    entities.add(`agreement:${currentCase.cbaId}`);
  }
  if (currentCase.employerId && candidate.linkedEntityType === 'employer' && candidate.linkedEntityId === currentCase.employerId) {
    entities.add(`employer:${currentCase.employerId}`);
  }
  if (currentCase.workplaceId && candidate.linkedEntityType === 'worksite' && candidate.linkedEntityId === currentCase.workplaceId) {
    entities.add(`worksite:${currentCase.workplaceId}`);
  }
  if (candidate.documentType) entities.add(`type:${candidate.documentType}`);
  if (candidate.linkedEntityType === 'grievance' && candidate.linkedEntityId && similarCaseIds.has(candidate.linkedEntityId)) {
    entities.add(`case:${candidate.linkedEntityId}`);
  }
  for (const tag of candidate.tags ?? []) {
    entities.add(`tag:${tag}`);
  }
  return [...entities];
}

export async function getRelatedDocuments(params: {
  context: IntelligenceContext;
  actor: DocumentAuthorizationActor;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(params.limit ?? 20, 200));
  const config = await getCaseIntelligenceConfig(params.context);
  const currentCase = await getCaseSnapshot(params.context.caseId, params.context.orgId);

  if (!currentCase) {
    return [] as RelatedDocumentRankResult[];
  }

  const baseRows = dedupeDocuments((await db
    .select({
      id: documents.id,
      title: documents.title,
      filename: documents.filename,
      name: documents.name,
      privacyLabel: documents.privacyLabel,
      documentType: documents.documentType,
      fileUrl: documents.fileUrl,
      updatedAt: documents.updatedAt,
      linkedEntityType: documentLinks.linkedEntityType,
      linkedEntityId: documentLinks.linkedEntityId,
      tags: documents.tags,
      uploadedBy: documents.uploadedBy,
    })
    .from(documents)
    .leftJoin(documentLinks, eq(documentLinks.documentId, documents.id))
    .where(and(eq(documents.organizationId, params.context.orgId), sql`${documents.deletedAt} IS NULL`))
    .orderBy(desc(documents.updatedAt))
    .limit(250)) as DocumentCandidate[]).slice(0, 200);

  const directCaseRows = baseRows.filter(
    (row) => row.linkedEntityType === 'grievance' && row.linkedEntityId === params.context.caseId,
  );

  const similarCaseRows = currentCase.grievantId || currentCase.employerId || currentCase.cbaId
    ? await db
        .select({ id: grievances.id })
        .from(grievances)
        .where(
          and(
            eq(grievances.organizationId, params.context.orgId),
            sql`${grievances.id} <> ${params.context.caseId}::uuid`,
            or(
              currentCase.grievantId ? eq(grievances.grievantId, currentCase.grievantId) : sql`false`,
              currentCase.employerId ? eq(grievances.employerId, currentCase.employerId) : sql`false`,
              currentCase.cbaId ? eq(grievances.cbaId, currentCase.cbaId) : sql`false`,
            ),
          ),
        )
        .orderBy(desc(grievances.createdAt))
        .limit(25)
    : [];

  const similarCaseIds = new Set(similarCaseRows.map((row) => row.id));
  const authorizedInput = baseRows.map((row) => ({
    id: row.id,
    privacyLabel: row.privacyLabel,
    linkedEntityType: row.linkedEntityType,
    linkedEntityId: row.linkedEntityId,
  }));

  const authorizedDocs = await filterAuthorizedDocumentsForActor({
    organizationId: params.context.orgId,
    actor: params.actor,
    documents: authorizedInput,
  });
  const authorizedIds = new Set(authorizedDocs.map((doc) => doc.id));

  const directTags = new Set(
    directCaseRows
      .filter((row) => authorizedIds.has(row.id))
      .flatMap((row) => row.tags ?? [])
      .map((tag) => tag.toLowerCase()),
  );
  const directTypes = new Set(
    directCaseRows
      .filter((row) => authorizedIds.has(row.id))
      .map((row) => row.documentType)
      .filter(Boolean),
  );
  const assignedLroIds = await getAssignedLroIds({
    organizationId: params.context.orgId,
    caseId: params.context.caseId,
    primaryLroId: currentCase.unionRepId,
  });

  const ranked = [] as RelatedDocumentRankResult[];
  for (const candidate of baseRows) {
    if (!authorizedIds.has(candidate.id)) continue;

    const sameCase = candidate.linkedEntityType === 'grievance' && candidate.linkedEntityId === currentCase.id;
    const sameDocumentType = Boolean(candidate.documentType && directTypes.has(candidate.documentType));
    const semanticSimilarity = computeTokenOverlapSimilarity(
      `${currentCase.title} ${currentCase.description} ${currentCase.awardSummary ?? ''}`,
      `${titleForDocument(candidate)} ${(candidate.tags ?? []).join(' ')}`,
    );

    const features = extractFeatures({
      currentCase,
      candidate,
      sameCase,
      sameDocumentType,
      directTags,
      assignedLroIds,
      semanticSimilarity,
      patternSimilarity: candidate.linkedEntityType === 'grievance' && candidate.linkedEntityId && similarCaseIds.has(candidate.linkedEntityId) ? 0.75 : 0,
      usedInSimilarCase: Boolean(candidate.linkedEntityType === 'grievance' && candidate.linkedEntityId && similarCaseIds.has(candidate.linkedEntityId)),
      isTemplateCandidate: (candidate.tags ?? []).some((tag) => ['template', 'precedent'].includes(tag.toLowerCase())),
    });

    const deterministic = computeBaseScore(features);
    if (deterministic.baseScore === 0) continue;

    const ml = await computeMlScore({
      context: params.context,
      features,
      candidateId: candidate.id,
      config,
    });

    const finalScore = mergeScores({
      baseScore: deterministic.baseScore,
      mlScore: ml.mlScore,
      mlEnabled: config.mlEnabled && ml.available,
    });

    const result = {
      documentId: candidate.id,
      title: titleForDocument(candidate),
      privacyLabel: candidate.privacyLabel,
      finalScore,
      baseScore: deterministic.baseScore,
      mlScore: ml.available ? ml.mlScore : 0,
      reasons: [...new Set([...deterministic.reasons, ...ml.reasons])],
      scoreBreakdown: {
        ...deterministic.scoreBreakdown,
        semanticSimilarity: Number(features.semanticSimilarity.toFixed(3)),
        patternSimilarity: Number(features.patternSimilarity.toFixed(3)),
      },
      documentType: candidate.documentType,
      fileUrl: candidate.fileUrl,
      linkedEntities: collectLinkedEntities(candidate, currentCase, similarCaseIds),
      updatedAt: candidate.updatedAt.toISOString(),
    } satisfies RelatedDocumentRankResult;

    logger.info('Case intelligence related-document ranked', {
      caseId: params.context.caseId,
      documentId: result.documentId,
      candidateCount: baseRows.length,
      authorizedCount: authorizedIds.size,
      baseScore: result.baseScore,
      mlScore: result.mlScore,
      finalScore: result.finalScore,
      reasons: result.reasons,
    });

    ranked.push(result);
  }

  return ranked
    .sort((left, right) => {
      if (right.finalScore !== left.finalScore) return right.finalScore - left.finalScore;
      if ((right.updatedAt ?? '') !== (left.updatedAt ?? '')) {
        return (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '');
      }
      return left.documentId.localeCompare(right.documentId);
    })
    .slice(0, limit);
}
