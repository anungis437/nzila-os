// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const toast = vi.hoisted(() => vi.fn());
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }));

import { InspectionReportViewer, toInspectionReport } from '../InspectionReportViewer';

// What GET /api/health-safety/inspections/{id} sends: the CRUD factory's { data: row } inside withApi's { success, data, timestamp } envelope.
const envelope = (row: unknown) => ({ success: true, data: { data: row }, timestamp: '2026-03-04T00:00:00.000Z' });

const completedRow = {
  id: 'insp-1',
  organizationId: 'org-1',
  inspectionNumber: 'INS-2026-00007',
  inspectionType: 'routine',
  status: 'requires_followup',
  scheduledDate: '2026-03-02T14:00:00.000Z',
  completedDate: '2026-03-03T16:30:00.000Z',
  workplaceName: 'Main Plant',
  specificLocation: 'Dock 4',
  leadInspectorName: 'R. Okafor',
  inspectionScope: 'Quarterly plant inspection',
  checklistUsed: 'Facility Checklist v2.1',
  checklistItems: [
    { item: 'Exits clear', status: 'pass' },
    { item: 'Guarding in place', status: 'fail', notes: 'Guard missing on press 3' },
    { item: 'Eyewash station', status: 'requires_attention', notes: 'Flush is overdue' },
    { item: 'Confined space entry', status: 'na' },
  ],
  scorePercentage: '66.67',
  findings: 'One machine guard is missing.',
  observations: null,
  notes: 'Re-inspect in 30 days.',
};

const scheduledRow = {
  id: 'insp-2',
  inspectionNumber: 'INS-2026-00008',
  status: 'scheduled',
  scheduledDate: '2026-06-01T14:00:00.000Z',
  completedDate: null,
  workplaceName: null,
  specificLocation: null,
  leadInspectorName: null,
  inspectionScope: null,
  checklistUsed: null,
  checklistItems: null,
  scorePercentage: null,
};

type Answer = { ok: boolean; status: number; json: () => Promise<unknown> };

