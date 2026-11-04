// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import enCA from '@/messages/en-CA.json';
import frCA from '@/messages/fr-CA.json';
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';

const GRIEVANCE = '33333333-3333-4333-8333-333333333333';
const back = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useParams: () => ({ id: '33333333-3333-4333-8333-333333333333' }), useRouter: () => ({ back }) }));
vi.mock('@/components/grievances/case-intelligence-panel', () => ({ CaseIntelligencePanel: () => null }));
vi.mock('@/components/clause-suggestions', () => ({ ClauseSuggestions: () => null }));
vi.mock('@/components/steward-recommendations', () => ({
  StewardRecommendations: ({ onAssign }: { onAssign?: (stewardId: string) => void }) => (
    <button type="button" onClick={() => onAssign?.('steward-1')}>
      assign steward
    </button>
  ),
}));

import { GrievanceDetailConsole } from '../grievance-detail-console';

// The shape GET /api/grievances/:id answers with: the grievance row, its events, governed documents, collaborators and the caller's access.
const detail = (overrides: Record<string, unknown> = {}) => ({
  id: GRIEVANCE,
  grievanceNumber: 'GR-2026-014',
  type: 'discipline',
  status: 'filed',
  priority: 'high',
  title: 'Unjust suspension',
  description: 'The member was suspended without notice.',
  filedDate: '2026-03-02T12:00:00.000Z',
  unionRepId: 'rep-1',
  primaryLroId: 'lro-1',
  employerName: 'Acme Ltd.',
  cbaArticle: 'Article 12',
  events: [{ id: 'e-1', eventType: 'status_changed', actorUserId: 'rep-1', notes: 'Status changed: new → filed', createdAt: '2026-03-02T15:30:00.000Z' }],
  documents: [],
  governedDocuments: [],
  collaborators: [],
  effectiveAccess: { isPrimaryOwner: true, isSecondaryCollaborator: false, accessRole: 'primary_owner', canManageAssignments: true, canUploadDocuments: true },
  ...overrides,
});

interface Server {
  get: () => Response;
  status: () => Response;
  documents: () => Response;
  access: () => Response;
}
let server: Server;
let current: Record<string, unknown>;
const fetchMock = vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
  const method = init?.method ?? 'GET';
  if (url === `/api/grievances/${GRIEVANCE}` && method === 'GET') return server.get();
  if (url === `/api/grievances/${GRIEVANCE}/status` && method === 'PATCH') return server.status();
  if (url === `/api/grievances/${GRIEVANCE}/documents` && method === 'POST') return server.documents();
  if (url === `/api/grievances/${GRIEVANCE}/access`) return server.access();
  return Response.json({ message: `unexpected ${method} ${url}` }, { status: 404 });
});
const callsTo = (suffix: string, method: string) =>
  fetchMock.mock.calls.filter(([url, init]) => url.endsWith(suffix) && (init?.method ?? 'GET') === method);
const reads = () => callsTo(GRIEVANCE, 'GET');

beforeEach(() => {
  current = detail();
  server = {
    get: () => standardSuccessResponse(current),
    status: () => standardSuccessResponse({ status: 'acknowledged' }),
    documents: () => standardSuccessResponse({ id: 'doc-1' }),
    access: () => standardSuccessResponse({ id: 'access-1' }),
  };
  fetchMock.mockClear();
  back.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderConsole(locale: 'en-CA' | 'fr-CA' = 'en-CA') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA} timeZone="UTC">
      <GrievanceDetailConsole />
    </NextIntlClientProvider>,
  );
}

const loaded = () => screen.findByRole('heading', { name: 'Unjust suspension' });

