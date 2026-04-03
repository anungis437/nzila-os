/**
 * Pension Intelligence AI Service
 *
 * Provides AI-assisted analysis for pension funding health, member benefit
 * projections, and trustee report summarisation. Closes the gap between the
 * pension DB (actuarial_valuations, funding ratios), the Pension Health Score
 * ML model (XGBoost), and the union-eyes AI layer.
 *
 * CONSTRAINTS:
 * - Every output: confidence + explanation
 * - Org-scoped, audited
 * - Advisory only — no automatic benefit decisions or regulatory filings
 * - Does NOT replace a licensed actuary; outputs are for trustee decision support
 *
 * @module lib/ai/pension-intelligence
 */

import { db } from '@/db/db';
import { eq, and, sum, count } from 'drizzle-orm';
import { getAiClient, UE_APP_KEY, UE_PROFILES, UE_SYSTEM_ORG_ID } from '@/lib/ai/ai-client';
import {
  pensionPlans,
  pensionMembers,
  pensionContributions,
} from '@/db/schema/domains/finance/pension';
import { auditAiInteraction, buildAiEnvelope, type AiResponseEnvelope } from './ai-feature-guard';
import { logger } from '@/lib/logger';

const MODEL_VERSION = '1.0.0';

// ============================================================================
// TYPES — Funding Analysis
// ============================================================================

export interface PensionFundingInput {
  planId: string;
  organizationId: string;
  userId: string;
}

export interface FundingRiskFactor {
  factor: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  description: string;
}

export interface PensionFundingResult {
  fundingRatio: number;
  fundingStatus: 'surplus' | 'adequately_funded' | 'underfunded' | 'critically_underfunded';
  totalAssets: number;
  activeMembers: number;
  riskFactors: FundingRiskFactor[];
  trusteeRecommendations: string[];
  nextReviewDate: string;
}

// ============================================================================
// TYPES — Benefit Projection
// ============================================================================

export interface BenefitProjectionInput {
  memberId: string;
  organizationId: string;
  userId: string;
  targetRetirementAge: number;
}

export interface ProjectionScenario {
  label: string;
  estimatedMonthlyBenefit: number;
  estimatedAnnualBenefit: number;
  assumptions: string[];
}

export interface BenefitProjectionResult {
  memberName: string;
  currentAge: number | null;
  yearsOfService: number;
  vestingStatus: string;
  targetRetirementAge: number;
  yearsToRetirement: number | null;
  scenarios: ProjectionScenario[];
  totalContributions: number;
  projectionWarnings: string[];
}

// ============================================================================
// TYPES — Trustee Report Summary
// ============================================================================

export interface TrusteeReportInput {
  planId: string;
  organizationId: string;
  userId: string;
  /** Raw text from an actuarial valuation document, if available. */
  valuationDocumentText?: string;
}

export interface TrusteeReportResult {
  planName: string;
  summaryHeadline: string;
  keyFindings: string[];
  requiredActions: string[];
  regulatoryNotes: string[];
  memberImpactSummary: string;
}

// ============================================================================
// SERVICE — Funding Analysis
// ============================================================================

/**
 * Analyse pension plan funding health and produce trustee-level recommendations.
 */
export async function analyzePensionFunding(
  input: PensionFundingInput,
): Promise<AiResponseEnvelope<PensionFundingResult>> {
  const { planId, organizationId, userId } = input;

  // 1. Fetch plan record
  const plan = await db.query.pensionPlans.findFirst({
    where: and(eq(pensionPlans.id, planId), eq(pensionPlans.organizationId, organizationId)),
  });
  if (!plan) throw new Error(`Pension plan ${planId} not found in org ${organizationId}`);

  const fundingRatio = parseFloat(plan.fundingStatus ?? '100');
  const totalAssets = parseFloat(plan.totalAssets ?? '0');

  // 2. Build prompt context
  const prompt = buildFundingPrompt({
    planName: plan.planName,
    planType: plan.planType ?? 'defined_benefit',
    fundingRatio,
    totalAssets,
    activeMembers: plan.activeMembers ?? 0,
    status: plan.status ?? 'active',
  });

  // 3. Call AI
  const ai = getAiClient();
  const aiResult = await ai.generate({
    orgId: UE_SYSTEM_ORG_ID,
    appKey: UE_APP_KEY,
    profileKey: UE_PROFILES.PENSION_FUNDING_ANALYSIS,
    input: prompt,
    dataClass: 'internal',
  });

  const parsed = parseFundingResponse(aiResult.content ?? '', fundingRatio, totalAssets, plan.activeMembers ?? 0);

  // 4. Audit
  const auditRef = await auditAiInteraction({
    featureName: 'pension_funding_analysis',
    userId,
    organizationId,
    resource: 'pension_plans',
    resourceId: planId,
    action: 'funding_analysis',
    confidence: parsed.confidence,
    modelVersion: MODEL_VERSION,
  });

  return buildAiEnvelope(parsed.result, {
    confidence: parsed.confidence,
    explanation: parsed.explanation,
    modelVersion: MODEL_VERSION,
    auditRef,
  });
}

