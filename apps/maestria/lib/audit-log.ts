export interface AuditEvent {
  id: string
  actorId: string
  actorName: string
  actorRole: string
  action: string
  resource: string
  result: 'allow' | 'deny'
  note: string
  at: string
}

const auditEvents: AuditEvent[] = [
  {
    id: 'evt-001',
    actorId: 'owner-lissa',
    actorName: 'Lissa',
    actorRole: 'owner',
    action: 'approve.margin_exception',
    resource: 'quote:Q-4412',
    result: 'allow',
    note: 'Approved for strategic corporate retention account.',
    at: '2026-04-24T11:15:00Z',
  },
  {
    id: 'evt-002',
    actorId: 'staff-temp-1',
    actorName: 'Seasonal Temp',
    actorRole: 'seasonal_temp',
    action: 'export.download',
    resource: 'report:finance-monthly',
    result: 'deny',
    note: 'Permission denied by RBAC export policy.',
    at: '2026-04-24T11:41:00Z',
  },
]

export function recordAudit(event: Omit<AuditEvent, 'id' | 'at'>): AuditEvent {
  const item: AuditEvent = {
    ...event,
    id: `evt-${String(auditEvents.length + 1).padStart(3, '0')}`,
    at: new Date().toISOString(),
  }
  auditEvents.unshift(item)
  return item
}

export function listAuditEvents(limit = 20): AuditEvent[] {
  return auditEvents.slice(0, limit)
}
