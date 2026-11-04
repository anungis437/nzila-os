// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { bargainingUnits } from '@/db/schema/union-structure-schema';

// Radix menus, dialogs and selects measure and scroll elements that jsdom does not implement.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});

const toast = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { BargainingUnitManagement, toUnitPayload } from '../BargainingUnitManagement';

const unit = (overrides: Record<string, unknown>) => ({
  id: 'unit-1',
  organizationId: 'org-1',
  employerId: 'emp-1',
  worksiteId: 'ws-1',
  name: 'Maintenance Unit',
  unitNumber: 'U-12',
  unitType: 'full_time',
  status: 'active',
  certificationNumber: 'CERT-1',
  memberCount: 42,
  contractExpiryDate: '2026-12-31',
  nextBargainingDate: null,
  description: 'Plant maintenance trades',
  ...overrides,
});

const employers = [{ id: 'emp-1', name: 'Acme Corp' }, { id: 'emp-2', name: 'Globex' }];
const worksites = [{ id: 'ws-1', name: 'Plant A', employerId: 'emp-1' }, { id: 'ws-2', name: 'Depot', employerId: 'emp-2' }];

// What a CRUD-factory list sends: { data: rows, pagination } inside withApi's { success, data, timestamp } envelope.
const list = (rows: unknown[], page = 1, totalPages = 1) => ({
  success: true,
  data: { data: rows, pagination: { page, limit: 100, total: rows.length, totalPages } },
  timestamp: '2026-03-04T00:00:00.000Z',
});

type Call = { url: string; method: string; body: unknown };
const calls: Call[] = [];
let units: unknown[] = [];
let respond: (call: Call) => { status: number; body: unknown } | undefined = () => undefined;

function installFetch() {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call: Call = { url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    const custom = respond(call);
    const { status, body } = custom ?? defaultAnswer(call);
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }));
}

function defaultAnswer({ url, method }: Call): { status: number; body: unknown } {
  const path = url.split('?')[0];
  if (method === 'GET' && path === '/api/units') return { status: 200, body: list(units) };
  if (method === 'GET' && path === '/api/employers') return { status: 200, body: list(employers) };
  if (method === 'GET' && path === '/api/worksites') return { status: 200, body: list(worksites) };
  if (path.startsWith('/api/units/') && (method === 'PATCH' || method === 'DELETE')) return { status: 200, body: { success: true, data: { data: {} } } };
  if (path === '/api/units' && method === 'POST') return { status: 200, body: { success: true, data: { data: {} } } };
  throw new Error(`unexpected request ${method} ${url}`);
}

const writes = () => calls.filter((call) => call.method !== 'GET');

