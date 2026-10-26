import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api-auth-guard', () => ({
  withApiAuth: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));

const request = (path: string) =>
  new NextRequest(`http://localhost/api/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ organizationId: 'org_not_mine' }),
  });

describe('org/switch and tenant/switch are retired', () => {
  it.each(['org/switch', 'tenant/switch'])('%s answers 501 and switches nothing', async (path) => {
    const route = await import(`../${path}/route`);
    const response = await route.POST(request(path));

    expect(response.status).toBe(501);
    const json = await response.json();
    expect(json.error.code).toBe('NOT_IMPLEMENTED');
    expect(json.error.message).toContain('/api/organizations/switch');
    expect(JSON.stringify(json)).not.toContain('success');
  });
});
