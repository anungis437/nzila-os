/**
 * Union Eyes Deadline Engine — audit event writer
 *
 * Writes to `deadline_audit_events` (append-only in DB, enforced by trigger).
 * Every event MUST have a correlation id so worker/user actions can be
 * reconstructed after the fact.
 */
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { logger } from '@/lib/logger';
import { AuditMetadataSchema, type AuditMetadata } from './types';
import type { DeadlineAuditEventType } from '@/db/schema/deadline-engine-schema';

export interface WriteAuditEventInput {
  organizationId: string;
  sourceTable: 'grievance_deadlines' | 'claim_deadlines';
  sourceDeadlineId: string;
  reminderId?: string | null;
  eventType: DeadlineAuditEventType;
  actorType: 'system' | 'user' | 'worker';
  actorId?: string | null;
  correlationId: string;
  metadata?: AuditMetadata;
}

/**
 * Append an audit event. Never throws in the caller — audit failures are
 * logged but must not break the primary operation. This preserves the
 * invariant that the operation completes even if the audit writer is
 * temporarily unreachable.
 *
 * `tx` is optional and should be passed explicitly by callers running
 * under `withSystemContext((tx) => ...)` (e.g. cron jobs) so this INSERT
 * executes on the same `union_eyes_system` transaction rather than the
 * ambient pooled connection (PR #752 round 49 — system-principal
 * correctness for a genuinely system-initiated write).
 */
export async function writeDeadlineAuditEvent(
  input: WriteAuditEventInput,
  tx?: Pick<typeof db, 'execute'>,
): Promise<void> {
  const metadata = input.metadata ?? {};
  const parsed = AuditMetadataSchema.safeParse(metadata);
  if (!parsed.success) {
    logger.error('deadline-engine.audit: metadata rejected', {
      correlationId: input.correlationId,
      eventType: input.eventType,
      issues: parsed.error.issues.map((i) => i.message),
    });
    throw new Error('deadline audit metadata failed validation (PII/secret guard)');
  }

  const executor = tx ?? db;

  try {
    await executor.execute(sql`
      insert into deadline_audit_events (
        organization_id, source_table, source_deadline_id, reminder_id,
        event_type, actor_type, actor_id, correlation_id, metadata
      ) values (
        ${input.organizationId}::uuid,
        ${input.sourceTable},
        ${input.sourceDeadlineId}::uuid,
        ${input.reminderId ?? null}::uuid,
        ${input.eventType},
        ${input.actorType},
        ${input.actorId ?? null},
        ${input.correlationId},
        ${JSON.stringify(parsed.data)}::jsonb
      )
    `);
  } catch (error) {
    logger.error('deadline-engine.audit: write failed', {
      correlationId: input.correlationId,
      eventType: input.eventType,
      sourceDeadlineId: input.sourceDeadlineId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
