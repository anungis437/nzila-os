import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { declaredOptions } from './with-api-double';
import { ErrorCode as ApiErrorCode } from '@/lib/api/errors';

const m = vi.hoisted(() => ({
  requireEntitlement: vi.fn(),
  getAllocationRules: vi.fn(),
  createAllocationRule: vi.fn(),
}));

vi.mock('@/lib/api/framework', async () => (await import('./with-api-double')).frameworkDouble);

vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: m.requireEntitlement,
}));

vi.mock('@/services/platform-economics', () => ({
  getAllocationRules: m.getAllocationRules,
  createAllocationRule: m.createAllocationRule,
}));

vi.mock('@/lib/api/standardized-responses', async () => (await import('./standard-responses-double')).standardResponsesDouble());

async function loadRoute() {
  return import('../finance/allocation/route');
}

async function expectRefused(response: Response) {
  expect(response.status).toBe(501);
  expect(await response.json()).toMatchObject({ code: ApiErrorCode.NOT_IMPLEMENTED, message: 'Finance and dues persistence are not available in this release.' });
}
const ctx = { organizationId: 'org_1', userId: 'u1' };

describe('finance/allocation route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireEntitlement.mockResolvedValue(undefined);
    m.getAllocationRules.mockResolvedValue([{ id: 'rule_1' }]);
    m.createAllocationRule.mockResolvedValue({ id: 'rule_new' });
  });

  describe('what the route asks of the wrapper', () => {
    it('lists rules for a secretary-treasurer; no entitlement or tenant transaction is declared because the base release refuses first', async () => {
      const { GET } = await loadRoute();
      expect(declaredOptions(GET)).toMatchObject({
        auth: { minRole: 'secretary_treasurer' },
        rlsOrgContext: false,
        registry: { audience: 'officer', evidenceRequired: true },
      });
      expect(declaredOptions(GET)).not.toHaveProperty('entitlement');
    });

    it('creates rules only for an administrator; no entitlement or tenant transaction is declared because the base release refuses first', async () => {
      const { POST } = await loadRoute();
      expect(declaredOptions(POST)).toMatchObject({
        auth: { minRole: 'admin' },
        rlsOrgContext: false,
        registry: { audience: 'admin', evidenceRequired: true },
      });
      expect(declaredOptions(POST)).not.toHaveProperty('entitlement');
    });
  });

  it('GET is refused as not implemented, consulting no entitlement and reading no rules', async () => {
    const { GET } = await loadRoute();
    await expectRefused(await GET(new NextRequest('http://localhost/api/finance/allocation'), ctx));
    expect(m.requireEntitlement).not.toHaveBeenCalled();
    expect(m.getAllocationRules).not.toHaveBeenCalled();
  });

  it('POST returns validation error for invalid JSON', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/finance/allocation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'bad-json',
      }),
      ctx,
    );
    expect(response.status).toBe(400);
  });

  it('POST returns validation error for invalid payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/finance/allocation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '', method: 'unknown' }),
      }),
      ctx,
    );
    expect(response.status).toBe(400);
    expect(m.createAllocationRule).not.toHaveBeenCalled();
  });

  it('POST with a valid body is refused as not implemented and creates no rule', async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      new NextRequest('http://localhost/api/finance/allocation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Weighted Rule',
          costType: 'dues',
          method: 'weighted_hybrid',
          parameters: { memberWeight: 0.8 },
          effectiveFrom: '2026-07-01T00:00:00.000Z',
          organizationId: 'org_other',
          createdBy: 'someone-else',
        }),
      }),
      ctx,
    );
    await expectRefused(response);
    expect(m.requireEntitlement).not.toHaveBeenCalled();
    expect(m.createAllocationRule).not.toHaveBeenCalled();
  });
});
