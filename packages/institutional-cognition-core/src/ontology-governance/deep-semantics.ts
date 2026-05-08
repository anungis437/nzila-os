/**
 * Deep Institutional Semantics
 *
 * Pure, declarative semantic infrastructure layered on top of the canonical
 * ontology. Provides:
 *   - canonical institutional taxonomy trees (per cognition domain)
 *   - semantic inheritance maps (parent → child concept relationships)
 *   - cognition-domain ↔ ontology binding registry
 *   - lifecycle / deprecation metadata for individual semantic terms
 *   - drift, deprecation, and inheritance validators usable by CI
 *
 * NOTHING in this module performs autonomous reasoning. All exports are
 * pure functions or readonly data. Used by:
 *   - ontology lifecycle CI
 *   - storytelling layer (apps/union-eyes/lib/institutional-storytelling)
 *   - executive surfaces (semantic chips, taxonomy explorer)
 */

import {
  COGNITION_DOMAINS,
  type CognitionDomain,
} from '../ontology/index.js';
import {
  GOVERNANCE_VOCABULARY,
  CONTINUITY_LEXICON,
  INSTITUTIONAL_ONTOLOGY_VERSION,
} from './index.js';

/* -------------------------------------------------------------------------- */
/* Taxonomy node                                                               */
/* -------------------------------------------------------------------------- */

export interface SemanticTaxonomyNode {
  /** Stable identifier — kebab-case, unique within its domain. */
  readonly id: string;
  /** Human-friendly display label. */
  readonly label: string;
  /** Short institutional definition. */
  readonly definition: string;
  /** Cognition domain this node belongs to. */
  readonly domain: CognitionDomain;
  /** Optional parent id (within the same domain) — establishes inheritance. */
  readonly parentId?: string;
  /** Lifecycle status. `deprecated` nodes must declare `replacedBy`. */
  readonly status: 'active' | 'deprecated';
  /** When deprecated, the canonical successor node id. */
  readonly replacedBy?: string;
  /** Optional canonical vocabulary terms this node binds to. */
  readonly vocabulary?: readonly string[];
}

/* -------------------------------------------------------------------------- */
/* Canonical Taxonomies                                                        */
/* -------------------------------------------------------------------------- */

const GOVERNANCE_TAXONOMY: readonly SemanticTaxonomyNode[] = [
  {
    id: 'governance-posture',
    label: 'Governance Posture',
    definition: 'Aggregate stance of an institution toward governed action and review.',
    domain: 'governance',
    status: 'active',
  },
  {
    id: 'governance-coherence',
    label: 'Governance Coherence',
    definition: 'Internal alignment between governance actions, reviews, and outcomes.',
    domain: 'governance',
    parentId: 'governance-posture',
    status: 'active',
    vocabulary: ['governance coherence'],
  },
  {
    id: 'governance-momentum',
    label: 'Governance Momentum',
    definition: 'Direction and pace of governance maturation across review cycles.',
    domain: 'governance',
    parentId: 'governance-posture',
    status: 'active',
    vocabulary: ['governance momentum'],
  },
];

const CONTINUITY_TAXONOMY: readonly SemanticTaxonomyNode[] = [
  {
    id: 'continuity-baseline',
    label: 'Continuity Baseline',
    definition: 'Current institutional ability to sustain operations through transition events.',
    domain: 'continuity',
    status: 'active',
  },
  {
    id: 'continuity-plan',
    label: 'Continuity Plan',
    definition: 'A declared, reviewable plan for sustaining a critical operational thread.',
    domain: 'continuity',
    parentId: 'continuity-baseline',
    status: 'active',
    vocabulary: ['continuity plan'],
  },
  {
    id: 'continuity-forecast',
    label: 'Continuity Forecast',
    definition: 'Projected continuity trajectory under current institutional conditions.',
    domain: 'continuity',
    parentId: 'continuity-baseline',
    status: 'active',
    vocabulary: ['continuity forecast'],
  },
  {
    id: 'continuity-drift',
    label: 'Continuity Drift',
    definition: 'Gradual erosion of continuity posture absent corrective governance action.',
    domain: 'continuity',
    parentId: 'continuity-baseline',
    status: 'active',
    vocabulary: ['continuity drift'],
  },
];

