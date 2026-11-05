import { beforeEach, describe, expect, it, vi } from 'vitest';
import { txDouble } from '@/lib/page-data/__tests__/tx-double';

vi.mock('@/lib/db/with-rls-context', async () => (await import('@/lib/page-data/__tests__/tx-double')).txDoubleModule());

import { contentFileHref, formatDurationHours, loadContentDashboard, loadContentTemplate } from '../content';
import { loadDataSourceOverview } from '../data-source';
import { loadIntegrationSettings, loadIntegrationsDashboard } from '../integrations';
import { loadPlatformSettings } from '../platform-settings';
import { loadSecurityDashboard } from '../security';

const ORG = '4f0d6b5e-8a52-4c5e-9d0e-2f3b8d9a1c11';

beforeEach(() => txDouble.reset());

/** Every statement ran in the organization's own context, filtered by it, and none ran in the system context or outside any. */
function expectOrganizationScoped(statementCount: number): void {
  expect(txDouble.contexts).toEqual([{ organizationId: ORG }]);
  expect(txDouble.systemContexts).toBe(0);
  expect(txDouble.statements).toHaveLength(statementCount);
  for (const statement of txDouble.statements) {
    expect(statement.context).toBe(ORG);
    expect(statement.where?.params).toContain(ORG);
  }
}

describe('formatDurationHours', () => {
  it.each([
    ['8.00', '8 hours'],
    [1.5, '1.5 hours'],
    ['1.00', '1 hour'],
    [0, '0 hours'],
  ])('writes %s as %s', (value, label) => expect(formatDurationHours(value)).toBe(label));

  it.each([[null], [undefined], ['soon']])('writes no label for %s', (value) => expect(formatDurationHours(value)).toBeNull());
});

describe('contentFileHref', () => {
  it.each([
    ['https://files.example.org/guide.pdf', 'https://files.example.org/guide.pdf'],
    ['/files/guide.pdf', '/files/guide.pdf'],
  ])('offers %s as a download', (value, href) => expect(contentFileHref(value)).toBe(href));

  it.each([
    [null],
    [''],
    ['javascript:alert(1)'],
    ['data:text/html;base64,PHNjcmlwdD4='],
    ['http://files.example.org/guide.pdf'],
    ['//evil.example.org/guide.pdf'],
    ['guide.pdf'],
    ['/files/guide .pdf'],
  ])('offers %s as nothing', (value) => expect(contentFileHref(value)).toBeNull());
});

