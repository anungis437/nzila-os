import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const upsertContact = vi.fn();
const createDeal = vi.fn();
const logEngagementNote = vi.fn();

vi.mock('@nzila/crm-hubspot', () => ({
  HubSpotClient: class {
    upsertContact = upsertContact;
    createDeal = createDeal;
    logEngagementNote = logEngagementNote;
  },
}));
vi.mock('@nzila/os-core/telemetry', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock('@nzila/os-core/rateLimit', () => ({
  checkRateLimit: () => ({ allowed: true }),
}));
vi.mock('@/lib/api-guards', () => ({
  withRequestContext: (_request: unknown, handler: () => Promise<Response>) => handler(),
}));

const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));

async function post(body: Record<string, unknown>) {
  const { POST } = await import('../app/api/contact/route');
  const request = new NextRequest('http://localhost/api/contact', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
    body: JSON.stringify(body),
  });
  return POST(request);
}

describe('POST /api/contact routing', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('HUBSPOT_API_KEY', 'test-key');
    vi.stubEnv('SALES_SIGNAL_WEBHOOK_URL', 'https://signals.example.test/hook');
    vi.stubEnv('ORCHESTRATOR_API_KEY', 'orchestrator-test-key');
    vi.stubGlobal('fetch', fetchMock);
    upsertContact.mockReset().mockResolvedValue({ ok: true, id: 'contact-1' });
    createDeal.mockReset().mockResolvedValue({ ok: true, id: 'deal-1' });
    logEngagementNote.mockReset().mockResolvedValue({ ok: true, id: 'note-1' });
    fetchMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('keeps sales inquiries on the deal, sales signal and onboarding path', async () => {
    const response = await post({ name: 'Ada Lovelace', email: 'ada@example.org', company: 'Local 1', source: 'union_eyes_pilot', message: 'We would like a pilot.' });
    expect(response.status).toBe(200);
    expect(createDeal).toHaveBeenCalledTimes(1);
    expect(logEngagementNote).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stores careers interest as a contact note without a deal, sales signal or onboarding dispatch', async () => {
    const response = await post({ name: 'Grace Hopper', email: 'grace@example.org', source: 'careers_interest', message: 'I build governed systems.' });
    expect(response.status).toBe(200);
    expect(upsertContact).toHaveBeenCalledTimes(1);
    expect(logEngagementNote).toHaveBeenCalledWith(expect.objectContaining({ contactId: 'contact-1', body: expect.stringContaining('I build governed systems.') }));
    expect(createDeal).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when the careers note cannot be stored', async () => {
    logEngagementNote.mockResolvedValue({ ok: false, error: 'hubspot down' });
    const response = await post({ name: 'Grace Hopper', email: 'grace@example.org', source: 'careers_interest' });
    expect(response.status).toBe(502);
    expect(createDeal).not.toHaveBeenCalled();
  });
});
