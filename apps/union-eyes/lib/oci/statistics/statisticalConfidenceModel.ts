/**
 * ARTIFACT TYPE: IP / Module
 * MODULE: lib/oci/statistics/statisticalConfidenceModel
 * DOCTRINE_VERSION: 1.0.0
 *
 * Confidence-aware wrapper for HHI/Gini outputs. Composes the underlying
 * statistical population with the Universal Confidence Model so that
 * small populations or incomplete inputs degrade the statistical
 * reading rather than silently producing precise-looking numbers.
 */

import { buildConfidenceEnvelope } from '@nzila/oci-confidence';
import type { ConfidenceEnvelope, ConfidenceInputs } from '@nzila/oci-confidence';
import type { HHIResult, GiniResult } from './statisticalAnchorContracts';

export function enveloperHHI(
  result: HHIResult,
  contextual: ConfidenceInputs = {},
): ConfidenceEnvelope<HHIResult> {
  return buildConfidenceEnvelope(result, {
    sampleSize: result.population,
    dataCompleteness: 1,
    ...contextual,
  });
}

export function enveloperGini(
  result: GiniResult,
  contextual: ConfidenceInputs = {},
): ConfidenceEnvelope<GiniResult> {
  return buildConfidenceEnvelope(result, {
    sampleSize: result.population,
    dataCompleteness: 1,
    ...contextual,
  });
}
