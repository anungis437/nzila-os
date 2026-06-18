/**
 * Console workspace navigation model.
 *
 * Single source of truth for the six-workspace surface + Settings, and for each
 * workspace's sub-tabs. Mirrors docs/doctrine/NZILA_CONSOLE_TAB_SCHEMA.md.
 */

export type WorkspaceKey =
  | 'overview'
  | 'portfolio'
  | 'observatory'
  | 'sales'
  | 'ventures'
  | 'operations'
  | 'settings'

export interface SubTab {
  key: string
  label: string
}

export interface WorkspaceDef {
  key: WorkspaceKey
  label: string
  href: string
  icon: string
  question: string
  subTabs: SubTab[]
}

export const WORKSPACES: WorkspaceDef[] = [
  {
    key: 'overview',
    label: 'Overview',
    href: '/workspace/overview',
    icon: 'HomeIcon',
    question: 'Is the portfolio healthy this morning?',
    subTabs: [],
  },
  {
    key: 'portfolio',
    label: 'Portfolio',
    href: '/workspace/portfolio',
    icon: 'BuildingOffice2Icon',
    question: 'What exists, what stage is it in, what deserves attention?',
    subTabs: [
      { key: 'overview', label: 'Overview' },
      { key: 'ventures', label: 'Ventures' },
      { key: 'pipeline', label: 'Pipeline' },
      { key: 'funding', label: 'Funding' },
    ],
  },
  {
    key: 'observatory',
    label: 'Observatory',
    href: '/workspace/observatory',
    icon: 'ChartBarSquareIcon',
    question: 'What is the market-validation engine telling us?',
    subTabs: [
      { key: 'cohorts', label: 'Cohorts' },
      { key: 'assessments', label: 'Assessments' },
      { key: 'route-decisions', label: 'Route Decisions' },
      { key: 'reassessments', label: 'Reassessments' },
      { key: 'benchmark-readiness', label: 'Benchmark Readiness' },
    ],
  },
  {
    key: 'sales',
    label: 'Sales',
    href: '/workspace/sales',
    icon: 'ArrowTrendingUpIcon',
    question: 'Where is revenue in the pipeline?',
    subTabs: [
      { key: 'leads', label: 'Leads' },
      { key: 'opportunities', label: 'Opportunities' },
      { key: 'proposals', label: 'Proposals' },
      { key: 'pilots', label: 'Pilots' },
      { key: 'conversions', label: 'Conversions' },
    ],
  },
  {
    key: 'ventures',
    label: 'Ventures',
    href: '/workspace/ventures',
    icon: 'RocketLaunchIcon',
    question: 'How mature is each venture, and what is blocking it?',
    subTabs: [],
  },
  {
    key: 'operations',
    label: 'Operations',
    href: '/workspace/operations',
    icon: 'WrenchScrewdriverIcon',
    question: 'What must the founder personally move this week?',
    subTabs: [
      { key: 'tasks', label: 'Tasks' },
      { key: 'risks', label: 'Risks' },
      { key: 'decisions', label: 'Decisions' },
      { key: 'governance', label: 'Governance' },
      { key: 'documentation', label: 'Documentation' },
      { key: 'platform', label: 'Platform' },
      { key: 'ai', label: 'AI Management' },
      { key: 'service', label: 'Service Desk' },
      { key: 'proving', label: 'Proving' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '/workspace/settings',
    icon: 'Cog6ToothIcon',
    question: 'Account and workspace configuration.',
    subTabs: [],
  },
]

/** Resolve the active sub-tab for a workspace, falling back to the first tab. */
export function resolveSubTab(workspace: WorkspaceKey, requested: string | undefined): string {
  const def = WORKSPACES.find((w) => w.key === workspace)
  if (!def || def.subTabs.length === 0) return ''
  if (requested && def.subTabs.some((t) => t.key === requested)) return requested
  return def.subTabs[0].key
}
