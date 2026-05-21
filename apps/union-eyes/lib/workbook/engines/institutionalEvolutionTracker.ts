/**
 * ARTIFACT TYPE: Engine Helper
 * MODULE: Governance Lineage
 * DOCTRINE_VERSION: 2.0.0
 *
 * Institutional Evolution Tracker — composes precedent continuity and
 * interpretation drift into a longitudinal arc of how institutional
 * governance has evolved across eras.
 *
 * Pure, deterministic.
 */

import type { PrecedentMapping, PrecedentEra } from './precedentContinuityMapper';
import type { InterpretationCell } from './governanceInterpretationMatrix';

export type EvolutionPosture =
  | 'continuous'
  | 'evolved'
  | 'reinterpreted'
  | 'fractured';

export interface EvolutionEraSummary {
  readonly era: PrecedentEra;
  readonly precedentsCarried: number;
  readonly precedentsLapsed: number;
  readonly continuityRate: number;
}

export interface InstitutionalEvolutionResult {
  readonly posture: EvolutionPosture;
  readonly continuityRate: number;
  readonly interpretationDrift: number;
  readonly eras: readonly EvolutionEraSummary[];
  readonly reading: string;
}

const ERA_ORDER: readonly PrecedentEra[] = ['founding', 'long_term', 'mid_term', 'recent'];

export function trackInstitutionalEvolution(
  precedents: readonly PrecedentMapping[],
  interpretation: readonly InterpretationCell[],
): InstitutionalEvolutionResult {
  const byEra = new Map<PrecedentEra, { carried: number; lapsed: number }>();
  for (const era of ERA_ORDER) byEra.set(era, { carried: 0, lapsed: 0 });

  for (const p of precedents) {
    const bucket = byEra.get(p.era);
    if (!bucket) continue;
    if (p.continuity === 'lapsed') bucket.lapsed += 1;
    else bucket.carried += 1;
  }

  const eras: EvolutionEraSummary[] = ERA_ORDER.map((era) => {
    const bucket = byEra.get(era) ?? { carried: 0, lapsed: 0 };
    const total = bucket.carried + bucket.lapsed;
    return {
      era,
      precedentsCarried: bucket.carried,
      precedentsLapsed: bucket.lapsed,
      continuityRate: total === 0 ? 0 : round2(bucket.carried / total),
    };
  });

  const totalPrecedents = precedents.length;
  const carriedPrecedents = precedents.filter((p) => p.continuity !== 'lapsed').length;
  const continuityRate = totalPrecedents === 0 ? 0 : round2(carriedPrecedents / totalPrecedents);

  const interpretationDrift =
    interpretation.length === 0
      ? 0
      : round2(
          interpretation.reduce((a, c) => a + c.drift, 0) / interpretation.length,
        );

  const posture = classifyEvolution(continuityRate, interpretationDrift);

  return {
    posture,
    continuityRate,
    interpretationDrift,
    eras,
    reading: posturalReading(posture, continuityRate, interpretationDrift),
  };
}

function classifyEvolution(
  continuityRate: number,
  drift: number,
): EvolutionPosture {
  if (continuityRate >= 0.75 && drift <= 0.25) return 'continuous';
  if (continuityRate >= 0.5 && drift <= 0.5) return 'evolved';
  if (continuityRate >= 0.3 || drift <= 0.7) return 'reinterpreted';
  return 'fractured';
}

function posturalReading(
  posture: EvolutionPosture,
  continuityRate: number,
  drift: number,
): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  switch (posture) {
    case 'continuous':
      return `Institutional lineage is broadly continuous (${pct(continuityRate)} of precedents carried, ${pct(drift)} interpretation drift).`;
    case 'evolved':
      return `Institutional lineage has evolved while retaining most precedents (${pct(continuityRate)} carried, ${pct(drift)} interpretation drift).`;
    case 'reinterpreted':
      return `Institutional lineage has been substantially reinterpreted (${pct(continuityRate)} carried, ${pct(drift)} interpretation drift).`;
    case 'fractured':
      return `Institutional lineage shows fracture (${pct(continuityRate)} carried, ${pct(drift)} interpretation drift); reconstruction would require external interpretation.`;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
