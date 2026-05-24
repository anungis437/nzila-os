/**
 * ARTIFACT TYPE: Engine Helper
 * MODULE: Modernization Alignment
 * DOCTRINE_VERSION: 2.0.0
 *
 * Operational Traceability Review — examines whether modernization
 * initiatives preserve the traceability between operational practice and
 * the organizational reasoning that produced it. Loss of traceability is
 * the most common quiet continuity failure during modernization.
 *
 * Pure, deterministic.
 */

export interface OperationalTraceabilityInput {
  /** Stable abstract id matching ModernizationInitiativeInput.id. */
  readonly initiativeId: string;
  readonly initiativeLabel: string;
  /** True if the prior practice is documented. */
  readonly priorPracticeDocumented: boolean;
  /** True if the rationale for the prior practice is captured. */
  readonly priorRationaleCaptured: boolean;
  /** True if the migration plan explicitly records lineage. */
  readonly migrationRecordsLineage: boolean;
}

export type TraceabilityPosture =
  | 'traceable'
  | 'partially_traceable'
  | 'opaque';

export interface OperationalTraceabilityCell {
  readonly initiativeId: string;
  readonly initiativeLabel: string;
  readonly posture: TraceabilityPosture;
  readonly reading: string;
}

const POSTURE_READING: Record<TraceabilityPosture, string> = {
  traceable:
    'Prior practice, rationale, and lineage are all captured; traceability survives the modernization.',
  partially_traceable:
    'Prior practice or rationale is captured but lineage is not fully carried into the modernization.',
  opaque:
    'Prior practice, rationale, and lineage are not captured; operational traceability does not survive the modernization.',
};

export function reviewOperationalTraceability(
  inputs: readonly OperationalTraceabilityInput[],
): readonly OperationalTraceabilityCell[] {
  return inputs.map((i) => {
    const posture = classifyTraceability(i);
    return {
      initiativeId: i.initiativeId,
      initiativeLabel: i.initiativeLabel,
      posture,
      reading: POSTURE_READING[posture],
    };
  });
}

function classifyTraceability(i: OperationalTraceabilityInput): TraceabilityPosture {
  const captured = [
    i.priorPracticeDocumented,
    i.priorRationaleCaptured,
    i.migrationRecordsLineage,
  ].filter(Boolean).length;
  if (captured === 3) return 'traceable';
  if (captured === 0) return 'opaque';
  return 'partially_traceable';
}
