// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const intl = vi.hoisted(() => ({ locale: 'en-CA' }));
vi.mock('next-intl', () => ({ useLocale: () => intl.locale }));

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push, back: vi.fn() }) }));

vi.mock('@/lib/client-logger', () => ({
  createClientLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));

import { ElectionRecordsList } from '../election-records-list';
import { ElectionRecordDetail } from '../election-record-detail';
import { ElectionRecordForm } from '../election-record-form';

const NEW_RECORD = {
  id: 'a1111111-1111-4111-8111-111111111111',
  electionYear: 2027,
  electionDate: '2027-03-15',
  positionsAvailable: 3,
  candidates: [{ name: 'Rowan Candidate', union: 'Local 9', platform: 'Safer worksites' }],
  winners: [],
  totalVotes: 0,
  participationRate: null,
  verifiedBy: null,
  verificationDate: null,
  contestedResults: false,
};

const CERTIFIED_RECORD = {
  id: 'b2222222-2222-4222-8222-222222222222',
  electionYear: 2025,
  electionDate: '2025-10-01',
  positionsAvailable: 2,
  candidates: [
    { name: 'Ada Winner', union: 'Local 1', platform: 'Fair pay', votes: 120 },
    { name: 'Bo Runner', union: 'Local 2', platform: 'More stewards', votes: 80 },
  ],
  winners: [{ name: 'Ada Winner', union: 'Local 1', votes: 120, term_start: '2026-01-01', term_end: '2027-12-31' }],
  totalVotes: 200,
  participationRate: 41,
  verifiedBy: 'Independent Auditor',
  verificationDate: '2025-10-05',
  contestedResults: true,
};

/** The shape withApi really sends: the framework envelope around the handler's own { data }. */
const envelope = (data: unknown) => ({ success: true, data: { data }, timestamp: '2026-01-01T00:00:00.000Z' });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const failure = (status: number, message: string) => json({ code: 'ERROR', message, timestamp: '2026-01-01T00:00:00.000Z' }, status);

let fetchMock: ReturnType<typeof vi.fn>;
const calledUrls = () => fetchMock.mock.calls.map(([url]) => String(url));

beforeEach(() => {
  intl.locale = 'en-CA';
  nav.push.mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Nothing on an elections screen may let a person cast, count or export a vote. */
function expectNoVotingAffordance() {
  for (const name of [/ballot/i, /^vote/i, /cast/i, /export/i, /submit/i, /bulletin/i, /voter/i]) {
    expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.queryByRole('tab', { name })).toBeNull();
  }
  expect(screen.queryByRole('tablist')).toBeNull();
}

describe('ElectionRecordsList', () => {
  it('lists the stored records with only what the table holds, and reads the real response envelope', async () => {
    fetchMock.mockResolvedValue(json(envelope([CERTIFIED_RECORD, NEW_RECORD])));
    render(<ElectionRecordsList />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading council election records');
    const rows = await screen.findAllByRole('row');
    expect(rows).toHaveLength(3);

    const certified = within(rows[1]);
    expect(certified.getByText('2025')).toBeInTheDocument();
    expect(certified.getByText('Certified')).toBeInTheDocument();
    expect(certified.getByText('Contested')).toBeInTheDocument();
    expect(certified.getByText('200')).toBeInTheDocument();

    const fresh = within(rows[2]);
    expect(fresh.getByText('Not certified')).toBeInTheDocument();
    expect(fresh.getByText('Not recorded')).toBeInTheDocument();
    expect(fresh.queryByText('0')).toBeNull();

    expect(calledUrls()).toEqual(['/api/elections']);
    expect(screen.getByRole('note')).toHaveTextContent('no ballot can be cast here');
  });

  it('shows no turnout, eligible-voter or active-election figure, and offers no vote, ballot or export', async () => {
    fetchMock.mockResolvedValue(json(envelope([CERTIFIED_RECORD])));
    render(<ElectionRecordsList />);
    await screen.findAllByRole('row');

    for (const invented of [/turnout/i, /eligible/i, /active elections/i, /upcoming/i]) {
      expect(screen.queryByText(invented)).toBeNull();
    }
    expectNoVotingAffordance();
  });

  it('links to the create form and to each record under the locale and dashboard path', async () => {
    fetchMock.mockResolvedValue(json(envelope([NEW_RECORD])));
    render(<ElectionRecordsList />);
    await screen.findAllByRole('row');

    expect(screen.getByRole('link', { name: 'Create election record' })).toHaveAttribute('href', '/en-CA/dashboard/elections/new');
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute('href', `/en-CA/dashboard/elections/${NEW_RECORD.id}`);
  });

  it('offers the create action only once the records have loaded', async () => {
    fetchMock.mockResolvedValue(json(envelope([NEW_RECORD])));
    render(<ElectionRecordsList />);
    expect(screen.queryByRole('link', { name: 'Create election record' })).toBeNull();
    await screen.findAllByRole('row');
    expect(screen.getByRole('link', { name: 'Create election record' })).toBeInTheDocument();
  });

  it('says so when there are no records, which is not an error', async () => {
    fetchMock.mockResolvedValue(json(envelope([])));
    render(<ElectionRecordsList />);
    expect(await screen.findByText('No council election records have been entered.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('tells a person who is not platform staff that access is refused, rather than showing an empty list', async () => {
    fetchMock.mockResolvedValue(failure(403, 'Forbidden: Requires clc_staff'));
    render(<ElectionRecordsList />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('limited to platform staff');
    expect(alert).toHaveTextContent('HTTP 403');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('No council election records have been entered.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Create election record' })).toBeNull();
  });

  it('shows a server failure as a failure, and loads again when asked', async () => {
    fetchMock.mockResolvedValueOnce(failure(500, 'Internal server error')).mockResolvedValue(json(envelope([NEW_RECORD])));
    render(<ElectionRecordsList />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('could not be loaded');
    expect(alert).toHaveTextContent('HTTP 500');
    expect(screen.queryByText('No council election records have been entered.')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Create election record' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('2027')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create election record' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows a network failure and a response of the wrong shape as failures, never as an empty list', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const first = render(<ElectionRecordsList />);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
    first.unmount();

    fetchMock.mockResolvedValueOnce(json(envelope({ not: 'a list' })));
    render(<ElectionRecordsList />);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
    expect(screen.queryByText('No council election records have been entered.')).toBeNull();
  });

  it('speaks French and keeps the French locale in every link', async () => {
    intl.locale = 'fr-CA';
    fetchMock.mockResolvedValue(json(envelope([CERTIFIED_RECORD])));
    render(<ElectionRecordsList />);

    expect(await screen.findByRole('heading', { name: 'Élections du conseil' })).toBeInTheDocument();
    expect(screen.getByText('Certifiée')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Créer un registre d’élection' })).toHaveAttribute('href', '/fr-CA/dashboard/elections/new');
    expect(screen.getByRole('link', { name: 'Voir' })).toHaveAttribute('href', `/fr-CA/dashboard/elections/${CERTIFIED_RECORD.id}`);
    expect(screen.getByRole('note')).toHaveTextContent('aucun bulletin ne peut être déposé');
  });
});

describe('ElectionRecordDetail', () => {
  it('shows a certified record with its recorded results labelled as entered by staff', async () => {
    fetchMock.mockResolvedValue(json(envelope(CERTIFIED_RECORD)));
    render(<ElectionRecordDetail electionId={CERTIFIED_RECORD.id} />);

    expect(await screen.findByRole('heading', { name: 'Council election 2025' })).toBeInTheDocument();
    expect(screen.getByText('Certified')).toBeInTheDocument();
    expect(screen.getByText('Contested')).toBeInTheDocument();
    expect(screen.getByText('Independent Auditor')).toBeInTheDocument();
    expect(screen.getAllByText('Ada Winner')).toHaveLength(2);
    expect(screen.getByText('Total votes recorded').nextSibling).toHaveTextContent('200');
    expect(screen.getByText('Participation recorded').nextSibling).toHaveTextContent('41%');
    expect(screen.getByText(/entered by staff\. This system did not count any ballot/)).toBeInTheDocument();
    expect(calledUrls()).toEqual([`/api/elections/${CERTIFIED_RECORD.id}`]);
  });

  it('says voting and tabulated results are unavailable instead of offering a ballot or a results tab', async () => {
    fetchMock.mockResolvedValue(json(envelope(NEW_RECORD)));
    render(<ElectionRecordDetail electionId={NEW_RECORD.id} />);

    expect(await screen.findByRole('heading', { name: 'Voting and tabulated results' })).toBeInTheDocument();
    const unavailable = screen.getByRole('alert');
    expect(unavailable).toHaveTextContent('Not available in this release');
    expect(unavailable).toHaveTextContent('UE-GOV-ELECTION-VOTING-RESULTS');
    expectNoVotingAffordance();
    expect(screen.queryByText(/already cast your ballot/i)).toBeNull();
    expect(screen.queryByText(/turnout/i)).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('shows "nothing recorded" for a fresh record instead of zero votes, and hides per-candidate vote counts', async () => {
    fetchMock.mockResolvedValue(
      json(envelope({ ...NEW_RECORD, candidates: [{ name: 'Rowan Candidate', union: 'Local 9', votes: 0 }] })),
    );
    render(<ElectionRecordDetail electionId={NEW_RECORD.id} />);

    expect(await screen.findByText('No results have been recorded for this election.')).toBeInTheDocument();
    expect(screen.getByText('Not certified')).toBeInTheDocument();
    expect(screen.queryByText(/votes recorded/i)).toBeNull();
    expect(screen.queryByText(/^0$/)).toBeNull();
    expect(screen.getByText('Rowan Candidate')).toBeInTheDocument();
  });

  it('shows per-candidate recorded votes only once the record has recorded results', async () => {
    fetchMock.mockResolvedValue(json(envelope(CERTIFIED_RECORD)));
    render(<ElectionRecordDetail electionId={CERTIFIED_RECORD.id} />);
    await screen.findByRole('heading', { name: 'Council election 2025' });
    expect(screen.getByText(/Local 2 · 80 votes recorded/)).toBeInTheDocument();
  });

  it('says a record does not exist on a 404 and links back to the list', async () => {
    fetchMock.mockResolvedValue(failure(404, 'Election not found'));
    render(<ElectionRecordDetail electionId="missing" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('This council election record does not exist.');
    expect(screen.getByRole('link', { name: 'Back to council elections' })).toHaveAttribute('href', '/en-CA/dashboard/elections');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('shows a failure, not a permanent loading state, and loads again when asked', async () => {
    fetchMock.mockResolvedValueOnce(failure(500, 'Internal server error')).mockResolvedValue(json(envelope(NEW_RECORD)));
    render(<ElectionRecordDetail electionId={NEW_RECORD.id} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 500');
    expect(screen.queryByRole('status')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Council election 2027' })).toBeInTheDocument();
  });

  it('never calls the retired vote route or a results route', async () => {
    fetchMock.mockResolvedValue(json(envelope(CERTIFIED_RECORD)));
    render(<ElectionRecordDetail electionId={CERTIFIED_RECORD.id} />);
    await screen.findByRole('heading', { name: 'Council election 2025' });
    expect(calledUrls().filter((url) => /\/vote|\/results/.test(url))).toEqual([]);
  });

  it('speaks French', async () => {
    intl.locale = 'fr-CA';
    fetchMock.mockResolvedValue(json(envelope(CERTIFIED_RECORD)));
    render(<ElectionRecordDetail electionId={CERTIFIED_RECORD.id} />);
    expect(await screen.findByRole('heading', { name: 'Élection du conseil 2025' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vote et résultats dépouillés' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Non disponible dans cette version');
  });
});

describe('ElectionRecordForm', () => {
  const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

  it('creates the record through POST /api/elections and returns to the list under the locale', async () => {
    fetchMock.mockResolvedValue(json({ data: NEW_RECORD }, 201));
    render(<ElectionRecordForm />);

    fill('Election year', '2027');
    fill('Positions available', '3');
    fill('Election date', '2027-03-15');
    fill('Name', 'Rowan Candidate');
    fill('Union', 'Local 9');
    fill('Platform', 'Safer worksites');
    fireEvent.click(screen.getByRole('button', { name: 'Create record' }));

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/en-CA/dashboard/elections'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/elections');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      electionYear: 2027,
      electionDate: '2027-03-15',
      positionsAvailable: 3,
      candidates: [{ name: 'Rowan Candidate', union: 'Local 9', platform: 'Safer worksites' }],
    });
  });

  it('drops candidate rows with no name and adds and removes rows', async () => {
    fetchMock.mockResolvedValue(json({ data: NEW_RECORD }, 201));
    render(<ElectionRecordForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Add candidate' }));
    expect(screen.getAllByLabelText('Name')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Remove candidate 2' }));
    expect(screen.getAllByLabelText('Name')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Add candidate' }));

    fill('Election date', '2027-03-15');
    fireEvent.change(screen.getAllByLabelText('Name')[1], { target: { value: ' Pat Second ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create record' }));

    await waitFor(() => expect(nav.push).toHaveBeenCalled());
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.candidates).toEqual([{ name: 'Pat Second', union: '', platform: '' }]);
  });

  it('does not send a form without a date, and says why', () => {
    render(<ElectionRecordForm />);
    fireEvent.submit(screen.getByRole('button', { name: 'Create record' }).closest('form') as HTMLFormElement);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid election year, an election date and at least one position.');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('says nothing was saved when the server fails, keeps the entries and does not navigate', async () => {
    fetchMock.mockResolvedValue(failure(500, 'Internal server error'));
    render(<ElectionRecordForm />);
    fill('Election date', '2027-03-15');
    fill('Name', 'Rowan Candidate');
    fireEvent.click(screen.getByRole('button', { name: 'Create record' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The election record could not be created. Nothing was saved.');
    expect(nav.push).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Name')).toHaveValue('Rowan Candidate');
    expect(screen.getByRole('button', { name: 'Create record' })).toBeEnabled();
  });

  it('says so when the account may not create records', async () => {
    fetchMock.mockResolvedValue(failure(403, 'Forbidden: Requires clc_staff'));
    render(<ElectionRecordForm />);
    fill('Election date', '2027-03-15');
    fireEvent.click(screen.getByRole('button', { name: 'Create record' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to create council election records.');
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('says it creates a record only and does not open voting', () => {
    render(<ElectionRecordForm />);
    expect(screen.getByText(/does not open voting/)).toBeInTheDocument();
    expectNoVotingAffordance();
  });

  it('speaks French and returns to the French list', async () => {
    intl.locale = 'fr-CA';
    fetchMock.mockResolvedValue(json({ data: NEW_RECORD }, 201));
    render(<ElectionRecordForm />);

    expect(screen.getByRole('heading', { name: 'Créer un registre d’élection du conseil' })).toBeInTheDocument();
    fill('Date de l’élection', '2027-03-15');
    fireEvent.click(screen.getByRole('button', { name: 'Créer le registre' }));
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/fr-CA/dashboard/elections'));
  });
});
