// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import enCA from '../../messages/en-CA.json';
import frCA from '../../messages/fr-CA.json';
import { ComplianceAuditTrail } from './compliance-audit-trail';
import { readAuditTrail, summarizeAuditTrail } from './audit-trail-readers';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const entry = (overrides: Record<string, unknown> = {}) => ({
  auditId: '0c1b6c3e-7a5e-4d9c-9d36-0e6a6f2f8a11',
  action: 'grievance.updated',
  resourceType: 'grievances',
  resourceId: '4f0d8f43-1f6e-4a77-8b53-6c4d4f1d3a02',
  userId: 'user-admin-1',
  severity: 'info',
  outcome: 'success',
  createdAt: '2026-03-02T15:04:00.000Z',
  ...overrides,
});

const reply = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

function renderTrail(locale: 'en-CA' | 'fr-CA' = 'en-CA') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA}>
      <ComplianceAuditTrail />
    </NextIntlClientProvider>,
  );
}

describe('readAuditTrail', () => {
  it('reads the list the route returns (the handler returns the rows, so there is one data level)', () => {
    const [first] = readAuditTrail({ success: true, data: [entry()] });
    expect(first).toMatchObject({ action: 'grievance.updated', actor: 'user-admin-1', severity: 'info', outcome: 'success' });
    expect(first.recordedAt?.toISOString()).toBe('2026-03-02T15:04:00.000Z');
  });

  it('keeps an entry without a time, actor, severity or outcome as it is: nothing is made up', () => {
    const [first] = readAuditTrail({ data: [entry({ createdAt: null, userId: null, severity: null, outcome: null, resourceId: null })] });
    expect(first).toMatchObject({ recordedAt: null, actor: null, severity: null, outcome: null, resourceId: null });
  });

  it.each([
    ['a body without a list', { success: true, data: { logs: [] } }],
    ['a crud-style nested list', { success: true, data: { data: [] } }],
    ['no body', null],
    ['an entry without an action', { data: [entry({ action: '' })] }],
    ['an entry that is not a record', { data: ['nope'] }],
    ['a time that is not a date', { data: [entry({ createdAt: 'yesterday' })] }],
  ])('rejects %s instead of showing an empty trail', (_name, body) => {
    expect(() => readAuditTrail(body)).toThrow(/Unexpected API response/);
  });
});

describe('summarizeAuditTrail', () => {
  it('counts only what was read', () => {
    const entries = readAuditTrail({
      data: [entry(), entry({ auditId: 'a2', outcome: 'failure' }), entry({ auditId: 'a3', severity: 'critical', outcome: 'error' }), entry({ auditId: 'a4', severity: 'error' })],
    });
    expect(summarizeAuditTrail(entries)).toEqual({ total: 4, unsuccessful: 2, severe: 2 });
    expect(summarizeAuditTrail([])).toEqual({ total: 0, unsuccessful: 0, severe: 0 });
  });
});

describe('ComplianceAuditTrail', () => {
  it('lists the recorded entries and the counts of those entries, from the audit-log route', async () => {
    const fetchMock = vi.fn(() => reply(200, { success: true, data: [entry(), entry({ auditId: 'a2', action: 'member.exported', outcome: 'failure', severity: 'error' })] }));
    vi.stubGlobal('fetch', fetchMock);
    renderTrail();
    expect(await screen.findByText('grievance.updated')).toBeInTheDocument();
    expect(screen.getByText('member.exported')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe('/api/compliance/audit-logs');
    const counts = screen.getAllByRole('definition').map((node) => node.textContent);
    expect(counts).toEqual(['2', '1', '1']);
  });

  it('says plainly that no entries exist, and shows no table', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply(200, { success: true, data: [] })));
    renderTrail();
    expect(await screen.findByText('No audit entries have been recorded for your organization.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it("shows the server's refusal and no figures when the trail cannot be read", async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply(403, { code: 'FORBIDDEN', message: 'Organization audit context required' })));
    renderTrail();
    expect(await screen.findByRole('alert')).toHaveTextContent('Organization audit context required');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('definition')).toHaveLength(0);
  });

  it('says so when the request never reaches the server, and again when the answer is not the expected shape', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    const { unmount } = renderTrail();
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
    unmount();

    vi.stubGlobal('fetch', vi.fn(() => reply(200, { success: true, data: { logs: [] } })));
    renderTrail();
    expect(await screen.findByRole('alert')).toHaveTextContent('does not understand');
  });

  it('reads again on refresh', async () => {
    const fetchMock = vi.fn(() => reply(200, { success: true, data: [entry()] }));
    vi.stubGlobal('fetch', fetchMock);
    renderTrail();
    await screen.findByText('grievance.updated');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('is localized in French', async () => {
    vi.stubGlobal('fetch', vi.fn(() => reply(200, { success: true, data: [] })));
    renderTrail('fr-CA');
    expect(await screen.findByText(/Aucune entrée de vérification/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actualiser' })).toBeInTheDocument();
  });
});
