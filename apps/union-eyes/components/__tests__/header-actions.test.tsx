// @vitest-environment jsdom
// The header's actions: the sign-out button, and the bell for the people who have an inbox page to be sent to. The dashboard admits each role to some pages
// only (lib/dashboard/role-experience.ts), so the bell's destination is read from that policy: a role that would be sent away from the inbox gets no bell.
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({ useLocale: () => 'en-CA' }));
vi.mock('@nzila/platform-auth/entra/client', () => ({ useAuthActions: () => ({ signOut: vi.fn() }) }));
vi.mock('@/components/notifications/notification-bell', async () => {
  const React = await import('react');
  return { NotificationBell: ({ path }: { path: string }) => React.createElement('a', { 'data-testid': 'bell', href: path }, 'bell') };
});

import { HeaderActions } from '../header-actions';

afterEach(cleanup);

describe('HeaderActions: the bell', () => {
  it.each([
    ['steward', '/dashboard/notifications'],
    ['chief_steward', '/dashboard/notifications'],
    ['clerk', '/dashboard/notifications'],
    ['member', '/dashboard'],
  ])('leads a %s to %s', (role, path) => {
    render(<HeaderActions userRole={role} />);

    expect(screen.getByTestId('bell')).toHaveAttribute('href', path);
  });

  it('leads a person whose role is not known to the member Home, as the dashboard treats them as a member', () => {
    render(<HeaderActions userRole={null} />);

    expect(screen.getByTestId('bell')).toHaveAttribute('href', '/dashboard');
  });

  it.each(['admin', 'system_admin', 'president', 'officer', 'compliance_manager'])('draws no bell for %s, whose pages do not include an inbox', (role) => {
    render(<HeaderActions userRole={role} />);

    expect(screen.queryByTestId('bell')).not.toBeInTheDocument();
  });

  it('keeps the sign-out button whether or not the bell is drawn', () => {
    const { rerender } = render(<HeaderActions userRole="steward" />);
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();

    rerender(<HeaderActions userRole="admin" />);
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});