describe('the content dashboard', () => {
  const item = {
    id: 'c1', title: 'Grievance guide', slug: 'grievance-guide', meta_description: 'How to file', status: 'published', category: 'guides',
    content_type: 'template', file_url: null, file_size_mb: '1.50', download_count: '3', view_count: null, published_at: '2026-01-01', updated_at: '2026-01-02',
  };
  const course = {
    id: 'k1', course_code: 'SAF-1', course_name: 'Safety basics', course_description: null, course_category: 'safety', delivery_method: 'online',
    duration_hours: '8.00', completion_count: 2, is_active: true, is_mandatory: true,
  };

  it('reads the content and the active courses of the organization, in its context, and maps them', async () => {
    txDouble.queue([item], [course]);

    const dashboard = await loadContentDashboard(ORG);

    expect(dashboard.items).toEqual([
      expect.objectContaining({ id: 'c1', type: 'template', fileSizeMb: 1.5, downloads: 3, views: 0, description: 'How to file' }),
    ]);
    expect(dashboard.courses).toEqual([
      expect.objectContaining({ courseCode: 'SAF-1', name: 'Safety basics', durationLabel: '8 hours', completions: 2, isMandatory: true }),
    ]);
    expectOrganizationScoped(2);
    expect(txDouble.statements[0].where?.sql).toMatch(/FROM cms_pages\s+WHERE organization_id = \$1::uuid/);
    expect(txDouble.statements[1].where?.sql).toMatch(/FROM training_courses c\s+WHERE c\.organization_id = \$1::uuid AND c\.is_active = true/);
    expect(txDouble.statements[1].where?.sql).toMatch(/cr\.organization_id = c\.organization_id AND cr\.completed IS TRUE/);
  });

  it('shows a file of zero megabytes as zero, not as no size', async () => {
    txDouble.queue([{ ...item, file_size_mb: 0 }], []);

    expect((await loadContentDashboard(ORG)).items[0].fileSizeMb).toBe(0);
  });

  it.each([
    ['the content cannot be read', [new Error('permission denied for table cms_pages')]],
    ['the courses cannot be read', [[item], new Error('permission denied for table training_courses')]],
  ])('rejects, instead of showing an empty dashboard, when %s', async (_case, results) => {
    txDouble.queue(...results);

    await expect(loadContentDashboard(ORG)).rejects.toThrow(/permission denied/);
  });

  it('reads one template by slug inside the organization and returns null when the organization has none', async () => {
    txDouble.queue([{ ...item, content: [{ type: 'heading', text: 'Hello' }] }]);

    const template = await loadContentTemplate(ORG, 'grievance-guide');

    expect(template).toMatchObject({ slug: 'grievance-guide', contentType: 'template', content: [{ type: 'heading', text: 'Hello' }] });
    expectOrganizationScoped(1);
    expect(txDouble.statements[0].where?.params).toEqual([ORG, 'grievance-guide']);

    txDouble.reset();
    txDouble.queue([]);
    expect(await loadContentTemplate(ORG, 'someone-elses')).toBeNull();
  });

  it('rejects when the template cannot be read', async () => {
    txDouble.queue(new Error('connection lost'));

    await expect(loadContentTemplate(ORG, 'x')).rejects.toThrow('connection lost');
  });
});

describe('the security dashboard', () => {
  const event = {
    id: 'e1', event_type: 'login_failure', severity: 'high', status: 'open', source_ip: '10.0.0.1', user_email: 'a@example.org', description: 'Too many attempts',
    resource: null, action_taken: null, resolved_by: null, resolved_at: null, created_at: '2026-02-01',
  };
  const check = { id: 'p1', check_name: 'MFA', category: 'identity', status: 'fail', score: 0, details: null, last_checked_at: '2026-02-01' };

  it('reads the events and the posture checks of the organization, in its context', async () => {
    txDouble.queue([event], [check]);

    const dashboard = await loadSecurityDashboard(ORG);

    expect(dashboard.events).toEqual([expect.objectContaining({ id: 'e1', eventType: 'login_failure', severity: 'high', userEmail: 'a@example.org' })]);
    expect(dashboard.posture).toEqual([expect.objectContaining({ checkName: 'MFA', status: 'fail' })]);
    expectOrganizationScoped(2);
    expect(txDouble.statements[0].where?.sql).toMatch(/FROM security_events\s+WHERE organization_id = \$1::uuid/);
    expect(txDouble.statements[1].where?.sql).toMatch(/FROM security_posture_checks\s+WHERE organization_id = \$1::uuid/);
  });

  it('keeps a score of zero: a check that scored nothing is not a check without a score', async () => {
    txDouble.queue([], [check, { ...check, id: 'p2', score: null }, { ...check, id: 'p3', score: '87.5' }]);

    expect((await loadSecurityDashboard(ORG)).posture.map((entry) => entry.score)).toEqual([0, null, 87.5]);
  });

  it.each([
    ['the events', [new Error('permission denied for table security_events')]],
    ['the posture checks', [[event], new Error('permission denied for table security_posture_checks')]],
  ])('rejects, instead of a clean bill of health, when %s cannot be read', async (_case, results) => {
    txDouble.queue(...results);

    await expect(loadSecurityDashboard(ORG)).rejects.toThrow(/permission denied/);
  });
});

