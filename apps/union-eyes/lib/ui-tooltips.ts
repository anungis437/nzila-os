/**
 * UI Tooltip Content System
 * 
 * Provides contextual help and guidance tooltips throughout the application.
 * Each tooltip is keyed by a unique ID and can be translated for i18n.
 * 
 * @module lib/ui-tooltips
 */

export interface TooltipContent {
  id: string;
  title: string;
  content: string;
  category: 'navigation' | 'action' | 'information' | 'warning' | 'security';
  learnMoreUrl?: string;
  videoUrl?: string;
}

export interface TooltipGroup {
  id: string;
  name: string;
  description: string;
  tooltips: TooltipContent[];
}

/**
 * Get tooltip by ID
 */
export function getTooltip(id: string): TooltipContent | undefined {
  return allTooltips.find(t => t.id === id);
}

/**
 * Get tooltips by category
 */
export function getTooltipsByCategory(category: TooltipContent['category']): TooltipContent[] {
  return allTooltips.filter(t => t.category === category);
}

/**
 * Get tooltips by page/section
 */
export function getTooltipsForPage(pageId: string): TooltipContent[] {
  return pageTooltips[pageId] || [];
}

// ============================================================================
// TOOLTIP DEFINITIONS
// ============================================================================

const navigationTooltips: TooltipContent[] = [
  {
    id: 'nav-dashboard',
    title: 'Dashboard',
    content: 'Your central hub for union activities. View key metrics, recent activity, and quick actions.',
    category: 'navigation',
    learnMoreUrl: '/help/dashboard'
  },
  {
    id: 'nav-members',
    title: 'Members',
    content: 'Manage your union members. View profiles, update information, and track membership status.',
    category: 'navigation',
    learnMoreUrl: '/help/members'
  },
  {
    id: 'nav-claims',
    title: 'Claims',
    content: 'Track and manage member grievances. File new claims and monitor existing case progress.',
    category: 'navigation',
    learnMoreUrl: '/help/claims'
  },
  {
    id: 'nav-voting',
    title: 'Voting',
    content: 'Manage union elections and ratifications. Create ballots and track voter participation.',
    category: 'navigation',
    learnMoreUrl: '/help/voting'
  },
  {
    id: 'nav-documents',
    title: 'Documents',
    content: 'Access and manage collective agreements, policies, and important files.',
    category: 'navigation',
    learnMoreUrl: '/help/documents'
  },
  {
    id: 'nav-reports',
    title: 'Reports',
    content: 'Generate and view analytics on membership, finances, and operations.',
    category: 'navigation',
    learnMoreUrl: '/help/reports'
  },
  {
    id: 'nav-admin',
    title: 'Admin',
    content: 'Configure organization settings, manage users, and access system controls.',
    category: 'navigation',
    learnMoreUrl: '/help/admin'
  }
];

const memberManagementTooltips: TooltipContent[] = [
  {
    id: 'member-search',
    title: 'Search Members',
    content: 'Find members by name, ID, email, or employee number. Use filters to narrow results.',
    category: 'action'
  },
  {
    id: 'member-add',
    title: 'Add New Member',
    content: 'Enter member details including personal info, employment details, and union preferences.',
    category: 'action'
  },
  {
    id: 'member-import',
    title: 'Import Members',
    content: 'Bulk import members from CSV or Excel files. Ensure proper format with our template.',
    category: 'action',
    learnMoreUrl: '/help/importing-members'
  },
  {
    id: 'member-dues',
    title: 'Dues Status',
    content: 'View and manage member dues payments. Track balance, payment history, and arrears.',
    category: 'information'
  },
  {
    id: 'member-status',
    title: 'Membership Status',
    content: 'Status options: Active (good standing), Suspended (arrears), Honored (retired), Terminated.',
    category: 'information'
  },
  {
    id: 'member-roles',
    title: 'Member Roles',
    content: 'Assign roles like Steward, Officer, or Committee Member to grant appropriate access.',
    category: 'action'
  }
];

