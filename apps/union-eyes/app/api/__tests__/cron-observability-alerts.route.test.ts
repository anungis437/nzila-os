import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  runRealtimeObservabilitySweep: vi.fn(),
  auditLog: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/services/observability/realtime-alerting-service', () => ({
  runRealtimeObservabilitySweep: m.runRealtimeObservabilitySweep,
}));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: m.auditLog,
  AuditEventType: { SYSTEM_SECURITY_ALERT: 'SYSTEM_SECURITY_ALERT' },
  AuditSeverity: { HIGH: 'HIGH', LOW: 'LOW' },
}));

async function loadRoute() {
  return import('../cron/observability-alerts/route');
}

describe('cron/observability-alerts route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: () => Promise<unknown>) => () => handler());
    m.auditLog.mockResolvedValue(undefined);
  });

  it('answers 200 and audits with HIGH severity when alerts are emitted', async () => {
    const { POST } = await loadRoute();
    m.runRealtimeObservabilitySweep.mockResolvedValueOnce({ emitted: 3, alreadyAlerted: 1, byKind: { sla: 2, queue: 1 }, failures: [] });

    const response = await POST() as Response;

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, emitted: 3, already_alerted: 1, byKind: { sla: 2, queue: 1 } });
    expect(m.auditLog).toHaveBeenCalledWith(expect.objectContaining({ severity: 'HIGH' }));
  });

  it('audits with LOW severity when nothing happened', async () => {
    const { POST } = await loadRoute();
    m.runRealtimeObservabilitySweep.mockResolvedValueOnce({ emitted: 0, alreadyAlerted: 0, byKind: {}, failures: [] });

    const response = await POST() as Response;

    expect(response.status).toBe(200);
    expect(m.auditLog).toHaveBeenCalledWith(expect.objectContaining({ severity: 'LOW' }));
  });

  it('answers 500 naming each signal that could not be delivered, keeping the counts of those that were', async () => {
    const { POST } = await loadRoute();
    m.runRealtimeObservabilitySweep.mockResolvedValueOnce({
      emitted: 1, alreadyAlerted: 0, byKind: { sla_breach_imminent: 1 },
      failures: [{ organizationId: 'org-1', kind: 'ingestion_failures', reason: 'no active administrator to notify' }],
    });

    const response = await POST() as Response;

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      success: false, emitted: 1, failed: 1, failures: [{ scope: 'org-1:ingestion_failures', reason: 'no active administrator to notify' }],
    });
  });
});
