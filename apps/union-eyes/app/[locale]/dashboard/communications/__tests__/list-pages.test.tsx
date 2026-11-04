// @vitest-environment jsdom
// The three communications list pages (campaigns, templates, distribution lists) against a mocked fetch. They prove each shows the rows of a real list
// answer, that a "total" is the route's total and never the rows of the page in hand (a figure that covers only the page says so), and that an answer
// it cannot read - a refusal, a body of another shape, a list that does not say how many pages or how many rows it has - is an error with "—" in
// place of the figures, never an empty list and never a row of zeros. They prove nothing about the real routes.
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const translate = vi.hoisted(() =>
  Object.assign((key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key), {
    // The catalog has a word for every category but the free-text one a user typed.
    has: (key: string) => key !== 'category.Dues notice',
  }),
);
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next-intl', () => ({ useTranslations: () => translate, useLocale: () => 'en-CA' }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

import CampaignsPage from '../campaigns/page';
import DistributionListsPage from '../distribution-lists/page';
import TemplatesPage from '../templates/page';

const pagination = { page: 1, limit: 20, total: 1, totalPages: 1 };
const listBody = (rows: unknown[], extra: Record<string, unknown> = { pagination }) => ({ success: true, data: { data: rows, ...extra }, timestamp: 'now' });

const campaign = {
  id: 'c1', name: 'Dues drive', description: null, type: 'broadcast', channel: 'email', status: 'draft', audienceCount: 12,
  scheduledAt: null, sentAt: null, completedAt: null, stats: { queued: 0, sent: 0, delivered: 0, opened: 0, clicked: 0 }, createdAt: '2026-01-05T10:00:00Z',
};
const template = {
  id: 't1', name: 'Welcome note', description: null, type: 'email', category: 'campaign', subject: 'Hello', body: 'Hi', preheader: null, htmlContent: null,
  plainTextContent: null, variables: [], tags: [], isActive: true, createdAt: '2026-01-05T10:00:00Z', updatedAt: '2026-01-05T10:00:00Z',
};
const distributionList = {
  id: 'l1', name: 'Stewards', description: null, listType: 'manual', subscriberCount: 4, isActive: true, createdAt: '2026-01-05T10:00:00Z', updatedAt: '2026-01-05T10:00:00Z',
};

interface Subject {
  name: string;
  Page: () => ReactElement;
  url: string;
  row: unknown;
  rowName: string;
  failed: string;
  empty: string;
  totalTitle: string;
  found: string;
  search: string;
  pageOnly: number;
  detail: string;
}
const subjects: Subject[] = [
  { name: 'campaigns', Page: CampaignsPage, url: '/api/communications/campaigns?', row: campaign, rowName: 'Dues drive', failed: 'failedToFetchCampaigns', empty: 'noCampaignsFound', totalTitle: 'totalCampaignsTitle', found: 'campaignsFound', search: 'searchPlaceholder', pageOnly: 3, detail: '/en-CA/dashboard/communications/campaigns/c1' },
  { name: 'templates', Page: TemplatesPage, url: '/api/communications/templates?', row: template, rowName: 'Welcome note', failed: 'failedToFetchTemplates', empty: 'noTemplatesFound', totalTitle: 'totalTemplatesTitle', found: 'templatesFound', search: 'searchPlaceholder', pageOnly: 3, detail: '/en-CA/dashboard/communications/templates/t1' },
  { name: 'distribution lists', Page: DistributionListsPage, url: '/api/communications/distribution-lists?', row: distributionList, rowName: 'Stewards', failed: 'errors.fetchFailed', empty: 'states.empty', totalTitle: 'stats.totalLists', found: 'table.foundCount', search: 'search.placeholder', pageOnly: 2, detail: '/en-CA/dashboard/communications/distribution-lists/l1' },
];

// The card a figure sits in: the title's header's card.
function cardOf(title: string): HTMLElement {
  const card = screen.getByText(title).closest('.rounded-lg');
  if (!(card instanceof HTMLElement)) throw new Error(`no card for ${title}`);
  return card;
}
function rowOf(text: string): HTMLElement {
  const row = screen.getByText(text).closest('tr');
  if (!row) throw new Error(`no table row for ${text}`);
  return row;
}

