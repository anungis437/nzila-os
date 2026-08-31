/**
 * OCI Residual Concentration Reader — categorical reading (NOT scoring)
 * of stewardship process concentration before and after a proposed
 * redistribution.
 *
 * Pure. Reads, does not score. Categorical outputs only.
 *
 * Doctrine:
 *   docs/oci/superseded/stabilization/playbooks/STEWARDSHIP_REDISTRIBUTION.md §9
 *   docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md (no numeric scoring)
 */

export const ENGINE_VERSION = '2.0.0';

export type ResidualReading =
  | 'relieved'
  | 'partially_relieved'
  | 'unchanged'
  | 'worsened';

/**
 * A carrier-load reading expresses, per process, how many carriers
 * institutionally hold the practice. This is institutional record,
 * not person-load measurement.
 */
export interface ProcessCarrierLoad {
  readonly processId: string;
  readonly carrierCount: number;
}

export interface ResidualConcentrationInput {
  readonly pre: readonly ProcessCarrierLoad[];
  readonly post: readonly ProcessCarrierLoad[];
}

export interface ProcessResidualReading {
  readonly processId: string;
  readonly preCarrierCount: number;
  readonly postCarrierCount: number;
  readonly reading: ResidualReading;
}

export interface ResidualConcentrationResult {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly perProcess: readonly ProcessResidualReading[];
  readonly overall: ResidualReading;
}

function classify(pre: number, post: number): ResidualReading {
  // Higher carrier count means broader institutional carriage, i.e.
  // LESS concentration. Therefore post > pre means relief.
  if (post > pre) {
    // Sole-carrier resolved (pre=1, post>=2): fully relieved.
    if (pre <= 1 && post >= 2) return 'relieved';
    if (post - pre >= 2) return 'relieved';
    return 'partially_relieved';
  }
  if (post === pre) return 'unchanged';
  return 'worsened';
}

function readOverall(perProcess: readonly ProcessResidualReading[]): ResidualReading {
  if (perProcess.length === 0) return 'unchanged';
  if (perProcess.some((p) => p.reading === 'worsened')) return 'worsened';
  if (perProcess.every((p) => p.reading === 'relieved')) return 'relieved';
  if (perProcess.every((p) => p.reading === 'unchanged')) return 'unchanged';
  return 'partially_relieved';
}

export function readResidualConcentration(
  input: ResidualConcentrationInput,
): ResidualConcentrationResult {
  const preById = new Map<string, number>();
  for (const p of input.pre) preById.set(p.processId, p.carrierCount);

  const perProcess: ProcessResidualReading[] = [];
  const seenIds = new Set<string>();

  for (const post of input.post) {
    seenIds.add(post.processId);
    const preCount = preById.get(post.processId) ?? 0;
    perProcess.push({
      processId: post.processId,
      preCarrierCount: preCount,
      postCarrierCount: post.carrierCount,
      reading: classify(preCount, post.carrierCount),
    });
  }
  // Processes present in pre but not post: post=0 → worsened (lost entirely).
  for (const pre of input.pre) {
    if (seenIds.has(pre.processId)) continue;
    perProcess.push({
      processId: pre.processId,
      preCarrierCount: pre.carrierCount,
      postCarrierCount: 0,
      reading: 'worsened',
    });
  }

  perProcess.sort((a, b) => a.processId.localeCompare(b.processId));

  return {
    engineVersion: ENGINE_VERSION,
    perProcess,
    overall: readOverall(perProcess),
  };
}
