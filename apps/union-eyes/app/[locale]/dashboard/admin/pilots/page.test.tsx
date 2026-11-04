// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import AdminPilotApplicationsPage from './page';

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('next/navigation', () => ({ useParams: () => ({ locale: 'en-CA' }) }));
vi.mock('sonner', () => ({ toast }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

const application = {
  id: '11111111-1111-4111-8111-111111111111', organizationName: 'Synthetic Local 9', organizationType: 'local', contactName: 'Synthetic Contact',
  contactEmail: 'contact@example.test', memberCount: 120, jurisdictions: ['CA-ON'], sectors: ['education'], challenges: ['paper forms'], goals: ['one system'],
  status: 'submitted', responses: {}, submittedAt: '2026-10-22T12:00:00Z',
};

/** The collection route is a CRUD list, which withApi wraps: { success, data: { data: rows, pagination }, timestamp }. */
const serve = (list: () => { ok: boolean; status?: number; body: unknown }) =>
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/pilot/apply') {
      const answer = list();
      return { ok: answer.ok, status: answer.status ?? 200, json: async () => answer.body };
    }
    if (url.endsWith('/commercialization-timeline')) return { ok: true, status: 200, json: async () => ({ data: { events: [] } }) };
    if (url.endsWith('/artifacts')) return { ok: true, status: 200, json: async () => ({ data: { latestVersionId: null, latestDiff: null } }) };
    throw new Error(`unexpected request ${url}`);
  }));

describe('admin pilot applications queue', () => {
  it('lists the applications of the CRUD list the route answers with', async () => {
    serve(() => ({ ok: true, body: { success: true, data: { data: [application], pagination: { page: 1, totalPages: 1 } }, timestamp: '2026-10-22T12:00:00Z' } }));
    render(<AdminPilotApplicationsPage />);
    expect((await screen.findAllByText('Synthetic Local 9')).length).toBeGreaterThan(0);
    expect(screen.queryByText('No pilot applications found.')).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('says the queue could not be loaded when the answer is not a list, instead of presenting an empty queue', async () => {
    serve(() => ({ ok: true, body: { success: true, data: { rows: [] } } }));
    render(<AdminPilotApplicationsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Pilot applications could not be loaded');
    expect(screen.queryByText('No pilot applications found.')).not.toBeInTheDocument();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it('says the queue could not be loaded when the route refuses', async () => {
    serve(() => ({ ok: false, status: 403, body: { error: 'Forbidden' } }));
    render(<AdminPilotApplicationsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Pilot applications could not be loaded');
    expect(toast.error).toHaveBeenCalledWith('Failed to load applications (403)');
  });

  it('shows an empty queue as empty only when the list is empty', async () => {
    serve(() => ({ ok: true, body: { success: true, data: { data: [], pagination: { page: 1, totalPages: 0 } } } }));
    render(<AdminPilotApplicationsPage />);
    expect(await screen.findByText('No pilot applications found.')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
