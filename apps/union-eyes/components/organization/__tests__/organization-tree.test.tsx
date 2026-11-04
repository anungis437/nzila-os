// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { installFetch, type Answer, type Call } from '@/components/union-structure/__tests__/fetch-harness';

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { OrganizationTree } from '../organization-tree';

/** A row as GET /api/organizations/tree maps it when canonical organization selection is off (app/api/organizations/tree/route.ts). */
const row = (values: Record<string, unknown>) => ({
  id: 'org-1',
  name: 'CLC',
  slug: 'clc',
  organization_type: 'congress',
  type: 'congress',
  parentId: null,
  sector: null,
  jurisdiction: null,
  description: null,
  hierarchyLevel: 0,
  member_count: 120,
  memberCount: 120,
  status: 'active',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  ...values,
});

const ok = (data: unknown): Answer => ({ status: 200, body: { data } });

const hierarchy = [
  row({}),
  row({ id: 'org-2', name: 'CUPE', slug: 'cupe', organization_type: 'union', type: 'union', parentId: 'org-1', hierarchyLevel: 1, member_count: 80, memberCount: 80 }),
  row({ id: 'org-3', name: 'Local 1000', slug: 'local-1000', organization_type: 'local', type: 'local', parentId: 'org-2', hierarchyLevel: 2, member_count: null, memberCount: 0 }),
  row({ id: 'org-4', name: 'Local 2000', slug: 'local-2000', organization_type: 'local', type: 'local', parentId: 'org-2', hierarchyLevel: 2, member_count: 0, memberCount: 0 }),
];

let answer: Answer;
let calls: Call[];

beforeEach(() => {
  answer = ok(hierarchy);
  calls = installFetch(() => answer);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const treeItem = (name: string) => screen.getByText(name).closest('[role="treeitem"]') as HTMLElement;

describe('OrganizationTree: the hierarchy it shows', () => {
  it('reads the tree route once and nests the flat list by parent, with a single root open', async () => {
    render(<OrganizationTree />);

    expect(await screen.findByText('CLC')).toBeInTheDocument();
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual(['GET /api/organizations/tree']);
    expect(screen.getByText('CUPE')).toBeInTheDocument();
    // The second level is closed until it is opened.
    expect(screen.queryByText('Local 1000')).toBeNull();
    expect(screen.queryByText('All Organizations')).toBeNull();
  });

  it('opens and closes a branch, and says which it will do', async () => {
    const user = userEvent.setup();
    render(<OrganizationTree />);
    await screen.findByText('CLC');

    await user.click(screen.getByRole('button', { name: 'Expand CUPE' }));
    expect(screen.getByText('Local 1000')).toBeInTheDocument();
    expect(screen.getByText('Local 2000')).toBeInTheDocument();
    expect(treeItem('CUPE')).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: 'Collapse CUPE' }));
    expect(screen.queryByText('Local 1000')).toBeNull();
    // An organization with no children has nothing to open.
    expect(screen.queryByRole('button', { name: /Expand Local 1000/ })).toBeNull();
  });

  it('lists several roots at the top, with none opened, and invents no organization to hold them', async () => {
    answer = ok([row({}), row({ id: 'org-9', name: 'Independent Union', slug: 'independent', organization_type: 'union', type: 'union' })]);
    render(<OrganizationTree />);

    expect(await screen.findByText('CLC')).toBeInTheDocument();
    expect(screen.getByText('Independent Union')).toBeInTheDocument();
    expect(screen.queryByText('All Organizations')).toBeNull();
  });

  it('shows an organization whose parent the caller may not read at the top', async () => {
    answer = ok([row({ id: 'org-5', name: 'Local 5', slug: 'local-5', organization_type: 'local', type: 'local', parentId: 'org-not-readable' })]);
    render(<OrganizationTree />);

    expect(await screen.findByText('Local 5')).toBeInTheDocument();
  });

  it('says there are no organizations to show when the route sent none, which is not an error', async () => {
    answer = ok([]);
    render(<OrganizationTree />);

    expect(await screen.findByText('No organizations are visible to you.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('OrganizationTree: what each organization shows', () => {
  it('shows the member count the route has, and a dash where it was never computed, which is not zero', async () => {
    const user = userEvent.setup();
    render(<OrganizationTree />);
    await screen.findByText('CLC');
    await user.click(screen.getByRole('button', { name: 'Expand CUPE' }));

    expect(treeItem('CLC').firstElementChild).toHaveTextContent('120');
    expect(treeItem('Local 1000').firstElementChild).toHaveTextContent('—');
    expect(screen.getByTitle('The member count has not been computed')).toBeInTheDocument();
    // A count of zero that was computed is zero.
    expect(treeItem('Local 2000').firstElementChild).toHaveTextContent('0');
    expect(treeItem('Local 2000').firstElementChild).not.toHaveTextContent('—');
  });

  it('reads the member count of the canonical list, which has memberCount only', async () => {
    answer = ok([
      { id: 'org-1', name: 'CLC', slug: 'clc', type: 'congress', parentId: null, hierarchyLevel: 0, memberCount: 7, status: 'active' },
      { id: 'org-2', name: 'CUPE', slug: 'cupe', type: 'union', parentId: 'org-1', hierarchyLevel: 1, memberCount: null, status: 'active' },
    ]);
    render(<OrganizationTree />);
    await screen.findByText('CLC');
    // A single root is open, so its children are in view.
    expect(treeItem('CLC')).toHaveAttribute('aria-expanded', 'true');

    expect(treeItem('CLC').firstElementChild).toHaveTextContent('7');
    expect(treeItem('CUPE').firstElementChild).toHaveTextContent('—');
  });

  it('can hide the member counts', async () => {
    render(<OrganizationTree showMemberCount={false} />);
    await screen.findByText('CLC');

    expect(treeItem('CLC').firstElementChild).not.toHaveTextContent('120');
  });

  it('names the type of an organization, in the words of the type when it has none of its own, and none when there is none', async () => {
    answer = ok([
      row({ id: 'org-1', name: 'CLC' }),
      row({ id: 'org-2', name: 'Chapter 4', slug: 'chapter-4', organization_type: 'chapter', type: 'chapter', parentId: 'org-1' }),
      row({ id: 'org-3', name: 'Untyped', slug: 'untyped', organization_type: null, type: null, parentId: 'org-1' }),
    ]);
    render(<OrganizationTree />);
    await screen.findByText('CLC');

    expect(treeItem('CLC')).toHaveTextContent('Congress');
    expect(within(treeItem('Chapter 4')).getByText('chapter')).toBeInTheDocument();
    expect(treeItem('Untyped').firstElementChild).not.toHaveTextContent(/Union|Local|Congress/);
  });

  it('counts the children of an organization', async () => {
    render(<OrganizationTree />);
    await screen.findByText('CLC');

    expect(treeItem('CLC').firstElementChild).toHaveTextContent('1 child');
    expect(treeItem('CUPE').firstElementChild).toHaveTextContent('2 children');
  });
});

describe('OrganizationTree: selecting', () => {
  it('hands the organization that was clicked to the caller', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<OrganizationTree onSelect={onSelect} />);
    await screen.findByText('CLC');

    await user.click(screen.getByText('CUPE').closest('button') as HTMLElement);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0]).toMatchObject({ id: 'org-2', name: 'CUPE' });
  });

  it('offers nothing to click when nobody listens', async () => {
    render(<OrganizationTree />);
    await screen.findByText('CLC');

    expect(screen.getByText('CUPE').closest('button')).toBeNull();
  });

  it('marks the selected organization', async () => {
    render(<OrganizationTree selectedOrgId="org-2" />);
    await screen.findByText('CLC');

    expect(treeItem('CUPE')).toHaveAttribute('aria-selected', 'true');
    expect(treeItem('CLC')).toHaveAttribute('aria-selected', 'false');
  });
});

