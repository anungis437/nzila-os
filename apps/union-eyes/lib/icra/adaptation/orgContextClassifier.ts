/**
 * ARTIFACT TYPE: Deterministic Classifier
 * MODULE: OCRA Dynamic Questionnaire Adaptation
 * DOCTRINE: OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md §3
 *
 * Produces an `InstitutionalAssessmentProfile` from form-declared inputs
 * only. Never reads behavioural signals, free text, IP, geolocation, or any
 * data not explicitly declared by the respondent.
 *
 * Refuses rather than guesses: any unresolved dimension falls back to a
 * conservative default and records a `*_safe_default` rationale.
 */

import {
  resolveContinuityComplexity,
  resolveContinuityExposure,
  resolveGovernanceComplexity,
  resolveInstitutionalScale,
  type OrganizationAgeBand,
} from './orgComplexityModel';
import {
  ADAPTATION_DOCTRINE_VERSION,
  type ClassifierInputs,
  type InstitutionalAssessmentProfile,
  type ProfileRationale,
  type RespondentLens,
} from './types';

/**
 * Conservative defaults used when the corresponding input is missing.
 * These intentionally bias toward the *fuller* question bank and *softer*
 * narrative — the system never makes confident statements from absent data.
 */
const SAFE_DEFAULT_SCALE = 'small' as const;
const SAFE_DEFAULT_COMPLEXITY = 'moderate' as const;
const SAFE_DEFAULT_GOVERNANCE = 'simple' as const;
const SAFE_DEFAULT_EXPOSURE = 'localized' as const;
const SAFE_DEFAULT_LENS: RespondentLens = 'unknown';

// ── Inputs we may also discover from the raw form ─────────────────────────

const FEDERATION_ORG_TYPES = new Set([
  'federation',
  'clc_affiliate',
  'industry_association',
]);

