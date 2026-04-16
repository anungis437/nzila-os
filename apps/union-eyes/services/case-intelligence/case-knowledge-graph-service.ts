import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { collectiveAgreements } from '@/db/schema/domains/agreements/collective-agreements';
import { organizationMembers } from '@/db/schema/organization-members-schema';
import type { DocumentAuthorizationActor } from '@/lib/services/document-authorization-service';
import { getRelatedDocuments } from '@/services/case-intelligence/related-documents-service';
import type { IntelligenceContext } from '@/services/case-intelligence/types';

function nodeId(type: string, value: string) {
  return `${type}:${value}`;
}

function edgeId(from: string, to: string, type: string) {
  return `${from}:${type}:${to}`;
}

export async function buildCaseGraph(params: {
  context: IntelligenceContext;
  actor: DocumentAuthorizationActor;
}) {
  const [caseRow] = await db
    .select({
      id: grievances.id,
      grievanceNumber: grievances.grievanceNumber,
      title: grievances.title,
      grievantId: grievances.grievantId,
      unionRepId: grievances.unionRepId,
      cbaId: grievances.cbaId,
      employerId: grievances.employerId,
      employerName: grievances.employerName,
      workplaceId: grievances.workplaceId,
      workplaceName: grievances.workplaceName,
      cbaArticle: grievances.cbaArticle,
      organizationId: grievances.organizationId,
    })
    .from(grievances)
    .where(and(eq(grievances.id, params.context.caseId), eq(grievances.organizationId, params.context.orgId)))
    .limit(1);

  if (!caseRow) {
    return { nodes: [], edges: [] };
  }

  const relatedDocuments = await getRelatedDocuments({
    context: params.context,
    actor: params.actor,
    limit: 30,
  });

  const memberRows = caseRow.grievantId
    ? await db
        .select({
          userId: organizationMembers.userId,
          name: organizationMembers.name,
        })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, params.context.orgId),
            eq(organizationMembers.userId, caseRow.grievantId),
          ),
        )
    : [];

  const agreementRows = caseRow.cbaId
    ? await db
        .select({ id: collectiveAgreements.id, title: collectiveAgreements.title })
        .from(collectiveAgreements)
        .where(
          and(
            eq(collectiveAgreements.organizationId, params.context.orgId),
            eq(collectiveAgreements.id, caseRow.cbaId),
          ),
        )
    : [];

  const nodeMap = new Map<string, { id: string; type: string; label: string; metadata?: Record<string, unknown> }>();
  const edgeMap = new Map<string, { id: string; from: string; to: string; type: string; metadata?: Record<string, unknown> }>();

  const addNode = (node: { id: string; type: string; label: string; metadata?: Record<string, unknown> }) => {
    if (!nodeMap.has(node.id)) nodeMap.set(node.id, node);
  };
  const addEdge = (edge: { id: string; from: string; to: string; type: string; metadata?: Record<string, unknown> }) => {
    if (!edgeMap.has(edge.id)) edgeMap.set(edge.id, edge);
  };

  const caseNodeId = nodeId('case', caseRow.id);
  addNode({
    id: caseNodeId,
    type: 'case',
    label: caseRow.grievanceNumber || caseRow.title,
    metadata: { cbaArticle: caseRow.cbaArticle },
  });

  if (caseRow.grievantId) {
    const memberNodeId = nodeId('member', caseRow.grievantId);
    addNode({ id: memberNodeId, type: 'member', label: memberRows[0]?.name || caseRow.grievantId });
    addEdge({ id: edgeId(caseNodeId, memberNodeId, 'case_member'), from: caseNodeId, to: memberNodeId, type: 'case_member' });
  }

  if (caseRow.unionRepId) {
    const lroNodeId = nodeId('lro', caseRow.unionRepId);
    addNode({ id: lroNodeId, type: 'lro', label: caseRow.unionRepId });
    addEdge({ id: edgeId(caseNodeId, lroNodeId, 'case_lro'), from: caseNodeId, to: lroNodeId, type: 'case_lro' });
  }

  if (caseRow.cbaId) {
    const agreementNodeId = nodeId('agreement', caseRow.cbaId);
    addNode({ id: agreementNodeId, type: 'agreement', label: agreementRows[0]?.title || caseRow.cbaId });
    addEdge({ id: edgeId(caseNodeId, agreementNodeId, 'case_agreement'), from: caseNodeId, to: agreementNodeId, type: 'case_agreement' });
  }

  if (caseRow.employerId || caseRow.employerName) {
    const employerKey = caseRow.employerId || caseRow.employerName || 'unknown';
    const employerNodeId = nodeId('employer', employerKey);
    addNode({ id: employerNodeId, type: 'employer', label: caseRow.employerName || employerKey });
    addEdge({ id: edgeId(caseNodeId, employerNodeId, 'case_employer'), from: caseNodeId, to: employerNodeId, type: 'case_employer' });
  }

  if (caseRow.workplaceId || caseRow.workplaceName) {
    const worksiteKey = caseRow.workplaceId || caseRow.workplaceName || 'unknown';
    const worksiteNodeId = nodeId('worksite', worksiteKey);
    addNode({ id: worksiteNodeId, type: 'worksite', label: caseRow.workplaceName || worksiteKey });
    addEdge({ id: edgeId(caseNodeId, worksiteNodeId, 'case_worksite'), from: caseNodeId, to: worksiteNodeId, type: 'case_worksite' });
  }

  for (const document of relatedDocuments) {
    const documentNodeId = nodeId('document', document.documentId);
    addNode({
      id: documentNodeId,
      type: 'document',
      label: document.title,
      metadata: {
        privacyLabel: document.privacyLabel,
        reasons: document.reasons,
        finalScore: document.finalScore,
      },
    });
    addEdge({
      id: edgeId(caseNodeId, documentNodeId, 'case_document'),
      from: caseNodeId,
      to: documentNodeId,
      type: 'case_document',
      metadata: { reasons: document.reasons },
    });

    for (const entity of document.linkedEntities ?? []) {
      const [rawType, rawId] = entity.split(':');
      if (!rawType || !rawId) continue;
      const entityNodeId = nodeId(rawType, rawId);
      addNode({ id: entityNodeId, type: rawType, label: rawId });
      addEdge({
        id: edgeId(documentNodeId, entityNodeId, `document_${rawType}`),
        from: documentNodeId,
        to: entityNodeId,
        type: `document_${rawType}`,
      });
    }
  }

  return {
    nodes: [...nodeMap.values()],
    edges: [...edgeMap.values()],
  };
}
