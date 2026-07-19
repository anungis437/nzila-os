/**
 * Reasoning Session Manager
 *
 * Creates and manages longitudinal organizational continuity reasoning sessions.
 * Sessions persist graph state, simulations, annotations, and conversation context.
 */

import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {
  type ReasoningSession,
  type CreateSessionInput,
  type UpdateSessionInput,
  type SessionAnnotation,
  type SessionSimulationRef,
  type SessionStatus,
} from './session-models';

async function ensureTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ue_reasoning_sessions (
      id                    TEXT PRIMARY KEY,
      org_id                TEXT NOT NULL,
      title                 TEXT NOT NULL,
      focus                 TEXT NOT NULL DEFAULT 'general_continuity',
      status                TEXT NOT NULL DEFAULT 'active',
      context_description   TEXT NOT NULL DEFAULT '',
      graph_state           JSONB,
      active_simulations    JSONB NOT NULL DEFAULT '[]',
      annotations           JSONB NOT NULL DEFAULT '[]',
      linked_message_ids    JSONB NOT NULL DEFAULT '[]',
      linked_memory_ids     JSONB NOT NULL DEFAULT '[]',
      latest_resilience_score INTEGER,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ue_reasoning_sessions_org_idx
    ON ue_reasoning_sessions (org_id, created_at DESC)
  `);
}

function rowToSession(row: Record<string, unknown>): ReasoningSession {
  return {
    id: row.id as string,
    organizationId: row.org_id as string,
    title: row.title as string,
    focus: row.focus as ReasoningSession['focus'],
    status: row.status as SessionStatus,
    contextDescription: (row.context_description as string) ?? '',
    graphState: (row.graph_state as ReasoningSession['graphState']) ?? null,
    activeSimulations: (row.active_simulations as SessionSimulationRef[]) ?? [],
    annotations: (row.annotations as SessionAnnotation[]) ?? [],
    linkedMessageIds: (row.linked_message_ids as string[]) ?? [],
    linkedMemoryEntryIds: (row.linked_memory_ids as string[]) ?? [],
    latestResilienceScore: (row.latest_resilience_score as number | null) ?? null,
    createdAt: (row.created_at as Date)?.toISOString?.() ?? (row.created_at as string),
    updatedAt: (row.updated_at as Date)?.toISOString?.() ?? (row.updated_at as string),
  };
}

/** Create a new reasoning session for an organization. */
export async function createReasoningSession(
  orgId: string,
  input: CreateSessionInput,
): Promise<ReasoningSession> {
  await ensureTable();
  const id = randomUUID();
  const now = new Date().toISOString();
  await db.execute(sql`
    INSERT INTO ue_reasoning_sessions
      (id, org_id, title, focus, context_description, created_at, updated_at)
    VALUES (
      ${id}, ${orgId}, ${input.title}, ${input.focus ?? 'general_continuity'},
      ${input.contextDescription ?? ''}, ${now}::timestamptz, ${now}::timestamptz
    )
  `);
  return {
    id,
    organizationId: orgId,
    title: input.title,
    focus: input.focus ?? 'general_continuity',
    status: 'active',
    contextDescription: input.contextDescription ?? '',
    graphState: null,
    activeSimulations: [],
    annotations: [],
    linkedMessageIds: [],
    linkedMemoryEntryIds: [],
    latestResilienceScore: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** List reasoning sessions for an organization. */
export async function listReasoningSessions(
  orgId: string,
  options: { status?: SessionStatus; limit?: number } = {},
): Promise<ReasoningSession[]> {
  await ensureTable();
  const rows = await db.execute(sql`
    SELECT * FROM ue_reasoning_sessions
    WHERE org_id = ${orgId}
      ${options.status ? sql`AND status = ${options.status}` : sql``}
    ORDER BY updated_at DESC
    LIMIT ${options.limit ?? 20}
  `);
  return (rows as any as Record<string, unknown>[]).map(rowToSession);
}

/** Get a single reasoning session. */
export async function getReasoningSession(
  orgId: string,
  sessionId: string,
): Promise<ReasoningSession | null> {
  await ensureTable();
  const rows = await db.execute(sql`
    SELECT * FROM ue_reasoning_sessions
    WHERE id = ${sessionId} AND org_id = ${orgId}
    LIMIT 1
  `);
  const result = rows as any as Record<string, unknown>[];
  if (result.length === 0) return null;
  return rowToSession(result[0]);
}

/** Update session metadata and state. */
export async function updateReasoningSession(
  orgId: string,
  sessionId: string,
  input: UpdateSessionInput,
): Promise<void> {
  await ensureTable();
  const now = new Date().toISOString();
  await db.execute(sql`
    UPDATE ue_reasoning_sessions SET
      title = COALESCE(${input.title ?? null}, title),
      context_description = COALESCE(${input.contextDescription ?? null}, context_description),
      graph_state = COALESCE(${input.graphState !== undefined ? JSON.stringify(input.graphState) + '::jsonb' : null}::text::jsonb, graph_state),
      status = COALESCE(${input.status ?? null}, status),
      latest_resilience_score = COALESCE(${input.latestResilienceScore ?? null}, latest_resilience_score),
      updated_at = ${now}::timestamptz
    WHERE id = ${sessionId} AND org_id = ${orgId}
  `);
}

/** Add an annotation to a session. */
export async function addSessionAnnotation(
  orgId: string,
  sessionId: string,
  text: string,
  targetRef: string | null = null,
): Promise<SessionAnnotation> {
  await ensureTable();
  const annotation: SessionAnnotation = {
    id: randomUUID(),
    text,
    createdAt: new Date().toISOString(),
    targetRef,
  };
  await db.execute(sql`
    UPDATE ue_reasoning_sessions
    SET annotations = annotations || ${JSON.stringify([annotation])}::jsonb,
        updated_at = now()
    WHERE id = ${sessionId} AND org_id = ${orgId}
  `);
  return annotation;
}

/** Link a cognition memory entry to a session. */
export async function linkMemoryToSession(
  orgId: string,
  sessionId: string,
  memoryEntryId: string,
): Promise<void> {
  await ensureTable();
  await db.execute(sql`
    UPDATE ue_reasoning_sessions
    SET linked_memory_ids = linked_memory_ids || ${JSON.stringify([memoryEntryId])}::jsonb,
        updated_at = now()
    WHERE id = ${sessionId} AND org_id = ${orgId}
  `);
}

/** Add a simulation reference to a session. */
export async function addSessionSimulation(
  orgId: string,
  sessionId: string,
  sim: SessionSimulationRef,
): Promise<void> {
  await ensureTable();
  await db.execute(sql`
    UPDATE ue_reasoning_sessions
    SET active_simulations = active_simulations || ${JSON.stringify([sim])}::jsonb,
        updated_at = now()
    WHERE id = ${sessionId} AND org_id = ${orgId}
  `);
}
