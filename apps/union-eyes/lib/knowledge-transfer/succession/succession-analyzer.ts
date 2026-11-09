/**
 * Succession Fragility Analyzer
 *
 * Analyzes organizational succession FRAGILITY (what departures left undocumented) from published exit interviews.
 * Identifies operational replacement gaps, undocumented transition areas,
 * and procedural dependencies that need governance attention.
 *
 * This is ORGANIZATIONAL RESILIENCE ANALYSIS.
 * It NEVER evaluates individual worker value, productivity, or replaceability.
 *
 * It does not score successor readiness: no successor, handover or documentation record exists in the data model,
 * and counting exit interviews as readiness made more departures read as more readiness. transitionReadinessScore is
 * therefore null with its basis stated; departureDocumentation reports what the interviews actually establish.
 *
 * INV-01: All AI calls via getAiClient()
 */

import { INTERVIEW_READ_LIMIT } from '@/lib/knowledge-transfer/governance/interview-read-limit';
import { derivedAnalyticsCondition } from '../governance/interview-access';
import { MIN_COHORT_SIZE, averageOrNull } from '../governance/evidence-basis';
import { z } from 'zod';
import { db } from '@/db/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { ApiError } from '@/lib/api/errors';
import { exitInterviews, exitInterviewRoleEnum } from '@/db/schema';
import {
  buildOrgAiTrace,
  getAiClient,
  toGatewayDataClass,
  UE_APP_KEY,
  UE_PROFILES,
  UE_SYSTEM_ORG_ID,
} from '@/lib/ai/ai-client';

/** How documented a role's DEPARTURES are, from the published exit interviews alone. This is not successor readiness:
 *  the data model holds no successor, handover or documentation record, so readiness cannot be assessed and more
 *  departures must never read as more readiness (DEF-0B7-COGB-SUCCESSION-READINESS-SCORE-COUNTS-EXIT-INTERVIEWS-AS-
 *  SUCCESSOR-READINESS, Family 1 acceptance). */
export type DepartureDocumentation = 'no_interview' | 'single_interview' | 'multiple_interviews';

export interface RoleSuccessionStatus {
  role: string;
  /** Number of published exit interviews from this role */
  interviewCount: number;
  /** Total years of captured organizational service. Null below MIN_COHORT_SIZE: a 1-4 interview count would carry exactly those departing people's own years of service. */
  totalYearsOfServiceCaptured: number | null;
  /** Average continuity risk score across interviews from this role. Null below MIN_COHORT_SIZE for the same reason. */
  averageContinuityRiskScore: number | null;
  /** True when interviewCount is below MIN_COHORT_SIZE and the two fields above are withheld rather than naming a specific departing person's figures. */
  smallCellSuppressed: boolean;
  /** Operational areas with no documented procedure handoff */
  undocumentedAreas: string[];
  /** Key topics captured from this role */
  keyTopicsCaptured: string[];
  /** How documented this role's departures are - never a readiness verdict. */
  departureDocumentation: DepartureDocumentation;
}

export interface SuccessionFragilityReport {
  organizationId: string;
  generatedAt: string;
  /** Always null: no successor, handover or documentation record exists to assess readiness from. Interview counts
   *  measure departures, and scoring them as readiness made more departures read as more readiness. */
  transitionReadinessScore: null;
  transitionReadinessBasis: 'not_assessed_no_successor_records';
  /** Roles (from the exit-interview role enum) with at least one published exit interview, out of all roles. A count
   *  of documented departures, not of prepared successors. */
  departureDocumentationCoverage: { rolesWithInterviews: number; totalRoles: number };
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
  /** True when the narrative fields were written by a model from consented, eligible interviews; false when there was nothing to analyse. */
  modelGenerated: boolean;
}

/** Every role the schema allows on an exit interview - never a hand-maintained subset that would skip a role. */
const UNION_ROLES = exitInterviewRoleEnum.enumValues;

/** Below this many interviews, a role's aggregate years-of-service and risk score are exactly one or a few departing people's own figures. Shared with every other DEF-0B7-COGA-PROFILES/COGB sibling engine via lib/knowledge-transfer/governance/evidence-basis.ts (matches the repo's small-cell convention, e.g. app/api/breaks/compliance). */

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

const stringList = z.array(z.string().max(500)).max(20);
const ReplySchema = z.object({
  criticalOperationalGaps: stringList,
  documentationPriorities: stringList,
  continuityRecommendations: stringList,
  governanceMitigations: stringList,
  executiveSummary: z.string().min(1).max(4000),
});