// ============================================================================
// SERVICE — Benefit Projection
// ============================================================================

/**
 * Project estimated retirement benefit for a pension member at a target age.
 */
export async function projectMemberBenefit(
  input: BenefitProjectionInput,
): Promise<AiResponseEnvelope<BenefitProjectionResult>> {
  const { memberId, organizationId, userId, targetRetirementAge } = input;

  // 1. Fetch member
  const member = await db.query.pensionMembers.findFirst({
    where: and(
      eq(pensionMembers.id, memberId),
      eq(pensionMembers.organizationId, organizationId),
    ),
  });
  if (!member) throw new Error(`Pension member ${memberId} not found in org ${organizationId}`);

  // 2. Fetch contribution total
  const contribRows = await db
    .select({ total: sum(pensionContributions.amount) })
    .from(pensionContributions)
    .where(
      and(
        eq(pensionContributions.memberId, memberId),
        eq(pensionContributions.organizationId, organizationId),
      ),
    );
  const totalContributions = parseFloat(contribRows[0]?.total ?? '0');

  const yearsOfService = parseFloat(member.yearsOfService ?? '0');

  // 3. Build prompt
  const prompt = buildProjectionPrompt({
    name: member.name,
    yearsOfService,
    vestingStatus: member.vestingStatus ?? 'not_vested',
    membershipStatus: member.membershipStatus ?? 'active',
    totalContributions,
    targetRetirementAge,
    planName: member.planName,
  });

  // 4. Call AI
  const ai = getAiClient();
  const aiResult = await ai.generate({
    orgId: UE_SYSTEM_ORG_ID,
    appKey: UE_APP_KEY,
    profileKey: UE_PROFILES.PENSION_BENEFIT_PROJECTION,
    input: prompt,
    dataClass: 'internal',
  });

  const parsed = parseProjectionResponse(
    aiResult.content ?? '',
    member.name,
    yearsOfService,
    member.vestingStatus ?? 'not_vested',
    targetRetirementAge,
    totalContributions,
  );

  // 5. Audit
  const auditRef = await auditAiInteraction({
    featureName: 'pension_benefit_projection',
    userId,
    organizationId,
    resource: 'pension_members',
    resourceId: memberId,
    action: 'benefit_projection',
    confidence: parsed.confidence,
    modelVersion: MODEL_VERSION,
  });

  return buildAiEnvelope(parsed.result, {
    confidence: parsed.confidence,
    explanation: parsed.explanation,
    modelVersion: MODEL_VERSION,
    auditRef,
  });
}

// ============================================================================
// SERVICE — Trustee Report Summary
// ============================================================================

/**
 * Produce a plain-language trustee summary from plan data and/or an actuarial
 * valuation document. Designed for the trustee portal dashboard.
 */
