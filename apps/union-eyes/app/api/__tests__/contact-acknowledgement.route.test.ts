import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// DEF-0B6-SYS-CONTACT-ACKNOWLEDGES-SUBMISSION-WITH-NOTHING-STORED: a visitor is told the message was received only once the local
// record exists. The CRM sync follows and its outcome is recorded; an unconfigured or failing CRM no longer loses the submission.
const m = vi.hoisted(() => ({
  upsertContact: vi.fn(),
  createDeal: vi.fn(),
  guard: vi.fn(),
  inserted: [] as Array<Record<string, unknown>>,
  updates: [] as Array<Record<string, unknown>>,
  failInsert: false,
}));

vi.mock('@/lib/services/crm-service', () => ({ upsertContact: m.upsertContact, createDeal: m.createDeal }));
vi.mock('@/lib/public-intake/guard', () => ({ guardPublicIntake: m.guard }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('drizzle-orm', async (importOriginal) => ({ ...(await importOriginal<typeof import('drizzle-orm')>()), eq: vi.fn(() => 'eq') }));
vi.mock('@/db/schema/domains/communications/contact-submissions', () => ({ contactSubmissions: { id: 'id' } }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      insert: () => ({
        values: (values: Record<string, unknown>) => ({
          returning: async () => {
            if (m.failInsert) throw new Error('database down');
            m.inserted.push(values);
            return [{ id: 'sub-1' }];
          },
        }),
      }),
      update: () => ({ set: (values: Record<string, unknown>) => ({ where: async () => { m.updates.push(values); } }) }),
    }),
}));

const body = { firstName: 'Sam', email: 'sam@example.test', message: 'Hello' };
const post = async () => (await import('../contact/route')).POST(new NextRequest('http://localhost/api/contact', { method: 'POST' }));

describe('contact route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.inserted.length = 0;
    m.updates.length = 0;
    m.failInsert = false;
    m.guard.mockResolvedValue({ ok: true, json: body });
  });

  it('stores the submission, syncs it to the CRM and marks it recorded', async () => {
    m.upsertContact.mockResolvedValue('contact-1');
    m.createDeal.mockResolvedValue('deal-1');

    const response = await post();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(m.inserted).toHaveLength(1);
    expect(m.inserted[0]).toMatchObject({ firstName: 'Sam', email: 'sam@example.test', message: 'Hello' });
    expect(m.updates[0]).toMatchObject({ crmStatus: 'recorded', crmContactId: 'contact-1', crmDealId: 'deal-1' });
  });

  it('acknowledges a stored submission even when the CRM is unconfigured, and marks it failed for a retry', async () => {
    m.upsertContact.mockResolvedValue(null);

    const response = await post();

    expect(response.status).toBe(200);
    expect(m.inserted).toHaveLength(1);
    expect(m.updates[0]).toMatchObject({ crmStatus: 'failed', crmContactId: null, crmSyncedAt: null });
    expect(m.createDeal).not.toHaveBeenCalled();
  });

  it('marks the submission failed when the contact synced but the deal did not, and when the CRM throws', async () => {
    m.upsertContact.mockResolvedValue('contact-1');
    m.createDeal.mockResolvedValue(null);
    expect((await post()).status).toBe(200);
    expect(m.updates[0]).toMatchObject({ crmStatus: 'failed', crmContactId: 'contact-1' });

    m.updates.length = 0;
    m.upsertContact.mockRejectedValue(new Error('crm down'));
    expect((await post()).status).toBe(200);
    expect(m.updates[0]).toMatchObject({ crmStatus: 'failed' });
  });

  it('answers 503, not ok, and contacts no CRM when the submission could not be stored', async () => {
    m.failInsert = true;

    const response = await post();

    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty('ok');
    expect(m.upsertContact).not.toHaveBeenCalled();
  });

  // DEF-0B6-SYS-CONTACT-UNBOUNDED-FIELDS-AND-EMAIL-LOGGED
  it('refuses an oversized field with 400 before storing or contacting the CRM', async () => {
    m.guard.mockResolvedValue({ ok: true, json: { ...body, organization: 'x'.repeat(201) } });

    const response = await post();

    expect(response.status).toBe(400);
    expect(m.inserted).toHaveLength(0);
    expect(m.upsertContact).not.toHaveBeenCalled();
  });

  it('does not write the visitor\'s e-mail address to the log', async () => {
    const { logger } = await import('@/lib/logger');
    m.upsertContact.mockResolvedValue('contact-1');
    m.createDeal.mockResolvedValue('deal-1');

    await post();

    expect(JSON.stringify((logger.info as ReturnType<typeof vi.fn>).mock.calls)).not.toContain(body.email);
    expect(JSON.stringify((logger.error as ReturnType<typeof vi.fn>).mock.calls)).not.toContain(body.email);
  });

  it('refuses an invalid submission with 400 before storing or contacting the CRM', async () => {
    m.guard.mockResolvedValue({ ok: true, json: { firstName: '', email: 'not-an-email' } });

    const response = await post();

    expect(response.status).toBe(400);
    expect(m.inserted).toHaveLength(0);
    expect(m.upsertContact).not.toHaveBeenCalled();
  });
});