describe('OrganizationTree: when the tree cannot be shown', () => {
  it('shows it is loading', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<OrganizationTree />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading organization tree...');
  });

  it('says why the route failed, and Retry reads the tree again', async () => {
    answer = { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Hierarchy service is down' } };
    const user = userEvent.setup();
    render(<OrganizationTree />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Hierarchy service is down');
    expect(screen.queryByText('No organizations are visible to you.')).toBeNull();

    answer = ok(hierarchy);
    await user.click(within(alert).getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('CLC')).toBeInTheDocument();
    expect(calls).toHaveLength(2);
  });

  it('names the reason of a refusal in the route\'s other shape', async () => {
    answer = { status: 401, body: { error: 'Unauthorized' } };
    render(<OrganizationTree />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Unauthorized');
  });

  it.each([
    ['a body that is not a record', [row({})], 'Unexpected API response: no organizations'],
    ['a body whose list is missing', { success: true }, 'Unexpected API response: no organizations'],
    ['a list in the wrong nesting', { data: { data: [row({})] } }, 'Unexpected API response: no organizations'],
    ['an organization that is not a record', { data: ['CLC'] }, 'Unexpected API response: organization is not a record'],
    ['an organization without a name', { data: [row({ name: null })] }, 'Unexpected API response: name is missing'],
    ['a member count that is not a number', { data: [row({ member_count: 'many' })] }, 'Unexpected API response: member_count is not a number'],
    ['organizations that are each other\'s parents', { data: [row({ id: 'a', name: 'A', parentId: 'b' }), row({ id: 'b', name: 'B', parentId: 'a' })] }, 'Unexpected API response: the organizations do not form a hierarchy'],
  ])('reports %s instead of drawing a tree', async (_what, body, message) => {
    answer = { status: 200, body };
    render(<OrganizationTree />);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByRole('tree')).toBeNull();
  });
});
