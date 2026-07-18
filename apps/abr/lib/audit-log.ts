import { createHash } from 'node:crypto';

import { sql } from 'drizzle-orm';

import { platformDb } from '@nzila/db/platform';
import { createLogger } from '@nzila/os-core';

const logger = createLogger('abr-audit');

export interface AbrAuditEvent {
  action: string;
  actorUserId: string;
  orgId: string;
  entityType: string;
  recordId?: string;
  details?: Record<string, unknown>;
}

type AuditWriter = (event: AbrAuditEvent) => Promise<{ id: string; hash: string; previousHash: string | null }>;

let auditWriterOverride: AuditWriter | null = null;
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const defaultAuditWriter: AuditWriter = async (event) => {
  const previousRows = await platformDb.execute(sql`
    select hash
    from audit_events
    where org_id = ${event.orgId}
    order by created_at desc
    limit 1
  `);
  const previousHash = (previousRows[0] as { hash?: string } | undefined)?.hash ?? null;

  const payload = {
    orgId: event.orgId,
    actorClerkUserId: event.actorUserId,
    action: event.action,
    targetType: event.entityType,
    targetId: event.recordId && isUuid(event.recordId) ? event.recordId : null,
    afterJson: event.details ?? null,
    timestamp: new Date().toISOString(),
  };
  const hash = createHash('sha256').update(JSON.stringify({ payload, previousHash })).digest('hex');

  const inserted = await platformDb.execute(sql`
    insert into audit_events (
      org_id,
      actor_clerk_user_id,
      actor_role,
      action,
      target_type,
      target_id,
      after_json,
      hash,
      previous_hash
    ) values (
      ${event.orgId},
      ${event.actorUserId},
      ${null},
      ${event.action},
      ${event.entityType},
      ${event.recordId && isUuid(event.recordId) ? event.recordId : null}::uuid,
      ${event.details ? JSON.stringify(event.details) : null}::jsonb,
      ${hash},
      ${previousHash}
    ) returning id, hash, previous_hash
  `);

  const row = inserted[0] as { id?: string; hash?: string; previous_hash?: string | null } | undefined;
  if (!row?.id || !row.hash) {
    throw new Error('Audit persistence returned no row');
  }

  return { id: row.id, hash: row.hash, previousHash: row.previous_hash ?? previousHash };
};

export function setAuditLogWriter(writer: AuditWriter | null): void {
  auditWriterOverride = writer;
}

async function persistAuditEvent(event: AbrAuditEvent): Promise<{ id: string; hash: string; previousHash: string | null }> {
  return (auditWriterOverride ?? defaultAuditWriter)(event);
}

export async function logAuditEvent(event: AbrAuditEvent): Promise<string> {
  const auditId = `abr_audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const result = await persistAuditEvent(event);
  logger.info('ABR audit event', {
    auditId,
    ...event,
    persistedId: result.id,
    hash: result.hash.slice(0, 12) + '…',
    timestamp: new Date().toISOString(),
  });

  return auditId;
}
