import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// DEF-0B6-SYS-CONTACT-ACKNOWLEDGES-SUBMISSION-WITH-NOTHING-STORED: a visitor is told the message was received only when
// the CRM actually recorded it.
const m = vi.hoisted(() => ({ upsertContact: vi.fn(), createDeal: vi.fn(), guard: vi.fn() }));

vi.mock('@/lib/services/crm-service', () => ({ upsertContact: m.upsertContact, createDeal: m.createDeal }));
vi.mock('@/lib/public-intake/guard', () => ({ guardPublicIntake: m.guard }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const body = { firstName: 'Sam', email: 'sam@example.test', message: 'Hello' };
const post = async () => (await import('../contact/route')).POST(new NextRequest('http://localhost/api/contact', { method: 'POST' }));

describe('contact route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.guard.mockResolvedValue({ ok: true, json: body });
  });

  it('acknowledges a submission the CRM recorded', async () => {
    m.upsertContact.mockResolvedValue('contact-1');
    m.createDeal.mockResolvedValue('deal-1');

    const response = await post();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('answers 503, not ok, when the CRM is unconfigured or the contact was not stored', async () => {
    m.upsertContact.mockResolvedValue(null);

    const response = await post();

    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty('ok');
    expect(m.createDeal).not.toHaveBeenCalled();
  });

  it('answers 503 when the contact was stored but the message could not be', async () => {
    m.upsertContact.mockResolvedValue('contact-1');
    m.createDeal.mockResolvedValue(null);

    const response = await post();

    expect(response.status).toBe(503);
  });

  it('refuses an invalid submission with 400 before contacting the CRM', async () => {
    m.guard.mockResolvedValue({ ok: true, json: { firstName: '', email: 'not-an-email' } });

    const response = await post();

    expect(response.status).toBe(400);
    expect(m.upsertContact).not.toHaveBeenCalled();
  });
});
