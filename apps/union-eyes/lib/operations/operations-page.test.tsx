import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import contract from './catalog-authority-contract.json';

const h = vi.hoisted(() => ({
  requireUser: vi.fn(),
  hasMinRole: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  loadPlatformServices: vi.fn(),
  loggerError: vi.fn(),
  withSystemContext: vi.fn(() => {
    throw new Error('withSystemContext must not be used by the operations dashboard');
  }),
  execute: vi.fn(),
  transaction: vi.fn(),
  v2: vi.fn(() => false),
}));

vi.mock('@/lib/api-auth-guard', () => ({ requireUser: h.requireUser, hasMinRole: h.hasMinRole }));
vi.mock('next/navigation', () => ({ redirect: h.redirect }));
vi.mock('next-intl/server', () => ({
  getLocale: async () => 'en-CA',
  getTranslations: async () => (key: string) => key,
}));
vi.mock('@/lib/logger', () => ({ logger: { error: h.loggerError, warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: h.withSystemContext }));
vi.mock('@/db/db', () => ({ db: { execute: h.execute, transaction: h.transaction } }));
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: h.v2 }));

const ROOT = path.resolve(__dirname, '../..');
const PAGE = path.join(ROOT, 'app/[locale]/dashboard/operations/page.tsx');
const HELPER = path.join(ROOT, 'lib/operations/platform-services.ts');

// Comments may explain what the code avoids, so the guards below scan code only.
const codeOf = (file: string) => fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const props = (tab?: string) => ({
  params: Promise.resolve({ locale: 'en-CA' }),
  searchParams: Promise.resolve(tab ? { tab } : {}),
});

async function renderPage(tab?: string) {
  vi.doMock('@/lib/operations/platform-services', async () => {
    const actual = await vi.importActual<typeof import('./platform-services')>('./platform-services');
    return { ...actual, loadPlatformServices: h.loadPlatformServices };
  });
  const { default: Page } = await import('@/app/[locale]/dashboard/operations/page');
  return renderToStaticMarkup(await Page(props(tab)));
}

const SERVICES = {
  services: [
    { serviceName: 'api-gateway', status: 'healthy', updatedAt: '2026-10-20T10:00:00.000Z' },
    { serviceName: 'worker', status: 'degraded', updatedAt: null },
  ],
  totalServices: 2,
  healthyServices: 1,
  degradedServices: 1,
  downServices: 0,
  otherServices: 0,
};

beforeEach(() => {
  vi.resetModules();
  Object.values(h).forEach((fn) => 'mockClear' in fn && (fn as ReturnType<typeof vi.fn>).mockClear());
  h.requireUser.mockResolvedValue({ id: 'user-1' });
  h.hasMinRole.mockResolvedValue(true);
  h.loadPlatformServices.mockResolvedValue(SERVICES);
  h.v2.mockReturnValue(false);
});

describe('operations page authentication and authorization', () => {
  it('shows recorded services to an authenticated platform lead', async () => {
    const html = await renderPage();
    expect(h.hasMinRole).toHaveBeenCalledWith('platform_lead');
    expect(h.loadPlatformServices).toHaveBeenCalledTimes(1);
    expect(html).toContain('api-gateway');
    expect(html).toContain('degraded');
    expect(html).not.toContain('serviceHealthUnavailable');
  });

  it('redirects an authenticated user below platform_lead without reading anything', async () => {
    h.hasMinRole.mockResolvedValue(false);
    await expect(renderPage()).rejects.toThrow('NEXT_REDIRECT:/en-CA/dashboard');
    expect(h.loadPlatformServices).not.toHaveBeenCalled();
  });

  it('does not read operations data for an unauthenticated request', async () => {
    h.requireUser.mockRejectedValue(new Error('Unauthorized'));
    await expect(renderPage()).rejects.toThrow('Unauthorized');
    expect(h.hasMinRole).not.toHaveBeenCalled();
    expect(h.loadPlatformServices).not.toHaveBeenCalled();
  });

  it('never executes the read through withSystemContext', async () => {
    await renderPage();
    expect(h.withSystemContext).not.toHaveBeenCalled();
  });
});

