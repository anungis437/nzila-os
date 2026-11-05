import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api-auth-guard', () => ({
  withApiAuth: (handler: (req: NextRequest) => Promise<Response>) => handler,
}));

async function loadRoute() {
  return import('../emergency/pipeda/route');
}

function post(body: unknown) {
  return new NextRequest('http://localhost/api/emergency/pipeda', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const MEMBER = '11111111-1111-1111-1111-111111111111';

describe('emergency/pipeda route — legal-rule correctness (Governance Officer 2.1 P0-E)', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ['one highly sensitive record, QC', { estimatedAffectedCount: 1, province: 'QC' }],
    ['large count, federal', { estimatedAffectedCount: 5000, province: 'FEDERAL' }],
    ['count exactly at the former QC threshold', { estimatedAffectedCount: 10, province: 'QC' }],
    ['count exactly at the former default threshold', { estimatedAffectedCount: 25, province: 'ON' }],
  ])('never converts affected-person count into a notification decision (%s)', async (_name, extra) => {
    const { POST } = await loadRoute();
    const res = await POST(post({
      memberId: MEMBER,
      breachDate: '2026-10-01T00:00:00.000Z',
      affectedDataTypes: ['medical'],
      ...extra,
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.disposition).toBe('LEGAL_REVIEW_REQUIRED');
    expect(json.legalDetermination).toBe('NOT_MADE');
    expect(json.requiresBreachReport).toBeNull();
    expect(json.notificationRequired).toBeNull();
    expect(json.reportDeadline).toBeNull();
    expect(json.reportingChannels).toEqual([]);
    expect(json.notificationDispatched).toBe(false);
    expect(json.reportedFacts.jurisdictionVerified).toBe(false);
  });

  it('accepts a report without a count and without a breach date', async () => {
    const { POST } = await loadRoute();
    const res = await POST(post({ memberId: MEMBER }));
    expect(res.status).toBe(200);
    expect((await res.json()).reportedFacts.estimatedAffectedCount).toBeNull();
  });

  it('rejects an invalid payload without making any determination', async () => {
    const { POST } = await loadRoute();
    const res = await POST(post({ memberId: 'not-a-uuid' }));
    expect(res.status).toBe(400);
  });

  it('GET reports review-required, never a fabricated 72h deadline', async () => {
    const { GET } = await loadRoute();
    const res = await GET(new NextRequest('http://localhost/api/emergency/pipeda?breachId=b1&province=QC'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.disposition).toBe('LEGAL_REVIEW_REQUIRED');
    expect(json.reportDeadline).toBeNull();
    expect(json.requiresBreachReport).toBeNull();
  });
});
