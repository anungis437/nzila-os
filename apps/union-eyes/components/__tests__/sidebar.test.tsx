import messages from '../../messages/en-CA.json';
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {
  INTELLIGENCE_NOT_WORKSPACE_TAB_NOTE,
  ROLE_EXECUTION_CHROME_LABEL,
  ROLE_EXECUTION_DESTINATIONS_LABEL,
  ROLE_HOME_HUB_CUE_LINK_LABEL,
  ROLE_HOME_HUB_CUE_MESSAGE,
} from '@/lib/dashboard/dual-nav-honesty';
import Sidebar from '../sidebar';
import { DashboardNavigationProvider, DashboardMenuTrigger } from '@/components/dashboard/navigation-context';

const mockUsePilotMode = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/en-CA/dashboard/workspace',
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en-CA',
  useTranslations: () => (key: string) => messages.experienceNavigation[key as keyof typeof messages.experienceNavigation],
}));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
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

beforeEach(() => {
  mockUsePilotMode.mockReturnValue({ isPilotMode: false });
});

function renderSidebar(userRole: string) {
  return render(
    <DashboardNavigationProvider><DashboardMenuTrigger /><Sidebar
      profile={null}
      whopMonthlyPlanId="m"
      whopYearlyPlanId="y"
      userRole={userRole}
    /></DashboardNavigationProvider>,
  );
}

function linksNamed(name: string) {
  return screen.getAllByRole('link', {
    name: (accessibleName) => accessibleName === name,
  });
}