const claimsTooltips: TooltipContent[] = [
  {
    id: 'claim-file',
    title: 'File Grievance',
    content: 'Submit a new grievance on behalf of a member. Include all relevant details and documentation.',
    category: 'action',
    videoUrl: '/videos/filing-grievance'
  },
  {
    id: 'claim-steps',
    title: 'Grievance Steps',
    content: 'Most grievances follow 3 steps: (1) Informal discussion, (2) Written grievance to supervisor, (3) Appeal to management/union committee.',
    category: 'information'
  },
  {
    id: 'claim-timeline',
    title: 'Timeline',
    content: 'Grievances typically have 5-10 business day deadlines. Missing a deadline can forfeit the case.',
    category: 'warning',
    learnMoreUrl: '/help/grievance-timelines'
  },
  {
    id: 'claim-assign',
    title: 'Assign Representative',
    content: 'Assign an appropriate steward based on the member\'s worksite and the grievance type.',
    category: 'action'
  },
  {
    id: 'claim-priority',
    title: 'Priority Levels',
    content: 'High priority: discipline, termination. Medium: working conditions, benefits. Low: administrative issues.',
    category: 'information'
  },
  {
    id: 'claim-outcome',
    title: 'Case Outcome',
    content: 'Outcomes include: Won (full resolution), Settled (partial resolution), Lost, Withdrawn.',
    category: 'information'
  }
];

const votingTooltips: TooltipContent[] = [
  {
    id: 'vote-create',
    title: 'Create Ballot',
    content: 'Set up a new vote with question, options, dates, and eligible voters.',
    category: 'action',
    videoUrl: '/videos/creating-ballots'
  },
  {
    id: 'vote-eligibility',
    title: 'Eligibility',
    content: 'Define who can vote based on membership status, seniority, or custom criteria.',
    category: 'information'
  },
  {
    id: 'vote-anonymous',
    title: 'Voting Privacy',
    content: 'All votes are confidential. Individual choices are never disclosed to anyone.',
    category: 'security',
    learnMoreUrl: '/help/voting-privacy'
  },
  {
    id: 'vote-results',
    title: 'Results',
    content: 'Results can be shown after voting ends, or in real-time. Choose what\'s appropriate for your vote.',
    category: 'information'
  },
  {
    id: 'vote-quorum',
    title: 'Quorum',
    content: 'Minimum participation required for vote validity. Set based on your bylaws.',
    category: 'information'
  }
];

const adminTooltips: TooltipContent[] = [
  {
    id: 'admin-users',
    title: 'User Management',
    content: 'Add, remove, or modify user access. Assign roles to control what each person can see and do.',
    category: 'action'
  },
  {
    id: 'admin-roles',
    title: 'Role Permissions',
    content: 'Roles hierarchy: Admin > Officer > Steward > Member. Each role has specific permissions.',
    category: 'information',
    learnMoreUrl: '/help/roles-permissions'
  },
  {
    id: 'admin-audit',
    title: 'Audit Log',
    content: 'Track all system activity for security and compliance. Logs are retained for 7 years.',
    category: 'security'
  },
  {
    id: 'admin-backup',
    title: 'Data Backup',
    content: 'Your data is automatically backed up daily. Export your data anytime for additional safety.',
    category: 'security'
  },
  {
    id: 'admin-2fa',
    title: 'Two-Factor Auth',
    content: 'Enable 2FA for all admin accounts. Required for all users handling sensitive data.',
    category: 'security',
    learnMoreUrl: '/help/2fa-setup'
  },
  {
    id: 'admin-sso',
    title: 'Single Sign-On',
    content: 'Connect your organization\'s identity provider for easier access management.',
    category: 'action'
  }
];

const financialTooltips: TooltipContent[] = [
  {
    id: 'finance-dues',
    title: 'Dues Collection',
    content: 'Track member dues payments. Automatic deductions from payroll or manual payments accepted.',
    category: 'information'
  },
  {
    id: 'finance-per-capita',
    title: 'Per Capita',
    content: 'Payments to parent bodies (CLC, Federation) based on membership count. Due monthly.',
    category: 'information'
  },
  {
    id: 'finance-strike-fund',
    title: 'Strike Fund',
    content: 'Reserves for strike support. Monitor balance and contribution levels.',
    category: 'information'
  },
  {
    id: 'finance-reports',
    title: 'Financial Reports',
    content: 'Generate balance sheets, income statements, and budget comparisons.',
    category: 'action'
  }
];