describe('the integrations dashboard and the integration settings', () => {
  it('reads the keys, the webhooks and the partners of the organization, in its context', async () => {
    txDouble.queue(
      [{ id: 'k1', name: 'Payroll', key_prefix: 'ue_live', status: 'active', scopes: ['read'], last_used_at: null, expires_at: null, request_count: '12', created_by: 'u1', created_at: '2026-01-01' }],
      [{ id: 'w1', name: 'https://hooks.example.org', url: 'https://hooks.example.org', events: ['claim.created'], status: 'paused', last_triggered_at: null, success_count: '4', failure_count: '1', created_at: '2026-01-01' }],
      [{ id: 'p1', name: 'Payroll partner', provider: 'acme', category: 'payroll', status: 'connected', description: null, icon: null, last_sync_at: null, created_at: '2026-01-01' }],
    );

    const dashboard = await loadIntegrationsDashboard(ORG);

    expect(dashboard.apiKeys).toEqual([expect.objectContaining({ id: 'k1', keyPrefix: 'ue_live', status: 'active', requestCount: 12, scopes: ['read'] })]);
    expect(dashboard.webhooks).toEqual([expect.objectContaining({ id: 'w1', status: 'paused', successCount: 4, failureCount: 1, lastStatus: null })]);
    expect(dashboard.partners).toEqual([expect.objectContaining({ id: 'p1', provider: 'acme', status: 'connected' })]);
    expectOrganizationScoped(3);
    expect(txDouble.statements.map((s) => /FROM (\w+)/.exec(s.where?.sql ?? '')?.[1])).toEqual([
      'integration_api_keys', 'integration_webhooks', 'integration_partners',
    ]);
  });

  it('rejects when a table cannot be read', async () => {
    txDouble.queue([], new Error('permission denied for table integration_webhooks'));

    await expect(loadIntegrationsDashboard(ORG)).rejects.toThrow(/permission denied/);
  });

  it('reads the configurations of the organization and the external-data table counts of the deployment', async () => {
    txDouble.queue(
      [{ id: 'i1', type: 'hris', provider: 'workday', status: 'active', metadata: { region: 'ca' }, created_at: '2026-01-01', updated_at: '2026-01-02' }],
      [{ domain: 'hris', table_count: 3 }, { domain: 'other', table_count: 1 }],
    );

    const settings = await loadIntegrationSettings(ORG);

    expect(settings.configs).toEqual([expect.objectContaining({ id: 'i1', type: 'hris', provider: 'workday', status: 'active', metadata: { region: 'ca' } })]);
    expect(settings.domainStats).toEqual([
      { domain: 'hris', tableCount: 3, totalRows: 0 },
      { domain: 'other', tableCount: 1, totalRows: 0 },
    ]);
    expect(txDouble.contexts).toEqual([{ organizationId: ORG }]);
    expect(txDouble.systemContexts).toBe(0);
    expect(txDouble.statements[0].where?.sql).toMatch(/FROM integration_configs\s+WHERE organization_id = \$1::uuid/);
    // The deployment's own tables, listed whatever the role may read: the catalog, not information_schema.
    expect(txDouble.statements[1].where?.sql).toMatch(/FROM pg_catalog\.pg_tables/);
    expect(txDouble.statements[1].where?.sql).not.toMatch(/information_schema/);
  });

  it('rejects when the configurations cannot be read', async () => {
    txDouble.queue(new Error('permission denied for table integration_configs'));

    await expect(loadIntegrationSettings(ORG)).rejects.toThrow(/permission denied/);
  });
});

