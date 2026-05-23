/**
 * ARTIFACT TYPE: Trajectory Narrative
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Organizational trajectory narrative.
 *
 * Composes a reviewer-readable narrative describing the longitudinal reading
 * for a single institution. The narrative is intentionally measured: it
 * reflects what the readings show, names what is not yet readable, and never
 * presents a forecast.
 *
 * Tone discipline (enforced by tests):
 *   - No optimisation, productivity, autonomous, AI-led, frictionless,
 *     seamless, automation, scoring, behavioural-analytics language.
 *   - No blame phrasing ("why do you ...").
 *   - Reviewer-led: the narrative concludes by inviting reviewer interpretation,
 *     not by issuing a recommendation.
 */

import type { LongitudinalReading } from '../longitudinal/longitudinalContinuityEngine';

export const INSTITUTIONAL_TRAJECTORY_NARRATIVE_VERSION = '1.0.0' as const;

export interface TrajectoryNarrative {
  readonly institutionRefHash: string;
  readonly paragraphs: ReadonlyArray<string>;
  readonly readableForExecutive: boolean;
}

function bandPhrase(band: string): string {
  switch (band) {
    case 'not_yet_readable':
      return 'is not yet readable from the readings on hand';
    case 'holding':
      return 'is holding across the readable window';
    case 'stabilizing':
      return 'is stabilizing across the readable window';
    case 'regressing':
      return 'is regressing across the readable window';
    case 'strengthening':
      return 'is strengthening across the readable window';
    case 'weakening':
      return 'is weakening across the readable window';
    case 'redistributing':
      return 'is redistributing across the readable window';
    case 'reconcentrating':
      return 'is reconcentrating across the readable window';
    case 'reducing':
      return 'is reducing across the readable window';
    case 'accumulating':
      return 'is accumulating across the readable window';
    case 'persisting':
      return 'is persisting across the readable window';
    case 'eroding':
      return 'is eroding across the readable window';
    default:
      return `is reading as ${band}`;
  }
}

export function composeInstitutionalTrajectoryNarrative(
  reading: LongitudinalReading,
): TrajectoryNarrative {
  const paragraphs: string[] = [];

  paragraphs.push(
    'This narrative reflects what the longitudinal readings show. It is not a forecast and it does not rank the institution against any other reading.',
  );

  paragraphs.push(
    `Continuity maturity ${bandPhrase(reading.maturityEvolution)}. The reading carries only what reviewers have themselves recorded; nothing here is inferred.`,
  );

  paragraphs.push(
    `Governance entropy ${bandPhrase(reading.governanceDrift)}. Reviewers should read this alongside the institution's own governance ratification record before drawing conclusions.`,
  );

  paragraphs.push(
    `Stewardship continuity ${bandPhrase(reading.stewardshipEvolution)}. Redistribution durability is a reviewer-led reading; the trajectory below is supportive context, not a verdict.`,
  );

  paragraphs.push(
    `Onboarding survivability ${bandPhrase(reading.onboardingSurvivability)}. This reading describes whether new participants can carry organizational continuity, not whether they perform efficiently.`,
  );

  paragraphs.push(
    `Continuity debt ${bandPhrase(reading.continuityDebtTrend)}. Where the trend is accumulating, the appropriate response is reviewer-led pacing, not acceleration.`,
  );

  paragraphs.push(
    `Runtime stabilisation continuity ${bandPhrase(reading.runtimeStabilizationPersistence)}, and modernization survivability ${bandPhrase(reading.modernizationSurvivability)}. Read these together to understand whether modernization is preserving organizational continuity or quietly displacing it.`,
  );

  paragraphs.push(
    `Organizational resilience reads as ${reading.resilienceTrajectory.band}, based on ${reading.resilienceTrajectory.basedOn} readable trajectory points. Where the reading is not yet readable, the appropriate response is to gather further readings — not to substitute inference.`,
  );

  paragraphs.push(
    'Reviewers are invited to interpret these readings inside the institution\'s own governance context. The intelligence layer does not, and will not, conclude on the institution\'s behalf.',
  );

  const readableForExecutive =
    reading.resilienceTrajectory.band !== 'not_yet_readable' ||
    reading.maturityEvolution !== 'not_yet_readable';

  return {
    institutionRefHash: reading.institutionRefHash,
    paragraphs,
    readableForExecutive,
  };
}
