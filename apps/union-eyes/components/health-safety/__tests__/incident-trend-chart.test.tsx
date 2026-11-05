// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));
// The chart library measures the page, which jsdom cannot; what is drawn is checked through the data it is given.
const chart = vi.hoisted(() => ({ data: [] as unknown[] }));
vi.mock('recharts', () => {
  const Nothing = () => null;
  const LineChart = ({ data }: { data: unknown[] }) => {
    chart.data = data;
    return <div data-testid="chart" />;
  };
  LineChart.displayName = 'LineChart';
  const ResponsiveContainer = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  ResponsiveContainer.displayName = 'ResponsiveContainer';
  return { LineChart, BarChart: LineChart, Line: Nothing, Bar: Nothing, XAxis: Nothing, YAxis: Nothing, CartesianGrid: Nothing, Tooltip: Nothing, Legend: Nothing, ResponsiveContainer };
});

import { IncidentTrendChart } from '../IncidentTrendChart';

interface Answer {
  status: number;
  body: unknown;
}

const point = (overrides: Record<string, unknown> = {}) => ({ date: '2026-02-03', minor: 1, major: 2, critical: 0, total: 3, ...overrides });
// withApi wraps the route's array as { success, data: [...] }.
const trend = (rows: unknown[]): Answer => ({ status: 200, body: { success: true, data: rows, timestamp: '2026-03-04T00:00:00.000Z' } });

const requested: string[] = [];
let answer: (url: string) => Answer | Promise<Answer>;

beforeEach(() => {
  requested.length = 0;
  chart.data = [];
  answer = () => trend([point()]);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    requested.push(url);
    const { status, body } = await answer(url);
    return new Response(JSON.stringify(body), { status });
  }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('IncidentTrendChart', () => {
  it('draws the points the trends route sends for the period, and sends no organization', async () => {
    render(<IncidentTrendChart organizationId="org-1" period="90d" />);
    expect(await screen.findByTestId('chart')).toBeInTheDocument();
    expect(chart.data).toEqual([point()]);
    expect(requested).toEqual(['/api/health-safety/incidents/trends?period=90d']);
  });

  it('says no incident was recorded in the period only when the route sends no point', async () => {
    answer = () => trend([]);
    render(<IncidentTrendChart organizationId="org-1" />);
    expect(await screen.findByText('No incidents were recorded in this period')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a failed read as an error with the route’s message and a retry, not as an empty chart', async () => {
    const user = userEvent.setup();
    answer = () => ({ status: 403, body: { code: 'INSUFFICIENT_PERMISSIONS', message: "Requires at least 'member' role" } });
    render(<IncidentTrendChart organizationId="org-1" />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The incident trends could not be loaded.');
    expect(alert).toHaveTextContent("Requires at least 'member' role");
    expect(screen.queryByText('No incidents were recorded in this period')).toBeNull();

    answer = () => trend([point()]);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('chart')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['rows that are not under data', { success: true, data: { data: [point()] } }],
    ['a point without its date', { success: true, data: [point({ date: undefined })] }],
    ['a point whose count is not a number', { success: true, data: [point({ critical: '1' })] }],
    ['no body data', {}],
  ])('treats %s as an error, never as an empty chart', async (_label, body) => {
    answer = () => ({ status: 200, body });
    render(<IncidentTrendChart organizationId="org-1" />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('No incidents were recorded in this period')).toBeNull();
  });

  it('reads again for another period and does not draw the old period meanwhile', async () => {
    const { rerender } = render(<IncidentTrendChart organizationId="org-1" period="30d" />);
    expect(await screen.findByTestId('chart')).toBeInTheDocument();

    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => { release = resolve; });
    answer = async () => {
      await pending;
      return trend([point({ date: '2025-06-01' })]);
    };
    rerender(<IncidentTrendChart organizationId="org-1" period="12m" />);
    expect(screen.queryByTestId('chart')).toBeNull();
    release();
    expect(await screen.findByTestId('chart')).toBeInTheDocument();
    expect(chart.data).toEqual([point({ date: '2025-06-01' })]);
    expect(requested).toContain('/api/health-safety/incidents/trends?period=12m');
  });
});
