/**
 * Organizational Topic Graph Builder
 *
 * Maps operational knowledge relationships across published exit interviews.
 * Identifies topic co-occurrences, isolated knowledge clusters, and
 * operational concentration risks.
 *
 * Graph entities: departments, systems, vendors, processes, agreements,
 * recurring issues, governance obligations, specialized procedures.
 *
 * This produces a data structure ready for visualization or further analysis.
 * It does NOT rank employees or evaluate individual performance.
 */

import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { exitInterviews } from '@/db/schema';

export interface TopicNode {
  id: string;
  label: string;
  /** Number of interviews mentioning this topic */
  frequency: number;
  /** Roles that contributed this topic */
  contributingRoles: string[];
  /** 'system' | 'process' | 'governance' | 'vendor' | 'compliance' | 'general' */
  category: string;
}

export interface TopicEdge {
  source: string;
  target: string;
  /** Number of interviews where both topics co-occur */
  weight: number;
}

export interface TopicGraph {
  organizationId: string;
  generatedAt: string;
  nodes: TopicNode[];
  edges: TopicEdge[];
  /** Topics that appear in only one interview — isolated knowledge clusters */
  isolatedNodes: string[];
  /** Topics appearing in 3+ interviews — well-distributed knowledge */
  wellDistributedTopics: string[];
  /** Topics with high co-occurrence — operational interdependencies */
  concentrationClusters: Array<{ topics: string[]; risk: 'low' | 'medium' | 'high' }>;
}

const SYSTEM_KEYWORDS = ['system', 'software', 'platform', 'tool', 'application', 'database', 'tracker', 'portal'];
const VENDOR_KEYWORDS = ['vendor', 'provider', 'contractor', 'supplier', 'partner', 'insurer', 'consultant'];
const GOVERNANCE_KEYWORDS = ['committee', 'policy', 'bylaw', 'procedure', 'regulation', 'compliance', 'obligation', 'meeting', 'report'];
const COMPLIANCE_KEYWORDS = ['wsib', 'ohsa', 'esa', 'privacy', 'legal', 'arbitration', 'grievance', 'labour board'];

function categorize(tag: string): string {
  const lower = tag.toLowerCase();
  if (SYSTEM_KEYWORDS.some((k) => lower.includes(k))) return 'system';
  if (VENDOR_KEYWORDS.some((k) => lower.includes(k))) return 'vendor';
  if (GOVERNANCE_KEYWORDS.some((k) => lower.includes(k))) return 'governance';
  if (COMPLIANCE_KEYWORDS.some((k) => lower.includes(k))) return 'compliance';
  return 'general';
}

export async function buildTopicGraph(orgId: string): Promise<TopicGraph> {
  const interviews = await db
    .select({
      id: exitInterviews.id,
      roleInUnion: exitInterviews.roleInUnion,
      topics: exitInterviews.topics,
      expertiseTags: exitInterviews.expertiseTags,
    })
    .from(exitInterviews)
    .where(
      and(
        eq(exitInterviews.organizationId, orgId),
        eq(exitInterviews.status, 'published'),
      ),
    );

  // Build frequency map
  const nodeMap = new Map<
    string,
    { frequency: number; roles: Set<string>; category: string }
  >();

  for (const interview of interviews) {
    const allTags = [
      ...(interview.topics ?? []),
      ...(interview.expertiseTags ?? []),
    ].map((t) => t.toLowerCase().trim()).filter(Boolean);

    const seen = new Set<string>();
    for (const tag of allTags) {
      if (seen.has(tag)) continue;
      seen.add(tag);
      const existing = nodeMap.get(tag);
      if (existing) {
        existing.frequency++;
        existing.roles.add(interview.roleInUnion);
      } else {
        nodeMap.set(tag, { frequency: 1, roles: new Set([interview.roleInUnion]), category: categorize(tag) });
      }
    }
  }

  // Build co-occurrence edges
  const edgeMap = new Map<string, number>();
  for (const interview of interviews) {
    const allTags = [...new Set([
      ...(interview.topics ?? []),
      ...(interview.expertiseTags ?? []),
    ].map((t) => t.toLowerCase().trim()).filter(Boolean))];

    for (let i = 0; i < allTags.length; i++) {
      for (let j = i + 1; j < allTags.length; j++) {
        const key = [allTags[i], allTags[j]].sort().join('||');
        edgeMap.set(key, (edgeMap.get(key) ?? 0) + 1);
      }
    }
  }

  const nodes: TopicNode[] = [...nodeMap.entries()].map(([label, data]) => ({
    id: label.replace(/\s+/g, '_'),
    label,
    frequency: data.frequency,
    contributingRoles: [...data.roles],
    category: data.category,
  }));

  const edges: TopicEdge[] = [...edgeMap.entries()]
    .filter(([, weight]) => weight >= 2)
    .map(([key, weight]) => {
      const [source, target] = key.split('||');
      return {
        source: source.replace(/\s+/g, '_'),
        target: target.replace(/\s+/g, '_'),
        weight,
      };
    });

  const isolatedNodes = nodes.filter((n) => n.frequency === 1).map((n) => n.label);
  const wellDistributedTopics = nodes.filter((n) => n.frequency >= 3).map((n) => n.label);

  // High co-occurrence clusters (edges with weight ≥ 3)
  const concentrationClusters = edges
    .filter((e) => e.weight >= 3)
    .map((e) => ({
      topics: [e.source, e.target],
      risk: (e.weight >= 5 ? 'high' : e.weight >= 4 ? 'medium' : 'low') as 'low' | 'medium' | 'high',
    }));

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    nodes,
    edges,
    isolatedNodes,
    wellDistributedTopics,
    concentrationClusters,
  };
}
