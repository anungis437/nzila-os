/**
 * ICRA → HubSpot property mapper.
 *
 * Deterministic, pure, no side effects. Every enum the ICRA system produces
 * has exactly one HubSpot property representation here. Adding a new band,
 * persona, or burden bucket requires updating this file — by design, so that
 * mapping drift surfaces in code review, not in production CRM data.
 *
 * Naming doctrine:
 * - Property keys use snake_case prefixed with `oci_` (e.g. `oci_maturity_band`).
 * - Property values use Title Case organizational vocabulary (e.g. `Continuity-Aware`),
 *   not SaaS / marketing capitalization, and never raw enum identifiers.
 * - Custom property keys are exported so they can be created once on the
 *   HubSpot side (in HubSpot's custom-property UI) and referenced consistently.
 *
 * Anti-surveillance posture:
 * - Mapper takes only what the assessment already produced. It does not enrich,
 *   infer, or behaviorally score. UTM context is captured *if voluntarily*
 *   present on the profile, never derived from third-party tracking.
 */

import type {
  ContinuityBurdenIndex,
  ExecutivePersonaId,
  InstitutionalContinuityProfile,
  MaturityBandId,
  ReportTierId,
} from '@/lib/icra/types';

// ─────────────────────────────────────────────────────────────────────────────
// HubSpot custom property keys (define once on HubSpot side)
// ─────────────────────────────────────────────────────────────────────────────

export const ICRA_CONTACT_PROPERTIES = {
  maturityBand: 'oci_maturity_band',
  operationalPattern: 'oci_operational_pattern',
  burdenLevel: 'oci_continuity_burden',
  burdenScore: 'oci_continuity_burden_score',
  governanceEntropy: 'oci_governance_entropy',
  stewardshipConcentration: 'oci_stewardship_concentration',
  modernizationAlignment: 'oci_modernization_alignment',
  institutionalDependencyRisk: 'oci_institutional_dependency_risk',
  persona: 'oci_executive_persona',
  reportTier: 'oci_report_tier',
  lastAssessmentAt: 'oci_last_assessment_at',
  utmSource: 'oci_utm_source',
  utmMedium: 'oci_utm_medium',
  utmCampaign: 'oci_utm_campaign',
} as const;

