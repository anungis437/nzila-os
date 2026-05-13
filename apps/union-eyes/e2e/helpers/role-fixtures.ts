import { UE_TEST_USERS } from '../../tests/fixtures/test-users';
import {
  getDashboardExperience,
  getNavigationForExperience,
  getRoleLandingPath,
  type DashboardExperience,
} from '../../lib/dashboard/role-experience';

export type StakeholderRole =
  | 'member'
  | 'steward'
  | 'staff'
  | 'executive'
  | 'governance'
  | 'admin';

export type StakeholderFixture = {
  key: StakeholderRole;
  userRole: string;
  userId: string;
  orgId: string;
  email: string;
  locale: 'en-CA';
  expectedExperience: DashboardExperience;
};

export const STAKEHOLDER_FIXTURES: Record<StakeholderRole, StakeholderFixture> = {
  member: {
    key: 'member',
    userRole: 'member',
    userId: UE_TEST_USERS.memberPrimary.userId,
    orgId: UE_TEST_USERS.memberPrimary.orgId,
    email: UE_TEST_USERS.memberPrimary.email,
    locale: 'en-CA',
    expectedExperience: 'member',
  },
  steward: {
    key: 'steward',
    userRole: 'steward',
    userId: UE_TEST_USERS.stewardPrimary.userId,
    orgId: UE_TEST_USERS.stewardPrimary.orgId,
    email: UE_TEST_USERS.stewardPrimary.email,
    locale: 'en-CA',
    expectedExperience: 'staff',
  },
  staff: {
    key: 'staff',
    userRole: 'support_agent',
    userId: UE_TEST_USERS.staffPrimary.userId,
    orgId: UE_TEST_USERS.staffPrimary.orgId,
    email: UE_TEST_USERS.staffPrimary.email,
    locale: 'en-CA',
    expectedExperience: 'staff',
  },
  executive: {
    key: 'executive',
    userRole: 'president',
    userId: UE_TEST_USERS.executivePrimary.userId,
    orgId: UE_TEST_USERS.executivePrimary.orgId,
    email: UE_TEST_USERS.executivePrimary.email,
    locale: 'en-CA',
    expectedExperience: 'executive',
  },
  governance: {
    key: 'governance',
    userRole: 'compliance_manager',
    userId: UE_TEST_USERS.auditorReadOnly.userId,
    orgId: UE_TEST_USERS.auditorReadOnly.orgId,
    email: UE_TEST_USERS.auditorReadOnly.email,
    locale: 'en-CA',
    expectedExperience: 'governance',
  },
  admin: {
    key: 'admin',
    userRole: 'admin',
    userId: UE_TEST_USERS.adminPrimary.userId,
    orgId: UE_TEST_USERS.adminPrimary.orgId,
    email: UE_TEST_USERS.adminPrimary.email,
    locale: 'en-CA',
    expectedExperience: 'admin',
  },
};

export const STAKEHOLDER_ORDER: StakeholderRole[] = [
  'member',
  'steward',
  'staff',
  'executive',
  'governance',
  'admin',
];

// These labels intentionally validate the user-facing IA contract.
export const REQUIRED_VISIBLE_LABELS: Record<StakeholderRole, string[]> = {
  member: [
    'Home',
    'My Cases',
    'Open Representation Case',
    'Messages',
    'Documents',
    'Profile & Settings',
    'Help & Support',
  ],
  steward: [
    'Casework Console',
    'Representation Cases',
    'Commitments & Deadlines',
    'Members',
    'Documents',
    'Communications',
    'Institutional Reports',
    'Notifications',
    'Profile & Settings',
  ],
  staff: [
    'Casework Console',
    'Representation Cases',
    'Commitments & Deadlines',
    'Members',
    'Documents',
    'Communications',
    'Institutional Reports',
    'Notifications',
    'Profile & Settings',
  ],
  executive: [
    'Executive Overview',
    'Continuity Insights',
    'Continuity Operations',
    'Governance Visibility',
    'Member Outcomes Ledger',
    'Leadership Continuity',
    'Reports',
    'Trust & Oversight',
    'Profile & Settings',
  ],
  governance: [
    'Governance Overview',
    'Trust & Explainability',
    'Operational Review',
    'Policy Alignment',
    'Continuity Signals',
    'Audit & Evidence',
    'Reports',
    'Profile & Settings',
  ],
  admin: [
    'Organization',
    'Users & Roles',
    'Pilot Configuration',
    'Policies',
    'Audit',
    'Security',
    'Exports',
    'Integrations',
    'System Status',
  ],
};

export const FORBIDDEN_LABELS: Record<StakeholderRole, string[]> = {
  member: [
    'Continuity Insights',
    'Governance Visibility',
    'FSM',
    'Workflow Builder',
    'System Status',
    'Continuity Operations',
    'Member Outcomes Ledger',
  ],
  steward: [
    'Executive Overview',
    'Leadership Continuity',
    'Raw FSM',
    'Workflow Builder',
    'System Status',
  ],
  staff: [
    'Executive Overview',
    'Leadership Continuity',
    'Raw FSM',
    'Workflow Builder',
    'System Status',
  ],
  executive: [
    'Raw FSM',
    'Workflow Builder',
    'System Status',
    'Pilot Configuration',
  ],
  governance: [
    'Raw FSM',
    'Workflow Builder',
    'System Status',
    'Open Representation Case',
  ],
  admin: [
    'Open Representation Case',
    'Raw FSM',
    'Workflow Builder',
  ],
};

export const PILOT_EXCLUDED_ROUTES = [
  '/dashboard/workflow-builder',
  '/dashboard/fsm',
  '/dashboard/orchestration',
  '/dashboard/deep-analytics',
  '/dashboard/advanced-intelligence',
  '/dashboard/federation-controls',
  '/dashboard/integrations/advanced',
] as const;

export function getFixture(role: StakeholderRole): StakeholderFixture {
  return STAKEHOLDER_FIXTURES[role];
}

export function getExpectedLanding(role: StakeholderRole): string {
  return getRoleLandingPath(STAKEHOLDER_FIXTURES[role].userRole);
}

export function getExpectedSidebar(role: StakeholderRole): string[] {
  const fixture = STAKEHOLDER_FIXTURES[role];
  const experience = getDashboardExperience(fixture.userRole);
  return getNavigationForExperience(experience).map((item) => item.label);
}

export function toLocalizedPath(path: string, locale: string): string {
  return `/${locale}${path}`;
}
