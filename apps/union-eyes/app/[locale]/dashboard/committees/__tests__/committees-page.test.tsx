// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { installFetch, type Answer, type Call } from '@/components/union-structure/__tests__/fetch-harness';

interface OrganizationContext {
  organizationId: string | null;
  organization: { id: string } | null;
  userOrganizations: { id: string }[];
  isLoading: boolean;
  error: string | null;
  refreshOrganizations: () => Promise<void>;
}

const context = vi.hoisted(() => ({ value: {} as OrganizationContext }));

vi.mock('@/contexts/organization-context', () => ({ useOrganization: () => context.value }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
vi.mock('@/components/union-structure/CommitteeManagement', () => ({
  CommitteeManagement: function CommitteeManagementStub({ organizationId, readOnly }: { organizationId: string; readOnly: boolean }) {
    return <div data-testid="committee-management" data-organization={organizationId} data-readonly={String(readOnly)} />;
  },
}));

import { CommitteesPage } from '../committees-page';

const ok = (body: unknown): Answer => ({ status: 200, body });

let profile: Answer;
let calls: Call[];

const idle = (): OrganizationContext => ({
  organizationId: null,
  organization: null,
  userOrganizations: [],
  isLoading: false,
  error: null,
  refreshOrganizations: vi.fn(async () => {}),
});

beforeEach(() => {
  context.value = idle();
  profile = ok({ user: { id: 'user-1' }, organization: { id: 'org-9', name: 'Local 9', slug: 'local-9', type: 'union' }, role: 'member' });
  calls = installFetch(({ url, method }) => {
    if (method === 'GET' && url === '/api/users/me/profile') return profile;
    throw new Error(`unexpected request ${method} ${url}`);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderPage = (userRole = 'steward') => render(<CommitteesPage userRole={userRole} />);
const management = () => screen.getByTestId('committee-management');

describe('CommitteesPage: an organization the context already has', () => {
  it.each([
    ['its selected organization', { organizationId: 'org-1' }, 'org-1'],
    ['its organization record', { organization: { id: 'org-2' } }, 'org-2'],
    ['the first organization of the user', { userOrganizations: [{ id: 'org-3' }] }, 'org-3'],
  ])('manages the committees of %s, without asking the profile', (_what, values, expected) => {
    context.value = { ...idle(), ...values };
    renderPage();

    expect(management()).toHaveAttribute('data-organization', expected);
    expect(calls).toEqual([]);
  });

  it.each([
    ['member', true],
    ['steward', false],
    ['officer', false],
    ['admin', false],
  ])('opens the committees of a %s with read-only %s', (role, readOnly) => {
    context.value = { ...idle(), organizationId: 'org-1' };
    renderPage(role);

    expect(management()).toHaveAttribute('data-readonly', String(readOnly));
  });

  it('shows the organization is loading while the context is, and neither asks the profile nor says to select one', () => {
    context.value = { ...idle(), isLoading: true };
    renderPage();

    expect(screen.getByRole('status', { name: 'Loading organization' })).toBeInTheDocument();
    expect(screen.queryByText(/Select an organization/)).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe('CommitteesPage: an organization the context lacks', () => {
  it('asks the profile and manages the committees of the organization it names', async () => {
    renderPage();

    expect(screen.getByRole('status', { name: 'Loading organization' })).toBeInTheDocument();
    expect(await screen.findByTestId('committee-management')).toHaveAttribute('data-organization', 'org-9');
    expect(calls).toEqual([{ url: '/api/users/me/profile', method: 'GET', body: undefined }]);
  });

  it('says to select an organization only when the profile names none', async () => {
    profile = ok({ user: { id: 'user-1' }, organization: null, role: 'member' });
    renderPage();

    expect(await screen.findByText('Select an organization to manage committees.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('committee-management')).toBeNull();
  });

  it('shows why the context could not load when the profile names no organization either', async () => {
    context.value = { ...idle(), error: 'Failed to load organizations: 500' };
    profile = ok({ organization: null });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Your organization could not be loaded: Failed to load organizations: 500');
    expect(screen.queryByText(/Select an organization/)).toBeNull();
  });

  it('reports a profile that could not be read with the route\'s reason, and Retry asks again and refreshes the context', async () => {
    profile = { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Profile service is down' } };
    const user = userEvent.setup();
    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Your organization could not be loaded: Profile service is down');
    expect(screen.queryByText(/Select an organization/)).toBeNull();

    profile = ok({ organization: { id: 'org-9', name: 'Local 9', slug: 'local-9', type: 'union' } });
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await screen.findByTestId('committee-management')).toHaveAttribute('data-organization', 'org-9');
    expect(calls).toHaveLength(2);
    expect(context.value.refreshOrganizations).toHaveBeenCalledTimes(1);
  });

  it('uses the error the route states in its own shape', async () => {
    profile = { status: 401, body: { error: 'Unauthorized' } };
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Your organization could not be loaded: Unauthorized');
  });

  it('reports a request that never reached the server', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Your organization could not be loaded: Failed to fetch');
  });

  it.each([
    ['a body without an organization', {}, 'Unexpected API response: no organization'],
    ['an organization that is not a record', { organization: 'org-9' }, 'Unexpected API response: organization is not a record'],
    ['an organization without an id', { organization: { name: 'Local 9' } }, 'Unexpected API response: id is missing'],
    ['an organization whose id is not text', { organization: { id: 9 } }, 'Unexpected API response: id is missing'],
    ['a list instead of a record', [], 'Unexpected API response: no organization'],
  ])('reports %s instead of treating it as no organization', async (_what, body, message) => {
    profile = ok(body);
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText(/Select an organization/)).toBeNull();
    expect(screen.queryByTestId('committee-management')).toBeNull();
  });
});