describe('GrievanceDetailConsole: loading', () => {
  it('shows the grievance as the route answers with it, with its labels and dates written for the viewer', async () => {
    renderConsole();

    expect(await loaded()).toBeInTheDocument();
    expect(screen.getByText('GR-2026-014')).toBeInTheDocument();
    expect(screen.getByText('Current status: Filed')).toBeInTheDocument();
    expect(screen.getByText('Discipline')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Mar 2, 2026')).toBeInTheDocument();
    expect(screen.getByText('Acme Ltd.')).toBeInTheDocument();
    expect(screen.getByText('The member was suspended without notice.')).toBeInTheDocument();
    expect(screen.getByText('status changed')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/undefined|NaN|Invalid/);
  });

  it('says why a grievance could not be loaded, with the route’s own reason and a retry, and never that it was not found unless the route says so', async () => {
    server.get = () => standardErrorResponse(ErrorCode.FORBIDDEN, 'You do not have access to this grievance.');
    renderConsole();

    const failure = await screen.findByRole('alert');
    expect(failure).toHaveTextContent('The grievance could not be loaded');
    expect(failure).toHaveTextContent('You do not have access to this grievance.');
    expect(document.body.textContent).not.toMatch(/not found/i);

    server.get = () => standardSuccessResponse(current);
    fireEvent.click(within(failure).getByRole('button', { name: 'Retry' }));
    expect(await loaded()).toBeInTheDocument();
  });

  it('shows what the route says for a grievance that does not exist', async () => {
    server.get = () => standardErrorResponse(ErrorCode.NOT_FOUND, 'Grievance not found');
    renderConsole();

    expect(await screen.findByRole('alert')).toHaveTextContent('Grievance not found');
  });

  it('shows a failure, not an empty grievance, for a network error and for a body that is not a grievance', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('connection reset');
    }));
    renderConsole();
    expect(await screen.findByRole('alert')).toHaveTextContent('connection reset');
    cleanup();

    vi.stubGlobal('fetch', fetchMock);
    server.get = () => standardSuccessResponse({ id: GRIEVANCE, grievanceNumber: 'GR-1', status: 'filed' });
    renderConsole();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected API response');
    expect(screen.queryByText('No events yet')).toBeNull();
  });

  it('says what is not there instead of a blank: no events, no documents, no access assignments, no description', async () => {
    current = detail({ events: [], description: null });
    renderConsole();
    await screen.findByRole('heading', { name: 'Unjust suspension' });

    expect(screen.getByText('No events yet')).toBeInTheDocument();
    expect(screen.getByText('No documents uploaded')).toBeInTheDocument();
    expect(screen.getByText('No secondary access assignments yet.')).toBeInTheDocument();
    expect(screen.getByText('No description was recorded.')).toBeInTheDocument();
  });
});

