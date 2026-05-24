/**
 * ARTIFACT TYPE: Runtime Engine
 * MODULE: OCI Governance Memory Runtime
 * DOCTRINE_VERSION: 1.0.0
 *
 * The Governance Memory Runtime preserves institutional rationale.
 *
 * It never:
 *   - infers intent,
 *   - ranks people,
 *   - automates governance authority,
 *   - or generates institutional truth autonomously.
 *
 * It only:
 *   - records rationale that a reviewer has stated,
 *   - reads rationale on reviewer-led request,
 *   - composes a refusable summary suitable for an executive reading.
 *
 * Refusal is the default. Missing rationale is reported as
 * `not_yet_readable`; the runtime does not fabricate rationale.
 */

import type { RuntimeContinuitySignal } from '../contracts/runtimeContracts';
import { RUNTIME_CONTRACT_VERSION } from '../contracts/runtimeContracts';
import type { LineageStore, ReadOptions } from './governanceLineagePersistence';
import type { RuntimeRationaleEnvelope } from './runtimeRationaleEnvelope';

export const GOVERNANCE_MEMORY_RUNTIME_VERSION = '1.0.0' as const;

export type MemoryRecordRejectionReason =
  | 'reviewerRefId_missing'
  | 'institutionScope_missing'
  | 'rationaleStatement_missing'
  | 'subjectRefId_missing'
  | 'memoryId_missing';

export interface MemoryRecordResult {
  readonly recorded: boolean;
  readonly memoryId: string | null;
  readonly rejections: readonly MemoryRecordRejectionReason[];
}

export interface MemoryReadResult {
  readonly envelope: RuntimeRationaleEnvelope | null;
  readonly readable: boolean;
  readonly reason: 'readable' | 'not_yet_readable' | 'institution_scope_mismatch';
}

export interface MemoryReadingSummary {
  readonly engineVersion: typeof GOVERNANCE_MEMORY_RUNTIME_VERSION;
  readonly institutionScope: string;
  readonly recordedRationaleCount: number;
  readonly oldestRecordedAt: string | null;
  readonly newestRecordedAt: string | null;
  readonly signals: readonly RuntimeContinuitySignal[];
  readonly statement: string;
}

function rejectEnvelope(
  env: RuntimeRationaleEnvelope,
): readonly MemoryRecordRejectionReason[] {
  const r: MemoryRecordRejectionReason[] = [];
  if (!env.reviewerRefId) r.push('reviewerRefId_missing');
  if (!env.institutionScope) r.push('institutionScope_missing');
  if (!env.rationaleStatement) r.push('rationaleStatement_missing');
  if (!env.subjectRefId) r.push('subjectRefId_missing');
  if (!env.memoryId) r.push('memoryId_missing');
  return r;
}

export function recordRationale(
  envelope: RuntimeRationaleEnvelope,
  store: LineageStore,
): MemoryRecordResult {
  const rejections = rejectEnvelope(envelope);
  if (rejections.length > 0) {
    return { recorded: false, memoryId: null, rejections };
  }
  store.record(envelope);
  return { recorded: true, memoryId: envelope.memoryId, rejections: [] };
}

export function readRationale(
  memoryId: string,
  store: LineageStore,
  options: ReadOptions,
): MemoryReadResult {
  const env = store.read(memoryId, options);
  if (!env) {
    return { envelope: null, readable: false, reason: 'not_yet_readable' };
  }
  if (env.institutionScope !== options.institutionScope) {
    return { envelope: null, readable: false, reason: 'institution_scope_mismatch' };
  }
  return { envelope: env, readable: true, reason: 'readable' };
}

export function summarizeGovernanceMemory(
  store: LineageStore,
  options: ReadOptions,
): MemoryReadingSummary {
  const envelopes = store.list(options);
  const signals: RuntimeContinuitySignal[] = [];
  if (envelopes.length === 0) {
    signals.push({
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: 'governance_memory:not_yet_readable',
      severity: 'note',
      category: 'governance_memory_not_yet_readable',
      statement:
        'No reviewer-led rationale has been recorded for this institution scope.',
      evidence: { institutionScope: options.institutionScope },
    });
  } else {
    signals.push({
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: 'governance_memory:recorded',
      severity: 'observation',
      category: 'governance_memory_recorded',
      statement: `Reviewer-led rationale envelopes recorded: ${envelopes.length}.`,
      evidence: {
        institutionScope: options.institutionScope,
        count: envelopes.length,
      },
    });
  }
  const oldest = envelopes[0]?.recordedAt ?? null;
  const newest = envelopes[envelopes.length - 1]?.recordedAt ?? null;
  const statement =
    envelopes.length === 0
      ? 'Governance memory is not yet readable for this institution scope.'
      : `Governance memory holds ${envelopes.length} reviewer-led rationale envelope${
          envelopes.length === 1 ? '' : 's'
        }.`;
  return {
    engineVersion: GOVERNANCE_MEMORY_RUNTIME_VERSION,
    institutionScope: options.institutionScope,
    recordedRationaleCount: envelopes.length,
    oldestRecordedAt: oldest,
    newestRecordedAt: newest,
    signals,
    statement,
  };
}
