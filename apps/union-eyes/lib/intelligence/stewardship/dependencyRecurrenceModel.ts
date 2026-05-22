/**
 * ARTIFACT TYPE: Dependency Recurrence Model
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Dependency recurrence model.
 *
 * Reviewer-readable model for detecting whether previously redistributed
 * stewardship dependencies have re-emerged. The model never infers identity
 * of specific stewards; it counts re-emergences of named-but-anonymised
 * dependency tags submitted by the reviewer.
 */

export const DEPENDENCY_RECURRENCE_MODEL_VERSION = '1.0.0' as const;

export type DependencyRecurrenceBand =
  | 'not_yet_readable'
  | 'no_recurrence'
  | 'isolated_recurrence'
  | 'recurring_recurrence';

export interface DependencyTagObservation {
  readonly tag: string;
  readonly observedAt: string; // ISO-8601
  readonly reviewerRefId: string;
}

export interface DependencyRecurrenceReading {
  readonly band: DependencyRecurrenceBand;
  readonly recurringTagCount: number;
  readonly basedOn: number;
}

export function readDependencyRecurrence(
  observations: ReadonlyArray<DependencyTagObservation>,
): DependencyRecurrenceReading {
  if (observations.length < 2) {
    return { band: 'not_yet_readable', recurringTagCount: 0, basedOn: 0 };
  }
  const counts = new Map<string, number>();
  for (const observation of observations) {
    counts.set(observation.tag, (counts.get(observation.tag) ?? 0) + 1);
  }
  let recurring = 0;
  for (const count of counts.values()) {
    if (count >= 2) recurring += 1;
  }
  let band: DependencyRecurrenceBand;
  if (recurring === 0) band = 'no_recurrence';
  else if (recurring === 1) band = 'isolated_recurrence';
  else band = 'recurring_recurrence';
  return { band, recurringTagCount: recurring, basedOn: observations.length };
}