const RESILIENCE_TAXONOMY: readonly SemanticTaxonomyNode[] = [
  {
    id: 'resilience-baseline',
    label: 'Resilience Baseline',
    definition: 'Current institutional ability to absorb, adapt to, and recover from shocks.',
    domain: 'resilience',
    status: 'active',
    vocabulary: ['resilience baseline'],
  },
  {
    id: 'resilience-trajectory',
    label: 'Resilience Trajectory',
    definition: 'Direction and pace of resilience growth or erosion over time.',
    domain: 'resilience',
    parentId: 'resilience-baseline',
    status: 'active',
    vocabulary: ['resilience trajectory'],
  },
  {
    id: 'mitigation-maturity',
    label: 'Mitigation Maturity',
    definition: 'Maturity of declared mitigations against modeled continuity risks.',
    domain: 'resilience',
    parentId: 'resilience-baseline',
    status: 'active',
    vocabulary: ['mitigation maturity'],
  },
];

const PROCEDURAL_TAXONOMY: readonly SemanticTaxonomyNode[] = [
  {
    id: 'procedural-integrity',
    label: 'Procedural Integrity',
    definition: 'Soundness of institutional procedures as authored, applied, and reviewed.',
    domain: 'procedural_intelligence',
    status: 'active',
  },
  {
    id: 'procedural-continuity',
    label: 'Procedural Continuity',
    definition: 'Persistence of procedural intent across personnel and structural change.',
    domain: 'procedural_intelligence',
    parentId: 'procedural-integrity',
    status: 'active',
    vocabulary: ['procedural continuity'],
  },
];

const COORDINATION_TAXONOMY: readonly SemanticTaxonomyNode[] = [
  {
    id: 'coordination-coherence',
    label: 'Coordination Coherence',
    definition: 'Cross-actor alignment when executing governed institutional work.',
    domain: 'coordination',
    status: 'active',
  },
];

const TRUST_TAXONOMY: readonly SemanticTaxonomyNode[] = [
  {
    id: 'operational-trust',
    label: 'Operational Trust',
    definition: 'Institutional confidence that procedures will execute as authored.',
    domain: 'operational_trust',
    status: 'active',
    vocabulary: ['operational trust'],
  },
];

const MEMORY_TAXONOMY: readonly SemanticTaxonomyNode[] = [
  {
    id: 'institutional-memory',
    label: 'Institutional Memory',
    definition: 'Persistent record of institutional decisions, contexts, and outcomes.',
    domain: 'institutional_memory',
    status: 'active',
    vocabulary: ['institutional memory'],
  },
  {
    id: 'institutional-precedent',
    label: 'Institutional Precedent',
    definition: 'Memory captures elevated to reusable governance reference.',
    domain: 'precedent',
    status: 'active',
    vocabulary: ['institutional precedent'],
  },
];

const ADAPTATION_TAXONOMY: readonly SemanticTaxonomyNode[] = [
  {
    id: 'institutional-learning',
    label: 'Institutional Learning',
    definition: 'Durable shifts in institutional behavior derived from reviewed experience.',
    domain: 'adaptation',
    status: 'active',
    vocabulary: ['institutional learning'],
  },
];

const SYSTEMS_TAXONOMY: readonly SemanticTaxonomyNode[] = [
  {
    id: 'systems-coherence',
    label: 'Systems Coherence',
    definition: 'Integrated alignment across cognition domains as a single institutional posture.',
    domain: 'systems_coherence',
    status: 'active',
    vocabulary: ['systems coherence', 'cross-domain correlation'],
  },
];

const PRECEDENT_TAXONOMY: readonly SemanticTaxonomyNode[] = [];

/**
 * Canonical institutional taxonomy. Closed registry; CI rejects parallel
 * taxonomies declared elsewhere.
 */
export const INSTITUTIONAL_TAXONOMY: readonly SemanticTaxonomyNode[] = [
  ...GOVERNANCE_TAXONOMY,
  ...CONTINUITY_TAXONOMY,
  ...RESILIENCE_TAXONOMY,
  ...PROCEDURAL_TAXONOMY,
  ...COORDINATION_TAXONOMY,
  ...TRUST_TAXONOMY,
  ...MEMORY_TAXONOMY,
  ...ADAPTATION_TAXONOMY,
  ...SYSTEMS_TAXONOMY,
  ...PRECEDENT_TAXONOMY,
];

/* -------------------------------------------------------------------------- */
/* Lookups                                                                     */
/* -------------------------------------------------------------------------- */

const NODE_INDEX: ReadonlyMap<string, SemanticTaxonomyNode> = new Map(
  INSTITUTIONAL_TAXONOMY.map((n) => [n.id, n] as const),
);

export function getTaxonomyNode(id: string): SemanticTaxonomyNode | undefined {
  return NODE_INDEX.get(id);
}

