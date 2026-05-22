/**
 * ARTIFACT TYPE: OCRA → Workbook Handoff Adapter (Product 2)
 * MODULE: workbook/adapters/ocraAdaptiveHandoff
 * DOCTRINE: OCI_ADAPTIVE_ASSESSMENT_DOCTRINE.md §7 (downstream PII boundary)
 *
 * Projects a `ContextualAssessmentResult` into the minimal payload the
 * workbook product (Product 2) needs to localize its intake flow.
 *
 * Hard boundary: this adapter must NEVER emit free text, identifiers, names,
 * geographic detail finer than declared enums, or behavioural signals. The
 * payload is composed exclusively of low-cardinality enum tokens, a small
 * set of severity labels, and rule ids.
 */

import type { ContextualAssessmentResult } from '@/lib/icra/adaptation';

export const WORKBOOK_HANDOFF_VERSION = '1.0.0' as const;
export type WorkbookHandoffVersion = typeof WORKBOOK_HANDOFF_VERSION;

export interface WorkbookAdaptiveHandoff {
  readonly handoffVersion: WorkbookHandoffVersion;
  readonly doctrineVersion: '1.0.0';
  readonly profileBand: {
    readonly institutionalScale: string;
    readonly continuityComplexity: string;
    readonly governanceComplexity: string;
    readonly continuityExposure: string;
  };
  readonly severity: string;
  readonly emphasisOrder: readonly string[];
  readonly suggestedWorkbookSections: readonly string[];
}

/**
 * Map emphasized dimensions to workbook section ids. Static, deterministic.
 * If a dimension is not in this map, it is omitted (callers receive a stable
 * but possibly shorter list).
 */
const DIMENSION_TO_SECTIONS: Record<string, readonly string[]> = {
  trust_debt: ['stewardship', 'transition_communication'],
  institutional_continuity: ['continuity_plan', 'succession'],
  governance_fragility: ['governance_review', 'committee_alignment'],
  operational_memory: ['memory_capture', 'documentation_baseline'],
  transition_readiness: ['transition_readiness', 'handover_kit'],
};

/**
 * Build the workbook handoff. Pure, deterministic, frozen.
 */
export function buildWorkbookAdaptiveHandoff(
  result: ContextualAssessmentResult,
): WorkbookAdaptiveHandoff {
  const profile = result.institutionalProfile;
  const emphasisOrder = [...result.contextualEmphasis]
    .sort((a, b) => b.weight - a.weight)
    .map((e) => e.dimension);

  const seen = new Set<string>();
  const sections: string[] = [];
  for (const dim of emphasisOrder) {
    const candidates = DIMENSION_TO_SECTIONS[dim] ?? [];
    for (const s of candidates) {
      if (!seen.has(s)) {
        seen.add(s);
        sections.push(s);
      }
    }
  }

  return Object.freeze({
    handoffVersion: WORKBOOK_HANDOFF_VERSION,
    doctrineVersion: '1.0.0' as const,
    profileBand: Object.freeze({
      institutionalScale: profile.institutionalScale,
      continuityComplexity: profile.continuityComplexity,
      governanceComplexity: profile.governanceComplexity,
      continuityExposure: profile.continuityExposure,
    }),
    severity: result.normalizedInterpretation.severity,
    emphasisOrder: Object.freeze(emphasisOrder),
    suggestedWorkbookSections: Object.freeze(sections),
  });
}
