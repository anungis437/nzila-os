/**
 * Employer Compliance Posture Service
 *
 * Aggregates signals (grievance frequency, compliance alerts,
 * dispatch non-compliance, arbitration history) and produces
 * a bounded compliance posture reading and contextual band per employer.
 *
 * This is organizational monitoring for governance continuity —
 * not workforce surveillance. The system supports steward decision-making;
 * it does not make determinations or apply consequences autonomously.
 *
 * CONSTRAINTS:
 * - Every output: confidence + explanation
 * - Org-scoped, audited
 * - Advisory only — no automatic sanctions or escalations
 *
 * @module lib/ai/employer-risk
 */

import { db } from '@/db/db';
import { eq, and, gte, desc, count, sql as _sql } from 'drizzle-orm';
import { getAiClient, UE_APP_KEY, UE_PROFILES, UE_SYSTEM_ORG_ID } from '@/lib/ai/ai-client';
import { employerRiskScores, type EmployerRiskScoreInsert } from '@/db/schema/domains/ml/employer-risk-scores';
import { employers } from '@/db/schema/domains/compliance/employer-compliance';
import { complianceAlerts } from '@/db/schema/domains/compliance/employer-compliance';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { auditAiInteraction, buildAiEnvelope, type AiResponseEnvelope } from './ai-feature-guard';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface RiskInput {
  employerId: string;
  organizationId: string;
  userId: string;
}

export interface RiskSignal {
  signal: string;
  value: number;
  weight: number;
  description: string;
}

export interface RiskResult {
  overallScore: number;
  riskBand: 'low' | 'moderate' | 'elevated' | 'high' | 'critical';
  trendDirection: 'improving' | 'stable' | 'worsening';
  signals: RiskSignal[];
  grievanceCount30d: number;
  complianceAlertCount30d: number;
  arbitrationCount12m: number;
}

const MODEL_VERSION = '1.0.0';

// ============================================================================
// SERVICE
// ============================================================================

/**
 * Calculate employer risk score with AI-assisted analysis.
 */
export async function calculateEmployerRisk(
  input: RiskInput,
): Promise<AiResponseEnvelope<RiskResult>> {
  const { employerId, organizationId, userId } = input;

  // 1. Fetch employer
  const employer = await db.query.employers.findFirst({
    where: and(eq(employers.id, employerId), eq(employers.orgId, organizationId)),
  });
  if (!employer) throw new Error(`Employer ${employerId} not found in org ${organizationId}`);

  // 2. Derive raw signals
  const signals = await deriveRiskSignals(employerId, organizationId);

  // 3. Call AI for weighted scoring + explanation
  const ai = getAiClient();
  const prompt = buildRiskPrompt(employer, signals);
  const aiResult = await ai.generate({
    orgId: UE_SYSTEM_ORG_ID,
    appKey: UE_APP_KEY,
    profileKey: UE_PROFILES.EMPLOYER_RISK,
    input: prompt,
    dataClass: 'internal',
  });

  const parsed = parseRiskResponse(aiResult.content ?? '', signals);

  // 4. Audit
  const auditRef = await auditAiInteraction({
    featureName: 'employer_risk',
    userId,
    organizationId,
    resource: 'employers',
    resourceId: employerId,
    action: 'risk_score',
    confidence: parsed.confidence,
    modelVersion: MODEL_VERSION,
  });

  // 5. Persist
  const insert: EmployerRiskScoreInsert = {
    organizationId,
    employerId,
    overallScore: parsed.result.overallScore.toFixed(4),
    riskBand: parsed.result.riskBand,
    trendDirection: parsed.result.trendDirection,
    signalsJson: parsed.result.signals,
    grievanceCount30d: parsed.result.grievanceCount30d,
    complianceAlertCount30d: parsed.result.complianceAlertCount30d,
    arbitrationCount12m: parsed.result.arbitrationCount12m,
    confidence: parsed.confidence.toFixed(4),
    explanation: parsed.explanation,
    modelVersion: MODEL_VERSION,
    profileKey: UE_PROFILES.EMPLOYER_RISK,
    auditRef,
  };

  await db.insert(employerRiskScores).values(insert);

  return buildAiEnvelope(parsed.result, {
    confidence: parsed.confidence,
    explanation: parsed.explanation,
    modelVersion: MODEL_VERSION,
    auditRef,
  });
}

/**
 * Derive raw risk signals from the database (no AI involved).
 */
