/**
 * UE-OFFICER-EXECUTIVE-CANONICAL-2.1 — the seven frozen primary destinations.
 *
 * Each destination points at an existing route whose server-side guard is at
 * least as strict as `minRole` here (verified from source; see the disposition
 * report). Presentation never grants access: page/layout/API guards remain
 * authoritative. A destination is never added because another subsystem exists.
 *
 * Labels are English literals, consistent with the other experience menus;
 * bilingual labels are NOT_PROVEN (capability O26).
 */
import { getRoleLevel, UserRole } from '../auth/roles';
import type { NavigationItem } from '../dashboard/role-experience';
import type { ExecutiveDestinationKey } from './capability-matrix';

export interface ExecutiveDestination {
  key: ExecutiveDestinationKey;
  label: string;
  /** Plain-language purpose, per the frozen contract. */
  purpose: string;
  href: string;
  /** Minimum role at which the destination's own server guard admits a caller. */
  minRole: UserRole;
}

export const EXECUTIVE_DESTINATIONS: readonly ExecutiveDestination[] = [
  {
    key: 'today',
    label: 'Today',
    purpose: 'Decisions, priorities, obligations and exceptions',
    href: '/dashboard/executive',
    minRole: UserRole.OFFICER,
  },
  {
    key: 'members-service',
    label: 'Members & Service',
    purpose: 'Representation outcomes and service accountability',
    href: '/dashboard/leadership',
    minRole: UserRole.OFFICER,
  },
  {
    key: 'governance-organization',
    label: 'Governance & Organization',
    purpose: 'Institutional decisions, offices, bylaws and committees',
    href: '/dashboard/governance',
    minRole: UserRole.OFFICER,
  },
  {
    key: 'bargaining-collective-action',
    label: 'Bargaining & Collective Action',
    purpose: 'Mandates, agreements, consultation and mobilization',
    href: '/dashboard/bargaining',
    minRole: UserRole.OFFICER,
  },
  {
    key: 'finance-resources',
    label: 'Finance & Resources',
    purpose: 'Budgets, dues, funds and delegated approvals',
    href: '/dashboard/finance',
    // A general officer does not inherit financial visibility from seniority.
    minRole: UserRole.SECRETARY_TREASURER,
  },
  {
    key: 'communications-relations',
    label: 'Communications & Relations',
    purpose: 'Members, employers, affiliates and partners',
    href: '/dashboard/correspondence',
    minRole: UserRole.OFFICER,
  },
  {
    key: 'continuity-intelligence',
    label: 'Continuity & Intelligence',
    purpose: 'Institutional memory, resilience, reporting and succession',
    href: '/dashboard/continuity-intelligence',
    minRole: UserRole.OFFICER,
  },
];

export const EXECUTIVE_HOME_HREF = EXECUTIVE_DESTINATIONS[0].href;

const NAV_GROUP = 'Executive';

/** Primary navigation: exactly the seven destinations, plus the secondary account control. */
export function getExecutiveNavigation(): NavigationItem[] {
  return [
    ...EXECUTIVE_DESTINATIONS.map((d) => ({ label: d.label, href: d.href, group: NAV_GROUP })),
    // Account controls are secondary, not a destination (contract §II).
    { label: 'Profile & Settings', href: '/dashboard/settings', group: 'Settings' },
  ];
}

/** Hrefs whose visibility depends on more than the experience: pathname -> minimum role. */
export const EXECUTIVE_DESTINATION_MIN_ROLE: Readonly<Record<string, UserRole>> = Object.fromEntries(
  EXECUTIVE_DESTINATIONS.map((d) => [d.href, d.minRole]),
);

export function meetsExecutiveDestinationRole(pathname: string, role: string): boolean {
  const min = EXECUTIVE_DESTINATION_MIN_ROLE[pathname];
  if (!min) return true;
  return getRoleLevel(role as UserRole) >= getRoleLevel(min);
}

/**
 * Dashboard prefixes an executive may reach. Deliberately omits platform
 * operations and the casework console/queue; officers reach member-service
 * information through aggregates, not through the representative workbench.
 * The prefixes behind the seven destinations come first, then preserved
 * non-advertised routes that still resolve (kept reachable by deep link).
 */
export const EXECUTIVE_ALLOWED_PREFIXES: readonly string[] = [
  '/dashboard',
  ...EXECUTIVE_DESTINATIONS.map((d) => d.href),
  '/dashboard/priorities',
  '/dashboard/committees',
  '/dashboard/intelligence',
  '/dashboard/executive-operating-intelligence',
  '/dashboard/governance-center',
  '/dashboard/outcomes',
  '/dashboard/trust',
  '/dashboard/settings',
  '/dashboard/profile',
];
