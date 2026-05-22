/**
 * aiNarrativeAuditRecord
 * ──────────────────────
 * Audit record persisted for every AI-assisted narrative artefact.
 *
 * Persisted (audit-safe):
 *   - prompt version, synthesis version, disclosure version
 *   - reviewer status, reviewer id (when transitioned)
 *   - narrative generation timestamp
 *   - deterministic signal identifiers (band/archetype/breakpoint IDs)
 *
 * NEVER persisted:
 *   - raw prompts containing sensitive org context (unless consented)
 *   - telemetry, hidden embeddings
 *   - behavioural inference, vectorized personality models
 *   - free text from respondents
 */

import { AI_DISCLOSURE_VERSION } from './aiDisclosureCopy';
import { PROMPT_REGISTRY_VERSION, SYNTHESIS_ENGINE_VERSION } from './narrativePromptContracts';
import type { NarrativeContext } from './narrativePromptContracts';
import type { ReviewedArtifact } from './reviewStatusContracts';

export const AUDIT_RECORD_VERSION = '1.0.0' as const;

export interface AiNarrativeAuditRecord {
  readonly auditRecordVersion: typeof AUDIT_RECORD_VERSION;
  readonly artifactKind: string;
  readonly promptId: string;
  readonly promptVersion: string;
  readonly synthesisEngineVersion: typeof SYNTHESIS_ENGINE_VERSION;
  readonly promptRegistryVersion: typeof PROMPT_REGISTRY_VERSION;
  readonly disclosureVersion: typeof AI_DISCLOSURE_VERSION;
  readonly reviewStatus: string;
  readonly reviewerId?: string;
  readonly generatedAt: string;
  readonly signalReferences: ReadonlyArray<string>;
  readonly locale: string;
}

const AUDIT_FORBIDDEN_KEYS: ReadonlyArray<string> = Object.freeze([
  'rawPrompt',
  'userPrompt',
  'systemPrompt',
  'text',
  'narrative',
  'embeddings',
  'vector',
  'telemetry',
  'orgName',
  'email',
  'freeText',
]);

export function buildAuditRecord(input: {
  readonly artifact: ReviewedArtifact;
  readonly context: NarrativeContext;
  readonly generatedAt?: string;
}): AiNarrativeAuditRecord {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const signalReferences = [
    ...input.context.maturityBands.map((b) => b.pillarId),
    ...input.context.archetypes.map((a) => a.archetypeId),
    ...input.context.breakpoints.map((b) => b.breakpointId),
    ...input.context.structuralSignals.map((s) => s.signalId),
    ...input.context.onboardingFindings.map((o) => o.findingId),
    ...input.context.governanceObservations.map((g) => g.observationId),
  ];

  const record: AiNarrativeAuditRecord = Object.freeze({
    auditRecordVersion: AUDIT_RECORD_VERSION,
    artifactKind: input.artifact.artifactKind,
    promptId: input.artifact.promptId,
    promptVersion: input.artifact.promptVersion,
    synthesisEngineVersion: SYNTHESIS_ENGINE_VERSION,
    promptRegistryVersion: PROMPT_REGISTRY_VERSION,
    disclosureVersion: AI_DISCLOSURE_VERSION,
    reviewStatus: input.artifact.reviewStatus,
    reviewerId: input.artifact.reviewerId,
    generatedAt,
    signalReferences: Object.freeze([...new Set(signalReferences)].sort()),
    locale: input.context.locale,
  });

  // Defensive: ensure no forbidden key has leaked onto the record.
  for (const k of Object.keys(record)) {
    if (AUDIT_FORBIDDEN_KEYS.includes(k)) {
      throw new Error(
        `[ai/audit] forbidden key "${k}" leaked into audit record`,
      );
    }
  }
  return record;
}

export const AUDIT_FORBIDDEN_KEYS_PUBLIC = AUDIT_FORBIDDEN_KEYS;
