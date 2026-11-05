// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextRequest } from 'next/server';
import { NextIntlClientProvider } from 'next-intl';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import enCA from '@/messages/en-CA.json';
import frCA from '@/messages/fr-CA.json';

// The routes below are the real ones: the list is GET /api/precedents (the real handler and the real precedent service) and a decision is
// the crud factory's item route run through the real withApi; only the identity, the database and the audit are stood in for. The console
// reads what they answer with, not a body written by hand, and the real search component sends the filters.
const state = vi.hoisted(() => ({
  decisions: [] as Record<string, unknown>[],
  /** The where clause of the last list read, so a test can see which filters reached SQL. */
  listClause: undefined as unknown,
}));
const toast = vi.hoisted(() => vi.fn());

vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/components/precedents/JurisdictionPreferences', () => ({ JurisdictionPreferences: () => null }));
vi.mock('@/lib/api-auth-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-auth-guard')>();
  return {
    ...actual,
    getCurrentUser: vi.fn(async () => ({ id: 'user-1', email: 'member@example.test', role: 'member', organizationId: 'org-1' })),
    // The deprecated role wrapper is passed through: the route's own handler is what the console reads.
    withRoleAuth: (_role: string, handler: (request: import('next/server').NextRequest, context: Record<string, unknown>) => Promise<Response>) =>
      (request: import('next/server').NextRequest, context: Record<string, unknown> = {}) => handler(request, context),
  };
});
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
  createRateLimitHeaders: vi.fn(() => ({})),
}));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: vi.fn(async () => undefined) }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
vi.mock('@/lib/organization-utils', () => ({
  getOrganizationIdForUser: vi.fn(async () => 'org-1'),
  getUserRoleInOrganization: vi.fn(async () => 'member'),
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (_context: unknown, operation: (tx: unknown) => Promise<unknown>) => operation({}),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn() }));
vi.mock('@/db/db', async () => {
  const { PgDialect: Dialect } = await import('drizzle-orm/pg-core');
  const dialect = new Dialect();
  return {
    db: {
      select: (selection?: unknown) => {
        // A count query selects an aggregate; a list read ends in offset(); an item read is awaited right after its where clause,
        // which names the id it wants.
        const counting = selection !== undefined;
        const chain: Record<string, unknown> = {};
        chain.from = () => chain;
        chain.where = (clause: unknown) => {
          chain.clause = clause;
          return chain;
        };
        chain.orderBy = () => chain;
        chain.limit = () => chain;
        chain.offset = () => {
          state.listClause = chain.clause;
          return Promise.resolve(state.decisions);
        };
        chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
          const params = chain.clause ? dialect.sqlToQuery(chain.clause as SQL).params : [];
          // The crud factory counts as `total`, the precedent service as `count`.
          const result = counting
            ? [{ total: state.decisions.length, count: state.decisions.length }]
            : state.decisions.filter((decision) => params.includes(decision.id));
          return Promise.resolve(result).then(resolve, reject);
        };
        return chain;
      },
    },
  };
});

import { GET as listPrecedents } from '@/app/api/precedents/route';
import { GET as getPrecedent } from '@/app/api/arbitration/precedents/[id]/route';
import { PrecedentsConsole } from '../precedents-console';

const dialect = new PgDialect();

const decision = (overrides: Record<string, unknown> = {}) => ({
  id: 'd-1',
  caseNumber: 'ABC-2021-001',
  caseTitle: 'Union v. First Employer',
  tribunal: 'private_arbitrator',
  decisionType: 'grievance',
  decisionDate: '2021-03-04T12:00:00.000Z',
  arbitrator: 'Jane Arbitrator',
  grievor: 'A. Worker',
  union: 'Local 100',
  employer: 'Acme Ltd.',
  outcome: 'grievance_upheld',
  keyFindings: ['Discharge without cause was not made out', 'Reinstatement with back pay'],
  issueTypes: ['discharge'],
  precedentValue: 'high',
  fullText: 'The full text of the award.',
  summary: 'The grievance was upheld.',
  reasoning: 'The employer did not meet its onus.',
  jurisdiction: 'ON',
  // What the real select returns for a decision nothing has counted: the column defaults.
  viewCount: 0,
  citationCount: 0,
  isPublic: true,
  accessRestrictions: null,
  createdAt: '2021-03-05T15:30:00.000Z',
  updatedAt: '2021-03-06T15:30:00.000Z',
  ...overrides,
});

