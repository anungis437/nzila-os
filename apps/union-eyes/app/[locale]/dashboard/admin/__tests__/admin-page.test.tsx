// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { NextIntlClientProvider } from 'next-intl';
import enCA from '@/messages/en-CA.json';
import frCA from '@/messages/fr-CA.json';
import type { listPlatformUsers, recentMemberActivity } from '@/lib/platform/user-directory';
import { ErrorCode, standardErrorResponse, standardSuccessResponse } from '@/lib/api/standardized-responses';
import AdminPage from '../page';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
vi.mock('next/link', () => ({
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// The routes answer inside the framework's envelope, { success, data, timestamp }, which standardSuccessResponse builds; the rows are
// typed as what the directory functions the routes call return, so a field the console reads that they do not return fails to compile here.
type UserRow = Awaited<ReturnType<typeof listPlatformUsers>>[number];
type ActivityRow = Awaited<ReturnType<typeof recentMemberActivity>>[number];

const stats = { totalMembers: 120, activeOrganizations: '4', totalOrganizations: 5, totalStorage: 1.5, activeToday: '7' };
const activityRow = (overrides: Partial<ActivityRow> = {}): ActivityRow => ({
  id: 'member-1',
  type: 'member_added',
  description: 'A. Worker joined Local 100 as steward',
  user: 'A. Worker',
  organizationName: 'Local 100',
  timestamp: new Date('2026-03-16T12:00:00Z'),
  ...overrides,
});
const userRow = (overrides: Partial<UserRow> = {}): UserRow => ({
  id: 'user-1',
  name: 'Alex Worker',
  email: 'a***@example.com',
  role: 'steward',
  organizationId: 'org-1',
  organizationName: 'Local 100',
  status: 'active',
  lastLogin: null,
  joinedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});
const localRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'org-1',
  number: 'toronto-central',
  name: 'Toronto Central',
  region: 'ON',
  organizationType: 'local',
  parentId: null,
  status: 'active',
  ...overrides,
});
const health = {
  success: true,
  dbSizeBytes: 52428800,
  dbSizeMb: 50,
  activeConnections: 3,
  tableCount: 212,
  status: 'healthy',
  checkedAt: '2026-03-16T12:00:00.000Z',
  tenantPrincipal: { currentUser: 'union_eyes_runtime', rolsuper: false, rolbypassrls: false, applicationName: 'union-claims-app', databaseName: 'ue' },
  systemPrincipal: { currentUser: 'union_eyes_system', rolsuper: false, rolbypassrls: false, applicationName: 'union-claims-app', databaseName: 'ue' },
};

interface Server {
  stats: () => Response;
  activity: () => Response;
  users: () => Response;
  locals: () => Response;
  health: () => Response;
  userPut: () => Response;
  userDelete: () => Response;
  optimize: () => Response;
  ai: () => Response;
}
let server: Server;
const fetchMock = vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
  const method = init?.method ?? 'GET';
  if (url === '/api/admin/stats/overview') return server.stats();
  if (url.startsWith('/api/admin/stats/activity')) return server.activity();
  if (url.startsWith('/api/admin/users/') && method === 'PUT') return server.userPut();
  if (url.startsWith('/api/admin/users/') && method === 'DELETE') return server.userDelete();
  if (url.startsWith('/api/admin/users')) return server.users();
  if (url.startsWith('/api/admin/organizations')) return server.locals();
  if (url === '/api/admin/database/health') return server.health();
  if (url === '/api/admin/database/optimize' && method === 'POST') return server.optimize();
  if (url.startsWith('/api/ai/')) return server.ai();
  return Response.json({ message: `unexpected ${method} ${url}` }, { status: 404 });
});