beforeEach(() => {
  calls.length = 0;
  toast.mockClear();
  units = [
    unit({}),
    unit({ id: 'unit-2', name: 'Clerical Unit', unitNumber: null, employerId: 'emp-2', worksiteId: null, memberCount: null, contractExpiryDate: null }),
    unit({ id: 'unit-3', name: 'Retired Unit', status: 'archived' }),
  ];
  respond = () => undefined;
  installFetch();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

async function openRowMenu(user: ReturnType<typeof userEvent.setup>, unitName: string) {
  const row = (await screen.findByText(unitName)).closest('tr') as HTMLElement;
  await user.click(within(row).getByRole('button'));
}

describe('BargainingUnitManagement: reading', () => {
  it('lists units from /api/units with employer and worksite names, and never calls the missing /api/bargaining-units', async () => {
    render(<BargainingUnitManagement organizationId="org-1" />);
    const row = (await screen.findByText('Maintenance Unit')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Acme Corp')).toBeInTheDocument();
    expect(within(row).getByText('Plant A')).toBeInTheDocument();
    expect(within(row).getByText('U-12')).toBeInTheDocument();
    expect(within(row).getByText('42')).toBeInTheDocument();
    expect(within(row).getByText('active')).toBeInTheDocument();
    // A calendar date is shown as that day, whatever the viewer's time zone.
    expect(within(row).getByText(new Date(2026, 11, 31).toLocaleDateString())).toBeInTheDocument();

    const clerical = (screen.getByText('Clerical Unit')).closest('tr') as HTMLElement;
    expect(within(clerical).getByText('Globex')).toBeInTheDocument();
    expect(within(clerical).getAllByText('—').length).toBeGreaterThanOrEqual(3);

    const urls = calls.map((call) => call.url);
    expect(urls).toContain('/api/units?limit=100&page=1');
    expect(urls).toContain('/api/employers?limit=100&page=1');
    expect(urls).toContain('/api/worksites?limit=100&page=1');
    expect(urls.join(' ')).not.toContain('bargaining-units');
  });

  it('keeps an archived unit off the working list', async () => {
    render(<BargainingUnitManagement organizationId="org-1" />);
    await screen.findByText('Maintenance Unit');
    expect(screen.queryByText('Retired Unit')).toBeNull();
  });

  it('reads every page of a list, not just the first', async () => {
    respond = ({ url, method }) => {
      if (method !== 'GET' || !url.startsWith('/api/units?')) return undefined;
      return url.includes('page=2')
        ? { status: 200, body: list([unit({ id: 'unit-9', name: 'Second Page Unit' })], 2, 2) }
        : { status: 200, body: list([unit({})], 1, 2) };
    };
    render(<BargainingUnitManagement organizationId="org-1" />);
    expect(await screen.findByText('Second Page Unit')).toBeInTheDocument();
    expect(screen.getByText('Maintenance Unit')).toBeInTheDocument();
    expect(calls.map((call) => call.url)).toContain('/api/units?limit=100&page=2');
  });

  it('shows a failed load as an error, never as an empty list', async () => {
    respond = ({ url, method }) => (method === 'GET' && url.startsWith('/api/units?') ? { status: 500, body: { code: 'INTERNAL_ERROR' } } : undefined);
    render(<BargainingUnitManagement organizationId="org-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('failedToLoad');
    expect(screen.queryByText('noUnitsYet')).toBeNull();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: 'failedToLoad' }));
  });

  it('treats a list body it does not recognise as a failure', async () => {
    respond = ({ url, method }) => (method === 'GET' && url.startsWith('/api/employers?') ? { status: 200, body: { success: true, data: [] } } : undefined);
    render(<BargainingUnitManagement organizationId="org-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('failedToLoad');
  });
});

describe('BargainingUnitManagement: writing', () => {
  it('saves an edit through PATCH /api/units/{id} with only the fields the route accepts', async () => {
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<BargainingUnitManagement organizationId="org-1" onUpdate={onUpdate} />);
    await openRowMenu(user, 'Maintenance Unit');
    await user.click(await screen.findByRole('menuitem', { name: /editButton/ }));

    const name = await screen.findByLabelText(/unitNameLabel/);
    await user.clear(name);
    await user.type(name, 'Maintenance and Trades');
    await user.click(screen.getByRole('button', { name: 'updateButton' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ url: '/api/units/unit-1', method: 'PATCH' });
    expect(writes()[0].body).toEqual({
      employerId: 'emp-1',
      worksiteId: 'ws-1',
      name: 'Maintenance and Trades',
      unitNumber: 'U-12',
      unitType: 'full_time',
      contractExpiryDate: '2026-12-31',
      nextBargainingDate: null,
      description: 'Plant maintenance trades',
    });
    // Certification, status, member count and organization are not the steward's to write.
    for (const forbidden of ['status', 'memberCount', 'certificationNumber', 'certificationDate', 'certificationBody', 'certificationExpiryDate', 'organizationId', 'notes', 'chiefStewardId']) {
      expect(writes()[0].body).not.toHaveProperty(forbidden);
    }
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'updatedSuccess' }));
    // The list is read again after a save.
    expect(calls.filter((call) => call.method === 'GET' && call.url.startsWith('/api/units?')).length).toBe(2);
  });

  it('shows the route\'s own refusal when a save is rejected, and does not claim success', async () => {
    respond = ({ method }) => (method === 'PATCH' ? { status: 400, body: { code: 'VALIDATION_ERROR', message: 'Field status cannot be assigned through generic CRUD' } } : undefined);
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<BargainingUnitManagement organizationId="org-1" onUpdate={onUpdate} />);
    await openRowMenu(user, 'Maintenance Unit');
    await user.click(await screen.findByRole('menuitem', { name: /editButton/ }));
    await user.click(await screen.findByRole('button', { name: 'updateButton' }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'destructive',
      description: 'Field status cannot be assigned through generic CRUD',
    })));
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ description: 'updatedSuccess' }));
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('does not create anything until an employer is chosen', async () => {
    const user = userEvent.setup();
    render(<BargainingUnitManagement organizationId="org-1" />);
    await screen.findByText('Maintenance Unit');
    await user.click(screen.getByRole('button', { name: /addUnit/ }));
    await user.type(await screen.findByLabelText(/unitNameLabel/), 'New Unit');
    await user.click(screen.getByRole('button', { name: 'createButton' }));
    expect(await screen.findByText('Employer is required')).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it('creates a unit through POST /api/units with the chosen employer and nothing the route refuses', async () => {
    const user = userEvent.setup();
    render(<BargainingUnitManagement organizationId="org-1" />);
    await screen.findByText('Maintenance Unit');
    await user.click(screen.getByRole('button', { name: /addUnit/ }));
    await user.click(await screen.findByRole('combobox', { name: /employerLabel/ }));
    await user.click(await screen.findByRole('option', { name: 'Globex' }));
    await user.type(screen.getByLabelText(/unitNameLabel/), 'Warehouse Unit');
    await user.click(screen.getByRole('button', { name: 'createButton' }));

    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(writes()[0]).toMatchObject({ url: '/api/units', method: 'POST' });
    expect(writes()[0].body).toEqual({
      employerId: 'emp-2',
      worksiteId: null,
      name: 'Warehouse Unit',
      unitNumber: null,
      unitType: 'full_time',
      contractExpiryDate: null,
      nextBargainingDate: null,
      description: null,
    });
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'createdSuccess' }));
  });

  it('deletes through DELETE /api/units/{id} after confirmation, and not without it', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<BargainingUnitManagement organizationId="org-1" onUpdate={onUpdate} />);

    confirm.mockReturnValue(false);
    await openRowMenu(user, 'Maintenance Unit');
    await user.click(await screen.findByRole('menuitem', { name: /deleteButton/ }));
    expect(writes()).toHaveLength(0);

    confirm.mockReturnValue(true);
    await openRowMenu(user, 'Maintenance Unit');
    await user.click(await screen.findByRole('menuitem', { name: /deleteButton/ }));
    await waitFor(() => expect(writes()).toEqual([expect.objectContaining({ url: '/api/units/unit-1', method: 'DELETE' })]));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'deletedSuccess' }));
    confirm.mockRestore();
  });

  it('reports a refused delete with the route\'s reason and leaves the list alone', async () => {
    respond = ({ method }) => (method === 'DELETE' ? { status: 403, body: { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'admin' role" } } : undefined);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onUpdate = vi.fn();
    const user = userEvent.setup();
    render(<BargainingUnitManagement organizationId="org-1" onUpdate={onUpdate} />);
    await openRowMenu(user, 'Maintenance Unit');
    await user.click(await screen.findByRole('menuitem', { name: /deleteButton/ }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive', description: "Requires at least 'admin' role" })));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText('Maintenance Unit')).toBeInTheDocument();
    confirm.mockRestore();
  });
});

describe('toUnitPayload', () => {
  const values = {
    employerId: 'emp-1',
    worksiteId: 'ws-1',
    name: 'Unit',
    unitNumber: 'U-1',
    unitType: 'craft' as const,
    contractExpiryDate: '2026-12-31',
    nextBargainingDate: '2027-01-15',
    description: 'Trades',
  };

  it('sends a blank optional field as null, which clears it, and carries only writable fields', () => {
    const payload = toUnitPayload({ ...values, worksiteId: '', unitNumber: '', contractExpiryDate: '', description: '' });
    expect(payload).toEqual({
      employerId: 'emp-1',
      worksiteId: null,
      name: 'Unit',
      unitNumber: null,
      unitType: 'craft',
      contractExpiryDate: null,
      nextBargainingDate: '2027-01-15',
      description: null,
    });
  });

  // The routes decide what a steward may write; the form follows them, so a change to a route cannot silently break the form.
  const listOf = (source: string, key: string) =>
    [...(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`).exec(source)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1]);
  const collectionRoute = readFileSync('app/api/units/route.ts', 'utf8');
  const itemRoute = readFileSync('app/api/units/[id]/route.ts', 'utf8');

  it('sends only fields the collection route accepts on create', () => {
    const writable = listOf(collectionRoute, 'writableFields');
    expect(writable.length).toBeGreaterThan(0);
    for (const key of Object.keys(toUnitPayload(values))) expect(writable).toContain(key);
  });

  it('sends nothing the item route refuses on update', () => {
    const blocked = listOf(itemRoute, 'blockedPatchFields');
    expect(blocked).toEqual(expect.arrayContaining(['status', 'memberCount', 'certificationNumber']));
    for (const key of Object.keys(toUnitPayload(values))) expect(blocked).not.toContain(key);
  });

  it('names only real columns of bargaining_units', () => {
    for (const key of Object.keys(toUnitPayload(values))) expect(bargainingUnits).toHaveProperty(key);
  });
});
