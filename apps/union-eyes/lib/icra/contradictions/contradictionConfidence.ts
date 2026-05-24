/**
 * Contradiction Confidence — derives the contradictionConfidence value
 * emitted alongside detection outcomes.
 *
 * `contradictionConfidence` answers: how confident are we that the
 * contradiction is real (vs an artifact of ambiguous responses)?
 *
 * Inputs:
 *   - both signals affirmed the contradictory pattern
 *   - the signals were answered with positive certainty (not "unsure")
 *
 * Output: 0..1.
 */

export interface ContradictionConfidenceInputs {
  signalAAffirmed: boolean;
  signalBAffirmed: boolean;
  /** Did the respondent flag uncertainty on signal A (e.g., confidence_marker uncertainty path)? */
  signalAUncertain?: boolean;
  signalBUncertain?: boolean;
}

export function deriveContradictionConfidence(
  inputs: ContradictionConfidenceInputs,
): number {
  const { signalAAffirmed, signalBAffirmed, signalAUncertain, signalBUncertain } =
    inputs;
  if (!signalAAffirmed || !signalBAffirmed) return 0;
  let confidence = 1.0;
  if (signalAUncertain) confidence -= 0.35;
  if (signalBUncertain) confidence -= 0.35;
  return Math.max(0, Math.min(1, confidence));
}
