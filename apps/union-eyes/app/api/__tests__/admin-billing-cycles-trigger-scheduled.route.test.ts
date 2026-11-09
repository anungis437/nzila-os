import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';

const m = vi.hoisted(() => ({ run: vi.fn(), job: vi.fn() }));
vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);
vi.mock('@/lib/audit/operation-audit', () => ({ performAuditedOperation: m.run, operationAuditResponse: vi.fn() }));
vi.mock('@/lib/jobs/billing-scheduler', () => ({ BillingScheduler: { manualTrigger: m.job } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

const request = () => new NextRequest('http://localhost/api/admin/billing-cycles/trigger-scheduled', { method: 'POST', body: JSON.stringify({ frequency: 'weekly' }) });
const context = { userId: 'platform-admin', organizationId: 'org-1', role: 'platform_lead' };

describe('admin/billing-cycles/trigger-scheduled route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('refuses the global job before parsing or executing it when no scoped mandate exists', async () => {
    const { POST } = await import('../admin/billing-cycles/trigger-scheduled/route');
    expect(declaredOptions(POST).auth).toEqual({ minRole: 'platform_lead' });
    const response = await POST(request(), context);
    expect(response.status).toBe(501);
    expect((await response.json()).message).toContain('resource-scoped financial authorization instrument');
    expect(m.run).not.toHaveBeenCalled();
    expect(m.job).not.toHaveBeenCalled();
  });
});
