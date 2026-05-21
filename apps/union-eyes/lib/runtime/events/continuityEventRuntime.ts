/**
 * ARTIFACT TYPE: Runtime Engine
 * MODULE: OCI Continuity Event Runtime
 * DOCTRINE_VERSION: 1.0.0
 *
 * The Continuity Event Runtime composes continuity-safe event sequences from
 * a reviewer-led input. It does not observe operational systems on its own;
 * a reviewer (or a deterministic upstream engine acting under reviewer-led
 * configuration) supplies the events.
 *
 * Posture:
 *   - Deterministic: the same input always produces the same output.
 *   - Refusal-first: invalid events are reported, not silently dropped.
 *   - Anti-surveillance: events never carry personal identifiers.
 *   - Stable ordering: events are sorted by observedAt then eventId.
 */

import type {
  ContinuityEventEnvelope,
  RuntimeContinuitySignal,
} from '../contracts/runtimeContracts';
import {
  validateContinuityEventEnvelope,
  type ValidationResult,
} from '../contracts/runtimeEnvelopeValidators';
import { RUNTIME_CONTRACT_VERSION } from '../contracts/runtimeContracts';
import { isKnownContinuityEventKind } from './continuityEventTypes';

export const CONTINUITY_EVENT_RUNTIME_VERSION = '1.0.0' as const;

export interface EventIngestionRejection {
  readonly eventId: string;
  readonly violations: readonly string[];
}

export interface EventIngestionResult {
  readonly engineVersion: typeof CONTINUITY_EVENT_RUNTIME_VERSION;
  readonly accepted: readonly ContinuityEventEnvelope[];
  readonly rejections: readonly EventIngestionRejection[];
  readonly signals: readonly RuntimeContinuitySignal[];
}

export function ingestContinuityEvents(
  envelopes: readonly ContinuityEventEnvelope[],
): EventIngestionResult {
  const accepted: ContinuityEventEnvelope[] = [];
  const rejections: EventIngestionRejection[] = [];

  for (const env of envelopes) {
    const v: ValidationResult = validateContinuityEventEnvelope(env);
    const reasons: string[] = [...v.violations];
    if (!isKnownContinuityEventKind(env.kind as unknown as string)) {
      reasons.push('event.kind_not_recognised');
    }
    if (reasons.length > 0) {
      rejections.push({ eventId: env.eventId ?? '(missing)', violations: reasons });
      continue;
    }
    accepted.push(env);
  }

  accepted.sort((a, b) => {
    const t = a.observedAt.localeCompare(b.observedAt);
    return t !== 0 ? t : a.eventId.localeCompare(b.eventId);
  });

  const signals: RuntimeContinuitySignal[] = [];
  signals.push({
    contractVersion: RUNTIME_CONTRACT_VERSION,
    signalId: 'continuity_events:summary',
    severity: 'observation',
    category: 'continuity_events_summary',
    statement: `Continuity events accepted: ${accepted.length}. Rejections: ${rejections.length}.`,
    evidence: { acceptedCount: accepted.length, rejectionCount: rejections.length },
  });

  for (const r of rejections) {
    signals.push({
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: `continuity_events:rejection:${r.eventId}`,
      severity: 'warning',
      category: 'continuity_event_rejected',
      statement: `Continuity event ${r.eventId} rejected: ${r.violations.join(', ')}.`,
      evidence: { eventId: r.eventId, violations: r.violations },
    });
  }

  signals.sort((a, b) => a.signalId.localeCompare(b.signalId));

  return {
    engineVersion: CONTINUITY_EVENT_RUNTIME_VERSION,
    accepted,
    rejections,
    signals,
  };
}
