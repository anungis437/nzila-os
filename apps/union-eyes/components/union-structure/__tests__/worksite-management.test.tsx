// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { getTableColumns } from 'drizzle-orm';
import { worksites } from '@/db/schema/union-structure-schema';
import { employerRow, item, list, worksiteRow } from './route-rows';
import { installFetch, writesOf, type Answer, type Call } from './fetch-harness';

// Radix menus, dialogs and selects measure and scroll elements that jsdom does not implement.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});

const toast = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { WorksiteManagement, toWorksitePayload } from '../WorksiteManagement';

const acme = employerRow({});
const globex = employerRow({ id: 'emp-2', name: 'Globex' });
const oldEmployer = employerRow({ id: 'emp-3', name: 'Old Employer', status: 'archived' });

const plantA = worksiteRow({
  code: 'WS-001',
  address: { street: '1 Plant Rd', city: 'Hamilton', province: 'ON', postal_code: 'L8P 1A1', country: 'Canada', latitude: 43.25, longitude: -79.87 },
  employeeCount: 120,
  shiftCount: 3,
  description: 'Main plant',
});
const depot = worksiteRow({ id: 'ws-2', employerId: 'emp-2', name: 'Depot', status: 'seasonal' });
const closedSite = worksiteRow({ id: 'ws-3', name: 'Closed Site', status: 'archived' });

let worksiteRows: unknown[];
let employerRows: unknown[];
let respond: (call: Call) => Answer | undefined;
let calls: Call[];

function defaultAnswer({ url, method }: Call): Answer {
  const path = url.split('?')[0];
  if (method === 'GET' && path === '/api/worksites') return { status: 200, body: list(worksiteRows) };
  if (method === 'GET' && path === '/api/employers') return { status: 200, body: list(employerRows) };
  if (path === '/api/worksites' && method === 'POST') return { status: 200, body: item({}) };
  if (path.startsWith('/api/worksites/') && (method === 'PATCH' || method === 'DELETE')) return { status: 200, body: item({}) };
  throw new Error(`unexpected request ${method} ${url}`);
}

beforeEach(() => {
  worksiteRows = [plantA, depot, closedSite];
  employerRows = [acme, globex, oldEmployer];
  respond = () => undefined;
  calls = installFetch((call) => respond(call) ?? defaultAnswer(call));
  toast.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr') as HTMLElement;

async function openRowMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: `Actions for ${name}` }));
}

