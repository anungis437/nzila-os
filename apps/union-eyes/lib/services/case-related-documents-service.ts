import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { grievanceCaseAccessAssignments } from '@/db/schema/domains/claims/grievance-lifecycle';
import { documents, documentLinks } from '@/db/schema/documents-schema';
import {
  filterAuthorizedDocumentsForActor,
  type DocumentAuthorizationActor,
} from '@/lib/services/document-authorization-service';

const SCORING_FACTORS = {
  SAME_CASE: 50,
  SAME_MEMBER: 30,
  SAME_AGREEMENT: 25,
  SAME_EMPLOYER_OR_WORKSITE: 20,
  SHARED_TAGS: 15,
  SAME_DOC_TYPE: 10,
  RECENT_ASSIGNED_LRO_ACTIVITY: 10,
} as const;

export type RelatedDocument = {
  documentId: string;
  title: string;
  privacyLabel: string;
  documentType: string | null;
  fileUrl: string;
  score: number;
  reasons: string[];
  linkedEntities: string[];
  updatedAt: string;
};

export type RelatedDocumentSource =
  | 'same_case'
  | 'same_member'
  | 'same_agreement'
  | 'same_employer_or_worksite'
  | 'shared_tags'
  | 'same_document_type'
  | 'recent_assigned_lro_activity'
  | 'similar_case';

export type RelatedDocumentCandidate = {
  documentId: string;
  title: string;
  privacyLabel: string;
  documentType: string | null;
  fileUrl: string;
  updatedAt: Date;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  tags: string[];
  sourceSignals: Set<RelatedDocumentSource>;
  linkedEntities: Set<string>;
};

function titleForDocument(row: {
  title: string | null;
  filename: string | null;
  name: string;
}) {
  return row.title || row.filename || row.name || 'Untitled document';
}

function describeSource(source: RelatedDocumentSource) {
  switch (source) {
    case 'same_case':
      return 'Directly linked to this case';
    case 'same_member':
      return 'Same member';
    case 'same_agreement':
      return 'Same agreement';
    case 'same_employer_or_worksite':
      return 'Same employer/worksite';
    case 'shared_tags':
      return 'Shared tags/topic';
    case 'same_document_type':
      return 'Same document type';
    case 'recent_assigned_lro_activity':
      return 'Accessed by assigned LRO recently';
    case 'similar_case':
      return 'Referenced in similar case';
    default:
      return 'Related context';
  }
}

export function scoreCandidate(candidate: RelatedDocumentCandidate) {
  let score = 0;
  for (const source of candidate.sourceSignals) {
    if (source === 'same_case') score += SCORING_FACTORS.SAME_CASE;
    if (source === 'same_member') score += SCORING_FACTORS.SAME_MEMBER;
    if (source === 'same_agreement') score += SCORING_FACTORS.SAME_AGREEMENT;
    if (source === 'same_employer_or_worksite') score += SCORING_FACTORS.SAME_EMPLOYER_OR_WORKSITE;
    if (source === 'shared_tags') score += SCORING_FACTORS.SHARED_TAGS;
    if (source === 'same_document_type') score += SCORING_FACTORS.SAME_DOC_TYPE;
    if (source === 'recent_assigned_lro_activity') score += SCORING_FACTORS.RECENT_ASSIGNED_LRO_ACTIVITY;
    if (source === 'similar_case') score += SCORING_FACTORS.SAME_MEMBER;
  }

  return {
    score,
    reasons: [...candidate.sourceSignals].map(describeSource),
  };
}

function rankCandidates(candidates: RelatedDocumentCandidate[]) {
  return candidates
    .map((candidate) => {
      const scored = scoreCandidate(candidate);
      return {
        documentId: candidate.documentId,
        title: candidate.title,
        privacyLabel: candidate.privacyLabel,
        documentType: candidate.documentType,
        fileUrl: candidate.fileUrl,
        score: scored.score,
        reasons: scored.reasons,
        linkedEntities: [...candidate.linkedEntities],
        updatedAt: candidate.updatedAt.toISOString(),
      } satisfies RelatedDocument;
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.updatedAt !== a.updatedAt) return b.updatedAt.localeCompare(a.updatedAt);
      return a.documentId.localeCompare(b.documentId);
    });
}

function getOrCreateCandidate(
  map: Map<string, RelatedDocumentCandidate>,
  row: {
    id: string;
    title: string | null;
    filename: string | null;
    name: string;
    privacyLabel: string;
    documentType: string | null;
    fileUrl: string;
    updatedAt: Date;
    linkedEntityType: string | null;
    linkedEntityId: string | null;
    tags: string[] | null;
  },
) {
  const existing = map.get(row.id);
  if (existing) return existing;

  const created: RelatedDocumentCandidate = {
    documentId: row.id,
    title: titleForDocument(row),
    privacyLabel: row.privacyLabel,
    documentType: row.documentType,
    fileUrl: row.fileUrl,
    updatedAt: row.updatedAt,
    linkedEntityType: row.linkedEntityType,
    linkedEntityId: row.linkedEntityId,
    tags: row.tags ?? [],
    sourceSignals: new Set<RelatedDocumentSource>(),
    linkedEntities: new Set<string>(),
  };

  map.set(row.id, created);
  return created;
}

async function getAssignedLroIds(params: { organizationId: string; caseId: string; primaryLroId: string | null }) {
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
  return [...ids];
}

