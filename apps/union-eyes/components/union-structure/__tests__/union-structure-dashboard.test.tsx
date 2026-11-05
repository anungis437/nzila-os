// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

// Radix tabs measure elements that jsdom does not implement.
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

const locale = vi.hoisted(() => ({ current: 'en-CA' }));
vi.mock('next-intl', () => ({
  useLocale: () => locale.current,
  useTranslations: () => (key: string) => key,
}));
const logger = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock('@/lib/logger', () => ({ logger }));
vi.mock('../EmployerManagement', () => ({ EmployerManagement: () => null }));
vi.mock('../WorksiteManagement', () => ({ WorksiteManagement: () => null }));
vi.mock('../CommitteeManagement', () => ({ CommitteeManagement: () => null }));
vi.mock('../StructureGraph', () => ({ StructureGraph: () => null }));
vi.mock('../BargainingUnitManagement', () => {
  const BargainingUnitManagement = ({ onUpdate }: { onUpdate?: () => void }) => (
    <button type="button" onClick={onUpdate}>units-tab-saved</button>
  );
  BargainingUnitManagement.displayName = 'BargainingUnitManagement';
  return { BargainingUnitManagement };
});

import { UnionStructureDashboard } from '../UnionStructureDashboard';

interface Answer {
  status: number;
  body: unknown;
}

const row = (id: string, status = 'active') => ({ id, name: id, status });
const rows = (count: number, status = 'active') => Array.from({ length: count }, (_, index) => row(`row-${index}`, status));

// What a CRUD-factory list sends: { data: rows, pagination } inside withApi's { success, data, timestamp } envelope.
const list = (data: unknown[], page = 1, totalPages = 1) => ({
  success: true,
  data: { data, pagination: { page, limit: 100, total: data.length, totalPages } },
  timestamp: '2026-03-04T00:00:00.000Z',
});
const ok = (body: unknown): Answer => ({ status: 200, body });

const requested: string[] = [];
let answer: (path: string, page: number) => Answer | Promise<Answer>;

const defaultAnswer = (path: string): Answer => {
  const known: Record<string, unknown[]> = {
    '/api/employers': rows(3),
    '/api/worksites': rows(2),
    '/api/units': rows(4),
    '/api/committees': rows(1),
  };
  const found = known[path];
  if (!found) throw new Error(`unexpected request ${path}`);
  return ok(list(found));
};

