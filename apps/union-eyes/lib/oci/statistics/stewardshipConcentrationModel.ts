/**
 * ARTIFACT TYPE: IP / Framework
 * MODULE: lib/oci/statistics/stewardshipConcentrationModel
 * DOCTRINE_VERSION: 1.0.0
 *
 * Composes HHI + Gini + a calm interpretive narrative for stewardship
 * concentration analysis. The narrative is OCI-anchored: it interprets
 * the statistical reading through continuity language and refuses to
 * rank institutions.
 *
 * Hard doctrine:
 *   - HHI/Gini CONTEXTUALIZE OCI; they do NOT replace OCI interpretation.
 *   - No false precision: outputs include caution states from the
 *     Universal Confidence Model.
 */

import type { ConcentrationInput, StewardshipConcentration } from './statisticalAnchorContracts';
import { calculateHHI } from './calculateHHI';
import { calculateGini } from './calculateGini';

function narrate(hhi: ReturnType<typeof calculateHHI>, gini: ReturnType<typeof calculateGini>): string {
  const parts: string[] = [];

  switch (hhi.band) {
    case 'HIGHLY_CONCENTRATED':
      parts.push(
        'HHI indicates highly concentrated stewardship; OCI interprets this concentration as continuity fragility because institution-critical governance domains lack documented successor pathways.',
      );
      break;
    case 'CONCENTRATED':
      parts.push(
        'HHI indicates elevated stewardship concentration; OCI interprets this as a continuity risk surface where successor pathways need to be confirmed.',
      );
      break;
    case 'MODERATE':
      parts.push(
        'HHI indicates moderate concentration; OCI reads this as a continuity readiness gap rather than a failure.',
      );
      break;
    case 'DISTRIBUTED':
      parts.push('HHI indicates distributed stewardship; OCI reads this as a continuity-favourable structure.');
      break;
  }

  switch (gini.band) {
    case 'EXTREME':
      parts.push(
        'Gini indicates extreme stewardship inequality; OCI reads this as continuity-burden asymmetry warranting reviewer follow-up.',
      );
      break;
    case 'INEQUITABLE':
      parts.push('Gini indicates inequitable stewardship distribution; reviewer-led interpretation is required.');
      break;
    case 'UNEVEN':
      parts.push('Gini indicates uneven stewardship distribution; treat as context, not as a verdict.');
      break;
    case 'EVEN':
      parts.push('Gini indicates even stewardship distribution; statistical context is calm.');
      break;
  }

  if (hhi.cautionStates.length > 0 || gini.cautionStates.length > 0) {
    parts.push(
      'These statistical readings inherit the confidence cautions of their underlying sample and must be interpreted as context, not as institutional ranking.',
    );
  }

  return parts.join(' ');
}

export function analyseStewardshipConcentration(
  inputs: ReadonlyArray<ConcentrationInput>,
): StewardshipConcentration {
  const hhi = calculateHHI(inputs);
  const gini = calculateGini(inputs);
  return Object.freeze({ hhi, gini, narrative: narrate(hhi, gini) });
}
