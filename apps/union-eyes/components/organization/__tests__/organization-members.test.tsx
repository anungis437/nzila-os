// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Radix selects measure elements that jsdom does not implement.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

const intl = vi.hoisted(() => ({ locale: 'en-CA' }));
vi.mock('next-intl', () => ({ useLocale: () => intl.locale }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { OrganizationMembers } from '../organization-members';

// A roster row exactly as GET /api/organizations/{id}/members sends it.
const row = (overrides: Record<string, unknown>) => ({
  id: 'm-1',
  user_id: 'user-1',
  organization_id: 'org-1',
  role: 'steward',
  status: 'active',
  name: 'Amara Singh',
  email: 'amara@example.org',
  phone: null,
  department: 'Maintenance',
  membership_number: 'M-100',
  is_primary: true,
  created_at: '2025-01-10T12:00:00.000Z',
  joined_at: '2025-02-01T12:00:00.000Z',
  updated_at: '2025-02-01T12:00:00.000Z',
  ...overrides,
});

const requested: string[] = [];
const realFetch = globalThis.fetch;

function answer(handler: (url: string) => { status: number; body: unknown }) {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    const { status, body } = handler(url);
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
}

beforeEach(() => {
  requested.length = 0;
  intl.locale = 'en-CA';
});
afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
});

describe('OrganizationMembers', () => {
  it('shows the roster the route sends, with real names and joined dates', async () => {
    answer(() => ({
      status: 200,
      body: {
        data: [
          row({}),
          row({ id: 'm-2', user_id: 'user-2', role: 'member', name: null, email: 'lee@example.org', joined_at: null, created_at: '2025-03-05T12:00:00.000Z' }),
          row({ id: 'm-3', user_id: 'user-3', name: null, email: null, created_at: null, joined_at: null }),
        ],
        page: 1,
        limit: 200,
      },
    }));
    render(<OrganizationMembers organizationId="org-1" />);
    expect(await screen.findByText('Amara Singh')).toBeInTheDocument();
    expect(screen.getByText('amara@example.org')).toBeInTheDocument();
    expect(screen.getByText(new Date('2025-02-01T12:00:00.000Z').toLocaleDateString())).toBeInTheDocument();
    // No name: the email stands in, and the date falls back to when the row was created.
    expect(screen.getByText('lee@example.org')).toBeInTheDocument();
    expect(screen.getByText(new Date('2025-03-05T12:00:00.000Z').toLocaleDateString())).toBeInTheDocument();
    // No name and no email: the user id, and no date rather than an invalid one.
    expect(screen.getByText('user-3')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).toBeNull();
    expect(screen.getByText('3 total members')).toBeInTheDocument();
  });

  it('offers no transfer, no selection, and never calls the bulk-transfer route', async () => {
    answer(() => ({ status: 200, body: { data: [row({}), row({ id: 'm-2', user_id: 'user-2', name: 'Lee Park' })], page: 1, limit: 200 } }));
    render(<OrganizationMembers organizationId="org-1" />);
    await screen.findByText('Amara Singh');
    expect(screen.queryByRole('button', { name: /transfer/i })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText(/selected/i)).toBeNull();
    expect(requested.join(' ')).not.toContain('bulk-transfer');
    expect(requested).toEqual(['/api/organizations/org-1/members?limit=200&page=1']);
  });

  it('reads every page of a large roster', async () => {
    const page = (count: number, first: number) => Array.from({ length: count }, (_, i) => row({ id: `m-${first + i}`, user_id: `user-${first + i}`, name: `Member ${first + i}`, email: null }));
    answer((url) => ({ status: 200, body: { data: url.endsWith('page=1') ? page(200, 1) : page(3, 201) } }));
    render(<OrganizationMembers organizationId="org-1" />);
    expect(await screen.findByText('203 total members')).toBeInTheDocument();
    expect(requested).toEqual([
      '/api/organizations/org-1/members?limit=200&page=1',
      '/api/organizations/org-1/members?limit=200&page=2',
    ]);
  });

  it('filters by name or email', async () => {
    answer(() => ({ status: 200, body: { data: [row({}), row({ id: 'm-2', user_id: 'user-2', name: 'Lee Park', email: 'lee@example.org', role: 'member' })] } }));
    render(<OrganizationMembers organizationId="org-1" />);
    await screen.findByText('Amara Singh');
    fireEvent.change(screen.getByPlaceholderText('Search members...'), { target: { value: 'lee@' } });
    expect(screen.queryByText('Amara Singh')).toBeNull();
    expect(screen.getByText('Lee Park')).toBeInTheDocument();
  });

  it('says the list could not be loaded instead of showing "No members found"', async () => {
    answer(() => ({ status: 500, body: { code: 'INTERNAL_ERROR' } }));
    render(<OrganizationMembers organizationId="org-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The member list could not be loaded.');
    expect(screen.queryByText('No members found')).toBeNull();
  });

  it('retries a failed load', async () => {
    let attempts = 0;
    answer(() => (++attempts === 1 ? { status: 500, body: {} } : { status: 200, body: { data: [row({})] } }));
    render(<OrganizationMembers organizationId="org-1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Amara Singh')).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it('treats a body without a member list as a failure', async () => {
    answer(() => ({ status: 200, body: { members: [] } }));
    render(<OrganizationMembers organizationId="org-1" />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('speaks French on a French locale', async () => {
    intl.locale = 'fr-CA';
    answer(() => ({ status: 500, body: {} }));
    render(<OrganizationMembers organizationId="org-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('La liste des membres n’a pas pu être chargée.');
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it('exports the rows shown as CSV with the real columns', async () => {
    answer(() => ({ status: 200, body: { data: [row({}), row({ id: 'm-2', user_id: 'user-2', name: '=SUM(A1)', email: 'x@example.org' })] } }));
    const blobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => { blobs.push(blob); return 'blob:members'; });
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<OrganizationMembers organizationId="org-1" />);
    await screen.findByText('Amara Singh');
    fireEvent.click(screen.getByRole('button', { name: /export/i }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const csv = await blobs[0].text();
    const [header, first, second] = csv.split('\n');
    expect(header).toBe('Name,Email,Role,Status,Department,Membership Number,Joined Date');
    expect(first).toBe('Amara Singh,amara@example.org,steward,active,Maintenance,M-100,2025-02-01T12:00:00.000Z');
    // A spreadsheet formula in a name is neutralised.
    expect(second.startsWith("'=SUM(A1),")).toBe(true);
    click.mockRestore();
  });
});