function answer(status: number, body: unknown) {
  const fetchMock = vi.fn(async (_url: string): Promise<Answer> => ({ ok: status >= 200 && status < 300, status, json: async () => body }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => toast.mockClear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('InspectionReportViewer', () => {
  it('reads the inspection from its own route and never asks for a report or an export', async () => {
    const fetchMock = answer(200, envelope(completedRow));
    render(<InspectionReportViewer inspectionId="insp-1" />);
    expect(await screen.findByText('Quarterly plant inspection')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/health-safety/inspections/insp-1');
    expect(fetchMock.mock.calls.map(([url]) => url).join(' ')).not.toMatch(/\/report|\/export/);
  });

  it('shows the checklist, the counts and the findings exactly as recorded', async () => {
    answer(200, envelope(completedRow));
    render(<InspectionReportViewer inspectionId="insp-1" />);
    expect(await screen.findByText('Inspection INS-2026-00007')).toBeInTheDocument();
    expect(screen.getByText('R. Okafor')).toBeInTheDocument();
    expect(screen.getByText('Main Plant')).toBeInTheDocument();
    expect(screen.getByText('requires followup')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('66.67%')).toBeInTheDocument();
    expect(screen.getByText('Facility Checklist v2.1')).toBeInTheDocument();
    expect(screen.getByText('1 of 3 passed')).toBeInTheDocument();
    expect(screen.getByText('Items Requiring Attention (2)')).toBeInTheDocument();
    expect(screen.getAllByText('Guard missing on press 3')).toHaveLength(2);
    expect(screen.getAllByText('Flush is overdue')).toHaveLength(2);
    expect(screen.getByText('REQUIRES ATTENTION')).toBeInTheDocument();
    expect(screen.getByText('Findings')).toBeInTheDocument();
    expect(screen.getByText('One machine guard is missing.')).toBeInTheDocument();
    expect(screen.getByText('Re-inspect in 30 days.')).toBeInTheDocument();
    // A section nobody wrote is not shown.
    expect(screen.queryByText('Observations')).toBeNull();
  });

  it('offers no export or download', async () => {
    answer(200, envelope(completedRow));
    render(<InspectionReportViewer inspectionId="insp-1" />);
    await screen.findByText('Quarterly plant inspection');
    expect(screen.queryByRole('button', { name: /export|pdf|download/i })).toBeNull();
  });

  it('shows a scheduled inspection as unscored and unchecked, never as 0%', async () => {
    answer(200, envelope(scheduledRow));
    render(<InspectionReportViewer inspectionId="insp-2" />);
    expect(await screen.findByText('Inspection INS-2026-00008')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    expect(screen.getByText('No checklist results have been recorded for this inspection.')).toBeInTheDocument();
    expect(screen.getByText('Recorded Score').previousElementSibling).toHaveTextContent('—');
    expect(screen.getByText('Passed').previousElementSibling).toHaveTextContent('—');
    expect(screen.queryByText(/0%/)).toBeNull();
  });

  it('says so when the inspection does not exist', async () => {
    answer(404, { code: 'NOT_FOUND', message: 'safety_inspections not found' });
    render(<InspectionReportViewer inspectionId="missing" />);
    expect(await screen.findByText('Inspection not found')).toBeInTheDocument();
    expect(toast).not.toHaveBeenCalled();
  });

  it('reports a failed request as a failure, not as a missing or empty report', async () => {
    answer(500, { code: 'INTERNAL_ERROR', message: 'boom' });
    render(<InspectionReportViewer inspectionId="insp-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The inspection could not be loaded');
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    expect(screen.queryByText('Inspection not found')).toBeNull();
  });

  it('treats a body it does not recognise as a failure', async () => {
    answer(200, { success: true, data: { rows: [] } });
    render(<InspectionReportViewer inspectionId="insp-1" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The inspection could not be loaded');
  });

  it('does not show the previous inspection while the next one is loading', async () => {
    let release: (value: Answer) => void = () => {};
    const fetchMock = vi.fn((url: string): Promise<Answer> =>
      url.endsWith('/insp-1')
        ? Promise.resolve({ ok: true, status: 200, json: async () => envelope(completedRow) })
        : new Promise<Answer>((resolve) => { release = resolve; }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { rerender, container } = render(<InspectionReportViewer inspectionId="insp-1" />);
    await screen.findByText('Quarterly plant inspection');
    rerender(<InspectionReportViewer inspectionId="insp-2" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/health-safety/inspections/insp-2'));
    expect(screen.queryByText('Quarterly plant inspection')).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    release({ ok: true, status: 200, json: async () => envelope(scheduledRow) });
    expect(await screen.findByText('Inspection INS-2026-00008')).toBeInTheDocument();
  });
});

describe('toInspectionReport', () => {
  it('refuses anything that is not an inspection inside the envelope', () => {
    expect(() => toInspectionReport(null)).toThrow();
    expect(() => toInspectionReport({ data: { data: [] } })).toThrow();
    expect(() => toInspectionReport({ data: { data: { inspectionNumber: 'x' } } })).toThrow();
  });

  it('refuses a row without the number or the status the database never leaves empty, instead of making them up', () => {
    const base = { id: 'i', inspectionNumber: 'N', status: 'completed', scheduledDate: '2026-01-01T00:00:00.000Z' };
    expect(toInspectionReport(envelope(base)).inspectionNumber).toBe('N');
    expect(() => toInspectionReport(envelope({ ...base, inspectionNumber: undefined }))).toThrow();
    expect(() => toInspectionReport(envelope({ ...base, inspectionNumber: '' }))).toThrow();
    expect(() => toInspectionReport(envelope({ ...base, status: undefined }))).toThrow();
    expect(() => toInspectionReport(envelope({ ...base, status: null }))).toThrow();
  });

  it('has no results for a checklist that was never filled in, and refuses one that is not a list', () => {
    const base = { id: 'i', inspectionNumber: 'N', status: 'scheduled', scheduledDate: '2026-01-01T00:00:00.000Z' };
    expect(toInspectionReport(envelope({ ...base, checklistItems: null })).results).toEqual([]);
    expect(toInspectionReport(envelope(base)).results).toEqual([]);
    expect(() => toInspectionReport(envelope({ ...base, checklistItems: { item: 'A', status: 'pass' } }))).toThrow();
    expect(() => toInspectionReport(envelope({ ...base, checklistItems: 'pass' }))).toThrow();
  });

  it('keeps an unrecognised checklist status as recorded instead of counting it as a pass, and gives an entry that lacks its text or status a dash, not a made-up name', () => {
    const report = toInspectionReport(envelope({
      id: 'i',
      inspectionNumber: 'N',
      status: 'completed',
      scheduledDate: '2026-01-01T00:00:00.000Z',
      checklistItems: [{ item: 'A', status: 'deferred' }, { item: 'B', status: 'pass' }, 'not an object'],
    }));
    expect(report.results.map((result) => result.status)).toEqual(['deferred', 'pass', '—']);
    expect(report.passCount).toBe(1);
    expect(report.failCount + report.attentionCount + report.naCount).toBe(0);
    expect(report.results[2].item).toBe('—');
    expect(JSON.stringify(report)).not.toMatch(/unnamed|unknown/);
  });

  it('treats a missing or unreadable score as no score', () => {
    const base = { id: 'i', inspectionNumber: 'N', status: 'completed', scheduledDate: '2026-01-01T00:00:00.000Z' };
    expect(toInspectionReport(envelope({ ...base, scorePercentage: null })).scorePercentage).toBeNull();
    expect(toInspectionReport(envelope({ ...base, scorePercentage: 'n/a' })).scorePercentage).toBeNull();
    expect(toInspectionReport(envelope({ ...base, scorePercentage: '0.00' })).scorePercentage).toBe(0);
  });
});
