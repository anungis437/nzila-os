import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { collectiveAgreements } from '@/db/schema/domains/agreements/collective-agreements';
import { organizationMembers } from '@/db/schema/organization-members-schema';
import { getRelatedDocuments, type RelatedDocument } from '@/lib/services/case-related-documents-service';
import type { DocumentAuthorizationActor } from '@/lib/services/document-authorization-service';

export type CaseGraphNodeType =
  | 'case'
  | 'document'
  | 'member'
  | 'lro'
  | 'collective_agreement'
  | 'policy'
  | 'employer'
  | 'worksite'
  | 'tag';

export type CaseGraphNode = {
  id: string;
  type: CaseGraphNodeType;
  label: string;
  metadata?: Record<string, unknown>;
};

export type CaseGraphEdge = {
  id: string;
  from: string;
  to: string;
  type: string;
  metadata?: Record<string, unknown>;
};

export type CaseKnowledgeGraph = {
  nodes: CaseGraphNode[];
  edges: CaseGraphEdge[];
  metadata: {
    generatedAt: string;
    nodeCount: number;
    edgeCount: number;
  };
};

function edgeId(from: string, to: string, type: string) {
  return `${from}:${type}:${to}`;
}

function nodeId(type: CaseGraphNodeType, value: string) {
  return `${type}:${value}`;
}

function addNode(map: Map<string, CaseGraphNode>, node: CaseGraphNode) {
  if (!map.has(node.id)) map.set(node.id, node);
}

function addEdge(map: Map<string, CaseGraphEdge>, edge: CaseGraphEdge) {
  if (!map.has(edge.id)) map.set(edge.id, edge);
}

function applyDocumentEntityEdges(params: {
  documentNodeId: string;
  linkedEntities: string[];
  nodes: Map<string, CaseGraphNode>;
  edges: Map<string, CaseGraphEdge>;
}) {
  for (const linkedEntity of params.linkedEntities) {
    const [rawType, rawId] = linkedEntity.split(':');
    if (!rawType || !rawId) continue;

    if (rawType === 'member') {
      const id = nodeId('member', rawId);
      addNode(params.nodes, { id, type: 'member', label: rawId });
      addEdge(params.edges, {
        id: edgeId(params.documentNodeId, id, 'document_member'),
        from: params.documentNodeId,
        to: id,
        type: 'document_member',
      });
      continue;
    }

    if (rawType === 'agreement') {
      const id = nodeId('collective_agreement', rawId);
      addNode(params.nodes, { id, type: 'collective_agreement', label: rawId });
      addEdge(params.edges, {
        id: edgeId(params.documentNodeId, id, 'document_agreement'),
        from: params.documentNodeId,
        to: id,
        type: 'document_agreement',
      });
      continue;
    }

    if (rawType === 'employer') {
      const id = nodeId('employer', rawId);
      addNode(params.nodes, { id, type: 'employer', label: rawId });
      addEdge(params.edges, {
        id: edgeId(params.documentNodeId, id, 'document_employer'),
        from: params.documentNodeId,
        to: id,
        type: 'document_employer',
      });
      continue;
    }

    if (rawType === 'worksite') {
      const id = nodeId('worksite', rawId);
      addNode(params.nodes, { id, type: 'worksite', label: rawId });
      addEdge(params.edges, {
        id: edgeId(params.documentNodeId, id, 'document_worksite'),
        from: params.documentNodeId,
        to: id,
        type: 'document_worksite',
      });
      continue;
    }

    if (rawType === 'type' || rawType === 'topic') {
      const id = nodeId('tag', rawId);
      addNode(params.nodes, { id, type: 'tag', label: rawId });
      addEdge(params.edges, {
        id: edgeId(params.documentNodeId, id, 'document_tag'),
        from: params.documentNodeId,
        to: id,
        type: 'document_tag',
      });
      continue;
    }
  }
}