export async function summarizeTrusteeReport(
  input: TrusteeReportInput,
): Promise<AiResponseEnvelope<TrusteeReportResult>> {
  const { planId, organizationId, userId, valuationDocumentText } = input;

  // 1. Fetch plan + member counts
  const plan = await db.query.pensionPlans.findFirst({
    where: and(eq(pensionPlans.id, planId), eq(pensionPlans.organizationId, organizationId)),
  });
  if (!plan) throw new Error(`Pension plan ${planId} not found in org ${organizationId}`);

  const [memberStats] = await db
    .select({ total: count() })
    .from(pensionMembers)
    .where(
      and(
        eq(pensionMembers.planId, planId),
        eq(pensionMembers.organizationId, organizationId),
      ),
    );

  // 2. Build prompt
  const prompt = buildTrusteePrompt({
    planName: plan.planName,
    planType: plan.planType ?? 'defined_benefit',
    status: plan.status ?? 'active',
    fundingRatio: parseFloat(plan.fundingStatus ?? '100'),
    totalAssets: parseFloat(plan.totalAssets ?? '0'),
    activeMembers: plan.activeMembers ?? 0,
    totalMembersOnRecord: memberStats?.total ?? 0,
    valuationDocumentText,
  });

  // 3. Call AI
  const ai = getAiClient();
  const aiResult = await ai.generate({
    orgId: UE_SYSTEM_ORG_ID,
    appKey: UE_APP_KEY,
    profileKey: UE_PROFILES.PENSION_TRUSTEE_SUMMARY,
    input: prompt,
    dataClass: 'internal',
  });

  const parsed = parseTrusteeResponse(aiResult.content ?? '', plan.planName);

  // 4. Audit
  const auditRef = await auditAiInteraction({
    featureName: 'pension_trustee_summary',
    userId,
    organizationId,
    resource: 'pension_plans',
    resourceId: planId,
    action: 'trustee_report_summary',
    confidence: parsed.confidence,
    modelVersion: MODEL_VERSION,
  });

  return buildAiEnvelope(parsed.result, {
    confidence: parsed.confidence,
    explanation: parsed.explanation,
    modelVersion: MODEL_VERSION,
    auditRef,
  });
}

// ============================================================================
// PROMPT BUILDERS
// ============================================================================

function buildFundingPrompt(data: {
  planName: string;
  planType: string;
  fundingRatio: number;
  totalAssets: number;
  activeMembers: number;
  status: string;
}): string {
  return `You are an actuarial analyst AI supporting a union trustee board.
Analyse the following pension plan funding metrics and produce a structured JSON response.

PLAN DATA:
- Plan Name: ${data.planName}
- Plan Type: ${data.planType}
- Funding Ratio: ${data.fundingRatio.toFixed(2)}%
- Total Assets: CAD ${data.totalAssets.toLocaleString()}
- Active Members: ${data.activeMembers}
- Status: ${data.status}

FUNDING RATIO BENCHMARKS:
- >= 110%: Surplus
- 100–110%: Adequately funded
- 80–100%: Underfunded (regulatory attention required)
- < 80%: Critically underfunded (immediate trustee action required)

Return ONLY a JSON object with this exact structure:
{
  "fundingStatus": "surplus"|"adequately_funded"|"underfunded"|"critically_underfunded",
  "riskFactors": [{ "factor": string, "severity": "low"|"moderate"|"high"|"critical", "description": string }],
  "trusteeRecommendations": [string],
  "nextReviewDate": "YYYY-MM-DD",
  "confidence": number (0–1),
  "explanation": string
}`;
}

function buildProjectionPrompt(data: {
  name: string;
  yearsOfService: number;
  vestingStatus: string;
  membershipStatus: string;
  totalContributions: number;
  targetRetirementAge: number;
  planName: string;
}): string {
  return `You are a pension benefit projection assistant supporting union members.
Project estimated retirement benefits based on the member data below.

MEMBER DATA:
- Name: ${data.name}
- Plan: ${data.planName}
- Years of Service: ${data.yearsOfService}
- Vesting Status: ${data.vestingStatus}
- Membership Status: ${data.membershipStatus}
- Total Contributions on Record: CAD ${data.totalContributions.toLocaleString()}
- Target Retirement Age: ${data.targetRetirementAge}

Produce three scenarios: conservative, base, and optimistic.
Use standard defined-benefit formula assumptions (1.5–2% of final salary × years of service)
where salary data is unavailable — note this assumption clearly.

Return ONLY a JSON object with this exact structure:
{
  "scenarios": [
    {
      "label": "conservative"|"base"|"optimistic",
      "estimatedMonthlyBenefit": number,
      "estimatedAnnualBenefit": number,
      "assumptions": [string]
    }
  ],
  "projectionWarnings": [string],
  "confidence": number (0–1),
  "explanation": string
}`;
}

function buildTrusteePrompt(data: {
  planName: string;
  planType: string;
  status: string;
  fundingRatio: number;
  totalAssets: number;
  activeMembers: number;
  totalMembersOnRecord: number;
  valuationDocumentText?: string;
}): string {
  const docSection = data.valuationDocumentText
    ? `\nACTUARIAL VALUATION DOCUMENT EXTRACT:\n${data.valuationDocumentText.slice(0, 3000)}`
    : '\n(No valuation document provided — use plan metrics only)';

  return `You are an AI assistant preparing a plain-language trustee board summary.
Summarise the pension plan status for non-technical trustees.

PLAN METRICS:
- Plan Name: ${data.planName}
- Type: ${data.planType}
- Status: ${data.status}
- Funding Ratio: ${data.fundingRatio.toFixed(2)}%
- Total Assets: CAD ${data.totalAssets.toLocaleString()}
- Active Members: ${data.activeMembers}
- Total Members on Record: ${data.totalMembersOnRecord}
${docSection}

Write for a non-technical audience. Be concise. Flag required actions clearly.

Return ONLY a JSON object with this exact structure:
{
  "summaryHeadline": string,
  "keyFindings": [string],
  "requiredActions": [string],
  "regulatoryNotes": [string],
  "memberImpactSummary": string,
  "confidence": number (0–1),
  "explanation": string
}`;
}

