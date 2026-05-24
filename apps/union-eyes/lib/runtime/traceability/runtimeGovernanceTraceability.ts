/**
 * ARTIFACT TYPE: Runtime Engine
 * MODULE: OCI Runtime Governance Traceability
 * DOCTRINE_VERSION: 1.0.0
 *
 * Runtime Governance Traceability reads continuity events, ledger entries,
 * and governance memory references together and reports whether the
 * institutional trail is sufficient for an executive reading.
 *
 * Posture:
 *   - Refusal-first: missing trails → not_yet_traceable.
 *   - Deterministic.
 *   - Reports a binary traceability verdict at the structural level only;
 *     institutional traceability remains the institution's own judgment.
 */

import type {
  ContinuityEventEnvelope,
  GovernanceMemoryReference,
  RuntimeContinuitySignal,
  RuntimeLineageReference,
} from '../contracts/runtimeContracts';
import { RUNTIME_CONTRACT_VERSION } from '../contracts/runtimeContracts';

export const RUNTIME_GOVERNANCE_TRACEABILITY_VERSION = '1.0.0' as const;

export type TraceabilityVerdict =
  | 'traceable'
  | 'partial'
  | 'not_yet_traceable';

export interface TraceabilityInput {
  readonly institutionScope: string;
  readonly events: readonly ContinuityEventEnvelope[];
  readonly lineageReferences: readonly RuntimeLineageReference[];
  readonly memoryReferences: readonly GovernanceMemoryReference[];
}

export interface TraceabilityReading {
  readonly engineVersion: typeof RUNTIME_GOVERNANCE_TRACEABILITY_VERSION;
  readonly institutionScope: string;
  readonly verdict: TraceabilityVerdict;
  readonly eventsConsidered: number;
  readonly lineageReferencesConsidered: number;
  readonly memoryReferencesConsidered: number;
  readonly gaps: readonly string[];
  readonly signals: readonly RuntimeContinuitySignal[];
  readonly statement: string;
}

export function readGovernanceTraceability(
  input: TraceabilityInput,
): TraceabilityReading {
  const scopedEvents = input.events.filter((e) => e.institutionScope === input.institutionScope);
  const scopedLineage = input.lineageReferences.filter((l) => l.institutionScope === input.institutionScope);
  const scopedMemory = input.memoryReferences.filter((m) => m.institutionScope === input.institutionScope);

  const gaps: string[] = [];
  if (scopedEvents.length === 0) gaps.push('events_missing');
  if (scopedLineage.length === 0) gaps.push('lineage_references_missing');
  if (scopedMemory.length === 0) gaps.push('memory_references_missing');

  let verdict: TraceabilityVerdict;
  if (gaps.length === 3) verdict = 'not_yet_traceable';
  else if (gaps.length === 0) verdict = 'traceable';
  else verdict = 'partial';

  const signals: RuntimeContinuitySignal[] = [
    {
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: 'runtime_governance_traceability:verdict',
      severity: verdict === 'traceable' ? 'observation' : verdict === 'partial' ? 'warning' : 'note',
      category: 'runtime_governance_traceability_verdict',
      statement:
        verdict === 'traceable'
          ? 'Runtime governance trail is sufficient for an executive reading.'
          : verdict === 'partial'
            ? 'Runtime governance trail is partial; reviewer-led completion is required.'
            : 'Runtime governance trail is not yet traceable for this institution scope.',
      evidence: {
        verdict,
        gaps,
        eventsConsidered: scopedEvents.length,
        lineageConsidered: scopedLineage.length,
        memoryConsidered: scopedMemory.length,
      },
    },
  ];
  signals.sort((a, b) => a.signalId.localeCompare(b.signalId));

  return {
    engineVersion: RUNTIME_GOVERNANCE_TRACEABILITY_VERSION,
    institutionScope: input.institutionScope,
    verdict,
    eventsConsidered: scopedEvents.length,
    lineageReferencesConsidered: scopedLineage.length,
    memoryReferencesConsidered: scopedMemory.length,
    gaps,
    signals,
    statement:
      verdict === 'traceable'
        ? 'Runtime governance traceability is sufficient on the available reading.'
        : verdict === 'partial'
          ? 'Runtime governance traceability is partial; reviewer attention is required.'
          : 'Runtime governance traceability is not yet readable.',
  };
}
