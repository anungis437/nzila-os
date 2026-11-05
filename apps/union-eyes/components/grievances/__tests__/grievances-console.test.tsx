// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import enCA from '@/messages/en-CA.json';
import frCA from '@/messages/fr-CA.json';
import { grievanceTypeEnum, type grievances } from '@/db/schema/domains/claims/grievances';
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';
import { GRIEVANCE_TYPE_ORDER, GrievancesConsole } from '../grievances-console';

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// The list is answered with the framework's own response builders, as the route does (standardSuccessResponse(rows)), and every row is
// typed as the database row the route selects, so a column the console reads that the table does not have fails to compile here.
type GrievanceRow = typeof grievances.$inferSelect;
const DAY = 86_400_000;
const CASE_ID = '11111111-1111-4111-8111-111111111111';

const row = (overrides: Partial<GrievanceRow> = {}): GrievanceRow => ({
  id: CASE_ID,
  grievanceNumber: 'GR-2026-001',
  type: 'discipline',
  status: 'filed',
  priority: 'high',
  step: 'step_1',
  grievantId: null,
  grievantName: 'A. Worker',
  grievantEmail: null,
  unionRepId: null,
  employerRepId: null,
  employerId: null,
  employerName: 'Acme Ltd.',
  workplaceId: null,
  workplaceName: null,
  cbaId: null,
  cbaArticle: 'Article 12',
  cbaSection: null,
  title: 'Unpaid overtime',
  description: 'Overtime was not paid.',
  background: null,
  desiredOutcome: 'Pay the overtime owed',
  incidentDate: null,
  filedDate: new Date('2026-03-01T12:00:00Z'),
  responseDeadline: null,
  meetingDate: null,
  escalatedAt: null,
  resolvedAt: null,
  closedAt: null,
  timeline: null,
  groupGrievanceId: null,
  relatedGrievanceIds: null,
  attachments: null,
  isGroupGrievance: false,
  isArbitrationEligible: false,
  hasLegalImplications: false,
  isConfidential: false,
  organizationId: '22222222-2222-4222-8222-222222222222',
  createdAt: new Date('2026-02-28T12:00:00Z'),
  updatedAt: new Date('2026-02-28T12:00:00Z'),
  createdBy: null,
  lastUpdatedBy: null,
  externalCaseId: null,
  importFingerprint: null,
  sourceSystem: null,
  importedAt: null,
  importBatchId: null,
  ...overrides,
});

// What the route returns for an unassigned intake the caller may only triage: a few columns, no narrative.
const triageRow = () => ({
  id: '33333333-3333-4333-8333-333333333333',
  grievanceNumber: 'GR-2026-INTAKE',
  type: 'harassment',
  status: 'draft',
  priority: 'low',
  createdAt: new Date('2026-03-02T12:00:00Z'),
  accessScope: 'intake_triage',
});

const candidate = { stewardId: 'steward-1', userId: 'user-12345678-abcd', region: null, specialization: null, currentCaseload: 1, maxCaseload: 8, score: 91 };

interface Server {
  rows: unknown[];
  list: 'ok' | 'forbidden' | 'wrong-shape';
  patch: () => Response;
  post: () => Response;
}
let server: Server;
const fetchMock = vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
  const method = init?.method ?? 'GET';
  if (url === '/api/grievances' && method === 'GET') {
    if (server.list === 'forbidden') return standardErrorResponse(ErrorCode.FORBIDDEN, 'Requires steward role or above');
    if (server.list === 'wrong-shape') return standardSuccessResponse({ grievances: [] });
    return standardSuccessResponse(server.rows);
  }
  if (url === '/api/grievances' && method === 'POST') return server.post();
  if (url.endsWith('/status') && method === 'PATCH') return server.patch();
  if (url.endsWith('/recommend-steward')) return standardSuccessResponse([candidate]);
  if (url.endsWith('/assign') && method === 'PATCH') return standardSuccessResponse({});
  return Response.json({ message: `unexpected ${method} ${url}` }, { status: 404 });
});

