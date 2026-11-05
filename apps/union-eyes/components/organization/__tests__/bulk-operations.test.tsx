// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { installFetch, type Answer, type Call } from '@/components/union-structure/__tests__/fetch-harness';

// Radix dialogs and selects measure and scroll elements that jsdom does not implement.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});

const toast = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }));

import { BulkOperations } from '../bulk-operations';

const PARENT = '3f2b1c9e-7d4a-4e1b-9c55-0a6b8d2f1e33';

/** What PATCH /api/organizations/{id} answers when it changed the organization: plain { data: organization }. */
const updated = (id: string): Answer => ({ status: 200, body: { data: { id, name: id, status: 'active' } } });
const refused = (status: number, error: string): Answer => ({ status, body: { error } });

/** What GET /api/organizations/{id} answers: plain { data: organization } with the column names of the organizations table. */
const organization = (values: Record<string, unknown>) => ({
  data: {
    id: 'org-a',
    name: 'Local 1',
    slug: 'local-1',
    display_name: null,
    short_name: null,
    organization_type: 'local',
    parent_id: null,
    hierarchy_path: ['local-1'],
    hierarchy_level: 1,
    status: 'active',
    created_at: '2025-04-02T14:30:00.000Z',
    updated_at: '2025-04-02T14:30:00.000Z',
    memberCount: 41,
    activeClaims: 0,
    totalClaims: 0,
    childCount: 0,
    ...values,
  },
});

let calls: Call[];
let respond: (call: Call) => Answer;
const onSuccess = vi.fn();
const onClearSelection = vi.fn();
const downloads: { name: string }[] = [];
const files: string[] = [];

