/**
 * Insight Explainability Engine
 *
 * Provides traceable, human-readable explanations for every AI-generated
 * continuity insight. Ensures no opaque AI conclusions reach users.
 *
 * Every generated insight can be "opened" to reveal:
 *   - Plain-language reasoning
 *   - Source evidence from interviews
 *   - AI confidence level
 *   - Generation metadata
 *   - Human override status
 *
 * This is essential for union environments where transparency and governance
 * defensibility are mandatory.
 *
 * INV-01: All AI calls via getAiClient()
 */

import { getAiClient, UE_APP_KEY, UE_PROFILES, UE_SYSTEM_ORG_ID } from '@/lib/ai/ai-client';

export type InsightType =
  | 'risk_flag'
  | 'expertise_concentration'
  | 'coverage_gap'
  | 'succession_gap'
  | 'governance_drift'
  | 'single_source_topic'
  | 'undocumented_workflow';

export interface EvidenceReference {
  interviewId: string;
  interviewTitle: string;
  roleInUnion: string;
  /** Observable pattern from the interview — never a direct personal quote */
  supportingPattern: string;
}

export interface InsightExplanation {
  insightType: InsightType;
  /** One-sentence plain language summary of what was observed */
  humanReadable: string;
  /** 2–3 sentence reasoning chain grounded in observable organizational patterns */
  reasoning: string;
  /** Specific interviews that contributed this signal */
  evidenceRefs: EvidenceReference[];
  confidenceLevel: 'low' | 'medium' | 'high';
  /** Actionable governance recommendation for the organization */
  recommendation: string;
  /** AI profile used for generation (for audit trail) */
  modelProfile: string;
  generatedAt: string;
}

export interface ExplainabilityReport {
  organizationId: string;
  generatedAt: string;
  insights: InsightExplanation[];
  /** Full model attribution string */
  modelAttribution: string;
  /** Governance disclaimer shown in all UIs */
  governanceNote: string;
  reviewStatus: 'unreviewed' | 'under_review' | 'approved';
}

const EXPLAIN_SYSTEM_PROMPT = `You are a governance transparency system for an organizational continuity platform used by unions and governed organizations.

Your role is to explain AI-generated continuity insights in plain, traceable language so that governance bodies, procurement teams, and affected workers can understand and evaluate them.

For each insight provided, generate an explanation with:
1. A plain English one-sentence summary of what was observed
2. A 2-3 sentence reasoning chain citing only observable patterns (not assumptions about individuals)
3. Short supporting patterns from the interview data
4. An honest confidence level
5. An actionable recommendation for the organization

CRITICAL RULES:
- Never evaluate individual workers, infer productivity, or comment on personal performance
- Only describe observable organizational patterns across multiple interviews
- Distinguish clearly between direct observations and inferences
- Be honest about limitations and uncertainty
- Use governance-neutral, institutional language — not surveillance language

Return a JSON array (one object per insight):
[{
  "humanReadable": "one sentence plain-language organizational observation",
  "reasoning": "2-3 sentences citing observable patterns",
  "supportingPatterns": ["observable pattern 1", "observable pattern 2"],
  "confidenceLevel": "low" | "medium" | "high",
  "recommendation": "what the organization can do"
}]

Return ONLY valid JSON. No prose, no markdown fences.`;

export async function explainInsights(params: {
  orgId: string;
  insights: Array<{
    type: InsightType;
    description: string;
    relatedTopics: string[];
    affectedRoles: string[];
  }>;
  sourceInterviews: Array<{
    id: string;
    title: string;
    roleInUnion: string;
    topics: string[] | null;
    expertiseTags: string[] | null;
  }>;
}): Promise<ExplainabilityReport> {
  const { orgId, insights, sourceInterviews } = params;

  if (insights.length === 0) {
    return {
      organizationId: orgId,
      generatedAt: new Date().toISOString(),
      insights: [],
      modelAttribution: `@nzila/ai-sdk · profile: ${UE_PROFILES.TOPIC_EXTRACTION}`,
      governanceNote:
        'All insights reflect organizational patterns only. No individual employee evaluations are produced.',
      reviewStatus: 'unreviewed',
    };
  }

  const insightInput = insights
    .map(
      (i, idx) =>
        `[${idx + 1}] Type: ${i.type}\nDescription: ${i.description}\nTopics: ${i.relatedTopics.join(', ')}\nRoles: ${i.affectedRoles.join(', ')}`,
    )
    .join('\n\n');

  const interviewContext = sourceInterviews
    .slice(0, 10)
    .map(
      (i) =>
        `[${i.roleInUnion}] ${i.title} — Topics: ${(i.topics ?? []).join(', ')} | Expertise: ${(i.expertiseTags ?? []).join(', ')}`,
    )
    .join('\n');

  const ai = getAiClient();

  const result = await ai.generate({
    orgId: UE_SYSTEM_ORG_ID,
    appKey: UE_APP_KEY,
    profileKey: UE_PROFILES.TOPIC_EXTRACTION,
    input: [
      { role: 'system', content: EXPLAIN_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `INSIGHTS TO EXPLAIN:\n${insightInput}\n\nSUPPORTING INTERVIEW DATA:\n${interviewContext}`,
      },
    ],
    dataClass: 'internal',
  });

  let parsedExplanations: Array<{
    humanReadable: string;
    reasoning: string;
    supportingPatterns: string[];
    confidenceLevel: 'low' | 'medium' | 'high';
    recommendation: string;
  }> = [];

  try {
    parsedExplanations = JSON.parse(result.content) as typeof parsedExplanations;
  } catch {
    parsedExplanations = insights.map((i) => ({
      humanReadable: i.description,
      reasoning: `Based on patterns observed across ${sourceInterviews.length} published exit interviews.`,
      supportingPatterns: i.relatedTopics.slice(0, 3),
      confidenceLevel: 'medium' as const,
      recommendation: 'Review this finding manually and consult with the relevant governance team.',
    }));
  }

  const explained: InsightExplanation[] = insights.map((insight, idx) => {
    const exp = parsedExplanations[idx] ?? parsedExplanations[0];
    const relevantInterviews = sourceInterviews.filter(
      (i) =>
        insight.relatedTopics.some(
          (t) => (i.topics ?? []).includes(t) || (i.expertiseTags ?? []).includes(t),
        ) || insight.affectedRoles.includes(i.roleInUnion),
    );

    return {
      insightType: insight.type,
      humanReadable: exp?.humanReadable ?? insight.description,
      reasoning: exp?.reasoning ?? '',
      evidenceRefs: relevantInterviews.slice(0, 3).map((i) => ({
        interviewId: i.id,
        interviewTitle: i.title,
        roleInUnion: i.roleInUnion,
        supportingPattern:
          (exp?.supportingPatterns ?? [])[0] ??
          `Referenced in ${i.roleInUnion} interview "${i.title}"`,
      })),
      confidenceLevel: exp?.confidenceLevel ?? 'medium',
      recommendation: exp?.recommendation ?? '',
      modelProfile: UE_PROFILES.TOPIC_EXTRACTION,
      generatedAt: new Date().toISOString(),
    };
  });

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    insights: explained,
    modelAttribution: `@nzila/ai-sdk · profile: ${UE_PROFILES.TOPIC_EXTRACTION}`,
    governanceNote:
      'All insights reflect organizational patterns only. No individual employee evaluations are produced. All findings are subject to human review.',
    reviewStatus: 'unreviewed',
  };
}
