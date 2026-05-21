/**
 * ARTIFACT TYPE: Runtime Primitive
 * MODULE: OCI Operating Primitives
 * DOCTRINE_VERSION: 1.0.0
 *
 * Platform Continuity Primitives.
 *
 * These primitives let an operational system describe a critical action in
 * continuity-native terms. The runtime never alters the action; it only
 * decorates the action with the continuity metadata that allows downstream
 * engines to read it.
 *
 * Posture:
 *   - Read-only with respect to the action.
 *   - Refusal-friendly: missing metadata is reported, not guessed.
 *   - Anti-surveillance: actor identifiers are reviewer references, not names.
 */

import type {
  ContinuityRuntimeContext,
  GovernanceMemoryReference,
  RuntimeLineageReference,
} from '../contracts/runtimeContracts';
import { isContinuityCritical, isContinuitySensitive } from './continuityRuntimeContext';

export interface CriticalActionAnnotation {
  readonly actionId: string;
  readonly actionKind: string;
  readonly continuityContext: ContinuityRuntimeContext;
  readonly governanceLineage: readonly RuntimeLineageReference[];
  readonly memoryReferences: readonly GovernanceMemoryReference[];
  readonly reviewerRefId: string;
  readonly statedAt: string;
}

export interface AnnotationCompleteness {
  readonly complete: boolean;
  readonly missing: readonly string[];
}

export function readAnnotationCompleteness(
  annotation: CriticalActionAnnotation,
): AnnotationCompleteness {
  const missing: string[] = [];
  if (!annotation.reviewerRefId) missing.push('reviewerRefId');
  if (annotation.governanceLineage.length === 0) missing.push('governanceLineage');
  if (annotation.memoryReferences.length === 0 && isContinuityCritical(annotation.continuityContext)) {
    missing.push('memoryReferences_required_for_continuity_critical');
  }
  return { complete: missing.length === 0, missing };
}

export interface StewardshipSensitivityReading {
  readonly stewardshipConcentrationBand: ContinuityRuntimeContext['stewardshipConcentrationBand'];
  readonly survivabilityBand: ContinuityRuntimeContext['survivabilityBand'];
  readonly sensitive: boolean;
  readonly statement: string;
}

export function readStewardshipSensitivity(
  ctx: ContinuityRuntimeContext,
): StewardshipSensitivityReading {
  const sensitive =
    ctx.stewardshipConcentrationBand === 'regressing' ||
    ctx.survivabilityBand === 'regressing' ||
    isContinuitySensitive(ctx);
  const statement = sensitive
    ? 'Action is continuity-sensitive on the available reading.'
    : 'Action does not present a continuity sensitivity on the available reading.';
  return {
    stewardshipConcentrationBand: ctx.stewardshipConcentrationBand,
    survivabilityBand: ctx.survivabilityBand,
    sensitive,
    statement,
  };
}

export interface TraceabilityCheck {
  readonly traceable: boolean;
  readonly reasons: readonly string[];
}

export function readTraceability(annotation: CriticalActionAnnotation): TraceabilityCheck {
  const reasons: string[] = [];
  if (!annotation.actionId) reasons.push('actionId_missing');
  if (!annotation.actionKind) reasons.push('actionKind_missing');
  if (!annotation.statedAt) reasons.push('statedAt_missing');
  if (annotation.governanceLineage.length === 0) reasons.push('governanceLineage_empty');
  return { traceable: reasons.length === 0, reasons };
}
