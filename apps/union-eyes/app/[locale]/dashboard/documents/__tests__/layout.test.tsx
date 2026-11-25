// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const guard = vi.hoisted(() => ({ role: 'member', signedIn: true }));
vi.mock('@/lib/api-auth-guard', () => ({
  requireUser: async () => {
    if (!guard.signedIn) throw new Error('unauthenticated');
    return { userId: 'u1', organizationId: 'o1' };
  },
  getUserRole: async () => guard.role,
}));
const redirect = vi.hoisted(() => vi.fn((path: string) => { throw new Error(`redirect:${path}`); }));
vi.mock('next/navigation', () => ({ redirect }));

import DashboardDocumentsLayout from '../layout';

async function show(locale: string) {
  const view = await DashboardDocumentsLayout({ children: <p>content</p>, params: Promise.resolve({ locale }) });
  render(view);
}

beforeEach(() => { guard.role = 'member'; guard.signedIn = true; redirect.mockClear(); });
afterEach(cleanup);

describe('documents layout navigation', () => {
  it('names the member surface for a member, in the page language, with accents intact', async () => {
    await show('fr-CA');
    expect(screen.getByRole('link', { name: 'Mes documents' })).toHaveAttribute('href', '/fr-CA/dashboard/documents');
    expect(screen.queryByText(/Bibliotheque|Staff library|Bibliothèque du personnel/)).not.toBeInTheDocument();
  });

  it('keeps the staff library for staff', async () => {
    guard.role = 'steward';
    await show('fr-CA');
    expect(screen.getByRole('link', { name: 'Bibliothèque du personnel' })).toBeInTheDocument();
    cleanup();
    await show('en-CA');
    expect(screen.getByRole('link', { name: 'Staff library' })).toBeInTheDocument();
  });

  it('sends a signed-out visitor to sign in', async () => {
    guard.signedIn = false;
    await expect(show('en-CA')).rejects.toThrow('redirect:/login');
  });
});
