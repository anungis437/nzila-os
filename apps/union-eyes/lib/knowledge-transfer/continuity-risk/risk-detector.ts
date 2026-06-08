/**
 * Continuity Risk Detector
 *
 * Identifies organizational knowledge fragility from published exit interviews.
 * Produces org-level continuity risk signals — not employee evaluations.
 *
 * This module evaluates ORGANIZATIONAL RISK:
 *   - Knowledge concentration in single roles
 *   - Undocumented procedures with no coverage
 *   - Governance gaps in outgoing expertise
 *   - Succession vulnerabilities
 *
 * It NEVER evaluates individual worker performance, value, or productivity.
 */

import { and, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { exitInterviews } from '@/db/schema';
import {
  buildOrgAiTrace,
  getAiClient,
  UE_APP_KEY,
  UE_PROFILES,
  UE_SYSTEM_ORG_ID,
} from '@/lib/ai/ai-client';

export interface ContinuityRiskFlag {
  flag: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedRoles: string[];
  topicAreas: string[];
  recommendation: string;
}

export interface OrgContinuityRiskReport {
  organizationId: string;
  generatedAt: string;
  totalPublishedInterviews: number;
  /** 0–100. Higher = more fragile. */
  overallRiskScore: number;
  riskFlags: ContinuityRiskFlag[];
  /** Topics covered by only ONE exit interview — single-source knowledge */
  singleSourceTopics: string[];
  /** Roles with no published successor interview */
  coverageGaps: string[];
  /** Expertise domains that appear only once across all interviews */
  isolatedExpertise: string[];
  /** Immediate governance recommendations */
  executiveSummary: string;
}

const RISK_ANALYSIS_PROMPT = `You are an organizational continuity risk analyst for a union organization.
Given a set of published exit interview summaries, identify organizational knowledge fragility risks.

RULES:
- Evaluate organizational dependency, NOT individual employees.
- A risk flag must be grounded in patterns visible across multiple interviews, OR explicitly stated in one.
- Never produce employee scoring, performance comments, or disciplinary insights.
- Focus on: knowledge concentration, undocumented procedures, governance gaps, succession vulnerabilities.

Return a JSON object:
{
  "riskFlags": [
    { "flag": string, "severity": "low|medium|high|critical", "affectedRoles": string[], "topicAreas": string[], "recommendation": string }
  ],
  "executiveSummary": string
}

Return ONLY valid JSON.`;

function buildRiskInput(
  interviews: Array<{
    id: string;
    roleInUnion: string;
    yearsOfService: number;
    expertiseTags: string[] | null;
    continuityRiskFlags: string[] | null;
    topics: string[] | null;
    title: string;
  }>,
): string {
  return interviews
    .map(
      (i) =>
        `[${i.roleInUnion}, ${i.yearsOfService}y] ${i.title}\n` +
        `Expertise: ${(i.expertiseTags ?? []).join(', ') || 'none extracted'}\n` +
        `Topics: ${(i.topics ?? []).join(', ') || 'none'}`,
    )
    .join('\n---\n');
}

/**
 * Detect single-source topics — topics that only appear in ONE interview.
 * These represent the highest knowledge concentration risk.
 */
function detectSingleSourceTopics(
  interviews: Array<{ topics: string[] | null }>,
): string[] {
  const topicCount = new Map<string, number>();
  for (const i of interviews) {
    for (const t of i.topics ?? []) {
      const key = t.toLowerCase().trim();
      topicCount.set(key, (topicCount.get(key) ?? 0) + 1);
    }
  }
  return [...topicCount.entries()]
    .filter(([, count]) => count === 1)
    .map(([topic]) => topic);
}

/**
 * Detect isolated expertise — expertise tags that appear in only one interview.
 */
function detectIsolatedExpertise(
  interviews: Array<{ expertiseTags: string[] | null }>,
): string[] {
  const expertiseCount = new Map<string, number>();
  for (const i of interviews) {
    for (const t of i.expertiseTags ?? []) {
      const key = t.toLowerCase().trim();
      expertiseCount.set(key, (expertiseCount.get(key) ?? 0) + 1);
    }
  }
  return [...expertiseCount.entries()]
    .filter(([, count]) => count === 1)
    .map(([tag]) => tag);
}

/**
 * Detect roles with no published interview (coverage gaps).
 * Compares roles present in published interviews vs the expected union role set.
 */
function detectCoverageGaps(interviews: Array<{ roleInUnion: string }>): string[] {
  const coveredRoles = new Set(interviews.map((i) => i.roleInUnion));
  const allRoles = ['steward', 'chief_steward', 'officer', 'admin'];
  return allRoles.filter((r) => !coveredRoles.has(r));
}

/**
 * Compute an overall org risk score (0–100) from detected signals.
 */
function computeRiskScore(params: {
  singleSourceCount: number;
  coverageGapCount: number;
  isolatedExpertiseCount: number;
  highRiskInterviewCount: number;
  totalInterviews: number;
}): number {
  if (params.totalInterviews === 0) return 0;
  const base =
    Math.min(params.singleSourceCount * 8, 40) +
    Math.min(params.coverageGapCount * 15, 30) +
    Math.min(params.isolatedExpertiseCount * 4, 20) +
    Math.min(params.highRiskInterviewCount * 5, 10);
  return Math.min(base, 100);
}

export async function detectContinuityRisks(orgId: string): Promise<OrgContinuityRiskReport> {
  const publishedInterviews = await db
    .select({
      id: exitInterviews.id,
      roleInUnion: exitInterviews.roleInUnion,
      yearsOfService: exitInterviews.yearsOfService,
      title: exitInterviews.title,
      expertiseTags: exitInterviews.expertiseTags,
      continuityRiskFlags: exitInterviews.continuityRiskFlags,
      continuityRiskScore: exitInterviews.continuityRiskScore,
      topics: exitInterviews.topics,
    })
    .from(exitInterviews)
    .where(
      and(
        eq(exitInterviews.organizationId, orgId),
        eq(exitInterviews.status, 'published'),
      ),
    );

  const singleSourceTopics = detectSingleSourceTopics(publishedInterviews);
  const isolatedExpertise = detectIsolatedExpertise(publishedInterviews);
  const coverageGaps = detectCoverageGaps(publishedInterviews);

  const highRiskCount = publishedInterviews.filter(
    (i) => (i.continuityRiskScore ?? 0) >= 70,
  ).length;

  const overallRiskScore = computeRiskScore({
    singleSourceCount: singleSourceTopics.length,
    coverageGapCount: coverageGaps.length,
    isolatedExpertiseCount: isolatedExpertise.length,
    highRiskInterviewCount: highRiskCount,
    totalInterviews: publishedInterviews.length,
  });

  let riskFlags: ContinuityRiskFlag[] = [];
  let executiveSummary = '';

  if (publishedInterviews.length > 0) {
    const ai = getAiClient();
    const result = await ai.generate({
      orgId: UE_SYSTEM_ORG_ID,
      trace: buildOrgAiTrace(orgId),
      appKey: UE_APP_KEY,
      profileKey: UE_PROFILES.CONTINUITY_RISK,
      input: [
        { role: 'system', content: RISK_ANALYSIS_PROMPT },
        { role: 'user', content: buildRiskInput(publishedInterviews) },
      ],
      dataClass: 'internal',
    });

    try {
      const parsed = JSON.parse(result.content) as {
        riskFlags: ContinuityRiskFlag[];
        executiveSummary: string;
      };
      riskFlags = parsed.riskFlags ?? [];
      executiveSummary = parsed.executiveSummary ?? '';
    } catch {
      executiveSummary = `${publishedInterviews.length} exit interviews analyzed. Manual review recommended.`;
    }
  } else {
    executiveSummary = 'No published interviews to analyze. Begin capturing exit interviews to build continuity intelligence.';
  }

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    totalPublishedInterviews: publishedInterviews.length,
    overallRiskScore,
    riskFlags,
    singleSourceTopics,
    coverageGaps,
    isolatedExpertise,
    executiveSummary,
  };
}
