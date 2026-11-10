import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';

const m = vi.hoisted(() => ({ run: vi.fn(), job: vi.fn() }));
vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);
vi.mock('@/lib/audit/operation-audit', () => ({ performAuditedOperation: m.run }));
vi.mock('@/lib/jobs/dues-reminder-scheduler', () => ({ manualTriggerReminders: m.job }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }));

const request = () => new NextRequest('http://localhost/api/admin/dues/send-reminders', { method: 'POST' });
const context = { userId: 'platform-admin', organizationId: 'org-1', role: 'platform_lead' };

describe('admin/dues/send-reminders route', () => {
  beforeEach(() => vi.clearAllMocks());

  it('keeps the authenticated role floor but grants no cross-tenant mutation authority', async () => {
    const { POST } = await import('../admin/dues/send-reminders/route');
    expect(declaredOptions(POST).auth).toEqual({ minRole: 'platform_lead' });
    const response = await POST(request(), context);
    expect(response.status).toBe(501);
    expect((await response.json()).message).toContain('resource-scoped financial authorization instrument');
    expect(m.run).not.toHaveBeenCalled();
    expect(m.job).not.toHaveBeenCalled();
  });
});
