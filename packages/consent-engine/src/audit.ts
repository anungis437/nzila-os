import type { AuditEvent } from './types.js'

export function createAuditEvent(params: Omit<AuditEvent, 'timestamp'>): AuditEvent {
  return {
    ...params,
    timestamp: new Date().toISOString(),
  }
}

export function formatAuditLog(event: AuditEvent): string {
  return JSON.stringify(event)
}
