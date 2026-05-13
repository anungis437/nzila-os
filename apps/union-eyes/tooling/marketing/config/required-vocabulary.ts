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
];

export const LABOUR_SAFE_AI_REQUIRED: RewardTerm[] = [
  { term: "human oversight", weight: 3 },
  { term: "explainability", weight: 2 },
  { term: "reviewability", weight: 2 },
  { term: "governance-safe AI", weight: 3 },
  { term: "assistive intelligence", weight: 2 },
  { term: "procedural transparency", weight: 2 },
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
