/**
 * ARTIFACT TYPE: Runtime Envelope
 * MODULE: OCI Continuity Event Runtime
 * DOCTRINE_VERSION: 1.0.0
 *
 * Re-export and convenience helpers for the canonical ContinuityEventEnvelope.
 * The envelope shape lives in `runtimeContracts.ts`; this module provides
 * deterministic constructors only.
 */

import type {
  ContinuityEventEnvelope,
  ContinuityEventKind,
  ContinuityEventSeverity,
  GovernanceMemoryReference,
  RuntimeLineageReference,
} from '../contracts/runtimeContracts';
import { RUNTIME_CONTRACT_VERSION } from '../contracts/runtimeContracts';
import { CONTINUITY_EVENT_TYPE_DEFAULT_SEVERITY } from './continuityEventTypes';

export interface ComposeEventInput {
  readonly eventId: string;
  readonly kind: ContinuityEventKind;
  readonly observedAt: string;
  readonly institutionScope: string;
  readonly statement: string;
  readonly severity?: ContinuityEventSeverity;
  readonly lineage?: readonly RuntimeLineageReference[];
  readonly memoryReferences?: readonly GovernanceMemoryReference[];
  readonly evidence?: Readonly<Record<string, unknown>>;
}

export function composeContinuityEvent(input: ComposeEventInput): ContinuityEventEnvelope {
  return {
    contractVersion: RUNTIME_CONTRACT_VERSION,
    eventId: input.eventId,
    kind: input.kind,
    severity: input.severity ?? CONTINUITY_EVENT_TYPE_DEFAULT_SEVERITY[input.kind],
    observedAt: input.observedAt,
    institutionScope: input.institutionScope,
    statement: input.statement,
    lineage: input.lineage ?? [],
    memoryReferences: input.memoryReferences ?? [],
    evidence: input.evidence ?? {},
  };
}
