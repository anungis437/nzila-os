// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { employerRow, list, unitRow, worksiteRow } from '@/lib/__tests__/support/union-structure-route-rows';
import { installFetch, type Answer, type Call } from './fetch-harness';

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { StructureGraph } from '../StructureGraph';

let employers: unknown[];
let worksites: unknown[];
let units: unknown[];
let respond: (call: Call) => Answer | undefined;
let calls: Call[];

function defaultAnswer({ url, method }: Call): Answer {
  const path = url.split('?')[0];
  if (method === 'GET' && path === '/api/employers') return { status: 200, body: list(employers) };
  if (method === 'GET' && path === '/api/worksites') return { status: 200, body: list(worksites) };
  if (method === 'GET' && path === '/api/units') return { status: 200, body: list(units) };
  throw new Error(`unexpected request ${method} ${url}`);
}

beforeEach(() => {
  employers = [employerRow({}), employerRow({ id: 'emp-2', name: 'Globex' }), employerRow({ id: 'emp-3', name: 'Retired Co', status: 'archived' })];
  worksites = [
    worksiteRow({}),
    worksiteRow({ id: 'ws-2', name: 'Closed Site', status: 'archived' }),
    worksiteRow({ id: 'ws-3', employerId: 'emp-2', name: 'Depot' }),
  ];
  units = [
    unitRow({}),
    unitRow({ id: 'unit-2', name: 'Clerical Unit' }),
    unitRow({ id: 'unit-3', name: 'Retired Unit', status: 'archived' }),
  ];
  respond = () => undefined;
  calls = installFetch((call) => respond(call) ?? defaultAnswer(call));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const cardOf = async (name: string) => (await screen.findByText(name)).closest('div.p-4') as HTMLElement;

describe('StructureGraph', () => {
  it('counts each employer\'s worksites and bargaining units from the real lists, leaving archived records out', async () => {
    render(<StructureGraph organizationId="org-1" />);

    const acme = await cardOf('Acme Corp');
    expect(within(acme).getByText('1 worksite')).toBeInTheDocument();
    expect(within(acme).getByText('2 bargaining units')).toBeInTheDocument();

    // The lists loaded, so an employer with none really has none.
    const globex = await cardOf('Globex');
    expect(within(globex).getByText('1 worksite')).toBeInTheDocument();
    expect(within(globex).getByText('0 bargaining units')).toBeInTheDocument();
  });

  it('does not show an archived employer', async () => {
    render(<StructureGraph organizationId="org-1" />);
    await cardOf('Acme Corp');
    expect(screen.queryByText('Retired Co')).toBeNull();
  });

  it('asks the three routes for every page and sends none of them the organization they already know', async () => {
    render(<StructureGraph organizationId="org-1" />);
    await cardOf('Acme Corp');
    expect(calls.map((call) => call.url).sort()).toEqual([
      '/api/employers?limit=100&page=1',
      '/api/units?limit=100&page=1',
      '/api/worksites?limit=100&page=1',
    ]);
  });

  it('says there is no structure only when the lists loaded and hold no active employer', async () => {
    employers = [employerRow({ status: 'archived' })];
    render(<StructureGraph organizationId="org-1" />);
    expect(await screen.findByText('No organizational structure data yet')).toBeInTheDocument();
  });

  it('shows a list that failed as an error with a retry, never as an empty structure or as counts of zero', async () => {
    let failing = true;
    respond = ({ url, method }) =>
      method === 'GET' && failing && url.startsWith('/api/worksites')
        ? { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Database unavailable' } }
        : undefined;
    const user = userEvent.setup();
    render(<StructureGraph organizationId="org-1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load the organizational structure: Database unavailable');
    expect(screen.queryByText('No organizational structure data yet')).toBeNull();
    expect(screen.queryByText(/bargaining unit/)).toBeNull();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('treats a body that is not the list envelope as a failure instead of crashing on it', async () => {
    respond = ({ url, method }) =>
      method === 'GET' && url.startsWith('/api/employers') ? { status: 200, body: { success: true, data: [] } } : undefined;
    render(<StructureGraph organizationId="org-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected API response');
  });
});