function expectNoUndifferentiatedPrimary() {
  expect(document.querySelector('[aria-label="Primary"]')).toBeNull();
  expect(document.querySelector('[aria-label="Primary navigation"]')).toBeNull();
  expect(
    screen.queryByRole('navigation', { name: (accessibleName) => accessibleName === 'Primary' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('complementary', {
      name: (accessibleName) => accessibleName === 'Primary navigation',
    }),
  ).not.toBeInTheDocument();
}

describe('Sidebar', () => {
  it('connects each group control to exactly one group in desktop and drawer navigation', () => {
    mockUsePilotMode.mockReturnValue({ isPilotMode: false });
    renderSidebar('officer');
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const controls = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-controls^="nav-group-"]'));
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      const id = control.getAttribute('aria-controls')!;
      expect(id).not.toMatch(/\s/);
      const group = document.getElementById(id);
      expect(group).not.toBeNull();
      expect(Array.from(document.querySelectorAll('[id]')).filter(element => element.id === id)).toHaveLength(1);
    }
  });
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

describe('Sidebar dual-nav honesty', () => {
  it('qualifies staff landmarks and labels Workspace as the orientation hub', () => {
    renderSidebar('steward');

    expect(
      screen.getByRole('complementary', { name: ROLE_EXECUTION_CHROME_LABEL }),
    ).toHaveAttribute('data-nav-surface', 'desktop');
    expect(
      screen.getByRole('navigation', { name: ROLE_EXECUTION_DESTINATIONS_LABEL }),
    ).toHaveAttribute('data-nav-role', 'legacy-side');
    expectNoUndifferentiatedPrimary();

    const hub = linksNamed('Workspace, orientation hub');
    expect(hub).toHaveLength(1);
    expect(hub[0]).toHaveAttribute('data-nav-role', 'hub');
    expect(hub[0]).toHaveAttribute('href', '/en-CA/dashboard/workspace');
    const desktop = screen.getByRole('complementary', { name: ROLE_EXECUTION_CHROME_LABEL });
    expect(within(desktop).getByText('Orientation hub')).toBeInTheDocument();

    const roleHome = linksNamed('Operations (Casework Console), role execution home');
    expect(roleHome).toHaveLength(1);
    expect(roleHome[0]).toHaveAttribute('data-nav-role', 'role-home');
    expect(roleHome[0]).toHaveAttribute('href', '/en-CA/dashboard/workbench');

    expect(within(desktop).getByText(ROLE_HOME_HUB_CUE_MESSAGE)).toBeInTheDocument();
    const cue = linksNamed(ROLE_HOME_HUB_CUE_LINK_LABEL);
    expect(cue).toHaveLength(1);
    expect(cue[0].tagName).toBe('A');
    expect(cue[0]).toHaveAttribute('href', '/en-CA/dashboard/workspace');

    const intelligence = linksNamed('Institutional Intelligence Reports, not a Workspace tab');
    expect(intelligence[0]).toHaveAttribute('data-nav-role', 'legacy-side');
    expect(screen.queryByText(INTELLIGENCE_NOT_WORKSPACE_TAB_NOTE)).not.toBeInTheDocument();
  });

  it('keeps staff honesty in the collapsed sidebar and the mobile drawer', () => {
    renderSidebar('chief_steward');

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    const collapsedHub = linksNamed('Workspace, orientation hub').find((link) =>
      link.getAttribute('title'),
    );
    expect(collapsedHub).toHaveAttribute('aria-label', 'Workspace, orientation hub');
    expect(collapsedHub).toHaveAttribute('title', 'Workspace — Orientation hub');
    const collapsedCue = linksNamed(ROLE_HOME_HUB_CUE_LINK_LABEL).find((link) =>
      link.getAttribute('title'),
    );
    expect(collapsedCue).toHaveAttribute('aria-label', ROLE_HOME_HUB_CUE_LINK_LABEL);

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    expect(screen.getByRole('dialog', { name: ROLE_EXECUTION_CHROME_LABEL })).toHaveAttribute(
      'data-nav-surface',
      'drawer',
    );
    expect(
      screen.getAllByRole('navigation', { name: ROLE_EXECUTION_DESTINATIONS_LABEL }),
    ).toHaveLength(1);
    expect(screen.getAllByText('Orientation hub').length).toBeGreaterThanOrEqual(1);
    expectNoUndifferentiatedPrimary();
  });

  it('labels executive Intelligence as the role execution home and not a Workspace tab', () => {
    renderSidebar('president');

    expectNoUndifferentiatedPrimary();
    const desktop = screen.getByRole('complementary', { name: ROLE_EXECUTION_CHROME_LABEL });
    expect(within(desktop).getByText(INTELLIGENCE_NOT_WORKSPACE_TAB_NOTE)).toBeInTheDocument();

    const hub = linksNamed('Workspace, orientation hub');
    expect(hub[0]).toHaveAttribute('data-nav-role', 'hub');
    expect(hub[0]).toHaveAttribute('href', '/en-CA/dashboard/workspace');

    const roleHome = linksNamed(
      'Institutional Intelligence Reports, role execution home. Not a Workspace tab.',
    );
    expect(roleHome[0]).toHaveAttribute('data-nav-role', 'role-home');
    expect(roleHome[0]).toHaveAttribute('href', '/en-CA/dashboard/intelligence');

    const overview = linksNamed('OCRA Intelligence (Executive Overview), not a Workspace tab');
    expect(overview[0]).toHaveAttribute('data-nav-role', 'legacy-side');
    expect(overview[0]).toHaveAttribute('href', '/en-CA/dashboard/intelligence?scope=executive');

    expect(linksNamed(ROLE_HOME_HUB_CUE_LINK_LABEL)[0]).toHaveAttribute(
      'href',
      '/en-CA/dashboard/workspace',
    );
  });

  it('labels governance and admin role homes without sending them to the hub', () => {
    renderSidebar('officer');
    const governanceHome = linksNamed('Governance Continuity Overview, role execution home');
    expect(governanceHome[0]).toHaveAttribute('data-nav-role', 'role-home');
    expect(governanceHome[0]).toHaveAttribute('href', '/en-CA/dashboard/governance');
    expect(linksNamed('Workspace, orientation hub')[0]).toHaveAttribute('data-nav-role', 'hub');
    const governanceDesktop = screen.getByRole('complementary', { name: ROLE_EXECUTION_CHROME_LABEL });
    expect(within(governanceDesktop).getByText(ROLE_HOME_HUB_CUE_MESSAGE)).toBeInTheDocument();
    expect(within(governanceDesktop).queryByText(INTELLIGENCE_NOT_WORKSPACE_TAB_NOTE)).not.toBeInTheDocument();
    expectNoUndifferentiatedPrimary();

    cleanup();
    renderSidebar('system_admin');
    const adminHome = linksNamed('Organization, role execution home');
    expect(adminHome[0]).toHaveAttribute('data-nav-role', 'role-home');
    expect(adminHome[0]).toHaveAttribute('href', '/en-CA/dashboard/admin/organizations');
    expect(linksNamed(ROLE_HOME_HUB_CUE_LINK_LABEL)[0]).toHaveAttribute(
      'href',
      '/en-CA/dashboard/workspace',
    );
    expectNoUndifferentiatedPrimary();
  });

  it('treats the member Workspace entry as both orientation hub and role home', () => {
    renderSidebar('member');

    const hub = linksNamed('Workspace, orientation hub and role home');
    expect(hub[0]).toHaveAttribute('data-nav-role', 'hub');
    expect(hub[0]).toHaveAttribute('href', '/en-CA/dashboard/workspace');
    expect(
      within(screen.getByRole('complementary', { name: ROLE_EXECUTION_CHROME_LABEL })).getByText(
        'Orientation hub and role home',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(ROLE_HOME_HUB_CUE_MESSAGE)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', {
        name: (accessibleName) => accessibleName === ROLE_HOME_HUB_CUE_LINK_LABEL,
      }),
    ).not.toBeInTheDocument();
    expectNoUndifferentiatedPrimary();
  });
});
