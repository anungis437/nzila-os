import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  upsertContact: vi.fn(),
  createDeal: vi.fn(),
  runStewardshipCartography: vi.fn(() => ({ density: { index: 0 } })),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  withSystemContext: vi.fn(),
  selectQueue: [] as unknown[][],
}));

const mockDb = {
  select: vi.fn(() => {
    const chain: any = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(async () => (m.selectQueue.shift() ?? []) as unknown[]),
    };
    // holders query awaits the where() result directly (no limit).
    chain.then = (resolve: (v: unknown) => void) =>
      resolve((m.selectQueue.shift() ?? []) as unknown[]);
    return chain;
  }),
};

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: (...args: unknown[]) => m.withSystemContext(...args),
}));
vi.mock('@/lib/services/crm-service', () => ({
  upsertContact: m.upsertContact,
  createDeal: m.createDeal,
}));
vi.mock('@/lib/workbook/engines/stewardshipCartography', () => ({
  runStewardshipCartography: m.runStewardshipCartography,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));
// Decouple the classification test from the property-mapper's cartography
// shape \u2014 we only assert error/skip classification and the ok path.
vi.mock('../workbookPropertyMapper', () => ({
  WORKBOOK_DEAL_STAGE_LABELS: { self_guided_purchased: 'Self-Guided Purchased' },
  WORKBOOK_DEAL_STAGES: { self_guided_purchased: 'stage_self_guided' },
  WORKBOOK_TIER_LABELS: { workbook_self_guided: 'Self-Guided Workbook' },
  buildWorkbookCompanyProperties: () => ({}),
  buildWorkbookContactProperties: () => ({}),
  workbookTierToStage: () => 'self_guided_purchased',
}));

async function load() {
  return import('../syncWorkbookPurchase');
}

const baseInput = {
  workbookId: 'wb_1',
  tier: 'workbook_self_guided' as const,
  email: 'a@b.ca',
};

describe('syncWorkbookPurchase — CRM error classification', () => {
  const originalKey = process.env.HUBSPOT_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    process.env.HUBSPOT_API_KEY = 'test-key';
    // Default: the workbook exists; the trusted load runs inside a system context.
    m.withSystemContext.mockImplementation((cb: any) => cb(mockDb));
    m.upsertContact.mockResolvedValue('contact_1');
    m.createDeal.mockResolvedValue('deal_1');
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.HUBSPOT_API_KEY;
    else process.env.HUBSPOT_API_KEY = originalKey;
  });

  it('skips no_email when the buyer email is absent', async () => {
    const { syncWorkbookPurchase } = await load();
    const result = await syncWorkbookPurchase({ ...baseInput, email: undefined });
    expect(result).toEqual({ ok: false, skipped: 'no_email' });
  });

  it('skips crm_disabled when no API key is configured', async () => {
    delete process.env.HUBSPOT_API_KEY;
    const { syncWorkbookPurchase } = await load();
    const result = await syncWorkbookPurchase(baseInput);
    expect(result).toEqual({ ok: false, skipped: 'crm_disabled' });
  });

  it('skips workbook_missing when the fulfilled workbook cannot be found', async () => {
    const { syncWorkbookPurchase } = await load();
    m.selectQueue.push([]); // workbook lookup -> empty
    const result = await syncWorkbookPurchase(baseInput);
    expect(result).toEqual({ ok: false, skipped: 'workbook_missing' });
    expect(m.upsertContact).not.toHaveBeenCalled();
  });

  it('classifies a DB / authority failure as crm_data_load_failure (not crm_disabled)', async () => {
    const { syncWorkbookPurchase } = await load();
    m.withSystemContext.mockRejectedValueOnce(new Error('RLS denied'));
    const result = await syncWorkbookPurchase(baseInput);
    expect(result).toEqual({ ok: false, skipped: 'crm_data_load_failure' });
    expect(m.upsertContact).not.toHaveBeenCalled();
  });

  it('classifies a provider failure as crm_provider_failure (not crm_disabled)', async () => {
    const { syncWorkbookPurchase } = await load();
    m.selectQueue.push([{ id: 'wb_1' }]); // workbook exists
    m.selectQueue.push([]); // holders
    m.upsertContact.mockRejectedValueOnce(new Error('HubSpot 500'));
    const result = await syncWorkbookPurchase(baseInput);
    expect(result).toEqual({ ok: false, skipped: 'crm_provider_failure' });
  });

  it('returns ok on a successful sync', async () => {
    const { syncWorkbookPurchase } = await load();
    m.selectQueue.push([{ id: 'wb_1' }]); // workbook exists
    m.selectQueue.push([]); // holders
    const result = await syncWorkbookPurchase(baseInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contactId).toBe('contact_1');
      expect(result.dealId).toBe('deal_1');
    }
  });
});
