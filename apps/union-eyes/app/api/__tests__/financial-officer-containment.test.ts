import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLE_HIERARCHY, PLATFORM_ELEVATED_ROLES } from '@/lib/api-auth-guard';
import { hasPermission, Permission, UserRole as RbacRole } from '@/lib/auth/roles';
import { FINANCIAL_MEMBER_DATA_ROLES } from '@/lib/finance/financial-authority';

// Passthrough so route handlers can be invoked directly; auth config is checked statically below.
const m = vi.hoisted(() => ({
  withApi: vi.fn((_cfg: unknown, handler: (ctx: unknown) => unknown) => handler),
}));
vi.mock('@/lib/api/with-api', () => ({ withApi: m.withApi }));
vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: {} }));
vi.mock('@/lib/api/deprecation', () => ({ logDeprecatedAccess: vi.fn() }));
vi.mock('@/db/db', () => ({ db: {} }));
vi.mock('@/db/schema', () => ({ pensionTrustees: {} }));

const API_ROOT = join(__dirname, '..');
const read = (rel: string) => readFileSync(join(API_ROOT, rel), 'utf8');
const importsOnly = (source: string) => source.split('\n').filter((line) => /^\s*(import|export \{)/.test(line)).join('\n');

async function expectNotImplemented(handler: unknown, capability: string) {
  const response = await (handler as (ctx: unknown) => Promise<Response>)({
    request: new Request('http://localhost/x', { method: 'POST' }),
  });
  expect(response.status).toBe(501);
  const body = await response.json();
  expect(body.capabilityState).toBe('NOT_IMPLEMENTED');
  expect(body.success).toBe(false);
  expect(body.capability).toBe(capability);
}

describe('financial authority allow-list', () => {
  it('equals the organizational roles holding MANAGE_FINANCES in the RBAC matrix', () => {
    const derived = (Object.keys(ROLE_HIERARCHY) as Array<keyof typeof ROLE_HIERARCHY>)
      .filter((role) => !(PLATFORM_ELEVATED_ROLES as readonly string[]).includes(role))
      .filter((role) => (Object.values(RbacRole) as string[]).includes(role))
      .filter((role) => hasPermission(role as RbacRole, Permission.MANAGE_FINANCES));
    expect([...FINANCIAL_MEMBER_DATA_ROLES].sort()).toEqual([...derived].sort());
  });

  it('excludes stewards, officers, presidents, admins and platform roles', () => {
    for (const role of ['member', 'steward', 'chief_steward', 'officer', 'president', 'admin', 'vice_president', 'system_admin', 'clc_executive', 'national_officer']) {
      expect(FINANCIAL_MEMBER_DATA_ROLES as string[]).not.toContain(role);
    }
  });
});

describe('member financial data routes use the financial allow-list, not role level', () => {
  const guarded = [
    'dues/arrears/route.ts',
    'dues/arrears/calculate/route.ts',
    'dues/arrears/[id]/reminder/route.ts',
    'dues/exceptions/route.ts',
    'dues/dashboard/route.ts',
    'dues/ledger/route.ts',
    'dues/billing-cycle/route.ts',
    'dues/late-fees/route.ts',
    'dues/payment-plans/route.ts',
    'dues/reconcile/route.ts',
    'dues/reconciliation/auto-match/route.ts',
    'dues/reconciliation/match/route.ts',
    'dues/reconciliation/queue/route.ts',
    'dues/reconciliation/reject/route.ts',
    'dues/remittances/route.ts',
    'dues/remittances/[id]/route.ts',
    'dues/remittances/upload/route.ts',
  ];

  it.each(guarded)('%s has no minRole-based auth block', (rel) => {
    const source = read(rel);
    const authBlocks = source.match(/auth:\s*\{[^}]*\}/g) ?? [];
    expect(authBlocks.length).toBeGreaterThan(0);
    for (const block of authBlocks) {
      expect(block).toContain('roles: FINANCIAL_MEMBER_DATA_ROLES');
      expect(block).not.toMatch(/minRole/);
    }
  });
});

