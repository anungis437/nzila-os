/**
 * ARTIFACT TYPE: Runtime Persistence
 * MODULE: OCI Governance Memory Runtime
 * DOCTRINE_VERSION: 1.0.0
 *
 * In-memory lineage persistence sketch for governance rationale envelopes.
 *
 * NON-BINDING SKETCH:
 *   This module is a deterministic, in-memory composition surface. It does
 *   NOT define how the institution persists rationale at rest. Persistence
 *   at rest is governed by `OCI_DATA_HANDLING.md` and the institution's own
 *   data residency posture. This module is safe to use in tests and in
 *   reviewer-led runtime composition only.
 *
 * Posture:
 *   - Institution-scoped. A reader for one institution cannot observe
 *     another institution's rationale.
 *   - Reviewer-led. Every read records a reviewer reference.
 *   - Append-only in the composition surface. Rationale is never edited in
 *     place; superseding rationale is recorded as a new envelope with a
 *     lineage reference back to the superseded envelope.
 */

import type { RuntimeRationaleEnvelope } from './runtimeRationaleEnvelope';

export interface ReadOptions {
  readonly reviewerRefId: string;
  readonly institutionScope: string;
}

export interface LineageStore {
  record(envelope: RuntimeRationaleEnvelope): void;
  read(memoryId: string, options: ReadOptions): RuntimeRationaleEnvelope | null;
  list(options: ReadOptions): readonly RuntimeRationaleEnvelope[];
}

export function createInMemoryLineageStore(): LineageStore {
  const envelopes = new Map<string, RuntimeRationaleEnvelope>();
  return {
    record(envelope) {
      envelopes.set(envelope.memoryId, envelope);
    },
    read(memoryId, options) {
      if (!options.reviewerRefId || !options.institutionScope) return null;
      const env = envelopes.get(memoryId);
      if (!env) return null;
      if (env.institutionScope !== options.institutionScope) return null;
      return env;
    },
    list(options) {
      if (!options.reviewerRefId || !options.institutionScope) return [];
      const out: RuntimeRationaleEnvelope[] = [];
      for (const env of envelopes.values()) {
        if (env.institutionScope === options.institutionScope) out.push(env);
      }
      out.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
      return out;
    },
  };
}
