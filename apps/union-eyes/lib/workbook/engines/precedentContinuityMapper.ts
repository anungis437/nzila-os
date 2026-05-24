/**
 * ARTIFACT TYPE: Engine Helper
 * MODULE: Governance Lineage
 * DOCTRINE_VERSION: 2.0.0
 *
 * Precedent Continuity Mapper — turns a workbook's named governance
 * precedents (decisions, motions, resolutions, working agreements) into
 * a longitudinal map of how organizational reasoning has carried forward.
 *
 * Pure, deterministic. Anti-surveillance: precedents are described by
 * abstract id, era, and structural posture — never by author names or
 * verbatim text.
 */

export type PrecedentEra =
  | 'recent'
  | 'mid_term'
  | 'long_term'
  | 'founding';

export type LineageContinuity =
  | 'living'
  | 'observed'
  | 'fading'
  | 'lapsed';

export interface PrecedentInput {
  /** Stable abstract id; never the precedent's text. */
  readonly id: string;
  /** Abstract subject label, e.g. "Compensation review cadence". */
  readonly subject: string;
  readonly era: PrecedentEra;
  /** Number of governance bodies that have re-affirmed this precedent. */
  readonly reaffirmationCount: number;
  /** True if the precedent is referenced in current operational practice. */
  readonly referencedInPractice: boolean;
  /** True if successor governance carriers have been briefed on this precedent. */
  readonly successorBriefed: boolean;
}

export interface PrecedentMapping {
  readonly id: string;
  readonly subject: string;
  readonly era: PrecedentEra;
  readonly continuity: LineageContinuity;
  readonly posture: string;
}

const ERA_AGE: Record<PrecedentEra, number> = {
  recent: 1,
  mid_term: 2,
  long_term: 3,
  founding: 4,
};

export function mapPrecedentContinuity(
  precedents: readonly PrecedentInput[],
): readonly PrecedentMapping[] {
  return precedents.map((p) => {
    const continuity = classifyContinuity(p);
    return {
      id: p.id,
      subject: p.subject,
      era: p.era,
      continuity,
      posture: posturalStatement(continuity, p.era),
    };
  });
}

function classifyContinuity(p: PrecedentInput): LineageContinuity {
  if (p.referencedInPractice && p.successorBriefed && p.reaffirmationCount >= 2) {
    return 'living';
  }
  if (p.referencedInPractice) return 'observed';
  if (p.successorBriefed || p.reaffirmationCount >= 1) return 'fading';
  return 'lapsed';
}

function posturalStatement(continuity: LineageContinuity, era: PrecedentEra): string {
  switch (continuity) {
    case 'living':
      return 'Precedent is referenced in practice, reaffirmed across bodies, and known to successor stewards.';
    case 'observed':
      return 'Precedent is referenced in practice but successor continuity has not been confirmed.';
    case 'fading':
      return ERA_AGE[era] >= 3
        ? 'Founding-era precedent is no longer routinely referenced in practice; lineage capture is the next step.'
        : 'Precedent is partially carried; successor briefing and re-affirmation are appropriate.';
    case 'lapsed':
      return 'Precedent is no longer carried in practice. Reconstruction would require external interpretation.';
  }
}

export function aggregateLineageHealth(
  mappings: readonly PrecedentMapping[],
): {
  readonly total: number;
  readonly living: number;
  readonly observed: number;
  readonly fading: number;
  readonly lapsed: number;
  readonly livingShare: number;
} {
  const total = mappings.length;
  let living = 0;
  let observed = 0;
  let fading = 0;
  let lapsed = 0;
  for (const m of mappings) {
    if (m.continuity === 'living') living += 1;
    else if (m.continuity === 'observed') observed += 1;
    else if (m.continuity === 'fading') fading += 1;
    else lapsed += 1;
  }
  return {
    total,
    living,
    observed,
    fading,
    lapsed,
    livingShare: total === 0 ? 0 : Math.round((living / total) * 100) / 100,
  };
}
