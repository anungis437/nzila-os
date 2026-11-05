// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { getTableColumns } from 'drizzle-orm';
import { employers } from '@/db/schema/union-structure-schema';
import { employerRow, item, list } from '@/lib/__tests__/support/union-structure-route-rows';
import { installFetch, writesOf, type Answer, type Call } from './fetch-harness';

// Radix menus, dialogs and selects measure and scroll elements that jsdom does not implement.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});

const toast = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { EmployerManagement, toEmployerPayload } from '../EmployerManagement';

const acme = employerRow({
  legalName: 'Acme Corporation Inc.',
  businessNumber: '123456789RC0001',
  email: 'hr@acme.test',
  phone: '(555) 123-4567',
  website: 'https://acme.test',
  mainAddress: { street: '1 Main St', unit: 'Suite 4', city: 'Toronto', province: 'ON', postal_code: 'M5A 1A1', country: 'Canada' },
  totalEmployees: 400,
  unionizedEmployees: 250,
  notes: 'Key account',
  dbaName: 'Acme',
  primaryContactName: 'Pat Doe',
  customFields: { tier: 1 },
});
const globex = employerRow({ id: 'emp-2', name: 'Globex', employerType: 'municipal', status: 'in_bargaining' });
const retired = employerRow({ id: 'emp-3', name: 'Retired Co', status: 'archived' });

let rows: unknown[];
let respond: (call: Call) => Answer | undefined;
let calls: Call[];

function defaultAnswer({ url, method }: Call): Answer {
  const path = url.split('?')[0];
  if (method === 'GET' && path === '/api/employers') return { status: 200, body: list(rows) };
  if (path === '/api/employers' && method === 'POST') return { status: 200, body: item({}) };
  if (path.startsWith('/api/employers/') && (method === 'PATCH' || method === 'DELETE')) return { status: 200, body: item({}) };
  throw new Error(`unexpected request ${method} ${url}`);
}

