/**
 * ARTIFACT TYPE: Government-Readiness Additive Layer — Source Instrument Mapping
 * MODULE: OCI/OCRA Obligation class → Source Instrument citations (Phase G)
 * DOCTRINE: docs/oci/superseded/government-readiness/OCI_OCRA_SOURCE_INSTRUMENT_TRACEABILITY.md
 * DOCTRINE_VERSION: 1.0.0
 *
 * Pure, deterministic mapping from a finding's admissible obligation classes +
 * evidence level to the candidate source-instrument citations.
 *
 * CONSTITUTIONAL CONSTRAINT: this module MUST NOT import the scoring engine.
 * Source-instrument mapping is reporting context only and can never influence a
 * score. (Enforced by source-instrument-traceability.test.ts.)
 */

import type { EvidenceLevel } from '../evidence-strength/evidenceTaxonomy';
import { OBLIGATION_CLASSES, type ObligationClassId } from './obligationTaxonomy';
import {
  buildCitation,
  SOURCE_INSTRUMENTS,
  type Citation,
} from './sourceInstruments';

/**
 * Candidate source instruments per obligation class. Each class points at the
 * UNVERIFIED instruments that may create its duty. Multiple classes may share an
 * instrument; that is expected (one policy can ground several obligations).
 */
export const OBLIGATION_INSTRUMENT_RULES: Record<ObligationClassId, readonly string[]> =
  Object.freeze({
    statutory: ['si.enabling_statute'],
    regulatory: ['si.delegated_regulation'],
    policy: ['si.tb_policy_service_digital'],
    governance: ['si.governance_bylaws'],
    fiduciary: ['si.fiduciary_duty_framework'],
    continuity: ['si.iso_22301_continuity'],
    operational: ['si.records_retention_schedule'],
  });

/**
 * Map a single obligation class + evidence level to its candidate citations.
 * `withheld` citations (no admissible evidence) are omitted from the result.
 */
export function citationsForObligation(
  classId: ObligationClassId,
  evidenceLevel: EvidenceLevel,
): readonly Citation[] {
  const instrumentIds = OBLIGATION_INSTRUMENT_RULES[classId] ?? [];
  const citations: Citation[] = [];
  for (const instrumentId of instrumentIds) {
    const instrument = SOURCE_INSTRUMENTS[instrumentId];
    if (!instrument) continue;
    const citation = buildCitation(instrument, evidenceLevel);
    if (citation.assertion !== 'withheld') citations.push(citation);
  }
  return Object.freeze(citations);
}

/**
 * Map a finding's admissible obligation classes + evidence level to the full,
 * ordered set of candidate citations. Deterministic: ordered by the obligation
 * class tier (highest accountability gravity first), then by instrument id.
 *
 * Returns an empty array for unknown classes or NONE evidence — never invents a
 * citation, never asserts a source it cannot gate.
 */
export function mapObligationsToCitations(
  obligationClasses: readonly ObligationClassId[],
  evidenceLevel: EvidenceLevel,
): readonly Citation[] {
  const ordered = [...obligationClasses].sort(
    (a, b) => OBLIGATION_CLASSES[a].tier - OBLIGATION_CLASSES[b].tier,
  );

  const citations: Citation[] = [];
  for (const classId of ordered) {
    for (const citation of citationsForObligation(classId, evidenceLevel)) {
      citations.push(citation);
    }
  }

  return Object.freeze(
    citations.sort((a, b) => {
      const tierDelta =
        OBLIGATION_CLASSES[a.obligationClass].tier -
        OBLIGATION_CLASSES[b.obligationClass].tier;
      if (tierDelta !== 0) return tierDelta;
      return a.instrumentId.localeCompare(b.instrumentId);
    }),
  );
}