export async function buildCaseGraph(params: {
  caseId: string;
  orgId: string;
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
      cbaArticle: grievances.cbaArticle,
      employerId: grievances.employerId,
      employerName: grievances.employerName,
      workplaceId: grievances.workplaceId,
      workplaceName: grievances.workplaceName,
      organizationId: grievances.organizationId,
    })
    .from(grievances)
    .where(and(eq(grievances.id, params.caseId), eq(grievances.organizationId, params.orgId)))
    .limit(1);

  if (!caseRow) {
    return {
      nodes: [],
      edges: [],
      metadata: {
        generatedAt: new Date().toISOString(),
        nodeCount: 0,
        edgeCount: 0,
      },
    } satisfies CaseKnowledgeGraph;
  }

  const relatedDocuments = await getRelatedDocuments({
    caseId: params.caseId,
    orgId: params.orgId,
    actor: params.actor,
    limit: 40,
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
            eq(organizationMembers.organizationId, params.orgId),
            eq(organizationMembers.userId, caseRow.grievantId),
          ),
        )
    : [];

  const agreementRows = caseRow.cbaId
    ? await db
        .select({
          id: collectiveAgreements.id,
          title: collectiveAgreements.title,
        })
        .from(collectiveAgreements)
        .where(
          and(
            eq(collectiveAgreements.organizationId, params.orgId),
            eq(collectiveAgreements.id, caseRow.cbaId),
          ),
        )
    : [];

  const nodes = new Map<string, CaseGraphNode>();
  const edges = new Map<string, CaseGraphEdge>();

  const caseNodeId = nodeId('case', caseRow.id);
  addNode(nodes, {
    id: caseNodeId,
    type: 'case',
    label: caseRow.grievanceNumber || caseRow.title,
    metadata: {
      cbaArticle: caseRow.cbaArticle,
    },
  });

  if (caseRow.grievantId) {
    const memberNodeId = nodeId('member', caseRow.grievantId);
    addNode(nodes, {
      id: memberNodeId,
      type: 'member',
      label: memberRows[0]?.name || caseRow.grievantId,
    });
    addEdge(edges, {
      id: edgeId(caseNodeId, memberNodeId, 'case_member'),
      from: caseNodeId,
      to: memberNodeId,
      type: 'case_member',
    });
  }

  if (caseRow.unionRepId) {
    const lroNodeId = nodeId('lro', caseRow.unionRepId);
    addNode(nodes, {
      id: lroNodeId,
      type: 'lro',
      label: caseRow.unionRepId,
      metadata: { role: 'primary' },
    });
    addEdge(edges, {
      id: edgeId(caseNodeId, lroNodeId, 'case_primary_lro'),
      from: caseNodeId,
      to: lroNodeId,
      type: 'case_primary_lro',
    });
  }

  if (caseRow.cbaId) {
    const agreementNodeId = nodeId('collective_agreement', caseRow.cbaId);
    addNode(nodes, {
      id: agreementNodeId,
      type: 'collective_agreement',
      label: agreementRows[0]?.title || caseRow.cbaId,
    });
    addEdge(edges, {
      id: edgeId(caseNodeId, agreementNodeId, 'case_agreement'),
      from: caseNodeId,
      to: agreementNodeId,
      type: 'case_agreement',
    });
  }

  if (caseRow.employerId || caseRow.employerName) {
    const employerValue = caseRow.employerId || caseRow.employerName || 'unknown';
    const employerNodeId = nodeId('employer', employerValue);
    addNode(nodes, {
      id: employerNodeId,
      type: 'employer',
      label: caseRow.employerName || employerValue,
    });
    addEdge(edges, {
      id: edgeId(caseNodeId, employerNodeId, 'case_employer'),
      from: caseNodeId,
      to: employerNodeId,
      type: 'case_employer',
    });
  }

  if (caseRow.workplaceId || caseRow.workplaceName) {
    const worksiteValue = caseRow.workplaceId || caseRow.workplaceName || 'unknown';
    const worksiteNodeId = nodeId('worksite', worksiteValue);
    addNode(nodes, {
      id: worksiteNodeId,
      type: 'worksite',
      label: caseRow.workplaceName || worksiteValue,
    });
    addEdge(edges, {
      id: edgeId(caseNodeId, worksiteNodeId, 'case_worksite'),
      from: caseNodeId,
      to: worksiteNodeId,
      type: 'case_worksite',
    });
  }

  for (const related of relatedDocuments) {
    applyDocumentGraph({
      related,
      caseNodeId,
      nodes,
      edges,
    });
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    metadata: {
      generatedAt: new Date().toISOString(),
      nodeCount: nodes.size,
      edgeCount: edges.size,
    },
  } satisfies CaseKnowledgeGraph;
}

function applyDocumentGraph(params: {
  related: RelatedDocument;
  caseNodeId: string;
  nodes: Map<string, CaseGraphNode>;
  edges: Map<string, CaseGraphEdge>;
}) {
  const documentNodeId = nodeId('document', params.related.documentId);
  addNode(params.nodes, {
    id: documentNodeId,
    type: 'document',
    label: params.related.title,
    metadata: {
      privacyLabel: params.related.privacyLabel,
      score: params.related.score,
      reasons: params.related.reasons,
      documentType: params.related.documentType,
    },
  });

  addEdge(params.edges, {
    id: edgeId(params.caseNodeId, documentNodeId, 'case_document'),
    from: params.caseNodeId,
    to: documentNodeId,
    type: 'case_document',
    metadata: {
      reasons: params.related.reasons,
      score: params.related.score,
    },
  });

  if (params.related.documentType) {
    const tagNodeId = nodeId('tag', params.related.documentType);
    addNode(params.nodes, {
      id: tagNodeId,
      type: 'tag',
      label: params.related.documentType,
    });
    addEdge(params.edges, {
      id: edgeId(documentNodeId, tagNodeId, 'document_tag'),
      from: documentNodeId,
      to: tagNodeId,
      type: 'document_tag',
    });
  }

  applyDocumentEntityEdges({
    documentNodeId,
    linkedEntities: params.related.linkedEntities,
    nodes: params.nodes,
    edges: params.edges,
  });
}
