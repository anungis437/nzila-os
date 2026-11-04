// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import WorkbenchConsole from './workbench-console';
import frenchMessages from '../../messages/fr-CA.json';

const language = vi.hoisted(() => ({ locale: 'en-CA', messages: null as Record<string, unknown> | null }));
const translate = vi.hoisted(() => (key: string, values: Record<string, string | number> = {}) => {
  let value: unknown = language.messages;
  for (const part of key.split('.')) value = value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined;
  return typeof value === 'string' ? Object.entries(values).reduce((result, [name, replacement]) => result.replaceAll(`{${name}}`, String(replacement)), value) : key;
});
vi.mock('next-intl', () => ({ useLocale: () => language.locale, useTranslations: () => translate }));
vi.mock('@nzila/platform-auth/entra/client', () => ({ useUser: () => ({ user: { id: 'owned-officer' } }) }));
vi.mock('@/lib/hooks/use-organization', () => ({ useOrganization: () => ({ organizationId: 'owned-org', organization: { type: 'local' } }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); language.locale = 'en-CA'; language.messages = null; });

describe('workbench inline case access', () => {
  const ownedClaim = {
    claimId: 'owned-case', claimNumber: 'CASE-01', organizationId: 'owned-org', memberId: 'owned-member',
    claimType: 'grievance_pay', status: 'assigned', priority: 'medium', description: 'Synthetic case summary',
    createdAt: '2026-10-22T12:00:00Z', updatedAt: '2026-10-22T12:00:00Z',
    memberName: 'Synthetic member', memberEmail: 'owned@example.test', assignedTo: 'owned-officer',
  };
  /** The queue and the case's own notes route, as the application answers them: the case's history comes newest first, and only its entries of type "note" are notes. */
  const serve = (routes: { notes?: () => { ok: boolean; body?: unknown }; addNote?: () => { ok: boolean } } = {}) => {
    const calls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url, method });
      if (url.startsWith('/api/workbench/assigned')) return { ok: true, json: async () => ({ data: { claims: [ownedClaim] } }) };
      if (url === '/api/cases/owned-case/notes' && method === 'POST') return { ok: routes.addNote?.().ok ?? true, json: async () => ({}) };
      if (url === '/api/cases/owned-case/notes') {
        const answer = routes.notes?.() ?? { ok: true, body: { caseId: 'owned-case', notes: [
          { updateType: 'note', message: 'Synthetic second note' },
          { updateType: 'status_change', message: 'Moved to review' },
          { updateType: 'note', message: 'Synthetic authorized note' },
        ] } };
        return { ok: answer.ok, statusText: answer.ok ? 'OK' : 'Forbidden', json: async () => answer.body };
      }
      throw new Error(`unexpected request ${method} ${url}`);
    }));
    return calls;
  };

  it('opens and closes existing case details by keyboard without advertising a missing route', async () => {
    serve();
    render(<WorkbenchConsole />);
    const expand = await screen.findByRole('button', { name: 'workbench.expand CASE-01' });
    expand.focus();
    await userEvent.keyboard('{Enter}');
    expect(expand).toHaveAttribute('aria-expanded', 'true');
    const details = document.getElementById(expand.getAttribute('aria-controls')!)!;
    await waitFor(() => expect(details).toHaveTextContent('Synthetic authorized note'));
    expect(screen.getByRole('textbox', { name: 'workbench.addNotePlaceholder' })).toBeEnabled();
    expect(document.querySelector('a[href*="/dashboard/cases/"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'workbench.viewLroGuidelines' })).not.toBeInTheDocument();
    await userEvent.keyboard(' ');
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(screen.queryByText('Synthetic authorized note')).not.toBeInTheDocument());
  });

  it('reads the notes from the case, oldest first, and leaves the rest of its history out', async () => {
    const calls = serve();
    render(<WorkbenchConsole />);
    await userEvent.click(await screen.findByRole('button', { name: 'workbench.expand CASE-01' }));
    await waitFor(() => expect(screen.getByText('Synthetic authorized note')).toBeVisible());
    expect(screen.getByText('Synthetic second note')).toBeVisible();
    expect(screen.queryByText('Moved to review')).not.toBeInTheDocument();
    expect(screen.getByText('Synthetic authorized note').compareDocumentPosition(screen.getByText('Synthetic second note')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(calls.filter((call) => call.url === '/api/cases/owned-case/notes')).toEqual([{ url: '/api/cases/owned-case/notes', method: 'GET' }]);
  });

  it('says when the notes of a case could not be read, instead of showing none', async () => {
    serve({ notes: () => ({ ok: false }) });
    render(<WorkbenchConsole />);
    await userEvent.click(await screen.findByRole('button', { name: 'workbench.expand CASE-01' }));
    expect(await screen.findByText('workbench.caseNotesUnavailable')).toBeVisible();
    expect(screen.queryByText('workbench.caseNotesLoading')).not.toBeInTheDocument();
  });

  it('reads the notes again after one is added, and shows a refused note instead of swallowing it', async () => {
    let accept = true;
    const calls = serve({ addNote: () => ({ ok: accept }) });
    render(<WorkbenchConsole />);
    await userEvent.click(await screen.findByRole('button', { name: 'workbench.expand CASE-01' }));
    await waitFor(() => expect(screen.getByText('Synthetic authorized note')).toBeVisible());
    const field = screen.getByRole('textbox', { name: 'workbench.addNotePlaceholder' });

    await userEvent.type(field, 'A third note{Enter}');
    await waitFor(() => expect(calls.filter((call) => call.url === '/api/cases/owned-case/notes' && call.method === 'GET')).toHaveLength(2));
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1);
    expect(field).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    accept = false;
    await userEvent.type(field, 'A refused note{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('workbench.actionFailed');
    expect(field).toHaveValue('A refused note');
  });

  it('shows triage-only matters without contact data and offers assignment only when the server allows it', async () => {
    const triageClaim = {
      access: 'triage', claimId: 'triage-case', claimNumber: 'CASE-TR', claimType: 'grievance_pay', status: 'submitted',
      priority: 'medium', createdAt: '2026-10-22T12:00:00Z', updatedAt: '2026-10-22T12:00:00Z', assignedTo: null,
    };
    const respond = (canAssign: boolean) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true,
      json: async () => ({ data: { claims: [triageClaim], capabilities: { canAssign } } }) }));

    respond(false);
    const first = render(<WorkbenchConsole />);
    const expand = await screen.findByRole('button', { name: 'workbench.expand CASE-TR' });
    await userEvent.click(expand);
    expect(screen.getByRole('note')).toHaveTextContent('workbench.restrictedMatterNotice');
    expect(screen.queryByText('workbench.memberContact')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'workbench.addNotePlaceholder' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /workbench\.assignToMe/ })).not.toBeInTheDocument();
    first.unmount();

    respond(true);
    render(<WorkbenchConsole />);
    await userEvent.click(await screen.findByRole('button', { name: 'workbench.expand CASE-TR' }));
    expect(screen.getByRole('button', { name: /workbench\.assignToMe/ })).toBeEnabled();
    expect(screen.queryByText('workbench.memberContact')).not.toBeInTheDocument();
  });

  it('reports malformed data rather than presenting an empty case queue', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ unexpected: [] }) }));
    render(<WorkbenchConsole />);
    expect(await screen.findByRole('alert')).toHaveTextContent('workbench.errorLoadingCases');
    expect(screen.queryByText('workbench.empty.noCasesAssignedTitle')).not.toBeInTheDocument();
  });

  it('renders case types and missing-member labels from the French catalog', async () => {
    language.locale = 'fr-CA';
    language.messages = frenchMessages;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { claims: [{
      claimId: 'synthetic-fr', claimNumber: 'CASE-FR', claimType: 'grievance_pay', status: 'assigned',
      priority: 'medium', description: 'Dossier synthétique', createdAt: '2026-10-22T12:00:00Z',
      updatedAt: '2026-10-22T12:00:00Z',
    }] } }) }));
    render(<WorkbenchConsole />);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Salaire et heures' })).toBeVisible());
    expect(screen.getByText('Membre inconnu')).toBeVisible();
    expect(screen.getByText(frenchMessages.workbench.submittedOn.replace('{date}', new Date('2026-10-22T12:00:00Z').toLocaleDateString('fr-CA')))).toBeVisible();
    expect(screen.queryByText('Wage & Hour')).not.toBeInTheDocument();
  });
});
