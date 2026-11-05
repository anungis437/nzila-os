import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const state = {
    existing: [] as Array<Record<string, unknown>>,
    written: [] as Array<Record<string, unknown>>,
    sets: [] as Array<Record<string, unknown>>,
    updateRows: null as Array<Record<string, unknown>> | null,
    persistAtomicAudit: vi.fn(),
    executeSync: vi.fn(),
    order: [] as string[],
  };
  const chain = (rows: () => unknown[], op: string) => {
    const c: Record<string, unknown> = {};
    for (const name of ['from', 'where', 'limit', 'for']) c[name] = () => c;
    c.set = (changes: Record<string, unknown>) => {
      state.sets.push(changes);
      return c;
    };
    c.values = (row: Record<string, unknown>) => {
      state.written.push(row);
      return c;
    };
    c.returning = async () => {
      state.order.push(op);
      return rows();
    };
    c.then = (resolve: (v: unknown) => unknown) => Promise.resolve(rows()).then(resolve);
    return c;
  };
  const tx = {
    select: () => chain(() => state.existing, 'select'),
    insert: () => chain(() => [{ id: 'cfg_new', organizationId: 'org_1', provider: 'bamboohr', type: 'hris', enabled: false, settings: {} }], 'insert'),
    update: () => chain(() => state.updateRows ?? [{ id: 'cfg_1', organizationId: 'org_1', provider: 'bamboohr', type: 'hris', enabled: true, settings: {} }], 'update'),
  };
  return Object.assign(state, { tx });
});
const tx = m.tx;

vi.mock('@/db/db', () => ({ db: m.tx }));
vi.mock('@/db/schema', () => ({
  integrationConfigs: { id: 'id', organizationId: 'organizationId', provider: 'provider', enabled: 'enabled' },
  integrationProviderEnum: { enumValues: [] },
  integrationTypeEnum: { enumValues: [] },
}));
vi.mock('drizzle-orm', () => ({
  and: vi.fn(() => 'and'),
  eq: vi.fn(() => 'eq'),
  sql: vi.fn(() => 'sql'),
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (_ctx: unknown, fn: (t: unknown) => Promise<unknown>) => fn(m.tx)),
  withSystemContext: vi.fn(),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/integrations/registry', () => ({
  IntegrationRegistry: { getInstance: () => ({ getMetadata: () => ({ type: 'hris' }) }) },
}));
vi.mock('@/lib/integrations/sync-engine', () => ({
  SyncEngine: { getInstance: () => ({ executeSync: m.executeSync }) },
}));
vi.mock('@/lib/integrations/provider-policy', () => ({
  isProviderApprovedForControlPlane: () => true,
  findDisallowedSettingsKeys: () => [],
  findUnapprovedEntities: () => [],
}));

import { IntegrationProvider, IntegrationType, SyncType } from '@/lib/integrations/types';
import {
  configureIntegrationForOrg,
  setIntegrationActivationForOrg,
  initiateTenantIntegrationSync,
} from '@/lib/integrations/control-plane';

const config = { id: 'cfg_1', organizationId: 'org_1', provider: 'bamboohr', type: 'hris', enabled: false, settings: {} };