beforeEach(() => {
  server = {
    rows: [row()],
    list: 'ok',
    patch: () => standardSuccessResponse({}),
    post: () => standardSuccessResponse({}),
  };
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderConsole(locale: 'en-CA' | 'fr-CA' = 'en-CA') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA}>
      <GrievancesConsole />
    </NextIntlClientProvider>,
  );
}

const expand = () => fireEvent.click(screen.getAllByRole('button').find((button) => button.querySelector('.lucide-chevron-down'))!);
const callsTo = (suffix: string, method?: string) =>
  fetchMock.mock.calls.filter(([url, init]) => url.endsWith(suffix) && (method === undefined || (init?.method ?? 'GET') === method));

describe('GrievancesConsole: what the list shows', () => {
  it('shows the stored columns of each row the route answers with, and asks for the list without naming an organization', async () => {
    renderConsole();

    expect(await screen.findByText('GR-2026-001')).toBeInTheDocument();
    expect(screen.getByText('Unpaid overtime')).toBeInTheDocument();
    expect(screen.getByText('Overtime was not paid.')).toBeInTheDocument();
    expect(screen.getByText(enCA.grievances.statusFiled, { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText(enCA.grievances.priorityHigh, { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Discipline', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText('step 1')).toBeInTheDocument();
    expect(screen.getByText(new Date('2026-03-01T12:00:00Z').toLocaleDateString('en-CA'))).toBeInTheDocument();
    expect(callsTo('/api/grievances', 'GET').map(([url]) => url)).toEqual(['/api/grievances']);
  });

  it('shows the details of an expanded row, and a dash for each one the row does not carry', async () => {
    // The row carries the identifier of a steward; the console shows none of it (an identifier is not a name, and it is not an authority).
    server.rows = [row({ grievantName: null, employerName: null, cbaArticle: null, desiredOutcome: null, unionRepId: '9f8e7d6c-aaaa-4bbb-8ccc-000000000000' })];
    renderConsole();
    await screen.findByText('GR-2026-001');

    expand();

    expect(await screen.findByText('No timeline entries are recorded for this grievance.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/9f8e7d6c|Assigned/);
    expect(screen.queryByText('Union Representative')).toBeNull();
    // grievant, management, article and remedy are all missing: four dashes in the expanded panel, none of them a made-up value.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });

  it('shows the timeline entries the row stores, as they are', async () => {
    server.rows = [
      row({
        timeline: [
          { date: '2026-03-02T12:00:00.000Z', action: 'Grievance acknowledged', actor: 'steward-1', notes: 'Employer notified' },
          { date: '2026-03-05T12:00:00.000Z', action: 'Meeting held', actor: 'steward-1' },
        ],
      }),
    ];
    renderConsole();
    await screen.findByText('GR-2026-001');

    expand();

    expect(await screen.findByText('Grievance acknowledged')).toBeInTheDocument();
    expect(screen.getByText('Employer notified')).toBeInTheDocument();
    expect(screen.getByText('Meeting held')).toBeInTheDocument();
    expect(screen.queryByText('No timeline entries are recorded for this grievance.')).toBeNull();
  });

  it('shows an unassigned intake as an intake that is not filed, with no narrative, and invents no title or grievant', async () => {
    server.rows = [triageRow()];
    renderConsole();

    expect(await screen.findByText('GR-2026-INTAKE')).toBeInTheDocument();
    expect(screen.getByText('Intake awaiting triage (details are not shown to you)')).toBeInTheDocument();
    expect(screen.getByText('Intake (not filed)', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Harassment', { selector: 'p' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Untitled|Unknown|General|Invalid Date|NaN|undefined/);
  });

  it('puts a status it has no group for on screen as stored, rather than calling it filed', async () => {
    server.rows = [row({ status: 'quarantined' as unknown as GrievanceRow['status'] })];
    renderConsole();

    expect(await screen.findByText('quarantined', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText(enCA.grievances.statusFiled, { selector: 'span' })).toBeNull();
  });

  it('shows no priority for a row that has none, instead of calling it medium', async () => {
    server.rows = [row({ priority: null })];
    renderConsole();
    await screen.findByText('GR-2026-001');

    for (const label of [enCA.grievances.priorityHigh, enCA.grievances.priorityMedium, enCA.grievances.priorityLow, enCA.grievances.priorityUrgent]) {
      expect(screen.queryByText(label, { selector: 'span' })).toBeNull();
    }
  });
});

describe('GrievancesConsole: the figures', () => {
  it('averages resolution from the day filed to the day resolved, over the resolved grievances that record both', async () => {
    server.rows = [
      row({ id: 'a-1', grievanceNumber: 'GR-A', status: 'settled', filedDate: new Date('2026-01-01T00:00:00Z'), resolvedAt: new Date('2026-01-11T00:00:00Z') }),
      row({ id: 'a-2', grievanceNumber: 'GR-B', status: 'closed', filedDate: new Date('2026-01-01T00:00:00Z'), resolvedAt: new Date('2026-01-21T00:00:00Z') }),
      row({ id: 'a-3', grievanceNumber: 'GR-C', status: 'closed', filedDate: new Date('2026-01-01T00:00:00Z'), resolvedAt: null }),
      row({ id: 'a-4', grievanceNumber: 'GR-D', status: 'filed', resolvedAt: null }),
    ];
    renderConsole();
    await screen.findByText('GR-A');

    // 10 days and 20 days: 15. The resolved grievance with no resolution date and the open one do not count.
    expect(screen.getByText('15d')).toBeInTheDocument();
    expect(screen.getByText(enCA.grievances.totalGrievances).nextElementSibling).toHaveTextContent('4');
    expect(screen.getByText(enCA.grievances.activeCases).nextElementSibling).toHaveTextContent('1');
  });

  it('shows no average when no resolved grievance records both dates, instead of 0d', async () => {
    server.rows = [row({ status: 'settled', resolvedAt: null }), row({ id: 'a-2', grievanceNumber: 'GR-B', status: 'filed' })];
    renderConsole();
    await screen.findByText('GR-2026-001');

    expect(screen.getByText(enCA.grievances.avgResolution).nextElementSibling).toHaveTextContent('—');
    expect(screen.queryByText('0d')).toBeNull();
  });

  it('counts down to a deadline within a week, and says overdue after one, for an open grievance only', async () => {
    server.rows = [
      row({ id: 'b-1', grievanceNumber: 'GR-SOON', responseDeadline: new Date(Date.now() + 3 * DAY) }),
      row({ id: 'b-2', grievanceNumber: 'GR-LATE', responseDeadline: new Date(Date.now() - 2 * DAY) }),
      row({ id: 'b-3', grievanceNumber: 'GR-DONE', status: 'settled', responseDeadline: new Date(Date.now() - 2 * DAY) }),
      row({ id: 'b-4', grievanceNumber: 'GR-NONE', responseDeadline: null }),
    ];
    renderConsole();
    await screen.findByText('GR-SOON');

    const card = (number: string) => screen.getByText(number).closest('h3')!.parentElement!;
    expect(within(card('GR-SOON')).getByText('3 days until deadline')).toBeInTheDocument();
    expect(within(card('GR-LATE')).getByText(enCA.grievances.overdue)).toBeInTheDocument();
    expect(within(card('GR-DONE')).queryByText(enCA.grievances.overdue)).toBeNull();
    expect(within(card('GR-NONE')).queryByText(enCA.grievances.overdue)).toBeNull();
    expect(within(card('GR-NONE')).queryByText(/days until deadline/)).toBeNull();
  });
});

describe('GrievancesConsole: a list that could not be read', () => {
  it('says so with the route’s reason and a retry, never “no grievances”', async () => {
    server.list = 'forbidden';
    renderConsole();

    const failure = await screen.findByRole('alert');
    expect(failure).toHaveTextContent(enCA.grievances.errorLoadingGrievances);
    expect(failure).toHaveTextContent('Requires steward role or above');
    expect(screen.queryByText(enCA.grievances.noGrievancesFound)).toBeNull();

    server.list = 'ok';
    fireEvent.click(within(failure).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('GR-2026-001')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('treats an answer without a list as a failure, not as an empty one', async () => {
    server.list = 'wrong-shape';
    renderConsole();

    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected API response: no grievances');
    expect(screen.queryByText(enCA.grievances.noGrievancesFound)).toBeNull();
  });

  it('says so in French, with a French retry', async () => {
    server.list = 'forbidden';
    renderConsole('fr-CA');

    const failure = await screen.findByRole('alert');
    expect(failure).toHaveTextContent(frCA.grievances.errorLoadingGrievances);
    expect(within(failure).getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });
});

describe('GrievancesConsole: filing a grievance', () => {
  const openForm = async () => {
    renderConsole();
    await screen.findByText('GR-2026-001');
    fireEvent.click(screen.getByRole('button', { name: enCA.grievances.fileNew }));
    return screen.findByRole('button', { name: enCA.grievances.form.submit });
  };
  const fill = () => {
    fireEvent.change(document.querySelector('input[name="title"]')!, { target: { value: 'Missed breaks' } });
    fireEvent.change(document.querySelector('textarea[name="description"]')!, { target: { value: 'Breaks were not given on three shifts.' } });
  };

  it('offers exactly the types the route accepts, which are the database’s', async () => {
    await openForm();

    const select = document.querySelector('select[name="type"]')!;
    const offered = within(select as HTMLElement).getAllByRole('option').map((option) => (option as HTMLOptionElement).value);
    expect(offered).toEqual([...grievanceTypeEnum.enumValues]);
    expect([...GRIEVANCE_TYPE_ORDER]).toEqual([...grievanceTypeEnum.enumValues]);
  });

  it('opens an official case with the chosen fields, and never sends an organization', async () => {
    const submit = await openForm();
    fill();
    fireEvent.change(document.querySelector('select[name="type"]')!, { target: { value: 'safety' } });
    fireEvent.change(document.querySelector('select[name="priority"]')!, { target: { value: 'urgent' } });
    fireEvent.change(document.querySelector('input[name="cbaArticle"]')!, { target: { value: ' Article 9 ' } });

    fireEvent.click(submit);

    await waitFor(() => expect(callsTo('/api/grievances', 'POST')).toHaveLength(1));
    const sent = JSON.parse(String(callsTo('/api/grievances', 'POST')[0][1]?.body));
    expect(sent).toEqual({
      type: 'safety',
      title: 'Missed breaks',
      description: 'Breaks were not given on three shifts.',
      priority: 'urgent',
      cbaArticle: 'Article 9',
      createOfficialCase: true,
    });
    // The form closes and the list is read again.
    await waitFor(() => expect(screen.queryByRole('button', { name: enCA.grievances.form.submit })).toBeNull());
    expect(callsTo('/api/grievances', 'GET').length).toBeGreaterThanOrEqual(2);
  });

  it('leaves the article out when none is given', async () => {
    const submit = await openForm();
    fill();

    fireEvent.click(submit);

    await waitFor(() => expect(callsTo('/api/grievances', 'POST')).toHaveLength(1));
    expect(JSON.parse(String(callsTo('/api/grievances', 'POST')[0][1]?.body))).not.toHaveProperty('cbaArticle');
  });

  it('shows the route’s refusal inside the form and keeps the form open', async () => {
    server.post = () => standardErrorResponse(ErrorCode.FORBIDDEN, 'Only a steward or LRO can create an official case. Submit an intake instead.');
    const submit = await openForm();
    fill();

    fireEvent.click(submit);

    expect(await screen.findByText('Only a steward or LRO can create an official case. Submit an intake instead.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: enCA.grievances.form.submit })).toBeInTheDocument();
  });

  it('asks for the lengths the route requires before sending anything', async () => {
    await openForm();

    expect(document.querySelector('input[name="title"]')).toHaveAttribute('minlength', '5');
    expect(document.querySelector('textarea[name="description"]')).toHaveAttribute('minlength', '10');
  });
});

describe('GrievancesConsole: advancing a status', () => {
  const advance = async (value: string) => {
    renderConsole();
    await screen.findByText('GR-2026-001');
    expand();
    const select = (await screen.findByRole('option', { name: enCA.grievances.advanceStatus })).closest('select')!;
    fireEvent.change(select, { target: { value } });
  };

  it('sends the chosen status with PATCH, then reads the list again', async () => {
    await advance('escalated');

    await waitFor(() => expect(callsTo('/status', 'PATCH')).toHaveLength(1));
    expect(callsTo('/status', 'PATCH')[0][0]).toBe(`/api/grievances/${CASE_ID}/status`);
    expect(JSON.parse(String(callsTo('/status', 'PATCH')[0][1]?.body))).toEqual({ status: 'escalated' });
    await waitFor(() => expect(callsTo('/api/grievances', 'GET').length).toBeGreaterThanOrEqual(2));
  });

  it('shows the route’s refusal in the page, not in a browser dialog, and does not reload as if it had worked', async () => {
    const dialog = vi.fn();
    vi.stubGlobal('alert', dialog);
    server.patch = () => standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Cannot move from filed to closed');

    await advance('closed');

    expect(await screen.findByText('Cannot move from filed to closed')).toBeInTheDocument();
    expect(dialog).not.toHaveBeenCalled();
    expect(callsTo('/api/grievances', 'GET')).toHaveLength(1);
  });

  it('says what failed, with the HTTP status, when the refusal gives no reason', async () => {
    server.patch = () => new Response('nope', { status: 500 });

    await advance('closed');

    expect(await screen.findByText('The status could not be changed (HTTP 500)')).toBeInTheDocument();
  });
});

describe('GrievancesConsole: documents, procedure and assignment', () => {
  it('opens the case page to add documentation instead of posting a note the route would refuse', async () => {
    renderConsole();
    await screen.findByText('GR-2026-001');
    expand();

    const link = await screen.findByRole('link', { name: enCA.grievances.addDocumentation });
    expect(link).toHaveAttribute('href', `/en-CA/dashboard/grievances/${CASE_ID}`);
    expect(callsTo('/documents')).toHaveLength(0);
  });

  it('offers no button that does nothing', async () => {
    renderConsole();
    await screen.findByText('GR-2026-001');

    expect(screen.queryByRole('button', { name: /full grievance procedure/i })).toBeNull();
  });

  it('opens the steward recommendations instead of posting an empty assignment', async () => {
    renderConsole();
    await screen.findByText('GR-2026-001');
    expand();

    fireEvent.click(await screen.findByRole('button', { name: enCA.grievances.assignSteward }));

    expect(await screen.findByRole('button', { name: enCA.steward.recommendations.findBestMatch })).toBeInTheDocument();
    expect(callsTo('/assign')).toHaveLength(0);
  });

  it('assigns the chosen steward with PATCH /api/grievances/:id/assign, then reloads the list and closes the panel', async () => {
    renderConsole();
    await screen.findByText('GR-2026-001');
    expand();
    fireEvent.click(await screen.findByRole('button', { name: enCA.grievances.assignSteward }));
    fireEvent.click(await screen.findByRole('button', { name: enCA.steward.recommendations.findBestMatch }));
    const loadsBefore = callsTo('/api/grievances', 'GET').length;

    fireEvent.click(await screen.findByRole('button', { name: enCA.steward.recommendations.assignButton }));

    await waitFor(() => expect(callsTo('/assign', 'PATCH')).toHaveLength(1));
    expect(callsTo('/assign', 'PATCH')[0][1]).toMatchObject({ body: JSON.stringify({ stewardId: 'steward-1' }) });
    await waitFor(() => expect(callsTo('/api/grievances', 'GET').length).toBeGreaterThan(loadsBefore));
    await waitFor(() => expect(screen.queryByRole('button', { name: enCA.steward.recommendations.findBestMatch })).not.toBeInTheDocument());
  });
});

describe('GrievancesConsole: French', () => {
  it('labels the type, the dates and the missing values in French', async () => {
    server.rows = [row({ grievantName: null })];
    renderConsole('fr-CA');

    expect(await screen.findByText('Mesure disciplinaire', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText(new Date('2026-03-01T12:00:00Z').toLocaleDateString('fr-CA'))).toBeInTheDocument();

    expand();
    expect(await screen.findByText('Aucune entrée de chronologie n’est enregistrée pour ce grief.')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('labels an intake in French', async () => {
    server.rows = [triageRow()];
    renderConsole('fr-CA');

    expect(await screen.findByText('Demande (non déposée)', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Demande en attente de triage (les détails ne vous sont pas affichés)')).toBeInTheDocument();
  });
});
