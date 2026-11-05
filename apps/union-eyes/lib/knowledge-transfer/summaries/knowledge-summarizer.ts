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

import { z } from 'zod';
import { ApiError } from '@/lib/api/errors';
import {
  buildOrgAiTrace,
  getAiClient,
  toGatewayDataClass,
  UE_APP_KEY,
  UE_PROFILES,
  UE_SYSTEM_ORG_ID,
} from '@/lib/ai/ai-client';
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

const SummaryOutputSchema = z.object({
  operationalSummary: z.string().trim().min(1),
  handoffPoints: z.array(z.string()).max(5).default([]),
  recurringThemes: z.array(z.string()).default([]),
  continuityRecommendations: z.array(z.string()).default([]),
});

// Interviews at the open levels leave the organization as internal data; every higher level goes as confidential.
const OPEN_LEVELS = new Set(['public_internal', 'restricted']);

export async function generateKnowledgeSummary(interview: ExitInterview): Promise<KnowledgeSummary> {
  // The retiring employee's consent covers sharing the interview; without it nothing is sent to a provider.
  if (interview.consentGranted !== true) {
    throw ApiError.conflict('The retiring employee has not consented to this interview being shared, so it cannot be summarized.');
  }
  const organizationId =
    typeof (interview as { organizationId?: unknown }).organizationId === 'string'
      ? ((interview as { organizationId?: string }).organizationId ?? undefined)
      : undefined;
  const level = (interview as { sensitivityLevel?: string | null }).sensitivityLevel ?? 'restricted';
  const ai = getAiClient();
  const result = await ai.generate({
    orgId: UE_SYSTEM_ORG_ID,
    trace: buildOrgAiTrace(organizationId),
    appKey: UE_APP_KEY,
    profileKey: UE_PROFILES.KNOWLEDGE_SUMMARY,
    input: [
      { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
      { role: 'user', content: buildSummaryInput(interview) },
    ],
    dataClass: toGatewayDataClass(OPEN_LEVELS.has(level) ? 'internal' : 'confidential'),
  });

  // Output that is not the requested JSON is a failed generation. It is never replaced by text that reads as a summary
  // and stored as generated.
  let parsed: z.infer<typeof SummaryOutputSchema>;
  try {
    parsed = SummaryOutputSchema.parse(JSON.parse(result.content));
  } catch {
    throw ApiError.externalService('AI provider', 'the response was not a valid knowledge summary; nothing was stored.');
  }
  return { ...parsed, sourceInterviewId: interview.id, generatedAt: new Date().toISOString() };
}