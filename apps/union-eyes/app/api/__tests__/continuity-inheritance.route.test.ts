import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  delegateGet: vi.fn(async () => new Response(JSON.stringify({ success: true, method: 'GET' }))),
  delegatePost: vi.fn(async () => new Response(JSON.stringify({ success: true, method: 'POST' }))),
}));

vi.mock('../onboarding/route', () => ({
  dynamic: 'force-dynamic',
  GET: m.delegateGet,
  POST: m.delegatePost,
}));

describe('continuity inheritance route', () => {
  it('delegates to the governed onboarding route auth contract', async () => {
    const { GET, POST, dynamic } = await import('../continuity/inheritance/route');
    const context = { params: Promise.resolve({}) };

    const getRequest = new Request('http://localhost/api/continuity/inheritance');
    const postRequest = new Request('http://localhost/api/continuity/inheritance', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'org-seeded', completed: true }),
    });

    await GET(getRequest as never, context as never);
    await POST(postRequest as never, context as never);

    expect(dynamic).toBe('force-dynamic');
    expect(m.delegateGet).toHaveBeenCalledWith(getRequest, context);
    expect(m.delegatePost).toHaveBeenCalledWith(postRequest, context);
  });

  it('does not keep a local placeholder organization guard', () => {
    const source = readFileSync(
      resolve(__dirname, '../continuity/inheritance/route.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/function\s+requireOrgAccess/);
    expect(source).not.toMatch(/return\s+true\s*;/);
    expect(source).toContain("export { GET, POST, dynamic } from '../../onboarding/route'");
  });
});
