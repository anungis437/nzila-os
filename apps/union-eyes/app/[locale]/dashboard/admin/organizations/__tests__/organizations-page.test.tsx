// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import { SWRConfig } from 'swr';
import enCA from '@/messages/en-CA.json';
import OrganizationsPage from '../page';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/hooks/use-organization', () => ({ useOrganization: () => ({ organizationId: 'org-1' }) }));
vi.mock('@/components/organization/organization-breadcrumb', () => ({ OrganizationBreadcrumb: () => null }));
vi.mock('@/components/organization/organization-tree', () => ({ OrganizationTree: () => null }));
vi.mock('@/components/organization/bulk-operations', () => ({ BulkOperations: () => null }));

beforeEach(() => {
  push.mockClear();
  // The filter selects measure their triggers, which jsdom cannot.
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const organization = (overrides: Record<string, unknown>) => ({
  id: 'org-a',
  name: 'Local 100',
  slug: 'local-100',
  organization_type: 'local',
  status: 'active',
  parentName: null,
  ...overrides,
});

type Answer = { ok: boolean; status: number; json: () => Promise<unknown> };
const answer = (body: unknown, status = 200): Answer => ({ ok: status < 400, status, json: async () => body });

function renderPage(respond: (url: string) => Answer | Promise<Answer>) {
  const fetchMock = vi.fn(async (url: string) => respond(url));
  vi.stubGlobal('fetch', fetchMock);
  render(
    <NextIntlClientProvider locale="en-CA" messages={enCA}>
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
        <OrganizationsPage />
      </SWRConfig>
    </NextIntlClientProvider>,
  );
  return fetchMock;
}

const statValue = (label: string) => within(screen.getByText(label).parentElement as HTMLElement).getByText(/^(\d+|—)$/);

describe('OrganizationsPage', () => {
  it('offers no bulk import: no button, no dialog, and nothing sent to the bulk-import route', async () => {
    const fetchMock = renderPage(() => answer({ data: [organization({ memberCount: 40, childCount: 2, activeClaims: 3 })] }));

    expect(await screen.findByText('Local 100')).toBeInTheDocument();
    expect(screen.queryByText(/bulk import/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /import/i })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fetchMock.mock.calls.some(([url]) => url.includes('bulk-import'))).toBe(false);
  });

  it('still adds an organization, from the one button that does', async () => {
    renderPage(() => answer({ data: [organization({ memberCount: 40, childCount: 2, activeClaims: 3 })] }));
    await screen.findByText('Local 100');

    fireEvent.click(screen.getByRole('button', { name: enCA.adminOrganizationsPage.addOrganizationButton }));

    expect(push).toHaveBeenCalledWith('/dashboard/admin/organizations/new');
  });

  it('lists what the server sent, with the counts it reported', async () => {
    const fetchMock = renderPage(() =>
      answer({
        data: [
          organization({ memberCount: 40, childCount: 2, activeClaims: 3 }),
          organization({ id: 'org-b', name: 'Local 200', slug: 'local-200', memberCount: 60, childCount: 0, activeClaims: 0 }),
        ],
      }),
    );

    expect(await screen.findByText('Local 200')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/organizations?include_stats=true');
    expect(statValue(enCA.adminOrganizationsPage.totalOrganizations)).toHaveTextContent('2');
    expect(statValue(enCA.adminOrganizationsPage.totalMembers)).toHaveTextContent('100');
    expect(statValue(enCA.adminOrganizationsPage.activeClaims)).toHaveTextContent('3');
  });

  it('shows a dash, never a zero, for a count the server withheld, and does not total a partial sum', async () => {
    // The list reports member and claim counts only for organizations the caller administers.
    renderPage(() =>
      answer({
        data: [
          organization({ memberCount: 40, childCount: 2, activeClaims: 3 }),
          organization({ id: 'org-b', name: 'Local 200', slug: 'local-200', childCount: 1 }),
        ],
      }),
    );

    const row = (await screen.findByText('Local 200')).closest('tr') as HTMLElement;
    const cells = within(row).getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells.slice(4, 8)).toEqual(['Root', '—', '1', '—']);
    expect(statValue(enCA.adminOrganizationsPage.totalMembers)).toHaveTextContent('—');
    expect(statValue(enCA.adminOrganizationsPage.activeClaims)).toHaveTextContent('—');
  });

  it('says the list failed to load, and shows no row of zeros', async () => {
    renderPage(() => answer({ error: 'Forbidden' }, 403));

    expect(await screen.findByText(enCA.adminOrganizationsPage.failedToLoadOrganizations)).toBeInTheDocument();
    expect(screen.queryByText(enCA.adminOrganizationsPage.totalOrganizations)).toBeNull();
    expect(screen.queryByText(enCA.adminOrganizationsPage.noOrganizationsFound)).toBeNull();
  });

  it('treats an answer in an unknown shape as a failure, not as an empty list', async () => {
    renderPage(() => answer({ organizations: [] }));

    await waitFor(() => expect(screen.getByText(enCA.adminOrganizationsPage.failedToLoadOrganizations)).toBeInTheDocument());
    expect(screen.queryByText(enCA.adminOrganizationsPage.noOrganizationsFound)).toBeNull();
    expect(screen.queryByText(enCA.adminOrganizationsPage.totalOrganizations)).toBeNull();
  });
});
