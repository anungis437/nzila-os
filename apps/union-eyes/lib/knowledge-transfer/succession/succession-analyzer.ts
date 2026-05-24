/**
 * Succession Fragility Analyzer
 *
 * Analyzes organizational succession readiness from published exit interviews.
 * Identifies operational replacement gaps, undocumented transition areas,
 * and procedural dependencies that need governance attention.
 *
 * This is ORGANIZATIONAL RESILIENCE ANALYSIS.
 * It NEVER evaluates individual worker value, productivity, or replaceability.
 *
 * The readiness score (0–100) measures how well documented the organization's
 * operational knowledge is — not the quality of its people.
 *
 * INV-01: All AI calls via getAiClient()
 */

import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { exitInterviews } from '@/db/schema';
import { getAiClient, UE_APP_KEY, UE_PROFILES, UE_SYSTEM_ORG_ID } from '@/lib/ai/ai-client';

export type SuccessorReadiness = 'none' | 'minimal' | 'partial' | 'adequate';

export interface RoleSuccessionStatus {
  role: string;
  /** Number of published exit interviews from this role */
  interviewCount: number;
  /** Total years of captured organizational service */
  totalYearsOfServiceCaptured: number;
  /** Average continuity risk score across interviews from this role */
  averageContinuityRiskScore: number;
  /** Operational areas with no documented procedure handoff */
  undocumentedAreas: string[];
  /** Key topics captured from this role */
  keyTopicsCaptured: string[];
  /** Assessment of succession documentation readiness */
  successorReadiness: SuccessorReadiness;
}

export interface SuccessionFragilityReport {
  organizationId: string;
  generatedAt: string;
  /**
   * 0–100. HIGHER = more transition-ready (inverse of fragility).
   * This measures DOCUMENTATION COVERAGE, not individual capability.
   */
  transitionReadinessScore: number;
  roleSuccessionStatus: RoleSuccessionStatus[];
  /** Operational areas where no documented handoff procedure exists */
  criticalOperationalGaps: string[];
  /** What should be documented first to improve continuity */
  documentationPriorities: string[];
  /** Org-level recommendations to improve organizational resilience */
  continuityRecommendations: string[];
  /** Governance changes that would reduce succession fragility */
  governanceMitigations: string[];
  executiveSummary: string;
}

const UNION_ROLES = ['member', 'steward', 'chief_steward', 'officer', 'admin'] as const;

const SUCCESSION_PROMPT = `You are an organizational succession analyst for a union organization.

Analyze the provided exit interview data and return a governance-focused succession fragility assessment.

RULES:
- Frame everything as organizational continuity and documentation gaps, not individual performance.
- Identify gaps in DOCUMENTED PROCEDURES and ORGANIZATIONAL KNOWLEDGE, not individual capabilities.
- Focus on: undocumented workflows, single-point operational dependencies, governance knowledge gaps.
- Recommendations must be actionable, organizationally supportive, and non-threatening.
- NEVER produce comments about individual workers, their value, or succession candidates.

Return a JSON object:
{
  "criticalOperationalGaps": string[],
  "documentationPriorities": string[],
  "continuityRecommendations": string[],
  "governanceMitigations": string[],
  "executiveSummary": string
}

Return ONLY valid JSON.`;

function scoreReadiness(interviewCount: number, avgRisk: number): SuccessorReadiness {
  if (interviewCount === 0) return 'none';
  if (interviewCount === 1 && avgRisk >= 70) return 'minimal';
  if (interviewCount >= 2 && avgRisk < 50) return 'adequate';
  return 'partial';
}

