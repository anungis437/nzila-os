/**
 * Cognition Memory Store
 *
 * Persists organizational continuity reasoning over time.
 * Uses the ue_cognition_memory table. The relation is created by platform
 * migration 0012 and protected by FORCE RLS (scoped 0018); this module never
 * issues DDL and every statement runs on the tenant runtime identity.
 *
 * All data is org-scoped, auditable, and preserves reasoning lineage.
 */

import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { inOrganization, isUuid } from '../org-scope';
import { calculateResilienceIndex } from '../resilience-index/resilience-calculator';
import { simulateContinuityImpact } from '../simulation/continuity-simulator';
import type { SimulationScenario } from '../simulation/simulation-models';
import { derivedAnalyticsCondition } from '../governance/interview-access';
import {
  PROVENANCE_KEY,
  type MemoryProvenance,
  type CognitionMemoryEntry,
  type CognitionMemoryStore,
  type SaveMemoryInput,
  type MemoryStatus,
  type ResilienceSnapshotPoint,
  type HistoricalVerificationStatus,
} from './memory-models';

/** The model version tag recorded against every system_generated simulation_snapshot entry this build can produce. */
const SIMULATION_MODEL_VERSION = 'continuity-simulator-v1';

/** Reserved payload key for the resilience_baseline algorithm-computed comparison figure; a caller cannot supply it. */
const ALGORITHM_INDEX_KEY = '__algorithmComputedResilienceIndexAtCapture';

/**
 * For a resilience_baseline entry with a typed score, independently computes the current resilience index so the
 * saved entry can carry an algorithm-computed figure alongside the officer's own statement - not a check that
 * blocks or corrects the save (the officer's observation is still recorded as given), and not itself a verified
 * measurement (the index is computed from the same kind of inferred, exit-interview-derived data), but context a
 * reader needs to tell "an officer typed this number" from "this number was computed"
 * (DEF-0B7-EXC-COGNITION-MEMORY-STORES-CALLER-ASSERTED-SNAPSHOTS-WITH-NO-AUTHOR).
 * Returns null when there is no dependency data yet to compute an index from, or this entry is not a scored
 * resilience_baseline at all.
 */
async function algorithmComputedResilienceIndexFor(
  orgId: string,
  memoryType: SaveMemoryInput['memoryType'],
  resilienceScoreAtCapture: number | null | undefined,
): Promise<number | null> {
  if (memoryType !== 'resilience_baseline' || resilienceScoreAtCapture == null) return null;
  try {
    const index = await calculateResilienceIndex(orgId);
    return index.overallScore;
  } catch {
    // No dependency data to compute from yet (calculateResilienceIndex refuses rather than guess) - the officer's
    // own figure is still saved, just with nothing computed to compare it against at this point in time.
    return null;
  }
}

/** The published exit interview ids currently feeding this organization's dependency graph - the real evidence a
 *  system_generated simulation_snapshot's workflow actually read, recorded so the entry names its own inputs. */
async function currentEvidenceIds(orgId: string): Promise<string[]> {
  const rows = await inOrganization(orgId, (tx) =>
    tx.execute(sql`SELECT id FROM exit_interviews WHERE ${derivedAnalyticsCondition(orgId)}`),
  );
  return (rows as unknown as Array<{ id: string }>).map((r) => r.id);
}

function splitProvenance(raw: unknown): { payload: Record<string, unknown>; provenance: MemoryProvenance; algorithmComputedResilienceIndexAtCapture: number | null } {
  const { [PROVENANCE_KEY]: stamped, [ALGORITHM_INDEX_KEY]: algorithmIndexRaw, ...payload } = (raw as Record<string, unknown> | null) ?? {};
  const algorithmComputedResilienceIndexAtCapture = typeof algorithmIndexRaw === 'number' ? algorithmIndexRaw : null;
  const stampedRecord = stamped as Record<string, unknown> | undefined;
  const recordedBy = stampedRecord?.recordedBy;
  if (stampedRecord?.source === 'system_generated') {
    return {
      payload,
      algorithmComputedResilienceIndexAtCapture,
      provenance: {
        source: 'system_generated',
        recordedBy: typeof recordedBy === 'string' ? recordedBy : null,
        workflow: 'simulateContinuityImpact',
        modelVersion: typeof stampedRecord.modelVersion === 'string' ? stampedRecord.modelVersion : SIMULATION_MODEL_VERSION,
        scenario: (stampedRecord.scenario ?? { simulationType: 'retirement', affectedNodeIds: [] }) as SimulationScenario,
        computedAt: typeof stampedRecord.computedAt === 'string' ? stampedRecord.computedAt : new Date(0).toISOString(),
        inputEvidenceIds: Array.isArray(stampedRecord.inputEvidenceIds) ? (stampedRecord.inputEvidenceIds as string[]) : [],
      },
    };
  }
  return {
    payload,
    algorithmComputedResilienceIndexAtCapture,
    provenance: { source: 'officer_asserted', recordedBy: typeof recordedBy === 'string' ? recordedBy : null },
  };
}

