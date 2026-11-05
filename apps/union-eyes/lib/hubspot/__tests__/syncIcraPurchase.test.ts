import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  rows: [] as unknown[][],
  open: 0,
  openedDuringCrm: [] as number[],
  upsertContact: vi.fn(),
  createDeal: vi.fn(),
  contexts: 0,
}));

function chain() {
  const c: Record<string, unknown> = {};
  for (const name of ['from', 'where']) c[name] = () => c;
  c.limit = async () => m.rows.shift() ?? [];
  return c;
}

const tx = { select: vi.fn(() => chain()) };

// The ambient handle must never be used: the tables are system-only and this runs after the webhook's own transaction.
vi.mock('@/db', () => ({ db: new Proxy({}, { get() { throw new Error('ambient db used outside a context'); } }) }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: vi.fn(async (operation: (t: typeof tx) => Promise<unknown>) => {
    m.contexts += 1;
    m.open += 1;
    try {
      return await operation(tx);
    } finally {
      m.open -= 1;
    }
  }),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/services/crm-service', () => ({
  upsertContact: (...args: unknown[]) => { m.openedDuringCrm.push(m.open); return m.upsertContact(...args); },
  createDeal: (...args: unknown[]) => { m.openedDuringCrm.push(m.open); return m.createDeal(...args); },
}));
vi.mock('@/db/schema/icra-schema', () => ({
  icraAssessments: { id: 'id', reportTierId: 'reportTierId' },
  icraMaturityProfiles: { assessmentId: 'assessmentId', profilePayload: 'profilePayload' },
}));
vi.mock('../icraPropertyMapper', async () => ({
  ICRA_DEAL_STAGES: { reflection_completed: 'stage-1', brief_purchased: 'stage-2', diagnostic_interest: 'stage-3' },
  ICRA_DEAL_STAGE_LABELS: { reflection_completed: 'Reflection', brief_purchased: 'Brief', diagnostic_interest: 'Diagnostic' },
  REPORT_TIER_LABELS: { continuity_reflection: 'Reflection', executive_continuity_brief: 'Brief', institutional_continuity_diagnostic: 'Diagnostic' },
  buildContactProperties: () => ({}),
  buildCompanyProperties: () => ({}),
}));

const input = { assessmentId: '11111111-1111-4111-8111-111111111111', tierId: 'executive_continuity_brief' as const, email: 'buyer@example.test' };

describe('syncIcraPurchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.rows = [];
    m.open = 0;
    m.openedDuringCrm = [];
    m.contexts = 0;
    process.env.HUBSPOT_API_KEY = 'test-key';
    m.upsertContact.mockResolvedValue('contact-1');
    m.createDeal.mockResolvedValue('deal-1');
  });

  it('reads the assessment and its profile in one system context, and holds no transaction across the CRM calls', async () => {
    const { syncIcraPurchase } = await import('../syncIcraPurchase');
    m.rows.push([{ id: input.assessmentId, reportTierId: 'executive_continuity_brief' }], [{ profilePayload: { reportTierId: 'executive_continuity_brief' } }]);

    const result = await syncIcraPurchase(input);

    expect(result).toMatchObject({ ok: true, contactId: 'contact-1', dealId: 'deal-1' });
    expect(m.contexts).toBe(1);
    expect(tx.select).toHaveBeenCalledTimes(2);
    expect(m.openedDuringCrm).toEqual([0, 0]);
  });

  it('skips, without a CRM call, when the assessment does not exist', async () => {
    const { syncIcraPurchase } = await import('../syncIcraPurchase');
    m.rows.push([]);

    expect(await syncIcraPurchase(input)).toEqual({ ok: false, skipped: 'assessment_missing' });
    expect(tx.select).toHaveBeenCalledTimes(1);
    expect(m.upsertContact).not.toHaveBeenCalled();
  });

  it('skips, without a CRM call, when the assessment has no stored profile', async () => {
    const { syncIcraPurchase } = await import('../syncIcraPurchase');
    m.rows.push([{ id: input.assessmentId, reportTierId: 'continuity_reflection' }], []);

    expect(await syncIcraPurchase(input)).toEqual({ ok: false, skipped: 'profile_missing' });
    expect(m.upsertContact).not.toHaveBeenCalled();
  });

  it('opens no context at all when there is no e-mail or no CRM key', async () => {
    const { syncIcraPurchase } = await import('../syncIcraPurchase');
    expect(await syncIcraPurchase({ ...input, email: undefined })).toEqual({ ok: false, skipped: 'no_email' });
    delete process.env.HUBSPOT_API_KEY;
    expect(await syncIcraPurchase(input)).toEqual({ ok: false, skipped: 'crm_disabled' });
    expect(m.contexts).toBe(0);
  });

  it('never throws upstream: a failed read is logged and reported as skipped', async () => {
    const { syncIcraPurchase } = await import('../syncIcraPurchase');
    tx.select.mockImplementationOnce(() => { throw new Error('connection reset'); });

    expect(await syncIcraPurchase(input)).toEqual({ ok: false, skipped: 'crm_disabled' });
  });
});