function answer(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body })));
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe.each(subjects)('$name list page (jsdom, mocked fetch)', ({ Page, url, row, rowName, failed, empty, totalTitle, found, search, pageOnly, detail }) => {
  it('lists the rows of a real list answer from the route it should read', async () => {
    answer(200, listBody([row]));
    render(<Page />);

    expect(await screen.findByText(rowName)).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain(url);
    expect(screen.queryByText(failed)).not.toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('opens a row under the locale prefix of the page, not at a path the router would not resolve', async () => {
    answer(200, listBody([row]));
    render(<Page />);

    await screen.findByText(rowName);
    fireEvent.click(rowOf(rowName));

    expect(router.push).toHaveBeenCalledWith(detail);
  });

  it("shows the route's total, not the rows of the page in hand, and says which figures cover only the page", async () => {
    answer(200, listBody([row], { pagination: { page: 1, limit: 20, total: 57, totalPages: 3 } }));
    render(<Page />);

    await screen.findByText(rowName);
    expect(within(cardOf(totalTitle)).getByText('57')).toBeInTheDocument();
    expect(within(cardOf(totalTitle)).queryByText('onThisPage')).not.toBeInTheDocument();
    expect(screen.getByText(`${found} {"count":57}`)).toBeInTheDocument();
    expect(screen.getAllByText('onThisPage')).toHaveLength(pageOnly);
  });

  it('counts only the page in hand, and says so, once the rows are searched, and leaves the total alone', async () => {
    answer(200, listBody([row], { pagination: { page: 1, limit: 20, total: 57, totalPages: 3 } }));
    render(<Page />);

    await screen.findByText(rowName);
    fireEvent.change(screen.getByPlaceholderText(search), { target: { value: rowName } });

    expect(screen.getByText(`${found} {"count":1} (onThisPage)`)).toBeInTheDocument();
    expect(within(cardOf(totalTitle)).getByText('57')).toBeInTheDocument();
  });

  it.each([
    ['states no total', { page: 1, limit: 20, totalPages: 1 }],
    ['states a total that is not a count', { page: 1, limit: 20, total: '57', totalPages: 3 }],
    ['states a negative total', { page: 1, limit: 20, total: -1, totalPages: 1 }],
  ])('treats a list that %s as an error, not as a total of the rows it holds', async (_what, stated) => {
    answer(200, listBody([row], { pagination: stated }));
    render(<Page />);

    expect(await screen.findByText(failed)).toBeInTheDocument();
    expect(screen.queryByText(rowName)).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it('says there is nothing only for a list that is really empty, with a total of zero that the route gave', async () => {
    answer(200, listBody([], { pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }));
    render(<Page />);

    expect(await screen.findByText(empty)).toBeInTheDocument();
    expect(screen.queryByText(failed)).not.toBeInTheDocument();
    expect(within(cardOf(totalTitle)).getByText('0')).toBeInTheDocument();
  });

  it('shows the error and "—" in place of the figures when the route refuses', async () => {
    answer(403, { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'steward' role" });
    render(<Page />);

    expect(await screen.findByText(failed)).toBeInTheDocument();
    expect(screen.queryByText(empty)).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ['a bare array', { success: true, data: [] }],
    ['a body with no data', { success: true }],
    ['a record where the list should be', { success: true, data: { data: { id: 'x' }, pagination } }],
    ['a list that does not say how many pages it has', { success: true, data: { data: [] } }],
    ['a row with no name', { success: true, data: { data: [{ id: 'x' }], pagination } }],
    ['a row that is not a record', { success: true, data: { data: ['x'], pagination } }],
  ])('treats %s as an error, not as an empty list', async (_what, body) => {
    answer(200, body);
    render(<Page />);

    expect(await screen.findByText(failed)).toBeInTheDocument();
    expect(screen.queryByText(empty)).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows the error when the request itself fails, and no stale rows', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    render(<Page />);

    await waitFor(() => expect(screen.getByText('Failed to fetch')).toBeInTheDocument());
    expect(screen.queryByText(rowName)).not.toBeInTheDocument();
    expect(screen.queryByText(empty)).not.toBeInTheDocument();
  });
});

describe('campaigns list page: figures a row does not hold (jsdom, mocked fetch)', () => {
  const cells = () => within(rowOf('Dues drive')).getAllByRole('cell').map((cell) => cell.textContent);
  // The columns after the status: audience, sent, delivered, opened.
  const figures = () => cells().slice(4, 8);

  it('shows — for an audience nothing counted and for every delivery counter the row does not record, never 0', async () => {
    answer(200, listBody([{ ...campaign, audienceCount: 0, stats: null }]));
    render(<CampaignsPage />);

    await screen.findByText('Dues drive');
    expect(figures()).toEqual(['—', '—', '—', '—']);
  });

  it('shows the counters the row records, with rates worked out only from a positive base', async () => {
    answer(200, listBody([{ ...campaign, audienceCount: 10, status: 'sent', stats: { sent: 10, delivered: 8, opened: 4 } }]));
    render(<CampaignsPage />);

    await screen.findByText('Dues drive');
    expect(figures()).toEqual(['10', '10', '8(80.0%)', '4(50.0%)']);
  });

  it('shows a rate of nothing, not NaN, for a campaign that sent nothing', async () => {
    answer(200, listBody([{ ...campaign, stats: { sent: 0, delivered: 0, opened: 0 } }]));
    render(<CampaignsPage />);

    await screen.findByText('Dues drive');
    expect(figures().slice(1)).toEqual(['0', '0', '0']);
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });

  it('labels a multi-channel and a transactional campaign with the words for their enum values', async () => {
    answer(200, listBody([{ ...campaign, type: 'transactional', channel: 'multi_channel' }]));
    render(<CampaignsPage />);

    await screen.findByText('Dues drive');
    expect(within(rowOf('Dues drive')).getByText('type.transactional')).toBeInTheDocument();
    expect(within(rowOf('Dues drive')).getByText('channel.multi_channel')).toBeInTheDocument();
  });
});

describe('templates list page: columns the table leaves empty (jsdom, mocked fetch)', () => {
  it('shows a template with no category, variables, tags or active flag as stored, without failing', async () => {
    answer(200, listBody([{ ...template, category: null, variables: null, tags: null, isActive: null }]));
    render(<TemplatesPage />);

    await screen.findByText('Welcome note');
    const row = within(rowOf('Welcome note'));
    expect(row.getByText('—')).toBeInTheDocument();
    expect(row.getByText('noneLabel')).toBeInTheDocument();
    expect(row.getByText('status.active')).toBeInTheDocument();
  });

  it('shows a category the catalog has no word for as stored, not as a missing key', async () => {
    answer(200, listBody([{ ...template, category: 'Dues notice' }]));
    render(<TemplatesPage />);

    await screen.findByText('Welcome note');
    expect(within(rowOf('Welcome note')).getByText('Dues notice')).toBeInTheDocument();
    expect(screen.queryByText('category.Dues notice')).not.toBeInTheDocument();
  });
});
