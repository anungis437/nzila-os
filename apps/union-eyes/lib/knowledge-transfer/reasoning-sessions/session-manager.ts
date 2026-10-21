/**
 * Reasoning Session Manager
 *
 * Creates and manages longitudinal organizational continuity reasoning sessions.
 * Sessions persist graph state, simulations, annotations, and conversation context.
 *
 * Uses the ue_reasoning_sessions table. The relation is created by platform
 * migration 0012 and protected by FORCE RLS (scoped 0018); this module never
 * issues DDL and every statement runs on the tenant runtime identity.
 */

import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { inOrganization, isUuid } from '../org-scope';
import {
  type ReasoningSession,
  type CreateSessionInput,
  type UpdateSessionInput,
  type SessionAnnotation,
  type SessionSimulationRef,
  type SessionStatus,
} from './session-models';

function rowToSession(row: Record<string, unknown>): ReasoningSession {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
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
  const id = randomUUID();
  const now = new Date().toISOString();
  await inOrganization(orgId, (tx) =>
    tx.execute(sql`
      INSERT INTO ue_reasoning_sessions
        (id, organization_id, title, focus, context_description, created_at, updated_at)
      VALUES (
        ${id}, ${orgId}, ${input.title}, ${input.focus ?? 'general_continuity'},
        ${input.contextDescription ?? ''}, ${now}::timestamptz, ${now}::timestamptz
      )
    `),
  );
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
  const rows = await inOrganization(orgId, (tx) =>
    tx.execute(sql`
      SELECT * FROM ue_reasoning_sessions
      WHERE organization_id = ${orgId}
        ${options.status ? sql`AND status = ${options.status}` : sql``}
      ORDER BY updated_at DESC
      LIMIT ${options.limit ?? 20}
    `),
  );
  return (rows as any as Record<string, unknown>[]).map(rowToSession);
}

/** Get a single reasoning session. */
export async function getReasoningSession(
  orgId: string,
  sessionId: string,
): Promise<ReasoningSession | null> {
  if (!isUuid(sessionId)) return null;
  const rows = await inOrganization(orgId, (tx) =>
    tx.execute(sql`
      SELECT * FROM ue_reasoning_sessions
      WHERE id = ${sessionId} AND organization_id = ${orgId}
      LIMIT 1
    `),
  );
  const result = rows as any as Record<string, unknown>[];
  if (result.length === 0) return null;
  return rowToSession(result[0]);
}

/** Update session metadata and state. A malformed id matches nothing. */
export async function updateReasoningSession(
  orgId: string,
  sessionId: string,
  input: UpdateSessionInput,
): Promise<void> {
  if (!isUuid(sessionId)) return;
  const now = new Date().toISOString();
  const graphState = input.graphState !== undefined ? JSON.stringify(input.graphState) : null;
  await inOrganization(orgId, (tx) =>
    tx.execute(sql`
      UPDATE ue_reasoning_sessions SET
        title = COALESCE(${input.title ?? null}, title),
        context_description = COALESCE(${input.contextDescription ?? null}, context_description),
        graph_state = COALESCE(${graphState}::text::jsonb, graph_state),
        status = COALESCE(${input.status ?? null}, status),
        latest_resilience_score = COALESCE(${input.latestResilienceScore ?? null}, latest_resilience_score),
        updated_at = ${now}::timestamptz
      WHERE id = ${sessionId} AND organization_id = ${orgId}
    `),
  );
}

/** Add an annotation to a session. */
export async function addSessionAnnotation(
  orgId: string,
  sessionId: string,
  text: string,
  targetRef: string | null = null,
): Promise<SessionAnnotation> {
  const annotation: SessionAnnotation = {
    id: randomUUID(),
    text,
    createdAt: new Date().toISOString(),
    targetRef,
  };
  if (!isUuid(sessionId)) return annotation;
  await inOrganization(orgId, (tx) =>
    tx.execute(sql`
      UPDATE ue_reasoning_sessions
      SET annotations = annotations || ${JSON.stringify([annotation])}::jsonb,
          updated_at = now()
      WHERE id = ${sessionId} AND organization_id = ${orgId}
    `),
  );
  return annotation;
}

/** Link a cognition memory entry to a session. */
export async function linkMemoryToSession(
  orgId: string,
  sessionId: string,
  memoryEntryId: string,
): Promise<void> {
  if (!isUuid(sessionId)) return;
  await inOrganization(orgId, (tx) =>
    tx.execute(sql`
      UPDATE ue_reasoning_sessions
      SET linked_memory_ids = linked_memory_ids || ${JSON.stringify([memoryEntryId])}::jsonb,
          updated_at = now()
      WHERE id = ${sessionId} AND organization_id = ${orgId}
    `),
  );
}

/** Add a simulation reference to a session. */
export async function addSessionSimulation(
  orgId: string,
  sessionId: string,
  sim: SessionSimulationRef,
): Promise<void> {
  if (!isUuid(sessionId)) return;
  await inOrganization(orgId, (tx) =>
    tx.execute(sql`
      UPDATE ue_reasoning_sessions
      SET active_simulations = active_simulations || ${JSON.stringify([sim])}::jsonb,
          updated_at = now()
      WHERE id = ${sessionId} AND organization_id = ${orgId}
    `),
  );
}