export const ICRA_COMPANY_PROPERTIES = {
  maturityBand: 'oci_maturity_band',
  burdenLevel: 'oci_continuity_burden',
  governanceComplexity: 'oci_governance_complexity',
  modernizationMaturity: 'oci_modernization_maturity',
  continuityRiskPosture: 'oci_continuity_risk_posture',
  transformationReadiness: 'oci_transformation_readiness',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Maturity band — display labels (organizational, public-facing vocabulary)
// ─────────────────────────────────────────────────────────────────────────────

export const MATURITY_BAND_LABELS: Record<MaturityBandId, string> = {
  personality_dependent: 'Personality Dependent',
  fragmented_coordination: 'Fragmented Coordination',
  structured_governance: 'Structured Governance',
  continuity_aware: 'Continuity-Aware',
  continuity_intelligence: 'Continuity Intelligence',
};

/**
 * Operational pattern — separate vocabulary used in CRM-facing properties.
 * Aligned 1:1 with maturity band but worded for organizational readers.
 */
export const OPERATIONAL_PATTERN_LABELS: Record<MaturityBandId, string> = {
  personality_dependent: 'Personality Dependent',
  fragmented_coordination: 'Fragmented Coordination',
  structured_governance: 'Structured Governance',
  continuity_aware: 'Continuity-Aware',
  continuity_intelligence: 'Continuity Intelligence',
};

// ─────────────────────────────────────────────────────────────────────────────
// Burden index — 4 organizational bands (Low / Moderate / Elevated / Severe)
// ─────────────────────────────────────────────────────────────────────────────

export type BurdenLevelLabel = 'Low' | 'Moderate' | 'Elevated' | 'Severe';

/** Bucket a 0–100 burden score into a calm organizational label. */
export function mapBurdenLevel(score: number): BurdenLevelLabel {
  const s = Math.max(0, Math.min(100, score));
  if (s >= 75) return 'Severe';
  if (s >= 55) return 'Elevated';
  if (s >= 30) return 'Moderate';
  return 'Low';
}

// ─────────────────────────────────────────────────────────────────────────────
// Persona
// ─────────────────────────────────────────────────────────────────────────────

export const PERSONA_LABELS: Record<ExecutivePersonaId, string> = {
  executive_director: 'Executive Director',
  union_leadership: 'Union Leadership',
  healthcare_ops: 'Healthcare Operations',
  governance_board: 'Governance Board',
  cio_coo: 'CIO / COO',
  federated_org: 'Federated Organization',
};

// ─────────────────────────────────────────────────────────────────────────────
// Report tier
// ─────────────────────────────────────────────────────────────────────────────

export const REPORT_TIER_LABELS: Record<ReportTierId, string> = {
  continuity_reflection: 'Continuity Reflection',
  executive_continuity_brief: 'Executive Continuity Brief',
  institutional_continuity_diagnostic: 'Organizational Continuity Diagnostic',
};

// ─────────────────────────────────────────────────────────────────────────────
// Derived posture — calm three-band labels (no scoring leakage to CRM)
// ─────────────────────────────────────────────────────────────────────────────

export type PostureLabel = 'Low' | 'Moderate' | 'Elevated';

function dimScore(profile: InstitutionalContinuityProfile, dim: string): number {
  return profile.dimensions.find((d) => d.dimension === dim)?.score ?? 50;
}

function postureFromRiskScore(score: number): PostureLabel {
  // RISK dimensions in the profile are continuity-positive (already inverted).
  // Lower score = higher risk.
  if (score < 45) return 'Elevated';
  if (score < 65) return 'Moderate';
  return 'Low';
}

/** Governance entropy — higher governance fragility (= lower score) → elevated entropy. */
export function mapGovernanceEntropy(profile: InstitutionalContinuityProfile): PostureLabel {
  return postureFromRiskScore(dimScore(profile, 'governance_fragility'));
}

/** Stewardship concentration — derived from continuity burden + dependency dims. */
export function mapStewardshipConcentration(
  profile: InstitutionalContinuityProfile,
): PostureLabel {
  const burden = profile.burdenIndex?.score ?? 50;
  const ic = dimScore(profile, 'institutional_continuity');
  // High burden + low organizational continuity = concentration risk.
  if (burden >= 65 || ic < 40) return 'Elevated';
  if (burden >= 45 || ic < 60) return 'Moderate';
  return 'Low';
}

/** Organizational dependency risk — operational memory + transition readiness. */
export function mapInstitutionalDependencyRisk(
  profile: InstitutionalContinuityProfile,
): PostureLabel {
  const om = dimScore(profile, 'operational_memory');
  const tr = dimScore(profile, 'transition_readiness');
  const avg = (om + tr) / 2;
  return postureFromRiskScore(avg);
}

/**
 * Modernization alignment — measures whether continuity infrastructure keeps
 * pace with the institution's posture. "Aligned" / "Watch" / "Misaligned".
 */
export type ModernizationAlignmentLabel = 'Aligned' | 'Watch' | 'Misaligned';

export function mapModernizationAlignment(
  profile: InstitutionalContinuityProfile,
): ModernizationAlignmentLabel {
  const ic = dimScore(profile, 'institutional_continuity');
  const om = dimScore(profile, 'operational_memory');
  const gap = ic - om;
  if (gap >= 20) return 'Misaligned';
  if (gap >= 10) return 'Watch';
  return 'Aligned';
}

// ─────────────────────────────────────────────────────────────────────────────
// Company-level — organizational state, not marketing segmentation
// ─────────────────────────────────────────────────────────────────────────────

export type ComplexityLabel = 'Low' | 'Moderate' | 'High';

export function mapGovernanceComplexity(
  profile: InstitutionalContinuityProfile,
): ComplexityLabel {
  const gf = dimScore(profile, 'governance_fragility');
  const td = dimScore(profile, 'trust_debt');
  const avg = (gf + td) / 2;
  if (avg < 45) return 'High';
  if (avg < 65) return 'Moderate';
  return 'Low';
}

export function mapModernizationMaturity(
  profile: InstitutionalContinuityProfile,
): ComplexityLabel {
  const ic = dimScore(profile, 'institutional_continuity');
  if (ic >= 70) return 'High';
  if (ic >= 45) return 'Moderate';
  return 'Low';
}

export function mapContinuityRiskPosture(
  profile: InstitutionalContinuityProfile,
): PostureLabel {
  const composite = profile.composite;
  if (composite < 40) return 'Elevated';
  if (composite < 65) return 'Moderate';
  return 'Low';
}

export function mapTransformationReadiness(
  profile: InstitutionalContinuityProfile,
): PostureLabel {
  const tr = dimScore(profile, 'transition_readiness');
  return postureFromRiskScore(tr);
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-level builders — produce HubSpot custom-property records
// ─────────────────────────────────────────────────────────────────────────────

export interface IcraContactAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

/** Build the HubSpot contact custom-properties record from an ICRA profile. */
export function buildContactProperties(
  profile: InstitutionalContinuityProfile,
  options: {
    persona?: ExecutivePersonaId;
    attribution?: IcraContactAttribution;
  } = {},
): Record<string, string> {
  const burden: ContinuityBurdenIndex | undefined = profile.burdenIndex;
  const burdenScore = burden?.score ?? 50;
  const props: Record<string, string> = {
    [ICRA_CONTACT_PROPERTIES.maturityBand]: MATURITY_BAND_LABELS[profile.maturityBand.id],
    [ICRA_CONTACT_PROPERTIES.operationalPattern]: OPERATIONAL_PATTERN_LABELS[profile.maturityBand.id],
    [ICRA_CONTACT_PROPERTIES.burdenLevel]: mapBurdenLevel(burdenScore),
    [ICRA_CONTACT_PROPERTIES.burdenScore]: String(burdenScore),
    [ICRA_CONTACT_PROPERTIES.governanceEntropy]: mapGovernanceEntropy(profile),
    [ICRA_CONTACT_PROPERTIES.stewardshipConcentration]: mapStewardshipConcentration(profile),
    [ICRA_CONTACT_PROPERTIES.modernizationAlignment]: mapModernizationAlignment(profile),
    [ICRA_CONTACT_PROPERTIES.institutionalDependencyRisk]: mapInstitutionalDependencyRisk(profile),
    [ICRA_CONTACT_PROPERTIES.reportTier]:
      REPORT_TIER_LABELS[profile.reportTierId ?? 'continuity_reflection'],
    [ICRA_CONTACT_PROPERTIES.lastAssessmentAt]: profile.generatedAt,
  };

  if (options.persona) {
    props[ICRA_CONTACT_PROPERTIES.persona] = PERSONA_LABELS[options.persona];
  }

  // UTM — only what the assessment voluntarily carried; never derived.
  if (options.attribution?.utmSource) {
    props[ICRA_CONTACT_PROPERTIES.utmSource] = options.attribution.utmSource;
  }
  if (options.attribution?.utmMedium) {
    props[ICRA_CONTACT_PROPERTIES.utmMedium] = options.attribution.utmMedium;
  }
  if (options.attribution?.utmCampaign) {
    props[ICRA_CONTACT_PROPERTIES.utmCampaign] = options.attribution.utmCampaign;
  }

  return props;
}

/** Build the HubSpot company custom-properties record from an ICRA profile. */
export function buildCompanyProperties(
  profile: InstitutionalContinuityProfile,
): Record<string, string> {
  const burdenScore = profile.burdenIndex?.score ?? 50;
  return {
    [ICRA_COMPANY_PROPERTIES.maturityBand]: MATURITY_BAND_LABELS[profile.maturityBand.id],
    [ICRA_COMPANY_PROPERTIES.burdenLevel]: mapBurdenLevel(burdenScore),
    [ICRA_COMPANY_PROPERTIES.governanceComplexity]: mapGovernanceComplexity(profile),
    [ICRA_COMPANY_PROPERTIES.modernizationMaturity]: mapModernizationMaturity(profile),
    [ICRA_COMPANY_PROPERTIES.continuityRiskPosture]: mapContinuityRiskPosture(profile),
    [ICRA_COMPANY_PROPERTIES.transformationReadiness]: mapTransformationReadiness(profile),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline / lifecycle stages — organizational, not SaaS funnel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Continuity-native deal stages. The HubSpot side must define a dedicated
 * "Organizational Continuity Infrastructure" pipeline with these stage IDs;
 * the human-readable stage names are listed alongside for HubSpot setup.
 */
export const ICRA_DEAL_STAGES = {
  reflection_completed: 'oci_reflection_completed',
  brief_purchased: 'oci_brief_purchased',
  diagnostic_interest: 'oci_diagnostic_interest',
  oci_discovery: 'oci_discovery',
  pilot_evaluation: 'oci_pilot_evaluation',
  continuity_program: 'oci_continuity_program',
  strategic_partnership: 'oci_strategic_partnership',
} as const;

export const ICRA_DEAL_STAGE_LABELS: Record<keyof typeof ICRA_DEAL_STAGES, string> = {
  reflection_completed: 'Continuity Reflection Completed',
  brief_purchased: 'Executive Brief Purchased',
  diagnostic_interest: 'Executive Diagnostic Interest',
  oci_discovery: 'OCI Discovery',
  pilot_evaluation: 'Pilot Evaluation',
  continuity_program: 'Organizational Continuity Program',
  strategic_partnership: 'OCI Strategic Partnership',
};

export type IcraDealStageKey = keyof typeof ICRA_DEAL_STAGES;
