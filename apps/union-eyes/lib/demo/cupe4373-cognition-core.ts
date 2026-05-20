/**
 * Foundation Demo \u2014 Case Priority Cognition (pure, shared)
 *
 * The scorer + feature spec live here without any server-only import so
 * the seed CLI and any non-React caller can compute scores. The
 * server-side persistence wrapper lives in `server/cupe4373-cognition.ts`.
 */

import type { DemoCase } from '@/lib/demo/cupe4373-demo';

export const PRIORITY_MODEL_KEY = 'ue-case-priority';
export const PRIORITY_MODEL_VERSION = 1;
export const PRIORITY_MODEL_ALGORITHM = 'rule-based-weighted-sum';

export const PRIORITY_BANDS: ReadonlyArray<{
  min: number;
  predicted: 'p0' | 'p1' | 'p2' | 'p3';
}> = [
  { min: 0.85, predicted: 'p0' },
  { min: 0.6, predicted: 'p1' },
  { min: 0.35, predicted: 'p2' },
  { min: 0, predicted: 'p3' },
];

export type PriorityFeatures = {
  ageDays: number;
  urgencyWeight: number;
  statusWeight: number;
  membersImpacted: number;
  membersImpactedWeight: number;
  hasArbitrationKeyword: boolean;
  hasArbitrationKeywordWeight: number;
};

export type PriorityScore = {
  score: number;
  predictedPriority: 'p0' | 'p1' | 'p2' | 'p3';
  features: PriorityFeatures;
};

function urgencyWeight(urgency: DemoCase['urgency']): number {
  switch (urgency) {
    case 'urgent':
      return 1;
    case 'watch':
      return 0.6;
    default:
      return 0.3;
  }
}

function statusWeight(status: string): number {
  const s = status.toLowerCase();
  if (s.includes('arbitration')) return 0.9;
  if (s.includes('investigation') || s.includes('escalat')) return 0.75;
  if (s.includes('mediation')) return 0.6;
  if (s.includes('open') || s.includes('new')) return 0.5;
  if (s.includes('await')) return 0.4;
  if (s.includes('closed') || s.includes('settled') || s.includes('withdrawn'))
    return 0.1;
  return 0.45;
}

function membersImpactedWeight(n: number): number {
  if (n >= 50) return 1;
  if (n >= 10) return 0.75;
  if (n >= 3) return 0.5;
  return 0.25;
}

function ageDays(opened: string): number {
  const d = new Date(opened);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)));
}

export function scoreCaseFeatures(demoCase: DemoCase): PriorityScore {
  const urgency = urgencyWeight(demoCase.urgency);
  const status = statusWeight(demoCase.status);
  const members = (demoCase.relatedCases?.length ?? 0) + 1;
  const membersW = membersImpactedWeight(members);
  const corpus = `${demoCase.title} ${demoCase.summary ?? ''}`.toLowerCase();
  const hasArb = /arbitrat|tribunal|labour board|olrb/.test(corpus);
  const arbW = hasArb ? 1 : 0;

  const raw = 0.4 * urgency + 0.25 * status + 0.2 * membersW + 0.15 * arbW;
  const score = Math.max(0, Math.min(1, raw));
  const predictedPriority =
    PRIORITY_BANDS.find((b) => score >= b.min)?.predicted ?? 'p3';

  return {
    score,
    predictedPriority,
    features: {
      ageDays: ageDays(demoCase.opened),
      urgencyWeight: urgency,
      statusWeight: status,
      membersImpacted: members,
      membersImpactedWeight: membersW,
      hasArbitrationKeyword: hasArb,
      hasArbitrationKeywordWeight: arbW,
    },
  };
}

export const PRIORITY_FEATURE_SPEC = {
  inputs: [
    { name: 'urgency', source: 'demoCase.urgency', weight: 0.4 },
    { name: 'status', source: 'demoCase.status', weight: 0.25 },
    { name: 'membersImpacted', source: '1 + demoCase.relatedCases.length', weight: 0.2 },
    { name: 'hasArbitrationKeyword', source: 'title+summary regex', weight: 0.15 },
  ],
  bands: PRIORITY_BANDS,
  algorithm: PRIORITY_MODEL_ALGORITHM,
} as const;

export function deriveCaseUuid(grievanceNumber: string): string {
  const m = grievanceNumber.match(/(\d+)$/);
  const suffix = (m?.[1] ?? '000').padStart(3, '0');
  return `a4373001-0000-4000-8000-000000000${suffix}`;
}