describe('the platform settings', () => {
  const organization = { settings: { theme: 'dark' }, features_enabled: ['reports'] };

  it('reads the settings, keys and services of the platform organization the person belongs to', async () => {
    txDouble.queue(
      [organization],
      [{ id: 'k1', name: 'CLC sync', key_prefix: 'ue_live', status: 'revoked', scopes: ['sync'], request_count: 7 }],
      [{ service_name: 'billing', status: 'operational' }],
    );

    const settings = await loadPlatformSettings(ORG);

    expect(settings).toEqual({
      settings: { theme: 'dark' },
      featuresEnabled: ['reports'],
      apiKeys: [{ id: 'k1', name: 'CLC sync', keyPrefix: 'ue_live', status: 'revoked', scopes: ['sync'], requestCount: 7 }],
      services: [{ serviceName: 'billing', status: 'operational' }],
    });
    expect(txDouble.contexts).toEqual([{ organizationId: ORG }]);
    expect(txDouble.systemContexts).toBe(0);
    expect(txDouble.statements[0].where?.sql).toMatch(/WHERE id = \$1::uuid\s+AND organization_type IN \('platform', 'congress'\)/);
    expect(txDouble.statements[1].where?.sql).toMatch(/FROM integration_api_keys k\s+WHERE k\.organization_id = \$1::uuid/);
    expect(txDouble.statements[0].where?.params).toEqual([ORG]);
    expect(txDouble.statements[1].where?.params).toEqual([ORG]);
  });

  it('has no platform settings for an organization that is not a platform one, and reads no key and no service for it', async () => {
    txDouble.queue([]);

    expect(await loadPlatformSettings(ORG)).toBeNull();
    expect(txDouble.statements).toHaveLength(1);
  });

  it('rejects when a table cannot be read', async () => {
    txDouble.queue([organization], new Error('permission denied for table integration_api_keys'));

    await expect(loadPlatformSettings(ORG)).rejects.toThrow(/permission denied/);
  });
});

describe('the data-source overview', () => {
  it('counts every organization as the system role, in one system context and no organization context', async () => {
    txDouble.queue(
      [{ c: 10 }], [{ c: 20 }], [{ c: 30 }], [{ c: 40 }],
      [{ c: 1 }], [{ c: 2 }], [{ c: 3 }], [{ c: 4 }],
      [{ id: 's1', source: 'statcan', status: 'completed' }],
    );

    const overview = await loadDataSourceOverview();

    expect(overview.internalCounts).toEqual({ claims: 10, organization_members: 20, claim_deadlines: 30, dues_assignments: 40 });
    expect(overview.externalCounts).toEqual({ wage_benchmarks: 1, union_density: 2, cost_of_living_data: 3, contribution_rates: 4 });
    expect(overview.totalExternalRecords).toBe(10);
    expect(overview.syncLogs).toEqual([{ id: 's1', source: 'statcan', status: 'completed' }]);
    expect(txDouble.systemContexts).toBe(1);
    expect(txDouble.contexts).toEqual([]);
    expect(txDouble.statements.every((statement) => statement.context === 'system')).toBe(true);
    expect(txDouble.statements.at(-1)?.where?.sql).toMatch(/FROM external_data_sync_log\s+ORDER BY started_at DESC\s+LIMIT 20/);
  });

  it('counts a table with no rows as zero', async () => {
    txDouble.queue([], [{ c: null }]);

    const overview = await loadDataSourceOverview();

    expect(overview.internalCounts.claims).toBe(0);
    expect(overview.internalCounts.organization_members).toBe(0);
  });

  it.each([
    ['a count', [[{ c: 1 }], new Error('permission denied for table claim_deadlines')]],
    ['the sync history', [[{ c: 1 }], [{ c: 1 }], [{ c: 1 }], [{ c: 1 }], [{ c: 1 }], [{ c: 1 }], [{ c: 1 }], [{ c: 1 }], new Error('permission denied for table external_data_sync_log')]],
  ])('rejects, instead of showing zero records and an empty history, when %s cannot be read', async (_case, results) => {
    txDouble.queue(...results);

    await expect(loadDataSourceOverview()).rejects.toThrow(/permission denied/);
  });
});
