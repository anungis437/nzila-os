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
  'system_admin',
  'admin',
  'platform_lead',
  'integration_manager',
  'billing_manager',
  'data_analytics_manager',
]);

const GOVERNANCE_ROLES = new Set([
  'governance',
  'officer',
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

const CUPE4373_DEMO_PROFILE = 'cupe4373';

const CUPE4373_DEMO_NAVIGATION: NavigationItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'dashboard', group: 'daily' },
  { label: 'Inbox', href: '/dashboard/inbox', icon: 'inbox', group: 'daily' },
  { label: 'Priorities', href: '/dashboard/priorities', icon: 'priorities', group: 'daily' },
  { label: 'Cases', href: '/dashboard/cases', icon: 'cases', group: 'casework' },
  { label: 'Grievances', href: '/dashboard/grievances', icon: 'grievances', group: 'casework' },
  { label: 'Members', href: '/dashboard/members', icon: 'members', group: 'records' },
  { label: 'Agreements', href: '/dashboard/agreements', icon: 'agreements', group: 'records' },
  { label: 'Calendar', href: '/dashboard/calendar', icon: 'calendar', group: 'records' },
  { label: 'Documents', href: '/dashboard/documents', icon: 'documents', group: 'records' },
  { label: 'Communications', href: '/dashboard/communications', icon: 'communications', group: 'oversight' },
  { label: 'Governance', href: '/dashboard/governance', icon: 'governance', group: 'oversight' },
  { label: 'Reports', href: '/dashboard/reports', icon: 'reports', group: 'oversight' },
];

const CUPE4373_DEMO_GROUPS: NavigationGroup[] = [
  { key: 'daily', label: 'Daily Work' },
  { key: 'casework', label: 'Casework' },
  { key: 'records', label: 'Member Records' },
  { key: 'oversight', label: 'Oversight & Comms' },
];

// Member-scoped demo navigation: intake-focused, limited to surfaces a rank-and-file
// member can legitimately access (their own inbox, their own cases, documents shared
// with them). Stewards/officers/admins see the full demo navigation above.
const CUPE4373_DEMO_MEMBER_NAVIGATION: NavigationItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'dashboard', group: 'daily' },
  { label: 'Inbox', href: '/dashboard/inbox', icon: 'inbox', group: 'daily' },
  { label: 'My Cases', href: '/dashboard/cases', icon: 'cases', group: 'casework' },
  { label: 'Documents', href: '/dashboard/documents', icon: 'documents', group: 'records' },
];

export function getCupe4373DemoNavigation(role?: string | null): NavigationItem[] {
  const experience = getDashboardExperience(role);
  if (experience === 'member') return CUPE4373_DEMO_MEMBER_NAVIGATION;
  return CUPE4373_DEMO_NAVIGATION;
}

export function getCupe4373DemoGroups(): NavigationGroup[] {
  return CUPE4373_DEMO_GROUPS;
}

const CUPE4373_DEMO_ALLOWED_PREFIXES = [
  '/dashboard',
  '/dashboard/workspace',
  '/dashboard/work',
  '/dashboard/inbox',
  '/dashboard/cases',
  '/dashboard/grievances',
  '/dashboard/priorities',
  '/dashboard/communications',
  '/dashboard/members',
  '/dashboard/agreements',
  '/dashboard/calendar',
  '/dashboard/documents',
  '/dashboard/governance',
  '/dashboard/reports',
  '/dashboard/profile',
];

function readRuntimeMarker(name: string): string {
  return (process.env[name] ?? '').trim().toLowerCase();
}

export function isCupe4373DemoRuntime(): boolean {
  const publicDemoProfile = (process.env.NEXT_PUBLIC_UE_DEMO_PROFILE ?? '').trim().toLowerCase();
  const publicFeatureProfile = (process.env.NEXT_PUBLIC_UE_FEATURE_PROFILE ?? '').trim().toLowerCase();
  return (
    publicDemoProfile === CUPE4373_DEMO_PROFILE
    || publicFeatureProfile === CUPE4373_DEMO_PROFILE
    || readRuntimeMarker('UE_FEATURE_PROFILE') === CUPE4373_DEMO_PROFILE
    || readRuntimeMarker('UE_DEPLOYMENT_TYPE') === 'cupe4373-demo'
  );
}

export function getDashboardExperience(role?: string | null): DashboardExperience {
  const normalized = (role ?? 'member').toLowerCase();

  if (ADMIN_ROLES.has(normalized)) return 'admin';
  if (GOVERNANCE_ROLES.has(normalized)) return 'governance';
  if (EXECUTIVE_ROLES.has(normalized)) return 'executive';
  if (STAFF_ROLES.has(normalized)) return 'staff';
  return 'member';
}

export function getRoleLandingPath(role?: string | null): string {
  if (isCupe4373DemoRuntime()) return '/dashboard';

  const experience = getDashboardExperience(role);
  if (experience === 'member') return '/dashboard/inbox';
  // Each role lands on its primary surface (not the shared "Workspace" hub,
  // which is the first sidebar entry). The sidebar highlights the nav item
  // whose href matches this landing path via `isActive`.
  if (experience === 'staff') return '/dashboard/work';
  if (experience === 'executive') return '/dashboard/intelligence';
  if (experience === 'governance') return '/dashboard/governance';
  return '/dashboard/admin/organizations';
}

