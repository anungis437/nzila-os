import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'orderBy', 'insert', 'update', 'set', 'values', 'returning', 'delete']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const tx = { insert: () => makeChain() };
  const db = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
    transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
  const auditLog = vi.fn();
  const getActiveContract = vi.fn();
  return { queue, db, auditLog, getActiveContract };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema', () =>
  new Proxy(
    {},
    {
      has: () => true,
      get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
    },
  ),
);
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
}));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: h.auditLog,
  AuditEventType: { DATA_CREATE: 'data_create', DATA_UPDATE: 'data_update' },
  AuditSeverity: { MEDIUM: 'medium', HIGH: 'high' },
}));
vi.mock('../contract-service', () => ({ getActiveContract: h.getActiveContract }));

import {
  addTemplateModule,
  createTemplate,
  getTemplate,
  instantiateTemplate,
  listTemplates,
  seedDefaultTemplates,
  seedGtmTemplates,
  updateTemplate,
} from '../pricing-template-service';

const pushSel = (...items: unknown[]) => h.queue.push(...items);

const baseTemplateInput = {
  code: 'tpl-1',
  name: 'Template 1',
  tier: 'pilot' as never,
  basePlatformFeeCad: '500.00',
};

beforeEach(() => {
  h.queue.length = 0;
  h.auditLog.mockReset();
  h.getActiveContract.mockReset();
});

describe('platform-economics/pricing-template-service', () => {
  describe('createTemplate', () => {
    it('creates a template with modules', async () => {
      pushSel([{ id: 't1', code: 'tpl-1' }]); // template returning
      pushSel([{ id: 'm1' }]); // module returning
      const result = await createTemplate({
        ...baseTemplateInput,
        modules: [{ moduleKey: 'governance_suite', moduleName: 'Gov', included: true }],
      });
      expect(result.template.id).toBe('t1');
      expect(result.modules).toHaveLength(1);
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });

    it('creates a template without modules', async () => {
      pushSel([{ id: 't1', code: 'tpl-1' }]);
      const result = await createTemplate(baseTemplateInput);
      expect(result.modules).toEqual([]);
    });
  });

  describe('getTemplate', () => {
    it('returns a template found by id', async () => {
      pushSel([{ id: 't1' }]); // id lookup
      pushSel([{ id: 'm1' }]); // modules
      const result = await getTemplate('t1');
      expect(result?.template.id).toBe('t1');
      expect(result?.modules).toHaveLength(1);
    });

    it('falls back to lookup by code', async () => {
      pushSel([]); // id lookup empty
      pushSel([{ id: 't1', code: 'tpl-1' }]); // code lookup
      pushSel([]); // modules
      const result = await getTemplate('tpl-1');
      expect(result?.template.code).toBe('tpl-1');
    });

    it('returns null when not found', async () => {
      pushSel([]); // id
      pushSel([]); // code
      expect(await getTemplate('missing')).toBeNull();
    });
  });

  describe('listTemplates', () => {
    it('lists templates by status', async () => {
      pushSel([{ id: 't1' }, { id: 't2' }]);
      const result = await listTemplates(['active', 'inactive']);
      expect(result).toHaveLength(2);
    });
  });

  describe('updateTemplate', () => {
    it('updates and audits a template', async () => {
      pushSel([{ id: 't1' }]); // update returning
      const result = await updateTemplate('t1', { name: 'New' }, 'user-1');
      expect(result?.id).toBe('t1');
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });

    it('returns null when not found', async () => {
      pushSel([]); // update returning empty
      const result = await updateTemplate('t1', { name: 'New' });
      expect(result).toBeNull();
      expect(h.auditLog).not.toHaveBeenCalled();
    });
  });

  describe('addTemplateModule', () => {
    it('adds a module', async () => {
      pushSel([{ id: 'm1' }]);
      const result = await addTemplateModule('t1', {
        moduleKey: 'governance_suite',
        moduleName: 'Gov',
        included: true,
      });
      expect(result.id).toBe('m1');
    });
  });

  describe('instantiateTemplate', () => {
    const template = {
      id: 't1',
      code: 'tpl-1',
      name: 'Template 1',
      description: 'd',
      basePlatformFeeCad: '500.00',
      perLocalFeeCad: null,
      perAdminSeatFeeCad: null,
      perModuleFeeCad: null,
      onboardingFeeCad: null,
      supportFeeCad: null,
      billingCadence: 'monthly',
      trialDays: 30,
      pilotMode: true,
      discountPercent: null,
      subsidyCad: null,
      tier: 'pilot',
    };

    it('instantiates a plan and subscription', async () => {
      pushSel([template]); // getTemplate id
      pushSel([]); // getTemplate modules
      h.getActiveContract.mockResolvedValueOnce({ id: 'ctr-1' });
      pushSel([{ id: 'plan-1' }]); // plan returning
      pushSel([{ id: 'sub-1' }]); // subscription returning
      const result = await instantiateTemplate('tpl-1', 'o1', 'ba1', 'user-1');
      expect(result.subscriptionPlanId).toBe('plan-1');
      expect(result.subscriptionId).toBe('sub-1');
    });

    it('throws when the template is not found', async () => {
      pushSel([]); // getTemplate id
      pushSel([]); // getTemplate code
      await expect(instantiateTemplate('missing', 'o1', 'ba1')).rejects.toThrow('not found');
    });

    it('throws when there is no active contract', async () => {
      pushSel([template]); // getTemplate id
      pushSel([]); // modules
      h.getActiveContract.mockResolvedValueOnce(null);
      await expect(instantiateTemplate('tpl-1', 'o1', 'ba1')).rejects.toThrow('no active contract');
    });

    it('instantiates a non-pilot template (active status)', async () => {
      pushSel([{ ...template, pilotMode: false, trialDays: null, billingCadence: 'annual' }]); // getTemplate id
      pushSel([]); // modules
      h.getActiveContract.mockResolvedValueOnce({ id: 'ctr-1' });
      pushSel([{ id: 'plan-2' }]); // plan
      pushSel([{ id: 'sub-2' }]); // subscription
      const result = await instantiateTemplate('tpl-1', 'o1', 'ba1');
      expect(result.subscriptionId).toBe('sub-2');
    });
  });

  describe('seedDefaultTemplates', () => {
    it('skips templates that already exist', async () => {
      // 5 defaults, each getTemplate found by id (select id + modules)
      for (let i = 0; i < 5; i++) {
        pushSel([{ id: `t${i}` }]); // id lookup found
        pushSel([]); // modules
      }
      const seeded = await seedDefaultTemplates('user-1');
      expect(seeded).toEqual([]);
    });
  });

  describe('seedGtmTemplates', () => {
    it('skips GTM tiers that already exist', async () => {
      // 4 GTM tiers, each getTemplate found by id
      for (let i = 0; i < 4; i++) {
        pushSel([{ id: `gtm${i}` }]); // id lookup found
        pushSel([]); // modules
      }
      const seeded = await seedGtmTemplates('user-1');
      expect(seeded).toEqual([]);
    });
  });
});