const communicationTooltips: TooltipContent[] = [
  {
    id: 'comm-email',
    title: 'Email Blast',
    content: 'Send email to all members or filtered groups. Track opens and clicks.',
    category: 'action'
  },
  {
    id: 'comm-sms',
    title: 'SMS Alerts',
    content: 'Send text messages for urgent announcements. Limited to 160 characters per message.',
    category: 'action'
  },
  {
    id: 'comm-notifications',
    title: 'In-App Notifications',
    content: 'Send notifications that appear in member dashboards. Good for non-urgent updates.',
    category: 'action'
  },
  {
    id: 'comm-templates',
    title: 'Message Templates',
    content: 'Save frequently used messages for quick sending. Include placeholders for personalization.',
    category: 'action'
  }
];

// ============================================================================
// PAGE MAPPING
// ============================================================================

const pageTooltips: Record<string, TooltipContent[]> = {
  '/dashboard': navigationTooltips.filter(t => ['nav-dashboard'].includes(t.id)),
  '/members': [...navigationTooltips.filter(t => ['nav-members'].includes(t.id)), ...memberManagementTooltips],
  '/claims': [...navigationTooltips.filter(t => ['nav-claims'].includes(t.id)), ...claimsTooltips],
  '/voting': [...navigationTooltips.filter(t => ['nav-voting'].includes(t.id)), ...votingTooltips],
  '/documents': navigationTooltips.filter(t => ['nav-documents'].includes(t.id)),
  '/reports': [...navigationTooltips.filter(t => ['nav-reports'].includes(t.id)), ...financialTooltips],
  '/admin': [...navigationTooltips.filter(t => ['nav-admin'].includes(t.id)), ...adminTooltips],
  '/communications': communicationTooltips
};

// ============================================================================
// ALL TOOLTIPS
// ============================================================================

export const allTooltips: TooltipContent[] = [
  ...navigationTooltips,
  ...memberManagementTooltips,
  ...claimsTooltips,
  ...votingTooltips,
  ...adminTooltips,
  ...financialTooltips,
  ...communicationTooltips
];

// ============================================================================
// TOOLTIP GROUPS
// ============================================================================

export const tooltipGroups: TooltipGroup[] = [
  {
    id: 'navigation',
    name: 'Navigation',
    description: 'Help with navigating the application',
    tooltips: navigationTooltips
  },
  {
    id: 'members',
    name: 'Member Management',
    description: 'Help with managing union members',
    tooltips: memberManagementTooltips
  },
  {
    id: 'claims',
    name: 'Claims & Grievances',
    description: 'Help with grievance handling',
    tooltips: claimsTooltips
  },
  {
    id: 'voting',
    name: 'Voting & Elections',
    description: 'Help with running elections',
    tooltips: votingTooltips
  },
  {
    id: 'admin',
    name: 'Administration',
    description: 'Help with admin functions',
    tooltips: adminTooltips
  },
  {
    id: 'finance',
    name: 'Financial',
    description: 'Help with finances and reporting',
    tooltips: financialTooltips
  },
  {
    id: 'communications',
    name: 'Communications',
    description: 'Help with member communications',
    tooltips: communicationTooltips
  }
];

/**
 * Get suggested tooltips based on user role
 */
export function getSuggestedTooltips(userRole: string): TooltipContent[] {
  const roleSuggestions: Record<string, string[]> = {
    'member': [
      'member-dues',
      'member-status',
      'claim-file',
      'vote-anonymous'
    ],
    'steward': [
      'claim-steps',
      'claim-timeline',
      'claim-assign',
      'member-roles'
    ],
    'officer': [
      'vote-create',
      'vote-eligibility',
      'finance-dues',
      'comm-email'
    ],
    'admin': [
      'admin-users',
      'admin-roles',
      'admin-audit',
      'admin-2fa'
    ]
  };
  
  const ids = roleSuggestions[userRole] || roleSuggestions['member'];
  return ids.map(id => getTooltip(id)).filter((t): t is TooltipContent => t !== undefined);
}