beforeEach(() => {
  rows = [acme, globex, retired];
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

describe('EmployerManagement: reading', () => {
  it('lists the employers the route sends, from the real { data, pagination } envelope', async () => {
    render(<EmployerManagement organizationId="org-1" />);

    const acmeRow = await rowOf('Acme Corp');
    expect(within(acmeRow).getByText('Acme Corporation Inc.')).toBeInTheDocument();
    expect(within(acmeRow).getByText('Private')).toBeInTheDocument();
    expect(within(acmeRow).getByText('250 union')).toBeInTheDocument();
    expect(within(acmeRow).getByText('400 total')).toBeInTheDocument();
    expect(within(acmeRow).getByText('Toronto, ON')).toBeInTheDocument();
    expect(within(acmeRow).getByText('Active')).toBeInTheDocument();

    // An employer with no recorded figures shows dashes, not zeros, and the code of its type and status as words.
    const globexRow = await rowOf('Globex');
    expect(within(globexRow).getByText('Municipal')).toBeInTheDocument();
    expect(within(globexRow).getByText('In Bargaining')).toBeInTheDocument();
    expect(within(globexRow).getAllByText('—')).toHaveLength(2);
    expect(within(globexRow).queryByText(/^0/)).toBeNull();
  });

  it('keeps an archived employer off the working list', async () => {
    render(<EmployerManagement organizationId="org-1" />);
    await rowOf('Acme Corp');
    expect(screen.queryByText('Retired Co')).toBeNull();
  });

  it('asks the route for every page and never sends the organization the route already knows', async () => {
    render(<EmployerManagement organizationId="org-1" />);
    await rowOf('Acme Corp');
    expect(calls.map((call) => call.url)).toEqual(['/api/employers?limit=100&page=1']);
  });

  it('reads every page of the list, not just the first', async () => {
    respond = ({ url, method }) => {
      if (method !== 'GET') return undefined;
      return url.includes('page=2')
        ? { status: 200, body: list([employerRow({ id: 'emp-9', name: 'Second Page Co' })], 2, 2) }
        : { status: 200, body: list([acme], 1, 2) };
    };
    render(<EmployerManagement organizationId="org-1" />);
    expect(await screen.findByText('Second Page Co')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('searches by name and by legal name', async () => {
    const user = userEvent.setup();
    render(<EmployerManagement organizationId="org-1" />);
    await rowOf('Acme Corp');
    await user.type(screen.getByLabelText('Search employers'), 'corporation inc');
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.queryByText('Globex')).toBeNull();
    await user.clear(screen.getByLabelText('Search employers'));
    await user.type(screen.getByLabelText('Search employers'), 'nothing like this');
    expect(await screen.findByText('No employers found')).toBeInTheDocument();
  });

  it('says so when there are no employers, and only then', async () => {
    rows = [];
    render(<EmployerManagement organizationId="org-1" />);
    expect(await screen.findByText('No employers yet')).toBeInTheDocument();
  });

  it('shows a failed load as an error with the route\'s reason, never as an empty list, and recovers on Retry', async () => {
    let failing = true;
    respond = ({ method }) =>
      method === 'GET' && failing ? { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Database unavailable' } } : undefined;
    const user = userEvent.setup();
    render(<EmployerManagement organizationId="org-1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load employers: Database unavailable');
    expect(screen.queryByText('No employers yet')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('treats a body that is not the list envelope as a failure instead of crashing on it', async () => {
    respond = ({ method }) => (method === 'GET' ? { status: 200, body: { success: true, data: [acme] } } : undefined);
    render(<EmployerManagement organizationId="org-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load employers: Unexpected API response');
  });

  it('refuses a row that lacks a column the database never leaves empty, instead of showing a blank one', async () => {
    rows = [{ ...acme, name: null }];
    render(<EmployerManagement organizationId="org-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('name is missing');
  });
});

describe('EmployerManagement: writing', () => {
  it('saves an edit through PATCH /api/employers/{id} with the form\'s own fields and the address it does not edit kept', async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<EmployerManagement organizationId="org-1" onUpdate={onUpdate} />);
    await openRowMenu(user, 'Acme Corp');
    await user.click(await screen.findByRole('menuitem', { name: /Edit/ }));

    const name = await screen.findByLabelText(/Employer Name/);
    expect(name).toHaveValue('Acme Corp');
    await user.clear(name);
    await user.type(name, 'Acme Industries');
    await user.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    const [write] = writesOf(calls);
    expect(write).toMatchObject({ url: '/api/employers/emp-1', method: 'PATCH' });
    expect(write.body).toEqual({
      name: 'Acme Industries',
      legalName: 'Acme Corporation Inc.',
      businessNumber: '123456789RC0001',
      employerType: 'private',
      status: 'active',
      totalEmployees: 400,
      unionizedEmployees: 250,
      email: 'hr@acme.test',
      phone: '(555) 123-4567',
      website: 'https://acme.test',
      mainAddress: { street: '1 Main St', unit: 'Suite 4', city: 'Toronto', province: 'ON', postal_code: 'M5A 1A1', country: 'Canada' },
      notes: 'Key account',
    });
    // The tenant, the people and the record's own bookkeeping are not this form's to write, and what it does not show it must not blank.
    for (const forbidden of ['organizationId', 'dbaName', 'primaryContactName', 'customFields', 'parentCompanyId', 'createdAt', 'archivedAt']) {
      expect(write.body).not.toHaveProperty(forbidden);
    }
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Employer updated successfully' }));
    // The list is read again after a save.
    await waitFor(() => expect(calls.filter((call) => call.method === 'GET')).toHaveLength(2));
  });

  it('sends a blank optional field as null and a blank count as null, never as an empty string or a zero', async () => {
    const user = userEvent.setup();
    render(<EmployerManagement organizationId="org-1" />);
    await openRowMenu(user, 'Globex');
    await user.click(await screen.findByRole('menuitem', { name: /Edit/ }));
    await user.click(await screen.findByRole('button', { name: 'Update' }));

    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0].body).toEqual({
      name: 'Globex',
      legalName: null,
      businessNumber: null,
      employerType: 'municipal',
      status: 'in_bargaining',
      totalEmployees: null,
      unionizedEmployees: null,
      email: null,
      phone: null,
      website: null,
      mainAddress: null,
      notes: null,
    });
  });

  it('does not create anything until an employer type is chosen, and then posts exactly the form\'s fields', async () => {
    const user = userEvent.setup();
    render(<EmployerManagement organizationId="org-1" />);
    await rowOf('Acme Corp');
    await user.click(screen.getByRole('button', { name: /Add Employer/ }));
    await user.type(await screen.findByLabelText(/Employer Name/), 'Initech');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Select an employer type')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);

    await user.click(screen.getByRole('combobox', { name: /Employer Type/ }));
    await user.click(await screen.findByRole('option', { name: 'Federal' }));
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(writesOf(calls)).toHaveLength(1));
    expect(writesOf(calls)[0]).toMatchObject({ url: '/api/employers', method: 'POST' });
    expect(writesOf(calls)[0].body).toEqual({
      name: 'Initech',
      legalName: null,
      businessNumber: null,
      employerType: 'federal',
      status: 'active',
      totalEmployees: null,
      unionizedEmployees: null,
      email: null,
      phone: null,
      website: null,
      mainAddress: null,
      notes: null,
    });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Employer created successfully' }));
  });

  it('shows the route\'s own refusal when a save is rejected, and does not claim success', async () => {
    respond = ({ method }) =>
      method === 'PATCH' ? { status: 400, body: { code: 'VALIDATION_ERROR', message: 'parentCompanyId must be an employer of this organization' } } : undefined;
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<EmployerManagement organizationId="org-1" onUpdate={onUpdate} />);
    await openRowMenu(user, 'Acme Corp');
    await user.click(await screen.findByRole('menuitem', { name: /Edit/ }));
    await user.click(await screen.findByRole('button', { name: 'Update' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: 'destructive', description: 'parentCompanyId must be an employer of this organization' }),
      ),
    );
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ description: 'Employer updated successfully' }));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('validates the form before it asks the route anything', async () => {
    const user = userEvent.setup();
    render(<EmployerManagement organizationId="org-1" />);
    await openRowMenu(user, 'Acme Corp');
    await user.click(await screen.findByRole('menuitem', { name: /Edit/ }));
    const phone = await screen.findByLabelText('Phone');
    await user.clear(phone);
    await user.type(phone, 'call me!');
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(await screen.findByText('Invalid phone number format')).toBeInTheDocument();
    expect(writesOf(calls)).toHaveLength(0);
  });

  it('archives through DELETE /api/employers/{id} after confirmation, and not without it', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<EmployerManagement organizationId="org-1" onUpdate={onUpdate} />);

    confirm.mockReturnValue(false);
    await openRowMenu(user, 'Acme Corp');
    await user.click(await screen.findByRole('menuitem', { name: /Archive/ }));
    expect(writesOf(calls)).toHaveLength(0);

    confirm.mockReturnValue(true);
    await openRowMenu(user, 'Acme Corp');
    await user.click(await screen.findByRole('menuitem', { name: /Archive/ }));
    await waitFor(() => expect(writesOf(calls)).toEqual([expect.objectContaining({ url: '/api/employers/emp-1', method: 'DELETE' })]));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Employer archived' }));
    confirm.mockRestore();
  });

  it('reports a refused archive with the route\'s reason and leaves the list alone', async () => {
    respond = ({ method }) =>
      method === 'DELETE' ? { status: 403, body: { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'admin' role" } } : undefined;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<EmployerManagement organizationId="org-1" onUpdate={onUpdate} />);
    await openRowMenu(user, 'Acme Corp');
    await user.click(await screen.findByRole('menuitem', { name: /Archive/ }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: "Requires at least 'admin' role" })),
    );
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    confirm.mockRestore();
  });
});

describe('toEmployerPayload', () => {
  const values = {
    name: 'Acme',
    legalName: 'Acme Inc.',
    businessNumber: '123',
    employerType: 'private',
    status: 'active',
    totalEmployees: '10',
    unionizedEmployees: '4',
    email: 'a@b.test',
    phone: '555',
    website: 'https://b.test',
    street: '1 Main St',
    city: 'Toronto',
    province: 'ON',
    postalCode: 'M5A 1A1',
    notes: 'n',
  };

  it('carries only columns of the employers table, none of them the tenant or the record\'s own bookkeeping', () => {
    const columns = Object.keys(getTableColumns(employers));
    const body = toEmployerPayload(values, null);
    for (const key of Object.keys(body)) expect(columns).toContain(key);
    for (const key of ['organizationId', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'archivedAt', 'id']) expect(body).not.toHaveProperty(key);
  });

  it('writes a new address with the country the Canadian province list implies, and an existing one with the keys the form does not edit', () => {
    expect(toEmployerPayload(values, null).mainAddress).toEqual({
      country: 'Canada',
      street: '1 Main St',
      city: 'Toronto',
      province: 'ON',
      postal_code: 'M5A 1A1',
    });
    const existing = { street: null, city: null, province: null, postalCode: null, extra: { unit: '4B', country: 'Canada', latitude: 43.7 } };
    expect(toEmployerPayload(values, existing).mainAddress).toEqual({
      unit: '4B',
      country: 'Canada',
      latitude: 43.7,
      street: '1 Main St',
      city: 'Toronto',
      province: 'ON',
      postal_code: 'M5A 1A1',
    });
  });

  it('clears the address when every address field is blank', () => {
    expect(toEmployerPayload({ ...values, street: '', city: '', province: '', postalCode: '' }, null).mainAddress).toBeNull();
  });
});
