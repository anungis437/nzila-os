import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], configs: [] as Array<Record<string, unknown>> }));

vi.mock('@/lib/api/framework', () => ({
  withApi: (config: Record<string, unknown>, handler: (ctx: unknown) => Promise<unknown>) => { m.configs.push(config); return handler; },
  ApiError: { badRequest: (msg: string) => new Error(msg), notFound: (msg: string) => new Error(`${msg} not found`) },
}));
vi.mock('@/db/db', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => m.rows }) }) }) },
}));
vi.mock('@/db/schema/integration-schema', () => ({ apiIntegrations: { id: 'id', organizationId: 'organization_id' } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: vi.fn() }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn() }));

describe('extensions/[id] GET', () => {
  beforeEach(() => {
    m.configs.length = 0;
    m.rows = [{
      id: 'i1', organizationId: 'org-1', name: 'Payroll', provider: 'ADP', credentials: { token: 'secret' },
      sftpHost: 'sftp.example.test', sftpPort: 22, sftpPath: '/in', apiEndpoint: 'https://api.example.test', fieldMapping: {},
    }];
  });

  // DEF-0B7-PLT-EXT-GET-RETURNS-WHOLE-INTEGRATION-ROW-WITH-CREDENTIALS
  it('is an administrator read and returns no credentials or SFTP location', async () => {
    const { GET } = await import('../extensions/[id]/route');
    const result = await (GET as any)({ params: { id: 'i1' }, organizationId: 'org-1' });
    expect(m.configs[0]).toMatchObject({ auth: { required: true, minRole: 'admin' } });
    expect(result).toMatchObject({ id: 'i1', name: 'Payroll', provider: 'ADP' });
    for (const key of ['credentials', 'sftpHost', 'sftpPort', 'sftpPath']) expect(result).not.toHaveProperty(key);
  });
});
