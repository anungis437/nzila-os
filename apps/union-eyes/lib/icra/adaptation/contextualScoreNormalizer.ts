/**
 * ARTIFACT TYPE: Contextual Score Normalizer (pure)
 * MODULE: OCRA Dynamic Questionnaire Adaptation
 * DOCTRINE: OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md §5
 *
 * Produces a `NormalizedInterpretation` — a profile-aware interpretation of
 * the unchanged raw composite. The composite NEVER changes; the
 * interpretation might (e.g., a 65/100 reads as "structurally adequate" for
 * a micro org but as "concerning" for a mission-critical institution).
 *
 * Returns interpretive labels and severity bands, never adjusted numerics.
 */

import type { InstitutionalAssessmentProfile } from './types';

export type InterpretationSeverity =
  | 'reassuring'
  | 'workable'
  | 'concerning'
  | 'fragile'
  | 'critical';

export interface NormalizedInterpretation {
  /** Raw composite — passed through, never altered. */
  readonly rawComposite: number;
  /** Profile-aware severity label. */
  readonly severity: InterpretationSeverity;
  /** One-sentence interpretive statement for the report header. */
  readonly statement: string;
  /** Stable rule id for telemetry & tests. */
  readonly ruleId: string;
}

interface BandThreshold {
  readonly min: number; // inclusive
  readonly severity: InterpretationSeverity;
}

/**
 * Default thresholds (used when no exposure-specific override applies).
 *
 *  ≥ 80 reassuring
 *  ≥ 65 workable
 *  ≥ 50 concerning
 *  ≥ 35 fragile
 *  <  35 critical
 */
const DEFAULT_BANDS: ReadonlyArray<BandThreshold> = [
  { min: 80, severity: 'reassuring' },
  { min: 65, severity: 'workable' },
  { min: 50, severity: 'concerning' },
  { min: 35, severity: 'fragile' },
  { min: 0, severity: 'critical' },
];

/**
 * Mission-critical exposure raises the bar: the same composite reads as more
 * concerning because the stakes of continuity failure are higher.
 *
 *  ≥ 85 reassuring
 *  ≥ 72 workable
 *  ≥ 58 concerning
 *  ≥ 42 fragile
 *  <  42 critical
 */
const MISSION_CRITICAL_BANDS: ReadonlyArray<BandThreshold> = [
  { min: 85, severity: 'reassuring' },
  { min: 72, severity: 'workable' },
  { min: 58, severity: 'concerning' },
  { min: 42, severity: 'fragile' },
  { min: 0, severity: 'critical' },
];

/**
 * Public-trust exposure is between default and mission-critical.
 */
const PUBLIC_TRUST_BANDS: ReadonlyArray<BandThreshold> = [
  { min: 82, severity: 'reassuring' },
  { min: 68, severity: 'workable' },
  { min: 54, severity: 'concerning' },
  { min: 38, severity: 'fragile' },
  { min: 0, severity: 'critical' },
];

function pickBands(
  profile: InstitutionalAssessmentProfile,
): { bands: ReadonlyArray<BandThreshold>; ruleId: string } {
  if (profile.continuityExposure === 'mission_critical') {
    return { bands: MISSION_CRITICAL_BANDS, ruleId: 'normalizer.bands.mission_critical' };
  }
  if (profile.continuityExposure === 'public_trust') {
    return { bands: PUBLIC_TRUST_BANDS, ruleId: 'normalizer.bands.public_trust' };
  }
  return { bands: DEFAULT_BANDS, ruleId: 'normalizer.bands.default' };
}

function statementFor(
  severity: InterpretationSeverity,
  profile: InstitutionalAssessmentProfile,
): string {
  const scaleQualifier = (() => {
    switch (profile.institutionalScale) {
      case 'micro':
        return 'For an institution of this size';
      case 'small':
        return 'For a small institution';
      case 'mid_sized':
        return 'For a mid-sized institution';
      case 'large':
        return 'For an institution of this scale';
      case 'enterprise':
        return 'For an enterprise-scale institution';
      case 'federated_complex':
        return 'For a federated institution';
    }
  })();

  const severityPhrase = (() => {
    switch (severity) {
      case 'reassuring':
        return 'continuity posture is structurally reassuring';
      case 'workable':
        return 'continuity posture is workable, with specific risks worth addressing';
      case 'concerning':
        return 'continuity posture is concerning and warrants structured attention';
      case 'fragile':
        return 'continuity posture is fragile and needs deliberate strengthening';
      case 'critical':
        return 'continuity posture is critical and requires immediate stewardship attention';
    }
  })();

  return `${scaleQualifier}, ${severityPhrase}.`;
}

/**
 * Compute the profile-aware interpretation of a raw composite (0..100).
 * Never alters the composite — only labels it.
 */
export function normalizeContextualScore(
  rawComposite: number,
  profile: InstitutionalAssessmentProfile,
): NormalizedInterpretation {
  const safeComposite = Math.max(0, Math.min(100, rawComposite));
  const { bands, ruleId } = pickBands(profile);
  const severity =
    bands.find((b) => safeComposite >= b.min)?.severity ?? 'critical';
  return Object.freeze({
    rawComposite: safeComposite,
    severity,
    statement: statementFor(severity, profile),
    ruleId,
  });
}
