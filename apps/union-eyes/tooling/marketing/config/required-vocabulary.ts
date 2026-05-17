/**
 * Required / rewarded vocabulary for UnionEyes public marketing surfaces.
 * Used by positive rules (coexistence, labour-safe AI, Canadian positioning).
 */

export interface RewardTerm {
  term: string;
  weight: number; // 1..3
}

export const COEXISTENCE_TERMS: RewardTerm[] = [
  { term: "overlay infrastructure", weight: 3 },
  { term: "continuity layer", weight: 3 },
  { term: "coexistence", weight: 2 },
  { term: "layered modernization", weight: 2 },
  { term: "modular adoption", weight: 2 },
  { term: "institutional evolution", weight: 2 },
  { term: "non-disruptive implementation", weight: 3 },
  { term: "alongside existing systems", weight: 2 },
  { term: "augments existing", weight: 2 },
  // Phase 4: coexistence-positioning bonus phrases
  { term: "non-displacing", weight: 3 },
  { term: "works with your existing stack", weight: 2 },
  { term: "preserves your existing systems", weight: 2 },
  { term: "respects existing tools", weight: 2 },
  { term: "interoperates with", weight: 1 },
  { term: "additive, not replacing", weight: 2 },
];

export const LABOUR_SAFE_AI_REQUIRED: RewardTerm[] = [
  { term: "human oversight", weight: 3 },
  { term: "explainability", weight: 2 },
  { term: "reviewability", weight: 2 },
  { term: "governance-safe AI", weight: 3 },
  { term: "assistive intelligence", weight: 2 },
  { term: "procedural transparency", weight: 2 },
];

// Workstream G: Institutional Observability Surfaces.
// Reward terms that signal the doctrine-aligned posture: chronology / lineage /
// provenance over scoring. Used by observability-surface narrative checks so
// the views earn maturity for naming what they are (institutional memory,
// procedural traceability) instead of borrowing operational-analytics framing.
export const OBSERVABILITY_DOCTRINE_REQUIRED: RewardTerm[] = [
  { term: "chronology", weight: 2 },
  { term: "lineage", weight: 3 },
  { term: "continuity pathways", weight: 3 },
  { term: "provenance", weight: 3 },
  { term: "explainability", weight: 2 },
  { term: "institutional memory", weight: 3 },
  { term: "procedural traceability", weight: 3 },
  { term: "governance-safe transparency", weight: 3 },
  { term: "continuity safeguards", weight: 2 },
  { term: "inspectable institutional states", weight: 3 },
  // Workstream I: Ontology reconciliation & institutional semantic governance.
  { term: "institutional continuity", weight: 3 },
  { term: "governance-safe visibility", weight: 3 },
  { term: "continuity-aware structures", weight: 3 },
];

// Workstream K: Institutional Topology UX.
// Reward terms that signal governance-safe, continuity-aware, inspectable
// topology posture across hierarchy, affiliation, delegation,
// representation, lineage, and continuity-aware structures.
export const TOPOLOGY_UX_REQUIRED: RewardTerm[] = [
  { term: "institutional topology", weight: 3 },
  { term: "continuity pathways", weight: 3 },
  { term: "governance lineage", weight: 3 },
  { term: "procedural ancestry", weight: 3 },
  { term: "continuity-aware structures", weight: 3 },
  { term: "inspectable institutional relationships", weight: 3 },
  { term: "governance-safe visibility", weight: 3 },
  { term: "representation continuity", weight: 3 },
  { term: "affiliation structure", weight: 2 },
  { term: "institutional hierarchy", weight: 2 },
  { term: "continuity-linked relationships", weight: 3 },
  { term: "preserved institutional records", weight: 3 },
];

