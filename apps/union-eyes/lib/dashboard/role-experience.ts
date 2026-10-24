import { getRoleLevel, UserRole } from '../auth/roles';
import {
  EXECUTIVE_ALLOWED_PREFIXES,
  EXECUTIVE_HOME_HREF,
  getExecutiveNavigation,
  meetsExecutiveDestinationRole,
} from '../executive/executive-navigation';

export type DashboardExperience = 'member' | 'staff' | 'executive' | 'governance' | 'admin';

export type NavigationItem = {
  label: string;
  href: string;
  icon?: 'dashboard' | 'cases' | 'grievances' | 'members' | 'agreements' | 'calendar' | 'reports' | 'documents' | 'inbox' | 'priorities' | 'communications' | 'governance';
  group?: string;
};

export type NavigationGroup = {
  key: string;
  label: string;
};

const ADMIN_ROLES = new Set([
  'app_owner',
  'system_admin',
  'admin',
  'platform_lead',
  'integration_manager',
  'billing_manager',
  'data_analytics_manager',
]);

const GOVERNANCE_ROLES = new Set([
  'governance',
  'compliance_manager',
  'security_manager',
  'clc_executive',
  'fed_executive',
]);

const EXECUTIVE_ROLES = new Set([
  'app_owner',
  'coo',
  'cto',
  'customer_success_director',
  'president',
  'vice_president',
  'secretary_treasurer',
  'officer',
  'national_officer',
]);

const STAFF_ROLES = new Set([
  'steward',
  'chief_steward',
  'bargaining_committee',
  'health_safety_rep',
  'clerk',
  'support_manager',
  'support_agent',
  'data_analyst',
  'billing_specialist',
  'integration_specialist',
  'content_manager',
  'training_coordinator',
  'clc_staff',
  'fed_staff',
  'congress_staff',
  'federation_staff',
]);

// This is the operational Union Eyes application. It intentionally contains no
// customer-specific demo modes, personas, navigation, or route sets. The demo
// experience lives in the sibling `@nzila/union-eyes-demo` package. There is no
// runtime env-var flag that flips the operational app into a demo mode; the
// operational app rejects any such attempt at env-validation time.
//
// See docs/union-eyes/reality-remediation/23_WAVE_0_CORRECTION.md.

export function getDashboardExperience(role?: string | null): DashboardExperience {
  const normalized = (role ?? 'member').toLowerCase();

  if (ADMIN_ROLES.has(normalized)) return 'admin';
  if (GOVERNANCE_ROLES.has(normalized)) return 'governance';
  if (EXECUTIVE_ROLES.has(normalized)) return 'executive';
  if (STAFF_ROLES.has(normalized)) return 'staff';
  return 'member';
}

/**
 * Doctrine orientation hub (Club360 seven-tab Workspace).
 * This is not the post-login role execution home for any role. Members do not
 * have the hub at all: they start at their own Home (/dashboard) and the hub is not in their
 * navigation or allow-list.
 */
export const WORKSPACE_ORIENTATION_HUB_PATH = '/dashboard/workspace' as const;

/**
 * Role execution homes — the routes `getRoleLandingPath` returns.
 * Staff, executive, governance, and admin land off the Workspace hub on
 * purpose. Do not silently rewrite these to the hub (that redirect belongs to
 * G-04, which is out of this slice). Members start at their own Home.
 */
export const ROLE_EXECUTION_HOME_BY_EXPERIENCE = {
  member: '/dashboard',
  staff: '/dashboard/workbench',
  executive: EXECUTIVE_HOME_HREF,
  governance: '/dashboard/governance',
  admin: '/dashboard/admin/organizations',
} as const satisfies Record<DashboardExperience, string>;

export type DualNavHomes = {
  experience: DashboardExperience;
  /** Post-login role execution home. Same string `getRoleLandingPath` returns. */
  roleHomeHref: string;
  /** Workspace orientation hub. Always `/dashboard/workspace`. */
  orientationHubHref: typeof WORKSPACE_ORIENTATION_HUB_PATH;
  /** Always false now that members no longer land on the hub; kept for consumers. */
  roleHomeIsOrientationHub: boolean;
};

/**
 * Honesty metadata for UI. Does not change landing targets or allow-lists.
 * Sidebar copy should read `roleHomeHref` as the role execution home and
 * `orientationHubHref` as the orientation hub — never as two undifferentiated
 * primaries.
 */
export function getDualNavHomes(role?: string | null): DualNavHomes {
  const experience = getDashboardExperience(role);
  const roleHomeHref = ROLE_EXECUTION_HOME_BY_EXPERIENCE[experience];
  return {
    experience,
    roleHomeHref,
    orientationHubHref: WORKSPACE_ORIENTATION_HUB_PATH,
    roleHomeIsOrientationHub: false,
  };
}