describe('integration control plane — audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.existing = [];
    m.written = [];
    m.sets = [];
    m.updateRows = null;
    m.order = [];
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.executeSync.mockResolvedValue({ success: true });
  });

  it('configure audits the creation on the same transaction without echoing settings or credentials', async () => {
    await configureIntegrationForOrg(
      'org_1',
      { provider: IntegrationProvider.BAMBOOHR, type: IntegrationType.HRIS, settings: { region: 'ca' }, credentialRef: 'vault/secret-1' },
      'steward_1',
    );

    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        organizationId: 'org_1',
        userId: 'steward_1',
        action: 'integration.configure.create',
        details: expect.objectContaining({ settingsKeys: ['region'], credentialRefChanged: true }),
      }),
    );
    expect(JSON.stringify(m.persistAtomicAudit.mock.calls)).not.toContain('vault/secret-1');
  });

  it('never reports credentials as stored or resolvable: only a reference is held and nothing resolves it', async () => {
    const config = await configureIntegrationForOrg(
      'org_1',
      { provider: IntegrationProvider.BAMBOOHR, type: IntegrationType.HRIS, settings: { region: 'ca' }, credentialRef: 'vault://x' },
      'u1',
    );
    expect(config.credentialsStored).toBe(false);
    expect(config.credentialsResolvable).toBe(false);
  });

  const existing = { ...config, enabled: true, settings: { region: 'ca' }, webhookUrl: 'https://hooks.example/x', credentials: { credentialRef: 'vault/old' } };

  it('changing only the credential reference leaves enabled, settings and webhook URL as they were', async () => {
    m.existing = [existing];
    await configureIntegrationForOrg('org_1', { provider: IntegrationProvider.BAMBOOHR, type: IntegrationType.HRIS, credentialRef: 'vault/new' }, 'steward_1');
    expect(Object.keys(m.sets[0]).sort()).toEqual(['credentials', 'updatedAt']);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(tx, expect.objectContaining({
      details: expect.objectContaining({ settingsChanged: false, webhookUrlChanged: false, credentialRefChanged: true, previouslyEnabled: true }),
    }));
  });

  it('applies the fields that are supplied, including an explicit disable and an explicit empty settings object', async () => {
    m.existing = [existing];
    await configureIntegrationForOrg('org_1', { provider: IntegrationProvider.BAMBOOHR, type: IntegrationType.HRIS, enabled: false, settings: {}, webhookUrl: null as unknown as undefined }, 'steward_1');
    expect(m.sets[0]).toMatchObject({ enabled: false, settings: {}, webhookUrl: null });
  });

  it('refuses with 409, and no audit, when the integration was switched by someone else while configuring', async () => {
    m.existing = [existing];
    m.updateRows = [];
    await expect(
      configureIntegrationForOrg('org_1', { provider: IntegrationProvider.BAMBOOHR, type: IntegrationType.HRIS, enabled: true }, 'steward_1'),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('configure fails, leaving no integration, when the audit cannot be written', async () => {
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(
      configureIntegrationForOrg('org_1', { provider: IntegrationProvider.BAMBOOHR, type: IntegrationType.HRIS }, 'steward_1'),
    ).rejects.toThrow('audit unavailable');
  });

  it('activation audits the change with the previous state and refuses (409, no audit) when the integration changed concurrently', async () => {
    m.existing = [config];
    await setIntegrationActivationForOrg('org_1', 'cfg_1', true, 'steward_1');
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'integration.activate', resourceId: 'cfg_1', details: expect.objectContaining({ previouslyEnabled: false }) }),
    );

    m.persistAtomicAudit.mockClear();
    m.updateRows = [];
    await expect(setIntegrationActivationForOrg('org_1', 'cfg_1', true, 'steward_1')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('activation treats another organization\u2019s integration as not found, with no audit', async () => {
    m.existing = [];
    await expect(setIntegrationActivationForOrg('org_1', 'cfg_other', true, 'steward_1')).rejects.toThrow('not found');
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('sync records its intent before it runs and its outcome after, and does not run if the intent cannot be recorded', async () => {
    m.existing = [{ ...config, enabled: true }];
    m.executeSync.mockImplementationOnce(async () => {
      m.order.push('sync');
      return { success: true };
    });
    m.persistAtomicAudit.mockImplementation(async (_tx: unknown, entry: { action: string }) => {
      m.order.push(entry.action);
    });

    await initiateTenantIntegrationSync('org_1', 'steward_1', { integrationId: 'cfg_1', syncType: SyncType.INCREMENTAL });

    expect(m.order.filter((step) => step === 'integration.sync.requested' || step === 'sync' || step === 'integration.sync.completed'))
      .toEqual(['integration.sync.requested', 'sync', 'integration.sync.completed']);

    m.executeSync.mockClear();
    m.persistAtomicAudit.mockReset();
    m.persistAtomicAudit.mockRejectedValue(new Error('audit unavailable'));
    await expect(
      initiateTenantIntegrationSync('org_1', 'steward_1', { integrationId: 'cfg_1', syncType: SyncType.INCREMENTAL }),
    ).rejects.toThrow('could not be written');
    expect(m.executeSync).not.toHaveBeenCalled();
  });

  it('sync refuses a disabled integration before anything is audited or run', async () => {
    m.existing = [{ ...config, enabled: false }];
    await expect(
      initiateTenantIntegrationSync('org_1', 'steward_1', { integrationId: 'cfg_1', syncType: SyncType.INCREMENTAL }),
    ).rejects.toThrow('disabled');
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.executeSync).not.toHaveBeenCalled();
  });
});
