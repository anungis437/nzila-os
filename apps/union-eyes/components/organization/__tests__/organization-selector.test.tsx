// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { installFetch, type Answer, type Call } from '@/components/union-structure/__tests__/fetch-harness';

// Radix popovers and the command list measure and scroll elements that jsdom does not implement.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});

interface Org {
  id: string;
  name: string;
  type: string;
}

interface OrganizationContext {
  organizationId: string | null;
  organization: Org | null;
  organizationPath: { id: string; name: string }[];
  userOrganizations: Org[];
  switchOrganization: (id: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  refreshOrganizations: () => Promise<void>;
}

const context = vi.hoisted(() => ({ value: {} as OrganizationContext }));

vi.mock('@/lib/hooks/use-organization', () => ({ useOrganization: () => context.value }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { OrganizationSelector } from '../organization-selector';

const local: Org = { id: 'org-9', name: 'Local 1000', type: 'local' };
const union: Org = { id: 'org-2', name: 'CUPE', type: 'union' };

const idle = (): OrganizationContext => ({
  organizationId: null,
  organization: null,
  organizationPath: [],
  userOrganizations: [],
  switchOrganization: vi.fn(async () => {}),
  isLoading: false,
  error: null,
  refreshOrganizations: vi.fn(async () => {}),
});

const profile = (organization: unknown): Answer => ({ status: 200, body: { user: { id: 'user-1' }, profile: null, organization, role: 'member' } });
const home = { id: 'org-9', name: 'Local 1000', slug: 'local-1000', type: 'local' };
const entry = (id: string, name: string) => ({ id, name, slug: id, type: 'union', parentId: null });

let profileAnswer: Answer;
let pathAnswer: Answer;
let calls: Call[];

beforeEach(() => {
  context.value = idle();
  profileAnswer = profile(home);
  pathAnswer = { status: 200, body: { data: [entry('clc', 'CLC'), entry('cupe', 'CUPE'), entry('org-9', 'Local 1000')] } };
  calls = installFetch(({ url }) => {
    if (url === '/api/users/me/profile') return profileAnswer;
    if (url === '/api/organizations/org-9/path') return pathAnswer;
    throw new Error(`unexpected request ${url}`);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

describe('OrganizationSelector: what the context has', () => {
  it('shows the one organization of a single-organization user as a label, under its parents, and asks nothing', async () => {
    context.value = { ...idle(), organizationId: 'org-9', organization: local, userOrganizations: [local], organizationPath: [{ id: 'clc', name: 'CLC' }, { id: 'cupe', name: 'CUPE' }, { id: 'org-9', name: 'Local 1000' }] };
    render(<OrganizationSelector />);

    expect(await screen.findByText('Local 1000')).toBeInTheDocument();
    expect(screen.getByText('CLC > CUPE')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(calls).toEqual([]);
  });

  it('lets a user of several organizations pick one, and switches to it', async () => {
    context.value = { ...idle(), organizationId: 'org-9', organization: local, userOrganizations: [local, union] };
    const user = userEvent.setup();
    render(<OrganizationSelector />);

    await user.click(await screen.findByRole('combobox'));
    await user.click(await screen.findByText('CUPE'));

    expect(context.value.switchOrganization).toHaveBeenCalledWith('org-2');
    expect(calls).toEqual([]);
  });

  it('says the organizations could not be loaded, with the reason, and a click asks the context again', async () => {
    context.value = { ...idle(), error: 'Failed to load organizations: 500' };
    const user = userEvent.setup();
    render(<OrganizationSelector />);

    const button = await screen.findByRole('button', { name: 'Error loading - Click to retry' });
    expect(button).toHaveAttribute('title', 'Failed to load organizations: 500');
    await user.click(button);

    expect(context.value.refreshOrganizations).toHaveBeenCalledTimes(1);
  });

  it('says it is loading while the context loads, and asks the profile nothing', async () => {
    context.value = { ...idle(), isLoading: true };
    render(<OrganizationSelector />);

    // A loading indicator, not a button that does nothing.
    expect(await screen.findByRole('status')).toHaveTextContent('Loading...');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(calls).toEqual([]);
  });
});

describe('OrganizationSelector: an organization the context lacks', () => {
  it('reads the profile and the path of the organization it names, and shows it under its parents', async () => {
    render(<OrganizationSelector />);

    expect(await screen.findByText('Local 1000')).toBeInTheDocument();
    expect(await screen.findByText('CLC > CUPE')).toBeInTheDocument();
    expect(calls.map((call) => call.url)).toEqual(['/api/users/me/profile', '/api/organizations/org-9/path']);
  });

  it('says "No organization" only when the profile names none', async () => {
    profileAnswer = profile(null);
    const user = userEvent.setup();
    render(<OrganizationSelector />);

    const button = await screen.findByRole('button', { name: 'No organization' });
    await user.click(button);

    expect(context.value.refreshOrganizations).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
  });

  it('says the organization could not be loaded, with the route\'s reason, when the profile could not be read, and Retry recovers', async () => {
    profileAnswer = { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Profile service is down' } };
    const user = userEvent.setup();
    render(<OrganizationSelector />);

    const button = await screen.findByRole('button', { name: 'Error loading - Click to retry' });
    expect(button).toHaveAttribute('title', 'Profile service is down');
    expect(screen.queryByRole('button', { name: 'No organization' })).toBeNull();

    profileAnswer = profile(home);
    await user.click(button);

    expect(await screen.findByText('Local 1000')).toBeInTheDocument();
    expect(context.value.refreshOrganizations).toHaveBeenCalledTimes(1);
  });

  it('shows the organization and says the hierarchy is unavailable when only the path could not be read', async () => {
    pathAnswer = { status: 404, body: { error: 'Not found' } };
    render(<OrganizationSelector />);

    expect(await screen.findByText('Local 1000')).toBeInTheDocument();
    expect(await screen.findByText('Hierarchy unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No organization')).toBeNull();
  });

  it.each([
    ['a profile with no organization key', { status: 200, body: { user: {} } }, 'Unexpected API response: no organization'],
    ['an organization that is not a record', profile('org-9'), 'Unexpected API response: organization is not a record'],
    ['an organization without an id', profile({ name: 'Local 1000' }), 'Unexpected API response: id is missing'],
    ['an organization without a name', profile({ id: 'org-9' }), 'Unexpected API response: name is missing'],
  ])('reports %s as an error, not as no organization', async (_what, answer, message) => {
    profileAnswer = answer;
    render(<OrganizationSelector />);

    const button = await screen.findByRole('button', { name: 'Error loading - Click to retry' });
    expect(button).toHaveAttribute('title', message);
    await waitFor(() => expect(screen.queryByText('No organization')).toBeNull());
  });
});