function readString(
  raw: Readonly<Record<string, string | undefined>> | undefined,
  key: string,
): string | undefined {
  if (!raw) return undefined;
  const v = raw[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function readAgeBand(
  raw: Readonly<Record<string, string | undefined>> | undefined,
): OrganizationAgeBand | undefined {
  const v = readString(raw, 'ctx_years_operating');
  switch (v) {
    case 'under_5_years':
    case 'under_5':
      return 'under_5_years';
    case '5_to_14_years':
    case '5_to_14':
      return '5_to_14_years';
    case '15_to_29_years':
    case '15_to_29':
      return '15_to_29_years';
    case '30_plus_years':
    case '30_plus':
      return '30_plus_years';
    default:
      return undefined;
  }
}

// ── Respondent lens map ────────────────────────────────────────────────────

const RESPONDENT_LENS_MAP: Record<string, RespondentLens> = {
  self_senior_leader: 'senior_decision_maker',
  self_board_member: 'board_governance',
  self_staff: 'inside_operator',
  on_behalf_consultant: 'external_advisor',
  on_behalf_counsel: 'legal_or_counsel',
  on_behalf_other: 'external_advisor',
};

function resolveRespondentLens(
  respondentRole: string | undefined,
): RespondentLens | undefined {
  if (!respondentRole) return undefined;
  return RESPONDENT_LENS_MAP[respondentRole];
}

// ── Classifier ─────────────────────────────────────────────────────────────

/**
 * Produce an `InstitutionalAssessmentProfile` from the supplied inputs.
 * Always returns a fully-formed profile, even when inputs are partial —
 * unresolved dimensions fall back to their conservative defaults and record
 * a `*_safe_default` rationale.
 */
export function classifyOrgContext(
  inputs: Readonly<ClassifierInputs>,
): InstitutionalAssessmentProfile {
  const raw = inputs.rawForm;
  const canonical = inputs.canonicalContext;
  const extras = inputs.extras;

  // ── Read inputs (raw form first, canonical second, extras third) ─────────

  const sector = canonical?.sector ?? readString(raw, 'ctx_sector');

  const workforceBand = canonical?.workforceBand ?? (() => {
    const s = readString(raw, 'ctx_membership_size');
    switch (s) {
      case 'under_100':
      case '100_499':
        return 'under_50' as const;
      case '500_1999':
        return '50_249' as const;
      case '2000_9999':
        return '250_999' as const;
      case '10000_49999':
        return '1000_4999' as const;
      case '50000_plus':
        return '5000_plus' as const;
      default:
        return undefined;
    }
  })();

  const orgType = extras?.organizationType ?? readString(raw, 'ctx_org_type');
  const ageBand = extras?.organizationAge ?? readAgeBand(raw);

  const governanceModel =
    canonical?.governanceModel ??
    (orgType
      ? orgType === 'crown_corp' ||
        orgType === 'government_agency' ||
        orgType === 'school_board' ||
        orgType === 'health_authority' ||
        orgType === 'municipality'
        ? ('appointed_board' as const)
        : orgType === 'local_union' ||
            orgType === 'national_union' ||
            orgType === 'federation' ||
            orgType === 'clc_affiliate' ||
            orgType === 'indigenous_gov' ||
            orgType === 'cooperative'
          ? ('elected_board' as const)
          : ('other' as const)
      : undefined);

  const hasFederationAffiliation = Boolean(
    canonical?.federationAffiliation ??
      (orgType && FEDERATION_ORG_TYPES.has(orgType)),
  );

  const respondentRole =
    canonical?.respondentRole ?? readString(raw, 'ctx_respondent_role');

  // ── Run the model ────────────────────────────────────────────────────────

  const scaleResolved = resolveInstitutionalScale(
    workforceBand,
    hasFederationAffiliation,
  );
  const complexityResolved = resolveContinuityComplexity(scaleResolved, ageBand);
  const governanceResolved = resolveGovernanceComplexity(
    governanceModel,
    scaleResolved,
    hasFederationAffiliation,
  );
  const exposureResolved = resolveContinuityExposure(sector, scaleResolved);
  const lensResolved = resolveRespondentLens(respondentRole);

  // ── Assemble rationale ───────────────────────────────────────────────────

  const rationale: ProfileRationale[] = [];
  let usedConservativeDefault = false;

  if (scaleResolved) {
    rationale.push({
      dimension: 'institutionalScale',
      ruleId: hasFederationAffiliation && scaleResolved === 'federated_complex'
        ? 'scale.federation_override'
        : 'scale.workforce_band_map',
      statement: hasFederationAffiliation && scaleResolved === 'federated_complex'
        ? 'Federation affiliation with mid-sized or larger workforce promotes scale to federated_complex.'
        : `Workforce band ${workforceBand} maps to institutional scale ${scaleResolved}.`,
      inputs: [
        ...(workforceBand ? [{ key: 'workforceBand', value: workforceBand }] : []),
        ...(hasFederationAffiliation
          ? [{ key: 'federationAffiliation', value: 'present' }]
          : []),
      ],
    });
  } else {
    usedConservativeDefault = true;
    rationale.push({
      dimension: 'institutionalScale',
      ruleId: 'scale.safe_default',
      statement: 'Workforce band not declared; using conservative default scale (small).',
      inputs: [],
    });
  }

  if (complexityResolved) {
    rationale.push({
      dimension: 'continuityComplexity',
      ruleId: 'complexity.scale_age_map',
      statement: `Scale ${scaleResolved}${ageBand ? ` and age ${ageBand}` : ''} maps to continuity complexity ${complexityResolved}.`,
      inputs: [
        ...(scaleResolved ? [{ key: 'institutionalScale', value: scaleResolved }] : []),
        ...(ageBand ? [{ key: 'organizationAge', value: ageBand }] : []),
      ],
    });
  } else {
    usedConservativeDefault = true;
    rationale.push({
      dimension: 'continuityComplexity',
      ruleId: 'complexity.safe_default',
      statement: 'Insufficient inputs to determine continuity complexity; using conservative default (moderate).',
      inputs: [],
    });
  }

  if (governanceResolved) {
    rationale.push({
      dimension: 'governanceComplexity',
      ruleId: hasFederationAffiliation
        ? 'governance.federation_override'
        : `governance.${governanceModel ?? 'unknown'}_map`,
      statement: hasFederationAffiliation
        ? 'Federation affiliation maps to federated governance complexity.'
        : `Governance model ${governanceModel} maps to governance complexity ${governanceResolved}.`,
      inputs: [
        ...(governanceModel ? [{ key: 'governanceModel', value: governanceModel }] : []),
        ...(hasFederationAffiliation
          ? [{ key: 'federationAffiliation', value: 'present' }]
          : []),
      ],
    });
  } else {
    usedConservativeDefault = true;
    rationale.push({
      dimension: 'governanceComplexity',
      ruleId: 'governance.safe_default',
      statement: 'Governance model not declared; using conservative default (simple).',
      inputs: [],
    });
  }

  if (exposureResolved) {
    rationale.push({
      dimension: 'continuityExposure',
      ruleId: `exposure.sector_${sector ?? 'unknown'}_map`,
      statement: sector
        ? `Sector ${sector} maps to continuity exposure ${exposureResolved}.`
        : `Sector not declared; scale ${scaleResolved} infers exposure ${exposureResolved}.`,
      inputs: [
        ...(sector ? [{ key: 'sector', value: sector }] : []),
        ...(scaleResolved ? [{ key: 'institutionalScale', value: scaleResolved }] : []),
      ],
    });
  } else {
    usedConservativeDefault = true;
    rationale.push({
      dimension: 'continuityExposure',
      ruleId: 'exposure.safe_default',
      statement: 'Sector not declared and scale unresolved; using conservative default (localized).',
      inputs: [],
    });
  }

  if (lensResolved) {
    rationale.push({
      dimension: 'respondentLens',
      ruleId: `lens.respondent_role_${respondentRole}_map`,
      statement: `Respondent role ${respondentRole} maps to ${lensResolved} lens.`,
      inputs: respondentRole ? [{ key: 'respondentRole', value: respondentRole }] : [],
    });
  } else {
    usedConservativeDefault = true;
    rationale.push({
      dimension: 'respondentLens',
      ruleId: 'lens.safe_default',
      statement: 'Respondent role not declared; using unknown lens.',
      inputs: [],
    });
  }

  const profile: InstitutionalAssessmentProfile = {
    doctrineVersion: ADAPTATION_DOCTRINE_VERSION,
    institutionalScale: scaleResolved ?? SAFE_DEFAULT_SCALE,
    continuityComplexity: complexityResolved ?? SAFE_DEFAULT_COMPLEXITY,
    governanceComplexity: governanceResolved ?? SAFE_DEFAULT_GOVERNANCE,
    continuityExposure: exposureResolved ?? SAFE_DEFAULT_EXPOSURE,
    respondentLens: lensResolved ?? SAFE_DEFAULT_LENS,
    rationale,
    isComplete: !usedConservativeDefault,
    usedConservativeDefault,
  };

  return Object.freeze(profile);
}