export function getRoleLandingPath(role?: string | null): string {
  // Role execution home. Not rewritten to the Workspace orientation hub.
  // The sidebar highlights the nav item whose href matches this path.
  return ROLE_EXECUTION_HOME_BY_EXPERIENCE[getDashboardExperience(role)];
}

export function getNavigationForExperience(experience: DashboardExperience): NavigationItem[] {
  if (experience === 'member') {
    return [
      { label: 'Home', href: '/dashboard' },
      { label: 'My Representation', href: '/dashboard/claims' },
      { label: 'Messages', href: '/dashboard/messages' },
      { label: 'My Documents', href: '/dashboard/documents' },
      { label: 'My Union', href: '/dashboard/union' },
      { label: 'Help & Resources', href: '/dashboard/help' },
      // Account controls are not primary destinations (UE-MEMBER-CANONICAL-2.1).
      { label: 'Profile', href: '/dashboard/profile', group: 'Account' },
      { label: 'Preferences', href: '/dashboard/preferences', group: 'Account' },
      { label: 'Privacy', href: '/dashboard/privacy', group: 'Account' },
    ];
  }

  if (experience === 'staff') {
    // UE-REPRESENTATIVE-CANONICAL-2.2: seven invariant destinations. Each maps to an existing
    // route; legacy routes (notifications, intake queue, workspace hub) stay reachable by deep link.
    return [
      { label: 'Today', href: '/dashboard/inbox', group: 'Operations' },
      { label: 'Representation', href: '/dashboard/workbench', group: 'Operations' },
      { label: 'Members & Workplaces', href: '/dashboard/members', group: 'Operations' },
      { label: 'Communications', href: '/dashboard/correspondence', group: 'Operations' },
      { label: 'Documents & Evidence', href: '/dashboard/documents', group: 'Operations' },
      { label: 'Tasks & Deadlines', href: '/dashboard/priorities', group: 'Operations' },
      { label: 'Knowledge & Guidance', href: '/dashboard/clause-library', group: 'Operations' },
      { label: 'Profile & Settings', href: '/dashboard/settings', group: 'Settings' },
    ];
  }

  if (experience === 'executive') {
    // UE-OFFICER-EXECUTIVE-CANONICAL-2.1: exactly seven destinations (lib/executive).
    return getExecutiveNavigation();
  }

  if (experience === 'governance') {
    return [
      { label: 'Workspace', href: '/dashboard/workspace', icon: 'dashboard', group: 'Workspace' },
      { label: 'Governance Continuity Overview', href: '/dashboard/governance', group: 'Governance Continuity' },
      { label: 'Governance Trust & Explainability', href: '/dashboard/trust', group: 'Governance Continuity' },
      { label: 'Governance Continuity Review', href: '/dashboard/workbench', group: 'Governance Continuity' },
      { label: 'OCRA Continuity Signals', href: '/dashboard/continuity-intelligence', group: 'OCRA' },
      { label: 'Institutional Intelligence Reports', href: '/dashboard/intelligence', group: 'Operations' },
      { label: 'Governance Audit & Evidence', href: '/dashboard/audits', group: 'Governance Continuity' },
      { label: 'Profile & Settings', href: '/dashboard/settings', group: 'Settings' },
    ];
  }

  return [
    { label: 'Workspace', href: '/dashboard/workspace', icon: 'dashboard' },
    { label: 'Organization', href: '/dashboard/admin/organizations' },
    { label: 'Users & Roles', href: '/dashboard/admin/members' },
    { label: 'Pilot Configuration', href: '/dashboard/admin/onboarding' },
    { label: 'Policies', href: '/dashboard/governance' },
    { label: 'Audit', href: '/dashboard/audits' },
    { label: 'Security', href: '/dashboard/security' },
    { label: 'Exports', href: '/dashboard/movement-insights/export' },
    { label: 'Integrations', href: '/dashboard/integrations' },
    { label: 'System Status', href: '/dashboard/operations' },
  ];
}