export async function analyzeSuccessionFragility(orgId: string): Promise<SuccessionFragilityReport> {
  const published = await db
    .select({
      id: exitInterviews.id,
      roleInUnion: exitInterviews.roleInUnion,
      yearsOfService: exitInterviews.yearsOfService,
      title: exitInterviews.title,
      topics: exitInterviews.topics,
      expertiseTags: exitInterviews.expertiseTags,
      continuityRiskScore: exitInterviews.continuityRiskScore,
      continuityRiskFlags: exitInterviews.continuityRiskFlags,
    })
    .from(exitInterviews)
    .where(
      and(
        eq(exitInterviews.organizationId, orgId),
        eq(exitInterviews.status, 'published'),
      ),
    );

  // Build per-role statistics
  const roleMap = new Map<
    string,
    {
      interviewCount: number;
      totalYears: number;
      riskScores: number[];
      topics: Set<string>;
      undocumented: Set<string>;
    }
  >();

  for (const role of UNION_ROLES) {
    roleMap.set(role, {
      interviewCount: 0,
      totalYears: 0,
      riskScores: [],
      topics: new Set(),
      undocumented: new Set(),
    });
  }

  for (const interview of published) {
    const entry = roleMap.get(interview.roleInUnion);
    if (!entry) continue;
    entry.interviewCount++;
    entry.totalYears += interview.yearsOfService;
    if (interview.continuityRiskScore != null) entry.riskScores.push(interview.continuityRiskScore);
    for (const t of interview.topics ?? []) entry.topics.add(t);
    for (const f of interview.continuityRiskFlags ?? []) entry.undocumented.add(f);
  }

  const roleSuccessionStatus: RoleSuccessionStatus[] = [...roleMap.entries()].map(
    ([role, data]) => {
      const avgRisk =
        data.riskScores.length > 0
          ? Math.round(data.riskScores.reduce((a, b) => a + b, 0) / data.riskScores.length)
          : 0;
      return {
        role,
        interviewCount: data.interviewCount,
        totalYearsOfServiceCaptured: data.totalYears,
        averageContinuityRiskScore: avgRisk,
        undocumentedAreas: [...data.undocumented].slice(0, 6),
        keyTopicsCaptured: [...data.topics].slice(0, 8),
        successorReadiness: scoreReadiness(data.interviewCount, avgRisk),
      };
    },
  );

  // Readiness score = inverse of fragility (percentage of roles with at least partial coverage)
  const rolesWithNone = roleSuccessionStatus.filter((r) => r.successorReadiness === 'none').length;
  const rolesWithMinimal = roleSuccessionStatus.filter(
    (r) => r.successorReadiness === 'minimal',
  ).length;
  const fragility = Math.min(
    (rolesWithNone / UNION_ROLES.length) * 50 + rolesWithMinimal * 10,
    100,
  );
  const transitionReadinessScore = Math.max(0, 100 - Math.round(fragility));

  let criticalOperationalGaps: string[] = [];
  let documentationPriorities: string[] = [];
  let continuityRecommendations: string[] = [];
  let governanceMitigations: string[] = [];
  let executiveSummary = '';

  if (published.length > 0) {
    const ai = getAiClient();
    const inputText = published
      .map(
        (i) =>
          `[${i.roleInUnion}, ${i.yearsOfService}y] ${i.title}\n` +
          `Topics: ${(i.topics ?? []).join(', ')}\n` +
          `Risk flags: ${(i.continuityRiskFlags ?? []).join(', ')}`,
      )
      .join('\n---\n');

    const result = await ai.generate({
      orgId: UE_SYSTEM_ORG_ID,
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.CONTINUITY_RISK,
      input: [
        { role: 'system', content: SUCCESSION_PROMPT },
        { role: 'user', content: inputText },
      ],
      dataClass: 'internal',
    });

    try {
      const parsed = JSON.parse(result.content) as {
        criticalOperationalGaps: string[];
        documentationPriorities: string[];
        continuityRecommendations: string[];
        governanceMitigations: string[];
        executiveSummary: string;
      };
      criticalOperationalGaps = parsed.criticalOperationalGaps ?? [];
      documentationPriorities = parsed.documentationPriorities ?? [];
      continuityRecommendations = parsed.continuityRecommendations ?? [];
      governanceMitigations = parsed.governanceMitigations ?? [];
      executiveSummary = parsed.executiveSummary ?? '';
    } catch {
      executiveSummary = `${published.length} exit interviews analyzed. Transition readiness score: ${transitionReadinessScore}/100. Manual review recommended.`;
    }
  } else {
    executiveSummary =
      'No published exit interviews to analyze. Capturing organizational knowledge through exit interviews is the critical first step toward organizational continuity.';
  }

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    transitionReadinessScore,
    roleSuccessionStatus,
    criticalOperationalGaps,
    documentationPriorities,
    continuityRecommendations,
    governanceMitigations,
    executiveSummary,
  };
}
