// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { installFetch, type Answer, type Call } from '@/components/union-structure/__tests__/fetch-harness';

interface OrganizationContext {
  organizationPath: { id: string; name: string }[];
  isLoading: boolean;
}

const context = vi.hoisted(() => ({ value: {} as OrganizationContext }));

vi.mock('@/lib/hooks/use-organization', () => ({ useOrganization: () => context.value }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { OrganizationBreadcrumb } from '../organization-breadcrumb';

/** What GET /api/users/me/profile answers: plain JSON, not withApi's envelope. */
const profile = (organization: unknown): Answer => ({ status: 200, body: { user: { id: 'user-1' }, profile: null, organization, role: 'member' } });
const home = { id: 'org-9', name: 'Local 1000', slug: 'local-1000', type: 'local' };

/** What GET /api/organizations/{id}/path answers: plain { data: [organization] }, each with the fields formatOrg sends. */
const pathEntry = (id: string, name: string) => ({ id, name, slug: id, type: 'union', parentId: null, hierarchyLevel: 0, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' });
const pathOf = (...entries: ReturnType<typeof pathEntry>[]): Answer => ({ status: 200, body: { data: entries } });

let profileAnswer: Answer;
let pathAnswer: Answer;
let calls: Call[];

beforeEach(() => {
  context.value = { organizationPath: [], isLoading: false };
  profileAnswer = profile(home);
  pathAnswer = pathOf(pathEntry('clc', 'CLC'), pathEntry('cupe', 'CUPE'), pathEntry('org-9', 'Local 1000'));
  calls = installFetch(({ url }) => {
    if (url === '/api/users/me/profile') return profileAnswer;
    if (url === '/api/organizations/org-9/path') return pathAnswer;
    throw new Error(`unexpected request ${url}`);
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('OrganizationBreadcrumb: the path the context has', () => {
  it('shows it, and asks nothing', () => {
    context.value = { organizationPath: [{ id: 'clc', name: 'CLC' }, { id: 'org-9', name: 'Local 1000' }], isLoading: false };
    render(<OrganizationBreadcrumb />);

    const nav = screen.getByRole('navigation', { name: 'Organization path' });
    expect(nav).toHaveTextContent('CLC');
    expect(nav).toHaveTextContent('Local 1000');
    expect(calls).toEqual([]);
  });

  it('shows nothing while the context loads, and asks nothing', () => {
    context.value = { organizationPath: [], isLoading: true };
    const { container } = render(<OrganizationBreadcrumb />);

    expect(container).toBeEmptyDOMElement();
    expect(calls).toEqual([]);
  });
});

describe('OrganizationBreadcrumb: a path the context lacks', () => {
  it('reads the profile and then the path of the organization it names, and shows the path from the top down', async () => {
    render(<OrganizationBreadcrumb />);

    const nav = await screen.findByRole('navigation', { name: 'Organization path' });
    expect(Array.from(nav.querySelectorAll('span')).map((span) => span.textContent)).toEqual(['CLC', 'CUPE', 'Local 1000']);
    expect(calls.map((call) => call.url)).toEqual(['/api/users/me/profile', '/api/organizations/org-9/path']);
  });

  it('shows that higher organizations are not listed when the route says it left some out', async () => {
    pathAnswer = { status: 200, body: { data: [pathEntry('org-9', 'Local 1000')], completePath: false, omittedAncestorCount: 2 } };
    render(<OrganizationBreadcrumb />);

    const nav = await screen.findByRole('navigation', { name: 'Organization path' });
    expect(nav).toHaveTextContent('…');
    expect(screen.getByTitle('Higher organizations you cannot see are not listed')).toBeInTheDocument();
  });

  it('shows nothing when the profile names no organization, since there is no path', async () => {
    profileAnswer = profile(null);
    const { container } = render(<OrganizationBreadcrumb />);

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(container).toBeEmptyDOMElement();
  });

  it('says the path is unavailable, with the reason, when the profile could not be read, and Retry reads it again', async () => {
    profileAnswer = { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Profile service is down' } };
    const user = userEvent.setup();
    render(<OrganizationBreadcrumb />);

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Organization path unavailable');
    expect(screen.getByTitle('Profile service is down')).toBeInTheDocument();

    profileAnswer = profile(home);
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('navigation', { name: 'Organization path' })).toHaveTextContent('Local 1000');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('says the path is unavailable when the path could not be read, and does not draw an empty breadcrumb', async () => {
    pathAnswer = { status: 404, body: { error: 'Not found' } };
    const { container } = render(<OrganizationBreadcrumb />);

    expect(await screen.findByRole('status')).toHaveTextContent('Organization path unavailable');
    expect(screen.getByTitle('Not found')).toBeInTheDocument();
    expect(container.querySelector('nav')).toBeNull();
  });

  it.each([
    ['a profile with no organization key', { status: 200, body: { user: {} } }, undefined, 'Unexpected API response: no organization'],
    ['an organization that is not a record', profile('org-9'), undefined, 'Unexpected API response: organization is not a record'],
    ['an organization without a name', profile({ id: 'org-9' }), undefined, 'Unexpected API response: name is missing'],
    ['a path in the wrong nesting', undefined, { status: 200, body: { data: { data: [] } } }, 'Unexpected API response: no path'],
    ['a path entry without a name', undefined, { status: 200, body: { data: [{ id: 'org-9' }] } }, 'Unexpected API response: name is missing'],
    ['an omitted-ancestor count that is not a count', undefined, { status: 200, body: { data: [], omittedAncestorCount: -1 } }, 'Unexpected API response: omittedAncestorCount is not a count'],
  ] as const)('reports %s as unavailable, not as no path', async (_what, profileBody, pathBody, message) => {
    if (profileBody) profileAnswer = profileBody;
    if (pathBody) pathAnswer = pathBody;
    render(<OrganizationBreadcrumb />);

    expect(await screen.findByRole('status')).toHaveTextContent('Organization path unavailable');
    expect(screen.getByTitle(message)).toBeInTheDocument();
  });
});
