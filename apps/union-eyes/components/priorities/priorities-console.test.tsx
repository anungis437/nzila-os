// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { PrioritiesConsole } from './priorities-console';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams() }));
vi.mock('next-intl', () => ({ useLocale: () => 'en-CA', useTranslations: () => (key: string) => key }));
vi.mock('@/contexts/pilot-mode-context', () => ({ usePilotMode: () => ({ isPilotMode: true }) }));
vi.mock('@/components/onboarding/action-hint', () => ({ ActionHint: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('priorities response and navigation truth', () => {
  it('reads the actual data envelope and offers staff their permitted work area', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ claimId: 'owned-case', description: 'Owned case requiring review', claimType: 'grievance_pay' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }));
    render(<PrioritiesConsole role="steward" />);
    expect(await screen.findByText(/Owned case requiring review/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Open my work area' }));
    expect(push).toHaveBeenCalledWith('/en-CA/dashboard/workbench');
  });

  it('does not claim an empty successful state when one source fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({ ok: false, status: 403 }));
    render(<PrioritiesConsole role="steward" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be loaded');
    expect(screen.queryByText('Nothing urgent right now')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
  });

  it('reports malformed successful responses instead of inventing zero priorities', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ unexpected: [] }) }));
    render(<PrioritiesConsole role="steward" />);
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByText('Nothing urgent right now')).not.toBeInTheDocument();
  });
});
