import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => {
  const state = {
    existing: [] as Array<Record<string, unknown>>,
    written: [] as Array<Record<string, unknown>>,
    sets: [] as Array<Record<string, unknown>>,
    updateRows: null as Array<Record<string, unknown>> | null,
    persistAtomicAudit: vi.fn(),
    executeSync: vi.fn(),
    clearCache: vi.fn(),
    rotateCredential: vi.fn(),
    credentialReadiness: vi.fn(),
    refuseUnavailableActivation: vi.fn(),
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
  integrationConfigVersions: { id: 'versionId' },
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
vi.mock('@/lib/integrations/factory', () => ({
  IntegrationFactory: { getInstance: () => ({ clearCache: m.clearCache }) },
}));
vi.mock('@/lib/integrations/provider-policy', () => ({
  isProviderApprovedForControlPlane: () => true,
  findDisallowedSettingsKeys: () => [],
  findUnapprovedEntities: () => [],
}));
vi.mock('@/lib/integrations/credential-store', () => ({
  rotateIntegrationCredentialBinding: m.rotateCredential,
  integrationCredentialReadiness: m.credentialReadiness,
}));
vi.mock('@/lib/reality/activation-guard', () => ({ refuseUnavailableActivation: m.refuseUnavailableActivation }));
vi.mock('@/lib/reality/configuration-effect', () => ({ INTEGRATION_SYNC_EFFECT: { inEffect: false } }));

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
    m.rotateCredential.mockResolvedValue({ id: 'binding_1', version: 1 });
    m.credentialReadiness.mockResolvedValue({ stored: true, resolvable: true });
    m.refuseUnavailableActivation.mockRejectedValue(Object.assign(new Error('Integration synchronization is unavailable'), { code: 'CAPABILITY_UNAVAILABLE' }));
  });

  it('configure audits the creation on the same transaction without echoing settings or credentials', async () => {
    await configureIntegrationForOrg(
      'org_1',
      { provider: IntegrationProvider.BAMBOOHR, type: IntegrationType.HRIS, settings: { region: 'ca' }, credentialRef: 'env://UE_INTEGRATION_BAMBOOHR' },
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
    expect(JSON.stringify(m.persistAtomicAudit.mock.calls)).not.toContain('UE_INTEGRATION_BAMBOOHR');
  });

  it('reports managed credential readiness without returning the secret or its reference', async () => {
    const config = await configureIntegrationForOrg(
      'org_1',
      { provider: IntegrationProvider.BAMBOOHR, type: IntegrationType.HRIS, settings: { region: 'ca' }, credentialRef: 'env://UE_INTEGRATION_BAMBOOHR' },
      'u1',
    );
    expect(config.credentialsStored).toBe(true);
    expect(config.credentialsResolvable).toBe(true);
    expect(JSON.stringify(config)).not.toContain('UE_INTEGRATION_BAMBOOHR');
  });

  const existing = { ...config, activeVersion: 1, enabled: true, settings: { region: 'ca' }, webhookUrl: 'https://hooks.example/x', credentials: { bindingId: 'binding_old', version: 1 } };

  it('changing only the credential reference leaves enabled, settings and webhook URL as they were', async () => {
    m.existing = [existing];
    await configureIntegrationForOrg('org_1', { provider: IntegrationProvider.BAMBOOHR, type: IntegrationType.HRIS, credentialRef: 'env://UE_INTEGRATION_BAMBOOHR_NEXT' }, 'steward_1');
    expect(Object.keys(m.sets[0]).sort()).toEqual(['activeVersion', 'credentials', 'updatedAt']);
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
      configureIntegrationForOrg('org_1', { provider: IntegrationProvider.BAMBOOHR, type: IntegrationType.HRIS, enabled: false }, 'steward_1'),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.clearCache).not.toHaveBeenCalled();
  });

  // DEF: integration-factory cache-staleness - a saved config change must not keep serving a cached adapter built from
  // the prior credentials/settings.
  it('configure clears the cached adapter instance for this organization and provider after a successful save', async () => {
    await configureIntegrationForOrg(
      'org_1',
      { provider: IntegrationProvider.BAMBOOHR, type: IntegrationType.HRIS, settings: { region: 'ca' }, credentialRef: 'env://UE_INTEGRATION_BAMBOOHR' },
      'steward_1',
    );
    expect(m.clearCache).toHaveBeenCalledWith('org_1', IntegrationProvider.BAMBOOHR);
  });

  it('configure fails, leaving no integration, when the audit cannot be written', async () => {
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(
      configureIntegrationForOrg('org_1', { provider: IntegrationProvider.BAMBOOHR, type: IntegrationType.HRIS }, 'steward_1'),
    ).rejects.toThrow('audit unavailable');
  });

  it('activation is refused before a write, while deactivation remains audited', async () => {
    m.existing = [{ ...config, enabled: true }];
    await expect(setIntegrationActivationForOrg('org_1', 'cfg_1', true, 'steward_1')).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.clearCache).not.toHaveBeenCalled();

    await setIntegrationActivationForOrg('org_1', 'cfg_1', false, 'steward_1');
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: 'integration.deactivate', resourceId: 'cfg_1', details: expect.objectContaining({ previouslyEnabled: true }) }),
    );
    expect(m.clearCache).toHaveBeenCalledWith('org_1', 'bamboohr');

    m.persistAtomicAudit.mockClear();
    m.clearCache.mockClear();
    m.updateRows = [];
    await expect(setIntegrationActivationForOrg('org_1', 'cfg_1', false, 'steward_1')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.clearCache).not.toHaveBeenCalled();
  });

  it('activation treats another organization\u2019s integration as not found, with no audit', async () => {
    m.existing = [];
    await expect(setIntegrationActivationForOrg('org_1', 'cfg_other', false, 'steward_1')).rejects.toThrow('not found');
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('sync is refused before configuration, audit-intent or adapter execution', async () => {
    m.existing = [{ ...config, enabled: true }];
    m.executeSync.mockImplementationOnce(async () => {
      m.order.push('sync');
      return { success: true };
    });
    m.persistAtomicAudit.mockImplementation(async (_tx: unknown, entry: { action: string }) => {
      m.order.push(entry.action);
    });

    await expect(
      initiateTenantIntegrationSync('org_1', 'steward_1', { integrationId: 'cfg_1', syncType: SyncType.INCREMENTAL }),
    ).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' });
    expect(m.refuseUnavailableActivation).toHaveBeenCalledWith(expect.objectContaining({ action: 'integration.sync_blocked' }));
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.executeSync).not.toHaveBeenCalled();
  });

  it('sync refuses a disabled integration before anything is audited or run', async () => {
    m.existing = [{ ...config, enabled: false }];
    await expect(
      initiateTenantIntegrationSync('org_1', 'steward_1', { integrationId: 'cfg_1', syncType: SyncType.INCREMENTAL }),
    ).rejects.toMatchObject({ code: 'CAPABILITY_UNAVAILABLE' });
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    expect(m.executeSync).not.toHaveBeenCalled();
  });
});
