/**
 * Expertise Extraction Engine
 *
 * Identifies operational expertise patterns from exit interview content.
 * Outputs structured expertise tags, procedural dependencies, and continuity
 * indicators — NOT employee evaluations.
 *
 * This module performs ORGANIZATIONAL DEPENDENCY ANALYSIS.
 * It NEVER ranks employees, scores productivity, or infers performance.
 *
 * INV-01: All AI calls routed through @nzila/ai-sdk via getAiClient()
 */

import {
  buildOrgAiTrace,
  getAiClient,
  UE_APP_KEY,
  UE_PROFILES,
  UE_SYSTEM_ORG_ID,
} from '@/lib/ai/ai-client';
import type { ExitInterview } from '@/db/schema';

export interface ExpertiseProfile {
  /** Organizational areas this role was expert in (e.g., "WSIB claims", "collective bargaining") */
  expertiseDomains: string[];
  /** Systems, tools, or platforms the role uniquely operated (e.g., "HRIS system", "grievance tracker") */
  systemsOwnership: string[];
  /** Vendor or external partner relationships the role managed */
  vendorRelationships: string[];
  /** Informal or undocumented workflows only this role understood */
  undocumentedWorkflows: string[];
  /** Compliance or legal obligations the role was responsible for */
  complianceAreas: string[];
  /** Recurring governance functions or scheduled obligations */
  governanceObligations: string[];
  /** Cross-functional dependencies: other teams or roles that depended on this person */
  crossTeamDependencies: string[];
  /** Continuity sensitivity: low | medium | high | critical */
  continuitySensitivity: 'low' | 'medium' | 'high' | 'critical';
  /** Human-readable continuity justification */
  continuityJustification: string;
  /** Source interview id for full traceability */
  sourceInterviewId: string;
}

const EXTRACTION_SYSTEM_PROMPT = `You are an organizational continuity analyst for a union organization.
Your task is to extract operational expertise patterns from a retiring employee's exit interview.

CRITICAL RULES:
- You analyze ORGANIZATIONAL DEPENDENCY, not employee value or performance.
- Never score, rank, or evaluate the individual.
- Extract only what is observable in the text.
- Flag 'undocumentedWorkflows' only if the interview explicitly describes informal or unwritten processes.
- Be conservative: if unsure, omit rather than infer.

Return a JSON object with exactly these fields:
- expertiseDomains: string[] — operational areas this role owned
- systemsOwnership: string[] — systems/tools uniquely operated by this role
- vendorRelationships: string[] — external relationships managed
- undocumentedWorkflows: string[] — informal processes described
- complianceAreas: string[] — compliance/legal responsibilities
- governanceObligations: string[] — governance/scheduled obligations
- crossTeamDependencies: string[] — other roles that depended on this person
- continuitySensitivity: "low" | "medium" | "high" | "critical"
- continuityJustification: string — one sentence explaining the sensitivity rating

Return ONLY valid JSON. No prose, no markdown fences.`;

function buildExtractionInput(interview: ExitInterview): string {
  const parts = [
    `Role: ${interview.roleInUnion} (${interview.yearsOfService} years)`,
    `Title: ${interview.title}`,
  ];
  if (interview.keyLessons) parts.push(`Key lessons: ${interview.keyLessons}`);
  if (interview.bestPractices) parts.push(`Best practices: ${interview.bestPractices}`);
  if (interview.bargainingAdvice) parts.push(`Bargaining advice: ${interview.bargainingAdvice}`);
  if (interview.mediationAdvice) parts.push(`Mediation advice: ${interview.mediationAdvice}`);
  if (interview.incomingOfficerAdvice) parts.push(`Incoming officer advice: ${interview.incomingOfficerAdvice}`);
  if (interview.topics?.length) parts.push(`Topics: ${interview.topics.join(', ')}`);
  return parts.join('\n');
}

export async function extractExpertise(interview: ExitInterview): Promise<ExpertiseProfile> {
  const organizationId =
    typeof (interview as { organizationId?: unknown }).organizationId === 'string'
      ? ((interview as { organizationId?: string }).organizationId ?? undefined)
      : undefined;
  const ai = getAiClient();
  const result = await ai.generate({
    orgId: UE_SYSTEM_ORG_ID,
    trace: buildOrgAiTrace(organizationId),
    appKey: UE_APP_KEY,
    profileKey: UE_PROFILES.EXPERTISE_EXTRACTION,
    input: [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      { role: 'user', content: buildExtractionInput(interview) },
    ],
    dataClass: 'internal',
  });

  try {
    const parsed = JSON.parse(result.content) as Omit<ExpertiseProfile, 'sourceInterviewId'>;
    return { ...parsed, sourceInterviewId: interview.id };
  } catch {
    // Graceful fallback — return minimal safe profile
    return {
      expertiseDomains: interview.topics ?? [],
      systemsOwnership: [],
      vendorRelationships: [],
      undocumentedWorkflows: [],
      complianceAreas: [],
      governanceObligations: [],
      crossTeamDependencies: [],
      continuitySensitivity: 'medium',
      continuityJustification: 'Unable to parse AI extraction result; manual review recommended.',
      sourceInterviewId: interview.id,
    };
  }
}

/**
 * Derive flat expertise tags from a profile (for storage in `expertiseTags` column).
 * Produces deduplicated, lower-cased labels suitable for indexing.
 */
export function flattenExpertiseTags(profile: ExpertiseProfile): string[] {
  const all = [
    ...profile.expertiseDomains,
    ...profile.systemsOwnership,
    ...profile.vendorRelationships,
    ...profile.complianceAreas,
    ...profile.governanceObligations,
  ];
  return [...new Set(all.map(t => t.toLowerCase().trim()).filter(Boolean))];
}
