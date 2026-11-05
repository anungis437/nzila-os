// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { createTranslator } from 'next-intl';
import enCA from '../../../../../messages/en-CA.json';
import frCA from '../../../../../messages/fr-CA.json';

const m = vi.hoisted(() => ({
  role: 'fed_staff' as string,
  organizationId: 'fed-org' as string | null,
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  }),
  listAffiliates: vi.fn(),
  loadRemittanceFacts: vi.fn(),
  loadRemittanceMetrics: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ requireUser: vi.fn(async () => ({ userId: 'user-1', organizationId: m.organizationId })) }));
vi.mock('next/navigation', () => ({ redirect: m.redirect }));
vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async (input: string | { locale: string; namespace: string }) => {
    const locale = typeof input === 'string' ? 'en-CA' : input.locale;
    const namespace = typeof input === 'string' ? input : input.namespace;
    return createTranslator({ locale, namespace, messages: locale === 'fr-CA' ? frCA : enCA } as never);
  }),
}));
vi.mock('@/lib/organization-utils', () => ({ getUserRoleInOrganization: vi.fn(async () => m.role) }));
vi.mock('@/lib/organizations/affiliates', () => ({ listAffiliates: m.listAffiliates }));
vi.mock('@/lib/organizations/per-capita-standing', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/organizations/per-capita-standing')>()),
  loadRemittanceFacts: m.loadRemittanceFacts,
  loadRemittanceMetrics: m.loadRemittanceMetrics,
}));

import FederationDashboardPage from '../page';
import FederationAffiliatesPage from '../affiliates/page';
import FederationRemittancesPage from '../remittances/page';
import { summarizeRemittances } from '@/lib/organizations/per-capita-standing';

const fact = (overrides: Record<string, unknown> = {}) => ({
  fromOrganizationId: 'aff-a',
  remittanceYear: 2026,
  remittanceMonth: 4,
  status: 'paid',
  remittableMembers: 100,
  totalAmount: '1000.00',
  submittedAt: '2026-04-10',
  overdue: false,
  fellDueInLastYear: true,
  submittedOnTime: true,
  inCurrentYear: true,
  ...overrides,
});

const affiliate = (overrides: Record<string, unknown> = {}) => ({
  id: 'aff-a',
  name: 'Local 100',
  organizationType: 'local',
  provinceTerritory: 'ON',
  clcAffiliateCode: 'L-100',
  email: 'office@local100.test',
  phone: '555-0100',
  address: '1 Main St, Toronto',
  description: null,
  status: 'active',
  memberCount: 120,
  ...overrides,
});

const params = (locale = 'en-CA') => ({ params: Promise.resolve({ locale }) });
const withSearch = (search: Record<string, string | string[]> = {}, locale = 'en-CA') => ({ ...params(locale), searchParams: Promise.resolve(search) });

beforeEach(() => {
  m.role = 'fed_staff';
  m.organizationId = 'fed-org';
  m.redirect.mockClear();
  m.listAffiliates.mockReset();
  m.loadRemittanceFacts.mockReset();
  m.loadRemittanceMetrics.mockReset();
});
afterEach(() => cleanup());