/**
 * Whether a historical entry's figures could be reconciled against a real, current computation. Computed on read,
 * never stored. A system_generated entry is already real, so this does not apply to it. An officer_asserted entry
 * saved before provenance tracking existed at all (no __provenance key present in the stored payload) cannot even
 * be told apart from a verified one by a human reviewer without this check, so that is reported specifically
 * rather than folded into a generic "not verified". Any other officer_asserted simulation_snapshot was always
 * knowably an assertion, but still cannot be reconciled: this build does not capture a simulation_snapshot's
 * scenario in a replayable shape unless it was saved through the scenario-driven path, so no replay is attempted.
 */
function historicalVerificationFor(
  memoryType: CognitionMemoryEntry['memoryType'],
  provenance: MemoryProvenance,
  rawPayloadHadProvenanceKey: boolean,
): HistoricalVerificationStatus {
  if (memoryType !== 'simulation_snapshot' || provenance.source === 'system_generated') {
    return { checked: true, reconcilable: true, reason: 'not_applicable' };
  }
  if (!rawPayloadHadProvenanceKey) {
    return { checked: true, reconcilable: false, reason: 'predates_provenance_tracking' };
  }
  return { checked: true, reconcilable: false, reason: 'scenario_not_reconstructable' };
}

function rowToEntry(row: Record<string, unknown>): CognitionMemoryEntry {
  const rawPayload = row.payload as Record<string, unknown> | null;
  const rawPayloadHadProvenanceKey = Boolean(rawPayload && PROVENANCE_KEY in rawPayload);
  const { payload, provenance, algorithmComputedResilienceIndexAtCapture } = splitProvenance(rawPayload);
  const memoryType = row.memory_type as CognitionMemoryEntry['memoryType'];
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    memoryType,
    title: row.title as string,
    contextSummary: (row.context_summary as string) ?? '',
    payload,
    resilienceScoreAtCapture: (row.resilience_score_at_capture as number | null) ?? null,
    algorithmComputedResilienceIndexAtCapture,
    tags: (row.tags as string[]) ?? [],
    keyInsights: (row.key_insights as string[]) ?? [],
    sessionId: (row.session_id as string | null) ?? null,
    status: (row.status as MemoryStatus) ?? 'active',
    provenance,
    historicalVerification: historicalVerificationFor(memoryType, provenance, rawPayloadHadProvenanceKey),
    createdAt: (row.created_at as Date)?.toISOString?.() ?? (row.created_at as string),
    updatedAt: (row.updated_at as Date)?.toISOString?.() ?? (row.updated_at as string),
  };
}

/** Save a new cognition memory entry for an organization. The entry and its audit record commit together. */
export async function saveCognitionMemory(
  orgId: string,
  input: SaveMemoryInput,
  userId: string,
): Promise<CognitionMemoryEntry> {
  const id = randomUUID();
  const now = new Date().toISOString();

  // A simulation_snapshot given a scenario is never the officer's own stated result: the server runs the real
  // simulation workflow itself and persists its real output, never the caller's payload for this call.
  const isSystemGeneratedSimulation = input.memoryType === 'simulation_snapshot' && input.scenario !== undefined;

  let storedPayload: Record<string, unknown>;
  let provenanceStamp: Record<string, unknown>;
  let resilienceScoreAtCapture: number | null;

  if (isSystemGeneratedSimulation) {
    const scenario = input.scenario!;
    const [result, inputEvidenceIds] = await Promise.all([
      simulateContinuityImpact(orgId, scenario),
      currentEvidenceIds(orgId),
    ]);
    const computedAt = new Date().toISOString();
    storedPayload = result as unknown as Record<string, unknown>;
    provenanceStamp = {
      source: 'system_generated',
      recordedBy: userId,
      workflow: 'simulateContinuityImpact',
      modelVersion: SIMULATION_MODEL_VERSION,
      scenario,
      computedAt,
      inputEvidenceIds,
    };
    // The real result's own immediateImpactScore is the resilience figure for this capture, not an officer's guess.
    resilienceScoreAtCapture = Math.round(result.immediateImpactScore);
  } else {
    storedPayload = input.payload ?? {};
    provenanceStamp = { source: 'officer_asserted', recordedBy: userId };
    resilienceScoreAtCapture = input.resilienceScoreAtCapture ?? null;
  }

  const algorithmComputedResilienceIndexAtCapture = await algorithmComputedResilienceIndexFor(
    orgId,
    input.memoryType,
    resilienceScoreAtCapture,
  );

  await inOrganization(orgId, async (tx) => {
    await tx.execute(sql`
      INSERT INTO ue_cognition_memory
        (id, organization_id, memory_type, title, context_summary, payload,
         resilience_score_at_capture, tags, key_insights, session_id, status, created_at, updated_at)
      VALUES (
        ${id},
        ${orgId},
        ${input.memoryType},
        ${input.title},
        ${input.contextSummary ?? ''},
        ${JSON.stringify({
          ...storedPayload,
          [PROVENANCE_KEY]: provenanceStamp,
          ...(algorithmComputedResilienceIndexAtCapture != null ? { [ALGORITHM_INDEX_KEY]: algorithmComputedResilienceIndexAtCapture } : {}),
        })}::jsonb,
        ${resilienceScoreAtCapture},
        ${JSON.stringify(input.tags ?? [])}::jsonb,
        ${JSON.stringify(input.keyInsights ?? [])}::jsonb,
        ${input.sessionId ?? null},
        'active',
        ${now}::timestamptz,
        ${now}::timestamptz
      )
    `);
    await persistAtomicAudit(tx, {
      organizationId: orgId,
      userId,
      action: 'cognition_memory.save',
      resourceType: 'ue_cognition_memory',
      resourceId: id,
      details: { memoryType: input.memoryType, sessionId: input.sessionId ?? null, provenance: provenanceStamp.source },
    });
  });

  const provenance: MemoryProvenance = isSystemGeneratedSimulation
    ? (provenanceStamp as MemoryProvenance)
    : { source: 'officer_asserted', recordedBy: userId };

  return {
    id,
    organizationId: orgId,
    memoryType: input.memoryType,
    title: input.title,
    contextSummary: input.contextSummary ?? '',
    payload: storedPayload,
    resilienceScoreAtCapture,
    algorithmComputedResilienceIndexAtCapture,
    tags: input.tags ?? [],
    keyInsights: input.keyInsights ?? [],
    sessionId: input.sessionId ?? null,
    status: 'active',
    provenance,
    // Just created in this call, with full knowledge of its own scenario (if any) - not a historical read.
    historicalVerification: { checked: true, reconcilable: true, reason: 'not_applicable' },
    createdAt: now,
    updatedAt: now,
  };
}

