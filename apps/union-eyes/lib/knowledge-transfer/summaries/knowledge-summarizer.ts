/**
 * AI Knowledge Summarizer
 *
 * Generates concise, evidence-linked operational handoff summaries from exit
 * interview content. All outputs are:
 *   - Traceable to source fields (never fabricated)
 *   - Suitable for human review and editing
 *   - Scoped to the interview text (no hallucinated procedures)
 *
 * INV-01: All AI calls routed through @nzila/ai-sdk via getAiClient()
 */

import { getAiClient, UE_APP_KEY, UE_PROFILES, UE_SYSTEM_ORG_ID } from '@/lib/ai/ai-client';
import type { ExitInterview } from '@/db/schema';

export interface KnowledgeSummary {
  /** 2–4 sentence condensed summary of the interview */
  operationalSummary: string;
  /** Most important procedural handoff points — max 5 bullets */
  handoffPoints: string[];
  /** Recurring operational issues or themes detected in the text */
  recurringThemes: string[];
  /** Immediate continuity recommendations for the successor */
  continuityRecommendations: string[];
  /** Source interview id for full traceability */
  sourceInterviewId: string;
  /** Timestamp the summary was generated */
  generatedAt: string;
}

const SUMMARY_SYSTEM_PROMPT = `You are an organizational knowledge analyst for a union organization.
Produce a concise operational handoff summary from the following exit interview.

RULES:
- Stay strictly within the content provided. Never add procedures not mentioned.
- Identify the most operationally important knowledge for a successor.
- Be precise and actionable. Avoid vague generalities.
- All recommendations must be traceable to text in the interview.

Return a JSON object with exactly these fields:
- operationalSummary: string — 2 to 4 sentences
- handoffPoints: string[] — up to 5 bullet-ready handoff items
- recurringThemes: string[] — operational themes that appear repeatedly
- continuityRecommendations: string[] — specific steps for the successor

Return ONLY valid JSON. No markdown, no prose wrapper.`;

function buildSummaryInput(interview: ExitInterview): string {
  const parts = [
    `Role: ${interview.roleInUnion} (${interview.yearsOfService} years)`,
    `Title: ${interview.title}`,
  ];
  if (interview.keyLessons) parts.push(`Key lessons:\n${interview.keyLessons}`);
  if (interview.bestPractices) parts.push(`Best practices:\n${interview.bestPractices}`);
  if (interview.bargainingAdvice) parts.push(`Bargaining advice:\n${interview.bargainingAdvice}`);
  if (interview.mediationAdvice) parts.push(`Mediation advice:\n${interview.mediationAdvice}`);
  if (interview.incomingOfficerAdvice) parts.push(`Incoming officer advice:\n${interview.incomingOfficerAdvice}`);
  return parts.join('\n\n');
}

export async function generateKnowledgeSummary(interview: ExitInterview): Promise<KnowledgeSummary> {
  const ai = getAiClient();
  const result = await ai.generate({
    orgId: UE_SYSTEM_ORG_ID,
    appKey: UE_APP_KEY,
    profileKey: UE_PROFILES.KNOWLEDGE_SUMMARY,
    input: [
      { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: buildSummaryInput(interview) },
    ],
    dataClass: 'internal',
  });

  const now = new Date().toISOString();
  try {
    const parsed = JSON.parse(result.content) as Omit<KnowledgeSummary, 'sourceInterviewId' | 'generatedAt'>;
    return { ...parsed, sourceInterviewId: interview.id, generatedAt: now };
  } catch {
    return {
      operationalSummary: `Exit interview for ${interview.roleInUnion} with ${interview.yearsOfService} years of service. Manual review of source content is recommended.`,
      handoffPoints: [],
      recurringThemes: [],
      continuityRecommendations: [],
      sourceInterviewId: interview.id,
      generatedAt: now,
    };
  }
}
