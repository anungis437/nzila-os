/**
 * Contradiction Detection Engine — evaluates a set of pair responses
 * against the contradiction registry and emits a structured detection
 * report consumed by the confidence engine and the narrative engine.
 *
 * Doctrine guarantees:
 *   - emits structured outcomes, never inferred psychological states
 *   - never names individuals
 *   - contradictions reduce confidence (penalty composition is
 *     deterministic — see contradictionSeverityModel.ts)
 *   - returns explicit `resolutionRequired` per detected pair
 */
import {
  CONTRADICTION_PAIRS,
  type ContradictionPairDefinition,
} from './contradictionSignalPairs';
import {
  composeContradictionPenalties,
  type ContradictionSeverity,
} from './contradictionSeverityModel';
import { deriveContradictionConfidence } from './contradictionConfidence';

/** Response wrapper from a contradiction_pair question. */
export interface PairResponse {
  pairId: string;
  signalAAffirmed: boolean;
  signalBAffirmed: boolean;
  signalAUncertain?: boolean;
  signalBUncertain?: boolean;
}

export interface ContradictionOutcome {
  pairId: string;
  name: string;
  description: string;
  contradictionDetected: boolean;
  contradictionSeverity: ContradictionSeverity | null;
  contradictionConfidence: number; // 0..1
  resolutionRequired:
    | 'facilitation'
    | 'evidence_review'
    | 'reviewer_escalation'
    | null;
  reducesConfidenceIn: ReadonlyArray<string>;
}

export interface ContradictionReport {
  outcomes: ReadonlyArray<ContradictionOutcome>;
  /** Aggregate confidence penalty in 0..1 to apply to the overall envelope. */
  aggregateConfidencePenalty: number;
  /** Per-dimension penalty pre-aggregated for confidence-engine consumption. */
  perDimensionConfidencePenalty: Record<string, number>;
}

/**
 * Evaluate a contradiction pair: the two signals are considered to
 * "contradict" when *both* are affirmed *and* the pair's definition
 * treats joint affirmation as the contradictory pattern (which all
 * v1.2.0-foundation pairs do — see contradictionSignalPairs.ts).
 */
function evaluatePair(
  pair: ContradictionPairDefinition,
  response: PairResponse,
): ContradictionOutcome {
  const detected = response.signalAAffirmed && response.signalBAffirmed;
  if (!detected) {
    return {
      pairId: pair.pairId,
      name: pair.name,
      description: pair.description,
      contradictionDetected: false,
      contradictionSeverity: null,
      contradictionConfidence: 0,
      resolutionRequired: null,
      reducesConfidenceIn: pair.reducesConfidenceIn,
    };
  }
  return {
    pairId: pair.pairId,
    name: pair.name,
    description: pair.description,
    contradictionDetected: true,
    contradictionSeverity: pair.severity,
    contradictionConfidence: deriveContradictionConfidence({
      signalAAffirmed: response.signalAAffirmed,
      signalBAffirmed: response.signalBAffirmed,
      signalAUncertain: response.signalAUncertain,
      signalBUncertain: response.signalBUncertain,
    }),
    resolutionRequired: pair.resolutionRequired,
    reducesConfidenceIn: pair.reducesConfidenceIn,
  };
}

export function detectContradictions(
  responses: ReadonlyArray<PairResponse>,
  pairs: ReadonlyArray<ContradictionPairDefinition> = CONTRADICTION_PAIRS,
): ContradictionReport {
  const outcomes: ContradictionOutcome[] = [];
  const fireSeverities: ContradictionSeverity[] = [];
  const perDimension: Record<string, number> = {};

  for (const pair of pairs) {
    const response = responses.find((r) => r.pairId === pair.pairId);
    if (!response) continue;
    const outcome = evaluatePair(pair, response);
    outcomes.push(outcome);
    if (outcome.contradictionDetected && outcome.contradictionSeverity) {
      fireSeverities.push(outcome.contradictionSeverity);
      // Weight per-dimension penalty by detection confidence so uncertain
      // contradictions impose proportionally less drag.
      const perPairAggregate = composeContradictionPenalties([
        outcome.contradictionSeverity,
      ]) * outcome.contradictionConfidence;
      for (const dim of outcome.reducesConfidenceIn) {
        perDimension[dim] = Math.min(0.7, (perDimension[dim] ?? 0) + perPairAggregate);
      }
    }
  }

  return {
    outcomes,
    aggregateConfidencePenalty: composeContradictionPenalties(fireSeverities),
    perDimensionConfidencePenalty: perDimension,
  };
}