describe('operations page failure handling', () => {
  const denial = Object.assign(new Error('permission denied for table platform_services'), {
    cause: { code: '42501', routine: 'aclcheck_error', message: 'permission denied for table platform_services' },
  });

  for (const tab of [undefined, 'incidents']) {
    it(`shows only a generic translated failure when the read is denied (tab: ${tab ?? 'overview'})`, async () => {
      h.loadPlatformServices.mockRejectedValue(denial);
      const html = await renderPage(tab);
      expect(html).toContain('serviceHealthUnavailable');
      for (const leak of ['permission denied', 'platform_services', 'SELECT', '42501', 'union_eyes', 'aclcheck', 'table']) {
        expect(html, leak).not.toContain(leak);
      }
    });
  }

  it('keeps the diagnostic in the server log only', async () => {
    h.loadPlatformServices.mockRejectedValue(denial);
    await renderPage();
    expect(h.loggerError).toHaveBeenCalledTimes(1);
    expect(h.loggerError.mock.calls[0][1]).toEqual({ error: denial });
  });

  it('does not turn a failed read into an empty or healthy dashboard', async () => {
    h.loadPlatformServices.mockRejectedValue(denial);
    const html = await renderPage();
    expect(html).not.toContain('noServicesRecorded');
    expect(html).not.toContain('allServicesHealthy');
    expect(html).not.toContain('0/0');
    expect(html).not.toContain('systemHealthTitle');
  });

  it('still reports a genuinely empty table as empty, not as a failure', async () => {
    h.loadPlatformServices.mockResolvedValue({ ...SERVICES, services: [], totalServices: 0, healthyServices: 0, degradedServices: 0 });
    const html = await renderPage();
    expect(html).toContain('noServicesRecorded');
    expect(html).not.toContain('serviceHealthUnavailable');
  });
});

describe('platform services read path', () => {
  it('reads on the application connection (runtime identity) outside the V2 context', async () => {
    h.execute.mockResolvedValue([{ service_name: 'a', status: 'healthy', updated_at: null }]);
    const { loadPlatformServices } = await vi.importActual<typeof import('./platform-services')>('./platform-services');
    const overview = await loadPlatformServices();
    expect(h.execute).toHaveBeenCalledTimes(1);
    expect(h.transaction).not.toHaveBeenCalled();
    expect(h.withSystemContext).not.toHaveBeenCalled();
    expect(overview).toMatchObject({ totalServices: 1, healthyServices: 1 });
  });

  it('drops to the runtime role inside a transaction under the V2 context', async () => {
    h.v2.mockReturnValue(true);
    const txExecute = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ service_name: 'a', status: 'down', updated_at: null }]);
    h.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({ execute: txExecute }));
    const { loadPlatformServices } = await vi.importActual<typeof import('./platform-services')>('./platform-services');
    const overview = await loadPlatformServices();
    expect(txExecute).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(txExecute.mock.calls[0])).toContain('SET LOCAL ROLE union_eyes_runtime');
    expect(h.execute).not.toHaveBeenCalled();
    expect(overview.downServices).toBe(1);
  });

  it('propagates a database failure instead of returning an empty overview', async () => {
    h.execute.mockRejectedValue(new Error('permission denied for table platform_services'));
    const { loadPlatformServices } = await vi.importActual<typeof import('./platform-services')>('./platform-services');
    await expect(loadPlatformServices()).rejects.toThrow('permission denied');
  });

  it('classifies statuses and keeps unrecorded statuses visible', async () => {
    const { summarizePlatformServices } = await vi.importActual<typeof import('./platform-services')>('./platform-services');
    const overview = summarizePlatformServices([
      { service_name: 'a', status: 'healthy', updated_at: null },
      { service_name: 'b', status: 'down', updated_at: new Date('2026-10-20T00:00:00Z') },
      { service_name: 'c', status: 'maintenance', updated_at: null },
    ]);
    expect(overview).toMatchObject({ totalServices: 3, healthyServices: 1, downServices: 1, otherServices: 1 });
  });
});

describe('platform_services physical authority contract', () => {
  const entry = contract.payload.entries.find((candidate) => candidate.table === 'platform_services');

  it('is granted to the runtime role for SELECT only, and not to the system role', () => {
    expect(entry?.classification).toBe('GLOBAL_REFERENCE_DATA');
    expect(entry?.runtime).toEqual(['SELECT']);
    expect(entry?.system).toEqual([]);
  });

  it('the page and its helper never use a system-role execution path', () => {
    for (const file of [PAGE, HELPER]) {
      const source = codeOf(file);
      expect(source, file).not.toMatch(/withSystemContext|withSystemRLSContext|withPlatformAdminRLSContext|systemDb|SYSTEM_DATABASE_URL|union_eyes_system/);
    }
  });

  it('the helper reads only tables the runtime role is granted', () => {
    const source = codeOf(HELPER);
    const tables = [...source.matchAll(/\bFROM\s+([a-z_]+)/gi)].map((match) => match[1]);
    expect(tables).toEqual(['platform_services']);
    for (const table of tables) {
      const granted = contract.payload.entries.find((candidate) => candidate.table === table);
      expect(granted?.runtime, table).toContain('SELECT');
    }
  });

  it('does not render the raw error text anywhere in the page source', () => {
    const source = codeOf(PAGE);
    expect(source).not.toMatch(/readError/);
    expect(source).not.toMatch(/error\.message/);
  });
});