describe('GrievanceDetailConsole: the status', () => {
  const statusButtons = () => screen.queryAllByRole('button', { name: /^Move to / }).map((button) => button.textContent);

  it('offers only the changes the server’s lifecycle rules allow, in the database’s own statuses', async () => {
    renderConsole();
    await loaded();

    expect(statusButtons()).toEqual(['Move to Acknowledged']);
    // The older screen offered statuses the database does not have, which the route refuses every time.
    expect(document.body.textContent).not.toMatch(/→ (triage|investigation|negotiation|resolved)/);
  });

  it('sends the chosen status with the note, reads the grievance again, and clears the note', async () => {
    renderConsole();
    await loaded();
    fireEvent.change(screen.getByRole('textbox', { name: 'Transition note' }), { target: { value: 'Reviewed with the member' } });
    current = detail({ status: 'acknowledged' });

    fireEvent.click(screen.getByRole('button', { name: 'Move to Acknowledged' }));

    expect(await screen.findByText('Current status: Acknowledged')).toBeInTheDocument();
    expect(JSON.parse(String(callsTo('/status', 'PATCH')[0][1]?.body))).toEqual({ status: 'acknowledged', notes: 'Reviewed with the member' });
    expect(reads()).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Move to Investigating' })).toBeInTheDocument();
  });

  it('leaves the note out when there is none, so the server records its own', async () => {
    renderConsole();
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: 'Move to Acknowledged' }));

    await waitFor(() => expect(callsTo('/status', 'PATCH')).toHaveLength(1));
    expect(JSON.parse(String(callsTo('/status', 'PATCH')[0][1]?.body))).toEqual({ status: 'acknowledged' });
  });

  it('shows the reason the server refuses with, and changes nothing on screen', async () => {
    server.status = () => standardErrorResponse(ErrorCode.FORBIDDEN, 'You do not have authority to change the status of this matter');
    renderConsole();
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: 'Move to Acknowledged' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have authority to change the status of this matter');
    expect(screen.getByText('Current status: Filed')).toBeInTheDocument();
    expect(reads()).toHaveLength(1);
  });

  it('shows a network error, not nothing', async () => {
    renderConsole();
    await loaded();
    server.status = () => {
      throw new Error('connection reset');
    };

    fireEvent.click(screen.getByRole('button', { name: 'Move to Acknowledged' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('connection reset');
  });

  it('offers nothing to someone with no authority over the matter, and says why', async () => {
    current = detail({ effectiveAccess: { isPrimaryOwner: false, isSecondaryCollaborator: true, accessRole: 'reviewer', canManageAssignments: false, canUploadDocuments: false } });
    renderConsole();
    await loaded();

    expect(statusButtons()).toEqual([]);
    expect(screen.getByText('Only the representative responsible for this grievance can change its status.')).toBeInTheDocument();
  });

  it('says there is no change to make from a status the rules do not leave', async () => {
    current = detail({ status: 'closed' });
    renderConsole();
    await loaded();

    expect(statusButtons()).toEqual([]);
    expect(screen.getByText('No status change is available from this status.')).toBeInTheDocument();
  });

  it('says so when the grievance cannot be read again after a change the server accepted, instead of showing the old one as current', async () => {
    renderConsole();
    await loaded();
    server.get = () => standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Database unavailable');

    fireEvent.click(screen.getByRole('button', { name: 'Move to Acknowledged' }));

    const notice = await screen.findByRole('alert');
    expect(notice).toHaveTextContent('The grievance could not be refreshed');
    expect(notice).toHaveTextContent('What is shown may be out of date.');
    expect(notice).toHaveTextContent('Database unavailable');

    server.get = () => standardSuccessResponse(detail({ status: 'acknowledged' }));
    fireEvent.click(within(notice).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Current status: Acknowledged')).toBeInTheDocument();
    expect(screen.queryByText('The grievance could not be refreshed')).toBeNull();
  });
});

describe('GrievanceDetailConsole: adding a document', () => {
  const fill = (overrides: Partial<Record<'title' | 'filename' | 'url', string>> = {}) => {
    fireEvent.change(screen.getByRole('textbox', { name: 'Document title' }), { target: { value: overrides.title ?? 'Suspension letter' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Filename' }), { target: { value: overrides.filename ?? 'suspension.pdf' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'File URL (https://…)' }), { target: { value: overrides.url ?? 'https://storage.example.com/a/suspension.pdf' } });
  };
  const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Add governed document' }));
  const postedBody = () => JSON.parse(String(callsTo('/documents', 'POST')[0][1]?.body)) as Record<string, unknown>;

  it('says what it does: it records a document stored at an address, with no file and no verification', async () => {
    renderConsole();
    await loaded();

    expect(screen.getByText(/already stored at a web address/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Upload/ })).toBeNull();
  });

  it('sends what it knows and nothing it made up: no size, no content hash, and the media type its file name implies', async () => {
    renderConsole();
    await loaded();
    fill();

    submit();

    await waitFor(() => expect(callsTo('/documents', 'POST')).toHaveLength(1));
    expect(postedBody()).toEqual({
      title: 'Suspension letter',
      filename: 'suspension.pdf',
      fileUrl: 'https://storage.example.com/a/suspension.pdf',
      mimeType: 'application/pdf',
      documentType: 'evidence',
      privacyLabel: 'team_confidential',
    });
    expect(postedBody()).not.toHaveProperty('fileSize');
    expect(postedBody()).not.toHaveProperty('contentHash');
  });

  it('does not call a file of an unknown type a PDF', async () => {
    renderConsole();
    await loaded();
    fill({ filename: 'notes', url: 'https://storage.example.com/a/notes' });

    submit();

    await waitFor(() => expect(callsTo('/documents', 'POST')).toHaveLength(1));
    expect(postedBody().mimeType).toBe('application/octet-stream');
  });

  it('shows the document once the server has accepted it: the form is cleared, the grievance is read again, and a success is said', async () => {
    renderConsole();
    await loaded();
    fill();
    current = detail({
      governedDocuments: [
        { id: 'doc-1', title: 'Suspension letter', filename: 'suspension.pdf', fileUrl: 'https://storage.example.com/a/suspension.pdf', documentType: 'evidence', privacyLabel: 'team_confidential', createdAt: '2026-03-05T12:00:00.000Z' },
      ],
    });

    submit();

    expect(await screen.findByRole('status')).toHaveTextContent('The document was added to this grievance.');
    expect(reads()).toHaveLength(2);
    expect(screen.getByRole('textbox', { name: 'Document title' })).toHaveValue('');
    const link = screen.getByRole('link', { name: 'Suspension letter' });
    expect(link).toHaveAttribute('href', 'https://storage.example.com/a/suspension.pdf');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByText('Team confidential', { selector: 'span' })).toBeInTheDocument();
    expect(screen.queryByText('No documents uploaded')).toBeNull();
  });

  it('shows the server’s reason when it does not accept the document, keeps what was typed, and does not say it was added', async () => {
    server.documents = () => standardErrorResponse(ErrorCode.FORBIDDEN, 'You do not have permission to upload documents to this case');
    renderConsole();
    await loaded();
    fill();

    submit();

    const failure = await screen.findByRole('alert');
    expect(failure).toHaveTextContent('The document could not be added.');
    expect(failure).toHaveTextContent('You do not have permission to upload documents to this case');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Document title' })).toHaveValue('Suspension letter');
    expect(reads()).toHaveLength(1);
  });

  it('shows a validation refusal as the failure it is', async () => {
    server.documents = () => standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid input');
    renderConsole();
    await loaded();
    fill();

    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid input');
    expect(screen.queryByText('The document was added to this grievance.')).toBeNull();
  });

  it('shows a network error, and no success', async () => {
    renderConsole();
    await loaded();
    fill();
    server.documents = () => {
      throw new Error('connection reset');
    };

    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('connection reset');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('refuses an address that is not a web address before it asks the server for anything', async () => {
    renderConsole();
    await loaded();
    fill({ url: 'javascript:alert(document.cookie)' });

    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter the web address (http or https) of the file.');
    expect(callsTo('/documents', 'POST')).toHaveLength(0);
  });

  it('does not make a link of a stored address that is not a web address', async () => {
    current = detail({
      governedDocuments: [
        { id: 'doc-9', title: 'Old record', filename: null, fileUrl: 'javascript:alert(1)', documentType: 'evidence', privacyLabel: 'privileged', createdAt: '2026-03-05T12:00:00.000Z' },
      ],
    });
    renderConsole();
    await loaded();

    expect(screen.getByText('Old record')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Old record' })).toBeNull();
    expect(screen.getByText('Privileged', { selector: 'span' })).toBeInTheDocument();
  });
});

describe('GrievanceDetailConsole: access for other representatives', () => {
  const withCollaborator = (overrides: Record<string, unknown> = {}) => ({
    id: 'access-1',
    userId: 'user-77',
    accessRole: 'reviewer',
    status: 'active',
    expiresAt: '2026-04-01T12:00:00.000Z',
    ...overrides,
  });

  it('lists who has access, with the role and status in words and when it ends', async () => {
    current = detail({ collaborators: [withCollaborator()] });
    renderConsole();
    await loaded();

    expect(screen.getByText('user-77')).toBeInTheDocument();
    expect(screen.getByText('Reviewer', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Active', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('expires Apr 1, 2026')).toBeInTheDocument();
    expect(screen.getByText(/Primary ownership remains with lro-1\./)).toBeInTheDocument();
  });

  it('shows the server’s reason when access cannot be granted, and keeps what was typed', async () => {
    server.access = () => standardErrorResponse(ErrorCode.FORBIDDEN, 'Only the primary representative can grant access');
    renderConsole();
    await loaded();
    fireEvent.change(screen.getByRole('textbox', { name: 'Collaborator user ID' }), { target: { value: 'user-88' } });

    fireEvent.click(screen.getByRole('button', { name: 'Grant collaborator access' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Only the primary representative can grant access');
    expect(screen.getByRole('textbox', { name: 'Collaborator user ID' })).toHaveValue('user-88');
  });

  it('grants access for a reviewer for thirty days, which it says, and reads the grievance again', async () => {
    renderConsole();
    await loaded();
    expect(screen.getByText(/expires after 30 days/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Collaborator user ID' }), { target: { value: 'user-88' } });

    fireEvent.click(screen.getByRole('button', { name: 'Grant collaborator access' }));

    await waitFor(() => expect(reads()).toHaveLength(2));
    const body = JSON.parse(String(callsTo('/access', 'POST')[0][1]?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ userId: 'user-88', accessRole: 'reviewer', canUploadDocuments: false, canViewPrivateDocuments: false });
    expect(Date.parse(String(body.expiresAt)) - Date.now()).toBeGreaterThan(29 * 86_400_000);
    expect(screen.getByRole('textbox', { name: 'Collaborator user ID' })).toHaveValue('');
  });

  it('shows the server’s reason when access cannot be revoked, in place of a general message', async () => {
    current = detail({ collaborators: [withCollaborator()] });
    server.access = () => standardErrorResponse(ErrorCode.NOT_FOUND, 'The access assignment no longer exists');
    renderConsole();
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The access assignment no longer exists');
  });

  it('offers neither the grant form nor a revoke to someone who may not manage access', async () => {
    current = detail({
      collaborators: [withCollaborator()],
      effectiveAccess: { isPrimaryOwner: false, isSecondaryCollaborator: true, accessRole: 'secondary_lro', canManageAssignments: false, canUploadDocuments: true },
    });
    renderConsole();
    await loaded();

    expect(screen.queryByRole('button', { name: 'Revoke' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Grant collaborator access' })).toBeNull();
  });
});

describe('GrievanceDetailConsole: steward assignment', () => {
  it('reads the grievance again when a steward is assigned from the recommendations, and says so if that fails', async () => {
    renderConsole();
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: 'assign steward' }));
    await waitFor(() => expect(reads()).toHaveLength(2));

    server.get = () => standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Database unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'assign steward' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
  });
});

describe('GrievanceDetailConsole: French', () => {
  it('writes the screen, the statuses and the dates in French', async () => {
    renderConsole('fr-CA');

    expect(await screen.findByRole('heading', { name: 'Unjust suspension' })).toBeInTheDocument();
    expect(screen.getByText('Statut actuel : Déposé')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Passer à « Accusé de réception »' })).toBeInTheDocument();
    expect(screen.getByText('Mesure disciplinaire')).toBeInTheDocument();
    expect(screen.getByText('2 mars 2026')).toBeInTheDocument();
    expect(screen.getByText('Aucun document téléversé')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter un document encadré' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Case Details|Governed Documents|Event Timeline|Move to|Current status/);
  });

  it('says a refused document in French, with the server’s reason', async () => {
    server.documents = () => standardErrorResponse(ErrorCode.FORBIDDEN, 'Permission refusée');
    renderConsole('fr-CA');
    await screen.findByRole('heading', { name: 'Unjust suspension' });
    fireEvent.change(screen.getByRole('textbox', { name: 'Titre du document' }), { target: { value: 'Lettre' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Nom du fichier' }), { target: { value: 'lettre.pdf' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'URL du fichier (https://…)' }), { target: { value: 'https://storage.example.com/lettre.pdf' } });

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un document encadré' }));

    const failure = await screen.findByRole('alert');
    expect(failure).toHaveTextContent('Le document n’a pas pu être ajouté.');
    expect(failure).toHaveTextContent('Permission refusée');
  });

  it('says a failed load in French, with a retry', async () => {
    server.get = () => standardErrorResponse(ErrorCode.FORBIDDEN, 'Interdit');
    renderConsole('fr-CA');

    const failure = await screen.findByRole('alert');
    expect(failure).toHaveTextContent('Le grief n’a pas pu être chargé');
    expect(within(failure).getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });
});

describe('GrievanceDetailConsole: the way back', () => {
  it('names the back control and goes back', async () => {
    renderConsole();
    await loaded();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(back).toHaveBeenCalledTimes(1);
  });
});