export async function getRelatedDocuments(params: {
  caseId: string;
  orgId: string;
  actor: DocumentAuthorizationActor;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(params.limit ?? 20, 100));

  const [caseRow] = await db
    .select({
      id: grievances.id,
      grievantId: grievances.grievantId,
      employerId: grievances.employerId,
      workplaceId: grievances.workplaceId,
      cbaId: grievances.cbaId,
      unionRepId: grievances.unionRepId,
      organizationId: grievances.organizationId,
      createdAt: grievances.createdAt,
    })
    .from(grievances)
    .where(and(eq(grievances.id, params.caseId), eq(grievances.organizationId, params.orgId)))
    .limit(1);

  if (!caseRow) {
    return [] as RelatedDocument[];
  }

  const candidateMap = new Map<string, RelatedDocumentCandidate>();

  const baseRows = await db
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
    .where(and(eq(documents.organizationId, params.orgId), sql`${documents.deletedAt} IS NULL`))
    .orderBy(desc(documents.updatedAt))
    .limit(300);

  const directCaseRows = baseRows.filter(
    (row) => row.linkedEntityType === 'grievance' && row.linkedEntityId === params.caseId,
  );

  const similarCaseRows = caseRow.grievantId || caseRow.employerId || caseRow.cbaId
    ? await db
        .select({ id: grievances.id })
        .from(grievances)
        .where(
          and(
            eq(grievances.organizationId, params.orgId),
            sql`${grievances.id} <> ${params.caseId}::uuid`,
            or(
              caseRow.grievantId ? eq(grievances.grievantId, caseRow.grievantId) : sql`false`,
              caseRow.employerId ? eq(grievances.employerId, caseRow.employerId) : sql`false`,
              caseRow.cbaId ? eq(grievances.cbaId, caseRow.cbaId) : sql`false`,
            ),
          ),
        )
        .orderBy(desc(grievances.createdAt))
        .limit(20)
    : [];

  const similarCaseIds = new Set(similarCaseRows.map((row) => row.id));
  const directTags = new Set(
    directCaseRows.flatMap((row) => row.tags ?? []).map((tag) => tag.toLowerCase()),
  );
  const directTypes = new Set(directCaseRows.map((row) => row.documentType).filter(Boolean));
  const assignedLroIds = await getAssignedLroIds({
    organizationId: params.orgId,
    caseId: params.caseId,
    primaryLroId: caseRow.unionRepId,
  });

  for (const row of baseRows) {
    const candidate = getOrCreateCandidate(candidateMap, row);

    if (row.linkedEntityType === 'grievance' && row.linkedEntityId === params.caseId) {
      candidate.sourceSignals.add('same_case');
      candidate.linkedEntities.add(`case:${params.caseId}`);
    }

    if (caseRow.grievantId && row.linkedEntityType === 'member' && row.linkedEntityId === caseRow.grievantId) {
      candidate.sourceSignals.add('same_member');
      candidate.linkedEntities.add(`member:${caseRow.grievantId}`);
    }

    if (caseRow.cbaId && row.linkedEntityType === 'collective_agreement' && row.linkedEntityId === caseRow.cbaId) {
      candidate.sourceSignals.add('same_agreement');
      candidate.linkedEntities.add(`agreement:${caseRow.cbaId}`);
    }

    if (
      (caseRow.employerId && row.linkedEntityId === caseRow.employerId) ||
      (caseRow.workplaceId && row.linkedEntityId === caseRow.workplaceId)
    ) {
      candidate.sourceSignals.add('same_employer_or_worksite');
      if (caseRow.employerId) candidate.linkedEntities.add(`employer:${caseRow.employerId}`);
      if (caseRow.workplaceId) candidate.linkedEntities.add(`worksite:${caseRow.workplaceId}`);
    }

    if ((row.tags ?? []).some((tag) => directTags.has(tag.toLowerCase()))) {
      candidate.sourceSignals.add('shared_tags');
      candidate.linkedEntities.add('topic:tags');
    }

    if (row.documentType && directTypes.has(row.documentType)) {
      candidate.sourceSignals.add('same_document_type');
      candidate.linkedEntities.add(`type:${row.documentType}`);
    }

    if (assignedLroIds.includes(row.uploadedBy)) {
      candidate.sourceSignals.add('recent_assigned_lro_activity');
      candidate.linkedEntities.add(`lro:${row.uploadedBy}`);
    }

    if (row.linkedEntityType === 'grievance' && row.linkedEntityId && similarCaseIds.has(row.linkedEntityId)) {
      candidate.sourceSignals.add('similar_case');
      candidate.linkedEntities.add(`case:${row.linkedEntityId}`);
    }
  }

  const preRanked = [...candidateMap.values()]
    .filter((candidate) => candidate.sourceSignals.size > 0)
    .slice(0, 220);

  const authInput = preRanked.map((candidate) => ({
    id: candidate.documentId,
    privacyLabel: candidate.privacyLabel,
    linkedEntityType: candidate.linkedEntityType,
    linkedEntityId: candidate.linkedEntityId,
  }));

  const authorized = await filterAuthorizedDocumentsForActor({
    organizationId: params.orgId,
    actor: params.actor,
    documents: authInput,
  });

  const authorizedIds = new Set(authorized.map((doc) => doc.id));

  return rankCandidates(preRanked.filter((candidate) => authorizedIds.has(candidate.documentId))).slice(0, limit);
}