beforeEach(() => {
  respond = ({ url }) => updated(url.split('/').pop() ?? '');
  calls = installFetch((call) => respond(call));
  toast.mockClear();
  onSuccess.mockClear();
  onClearSelection.mockClear();
  downloads.length = 0;
  files.length = 0;
  vi.stubGlobal('Blob', class { constructor(readonly parts: string[]) {} });
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: (blob: { parts: string[] }) => {
        files.push(blob.parts[0]);
        return 'blob:organizations';
      },
      revokeObjectURL: () => {},
    }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push({ name: this.download });
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

const renderBar = (selectedIds = ['org-a', 'org-b']) =>
  render(<BulkOperations selectedIds={selectedIds} onSuccess={onSuccess} onClearSelection={onClearSelection} />);

const writes = () => calls.filter((call) => call.method === 'PATCH');

describe('BulkOperations: changing organizations', () => {
  it('shows nothing when nothing is selected', () => {
    const { container } = renderBar([]);

    expect(container).toBeEmptyDOMElement();
  });

  it('activates each selected organization with its own request and says how many the route accepted', async () => {
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole('button', { name: /Activate/ }));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(writes().map((call) => [call.url, call.body])).toEqual([
      ['/api/organizations/org-a', { status: 'active' }],
      ['/api/organizations/org-b', { status: 'active' }],
    ]);
    expect(toast).toHaveBeenCalledWith({ title: '2 organizations activated' });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('says so when the route refused some of them, with its reason, and does not call them updated', async () => {
    respond = ({ url }) => (url.endsWith('org-b') ? refused(403, 'Forbidden: changing parent affiliation or status requires platform governance') : updated('org-a'));
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole('button', { name: /Activate/ }));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith({
      title: '1 organization activated; 1 could not be',
      description: 'Forbidden: changing parent affiliation or status requires platform governance',
      variant: 'destructive',
    });
    // The list is read again for the one that changed.
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('reports that nothing was changed when every request was refused, and does not refresh as if it had', async () => {
    respond = () => refused(403, 'Forbidden: requires admin role');
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole('button', { name: /Activate/ }));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith({ title: 'No organization was activated', description: 'Forbidden: requires admin role', variant: 'destructive' });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('reports a request that never reached the server, and an error body in the route\'s other shapes', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('org-a')) throw new TypeError('Failed to fetch');
      return { ok: false, status: 500, json: async () => ({ code: 'INTERNAL_ERROR', message: 'Database unavailable' }) };
    }));
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole('button', { name: /Activate/ }));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith({ title: 'No organization was activated', description: 'Failed to fetch; Database unavailable', variant: 'destructive' });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('archives only after the person confirms', async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole('button', { name: /Archive/ }));
    expect(confirm).toHaveBeenCalledWith('Archive 2 organization(s)? This can be reversed later.');
    expect(calls).toEqual([]);

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: /Archive/ }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: '2 organizations archived' }));
    expect(writes().map((call) => call.body)).toEqual([{ status: 'archived' }, { status: 'archived' }]);
  });

  it('sets the status that was chosen, and closes the dialog once it was accepted', async () => {
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole('button', { name: 'Change Status' }));
    await user.click(await screen.findByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Suspended' }));
    await user.click(screen.getByRole('button', { name: 'Update Status' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: '2 organizations set to suspended' }));
    expect(writes().map((call) => call.body)).toEqual([{ status: 'suspended' }, { status: 'suspended' }]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps the status dialog open when no organization accepted the change', async () => {
    respond = () => refused(403, 'Forbidden: changing parent affiliation or status requires platform governance');
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole('button', { name: 'Change Status' }));
    await user.click(await screen.findByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Inactive' }));
    await user.click(screen.getByRole('button', { name: 'Update Status' }));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast.mock.calls[0][0]).toMatchObject({ title: 'No organization was set to inactive', variant: 'destructive' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('BulkOperations: moving organizations', () => {
  const openMove = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /Move/ }));
    return screen.findByRole('dialog');
  };

  it('moves them to the root level when the field is empty, as the dialog says, and the button says so', async () => {
    const user = userEvent.setup();
    renderBar();
    const dialog = await openMove(user);

    await user.click(within(dialog).getByRole('button', { name: 'Move to Root Level' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: '2 organizations moved to the root level' }));
    expect(writes().map((call) => call.body)).toEqual([{ parent_id: null }, { parent_id: null }]);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('moves them under the parent that was entered', async () => {
    const user = userEvent.setup();
    renderBar();
    const dialog = await openMove(user);

    await user.type(within(dialog).getByLabelText('New Parent Organization ID'), `  ${PARENT}  `);
    await user.click(within(dialog).getByRole('button', { name: 'Move Organizations' }));

    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: '2 organizations moved' }));
    expect(writes().map((call) => call.body)).toEqual([{ parent_id: PARENT }, { parent_id: PARENT }]);
  });

  it('refuses text that is not an organization id before asking the route, and says why', async () => {
    const user = userEvent.setup();
    renderBar();
    const dialog = await openMove(user);

    await user.type(within(dialog).getByLabelText('New Parent Organization ID'), 'Head Office');
    await user.click(within(dialog).getByRole('button', { name: 'Move Organizations' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('A parent organization ID is a UUID');
    expect(calls).toEqual([]);
    expect(toast).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText('New Parent Organization ID'), '!');
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('shows the route\'s refusal of a move, such as a cycle, and keeps the dialog open', async () => {
    respond = () => refused(400, 'An organization cannot be moved under one of its own descendants');
    const user = userEvent.setup();
    renderBar();
    const dialog = await openMove(user);

    await user.type(within(dialog).getByLabelText('New Parent Organization ID'), PARENT);
    await user.click(within(dialog).getByRole('button', { name: 'Move Organizations' }));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast.mock.calls[0][0]).toMatchObject({ title: 'No organization was moved', description: 'An organization cannot be moved under one of its own descendants', variant: 'destructive' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('BulkOperations: exporting organizations', () => {
  const reads = (rows: Record<string, ReturnType<typeof organization>>) => {
    respond = ({ url }) => {
      const body = rows[url.split('/').pop() ?? ''];
      return body ? { status: 200, body } : refused(404, 'Not found');
    };
  };

  it('writes one file with a row per selected organization, escaped so that a comma or a quote stays in its column', async () => {
    reads({
      'org-a': organization({ id: 'org-a', name: 'Local 1, "East" Region', organization_type: 'local', parent_id: PARENT }),
      'org-b': organization({ id: 'org-b', name: '=SUM(A1)', slug: null, organization_type: null, status: 'archived', created_at: null }),
    });
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole('button', { name: /Export/ }));

    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual(['GET /api/organizations/org-a', 'GET /api/organizations/org-b']);
    expect(downloads[0].name).toMatch(/^organizations-export-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(files).toHaveLength(1);
    expect(files[0].split('\n')).toEqual([
      'ID,Name,Type,Status,Parent ID,Slug,Created',
      `org-a,"Local 1, ""East"" Region",local,active,${PARENT},local-1,2025-04-02T14:30:00.000Z`,
      "org-b,'=SUM(A1),,archived,,,",
    ]);
    expect(toast).toHaveBeenCalledWith({ title: 'Exported 2 organizations' });
  });

  it('writes no file when one organization could not be read, and says which reason', async () => {
    reads({ 'org-a': organization({ id: 'org-a' }) });
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole('button', { name: /Export/ }));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast).toHaveBeenCalledWith({ title: '1 organization could not be read, so nothing was exported', description: 'Not found', variant: 'destructive' });
    expect(downloads).toEqual([]);
  });

  it.each([
    ['a body that is not a record', [], 'Unexpected API response: no organization'],
    ['a body without the organization', { success: true }, 'Unexpected API response: organization is not a record'],
    ['an organization without an id', { data: { name: 'Local 1' } }, 'Unexpected API response: id is missing'],
    ['an organization without a name', { data: { id: 'org-a' } }, 'Unexpected API response: name is missing'],
    ['a creation date that is not a date', { data: { id: 'org-a', name: 'Local 1', created_at: 'long ago' } }, 'Unexpected API response: created_at is not a date'],
  ])('writes no file for %s', async (_what, body, message) => {
    respond = () => ({ status: 200, body });
    const user = userEvent.setup();
    renderBar(['org-a']);

    await user.click(screen.getByRole('button', { name: /Export/ }));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast.mock.calls[0][0]).toMatchObject({ title: '1 organization could not be read, so nothing was exported', description: message, variant: 'destructive' });
    expect(downloads).toEqual([]);
  });
});

describe('BulkOperations: the bar', () => {
  it('clears the selection', async () => {
    const user = userEvent.setup();
    renderBar();

    await user.click(screen.getByRole('button', { name: 'Clear selection' }));

    expect(onClearSelection).toHaveBeenCalledTimes(1);
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });
});
