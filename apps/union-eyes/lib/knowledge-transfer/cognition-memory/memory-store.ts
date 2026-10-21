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
import { inOrganization, isUuid } from '../org-scope';
import {
  type CognitionMemoryEntry,
  type CognitionMemoryStore,
  type SaveMemoryInput,
  type MemoryStatus,
  type ResilienceSnapshotPoint,
} from './memory-models';

function rowToEntry(row: Record<string, unknown>): CognitionMemoryEntry {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    memoryType: row.memory_type as CognitionMemoryEntry['memoryType'],
    title: row.title as string,
    contextSummary: (row.context_summary as string) ?? '',
    payload: (row.payload as Record<string, unknown>) ?? {},
    resilienceScoreAtCapture: (row.resilience_score_at_capture as number | null) ?? null,
    tags: (row.tags as string[]) ?? [],
    keyInsights: (row.key_insights as string[]) ?? [],
    sessionId: (row.session_id as string | null) ?? null,
    status: (row.status as MemoryStatus) ?? 'active',
    createdAt: (row.created_at as Date)?.toISOString?.() ?? (row.created_at as string),
    updatedAt: (row.updated_at as Date)?.toISOString?.() ?? (row.updated_at as string),
  };
}

/** Save a new cognition memory entry for an organization. */
export async function saveCognitionMemory(
  orgId: string,
  input: SaveMemoryInput,
): Promise<CognitionMemoryEntry> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await inOrganization(orgId, (tx) =>
    tx.execute(sql`
      INSERT INTO ue_cognition_memory
        (id, organization_id, memory_type, title, context_summary, payload,
         resilience_score_at_capture, tags, key_insights, session_id, status, created_at, updated_at)
      VALUES (
        ${id},
        ${orgId},
        ${input.memoryType},
        ${input.title},
        ${input.contextSummary ?? ''},
        ${JSON.stringify(input.payload ?? {})}::jsonb,
        ${input.resilienceScoreAtCapture ?? null},
        ${JSON.stringify(input.tags ?? [])}::jsonb,
        ${JSON.stringify(input.keyInsights ?? [])}::jsonb,
        ${input.sessionId ?? null},
        'active',
        ${now}::timestamptz,
        ${now}::timestamptz
      )
    `),
  );
  return {
    id,
    organizationId: orgId,
    memoryType: input.memoryType,
    title: input.title,
    contextSummary: input.contextSummary ?? '',
    payload: input.payload ?? {},
    resilienceScoreAtCapture: input.resilienceScoreAtCapture ?? null,
    tags: input.tags ?? [],
    keyInsights: input.keyInsights ?? [],
    sessionId: input.sessionId ?? null,
    status: 'active',
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
    changeFromPrevious: idx === 0 ? null : e.resilienceScoreAtCapture! - withScores[idx - 1].resilienceScoreAtCapture!,
  }));

  return {
    organizationId: orgId,
    entries,
    resilienceTimeline,
    totalEntries: entries.length,
  };
}

/** Archive a cognition memory entry. A malformed id matches nothing. */
export async function archiveCognitionMemory(orgId: string, entryId: string): Promise<void> {
  if (!isUuid(entryId)) return;
  await inOrganization(orgId, (tx) =>
    tx.execute(sql`
      UPDATE ue_cognition_memory
      SET status = 'archived', updated_at = now()
      WHERE id = ${entryId} AND organization_id = ${orgId}
    `),
  );
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