const ALLOWED_PREFIXES_BY_EXPERIENCE: Record<DashboardExperience, string[]> = {
  member: [
    '/dashboard',
    '/dashboard/claims',
    '/dashboard/claims/new',
    '/dashboard/documents',
    '/dashboard/messages',
    '/dashboard/union',
    '/dashboard/help',
    '/dashboard/settings',
    '/dashboard/profile',
    '/dashboard/preferences',
    '/dashboard/privacy',
  ],
  staff: [
    '/dashboard',
    '/dashboard/workspace',
    '/dashboard/workbench',
    '/dashboard/priorities',
    '/dashboard/operations',
    '/dashboard/inbox',
    '/dashboard/intelligence',
    '/dashboard/members',
    '/dashboard/documents',
    '/dashboard/correspondence',
    '/dashboard/clause-library',
    '/dashboard/notifications',
    '/dashboard/settings',
    '/dashboard/profile',
  ],
  executive: [...EXECUTIVE_ALLOWED_PREFIXES],
  governance: [
    '/dashboard',
    '/dashboard/workspace',
    '/dashboard/governance',
    '/dashboard/trust',
    '/dashboard/workbench',
    '/dashboard/continuity-intelligence',
    '/dashboard/intelligence',
    '/dashboard/audits',
    '/dashboard/settings',
    '/dashboard/profile',
  ],
  admin: [
    '/dashboard',
    '/dashboard/workspace',
    '/dashboard/admin',
    '/dashboard/admin/organizations',
    '/dashboard/admin/members',
    '/dashboard/admin/onboarding',
    '/dashboard/governance',
    '/dashboard/audits',
    '/dashboard/security',
    '/dashboard/movement-insights/export',
    '/dashboard/integrations',
    '/dashboard/operations',
    '/dashboard/settings',
    '/dashboard/profile',
  ],
};

const PILOT_EXCLUDED_PREFIXES = [
  '/dashboard/ai-assistant',
  '/dashboard/analytics',
  '/dashboard/analytics-admin',
  '/dashboard/cognition',
  '/dashboard/executive-operating-intelligence',
  '/dashboard/executive-intelligence',
  '/dashboard/organizational-intelligence',
  '/dashboard/organizational-operating-intelligence',
  '/dashboard/longitudinal-cognition',
  '/dashboard/continuity-simulation',
  '/dashboard/movement-insights',
  '/dashboard/sector-analytics',
  '/dashboard/cross-union-analytics',
  '/dashboard/data-source',
  '/dashboard/admin/ai-usage',
] as const;

export function getAllowedPrefixesByExperience(): Record<DashboardExperience, string[]> {
  return ALLOWED_PREFIXES_BY_EXPERIENCE;
}

export function canAccessDashboardPath(pathname: string, experience: DashboardExperience, isPilotMode: boolean): boolean {
  const allowedPrefixes = ALLOWED_PREFIXES_BY_EXPERIENCE[experience];
  const isAllowed = allowedPrefixes.some((prefix) => {
    if (prefix === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });

  if (!isAllowed) return false;

  if (!isPilotMode) return true;

  // Hard pilot gating: block advanced/experimental surfaces even if route exists.
  const isExcluded = PILOT_EXCLUDED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  return !isExcluded;
}

// These destinations have stricter server guards than their enclosing experience.
// Presentation never grants access: their page/layout guards remain authoritative.
const PLATFORM_LEAD_ROLES = ['app_owner', 'coo', 'cto', 'platform_lead'];
const SUPPORT_MANAGER_ROLES = [...PLATFORM_LEAD_ROLES, 'customer_success_director', 'support_manager'];
const INTEGRATION_MANAGER_ROLES = [...SUPPORT_MANAGER_ROLES, 'data_analytics_manager', 'billing_manager', 'integration_manager'];
const PLATFORM_NAVIGATION_ROLES: Record<string, readonly string[]> = {
  '/dashboard/operations': PLATFORM_LEAD_ROLES,
  '/dashboard/admin/members': SUPPORT_MANAGER_ROLES,
  '/dashboard/integrations': INTEGRATION_MANAGER_ROLES,
  '/dashboard/security': [...INTEGRATION_MANAGER_ROLES, 'compliance_manager', 'security_manager'],
};

/**
 * Single source of truth for which navigation entries are actually visible.
 * Navigation availability and route authorization must be derived from the
 * same policy — this filters `getNavigationForExperience()` through
 * `canAccessDashboardPath()` so a nav item is never shown for a route the
 * user could not actually open. Consumed by both the desktop sidebar and the
 * mobile bottom nav so they cannot diverge.
 */
export function getVisibleNavigationForExperience(
  experience: DashboardExperience,
  isPilotMode: boolean,
  userRole?: string,
): NavigationItem[] {
  const role = userRole ?? ({ member: 'member', staff: 'steward', executive: 'president', governance: 'officer', admin: 'admin' } as const)[experience];
  return getNavigationForExperience(experience).filter((item) => {
    const pathname = item.href.split('?')[0];
    const platformRoles = PLATFORM_NAVIGATION_ROLES[pathname];
    if (platformRoles && !platformRoles.includes(role)) return false;
    if (experience === 'executive' && !meetsExecutiveDestinationRole(pathname, role)) return false;
    if (pathname === '/dashboard/audits' && getRoleLevel(role as UserRole) < getRoleLevel(UserRole.ADMIN)) return false;
    // The clause library page redirects below steward; do not advertise it to those roles.
    if (pathname === '/dashboard/clause-library' && getRoleLevel(role as UserRole) < getRoleLevel(UserRole.STEWARD)) return false;
    return canAccessDashboardPath(pathname, experience, isPilotMode);
  });
}