/** Load cognition memory for an org (most recent first). */
export async function loadCognitionMemory(
  orgId: string,
  options: { limit?: number; memoryType?: string; sessionId?: string } = {},
): Promise<CognitionMemoryStore> {
  const rows = await inOrganization(orgId, (tx) =>
    tx.execute(sql`
      SELECT *
      FROM ue_cognition_memory
      WHERE organization_id = ${orgId}
        AND status = 'active'
        ${options.memoryType ? sql`AND memory_type = ${options.memoryType}` : sql``}
        ${options.sessionId ? sql`AND session_id = ${options.sessionId}` : sql``}
      ORDER BY created_at DESC
      LIMIT ${options.limit ?? 50}
    `),
  );

  const entries = (rows as any as Record<string, unknown>[]).map(rowToEntry);

  // Build resilience timeline from snapshots with scores
  const withScores = [...entries]
    .filter((e) => e.resilienceScoreAtCapture !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const resilienceTimeline: ResilienceSnapshotPoint[] = withScores.map((e, idx) => ({
    capturedAt: e.createdAt,
    resilienceScore: e.resilienceScoreAtCapture!,
    memoryEntryId: e.id,
    title: e.title,
    source: 'officer_asserted' as const,
    changeFromPrevious: idx === 0 ? null : e.resilienceScoreAtCapture! - withScores[idx - 1].resilienceScoreAtCapture!,
  }));

  return {
    organizationId: orgId,
    entries,
    resilienceTimeline,
    totalEntries: entries.length,
  };
}

/**
 * Archive an active cognition memory entry. Returns false — writing and auditing nothing — when the id is malformed or
 * matches no active entry of the organization.
 */
export async function archiveCognitionMemory(orgId: string, entryId: string, userId: string): Promise<boolean> {
  if (!isUuid(entryId)) return false;
  return inOrganization(orgId, async (tx) => {
    const rows = (await tx.execute(sql`
      UPDATE ue_cognition_memory
      SET status = 'archived', updated_at = now()
      WHERE id = ${entryId} AND organization_id = ${orgId} AND status = 'active'
      RETURNING id
    `)) as unknown as Array<Record<string, unknown>>;
    if (rows.length === 0) return false;
    await persistAtomicAudit(tx, {
      organizationId: orgId,
      userId,
      action: 'cognition_memory.archive',
      resourceType: 'ue_cognition_memory',
      resourceId: entryId,
      details: {},
    });
    return true;
  });
}

/** Load a single cognition memory entry. */
export async function getCognitionMemoryEntry(
  orgId: string,
  entryId: string,
): Promise<CognitionMemoryEntry | null> {
  if (!isUuid(entryId)) return null;
  const rows = await inOrganization(orgId, (tx) =>
    tx.execute(sql`
      SELECT * FROM ue_cognition_memory
      WHERE id = ${entryId} AND organization_id = ${orgId}
      LIMIT 1
    `),
  );
  const result = rows as any as Record<string, unknown>[];
  if (result.length === 0) return null;
  return rowToEntry(result[0]);
}