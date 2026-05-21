/**
 * ARTIFACT TYPE: Runtime Primitive
 * MODULE: OCI Operating Primitives
 * DOCTRINE_VERSION: 1.0.0
 *
 * Continuity Runtime Context primitive.
 *
 * Operational systems compose this context to behave continuity-aware without
 * inferring intent. The context is read-only: callers receive it, they do not
 * fabricate it.
 *
 * Posture:
 *   - Refusal-first. Unknown sensitivity is `unknown`, never a guess.
 *   - Institution-scoped.
 *   - No personal identifiers.
 */

import type {
  ContinuityRuntimeBand,
  ContinuityRuntimeContext,
  ContinuitySensitivity,
  RuntimeLineageReference,
} from '../contracts/runtimeContracts';

export const CONTINUITY_RUNTIME_CONTEXT_VERSION = '1.0.0' as const;

export interface ContinuityRuntimeContextInput {
  readonly institutionScope: string;
  readonly sensitivity: ContinuitySensitivity;
  readonly governanceLineage?: readonly RuntimeLineageReference[];
  readonly stewardshipConcentrationBand?: ContinuityRuntimeBand;
  readonly survivabilityBand?: ContinuityRuntimeBand;
  readonly readinessSufficient?: boolean;
}

export function composeContinuityRuntimeContext(
  input: ContinuityRuntimeContextInput,
): ContinuityRuntimeContext {
  return {
    institutionScope: input.institutionScope,
    sensitivity: input.sensitivity,
    governanceLineage: input.governanceLineage ?? [],
    stewardshipConcentrationBand: input.stewardshipConcentrationBand ?? 'not_yet_readable',
    survivabilityBand: input.survivabilityBand ?? 'not_yet_readable',
    readinessSufficient: input.readinessSufficient ?? false,
  };
}

export function isContinuitySensitive(ctx: ContinuityRuntimeContext): boolean {
  return ctx.sensitivity === 'continuity_sensitive' || ctx.sensitivity === 'continuity_critical';
}

export function isContinuityCritical(ctx: ContinuityRuntimeContext): boolean {
  return ctx.sensitivity === 'continuity_critical';
}
