import type { HqCapability } from './rbac'

export interface NavItem {
  href: string
  label: string
  capability: HqCapability
  group: 'executive' | 'commercial' | 'governance' | 'integrations'
}

export const NAV: readonly NavItem[] = [
  { href: '/home', label: 'Executive Home', capability: 'view:executive-home', group: 'executive' },
  { href: '/portfolio', label: 'Portfolio', capability: 'view:portfolio', group: 'executive' },
  {
    href: '/dependency',
    label: 'Founder Dependency',
    capability: 'view:dependency',
    group: 'executive',
  },
  {
    href: '/dependency/trend',
    label: 'Delegation Plan',
    capability: 'view:dependency',
    group: 'executive',
  },
  {
    href: '/allocation',
    label: 'Capital Allocation',
    capability: 'view:allocation',
    group: 'executive',
  },
  {
    href: '/cadence',
    label: 'Operating Cadence',
    capability: 'view:cadence',
    group: 'executive',
  },
  {
    href: '/chief-of-staff',
    label: 'Chief of Staff',
    capability: 'view:chief-of-staff',
    group: 'executive',
  },
  {
    href: '/pipeline',
    label: 'Opportunity Pipeline',
    capability: 'view:pipeline',
    group: 'commercial',
  },
  { href: '/crm', label: 'Relationships', capability: 'view:crm', group: 'commercial' },
  { href: '/finance', label: 'Finance & Value', capability: 'view:finance', group: 'commercial' },
  { href: '/finance/cfo', label: 'CFO Truth Layer', capability: 'view:finance', group: 'commercial' },
  { href: '/delegation', label: 'Delegation', capability: 'view:delegation', group: 'governance' },
  { href: '/documents', label: 'Document Hub', capability: 'view:documents', group: 'governance' },
  { href: '/reports', label: 'Reports', capability: 'export:report', group: 'governance' },
  { href: '/audit', label: 'Audit Log', capability: 'view:audit-log', group: 'governance' },
  {
    href: '/integrations',
    label: 'Integrations Overview',
    capability: 'view:integrations',
    group: 'integrations',
  },
  {
    href: '/integrations/console',
    label: 'Console',
    capability: 'view:integrations',
    group: 'integrations',
  },
  {
    href: '/integrations/platform-admin',
    label: 'Platform Admin',
    capability: 'view:integrations',
    group: 'integrations',
  },
  {
    href: '/integrations/control-plane',
    label: 'Control Plane',
    capability: 'view:integrations',
    group: 'integrations',
  },
] as const

export const NAV_GROUPS = ['executive', 'commercial', 'governance', 'integrations'] as const
export const NAV_GROUP_LABELS: Record<(typeof NAV_GROUPS)[number], string> = {
  executive: 'Executive',
  commercial: 'Commercial',
  governance: 'Governance',
  integrations: 'Authoritative Systems',
}