export async function deriveRiskSignals(
  employerId: string,
  organizationId: string,
): Promise<{ grievanceCount30d: number; complianceAlertCount30d: number; arbitrationCount12m: number }> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const [gCount] = await db
    .select({ value: count() })
    .from(grievances)
    .where(
      and(
        eq(grievances.employerId, employerId),
        eq(grievances.organizationId, organizationId),
        gte(grievances.createdAt, thirtyDaysAgo),
      ),
    );

  const [aCount] = await db
    .select({ value: count() })
    .from(complianceAlerts)
    .where(
      and(
        eq(complianceAlerts.employerId, employerId),
        eq(complianceAlerts.orgId, organizationId),
        gte(complianceAlerts.createdAt, thirtyDaysAgo),
      ),
    );

  const [arbCount] = await db
    .select({ value: count() })
    .from(grievances)
    .where(
      and(
        eq(grievances.employerId, employerId),
        eq(grievances.organizationId, organizationId),
        eq(grievances.status, 'arbitration'),
        gte(grievances.createdAt, twelveMonthsAgo),
      ),
    );

  return {
    grievanceCount30d: gCount?.value ?? 0,
    complianceAlertCount30d: aCount?.value ?? 0,
    arbitrationCount12m: arbCount?.value ?? 0,
  };
}

/**
 * Get latest risk score for an employer.
 */
export async function getLatestRiskScore(employerId: string, organizationId: string) {
  return db.query.employerRiskScores.findFirst({
    where: and(
      eq(employerRiskScores.employerId, employerId),
      eq(employerRiskScores.organizationId, organizationId),
    ),
    orderBy: [desc(employerRiskScores.createdAt)],
  });
}

/**
 * Get risk history for an employer (for trend charts).
 */
export async function getRiskHistory(employerId: string, organizationId: string, limit = 20) {
  return db.query.employerRiskScores.findMany({
    where: and(
      eq(employerRiskScores.employerId, employerId),
      eq(employerRiskScores.organizationId, organizationId),
    ),
    orderBy: [desc(employerRiskScores.createdAt)],
    limit,
  });
}

/**
 * Classify a numeric score into a risk band.
 */
export function classifyRiskBand(
  score: number,
): 'low' | 'moderate' | 'elevated' | 'high' | 'critical' {
  if (score < 0.2) return 'low';
  if (score < 0.4) return 'moderate';
  if (score < 0.6) return 'elevated';
  if (score < 0.8) return 'high';
  return 'critical';
}

// ============================================================================
// INTERNALS
// ============================================================================

function buildRiskPrompt(
  emp: typeof employers.$inferSelect,
  signals: { grievanceCount30d: number; complianceAlertCount30d: number; arbitrationCount12m: number },
): string {
  return [
    'You are an employer risk analyst for a union organization.',
    'Given the employer profile and observed signals, produce a JSON risk assessment.',
    'Return JSON: {',
    '  overallScore (0-1), riskBand (low|moderate|elevated|high|critical),',
    '  trendDirection (improving|stable|worsening),',
    '  signals: [{ signal, value, weight (0-1), description }],',
    '  confidence (0-1), explanation (string)',
    '}',
    '',
    `Employer: ${emp.name}`,
    `Industry: ${emp.industry ?? 'unknown'}`,
    `Grievances (30d): ${signals.grievanceCount30d}`,
    `Compliance alerts (30d): ${signals.complianceAlertCount30d}`,
    `Arbitrations (12m): ${signals.arbitrationCount12m}`,
    '',
    'Respond ONLY with valid JSON.',
  ].join('\n');
}

function parseRiskResponse(
  raw: string,
  rawSignals: { grievanceCount30d: number; complianceAlertCount30d: number; arbitrationCount12m: number },
): { result: RiskResult; confidence: number; explanation: string } {
  try {
    const json = JSON.parse(raw);
    const overallScore = Math.min(1, Math.max(0, Number(json.overallScore) || 0));
    return {
      result: {
        overallScore,
        riskBand: json.riskBand ?? classifyRiskBand(overallScore),
        trendDirection: json.trendDirection ?? 'stable',
        signals: Array.isArray(json.signals) ? json.signals : [],
        ...rawSignals,
      },
      confidence: Math.min(1, Math.max(0, Number(json.confidence) || 0.5)),
      explanation: String(json.explanation ?? 'AI-generated risk assessment.'),
    };
  } catch {
    logger.warn('Failed to parse employer risk AI response');
    const fallbackScore = Math.min(1, (rawSignals.grievanceCount30d * 0.1 + rawSignals.complianceAlertCount30d * 0.15 + rawSignals.arbitrationCount12m * 0.2));
    return {
      result: {
        overallScore: fallbackScore,
        riskBand: classifyRiskBand(fallbackScore),
        trendDirection: 'stable',
        signals: [],
        ...rawSignals,
      },
      confidence: 0.3,
      explanation: 'AI response could not be parsed. Heuristic score applied.',
    };
  }
}