const DEFAULT_PREFERENCES = { isConfigured: true, autoApply: false, preferredJurisdictions: [], includeNational: true };

interface Server {
  list: 'ok' | 'unauthenticated' | 'wrong-shape';
  items: Record<string, 'ok' | 'missing'>;
  preferences: 'ok' | 'failing';
  preferencesBody: Record<string, unknown>;
}
let server: Server;
const requested: string[] = [];

/** The list requests the console made, as query strings. */
const listRequests = (): URLSearchParams[] =>
  requested.filter((url) => url.startsWith('/api/precedents?')).map((url) => new URL(url, 'http://localhost').searchParams);

/** The values the last list read put in its SQL, as the database would receive them. */
const listedWith = (): unknown[] => dialect.sqlToQuery(state.listClause as SQL).params;

/** Answers the console's requests: the list and the item with the real handlers, the preference route with a stand-in. */
const fetchServer = vi.fn(async (input: string): Promise<Response> => {
  requested.push(input);
  const url = new URL(input, 'http://localhost');
  if (url.pathname === '/api/precedents/jurisdiction-preferences') {
    return server.preferences === 'failing'
      ? Response.json({ code: 'INTERNAL_ERROR', message: 'Preferences are unavailable' }, { status: 500 })
      : Response.json({ success: true, data: server.preferencesBody });
  }
  if (url.pathname === '/api/precedents') {
    if (server.list === 'unauthenticated') return Response.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    if (server.list === 'wrong-shape') return Response.json({ success: true, data: { precedents: [] } });
    return listPrecedents(new NextRequest(url), {});
  }
  const item = /^\/api\/arbitration\/precedents\/([^/]+)$/.exec(url.pathname);
  if (item) {
    const id = decodeURIComponent(item[1]);
    if (server.items[id] === 'missing') return Response.json({ code: 'NOT_FOUND', message: 'arbitration_decisions not found' }, { status: 404 });
    return getPrecedent(new NextRequest(url), { params: Promise.resolve({ id }) });
  }
  return Response.json({ message: `unexpected ${input}` }, { status: 404 });
});

beforeEach(() => {
  state.listClause = undefined;
  state.decisions = [decision(), decision({ id: 'd-2', caseNumber: 'XYZ-2022-007', caseTitle: 'Union v. Second Employer', outcome: 'dismissed' })];
  server = { list: 'ok', items: {}, preferences: 'ok', preferencesBody: DEFAULT_PREFERENCES };
  requested.length = 0;
  toast.mockClear();
  fetchServer.mockClear();
  vi.stubGlobal('fetch', fetchServer);
  // The compare view's scroll areas measure their content, which jsdom cannot.
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderConsole(locale: 'en-CA' | 'fr-CA' = 'en-CA') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA} timeZone="UTC">
      <PrecedentsConsole />
    </NextIntlClientProvider>,
  );
}

const openTab = (name: string) => fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 });

async function openFirstDecision() {
  await screen.findByText('Union v. First Employer');
  fireEvent.click(screen.getAllByText('The grievance was upheld.')[0]);
}