beforeEach(() => {
  server = {
    stats: () => standardSuccessResponse(stats),
    activity: () => standardSuccessResponse([activityRow()]),
    users: () => standardSuccessResponse([userRow()]),
    locals: () => standardSuccessResponse([localRow()]),
    health: () => standardSuccessResponse(health),
    userPut: () => Response.json({ success: true, status: 'inactive' }),
    userDelete: () => Response.json({ success: true }),
    optimize: () => Response.json({ success: true, tablesAnalyzed: 212, tablesSkipped: 0, message: 'ANALYZE updated planner statistics for all 212 tables' }),
    ai: () => Response.json({ success: true, data: { id: 'feedback-1' } }),
  };
  fetchMock.mockClear();
  toast.success.mockClear();
  toast.error.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('confirm', vi.fn(() => true));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderPage(locale: 'en-CA' | 'fr-CA' = 'en-CA') {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'en-CA' ? enCA : frCA}>
      <AdminPage />
    </NextIntlClientProvider>,
  );
}

const open = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }));
const callsTo = (prefix: string, method?: string) =>
  fetchMock.mock.calls.filter(([url, init]) => url.startsWith(prefix) && (method === undefined || (init?.method ?? 'GET') === method));

describe('AdminPage: overview', () => {
  it('shows the platform statistics as the route answers with them, labelled for what they are', async () => {
    renderPage();

    expect(await screen.findByText('120')).toBeInTheDocument();
    expect(screen.getByText('7 memberships added or updated in the last 24 hours')).toBeInTheDocument();
    expect(screen.getByText('5 organizations in total')).toBeInTheDocument();
    expect(screen.getByText('1.5 GB')).toBeInTheDocument();
    expect(screen.getByText('Database size')).toBeInTheDocument();
  });

  it('claims no health, security or activity figure that nothing measures', async () => {
    renderPage();
    await screen.findByText('120');

    expect(document.body.textContent).not.toMatch(/Healthy|All systems operational|System Health|Active Sessions|Storage Used|active today/i);
    expect(screen.queryByText(enCA.admin.overview.systemHealth)).toBeNull();
  });

  it('shows the route’s refusal and a retry when the statistics cannot be read, instead of “...”', async () => {
    server.stats = () => standardErrorResponse(ErrorCode.INSUFFICIENT_PERMISSIONS, "Requires at least 'platform_lead' role");
    renderPage();

    const failure = await screen.findByText('The platform statistics could not be loaded');
    expect(failure.closest('[role="alert"]')).toHaveTextContent("Requires at least 'platform_lead' role");
    expect(screen.queryByText('...')).toBeNull();
    expect(screen.queryByText('120')).toBeNull();

    server.stats = () => standardSuccessResponse(stats);
    fireEvent.click(within(failure.closest('[role="alert"]') as HTMLElement).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('120')).toBeInTheDocument();
  });

  it('shows what each recent activity entry says, with its time', async () => {
    renderPage();

    expect(await screen.findByText('A. Worker joined Local 100 as steward')).toBeInTheDocument();
    expect(screen.getByText(new Date('2026-03-16T12:00:00Z').toLocaleString('en-CA'))).toBeInTheDocument();
  });

  it('says there is no activity when there is none, instead of “Loading activity...” for ever', async () => {
    server.activity = () => standardSuccessResponse([]);
    renderPage();

    expect(await screen.findByText('No recent activity.')).toBeInTheDocument();
    expect(screen.queryByText(/Loading activity/)).toBeNull();
  });

  it('says the activity could not be loaded when it cannot', async () => {
    server.activity = () => standardErrorResponse(ErrorCode.FORBIDDEN, 'Platform staff authority is required');
    renderPage();

    expect(await screen.findByText('The recent activity could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('Platform staff authority is required')).toBeInTheDocument();
    expect(screen.queryByText('No recent activity.')).toBeNull();
  });

  it('links to the setup pages that exist', async () => {
    renderPage();
    await screen.findByText('120');

    expect(screen.getByRole('link', { name: /Setup Checklist/ })).toHaveAttribute('href', '/en-CA/dashboard/admin/onboarding');
    expect(screen.getByRole('link', { name: /User Invites/ })).toHaveAttribute('href', '/en-CA/dashboard/admin/members');
    expect(screen.getByRole('link', { name: /Worksites & Employers/ })).toHaveAttribute('href', '/en-CA/dashboard/structure');
  });

  it('says a statistic that is not a number is a failure, not a figure', async () => {
    server.stats = () => standardSuccessResponse({ ...stats, totalMembers: 'many' });
    renderPage();

    expect(await screen.findByText('The platform statistics could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('Unexpected API response: incomplete statistics')).toBeInTheDocument();
  });

  it('shows member figures the route does not measure (null, #1118) as not recorded, not as zero or a failure', async () => {
    server.stats = () => standardSuccessResponse({ ...stats, totalMembers: null, activeToday: null });
    renderPage();

    expect(await screen.findByText('4')).toBeInTheDocument();
    expect(screen.queryByText('The platform statistics could not be loaded')).not.toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText(/memberships? added or updated in the last 24 hours/)).not.toBeInTheDocument();
  });
});

describe('AdminPage: users', () => {
  it('says the directory covers only organizations the caller administers directly (#1116)', async () => {
    renderPage();
    open(enCA.admin.sections.userManagement);
    expect(await screen.findByText(enCA.adminConsolePage.usersScopeNote)).toBeInTheDocument();
  });

  it('lists the users the route answers with, and offers no add, edit or last login it cannot back', async () => {
    renderPage();
    open(enCA.admin.sections.userManagement);

    expect(await screen.findByText('Alex Worker')).toBeInTheDocument();
    expect(screen.getByText('a***@example.com')).toBeInTheDocument();
    expect(screen.getByText('Local 100', { selector: 'td' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add user/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /edit user/i })).toBeNull();
    expect(screen.queryByText(/Never/)).toBeNull();
    expect(screen.queryByText(enCA.admin.users.table.lastLogin)).toBeNull();
  });

  it('asks for the unfiltered list for a search that is too short, and says why', async () => {
    renderPage();
    open(enCA.admin.sections.userManagement);
    await screen.findByText('Alex Worker');

    fireEvent.change(screen.getByPlaceholderText(enCA.admin.users.searchPlaceholder), { target: { value: 'al' } });

    expect(await screen.findByText(/Type at least 3 characters to search/)).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(callsTo('/api/admin/users').every(([url]) => url === '/api/admin/users')).toBe(true);
  });

  it('searches the directory once the search is long enough', async () => {
    renderPage();
    open(enCA.admin.sections.userManagement);
    await screen.findByText('Alex Worker');

    fireEvent.change(screen.getByPlaceholderText(enCA.admin.users.searchPlaceholder), { target: { value: 'alex w' } });

    await waitFor(() => expect(callsTo('/api/admin/users?search=alex%20w')).toHaveLength(1));
  });

  it('shows the route’s refusal with a retry instead of “No users found”', async () => {
    server.users = () => standardErrorResponse(ErrorCode.FORBIDDEN, 'Platform staff authority is required');
    renderPage();
    open(enCA.admin.sections.userManagement);

    expect(await screen.findByText('The user directory could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('Platform staff authority is required')).toBeInTheDocument();
    expect(screen.queryByText('No users found')).toBeNull();
  });

  it('says there are no users only when the route answers with none', async () => {
    server.users = () => standardSuccessResponse([]);
    renderPage();
    open(enCA.admin.sections.userManagement);

    expect(await screen.findByText('No users found')).toBeInTheDocument();
  });

  it('changes a status with PUT, tells the user, and reads the list again', async () => {
    renderPage();
    open(enCA.admin.sections.userManagement);
    fireEvent.click(await screen.findByRole('button', { name: 'active' }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('User status updated'));
    const put = callsTo('/api/admin/users/user-1', 'PUT')[0];
    expect(JSON.parse(String(put[1]?.body))).toEqual({ action: 'toggleStatus' });
    await waitFor(() => expect(callsTo('/api/admin/users', 'GET').length).toBeGreaterThanOrEqual(2));
  });

  it('says why a status change was refused, and does not say it worked', async () => {
    server.userPut = () => Response.json({ error: 'Forbidden' }, { status: 403 });
    renderPage();
    open(enCA.admin.sections.userManagement);
    fireEvent.click(await screen.findByRole('button', { name: 'active' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('The status could not be changed: Forbidden'));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('removes a user only after confirmation, with DELETE', async () => {
    const confirmMock = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmMock);
    renderPage();
    open(enCA.admin.sections.userManagement);
    await screen.findByText('Alex Worker');

    fireEvent.click(screen.getByRole('button', { name: 'Remove user' }));
    expect(callsTo('/api/admin/users/', 'DELETE')).toHaveLength(0);

    confirmMock.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove user' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('User removed'));
    expect(callsTo('/api/admin/users/user-1?organizationId=org-1', 'DELETE')).toHaveLength(1);
  });

  it('says why a removal was refused', async () => {
    server.userDelete = () => Response.json({ error: 'Member not found' }, { status: 404 });
    renderPage();
    open(enCA.admin.sections.userManagement);
    await screen.findByText('Alex Worker');

    fireEvent.click(screen.getByRole('button', { name: 'Remove user' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('The user could not be removed: Member not found'));
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('AdminPage: organizations', () => {
  it('lists the organizations the route answers with, and offers no add, edit or settings it cannot back', async () => {
    renderPage();
    open(enCA.admin.sections.localSections);

    expect(await screen.findByText('Toronto Central')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: new RegExp(enCA.admin.locals.addLocal, 'i') })).toBeNull();
    expect(screen.queryByRole('button', { name: /edit local|local settings/i })).toBeNull();
  });

  // Issue #1116: the directory is the tenancy record; member counts and officer contacts are the organization's content.
  it('shows no member counts, president or contact, and says why', async () => {
    server.locals = () =>
      standardSuccessResponse([localRow({ memberCount: 40, activeCount: 30, president: 'Pat President', contact: 'pat@example.com' })]);
    renderPage();
    open(enCA.admin.sections.localSections);

    expect(await screen.findByText('Toronto Central')).toBeInTheDocument();
    expect(screen.getByText(enCA.adminConsolePage.directoryOnlyNote)).toBeInTheDocument();
    for (const absent of ['Pat President', 'pat@example.com', '40', '30']) expect(screen.queryByText(absent)).toBeNull();
    expect(screen.queryByText(new RegExp(`${enCA.admin.locals.totalMembers}|${enCA.admin.locals.president}`))).toBeNull();
  });

  it('shows a dash for a region that is not recorded', async () => {
    server.locals = () => standardSuccessResponse([localRow({ region: '', number: '' })]);
    renderPage();
    open(enCA.admin.sections.localSections);

    expect(await screen.findByText('Toronto Central')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('shows the route’s refusal instead of “No organizations found”', async () => {
    server.locals = () => standardErrorResponse(ErrorCode.FORBIDDEN, 'Requires at least platform_lead');
    renderPage();
    open(enCA.admin.sections.localSections);

    expect(await screen.findByText('The organizations could not be loaded')).toBeInTheDocument();
    expect(screen.queryByText('No organizations found')).toBeNull();
  });
});

describe('AdminPage: sections with nothing behind them', () => {
  it.each([
    [enCA.admin.sections.systemSettings, 'UE-ADMIN-SYSTEM-SETTINGS'],
    [enCA.admin.sections.security, 'UE-ADMIN-SECURITY-OVERVIEW'],
    [enCA.admin.sections.reports, 'UE-ADMIN-REPORTS-HUB'],
  ])('says %s is not available instead of showing switches, counts or logs that nothing produces', async (label, capability) => {
    renderPage();
    await screen.findByText('120');

    open(label);

    expect(await screen.findByRole('alert')).toHaveTextContent(capability);
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(document.body.textContent).not.toMatch(/Secure\b|No degradation|Security Events|admin@union\.ca|Toronto Central - Member|Generate\b|Visual Query Builder|Maintenance|Automatic Backups|Soft Deletes/i);
  });
});

describe('AdminPage: database', () => {
  it('shows the metrics the health route measures, and none it does not', async () => {
    renderPage();
    open(enCA.admin.sections.database);

    expect(await screen.findByText('50 MB')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('212')).toBeInTheDocument();
    expect(screen.getByText(/union_eyes_runtime \(tenant role\), union_eyes_system \(system role\)/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/12 \/ 100|45ms|Fast|Azure PostgreSQL|Query Performance|Backup & Recovery|Geo-Redundant|Point-in-Time/i);
  });

  it('shows the health failure with a retry instead of zeros', async () => {
    server.health = () => standardErrorResponse(ErrorCode.INSUFFICIENT_PERMISSIONS, "Requires at least 'platform_lead' role");
    renderPage();
    open(enCA.admin.sections.database);

    expect(await screen.findByText('The database health could not be loaded')).toBeInTheDocument();
    expect(screen.getAllByText("Requires at least 'platform_lead' role").length).toBeGreaterThan(0);
    expect(screen.queryByText('0 MB')).toBeNull();
  });

  it('reports what the optimization route says it did, not a general “completed”', async () => {
    server.optimize = () =>
      Response.json({
        success: true,
        tablesAnalyzed: 3,
        tablesSkipped: 209,
        message: 'ANALYZE updated planner statistics for 3 of 212 tables; 209 are owned by another role and were skipped',
      });
    renderPage();
    open(enCA.admin.sections.database);
    await screen.findByText('50 MB');

    fireEvent.click(screen.getByRole('button', { name: 'Optimize Database' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('ANALYZE updated planner statistics for 3 of 212 tables; 209 are owned by another role and were skipped'),
    );
    expect(toast.success).not.toHaveBeenCalledWith('Database optimization completed');
  });

  it('reports an optimization that updated nothing as a failure', async () => {
    server.optimize = () =>
      Response.json({ success: false, tablesAnalyzed: 0, tablesSkipped: 212, message: 'ANALYZE ran but this role owns none of the tables, so no planner statistics were updated' });
    renderPage();
    open(enCA.admin.sections.database);
    await screen.findByText('50 MB');

    fireEvent.click(screen.getByRole('button', { name: 'Optimize Database' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('ANALYZE ran but this role owns none of the tables, so no planner statistics were updated'),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('reports a refused optimization with the route’s reason', async () => {
    server.optimize = () => Response.json({ error: 'Forbidden' }, { status: 403 });
    renderPage();
    open(enCA.admin.sections.database);
    await screen.findByText('50 MB');

    fireEvent.click(screen.getByRole('button', { name: 'Optimize Database' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Forbidden'));
  });
});

describe('AdminPage: AI endpoint testing', () => {
  const openTester = async () => {
    renderPage();
    await screen.findByText('120');
    open(enCA.admin.sections.aiTesting);
    return screen.findByRole('heading', { name: 'AI Endpoints Testing' });
  };

  it('starts with empty fields and no fixture of a database it cannot see', async () => {
    await openTester();

    for (const id of ['feedback-query-id', 'get-feedback-query-id', 'search-query']) {
      expect(document.getElementById(id)).toHaveValue('');
    }
    expect(document.body.textContent).not.toMatch(/7ba567db|test-org-001|Test Data Reference|3 legal documents|âœ|âŒ|ðŸ/);
    expect(screen.getByRole('button', { name: 'Submit Feedback' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Get Feedback' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Search Documents' })).toBeDisabled();
  });

  it('submits the feedback it was given and shows the answer with its status', async () => {
    await openTester();
    fireEvent.change(document.getElementById('feedback-query-id')!, { target: { value: ' query-42 ' } });
    fireEvent.change(document.getElementById('feedback-rating')!, { target: { value: 'bad' } });

    fireEvent.click(screen.getByRole('button', { name: 'Submit Feedback' }));

    expect(await screen.findByRole('status')).toHaveTextContent('OK (200)');
    expect(screen.getByRole('status')).toHaveTextContent('feedback-1');
    const call = callsTo('/api/ai/feedback', 'POST')[0];
    expect(JSON.parse(String(call[1]?.body))).toEqual({ query_id: 'query-42', rating: 'bad' });
  });

  it('shows an error answer as an error, with the status and the body as received', async () => {
    server.ai = () => new Response('plain text failure', { status: 500 });
    await openTester();
    fireEvent.change(document.getElementById('search-query')!, { target: { value: 'union rights' } });

    fireEvent.click(screen.getByRole('button', { name: 'Search Documents' }));

    const result = await screen.findByRole('alert');
    expect(result).toHaveTextContent('Error (500)');
    expect(result).toHaveTextContent('plain text failure');
    expect(JSON.parse(String(callsTo('/api/ai/search', 'POST')[0][1]?.body))).toEqual({ query: 'union rights', max_results: 5 });
  });

  it('shows a request that could not be made as a network error', async () => {
    await openTester();
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('connection reset');
    }));
    fireEvent.change(document.getElementById('get-feedback-query-id')!, { target: { value: 'query-42' } });

    fireEvent.click(screen.getByRole('button', { name: 'Get Feedback' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('connection reset');
  });
});

describe('AdminPage: French', () => {
  it('shows the setup hub, the failure and the empty states in French', async () => {
    server.users = () => standardSuccessResponse([]);
    renderPage('fr-CA');

    expect(await screen.findByRole('link', { name: /Liste de démarrage/ })).toHaveAttribute('href', '/fr-CA/dashboard/admin/onboarding');
    expect(screen.getByText('Taille de la base de données')).toBeInTheDocument();

    open(frCA.admin.sections.userManagement);
    expect(await screen.findByText('Aucun utilisateur trouvé')).toBeInTheDocument();
  });

  it('says the statistics could not be loaded in French, in agreement with what could not be loaded', async () => {
    server.stats = () => standardErrorResponse(ErrorCode.FORBIDDEN, 'Interdit');
    renderPage('fr-CA');

    expect(await screen.findByText('Les statistiques de la plateforme n’ont pas pu être chargées')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it('counts the memberships and organizations in French, as a plural of the count', async () => {
    renderPage('fr-CA');

    expect(await screen.findByText('7 adhésions ajoutées ou modifiées au cours des dernières 24 heures')).toBeInTheDocument();
    expect(screen.getByText('5 organisations au total')).toBeInTheDocument();
  });

  it('words the AI endpoint tester and its answers in French', async () => {
    renderPage('fr-CA');
    await screen.findByText('120');
    open(frCA.admin.sections.aiTesting);

    expect(await screen.findByRole('heading', { name: 'Test des points d’accès IA' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1. Soumettre une évaluation' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3. Rechercher des documents' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Soumettre l’évaluation' })).toBeDisabled();
    fireEvent.change(document.getElementById('feedback-query-id')!, { target: { value: 'query-42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Soumettre l’évaluation' }));

    expect(await screen.findByRole('status')).toHaveTextContent('OK (200)');
    expect(document.body.textContent).not.toMatch(/Submit Feedback|Search Query|Max Results/);
  });

  it('words a failed optimization and the database section in French', async () => {
    server.optimize = () => Response.json({ success: false }, { status: 500 });
    renderPage('fr-CA');
    await screen.findByText('120');
    open(frCA.admin.sections.database);

    expect(await screen.findByText('Connexions actives')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Optimiser la base de données' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('La base de données n’a pas pu être optimisée (HTTP 500)'));
  });
});
