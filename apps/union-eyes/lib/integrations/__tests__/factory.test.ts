/**
 * Integration Factory — Unit Tests
 *
 * The factory news concrete adapter classes; we replace all 16 adapter modules
 * with a lightweight FakeAdapter so the test stays isolated from client/fetch
 * code. DB access (loadConfig/loadAllConfigs) goes through the shared queue
 * mock. The real IntegrationRegistry singleton is used for availability and
 * environment-variable checks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const q: unknown[] = [];
  const shift = () => (q.length ? q.shift() : []);
  const makeChain = () => {
    const c: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'orderBy', 'limit', 'set', 'values', 'update', 'insert', 'delete']) {
      c[m] = () => c;
    }
    (c as { then: unknown }).then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = shift();
      if (v instanceof Error) return Promise.reject(v).then(res, rej);
      return Promise.resolve(v).then(res, rej);
    };
    return c;
  };
  const db = { select: makeChain };
  class FakeAdapter {
    initialized = false;
    constructor(..._args: unknown[]) {}
    async initialize() {
      this.initialized = true;
    }
  }
  return { q, db, FakeAdapter };
});

vi.mock('@/db/db', () => ({ db: h.db }));
vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../adapters/hris/workday-adapter', () => ({ WorkdayAdapter: h.FakeAdapter }));
vi.mock('../adapters/hris/bamboohr-adapter', () => ({ BambooHRAdapter: h.FakeAdapter }));
vi.mock('../adapters/hris/adp-adapter', () => ({ ADPAdapter: h.FakeAdapter }));
vi.mock('../adapters/accounting/quickbooks-adapter', () => ({ QuickBooksAdapter: h.FakeAdapter }));
vi.mock('../adapters/accounting/xero-adapter', () => ({ XeroAdapter: h.FakeAdapter }));
vi.mock('../adapters/accounting/sage-intacct-adapter', () => ({ SageIntacctAdapter: h.FakeAdapter }));
vi.mock('../adapters/accounting/freshbooks-adapter', () => ({ FreshBooksAdapter: h.FakeAdapter }));
vi.mock('../adapters/accounting/wave-adapter', () => ({ WaveAdapter: h.FakeAdapter }));
vi.mock('../adapters/insurance/sunlife-adapter', () => ({ SunLifeAdapter: h.FakeAdapter }));
vi.mock('../adapters/insurance/manulife-adapter', () => ({ ManulifeAdapter: h.FakeAdapter }));
vi.mock('../adapters/insurance/greenshield-adapter', () => ({ GreenShieldAdapter: h.FakeAdapter }));
vi.mock('../adapters/insurance/canadalife-adapter', () => ({ CanadaLifeAdapter: h.FakeAdapter }));
vi.mock('../adapters/insurance/ia-adapter', () => ({ IndustrialAllianceAdapter: h.FakeAdapter }));
vi.mock('../adapters/communication/slack-adapter', () => ({ SlackAdapter: h.FakeAdapter }));
vi.mock('../adapters/communication/teams-adapter', () => ({ TeamsAdapter: h.FakeAdapter }));
vi.mock('../adapters/lms/linkedin-learning-adapter', () => ({ LinkedInLearningAdapter: h.FakeAdapter }));
vi.mock('../adapters/documents/sharepoint-adapter', () => ({ SharePointAdapter: h.FakeAdapter }));

import { IntegrationFactory, getIntegration, getIntegrations } from '../factory';
import { IntegrationProvider, IntegrationType } from '../types';

const push = (...rows: unknown[]) => h.q.push(...rows);
const factory = IntegrationFactory.getInstance();

const enabledConfigRow = (over: Record<string, unknown> = {}) => [
  {
    organizationId: 'org1',
    type: 'hris',
    provider: 'workday',
    credentials: { clientId: 'a', clientSecret: 'b' },
    settings: {},
    webhookUrl: null,
    enabled: true,
    ...over,
  },
];

function setWorkdayEnv() {
  process.env.WORKDAY_CLIENT_ID = 'a';
  process.env.WORKDAY_CLIENT_SECRET = 'b';
  process.env.WORKDAY_TENANT_ID = 'c';
}
function clearWorkdayEnv() {
  delete process.env.WORKDAY_CLIENT_ID;
  delete process.env.WORKDAY_CLIENT_SECRET;
  delete process.env.WORKDAY_TENANT_ID;
}

beforeEach(() => {
  h.q.length = 0;
  vi.clearAllMocks();
  factory.clearAllCache();
  setWorkdayEnv();
});

describe('IntegrationFactory', () => {
  it('getInstance is a singleton', () => {
    expect(IntegrationFactory.getInstance()).toBe(factory);
  });

  it('getIntegration creates, caches, and reuses an instance', async () => {
    push(enabledConfigRow());
    const inst = await factory.getIntegration('org1', IntegrationProvider.WORKDAY);
    expect(inst).toBeInstanceOf(h.FakeAdapter);
    // Second call returns cached instance without touching the DB
    const again = await factory.getIntegration('org1', IntegrationProvider.WORKDAY);
    expect(again).toBe(inst);
  });

  it('throws PROVIDER_UNAVAILABLE for unregistered provider', async () => {
    await expect(factory.getIntegration('org1', IntegrationProvider.CUSTOM)).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
  });

  it('throws MISSING_ENV_VARS when env not configured', async () => {
    clearWorkdayEnv();
    await expect(factory.getIntegration('orgX', IntegrationProvider.WORKDAY)).rejects.toMatchObject({
      code: 'MISSING_ENV_VARS',
    });
  });

  it('throws CONFIG_NOT_FOUND when no config row', async () => {
    push([]);
    await expect(factory.getIntegration('org1', IntegrationProvider.WORKDAY)).rejects.toMatchObject({
      code: 'CONFIG_NOT_FOUND',
    });
  });

  it('throws INTEGRATION_DISABLED when config disabled', async () => {
    push(enabledConfigRow({ enabled: false }));
    await expect(factory.getIntegration('org1', IntegrationProvider.WORKDAY)).rejects.toMatchObject({
      code: 'INTEGRATION_DISABLED',
    });
  });

  it('getIntegrations loads enabled configs, skips disabled, swallows errors', async () => {
    // loadAllConfigs returns one enabled WORKDAY + one disabled SLACK
    push([
      { organizationId: 'org1', type: 'hris', provider: 'workday', credentials: { clientId: 'a', clientSecret: 'b' }, settings: {}, enabled: true },
      { organizationId: 'org1', type: 'communication', provider: 'slack', credentials: {}, settings: {}, enabled: false },
    ]);
    // getIntegration(WORKDAY) -> loadConfig
    push(enabledConfigRow());
    const list = await factory.getIntegrations('org1', IntegrationType.HRIS);
    expect(list).toHaveLength(1);
    expect(list[0]).toBeInstanceOf(h.FakeAdapter);
  });

  it('getIntegrations swallows per-integration errors', async () => {
    clearWorkdayEnv(); // WORKDAY env missing -> getIntegration throws, caught
    push([
      { organizationId: 'org1', type: 'hris', provider: 'workday', credentials: {}, settings: {}, enabled: true },
    ]);
    const list = await factory.getIntegrations('org1');
    expect(list).toEqual([]);
  });

  it('clearCache forces a fresh load', async () => {
    push(enabledConfigRow());
    await factory.getIntegration('org1', IntegrationProvider.WORKDAY);
    factory.clearCache('org1', IntegrationProvider.WORKDAY);
    push(enabledConfigRow()); // needs DB again after cache clear
    const fresh = await factory.getIntegration('org1', IntegrationProvider.WORKDAY);
    expect(fresh).toBeInstanceOf(h.FakeAdapter);
  });

  it('createInstance covers communication adapter (constructor args)', async () => {
    process.env.SLACK_CLIENT_ID = 'a';
    process.env.SLACK_CLIENT_SECRET = 'b';
    push([
      {
        organizationId: 'org1',
        type: 'communication',
        provider: 'slack',
        credentials: { clientId: 'a', clientSecret: 'b' },
        settings: { foo: 'bar' },
        enabled: true,
      },
    ]);
    const inst = await factory.getIntegration('org1', IntegrationProvider.SLACK);
    expect(inst).toBeInstanceOf(h.FakeAdapter);
    delete process.env.SLACK_CLIENT_ID;
    delete process.env.SLACK_CLIENT_SECRET;
  });
});

describe('factory convenience functions', () => {
  it('getIntegration / getIntegrations delegate to the singleton', async () => {
    push(enabledConfigRow());
    expect(await getIntegration('org1', IntegrationProvider.WORKDAY)).toBeInstanceOf(h.FakeAdapter);
    push([]);
    expect(await getIntegrations('org1', IntegrationType.ACCOUNTING)).toEqual([]);
  });
});
