// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Sidebar from '../sidebar';

const mockUsePilotMode = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/en-CA/dashboard/workspace',
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en-CA',
}));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@nzila/platform-auth/entra/client', () => ({
  UserButton: () => null,
}));
vi.mock('@/contexts/organization-context', () => ({
  useOrganization: () => ({ organization: null }),
}));
vi.mock('@/contexts/pilot-mode-context', () => ({
  usePilotMode: () => mockUsePilotMode(),
}));

afterEach(() => {
  cleanup();
});

describe('Sidebar', () => {
  it('shows Operations Continuity for an executive outside pilot mode', () => {
    mockUsePilotMode.mockReturnValue({ isPilotMode: false });
    render(
      <Sidebar
        profile={null}
        whopMonthlyPlanId="m"
        whopYearlyPlanId="y"
        userRole="president"
      />,
    );
    expect(screen.getAllByText('Operations Continuity').length).toBeGreaterThan(0);
  });

  it('hides Operations Continuity for an executive in pilot mode', () => {
    mockUsePilotMode.mockReturnValue({ isPilotMode: true });
    render(
      <Sidebar
        profile={null}
        whopMonthlyPlanId="m"
        whopYearlyPlanId="y"
        userRole="president"
      />,
    );
    expect(screen.queryAllByText('Operations Continuity')).toHaveLength(0);
  });

  it('still shows other executive nav entries in pilot mode', () => {
    mockUsePilotMode.mockReturnValue({ isPilotMode: true });
    render(
      <Sidebar
        profile={null}
        whopMonthlyPlanId="m"
        whopYearlyPlanId="y"
        userRole="president"
      />,
    );
    expect(screen.getAllByText('Governance Continuity').length).toBeGreaterThan(0);
  });
});