describe('money-moving routes are decided by the authority kernel, not by a role', () => {
  // dues/arrears/[id]/payment left the role allow-list above when it adopted the kernel execute duty (UE-CONV-D-001).
  const kernelDecided = [
    ['dues/arrears/[id]/payment/route.ts', /lib\/dues\/arrears-payment/],
    ['payments/[id]/duties/route.ts', /lib\/authority\/store\/finance-route-adapter/],
  ] as const;

  it.each(kernelDecided)('%s has no role or role-level gate and asks the kernel', (rel, adapter) => {
    const source = read(rel);
    const authBlocks = source.match(/auth:\s*\{[^}]*\}/g) ?? [];
    expect(authBlocks.length).toBeGreaterThan(0);
    for (const block of authBlocks) expect(block).not.toMatch(/roles|minRole/);
    expect(source).not.toContain('FINANCIAL_MEMBER_DATA_ROLES');
    expect(source).toMatch(adapter);
  });

  it('the adapter and the arrears posting never read a role, a role level or a title', () => {
    for (const file of ['../../lib/authority/store/finance-route-adapter.ts', '../../lib/dues/arrears-payment.ts']) {
      const source = readFileSync(join(API_ROOT, file), 'utf8');
      expect(source, file).not.toMatch(/ROLE_HIERARCHY|minRole|withMinRole|FINANCIAL_MEMBER_DATA_ROLES|secretary_treasurer/);
    }
  });
});

describe('misbound and unqualified financial routes answer 501, never 200', () => {
  beforeEach(() => vi.clearAllMocks());

  it('strike routes no longer reference voting sessions', () => {
    for (const rel of ['strike/funds/route.ts', 'strike/disbursements/route.ts', 'strike/stipends/route.ts', 'strike/eligibility/route.ts', 'strike/picket-lines/route.ts']) {
      const source = importsOnly(read(rel));
      expect(source).not.toMatch(/votingSessions|crudRoutes/);
    }
  });

  it('CLC remittance routes no longer reference organization members', () => {
    for (const rel of ['admin/clc/remittances/route.ts', 'admin/clc/remittances/[id]/route.ts', 'admin/clc/remittances/export/route.ts', 'admin/clc/remittances/[id]/export/route.ts', 'admin/clc/remittances/[id]/submit/route.ts']) {
      const source = importsOnly(read(rel));
      expect(source).not.toMatch(/organizationMembers|crudRoutes/);
      expect(read(rel)).not.toContain("status: 'accepted'");
    }
  });

  it('strike funds', async () => {
    const mod = await import('../strike/funds/route');
    await expectNotImplemented(mod.GET, 'strike-funds');
    await expectNotImplemented(mod.POST, 'strike-funds');
  });

  it('strike disbursements, stipends, eligibility and picket lines', async () => {
    await expectNotImplemented((await import('../strike/disbursements/route')).POST, 'strike-disbursements');
    await expectNotImplemented((await import('../strike/stipends/route')).POST, 'strike-stipends');
    await expectNotImplemented((await import('../strike/eligibility/route')).POST, 'strike-eligibility');
    await expectNotImplemented((await import('../strike/picket-lines/route')).POST, 'strike-picket-lines');
  });

  it('CLC remittances (collection, item, export, submit)', async () => {
    const collection = await import('../admin/clc/remittances/route');
    await expectNotImplemented(collection.GET, 'affiliate-remittances');
    await expectNotImplemented(collection.POST, 'affiliate-remittances');
    const item = await import('../admin/clc/remittances/[id]/route');
    await expectNotImplemented(item.PATCH, 'affiliate-remittances');
    await expectNotImplemented(item.DELETE, 'affiliate-remittances');
    await expectNotImplemented((await import('../admin/clc/remittances/export/route')).POST, 'affiliate-remittance-export');
    await expectNotImplemented((await import('../admin/clc/remittances/[id]/export/route')).POST, 'affiliate-remittance-export');
    await expectNotImplemented((await import('../admin/clc/remittances/[id]/submit/route')).POST, 'affiliate-remittance-submission');
  });

  it('retired budgets, expenses and vendors never return a 2xx deprecation payload', async () => {
    await expectNotImplemented((await import('../financial/budgets/route')).POST, 'union-budgets');
    await expectNotImplemented((await import('../financial/budgets/[id]/route')).PATCH, 'union-budgets');
    await expectNotImplemented((await import('../financial/expenses/route')).POST, 'union-expenses');
    await expectNotImplemented((await import('../financial/expenses/[id]/route')).PATCH, 'union-expenses');
    await expectNotImplemented((await import('../financial/vendors/route')).POST, 'union-vendors');
    await expectNotImplemented((await import('../financial/vendors/[id]/route')).DELETE, 'union-vendors');
  });

  it('retired finance routes do not point at Nzila billing reports as a replacement', () => {
    for (const rel of ['financial/budgets/route.ts', 'financial/expenses/route.ts', 'financial/vendors/route.ts']) {
      expect(read(rel)).not.toContain('/api/billing/reports');
    }
  });

  it('pension trustee mutations fail closed for every role, including steward', async () => {
    const collection = await import('../pension/trustees/route');
    await expectNotImplemented(collection.POST, 'pension-trustee-appointment');
    const item = await import('../pension/trustees/[id]/route');
    await expectNotImplemented(item.PATCH, 'pension-trustee-administration');
    await expectNotImplemented(item.DELETE, 'pension-trustee-administration');
  });
});
