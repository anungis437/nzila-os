/**
 * ARTIFACT TYPE: IP / Framework
 * PACKAGE: @nzila/oci-confidence
 * MODULE: stability-engine
 * DOCTRINE_VERSION: 1.0.0
 *
 * Longitudinal stability classification. Composes six explicit
 * volatility signals into a single stability state with explanatory
 * indicators. Pure, deterministic. No I/O.
 *
 * Honest posture: stability is a CATEGORICAL state; the stabilityScore
 * is a structural summary, not a probability.
 */

import type {
  StabilityInputs,
  StabilityResult,
  StabilityState,
  ConfidenceState,
} from './confidenceContracts';

const SIGNAL_WEIGHTS = Object.freeze({
  modernizationVolatility: 0.2,
  governanceVolatility: 0.2,
  onboardingInstability: 0.15,
  stewardshipTurnover: 0.2,
  continuityVariance: 0.15,
  transitionTurbulence: 0.1,
});

const STATE_THRESHOLDS = Object.freeze({
  volatile: 0.6,
  transitional: 0.3,
});

function clamp01(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function describe(label: string, value: number): string | null {
  if (value >= 0.6) return `${label} elevated`;
  if (value >= 0.3) return `${label} moderate`;
  return null;
}

export function classifyStability(inputs: StabilityInputs = {}): StabilityResult {
  const m = clamp01(inputs.modernizationVolatility);
  const g = clamp01(inputs.governanceVolatility);
  const o = clamp01(inputs.onboardingInstability);
  const s = clamp01(inputs.stewardshipTurnover);
  const c = clamp01(inputs.continuityVariance);
  const t = clamp01(inputs.transitionTurbulence);

  const provided =
    inputs.modernizationVolatility != null ||
    inputs.governanceVolatility != null ||
    inputs.onboardingInstability != null ||
    inputs.stewardshipTurnover != null ||
    inputs.continuityVariance != null ||
    inputs.transitionTurbulence != null;

  const stabilityScore = Number(
    (
      m * SIGNAL_WEIGHTS.modernizationVolatility +
      g * SIGNAL_WEIGHTS.governanceVolatility +
      o * SIGNAL_WEIGHTS.onboardingInstability +
      s * SIGNAL_WEIGHTS.stewardshipTurnover +
      c * SIGNAL_WEIGHTS.continuityVariance +
      t * SIGNAL_WEIGHTS.transitionTurbulence
    ).toFixed(2),
  );

  let state: StabilityState;
  if (!provided) state = 'UNKNOWN';
  else if (stabilityScore >= STATE_THRESHOLDS.volatile) state = 'VOLATILE';
  else if (stabilityScore >= STATE_THRESHOLDS.transitional) state = 'TRANSITIONAL';
  else state = 'STABLE';

  const varianceIndicators = [
    describe('continuity variance', c),
    describe('reviewer-observed transition turbulence', t),
  ].filter((x): x is string => x !== null);

  const volatilitySignals = [
    describe('modernization volatility', m),
    describe('governance volatility', g),
    describe('onboarding instability', o),
    describe('stewardship turnover', s),
  ].filter((x): x is string => x !== null);

  const temporalConfidence: ConfidenceState =
    state === 'STABLE'
      ? 'HIGH'
      : state === 'TRANSITIONAL'
        ? 'MODERATE'
        : state === 'VOLATILE'
          ? 'LOW'
          : 'INSUFFICIENT';

  return Object.freeze({
    stabilityScore,
    state,
    varianceIndicators: Object.freeze(varianceIndicators),
    volatilitySignals: Object.freeze(volatilitySignals),
    temporalConfidence,
  });
}

export const STABILITY_WEIGHTS = SIGNAL_WEIGHTS;
export const STABILITY_THRESHOLDS = STATE_THRESHOLDS;
