// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import WorkbenchConsole from './workbench-console';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@nzila/platform-auth/entra/client', () => ({ useUser: () => ({ user: { id: 'owned-officer' } }) }));
vi.mock('@/lib/hooks/use-organization', () => ({ useOrganization: () => ({ organizationId: 'owned-org', organization: { type: 'local' } }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('workbench inline case access', () => {
  it('opens and closes existing case details by keyboard without advertising a missing route', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { claims: [{
      claimId: 'owned-case', claimNumber: 'CASE-01', organizationId: 'owned-org', memberId: 'owned-member',
      claimType: 'grievance_pay', status: 'assigned', priority: 'medium', description: 'Synthetic case summary',
      createdAt: '2026-10-22T12:00:00Z', updatedAt: '2026-10-22T12:00:00Z', resolutionNotes: 'Synthetic authorized note',
      memberName: 'Synthetic member', memberEmail: 'owned@example.test', assignedTo: 'owned-officer',
    }] } }) }));
    render(<WorkbenchConsole />);
    const expand = await screen.findByRole('button', { name: 'workbench.expand CASE-01' });
    expand.focus();
    await userEvent.keyboard('{Enter}');
    expect(expand).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(expand.getAttribute('aria-controls')!)).toHaveTextContent('Synthetic authorized note');
    expect(screen.getByRole('textbox', { name: 'workbench.addNotePlaceholder' })).toBeEnabled();
    expect(document.querySelector('a[href*="/dashboard/cases/"]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'workbench.viewLroGuidelines' })).not.toBeInTheDocument();
    await userEvent.keyboard(' ');
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(screen.queryByText('Synthetic authorized note')).not.toBeInTheDocument());
  });

  it('reports malformed data rather than presenting an empty case queue', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ unexpected: [] }) }));
    render(<WorkbenchConsole />);
    expect(await screen.findByRole('alert')).toHaveTextContent('workbench.errorLoadingCases');
    expect(screen.queryByText('workbench.empty.noCasesAssignedTitle')).not.toBeInTheDocument();
  });
});
