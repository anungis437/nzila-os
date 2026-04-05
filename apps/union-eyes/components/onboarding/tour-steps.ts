/**
 * Tour Step Definitions
 * 
 * Pre-defined onboarding tours for different features
 */

import type { TourStep } from './OnboardingTour';

/**
 * Claims Management Tour
 */
export const claimsManagementTour: TourStep[] = [
  {
    element: '#claims-nav',
    popover: {
      title: 'Claims Management',
      description: 'Navigate all member cases here. Track status, assign cases, and manage resolutions.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '#new-claim-button',
    popover: {
      title: 'Create Case',
      description: 'Click here to create a new case on behalf of a member.',
      side: 'bottom',
    },
  },
  {
    element: '#claims-filters',
    popover: {
      title: 'Filter & Search',
      description: 'Filter cases by status, priority, type, or assignee. Use the search bar to find specific cases quickly.',
      side: 'left',
    },
  },
  {
    element: '#claims-table',
    popover: {
      title: 'Cases List',
      description: 'View all cases with key details. Click any row to see full case details and take action.',
      side: 'top',
    },
  },
];

/**
 * Voting & Elections Tour
 */
export const votingTour: TourStep[] = [
  {
    element: '#voting-nav',
    popover: {
      title: 'Voting & Elections',
      description: 'Manage union elections, ratifications, and member votes securely.',
      side: 'right',
    },
  },
  {
    element: '#create-ballot-button',
    popover: {
      title: 'Create Ballot',
      description: 'Set up a new election or vote. Configure voting period, eligibility, and options.',
      side: 'bottom',
    },
  },
  {
    element: '#voting-panel',
    popover: {
      title: 'Active Votes',
      description: 'Monitor ongoing elections with real-time turnout and results.',
      side: 'left',
    },
  },
  {
    element: '#voter-eligibility',
    popover: {
      title: 'Voter Eligibility',
      description: 'Define who can vote based on membership status, seniority, or custom rules.',
      side: 'top',
    },
  },
];

/**
 * Member Portal Tour
 */
export const memberPortalTour: TourStep[] = [
  {
    element: '#dashboard-overview',
    popover: {
      title: 'Dashboard Overview',
      description: 'Your central hub for all union activities, notifications, and quick actions.',
      side: 'bottom',
    },
  },
  {
    element: '#my-profile',
    popover: {
      title: 'My Profile',
      description: 'Update your contact information, preferences, and view your membership status.',
      side: 'left',
    },
  },
  {
    element: '#documents-section',
    popover: {
      title: 'Documents',
      description: 'Access collective agreements, policies, and personal documents.',
      side: 'right',
    },
  },
  {
    element: '#notifications-bell',
    popover: {
      title: 'Notifications',
      description: 'Stay updated on claim status, voting deadlines, and important announcements.',
      side: 'bottom',
    },
  },
];

/**
 * Analytics Dashboard Tour
 */
export const analyticsTour: TourStep[] = [
  {
    element: '#analytics-nav',
    popover: {
      title: 'Analytics Dashboard',
      description: 'View comprehensive metrics on claims, membership, engagement, and financial health.',
      side: 'right',
    },
  },
  {
    element: '#date-range-picker',
    popover: {
      title: 'Date Range',
      description: 'Select time periods to analyze trends. Compare metrics month-over-month or year-over-year.',
      side: 'bottom',
    },
  },
  {
    element: '#key-metrics',
    popover: {
      title: 'Key Metrics',
      description: 'Monitor critical KPIs like active claims, member engagement, and resolution times.',
      side: 'left',
    },
  },
  {
    element: '#export-reports',
    popover: {
      title: 'Export Reports',
      description: 'Download detailed reports in CSV, PDF, or Excel for board meetings or compliance.',
      side: 'top',
    },
  },
];

/**
 * Document Management Tour
 */
export const documentsTour: TourStep[] = [
  {
    element: '#documents-nav',
    popover: {
      title: 'Document Management',
      description: 'Store, organize, and share union documents securely with version control.',
      side: 'right',
    },
  },
  {
    element: '#upload-button',
    popover: {
      title: 'Upload Documents',
      description: 'Drag and drop files or click to upload. Supports PDFs, Word docs, images, and more.',
      side: 'bottom',
    },
  },
  {
    element: '#document-folders',
    popover: {
      title: 'Organize by Folders',
      description: 'Create folders for different document types: CBAs, policies, meeting minutes, etc.',
      side: 'left',
    },
  },
  {
    element: '#share-permissions',
    popover: {
      title: 'Sharing & Permissions',
      description: 'Control who can view, edit, or download documents. Set expiration dates for sensitive files.',
      side: 'top',
    },
  },
];

/**
 * Communication Tools Tour
 */
export const communicationTour: TourStep[] = [
  {
    element: '#messages-nav',
    popover: {
      title: 'Communication Hub',
      description: 'Send messages, announcements, and newsletters to members or specific groups.',
      side: 'right',
    },
  },
  {
    element: '#compose-message',
    popover: {
      title: 'Compose Message',
      description: 'Write messages with rich formatting. Schedule delivery or send immediately.',
      side: 'bottom',
    },
  },
  {
    element: '#recipient-selector',
    popover: {
      title: 'Select Recipients',
      description: 'Send to all members, specific departments, or custom contact lists.',
      side: 'left',
    },
  },
  {
    element: '#delivery-channels',
    popover: {
      title: 'Delivery Channels',
      description: 'Choose email, SMS, push notifications, or in-app messages.',
      side: 'top',
    },
  },
];

/**
 * Admin Settings Tour
 */
export const adminTour: TourStep[] = [
  {
    element: '#admin-nav',
    popover: {
      title: 'Admin Settings',
      description: 'Configure organization settings, manage users, and customize your union portal.',
      side: 'right',
    },
  },
  {
    element: '#organization-settings',
    popover: {
      title: 'Organization Settings',
      description: 'Update union name, logo, contact information, and branding.',
      side: 'bottom',
    },
  },
  {
    element: '#user-management',
    popover: {
      title: 'User Management',
      description: 'Invite staff, assign roles, and manage member access permissions.',
      side: 'left',
    },
  },
  {
    element: '#integrations',
    popover: {
      title: 'Integrations',
      description: 'Connect external tools like calendars, payment processors, and email services.',
      side: 'top',
    },
  },
];

/**
 * Export all tours
 */
export const tourSteps = {
  claimsManagement: claimsManagementTour,
  voting: votingTour,
  memberPortal: memberPortalTour,
  analytics: analyticsTour,
  documents: documentsTour,
  communication: communicationTour,
  admin: adminTour,
} as const;

/**
 * Tour metadata for display in settings
 */
export const tourMetadata = [
  {
    id: 'claims-management',
    name: 'Claims Management',
    description: 'Learn how to manage and track cases',
    steps: claimsManagementTour.length,
    estimatedTime: '2 min',
  },
  {
    id: 'voting',
    name: 'Voting & Elections',
    description: 'Set up and run union elections',
    steps: votingTour.length,
    estimatedTime: '2 min',
  },
  {
    id: 'member-portal',
    name: 'Member Portal',
    description: 'Navigate your member dashboard',
    steps: memberPortalTour.length,
    estimatedTime: '2 min',
  },
  {
    id: 'analytics',
    name: 'Analytics Dashboard',
    description: 'Understand union metrics and insights',
    steps: analyticsTour.length,
    estimatedTime: '2 min',
  },
  {
    id: 'documents',
    name: 'Document Management',
    description: 'Organize and share documents',
    steps: documentsTour.length,
    estimatedTime: '2 min',
  },
  {
    id: 'communication',
    name: 'Communication Tools',
    description: 'Send messages to members',
    steps: communicationTour.length,
    estimatedTime: '2 min',
  },
  {
    id: 'admin',
    name: 'Admin Settings',
    description: 'Configure your organization',
    steps: adminTour.length,
    estimatedTime: '2 min',
  },
] as const;