describe('the federation remittances page', () => {
  const facts = () => [
    fact(),
    fact({ fromOrganizationId: 'aff-b', status: 'pending', overdue: true, submittedAt: null, submittedOnTime: false, remittableMembers: 50 }),
    fact({ fromOrganizationId: 'aff-c', status: 'pending', remittableMembers: 25, fellDueInLastYear: false }),
  ];

  it('says dues are handled in an external system and shows only counts taken from the records that reached the organization', async () => {
    m.loadRemittanceFacts.mockResolvedValue(facts());
    render(await FederationRemittancesPage(params()));

    expect(screen.getByRole('note')).toHaveTextContent('Dues are handled in an external system');
    expect(screen.getByRole('note')).toHaveTextContent('does not collect, calculate, submit, reconcile or export remittances');
    expect(summarizeRemittances(facts())).toMatchObject({ pendingRemittances: 2, overdueRemittances: 1, totalMembers: 175, complianceRate: 50 });
    const card = (title: string) => screen.getByText(title).closest('div[class*="rounded"]') as HTMLElement;
    expect(within(card('Pending')).getByText('2')).toBeInTheDocument();
    expect(within(card('Overdue')).getByText('1')).toBeInTheDocument();
    expect(within(card('Members')).getByText('175')).toBeInTheDocument();
    expect(within(card('Submitted on time')).getByText('50%')).toBeInTheDocument();
    expect(screen.getByText(/1 remittance is still pending after the due date/)).toBeInTheDocument();
  });

  it('offers no filter, export, amount or action: it reflects data and nothing else', async () => {
    m.loadRemittanceFacts.mockResolvedValue([fact()]);
    const { container } = render(await FederationRemittancesPage(params()));
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    // Outside the notice, which says what the page does not do, no word of the page offers a filter, an export or an amount.
    const page = container.cloneNode(true) as HTMLElement;
    page.querySelector('[role="note"]')?.remove();
    expect(page.textContent).not.toMatch(/export|download|\$|filters|apply|collection|generated automatically/i);
    expect([...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      '/en-CA/dashboard/federation',
      '/en-CA/dashboard/federation/affiliates',
    ]);
  });

  it('says so when no remittance record has reached the organization, instead of showing zeros', async () => {
    m.loadRemittanceFacts.mockResolvedValue([]);
    render(await FederationRemittancesPage(params()));
    expect(screen.getByText('No remittance records')).toBeInTheDocument();
    expect(screen.queryByText('Pending')).not.toBeInTheDocument();
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
  });

  it('shows no rate when nothing fell due in the last twelve months', async () => {
    m.loadRemittanceFacts.mockResolvedValue([fact({ fellDueInLastYear: false, status: 'pending' })]);
    render(await FederationRemittancesPage(params()));
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('No remittance fell due in the last 12 months')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('is an error when the records cannot be read, never a row of zeros', async () => {
    m.loadRemittanceFacts.mockRejectedValue(new Error('permission denied for table per_capita_remittances'));
    await expect(FederationRemittancesPage(params())).rejects.toThrow(/permission denied/);
  });

  it('turns away a person without a federation role, and one without an organization', async () => {
    m.role = 'steward';
    await expect(FederationRemittancesPage(params())).rejects.toThrow('NEXT_REDIRECT /en-CA/dashboard');
    m.role = 'fed_staff';
    m.organizationId = null;
    await expect(FederationRemittancesPage(params())).rejects.toThrow('NEXT_REDIRECT /en-CA/dashboard');
    expect(m.loadRemittanceFacts).not.toHaveBeenCalled();
  });

  it('is in French on request', async () => {
    m.loadRemittanceFacts.mockResolvedValue([fact()]);
    render(await FederationRemittancesPage(params('fr-CA')));
    expect(screen.getByRole('note')).toHaveTextContent('Les cotisations sont gérées dans un système externe');
    expect(screen.getByText('Soumises à temps')).toBeInTheDocument();
  });
});

describe('the federation affiliates page', () => {
  const rows = () => [
    affiliate(),
    affiliate({ id: 'aff-b', name: 'Teachers Union', organizationType: 'union', clcAffiliateCode: null, email: 'info@teachers.test', phone: null, address: null, status: 'inactive', memberCount: 1 }),
    affiliate({ id: 'aff-c', name: 'Nurses Local', clcAffiliateCode: 'N-7', email: null, phone: null, address: null, memberCount: 40 }),
  ];
  // Each affiliate is headed by an h3 of its own size; the cards of the page use the same element at another size.
  const names = (container: HTMLElement) => [...container.querySelectorAll('h3.text-lg')].map((heading) => heading.textContent);

  it('lists every affiliate with what is on file, counts by type, and no chapters or export', async () => {
    m.listAffiliates.mockResolvedValue(rows());
    const { container } = render(await FederationAffiliatesPage(withSearch()));
    expect(names(container)).toEqual(['Local 100', 'Teachers Union', 'Nurses Local']);
    expect(screen.getByText('office@local100.test')).toBeInTheDocument();
    expect(screen.getByText('1 Main St, Toronto')).toBeInTheDocument();
    expect(screen.getByText('120 active members')).toBeInTheDocument();
    expect(screen.getByText('1 active member')).toBeInTheDocument();
    expect(screen.getByText('3 organizations')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/chapter|export/i);
    const summary = container.querySelector('div.grid.gap-4') as HTMLElement;
    const card = (title: string) => within(summary).getByText(title).closest('div[class*="rounded"]') as HTMLElement;
    expect(within(card('Locals')).getByText('2')).toBeInTheDocument();
    expect(within(card('Unions')).getByText('1')).toBeInTheDocument();
  });

  it('is a form that filters by the address, with the choices the affiliates really have', async () => {
    m.listAffiliates.mockResolvedValue(rows());
    const { container } = render(await FederationAffiliatesPage(withSearch()));
    const form = container.querySelector('form') as HTMLFormElement;
    expect(form).toHaveAttribute('method', 'get');
    expect(within(form).getByRole('button', { name: 'Apply Filters' })).toHaveAttribute('type', 'submit');
    expect(within(form).getByRole('textbox', { name: 'Search affiliates...' })).toHaveAttribute('name', 'q');
    const type = within(form).getByRole('combobox', { name: 'Organization Type' });
    expect(type).toHaveAttribute('name', 'type');
    expect(within(type).getAllByRole('option').map((option) => option.textContent)).toEqual(['All Types', 'Locals', 'Unions']);
    const status = within(form).getByRole('combobox', { name: 'Status' });
    expect(within(status).getAllByRole('option').map((option) => option.textContent)).toEqual(['All Statuses', 'Active', 'Inactive']);
    expect(screen.queryByRole('link', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('keeps the filter in the form, shows only what matches, and counts against the total', async () => {
    m.listAffiliates.mockResolvedValue(rows());
    const { container } = render(await FederationAffiliatesPage(withSearch({ type: 'local', q: 'nurses' })));
    expect(names(container)).toEqual(['Nurses Local']);
    expect(screen.getByText('Showing 1 of 3 organizations')).toBeInTheDocument();
    expect((container.querySelector('input[name="q"]') as HTMLInputElement).defaultValue).toBe('nurses');
    expect((container.querySelector('select[name="type"]') as HTMLSelectElement).value).toBe('local');
    expect(screen.getByRole('link', { name: 'Clear' })).toHaveAttribute('href', '/en-CA/dashboard/federation/affiliates');
  });

  it('distinguishes an organization with no affiliates from a filter that matches none', async () => {
    m.listAffiliates.mockResolvedValue(rows());
    render(await FederationAffiliatesPage(withSearch({ q: 'zzz' })));
    expect(screen.getByText('No affiliated organizations match the current filters')).toBeInTheDocument();
    cleanup();

    m.listAffiliates.mockResolvedValue([]);
    render(await FederationAffiliatesPage(withSearch()));
    expect(screen.getByText('This organization has no affiliated organizations.')).toBeInTheDocument();
  });

  it('marks an affiliate that is not active, and is an error when the list cannot be read', async () => {
    m.listAffiliates.mockResolvedValue(rows());
    const { container } = render(await FederationAffiliatesPage(withSearch()));
    const marks = [...container.querySelectorAll('h3.text-lg')].map((heading) => within(heading.parentElement as HTMLElement).queryByText('Inactive') !== null);
    expect(marks).toEqual([false, true, false]);
    cleanup();

    m.listAffiliates.mockRejectedValue(new Error('Not an administrator of this organization'));
    await expect(FederationAffiliatesPage(withSearch())).rejects.toThrow(/Not an administrator/);
  });

  it('turns away a person without a federation role', async () => {
    m.role = 'member';
    await expect(FederationAffiliatesPage(withSearch())).rejects.toThrow('NEXT_REDIRECT /en-CA/dashboard');
    expect(m.listAffiliates).not.toHaveBeenCalled();
  });
});

describe('the federation dashboard', () => {
  it('links to pages that act on what they are linked with: no remittance filter that the page does not have, and a member union that the list can find', async () => {
    m.listAffiliates.mockResolvedValue([affiliate({ name: 'Local & Sons' })]);
    m.loadRemittanceMetrics.mockResolvedValue({ totalMembers: 120, pendingRemittances: 1, overdueRemittances: 1, complianceRate: null, totalRevenue: 0 });
    const { container } = render(await FederationDashboardPage(params()));
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.filter((href) => href.includes('remittances')).every((href) => href === '/en-CA/dashboard/federation/remittances')).toBe(true);
    expect(hrefs).toContain('/en-CA/dashboard/federation/affiliates?q=Local%20%26%20Sons');
    expect(hrefs.some((href) => href.includes('?id=') || href.includes('filter='))).toBe(false);
  });
});