beforeEach(() => {
  requested.length = 0;
  locale.current = 'en-CA';
  logger.error.mockClear();
  answer = (path) => defaultAnswer(path);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    requested.push(url);
    const [path, query = ''] = url.split('?');
    const { status, body } = await answer(path, Number(new URLSearchParams(query).get('page')));
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

const card = (title: string) => screen.getByText(title).closest('.border') as HTMLElement;
const figure = async (title: string, expected: string) => {
  await waitFor(() => expect(within(card(title)).getByText(expected)).toBeInTheDocument());
};

describe('UnionStructureDashboard counts', () => {
  it('shows the number of records in each list and asks only for those four lists', async () => {
    render(<UnionStructureDashboard organizationId="org-1" />);
    await figure('employers', '3');
    await figure('worksites', '2');
    await figure('bargainingUnits', '4');
    await figure('committees', '1');

    expect(screen.queryByRole('alert')).toBeNull();
    expect([...requested].sort()).toEqual([
      '/api/committees?limit=100&page=1',
      '/api/employers?limit=100&page=1',
      '/api/units?limit=100&page=1',
      '/api/worksites?limit=100&page=1',
    ]);
  });

  it('counts every page of a list, not the length of the first one', async () => {
    answer = (path, page) => {
      if (path !== '/api/employers') return defaultAnswer(path);
      return ok(list(page === 1 ? rows(2) : [row('on-page-two')], page, 2));
    };
    render(<UnionStructureDashboard organizationId="org-1" />);
    await figure('employers', '3');
    expect(requested).toContain('/api/employers?limit=100&page=2');
  });

  it('does not count archived records', async () => {
    answer = (path) => (path === '/api/units'
      ? ok(list([row('a'), row('b', 'archived'), row('c', 'under_certification'), row('d', 'archived')]))
      : defaultAnswer(path));
    render(<UnionStructureDashboard organizationId="org-1" />);
    await figure('bargainingUnits', '2');
  });

  it('shows a zero only when the list is really empty', async () => {
    answer = (path) => (path === '/api/committees' ? ok(list([], 1, 0)) : defaultAnswer(path));
    render(<UnionStructureDashboard organizationId="org-1" />);
    await figure('committees', '0');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a failed list as unknown with an alert, never as zero, and keeps the counts that did load', async () => {
    answer = (path) => (path === '/api/units'
      ? { status: 500, body: { code: 'INTERNAL_ERROR', message: 'boom' } }
      : defaultAnswer(path));
    render(<UnionStructureDashboard organizationId="org-1" />);
    await figure('bargainingUnits', '—');
    await figure('employers', '3');
    await figure('worksites', '2');
    await figure('committees', '1');

    expect(within(card('bargainingUnits')).queryByText('0')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('A dash means the number is unknown, not zero.');
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['rows directly under data (not the CRUD list shape)', { success: true, data: [] }],
    ['no pagination', { success: true, data: { data: [] } }],
    ['an empty object', {}],
    ['an error body with a 200 status', { code: 'INTERNAL_ERROR', message: 'nope' }],
  ])('treats %s as unknown, not as an empty list', async (_label, body) => {
    answer = (path) => (path === '/api/worksites' ? ok(body) : defaultAnswer(path));
    render(<UnionStructureDashboard organizationId="org-1" />);
    await figure('worksites', '—');
    await figure('employers', '3');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('retries from the alert and clears it once every list loads', async () => {
    const user = userEvent.setup();
    answer = (path) => (path === '/api/units' ? { status: 503, body: { message: 'down' } } : defaultAnswer(path));
    render(<UnionStructureDashboard organizationId="org-1" />);
    await figure('bargainingUnits', '—');

    answer = (path) => defaultAnswer(path);
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await figure('bargainingUnits', '4');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('counts again after a tab saves a change', async () => {
    const user = userEvent.setup();
    render(<UnionStructureDashboard organizationId="org-1" />);
    await figure('bargainingUnits', '4');

    answer = (path) => (path === '/api/units' ? ok(list(rows(5))) : defaultAnswer(path));
    await user.click(screen.getByRole('tab', { name: 'tabBargainingUnits' }));
    await user.click(screen.getByRole('button', { name: 'units-tab-saved' }));
    await figure('bargainingUnits', '5');
    await figure('employers', '3');
  });

  it('keeps the newest read when an older one finishes last', async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const slowFirstRead = new Promise<Answer>((resolve) => {
      release = () => resolve(ok(list(rows(1))));
    });
    let employerReads = 0;
    answer = (path) => {
      if (path !== '/api/employers') return defaultAnswer(path);
      employerReads += 1;
      return employerReads === 1 ? slowFirstRead : ok(list(rows(9)));
    };
    render(<UnionStructureDashboard organizationId="org-1" />);
    await user.click(screen.getByRole('tab', { name: 'tabBargainingUnits' }));
    await user.click(screen.getByRole('button', { name: 'units-tab-saved' }));
    await figure('employers', '9');

    await act(async () => {
      release();
    });
    expect(within(card('employers')).getByText('9')).toBeInTheDocument();
    expect(within(card('employers')).queryByText('1')).toBeNull();
  });

  it('does not show one organization’s counts while another organization loads', async () => {
    const { rerender } = render(<UnionStructureDashboard organizationId="org-1" />);
    await figure('employers', '3');

    let release: () => void = () => {};
    const pending = new Promise<Answer>((resolve) => {
      release = () => resolve(ok(list(rows(7))));
    });
    answer = (path) => (path === '/api/employers' ? pending : defaultAnswer(path));
    rerender(<UnionStructureDashboard organizationId="org-2" />);
    expect(within(card('employers')).getByText('...')).toBeInTheDocument();
    expect(within(card('employers')).queryByText('3')).toBeNull();

    await act(async () => {
      release();
    });
    await figure('employers', '7');
  });

  it('speaks French when the locale is French', async () => {
    locale.current = 'fr-CA';
    answer = (path) => (path === '/api/units' ? { status: 500, body: {} } : defaultAnswer(path));
    render(<UnionStructureDashboard organizationId="org-1" />);
    await figure('bargainingUnits', '—');
    expect(screen.getByRole('alert')).toHaveTextContent('inconnu');
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });
});
