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

  it('audits with HIGH severity when alerts are emitted', async () => {
    const { POST } = await loadRoute();
    m.runRealtimeObservabilitySweep.mockResolvedValueOnce({ emitted: 3, byKind: { sla: 2, queue: 1 } });

    const result = await POST();

    expect(result).toMatchObject({ emitted: 3, byKind: { sla: 2, queue: 1 } });
    expect(typeof result.timestamp).toBe('string');
    expect(m.auditLog).toHaveBeenCalledWith(expect.objectContaining({ severity: 'HIGH' }));
  });

  it('audits with LOW severity when nothing is emitted', async () => {
    const { POST } = await loadRoute();
    m.runRealtimeObservabilitySweep.mockResolvedValueOnce({ emitted: 0, byKind: {} });

    const result = await POST();

    expect(result).toMatchObject({ emitted: 0, byKind: {} });
    expect(m.auditLog).toHaveBeenCalledWith(expect.objectContaining({ severity: 'LOW' }));
  });
});