function departureDocumentationOf(interviewCount: number): DepartureDocumentation {
  if (interviewCount === 0) return 'no_interview';
  return interviewCount === 1 ? 'single_interview' : 'multiple_interviews';
}

export async function analyzeSuccessionFragility(orgId: string, actorUserId?: string): Promise<SuccessionFragilityReport> {
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
    .where(derivedAnalyticsCondition(orgId))
    .limit(INTERVIEW_READ_LIMIT);

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
      // null means no interview for this role recorded a continuity risk score at all - distinct from a genuinely
      // measured average of exactly 0, which averageOrNull would also return as a plain 0, not null.
      const avgRisk = averageOrNull(data.riskScores);
      const roundedAvgRisk = avgRisk === null ? null : Math.round(avgRisk);
      const smallCellSuppressed = data.interviewCount > 0 && data.interviewCount < MIN_COHORT_SIZE;
      return {
        role,
        interviewCount: data.interviewCount,
        totalYearsOfServiceCaptured: smallCellSuppressed ? null : data.totalYears,
        averageContinuityRiskScore: smallCellSuppressed ? null : roundedAvgRisk,
        smallCellSuppressed,
        undocumentedAreas: [...data.undocumented].slice(0, 6),
        keyTopicsCaptured: [...data.topics].slice(0, 8),
        departureDocumentation: departureDocumentationOf(data.interviewCount),
      };
    },
  );

  const departureDocumentationCoverage = {
    rolesWithInterviews: roleSuccessionStatus.filter((r) => r.interviewCount > 0).length,
    totalRoles: roleSuccessionStatus.length,
  };

  let criticalOperationalGaps: string[] = [];
  let documentationPriorities: string[] = [];
  let continuityRecommendations: string[] = [];
  let governanceMitigations: string[] = [];
  let executiveSummary = '';

  let modelGenerated = false;

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

    const audit = (action: string, details: Record<string, unknown>) =>
      actorUserId
        ? withRLSContext({ organizationId: orgId }, (tx) =>
            persistAtomicAudit(tx, { organizationId: orgId, userId: actorUserId, action, resourceType: 'exit_interviews', resourceId: orgId, details }),
          )
        : Promise.resolve();
    await audit('exit_interview.succession_analysis.requested', { interviews: published.length, dataClass: toGatewayDataClass('confidential') });

    let result;
    try {
      result = await ai.generate({
        orgId: UE_SYSTEM_ORG_ID,
        trace: buildOrgAiTrace(orgId),
        appKey: UE_APP_KEY,
        profileKey: UE_PROFILES.CONTINUITY_RISK,
        input: [
          { role: 'system', content: SUCCESSION_PROMPT },
          { role: 'user', content: inputText },
        ],
        dataClass: toGatewayDataClass('confidential'),
      });
    } catch (error) {
      await audit('exit_interview.succession_analysis.failed', { reason: error instanceof Error ? error.name : 'unknown' }).catch(() => undefined);
      throw error;
    }

    let parsed: z.infer<typeof ReplySchema>;
    try {
      parsed = ReplySchema.parse(JSON.parse(result.content));
    } catch {
      // An unusable reply is a failure, not a canned summary presented as analysis.
      await audit('exit_interview.succession_analysis.failed', { reason: 'unusable_model_reply' }).catch(() => undefined);
      throw ApiError.internal('The succession analysis could not be produced');
    }
    criticalOperationalGaps = parsed.criticalOperationalGaps;
    documentationPriorities = parsed.documentationPriorities;
    continuityRecommendations = parsed.continuityRecommendations;
    governanceMitigations = parsed.governanceMitigations;
    executiveSummary = parsed.executiveSummary;
    modelGenerated = true;
    await audit('exit_interview.succession_analysis.completed', { interviews: published.length });
  } else {
    executiveSummary =
      'No published exit interviews to analyze. Capturing organizational knowledge through exit interviews is the critical first step toward organizational continuity.';
  }

  return {
    organizationId: orgId,
    generatedAt: new Date().toISOString(),
    transitionReadinessScore: null,
    transitionReadinessBasis: 'not_assessed_no_successor_records',
    departureDocumentationCoverage,
    roleSuccessionStatus,
    criticalOperationalGaps,
    documentationPriorities,
    continuityRecommendations,
    governanceMitigations,
    executiveSummary,
    modelGenerated,
  };
}