// Workstream H: Source adapter completion and governance topology hydration.
// Reward terms that reinforce read-only, provenance-linked topology assembly.
export const TOPOLOGY_HYDRATION_REQUIRED: RewardTerm[] = [
  { term: "topology hydration", weight: 3 },
  { term: "source adapter", weight: 2 },
  { term: "normalized governance relationships", weight: 3 },
  { term: "chronology enrichment", weight: 3 },
  { term: "lineage hydration", weight: 3 },
  { term: "continuity projection", weight: 3 },
  { term: "provenance-linked", weight: 3 },
  { term: "read-only projection", weight: 3 },
  { term: "inspectable lineage", weight: 3 },
  { term: "institutional topology infrastructure", weight: 3 },
];

// Workstream L: Governance Chronology UX.
// Reward terms that signal governance-safe, continuity-aware, inspectable
// chronology posture across procedural timelines, institutional evolution,
// decision lineage, continuity progression, governance epochs, and
// chronology explainability surfaces.
export const CHRONOLOGY_UX_REQUIRED: RewardTerm[] = [
  { term: "governance chronology", weight: 3 },
  { term: "continuity progression", weight: 3 },
  { term: "procedural history", weight: 3 },
  { term: "chronology lineage", weight: 3 },
  { term: "governance epochs", weight: 3 },
  { term: "continuity-aware chronology", weight: 3 },
  { term: "institutional evolution", weight: 2 },
  { term: "preserved institutional records", weight: 3 },
  { term: "chronology explainability", weight: 3 },
  { term: "procedural timeline of record", weight: 3 },
  { term: "epoch divider", weight: 2 },
  { term: "lineage ladder", weight: 2 },
];

// Workstream J: Trust & Procurement Runtime Convergence.
// Reward terms that signal coexistence-oriented, sovereignty-conscious,
// federation-aware, continuity-safeguarded posture across onboarding,
// procurement, evidence, deployment, and runtime trust surfaces.
export const TRUST_PROCUREMENT_RUNTIME_REQUIRED: RewardTerm[] = [
  { term: "coexistence", weight: 2 },
  { term: "continuity safeguards", weight: 3 },
  { term: "sovereignty-conscious deployment", weight: 3 },
  { term: "federation-aware operations", weight: 3 },
  { term: "explainability", weight: 2 },
  { term: "operational stewardship", weight: 3 },
  { term: "continuity-aware onboarding", weight: 3 },
  { term: "governance-safe deployment", weight: 3 },
  { term: "institutional resilience", weight: 2 },
  { term: "inspectable operational posture", weight: 3 },
  { term: "evidence provenance", weight: 3 },
  { term: "chronology-linked trust", weight: 3 },
];

export const LABOUR_SAFE_AI_FORBIDDEN: string[] = [
  "autonomous decisions",
  "AI-led governance",
  "predictive authority",
  "behavioural scoring",
  "behavioral scoring",
  "worker optimization",
  "automated procedural enforcement",
];

export const CANADIAN_POSITIONING_TERMS: RewardTerm[] = [
  { term: "Canadian-hosted", weight: 3 },
  { term: "bilingual-first", weight: 2 },
  { term: "sovereignty-conscious", weight: 2 },
  { term: "institutional trust", weight: 2 },
  { term: "democratic infrastructure", weight: 2 },
  { term: "governance-safe operations", weight: 2 },
];

export const NARRATIVE_PILLARS = {
  governance: [
    "governance",
    "procedural",
    "constitutional",
    "bylaw",
    "compliance",
    "accountab",
  ],
  continuity: [
    "continuity",
    "institutional memory",
    "succession",
    "handoff",
    "preservation",
    "stewardship",
  ],
  coordination: [
    "coordination",
    "operational",
    "workflow",
    "intake",
    "case management",
    "representation",
  ],
  trust: [
    "trust",
    "audit",
    "transparency",
    "evidence",
    "explainab",
    "oversight",
  ],
} as const;

export type Pillar = keyof typeof NARRATIVE_PILLARS;

export function countRewards(text: string, terms: RewardTerm[]): { matched: RewardTerm[]; score: number } {
  const lower = text.toLowerCase();
  const matched: RewardTerm[] = [];
  let score = 0;
  for (const t of terms) {
    if (lower.includes(t.term.toLowerCase())) {
      matched.push(t);
      score += t.weight;
    }
  }
  return { matched, score };
}
