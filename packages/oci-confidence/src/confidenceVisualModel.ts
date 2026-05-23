/**
 * ARTIFACT TYPE: IP / Module
 * PACKAGE: @nzila/oci-confidence
 * MODULE: confidenceVisualModel
 * DOCTRINE_VERSION: 1.0.0
 *
 * Produces calm, procurement-safe visualisation hints for a confidence
 * envelope. The visual model does not introduce metaphors that the
 * envelope itself does not warrant. Visual outputs are advisory; the
 * envelope is authoritative.
 */

import type {
  ConfidenceEnvelope,
  ConfidenceVisualModel,
  CautionState,
} from './confidenceContracts';
import { postureFor } from './interpretive-cautions';

const BADGE_LABEL: Record<CautionState, string> = {
  SMALL_SAMPLE: 'Small sample',
  INCOMPLETE_VISIBILITY: 'Incomplete visibility',
  HIGH_VARIANCE: 'Reviewer variance',
  TRANSITIONAL_INSTABILITY: 'Transitional',
  OUTDATED_ASSESSMENT: 'Refresh recommended',
  LIMITED_GOVERNANCE_EVIDENCE: 'Limited evidence',
};

export function toVisualModel<T>(envelope: ConfidenceEnvelope<T>): ConfidenceVisualModel {
  const ribbon =
    envelope.confidence === 'HIGH'
      ? 'green'
      : envelope.confidence === 'MODERATE'
        ? 'amber'
        : envelope.confidence === 'LOW'
          ? 'slate'
          : 'grey';

  const badges = envelope.cautionStates.map((c) => ({
    label: BADGE_LABEL[c],
    tone: 'caution' as const,
  }));

  const completenessPercent = Math.round(envelope.dataCompleteness * 100);
  const completenessLabel = `Data completeness: ${completenessPercent}%`;

  const summaryParts: string[] = [];
  summaryParts.push(
    `Confidence: ${envelope.confidence.toLowerCase()} (sample ${envelope.sampleSize}).`,
  );
  if (envelope.cautionStates.length > 0) {
    summaryParts.push(postureFor(envelope.cautionStates[0]));
  }

  return Object.freeze({
    ribbon,
    badges: Object.freeze(badges),
    completenessLabel,
    interpretiveSummary: summaryParts.join(' '),
  });
}