describe('WorksiteManagement: reading', () => {
  it('lists the worksites the route sends, with the employer\'s name looked up from the employers list', async () => {
    render(<WorksiteManagement organizationId="org-1" />);

    const plant = await rowOf('Plant A');
    expect(within(plant).getByText('WS-001')).toBeInTheDocument();
    expect(within(plant).getByText('Acme Corp')).toBeInTheDocument();
    expect(within(plant).getByText('Hamilton, ON')).toBeInTheDocument();
    expect(within(plant).getByText('120')).toBeInTheDocument();
    expect(within(plant).getByText('Active')).toBeInTheDocument();

    // A site with no code, address or head count shows dashes, not zeros.
    const depotRow = await rowOf('Depot');
    expect(within(depotRow).getByText('Globex')).toBeInTheDocument();
    expect(within(depotRow).getByText('Seasonal')).toBeInTheDocument();
    expect(within(depotRow).getAllByText('—')).toHaveLength(3);
  });

  it('keeps an archived worksite off the working list', async () => {
    render(<WorksiteManagement organizationId="org-1" />);
    await rowOf('Plant A');
    expect(screen.queryByText('Closed Site')).toBeNull();
  });

  it('asks both routes for every page, and sends neither the organization they already know', async () => {
    render(<WorksiteManagement organizationId="org-1" />);
    await rowOf('Plant A');
    expect(calls.map((call) => call.url).sort()).toEqual(['/api/employers?limit=100&page=1', '/api/worksites?limit=100&page=1']);
  });

  it('shows an employers list that failed as an error on the screen, not as worksites with no employer, and recovers on Retry', async () => {
    let failing = true;
    respond = ({ url, method }) =>
      method === 'GET' && failing && url.startsWith('/api/employers')
        ? { status: 403, body: { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'member' role" } }
        : undefined;
    const user = userEvent.setup();
    render(<WorksiteManagement organizationId="org-1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent("Failed to load worksites: Requires at least 'member' role");
    expect(screen.queryByText('Plant A')).toBeNull();
    expect(screen.queryByText('No worksites yet')).toBeNull();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Plant A')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('treats a body that is not the list envelope as a failure instead of crashing on it', async () => {
    respond = ({ url, method }) =>
      method === 'GET' && url.startsWith('/api/worksites') ? { status: 200, body: { success: true, data: [plantA] } } : undefined;
    render(<WorksiteManagement organizationId="org-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected API response');
  });

  it('refuses a worksite row without the employer it belongs to', async () => {
    worksiteRows = [{ ...plantA, employerId: null }];
    render(<WorksiteManagement organizationId="org-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('employerId is missing');
  });

  it('says so when there are no worksites, and only then', async () => {
    worksiteRows = [];
    render(<WorksiteManagement organizationId="org-1" />);
    expect(await screen.findByText('No worksites yet')).toBeInTheDocument();
  });
});

describe('WorksiteManagement: writing', () => {
  it('saves an edit through PATCH /api/worksites/{id} with only what the form edits, and does not blank what it does not show', async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<WorksiteManagement organizationId="org-1" onUpdate={onUpdate} />);
    await openRowMenu(user, 'Plant A');
    await user.click(await screen.findByRole('menuitem', { name: /Edit/ }));

    const name = await screen.findByLabelText(/Worksite Name/);
    expect(name).toHaveValue('Plant A');
    await user.clear(name);
    await user.type(name, 'Plant A North');
    await user.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const [write] = writesOf(calls);
    expect(write).toMatchObject({ url: '/api/worksites/ws-1', method: 'PATCH' });
    expect(write.body).toEqual({
      employerId: 'emp-1',
      name: 'Plant A North',
      code: 'WS-001',
      status: 'active',
      employeeCount: 120,
      // The coordinates are not on the form, and a save that rewrites the address keeps them.
      address: { street: '1 Plant Rd', city: 'Hamilton', province: 'ON', postal_code: 'L8P 1A1', country: 'Canada', latitude: 43.25, longitude: -79.87 },
    });
    for (const forbidden of ['organizationId', 'shiftCount', 'operatesWeekends', 'operates24Hours', 'siteManagerName', 'siteManagerEmail', 'notes', 'customFields', 'description']) {
      expect(write.body).not.toHaveProperty(forbidden);
    }
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Worksite updated successfully' }));
    await waitFor(() => expect(calls.filter((call) => call.method === 'GET' && call.url.startsWith('/api/worksites'))).toHaveLength(2));
  });

  it('does not create a worksite until an employer is chosen, never offers an archived employer, and then posts exactly the form\'s fields', async () => {
    const user = userEvent.setup();
    render(<WorksiteManagement organizationId="org-1" />);
    await rowOf('Plant A');
    await user.click(screen.getByRole('button', { name: /Add Worksite/ }));
    await user.type(await screen.findByLabelText(/Worksite Name/), 'Warehouse');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Employer is required')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);

    await user.click(screen.getByRole('combobox', { name: /Employer/ }));
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['Acme Corp', 'Globex']);
    await user.click(screen.getByRole('option', { name: 'Globex' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({ url: '/api/worksites', method: 'POST' });
    expect(writesOf(calls)[0].body).toEqual({
      employerId: 'emp-2',
      name: 'Warehouse',
      code: null,
      status: 'active',
      employeeCount: null,
      address: null,
    });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Worksite created successfully' }));
  });

  it('offers the statuses the database has and sends the code the route stores', async () => {
    const user = userEvent.setup();
    render(<WorksiteManagement organizationId="org-1" />);
    await openRowMenu(user, 'Plant A');
    await user.click(await screen.findByRole('menuitem', { name: /Edit/ }));
    await user.click(await screen.findByRole('combobox', { name: /Status/ }));
    const options = (await screen.findAllByRole('option')).map((option) => option.textContent);
    expect(options).toEqual(['Active', 'Temporarily Closed', 'Permanently Closed', 'Seasonal', 'Archived']);
    await user.click(screen.getByRole('option', { name: 'Temporarily Closed' }));
    await user.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const status = (writesOf(calls)[0].body as { status: string }).status;
    expect(status).toBe('temporarily_closed');
    const members = (worksites.status as unknown as { enumValues: string[] }).enumValues;
    expect(members).toContain(status);
  });

  it('shows the route\'s own refusal when a save is rejected, and does not claim success', async () => {
    respond = ({ method }) =>
      method === 'POST' ? { status: 403, body: { code: 'FORBIDDEN', message: 'The employer does not belong to your organization' } } : undefined;
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<WorksiteManagement organizationId="org-1" onUpdate={onUpdate} />);
    await rowOf('Plant A');
    await user.click(screen.getByRole('button', { name: /Add Worksite/ }));
    await user.type(await screen.findByLabelText(/Worksite Name/), 'Warehouse');
    await user.click(screen.getByRole('combobox', { name: /Employer/ }));
    await user.click(await screen.findByRole('option', { name: 'Acme Corp' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', description: 'The employer does not belong to your organization' }),
      ),
    );
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ description: 'Worksite created successfully' }));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('archives through DELETE /api/worksites/{id} after confirmation, and not without it', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<WorksiteManagement organizationId="org-1" onUpdate={onUpdate} />);

    confirm.mockReturnValue(false);
    await openRowMenu(user, 'Plant A');
    await user.click(await screen.findByRole('menuitem', { name: /Archive/ }));
    expect(writesOf(calls)).toHaveLength(0);

    confirm.mockReturnValue(true);
    await openRowMenu(user, 'Plant A');
    await user.click(await screen.findByRole('menuitem', { name: /Archive/ }));
    await waitFor(() => expect(writesOf(calls)).toEqual([expect.objectContaining({ url: '/api/worksites/ws-1', method: 'DELETE' })]));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Worksite archived' }));
    confirm.mockRestore();
  });

  it('reports a refused archive with the route\'s reason and leaves the list alone', async () => {
    respond = ({ method }) =>
      method === 'DELETE' ? { status: 403, body: { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'admin' role" } } : undefined;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<WorksiteManagement organizationId="org-1" />);
    await openRowMenu(user, 'Plant A');
    await user.click(await screen.findByRole('menuitem', { name: /Archive/ }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: "Requires at least 'admin' role" })),
    );
    expect(screen.getByText('Plant A')).toBeInTheDocument();
    confirm.mockRestore();
  });
});

describe('toWorksitePayload', () => {
  const values = {
    employerId: 'emp-1',
    name: 'Plant',
    code: 'WS-1',
    status: 'active',
    employeeCount: '12',
    street: '1 Plant Rd',
    city: 'Hamilton',
    province: 'ON',
    postalCode: 'L8P 1A1',
  };

  it('carries only columns of the worksites table that the route sends back or accepts, never the tenant', () => {
    const columns = Object.keys(getTableColumns(worksites));
    const body = toWorksitePayload(values, null);
    for (const key of Object.keys(body)) expect(columns).toContain(key);
    for (const key of ['organizationId', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'archivedAt', 'id']) expect(body).not.toHaveProperty(key);
  });

  it('sends a blank optional field as null, which clears it', () => {
    expect(toWorksitePayload({ ...values, code: '', employeeCount: '', street: '', city: '', province: '', postalCode: '' }, null)).toEqual({
      employerId: 'emp-1',
      name: 'Plant',
      code: null,
      status: 'active',
      employeeCount: null,
      address: null,
    });
  });
});