export function getNavigationForExperience(experience: DashboardExperience): NavigationItem[] {
  if (isCupe4373DemoRuntime()) {
    if (experience === 'member') return CUPE4373_DEMO_MEMBER_NAVIGATION;
    return CUPE4373_DEMO_NAVIGATION;
  }

  if (experience === 'member') {
    return [
      { label: 'Workspace', href: '/dashboard/workspace', icon: 'dashboard' },
      { label: 'Home', href: '/dashboard/inbox' },
      { label: 'My Cases', href: '/dashboard/inbox?type=intake' },
      { label: 'Open Representation Case', href: '/dashboard/claims/new' },
      { label: 'Messages', href: '/dashboard/inbox?type=message' },
      { label: 'Documents', href: '/dashboard/documents' },
      { label: 'Profile & Settings', href: '/dashboard/settings' },
      { label: 'Help & Support', href: '/dashboard/support' },
    ];
  }

  if (experience === 'staff') {
    return [
      { label: 'Workspace', href: '/dashboard/workspace', icon: 'dashboard', group: 'Workspace' },
      { label: 'Operations (Casework Console)', href: '/dashboard/work', group: 'Operations' },
      { label: 'Operations Queue (Representation Cases)', href: '/dashboard/inbox?type=intake', group: 'Operations' },
      { label: 'Operations Priorities (Commitments & Deadlines)', href: '/dashboard/priorities', group: 'Operations' },
      { label: 'Members', href: '/dashboard/members', group: 'Operations' },
      { label: 'Documents', href: '/dashboard/documents', group: 'Operations' },
      { label: 'Operations Communications', href: '/dashboard/correspondence', group: 'Operations' },
      { label: 'Institutional Intelligence Reports', href: '/dashboard/reports', group: 'Institutional Intelligence' },
      { label: 'Notifications', href: '/dashboard/notifications', group: 'Operations' },
      { label: 'Profile & Settings', href: '/dashboard/settings', group: 'Settings' },
    ];
  }

  if (experience === 'executive') {
    return [
      { label: 'Workspace', href: '/dashboard/workspace', icon: 'dashboard', group: 'Workspace' },
      { label: 'OCRA Intelligence (Executive Overview)', href: '/dashboard/intelligence?scope=executive', group: 'OCRA' },
      { label: 'OCRA Signals (Continuity Insights)', href: '/dashboard/continuity-intelligence', group: 'OCRA' },
      { label: 'Operations Continuity', href: '/dashboard/executive-operating-intelligence', group: 'Operations' },
      { label: 'Governance Continuity', href: '/dashboard/governance-center', group: 'Governance Continuity' },
      { label: 'Operations Outcomes (Member Outcomes Ledger)', href: '/dashboard/outcomes', group: 'Operations' },
      { label: 'Onboarding Survivability (Leadership Continuity)', href: '/dashboard/leadership', group: 'Operations' },
      { label: 'Institutional Intelligence Reports', href: '/dashboard/reports', group: 'Institutional Intelligence' },
      { label: 'Governance Trust & Oversight', href: '/dashboard/trust', group: 'Governance Continuity' },
      { label: 'Profile & Settings', href: '/dashboard/settings', group: 'Settings' },
    ];
  }

  if (experience === 'governance') {
    return [
      { label: 'Workspace', href: '/dashboard/workspace', icon: 'dashboard', group: 'Workspace' },
      { label: 'Governance Continuity Overview', href: '/dashboard/governance', group: 'Governance Continuity' },
      { label: 'Governance Trust & Explainability', href: '/dashboard/trust', group: 'Governance Continuity' },
      { label: 'Governance Continuity Review', href: '/dashboard/workbench', group: 'Governance Continuity' },
      { label: 'Governance Policy Continuity', href: '/dashboard/governance', group: 'Governance Continuity' },
      { label: 'OCRA Continuity Signals', href: '/dashboard/continuity-intelligence', group: 'OCRA' },
      { label: 'Governance Audit & Evidence', href: '/dashboard/audits', group: 'Governance Continuity' },
      { label: 'Institutional Intelligence Reports', href: '/dashboard/reports', group: 'Institutional Intelligence' },
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
    '/dashboard/workspace',
    '/dashboard/inbox',
    '/dashboard/claims/new',
    '/dashboard/documents',
    '/dashboard/settings',
    '/dashboard/profile',
    '/dashboard/support',
  ],
  staff: [
    '/dashboard',
    '/dashboard/workspace',
    '/dashboard/workbench',
    '/dashboard/work',
    '/dashboard/inbox',
    '/dashboard/priorities',
    '/dashboard/members',
    '/dashboard/documents',
    '/dashboard/correspondence',
    '/dashboard/reports',
    '/dashboard/notifications',
    '/dashboard/settings',
    '/dashboard/profile',
  ],
  executive: [
    '/dashboard',
    '/dashboard/workspace',
    '/dashboard/intelligence',
    '/dashboard/continuity-intelligence',
    '/dashboard/executive-operating-intelligence',
    '/dashboard/operations',
    '/dashboard/governance-center',
    '/dashboard/outcomes',
    '/dashboard/leadership',
    '/dashboard/reports',
    '/dashboard/trust',
    '/dashboard/settings',
    '/dashboard/profile',
  ],
  governance: [
    '/dashboard',
    '/dashboard/workspace',
    '/dashboard/governance',
    '/dashboard/trust',
    '/dashboard/workbench',
    '/dashboard/continuity-intelligence',
    '/dashboard/audits',
    '/dashboard/reports',
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
  const allowedPrefixes = isCupe4373DemoRuntime()
    ? CUPE4373_DEMO_ALLOWED_PREFIXES
    : ALLOWED_PREFIXES_BY_EXPERIENCE[experience];
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
