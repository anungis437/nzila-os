import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db/db';
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
import type { CaseSnapshot, DocumentCandidate, IntelligenceContext, RelatedDocumentRankResult, SimilarCaseResult } from '@/services/case-intelligence/types';
import { grievances } from '@/db/schema/domains/claims/grievances';

async function getCaseSnapshot(caseId: string, orgId: string) {
  const [caseRow] = await db
    .select({
      id: grievances.id,
      title: grievances.title,
      description: grievances.description,
      grievantId: grievances.grievantId,
      employerId: grievances.employerId,
      workplaceId: grievances.workplaceId,
      cbaId: grievances.cbaId,
      unionRepId: grievances.unionRepId,
      awardSummary: grievances.background,
      organizationId: grievances.organizationId,
    })
    .from(grievances)
    .where(and(eq(grievances.id, caseId), eq(grievances.organizationId, orgId)))
    .limit(1);

  return (caseRow ?? null) as CaseSnapshot | null;
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

export async function findPrecedentDocuments(params: {
  context: IntelligenceContext;
  actor: DocumentAuthorizationActor;
  similarCases: SimilarCaseResult[];
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(params.limit ?? 10, 50));
  const config = await getCaseIntelligenceConfig(params.context);
  const currentCase = await getCaseSnapshot(params.context.caseId, params.context.orgId);
  if (!currentCase) {
    return [] as RelatedDocumentRankResult[];
  }

  const similarCaseIds = new Set(params.similarCases.map((item) => item.caseId));
  const rawCandidates = dedupeDocuments((await db
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

  const candidatePool = rawCandidates.filter((candidate) => {
    const tagSet = new Set((candidate.tags ?? []).map((tag) => tag.toLowerCase()));
    return (
      (candidate.linkedEntityType === 'grievance' && candidate.linkedEntityId && similarCaseIds.has(candidate.linkedEntityId)) ||
      (candidate.linkedEntityType === 'collective_agreement' && candidate.linkedEntityId === currentCase.cbaId) ||
      tagSet.has('template') ||
      tagSet.has('precedent')
    );
  });

  const authorizedDocs = await filterAuthorizedDocumentsForActor({
    organizationId: params.context.orgId,
    actor: params.actor,
    documents: candidatePool.map((candidate) => ({
      id: candidate.id,
      privacyLabel: candidate.privacyLabel,
      linkedEntityType: candidate.linkedEntityType,
      linkedEntityId: candidate.linkedEntityId,
    })),
  });
  const authorizedIds = new Set(authorizedDocs.map((doc) => doc.id));

  const results: RelatedDocumentRankResult[] = [];
  for (const candidate of candidatePool) {
    if (!authorizedIds.has(candidate.id)) continue;

    const tagSet = new Set((candidate.tags ?? []).map((tag) => tag.toLowerCase()));
    const features = extractFeatures({
      currentCase,
      candidate,
      sameCase: false,
      sameDocumentType: Boolean(candidate.documentType && ['award', 'brief', 'template'].includes(candidate.documentType)),
      directTags: new Set(['precedent', 'template', ...(candidate.tags ?? []).map((tag) => tag.toLowerCase())]),
      assignedLroIds: new Set(currentCase.unionRepId ? [currentCase.unionRepId] : []),
      semanticSimilarity: computeTokenOverlapSimilarity(
        `${currentCase.title} ${currentCase.description} ${currentCase.awardSummary ?? ''}`,
        `${titleForDocument(candidate)} ${(candidate.tags ?? []).join(' ')}`,
      ),
      patternSimilarity: candidate.linkedEntityType === 'grievance' && candidate.linkedEntityId && similarCaseIds.has(candidate.linkedEntityId) ? 0.8 : 0.2,
      usedInSimilarCase: Boolean(candidate.linkedEntityType === 'grievance' && candidate.linkedEntityId && similarCaseIds.has(candidate.linkedEntityId)),
      isTemplateCandidate: tagSet.has('template') || tagSet.has('precedent'),
    });

    const base = computeBaseScore(features);
    const ml = await computeMlScore({
      context: params.context,
      features,
      candidateId: candidate.id,
      config,
    });
    const finalScore = mergeScores({
      baseScore: base.baseScore,
      mlScore: ml.mlScore,
      mlEnabled: config.mlEnabled && ml.available,
    });

    const reasons = [...new Set([...base.reasons, ...ml.reasons, 'Safe precedent match'])];
    logger.info('Case intelligence precedent ranked', {
      caseId: params.context.caseId,
      documentId: candidate.id,
      finalScore,
      reasons,
    });

    results.push({
      documentId: candidate.id,
      title: titleForDocument(candidate),
      privacyLabel: candidate.privacyLabel,
      finalScore,
      baseScore: base.baseScore,
      mlScore: ml.available ? ml.mlScore : 0,
      reasons,
      scoreBreakdown: {
        ...base.scoreBreakdown,
        semanticSimilarity: Number(features.semanticSimilarity.toFixed(3)),
        patternSimilarity: Number(features.patternSimilarity.toFixed(3)),
      },
      documentType: candidate.documentType,
      fileUrl: candidate.fileUrl,
      linkedEntities: [
        candidate.linkedEntityId ? `${candidate.linkedEntityType}:${candidate.linkedEntityId}` : null,
        ...(candidate.tags ?? []).map((tag) => `tag:${tag}`),
      ].filter(Boolean) as string[],
      updatedAt: candidate.updatedAt.toISOString(),
    });
  }

  return results.sort((left, right) => right.finalScore - left.finalScore).slice(0, limit);
}