// ============================================================================
// RESPONSE PARSERS
// ============================================================================

function parseFundingResponse(
  content: string,
  fundingRatio: number,
  totalAssets: number,
  activeMembers: number,
): { result: PensionFundingResult; confidence: number; explanation: string } {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return {
      result: {
        fundingRatio,
        fundingStatus: parsed.fundingStatus ?? deriveFundingStatus(fundingRatio),
        totalAssets,
        activeMembers,
        riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
        trusteeRecommendations: Array.isArray(parsed.trusteeRecommendations)
          ? parsed.trusteeRecommendations
          : [],
        nextReviewDate: parsed.nextReviewDate ?? '',
      },
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      explanation: parsed.explanation ?? 'Funding analysis completed.',
    };
  } catch (err) {
    logger.warn(`pension_funding: failed to parse AI response — using fallback: ${err}`);
    return {
      result: {
        fundingRatio,
        fundingStatus: deriveFundingStatus(fundingRatio),
        totalAssets,
        activeMembers,
        riskFactors: [],
        trusteeRecommendations: ['Manual review required — AI analysis unavailable.'],
        nextReviewDate: '',
      },
      confidence: 0,
      explanation: 'AI response could not be parsed.',
    };
  }
}

function parseProjectionResponse(
  content: string,
  memberName: string,
  yearsOfService: number,
  vestingStatus: string,
  targetRetirementAge: number,
  totalContributions: number,
): { result: BenefitProjectionResult; confidence: number; explanation: string } {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return {
      result: {
        memberName,
        currentAge: null,
        yearsOfService,
        vestingStatus,
        targetRetirementAge,
        yearsToRetirement: null,
        scenarios: Array.isArray(parsed.scenarios) ? parsed.scenarios : [],
        totalContributions,
        projectionWarnings: Array.isArray(parsed.projectionWarnings) ? parsed.projectionWarnings : [],
      },
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      explanation: parsed.explanation ?? 'Benefit projection completed.',
    };
  } catch (err) {
    logger.warn(`pension_projection: failed to parse AI response — using fallback: ${err}`);
    return {
      result: {
        memberName,
        currentAge: null,
        yearsOfService,
        vestingStatus,
        targetRetirementAge,
        yearsToRetirement: null,
        scenarios: [],
        totalContributions,
        projectionWarnings: ['AI projection unavailable — consult plan administrator.'],
      },
      confidence: 0,
      explanation: 'AI response could not be parsed.',
    };
  }
}

function parseTrusteeResponse(
  content: string,
  planName: string,
): { result: TrusteeReportResult; confidence: number; explanation: string } {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return {
      result: {
        planName,
        summaryHeadline: parsed.summaryHeadline ?? '',
        keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
        requiredActions: Array.isArray(parsed.requiredActions) ? parsed.requiredActions : [],
        regulatoryNotes: Array.isArray(parsed.regulatoryNotes) ? parsed.regulatoryNotes : [],
        memberImpactSummary: parsed.memberImpactSummary ?? '',
      },
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      explanation: parsed.explanation ?? 'Trustee summary completed.',
    };
  } catch (err) {
    logger.warn(`pension_trustee_summary: failed to parse AI response — using fallback: ${err}`);
    return {
      result: {
        planName,
        summaryHeadline: 'Summary unavailable',
        keyFindings: [],
        requiredActions: ['Manual review required — AI summary unavailable.'],
        regulatoryNotes: [],
        memberImpactSummary: '',
      },
      confidence: 0,
      explanation: 'AI response could not be parsed.',
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function deriveFundingStatus(
  ratio: number,
): PensionFundingResult['fundingStatus'] {
  if (ratio >= 110) return 'surplus';
  if (ratio >= 100) return 'adequately_funded';
  if (ratio >= 80) return 'underfunded';
  return 'critically_underfunded';
}
