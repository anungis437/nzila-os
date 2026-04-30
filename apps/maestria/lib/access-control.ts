import type { CommerceLaneId, CommerceModule } from '@/lib/shopmoica-commerce'

export type OwnerPersona = 'lissa' | 'rox' | 'fred'

export type ActorRole =
  | 'owner'
  | 'production_staff'
  | 'customer_service'
  | 'finance_admin'
  | 'marketing_staff'
  | 'seasonal_temp'
  | 'corporate_client'

export type Permission =
  | 'dashboard.view'
  | 'module.internal.view'
  | 'module.client.view'
  | 'quote.manage'
  | 'margin.view'
  | 'finance.summary.view'
  | 'inventory.view'
  | 'supplier.view'
  | 'shipping.view'
  | 'campaign.view'
  | 'ads.view'
  | 'shopify.view'
  | 'crm.view'
  | 'user.manage'
  | 'approval.override'
  | 'export.download'
  | 'task.assigned.view'
  | 'task.assigned.update'
  | 'invoice.manage'
  | 'refund.manage'
  | 'spend.manage'

export interface ActorContext {
  id: string
  displayName: string
  role: ActorRole
  ownerPersona?: OwnerPersona
  companyId?: string
  delegatedUserAdmin?: boolean
}

const ownerPermissions: Permission[] = [
  'dashboard.view',
  'module.internal.view',
  'module.client.view',
  'quote.manage',
  'margin.view',
  'finance.summary.view',
  'inventory.view',
  'supplier.view',
  'shipping.view',
  'campaign.view',
  'ads.view',
  'shopify.view',
  'crm.view',
  'user.manage',
  'approval.override',
  'export.download',
  'invoice.manage',
  'refund.manage',
  'spend.manage',
]

const rolePermissions: Record<ActorRole, Permission[]> = {
  owner: ownerPermissions,
  production_staff: ['module.internal.view', 'inventory.view', 'shipping.view', 'task.assigned.view', 'task.assigned.update'],
  customer_service: ['module.internal.view', 'module.client.view', 'quote.manage', 'crm.view', 'shipping.view'],
  finance_admin: ['module.internal.view', 'finance.summary.view', 'invoice.manage', 'refund.manage', 'export.download'],
  marketing_staff: ['module.internal.view', 'module.client.view', 'campaign.view', 'ads.view', 'shopify.view'],
  seasonal_temp: ['task.assigned.view', 'task.assigned.update', 'shipping.view'],
  corporate_client: ['module.client.view'],
}

const actors: Record<string, ActorContext> = {
  lissa: { id: 'owner-lissa', displayName: 'Lissa', role: 'owner', ownerPersona: 'lissa' },
  rox: { id: 'owner-rox', displayName: 'Rox', role: 'owner', ownerPersona: 'rox' },
  fred: { id: 'owner-fred', displayName: 'Fred', role: 'owner', ownerPersona: 'fred' },
  prod_staff: { id: 'staff-prod-1', displayName: 'Production Staff', role: 'production_staff' },
  cs_staff: { id: 'staff-cs-1', displayName: 'Customer Service', role: 'customer_service' },
  fin_staff: { id: 'staff-fin-1', displayName: 'Finance Admin', role: 'finance_admin' },
  mkt_staff: { id: 'staff-mkt-1', displayName: 'Marketing Staff', role: 'marketing_staff' },
  temp_staff: { id: 'staff-temp-1', displayName: 'Seasonal Temp', role: 'seasonal_temp' },
  corporate_aurora: { id: 'client-aurora', displayName: 'Aurora Client User', role: 'corporate_client', companyId: 'cust-aurora' },
}