describe('PrecedentsConsole: the view tab, against the real item route', () => {
  it('shows the decision the route answers with, not a blank record', async () => {
    renderConsole();

    await openFirstDecision();

    expect(await screen.findByRole('heading', { name: 'ABC-2021-001 - Union v. First Employer' })).toBeInTheDocument();
    expect(requested).toContain('/api/arbitration/precedents/d-1');
    expect(screen.getByText('Jane Arbitrator')).toBeInTheDocument();
    expect(screen.getAllByText('Local 100').length).toBeGreaterThan(0);
    expect(screen.getByText('Acme Ltd.')).toBeInTheDocument();
    expect(screen.getByText('The employer did not meet its onus.')).toBeInTheDocument();
    expect(screen.getByText(/Discharge without cause was not made out\s+Reinstatement with back pay/)).toBeInTheDocument();
    // The outcome and precedent value are the database's own members, labelled; the tribunal and the decision type likewise.
    expect(screen.getByText('Grievance upheld')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Private arbitrator')).toBeInTheDocument();
    expect(screen.getByText('Grievance')).toBeInTheDocument();
    // The decision date is the day the decision names, written for the viewer's language.
    expect(screen.getByText('March 4, 2021')).toBeInTheDocument();
    expect(screen.getByText('Ontario')).toBeInTheDocument();
    // The platform's public projection withholds the grievor, so the viewer shows none.
    expect(screen.queryByText('A. Worker')).toBeNull();
    expect(document.body.textContent).not.toMatch(/undefined|NaN/);
    // The stored counts are the column defaults, which record no measurement: no engagement figure is shown for them.
    expect(screen.queryByText('Engagement')).toBeNull();
    expect(document.body.textContent).not.toMatch(/\b0 (views|citations)\b/);
  });

  it('shows the view and citation counts a decision carries, labelled, and only those', async () => {
    state.decisions = [decision({ viewCount: 12, citationCount: 0 }), decision({ id: 'd-2', caseNumber: 'XYZ-2022-007', caseTitle: 'Union v. Second Employer' })];
    renderConsole();

    await openFirstDecision();

    expect(await screen.findByText('Engagement')).toBeInTheDocument();
    expect(screen.getByText('12 views')).toBeInTheDocument();
    expect(screen.queryByText(/citations/)).toBeNull();
  });

  it('says so, with a retry that reads the decision again, when it cannot be read', async () => {
    server.items['d-1'] = 'missing';
    renderConsole();

    await openFirstDecision();

    const failure = await screen.findByRole('alert');
    expect(failure).toHaveTextContent('This precedent could not be loaded');
    expect(failure).toHaveTextContent('arbitration_decisions not found');
    expect(screen.queryByRole('heading', { name: /ABC-2021-001/ })).toBeNull();

    server.items['d-1'] = 'ok';
    fireEvent.click(within(failure).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('heading', { name: 'ABC-2021-001 - Union v. First Employer' })).toBeInTheDocument();
    expect(screen.queryByText('This precedent could not be loaded')).toBeNull();
  });

  it('never shows the previously opened decision in place of the one that was asked for', async () => {
    renderConsole();
    await openFirstDecision();
    await screen.findByRole('heading', { name: 'ABC-2021-001 - Union v. First Employer' });

    server.items['d-2'] = 'missing';
    openTab(enCA.precedents.browse);
    fireEvent.click(screen.getAllByText('The grievance was upheld.')[1]);

    expect(await screen.findByText('This precedent could not be loaded')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /ABC-2021-001/ })).toBeNull();
  });

  it('offers no add, edit, share, delete or download that the routes could not complete', async () => {
    renderConsole();
    await screen.findByText('Union v. First Employer');
    expect(screen.queryByRole('button', { name: /add precedent/i })).toBeNull();

    fireEvent.click(screen.getAllByText('The grievance was upheld.')[0]);
    await screen.findByRole('heading', { name: 'ABC-2021-001 - Union v. First Employer' });

    for (const name of [/share/i, /edit/i, /delete/i, /download/i]) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
    expect(screen.getByRole('button', { name: 'Compare' })).toBeInTheDocument();
  });
});

