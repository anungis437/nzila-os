import { describe, expect, it, vi } from 'vitest';

const delegatedPayloads: unknown[] = [];

const delegatePostMock = vi.fn(async (request: Request) => {
  const payload = await request.json();
  delegatedPayloads.push(payload);
  return new Response(JSON.stringify({ ok: true, payload }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});

vi.mock('../ocra/submit/route', () => ({
  POST: delegatePostMock,
}));

describe('oci/assessment route boundary', () => {
  it('exports POST', async () => {
    const { POST } = await import('../oci/assessment/route');
    expect(typeof POST).toBe('function');
  });

  it('forwards smallest and most complex org contexts unchanged to OCRA submit', async () => {
    delegatedPayloads.length = 0;
    const { POST } = await import('../oci/assessment/route');

    const smallestPayload = {
      ctx_org_type: 'local_union',
      ctx_sector: 'public_sector',
      ctx_membership_size: 'under_100',
      ctx_years_operating: 'under_5',
      ctx_respondent_role: 'self_senior_leader',
      answers: [],
    };

    const mostComplexPayload = {
      ctx_org_type: 'federation',
      ctx_sector: 'public_sector',
      ctx_membership_size: '50000_plus',
      ctx_years_operating: '30_plus',
      ctx_respondent_role: 'self_senior_leader',
      federationAffiliation: 'present',
      answers: [],
    };

    const smallestRequest = new Request('https://example.test/api/oci/assessment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(smallestPayload),
    });

    const mostComplexRequest = new Request('https://example.test/api/oci/assessment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mostComplexPayload),
    });

    const smallestResponse = await POST(smallestRequest);
    const mostComplexResponse = await POST(mostComplexRequest);

    expect(smallestResponse.status).toBe(200);
    expect(mostComplexResponse.status).toBe(200);
    expect(delegatePostMock).toHaveBeenCalledTimes(2);
    expect(delegatedPayloads[0]).toEqual(smallestPayload);
    expect(delegatedPayloads[1]).toEqual(mostComplexPayload);
  });
});
