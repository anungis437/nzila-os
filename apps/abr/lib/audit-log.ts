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

export function logAuditEvent(event: AbrAuditEvent): string {
  const auditId = `abr_audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  logger.info('ABR audit event', {
    auditId,
    ...event,
    timestamp: new Date().toISOString(),
  });

  return auditId;
}
