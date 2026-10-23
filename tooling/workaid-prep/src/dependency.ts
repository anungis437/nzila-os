import type { ClaimId, DependencyId, MatterId, UserId } from './ids.ts';
import { err, ok } from './result.ts';
import type { Result } from './result.ts';
import { localDateInZone, parseIsoDate, toIsoDate } from './time.ts';

export type DependencyKind = 'WSIB_CLAIM_FILE' | 'ARF_DISPOSITION' | 'ARO_DECISION' | 'WSIAT_PROCEDURAL_STEP' | 'OTHER_EXTERNAL';

export interface FileBatch {
  readonly receivedOn: string;
  readonly pageCount: number | null;
  readonly missingPagesNote: string | null;
}

export interface ExternalDependency {
  readonly id: DependencyId;
  readonly matterId: MatterId;
  readonly claimId: ClaimId | null;
  readonly kind: DependencyKind;
  readonly waitingSince: string;
  readonly owner: UserId;
  /** Operational observation, e.g. a partner-reported 4-6 week typical wait. Never a legal deadline. */
  readonly expectedWindowDays: { readonly min: number; readonly max: number } | null;
  readonly batches: readonly FileBatch[];
  readonly receivedAt: string | null;
  /** Completeness is a professional judgement; receipt of a batch never sets it. */
  readonly completeness: 'UNASSESSED' | 'ASSESSED_COMPLETE_BY_PROFESSIONAL';
}

export function openDependency(input: Omit<ExternalDependency, 'batches' | 'receivedAt' | 'completeness'>): Result<ExternalDependency, 'OWNER_REQUIRED' | 'BAD_WINDOW'> {
  if (!input.owner) return err('OWNER_REQUIRED', 'an owner is required; unowned waiting is how files are forgotten');
  if (input.expectedWindowDays && (input.expectedWindowDays.min < 0 || input.expectedWindowDays.max < input.expectedWindowDays.min)) {
    return err('BAD_WINDOW', 'invalid expected window');
  }
  return ok({ ...input, batches: [], receivedAt: null, completeness: 'UNASSESSED' });
}

export function recordBatch(dep: ExternalDependency, batch: FileBatch): ExternalDependency {
  return { ...dep, batches: [...dep.batches, batch], receivedAt: dep.receivedAt ?? batch.receivedOn, completeness: dep.completeness };
}

export type DependencyStatus = 'WAITING_WITHIN_EXPECTED_WINDOW' | 'WAITING_PAST_EXPECTED_WINDOW' | 'WAITING_NO_EXPECTATION_CONFIGURED' | 'RECEIVED_COMPLETENESS_UNASSESSED' | 'RECEIVED_ASSESSED_COMPLETE';

export function dependencyStatus(dep: ExternalDependency, now: Date, timeZone: string) {
  if (dep.receivedAt) {
    return {
      status: (dep.completeness === 'ASSESSED_COMPLETE_BY_PROFESSIONAL' ? 'RECEIVED_ASSESSED_COMPLETE' : 'RECEIVED_COMPLETENESS_UNASSESSED') as DependencyStatus,
      legalDeadline: false as const,
      ageDays: null,
    };
  }
  const since = parseIsoDate(dep.waitingSince);
  const today = localDateInZone(now, timeZone);
  const ageDays = Math.round((Date.UTC(today.year, today.month - 1, today.day) - Date.UTC(since.year, since.month - 1, since.day)) / 86_400_000);
  const w = dep.expectedWindowDays;
  const status: DependencyStatus = !w ? 'WAITING_NO_EXPECTATION_CONFIGURED' : ageDays > w.max ? 'WAITING_PAST_EXPECTED_WINDOW' : 'WAITING_WITHIN_EXPECTED_WINDOW';
  // legalDeadline is always false: aging is a prompt to follow up, not a clock.
  return { status, legalDeadline: false as const, ageDays, asOf: toIsoDate(today) };
}
