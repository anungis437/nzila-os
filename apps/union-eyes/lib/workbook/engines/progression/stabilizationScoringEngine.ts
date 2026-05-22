/**
 * ARTIFACT TYPE: Engine
 * MODULE: OCI Stabilization Progression
 * DOCTRINE_VERSION: 2.0.0
 *
 * Stabilization progression reader. Categorical only — never emits a
 * numeric score in the user-facing surface. The filename retains the
 * word "scoring" purely as an internal locator; all outputs are bands.
 *
 * Reads three convergent inputs:
 *   - intervention ledger counts (ratified vs reversed)
 *   - state-engine signal direction (advancing / regressing / holding)
 *   - evolution tracker posture
 *
 * Pure, deterministic.
 */

export const ENGINE_VERSION = '2.0.0';

export type ProgressionBand =
  | 'not_yet_readable'
  | 'holding'
  | 'advancing'
  | 'regressing';

export type ProgressionSource =
  | 'intervention_ledger'
  | 'state_engine'
  | 'evolution_tracker';

export interface ProgressionInput {
  readonly interventions: {
    readonly irreversiblyRatifiedCount: number;
    readonly regressedCount: number;
    readonly withdrawnCount: number;
    readonly activeCount: number;
  };
  readonly stateEngine: {
    /** Direction read from recent transitions. */
    readonly direction: 'advancing' | 'holding' | 'regressing' | 'unknown';
  };
  readonly evolution: {
    readonly posture: 'continuous' | 'evolved' | 'reinterpreted' | 'fractured' | 'unknown';
  };
}

export interface ProgressionReading {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly band: ProgressionBand;
  readonly contributingSources: readonly ProgressionSource[];
  readonly reading: string;
}

function classifyIntervention(
  i: ProgressionInput['interventions'],
): 'advancing' | 'holding' | 'regressing' | 'unknown' {
  const total = i.irreversiblyRatifiedCount + i.regressedCount + i.withdrawnCount + i.activeCount;
  if (total === 0) return 'unknown';
  if (i.regressedCount > i.irreversiblyRatifiedCount) return 'regressing';
  if (i.irreversiblyRatifiedCount > 0 && i.regressedCount === 0) return 'advancing';
  return 'holding';
}

function classifyEvolution(
  e: ProgressionInput['evolution'],
): 'advancing' | 'holding' | 'regressing' | 'unknown' {
  switch (e.posture) {
    case 'continuous':
    case 'evolved':
      return 'advancing';
    case 'reinterpreted':
      return 'holding';
    case 'fractured':
      return 'regressing';
    case 'unknown':
    default:
      return 'unknown';
  }
}

function tallyDirections(
  directions: readonly { readonly source: ProgressionSource; readonly direction: 'advancing' | 'holding' | 'regressing' | 'unknown' }[],
): { band: ProgressionBand; contributingSources: readonly ProgressionSource[] } {
  const known = directions.filter((d) => d.direction !== 'unknown');
  if (known.length < 2) {
    return { band: 'not_yet_readable', contributingSources: known.map((d) => d.source) };
  }
  const counts = { advancing: 0, holding: 0, regressing: 0 };
  for (const d of known) {
    counts[d.direction as 'advancing' | 'holding' | 'regressing']++;
  }
  if (counts.regressing >= 2 || (counts.regressing === 1 && counts.advancing === 0 && counts.holding === 0)) {
    return { band: 'regressing', contributingSources: known.map((d) => d.source) };
  }
  if (counts.regressing >= 1) {
    return { band: 'regressing', contributingSources: known.map((d) => d.source) };
  }
  if (counts.advancing >= 2) {
    return { band: 'advancing', contributingSources: known.map((d) => d.source) };
  }
  return { band: 'holding', contributingSources: known.map((d) => d.source) };
}

export function readStabilizationProgression(
  input: ProgressionInput,
): ProgressionReading {
  const interventionDirection = classifyIntervention(input.interventions);
  const stateDirection = input.stateEngine.direction;
  const evolutionDirection = classifyEvolution(input.evolution);

  const { band, contributingSources } = tallyDirections([
    { source: 'intervention_ledger', direction: interventionDirection },
    { source: 'state_engine', direction: stateDirection },
    { source: 'evolution_tracker', direction: evolutionDirection },
  ]);

  return {
    engineVersion: ENGINE_VERSION,
    band,
    contributingSources: [...contributingSources].sort(),
    reading: readingFor(band, contributingSources.length),
  };
}

function readingFor(band: ProgressionBand, sourceCount: number): string {
  switch (band) {
    case 'not_yet_readable':
      return `Stabilization progression is not yet readable. ${sourceCount} of 3 sources contributed; at least 2 are required.`;
    case 'holding':
      return 'Stabilization recovery is preserved; no net forward movement is recorded across the reading window.';
    case 'advancing':
      return 'Stabilization is advancing on at least one domain without recorded regression on the others.';
    case 'regressing':
      return 'Stabilization recovery has been lost on at least one domain and is reported as regressing.';
  }
}