export const actorOptions = [
  { key: 'lissa', label: 'Lissa (owner)' },
  { key: 'rox', label: 'Rox (owner)' },
  { key: 'fred', label: 'Fred (owner)' },
  { key: 'prod_staff', label: 'Production staff' },
  { key: 'cs_staff', label: 'Customer service' },
  { key: 'fin_staff', label: 'Finance admin' },
  { key: 'mkt_staff', label: 'Marketing staff' },
  { key: 'temp_staff', label: 'Seasonal temp' },
  { key: 'corporate_aurora', label: 'Corporate client' },
] as const

export const ownerDefaultCockpit: Record<OwnerPersona, string> = {
  lissa: '/internal/executive-dashboard',
  rox: '/internal/production-tracker',
  fred: '/internal/shopify-intelligence-hub',
}

const staffModuleScopes: Record<Exclude<ActorRole, 'owner'>, { internal: Set<string>; client: Set<string> }> = {
  production_staff: {
    internal: new Set(['production-tracker', 'inventory-center', 'shipping-center', 'custom-order-management']),
    client: new Set(['order-tracking-experience']),
  },
  customer_service: {
    internal: new Set(['quote-pipeline', 'crm-internal-view', 'shipping-center']),
    client: new Set(['smart-quote-request-portal', 'corporate-client-portal', 'order-tracking-experience', 'concierge-requests']),
  },
  finance_admin: {
    internal: new Set(['finance-surface', 'executive-dashboard', 'quote-pipeline']),
    client: new Set(['corporate-client-portal']),
  },
  marketing_staff: {
    internal: new Set(['shopify-intelligence-hub', 'google-ads-command-center', 'campaign-command-center', 'social-presence-planner', 'website-conversion-center', 'executive-dashboard']),
    client: new Set(['seasonal-campaign-engine', 'guided-gift-builder']),
  },
  seasonal_temp: {
    internal: new Set(['shipping-center', 'production-tracker']),
    client: new Set(['order-tracking-experience']),
  },
  corporate_client: {
    internal: new Set([]),
    client: new Set(['corporate-client-portal', 'order-tracking-experience', 'smart-quote-request-portal']),
  },
}

export type SearchParamRecord = Record<string, string | string[] | undefined>

function getParam(searchParams: SearchParamRecord, key: string): string | undefined {
  const value = searchParams[key]
  if (Array.isArray(value)) return value[0]
  return value
}

export function resolveActor(searchParams: SearchParamRecord): ActorContext {
  const requested = getParam(searchParams, 'as')
  if (requested && actors[requested]) return actors[requested]
  return actors.lissa
}

export function hasPermission(actor: ActorContext, permission: Permission): boolean {
  const permissions = rolePermissions[actor.role]
  if (permissions.includes(permission)) return true
  return permission === 'user.manage' && actor.role === 'finance_admin' && !!actor.delegatedUserAdmin
}

export function canAccessModule(actor: ActorContext, lane: CommerceLaneId, slug: string): boolean {
  if (actor.role === 'owner') return true
  const scoped = staffModuleScopes[actor.role]
  return lane === 'internal' ? scoped.internal.has(slug) : scoped.client.has(slug)
}

export function getVisibleModules(actor: ActorContext, modules: CommerceModule[]): CommerceModule[] {
  return modules.filter((module) => canAccessModule(actor, module.lane, module.slug))
}

export function actorBadge(actor: ActorContext): string {
  if (actor.role === 'owner' && actor.ownerPersona) {
    return `Owner · ${actor.ownerPersona.toUpperCase()} cockpit`
  }
  return actor.role.replace('_', ' ')
}

export function withActorParam(path: string, actorKey: string): string {
  const glue = path.includes('?') ? '&' : '?'
  return `${path}${glue}as=${actorKey}`
}

export function filterCorporateRowsForActor<T extends { accountName?: string; customerName?: string }>(
  actor: ActorContext,
  rows: T[],
): T[] {
  if (actor.role !== 'corporate_client') return rows
  return rows.filter((row) => {
    const account = (row.accountName ?? row.customerName ?? '').toLowerCase()
    return account.includes('aurora')
  })
}