describe('PrecedentsConsole: the list, against the real list route', () => {
  it('lists the decisions the route answers with', async () => {
    renderConsole();

    expect(await screen.findByText('Union v. First Employer')).toBeInTheDocument();
    expect(screen.getByText('Union v. Second Employer')).toBeInTheDocument();
    expect(screen.getByText('ABC-2021-001')).toBeInTheDocument();
    expect(screen.getByText('Dismissed')).toBeInTheDocument();
    expect(screen.getByText('Grievance upheld')).toBeInTheDocument();
    expect(screen.getAllByText('Ontario')).toHaveLength(2);
    expect(screen.queryByText(enCA.precedents.noPrecedentsFound)).toBeNull();
  });

  it('writes a decision’s month from the day it names, whatever time zone the viewer is in', async () => {
    state.decisions = [decision({ decisionDate: '2021-03-01T00:00:00.000Z' })];
    render(
      <NextIntlClientProvider locale="en-CA" messages={enCA} timeZone="America/Toronto">
        <PrecedentsConsole />
      </NextIntlClientProvider>,
    );

    expect(await screen.findByText('Mar 2021')).toBeInTheDocument();
    expect(screen.queryByText('Feb 2021')).toBeNull();
  });

  it('reads the list from the route that filters, not from the generic list that ignores everything but the page', async () => {
    renderConsole();
    await screen.findByText('Union v. First Employer');

    const [first] = listRequests();
    expect([...first.keys()].sort()).toEqual(['limit', 'page']);
    expect(first.get('page')).toBe('1');
    expect(first.get('limit')).toBe('20');
    expect(requested.some((url) => url.startsWith('/api/arbitration/precedents?'))).toBe(false);
  });

  it('says there are none only when the route answers with none', async () => {
    state.decisions = [];
    renderConsole();

    expect(await screen.findByText(enCA.precedents.noPrecedentsFound)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a failed list as a failure with a retry, never as “no precedents”', async () => {
    server.list = 'unauthenticated';
    renderConsole();

    const failure = await screen.findByRole('alert');
    expect(failure).toHaveTextContent('Precedents could not be loaded');
    expect(failure).toHaveTextContent('This does not mean there are no precedents.');
    expect(failure).toHaveTextContent('Authentication required');
    expect(screen.queryByText(enCA.precedents.noPrecedentsFound)).toBeNull();

    server.list = 'ok';
    fireEvent.click(within(failure).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Union v. First Employer')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('treats an answer of the wrong shape as a failure, not as an empty list', async () => {
    server.list = 'wrong-shape';
    renderConsole();

    const failure = await screen.findByRole('alert');
    expect(failure).toHaveTextContent('Unexpected API response');
    expect(screen.queryByText(enCA.precedents.noPrecedentsFound)).toBeNull();
  });

  it('says the saved jurisdictions were not applied when they could not be read, and still lists the decisions', async () => {
    server.preferences = 'failing';
    renderConsole();

    expect(await screen.findByText('Union v. First Employer')).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Your jurisdiction preferences could not be loaded, so the results are not filtered by them.');
  });

  it('says nothing about preferences when they were read', async () => {
    renderConsole();

    await screen.findByText('Union v. First Employer');
    expect(screen.queryByText('Jurisdiction preferences not applied')).toBeNull();
  });
});

describe('PrecedentsConsole: the filters, against the real list route', () => {
  const searchBox = () => screen.getByRole('textbox', { name: 'Search precedents' });
  const openFilters = () => fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
  const lastListRequest = (): URLSearchParams => {
    const all = listRequests();
    return all[all.length - 1];
  };

  it('searches, and the text reaches the route’s SQL as a search over title, number and summaries', async () => {
    renderConsole();
    await screen.findByText('Union v. First Employer');

    fireEvent.change(searchBox(), { target: { value: 'harassment' } });

    await waitFor(() => expect(lastListRequest().get('searchQuery')).toBe('harassment'), { timeout: 3000 });
    await waitFor(() => expect(listedWith()).toEqual(expect.arrayContaining(['%harassment%'])));
    expect(lastListRequest().get('page')).toBe('1');
  });

  it('applies the outcome a member ticks and the jurisdiction they choose, under the database’s own names', async () => {
    renderConsole();
    await screen.findByText('Union v. First Employer');
    openFilters();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Grievance upheld' }));
    await waitFor(() => expect(lastListRequest().get('outcome')).toBe('grievance_upheld'));
    await waitFor(() => expect(listedWith()).toEqual(expect.arrayContaining(['grievance_upheld'])));

    fireEvent.click(screen.getByRole('checkbox', { name: 'High' }));
    fireEvent.change(screen.getByLabelText('Jurisdiction'), { target: { value: 'QC' } });
    await waitFor(() => expect(lastListRequest().get('jurisdiction')).toBe('QC'));
    await waitFor(() => expect(listedWith()).toEqual(expect.arrayContaining(['grievance_upheld', 'high', 'QC'])));
  });

  it('applies the dates, the sector and the arbitrator the member enters', async () => {
    renderConsole();
    await screen.findByText('Union v. First Employer');
    openFilters();

    fireEvent.change(screen.getByLabelText('Decided on or after'), { target: { value: '2021-01-01' } });
    fireEvent.change(screen.getByLabelText('Decided on or before'), { target: { value: '2021-12-31' } });
    fireEvent.change(screen.getByLabelText('Sector'), { target: { value: 'educ' } });
    fireEvent.change(screen.getByLabelText('Arbitrator'), { target: { value: 'Jane' } });

    await waitFor(() => expect(lastListRequest().get('arbitrator')).toBe('Jane'), { timeout: 3000 });
    const request = lastListRequest();
    expect(request.get('dateFrom')).toBe('2021-01-01');
    expect(request.get('dateTo')).toBe('2021-12-31T23:59:59.999Z');
    expect(request.get('sector')).toBe('educ');
    await waitFor(() =>
      expect(listedWith()).toEqual(expect.arrayContaining(['2021-01-01T00:00:00.000Z', '2021-12-31T23:59:59.999Z', '%educ%', '%Jane%'])),
    );
  });

  it('sends only filters the route reads, never one of the older search screen’s names', async () => {
    renderConsole();
    await screen.findByText('Union v. First Employer');
    fireEvent.change(searchBox(), { target: { value: 'x' } });
    await waitFor(() => expect(lastListRequest().get('searchQuery')).toBe('x'), { timeout: 3000 });
    openFilters();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Settled' }));
    await waitFor(() => expect(lastListRequest().get('outcome')).toBe('settled'));

    const read = ['page', 'limit', 'searchQuery', 'outcome', 'precedentValue', 'jurisdiction', 'sector', 'arbitrator', 'dateFrom', 'dateTo'];
    for (const request of listRequests()) {
      for (const name of request.keys()) expect(read).toContain(name);
    }
  });

  it('returns to the first page when a filter changes', async () => {
    state.decisions = Array.from({ length: 21 }, (_, index) =>
      decision({ id: `d-${index + 1}`, caseNumber: `N-${index + 1}`, caseTitle: `Case ${index + 1}` }),
    );
    renderConsole();
    await screen.findByText('Case 1');
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(lastListRequest().get('page')).toBe('2'));

    openFilters();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Settled' }));
    await waitFor(() => expect(lastListRequest().get('outcome')).toBe('settled'));
    expect(lastListRequest().get('page')).toBe('1');
  });

  it('clears every filter and reads the whole list again', async () => {
    renderConsole();
    await screen.findByText('Union v. First Employer');
    openFilters();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Settled' }));
    await waitFor(() => expect(lastListRequest().get('outcome')).toBe('settled'));

    fireEvent.click(screen.getByRole('button', { name: 'Clear all filters' }));

    await waitFor(() => expect([...lastListRequest().keys()].sort()).toEqual(['limit', 'page']));
    await waitFor(() => expect(listedWith()).toEqual([true, '']));
  });

  it('says there is nothing for a filter that matches nothing, as the route answers, and not that the list failed', async () => {
    renderConsole();
    await screen.findByText('Union v. First Employer');
    state.decisions = [];
    openFilters();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Withdrawn' }));

    await waitFor(() => expect(lastListRequest().get('outcome')).toBe('withdrawn'));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(await screen.findByText(enCA.precedents.noPrecedentsFound)).toBeInTheDocument();
    expect(screen.queryByText('Precedents could not be loaded')).toBeNull();
  });
});

describe('PrecedentsConsole: the saved jurisdiction', () => {
  it('opens filtered to a single saved jurisdiction, because the list can filter by one at a time', async () => {
    server.preferencesBody = { isConfigured: true, autoApply: true, preferredJurisdictions: ['ON'], includeNational: false };
    renderConsole();

    await waitFor(() => expect(listRequests().some((request) => request.get('jurisdiction') === 'ON')).toBe(true));
    await waitFor(() => expect(listedWith()).toEqual(expect.arrayContaining(['ON'])));
    expect(screen.queryByText('Jurisdiction preferences not applied')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }));
    expect(screen.getByLabelText('Jurisdiction')).toHaveValue('ON');
  });

  it('applies none, and says why, when the saved preference names more than one jurisdiction', async () => {
    server.preferencesBody = { isConfigured: true, autoApply: true, preferredJurisdictions: ['ON'], includeNational: true };
    renderConsole();

    expect(await screen.findByRole('status')).toHaveTextContent('Your saved preferences name more than one jurisdiction');
    await screen.findByText('Union v. First Employer');
    expect(listRequests().every((request) => !request.has('jurisdiction'))).toBe(true);
  });

  it('applies none when auto-apply is off, and says nothing about it', async () => {
    server.preferencesBody = { isConfigured: true, autoApply: false, preferredJurisdictions: ['ON'], includeNational: false };
    renderConsole();

    await screen.findByText('Union v. First Employer');
    expect(listRequests().every((request) => !request.has('jurisdiction'))).toBe(true);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('offers to save one, without promising a ranking the list does not do, when none is configured', async () => {
    server.preferencesBody = { isConfigured: false };
    renderConsole();

    expect(await screen.findByText('Save your jurisdiction preference')).toBeInTheDocument();
    expect(screen.getByText(/the list opens filtered to it/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/most relevant precedents first/);
  });
});

describe('PrecedentsConsole: comparing from the list', () => {
  const selectBoth = async (locale: 'en-CA' | 'fr-CA' = 'en-CA') => {
    await screen.findByText('Union v. First Employer');
    const [one, two] = screen.getAllByRole('checkbox');
    fireEvent.click(one);
    fireEvent.click(two);
    fireEvent.click(screen.getByRole('button', { name: (locale === 'en-CA' ? enCA : frCA).precedents.compare }));
  };

  it('reads each selected decision from the item route and shows them side by side, never posting to a compare route', async () => {
    renderConsole();

    await selectBoth();

    expect(await screen.findByText('Precedent Comparison')).toBeInTheDocument();
    expect(screen.getByText('Comparing 2 precedents')).toBeInTheDocument();
    expect(requested).toEqual(expect.arrayContaining(['/api/arbitration/precedents/d-1', '/api/arbitration/precedents/d-2']));
    expect(requested.some((url) => url.includes('compare'))).toBe(false);
    expect(screen.queryByText('Analysis Summary')).toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });

  it('says so, with a retry, when a selected decision cannot be read, and shows no comparison', async () => {
    server.items['d-2'] = 'missing';
    renderConsole();

    await selectBoth();

    const failure = await screen.findByRole('alert');
    expect(failure).toHaveTextContent('The comparison could not be loaded');
    expect(failure).toHaveTextContent('arbitration_decisions not found');
    expect(screen.queryByText('Precedent Comparison')).toBeNull();
    expect(toast).not.toHaveBeenCalled();

    server.items['d-2'] = 'ok';
    fireEvent.click(within(failure).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Comparing 2 precedents')).toBeInTheDocument();
    expect(screen.queryByText('The comparison could not be loaded')).toBeNull();
  });

  it('says so in French in a French locale', async () => {
    server.items['d-1'] = 'missing';
    renderConsole('fr-CA');

    await selectBoth('fr-CA');

    const failure = await screen.findByRole('alert');
    expect(failure).toHaveTextContent('La comparaison n’a pas pu être chargée');
    expect(within(failure).getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it('drops a removed decision from the comparison and leaves it when fewer than two remain', async () => {
    renderConsole();
    await selectBoth();
    await screen.findByText('Precedent Comparison');

    fireEvent.click(screen.getByRole('button', { name: 'Remove ABC-2021-001 from the comparison' }));

    await waitFor(() => expect(screen.queryByText('Precedent Comparison')).toBeNull());
    expect(await screen.findByText('Union v. Second Employer')).toBeInTheDocument();
  });

  it('names each decision’s checkbox, so a screen reader can tell which one is being selected', async () => {
    renderConsole();
    await screen.findByText('Union v. First Employer');

    expect(screen.getByRole('checkbox', { name: 'Select ABC-2021-001 for comparison' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select XYZ-2022-007 for comparison' })).toBeInTheDocument();
  });
});

describe('PrecedentsConsole: comparing from the view tab', () => {
  it('adds the decision being read to the selection and compares it with the one already chosen', async () => {
    renderConsole();
    await screen.findByText('Union v. First Employer');
    fireEvent.click(screen.getAllByRole('checkbox')[1]);

    fireEvent.click(screen.getAllByText('The grievance was upheld.')[0]);
    await screen.findByRole('heading', { name: 'ABC-2021-001 - Union v. First Employer' });
    fireEvent.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: 'Compare' }));

    expect(await screen.findByText('Comparing 2 precedents')).toBeInTheDocument();
    expect(requested).toEqual(expect.arrayContaining(['/api/arbitration/precedents/d-1', '/api/arbitration/precedents/d-2']));
    expect(toast).not.toHaveBeenCalled();
  });

  it('adds the decision and asks for another when it is the only one chosen, instead of comparing it with itself', async () => {
    renderConsole();
    await openFirstDecision();
    await screen.findByRole('heading', { name: 'ABC-2021-001 - Union v. First Employer' });

    fireEvent.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: 'Compare' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Select more precedents', variant: 'destructive' })),
    );
    expect(screen.getByText(`1 ${enCA.precedents.selected}`)).toBeInTheDocument();
    expect(screen.queryByText(/Comparing/)).toBeNull();
  });
});

describe('PrecedentsConsole: French', () => {
  it('says a failed list could not be loaded, in French', async () => {
    server.list = 'unauthenticated';
    renderConsole('fr-CA');

    const failure = await screen.findByRole('alert');
    expect(failure).toHaveTextContent('Les précédents n’ont pas pu être chargés');
    expect(within(failure).getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it('says a decision could not be loaded, in French', async () => {
    server.items['d-1'] = 'missing';
    renderConsole('fr-CA');

    await screen.findByText('Union v. First Employer');
    fireEvent.click(screen.getAllByText('The grievance was upheld.')[0]);

    expect(await screen.findByText('Ce précédent n’a pas pu être chargé')).toBeInTheDocument();
  });

  it('says the saved jurisdictions were not applied, in French', async () => {
    server.preferences = 'failing';
    renderConsole('fr-CA');

    expect(await screen.findByRole('status')).toHaveTextContent('Vos préférences de territoire n’ont pas pu être chargées');
  });

  it('says several saved jurisdictions cannot be applied together, in French, and filters in French', async () => {
    server.preferencesBody = { isConfigured: true, autoApply: true, preferredJurisdictions: ['ON'], includeNational: true };
    renderConsole('fr-CA');

    expect(await screen.findByRole('status')).toHaveTextContent('plus d’un territoire');
    expect(screen.getByRole('textbox', { name: 'Rechercher des précédents' })).toBeInTheDocument();
    await screen.findByText('Union v. First Employer');
    expect(screen.getByText('Grief accueilli')).toBeInTheDocument();
    expect(screen.getAllByText('Ontario')).toHaveLength(2);
  });

  it('writes an opened decision in French: its labels, its date and its counts', async () => {
    state.decisions = [decision({ viewCount: 1200 }), decision({ id: 'd-2', caseNumber: 'XYZ-2022-007', caseTitle: 'Union v. Second Employer' })];
    renderConsole('fr-CA');

    await screen.findByText('Union v. First Employer');
    fireEvent.click(screen.getAllByText('The grievance was upheld.')[0]);

    expect(await screen.findByRole('heading', { name: 'ABC-2021-001 - Union v. First Employer' })).toBeInTheDocument();
    expect(screen.getByText('Renseignements sur le dossier')).toBeInTheDocument();
    expect(screen.getByText('4 mars 2021')).toBeInTheDocument();
    expect(screen.getByText('Arbitre privé')).toBeInTheDocument();
    expect(screen.getByText('Grief accueilli')).toBeInTheDocument();
    expect(screen.getByText('Élevée')).toBeInTheDocument();
    expect(screen.getByText(/^1\s200 consultations$/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Case Information|Decision Date|Jurisdiction\b|\bviews\b/);
  });
});