export function taxonomyForDomain(domain: CognitionDomain): SemanticTaxonomyNode[] {
  return INSTITUTIONAL_TAXONOMY.filter((n) => n.domain === domain);
}

/**
 * Walk inheritance from a node up to its top-level parent within its domain.
 * Returns `[self, parent, grandparent, ...]`. Detects cycles defensively.
 */
export function ancestorsOf(id: string): SemanticTaxonomyNode[] {
  const chain: SemanticTaxonomyNode[] = [];
  const seen = new Set<string>();
  let current = NODE_INDEX.get(id);
  while (current && !seen.has(current.id)) {
    chain.push(current);
    seen.add(current.id);
    current = current.parentId ? NODE_INDEX.get(current.parentId) : undefined;
  }
  return chain;
}

export function descendantsOf(id: string): SemanticTaxonomyNode[] {
  const out: SemanticTaxonomyNode[] = [];
  const stack: string[] = [id];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    for (const node of INSTITUTIONAL_TAXONOMY) {
      if (node.parentId === cur) {
        out.push(node);
        stack.push(node.id);
      }
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

export interface DeepSemanticIssue {
  code:
    | 'unknown_parent'
    | 'cross_domain_inheritance'
    | 'deprecated_without_replacement'
    | 'replacement_not_found'
    | 'orphaned_vocabulary'
    | 'duplicate_node_id'
    | 'cycle_detected';
  nodeId: string;
  message: string;
}

export interface DeepSemanticValidationReport {
  ontologyVersion: string;
  checkedAt: string;
  ok: boolean;
  issues: DeepSemanticIssue[];
}

const KNOWN_VOCABULARY: ReadonlySet<string> = new Set<string>([
  ...GOVERNANCE_VOCABULARY,
  ...CONTINUITY_LEXICON,
]);

/**
 * Validate the canonical taxonomy registry for structural and lifecycle
 * integrity. Pure function — exclusively over the static registry.
 */
export function validateDeepSemantics(): DeepSemanticValidationReport {
  const issues: DeepSemanticIssue[] = [];
  const ids = new Set<string>();

  for (const node of INSTITUTIONAL_TAXONOMY) {
    if (ids.has(node.id)) {
      issues.push({
        code: 'duplicate_node_id',
        nodeId: node.id,
        message: `Duplicate taxonomy node id "${node.id}".`,
      });
    } else {
      ids.add(node.id);
    }
  }

  for (const node of INSTITUTIONAL_TAXONOMY) {
    if (node.parentId) {
      const parent = NODE_INDEX.get(node.parentId);
      if (!parent) {
        issues.push({
          code: 'unknown_parent',
          nodeId: node.id,
          message: `Parent "${node.parentId}" not registered.`,
        });
      } else if (parent.domain !== node.domain) {
        issues.push({
          code: 'cross_domain_inheritance',
          nodeId: node.id,
          message: `Node "${node.id}" inherits from "${node.parentId}" across cognition domains (${node.domain} ← ${parent.domain}).`,
        });
      }
    }

    if (node.status === 'deprecated') {
      if (!node.replacedBy) {
        issues.push({
          code: 'deprecated_without_replacement',
          nodeId: node.id,
          message: `Deprecated node "${node.id}" must declare replacedBy.`,
        });
      } else if (!NODE_INDEX.has(node.replacedBy)) {
        issues.push({
          code: 'replacement_not_found',
          nodeId: node.id,
          message: `Replacement "${node.replacedBy}" for deprecated "${node.id}" not registered.`,
        });
      }
    }

    if (node.vocabulary) {
      for (const term of node.vocabulary) {
        if (!KNOWN_VOCABULARY.has(term)) {
          issues.push({
            code: 'orphaned_vocabulary',
            nodeId: node.id,
            message: `Vocabulary term "${term}" not present in canonical dictionaries.`,
          });
        }
      }
    }

    // Cycle detection via ancestor walk.
    const chain = ancestorsOf(node.id);
    if (chain.length > 0 && chain.length !== new Set(chain.map((c) => c.id)).size) {
      issues.push({
        code: 'cycle_detected',
        nodeId: node.id,
        message: `Inheritance cycle detected at "${node.id}".`,
      });
    }
  }

  return {
    ontologyVersion: INSTITUTIONAL_ONTOLOGY_VERSION,
    checkedAt: new Date().toISOString(),
    ok: issues.length === 0,
    issues,
  };
}

/* -------------------------------------------------------------------------- */
/* Domain → Taxonomy binding registry                                          */
/* -------------------------------------------------------------------------- */

export interface DomainSemanticBinding {
  readonly domain: CognitionDomain;
  /** Top-level taxonomy node ids that anchor the domain's semantics. */
  readonly anchorNodeIds: readonly string[];
  /** Total number of registered taxonomy nodes in the domain. */
  readonly nodeCount: number;
  /** True if the domain has no registered taxonomy yet. */
  readonly empty: boolean;
}

export function listDomainSemanticBindings(): DomainSemanticBinding[] {
  return COGNITION_DOMAINS.map((domain) => {
    const nodes = taxonomyForDomain(domain);
    const anchors = nodes.filter((n) => !n.parentId).map((n) => n.id);
    return {
      domain,
      anchorNodeIds: anchors,
      nodeCount: nodes.length,
      empty: nodes.length === 0,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Lifecycle (deprecation) helpers                                             */
/* -------------------------------------------------------------------------- */

export interface SemanticDeprecationEntry {
  readonly nodeId: string;
  readonly replacedBy: string;
  readonly domain: CognitionDomain;
}

export function listDeprecations(): SemanticDeprecationEntry[] {
  return INSTITUTIONAL_TAXONOMY.filter(
    (n): n is SemanticTaxonomyNode & { replacedBy: string } =>
      n.status === 'deprecated' && typeof n.replacedBy === 'string',
  ).map((n) => ({ nodeId: n.id, replacedBy: n.replacedBy, domain: n.domain }));
}

/**
 * Resolve a (possibly deprecated) node id to its current canonical id by
 * following `replacedBy` links. Bounded to prevent infinite loops.
 */
export function resolveCurrentNodeId(id: string, maxHops = 8): string | undefined {
  let cur = id;
  for (let i = 0; i < maxHops; i += 1) {
    const node = NODE_INDEX.get(cur);
    if (!node) return undefined;
    if (node.status === 'active') return node.id;
    if (!node.replacedBy) return undefined;
    cur = node.replacedBy;
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Snapshot / drift                                                            */
/* -------------------------------------------------------------------------- */

export interface DeepSemanticSnapshot {
  readonly ontologyVersion: string;
  readonly capturedAt: string;
  readonly nodes: ReadonlyArray<{
    id: string;
    domain: CognitionDomain;
    parentId?: string;
    status: 'active' | 'deprecated';
  }>;
}

export function snapshotDeepSemantics(): DeepSemanticSnapshot {
  return {
    ontologyVersion: INSTITUTIONAL_ONTOLOGY_VERSION,
    capturedAt: new Date().toISOString(),
    nodes: INSTITUTIONAL_TAXONOMY.map((n) => ({
      id: n.id,
      domain: n.domain,
      parentId: n.parentId,
      status: n.status,
    })),
  };
}

export interface DeepSemanticDriftReport {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly addedNodeIds: string[];
  readonly removedNodeIds: string[];
  readonly reparentedNodeIds: string[];
  readonly newlyDeprecatedNodeIds: string[];
  /** Breaking when a node was REMOVED (not deprecated → tombstoned). */
  readonly breaking: boolean;
}

export function diffDeepSemantics(
  prev: DeepSemanticSnapshot,
  next: DeepSemanticSnapshot,
): DeepSemanticDriftReport {
  const prevById = new Map(prev.nodes.map((n) => [n.id, n] as const));
  const nextById = new Map(next.nodes.map((n) => [n.id, n] as const));

  const addedNodeIds: string[] = [];
  const removedNodeIds: string[] = [];
  const reparentedNodeIds: string[] = [];
  const newlyDeprecatedNodeIds: string[] = [];

  for (const id of nextById.keys()) {
    if (!prevById.has(id)) addedNodeIds.push(id);
  }
  for (const [id, prevNode] of prevById.entries()) {
    const nextNode = nextById.get(id);
    if (!nextNode) {
      removedNodeIds.push(id);
      continue;
    }
    if ((prevNode.parentId ?? null) !== (nextNode.parentId ?? null)) {
      reparentedNodeIds.push(id);
    }
    if (prevNode.status === 'active' && nextNode.status === 'deprecated') {
      newlyDeprecatedNodeIds.push(id);
    }
  }

  return {
    fromVersion: prev.ontologyVersion,
    toVersion: next.ontologyVersion,
    addedNodeIds,
    removedNodeIds,
    reparentedNodeIds,
    newlyDeprecatedNodeIds,
    breaking: removedNodeIds.length > 0,
  };
}
