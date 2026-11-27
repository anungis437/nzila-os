import { and, desc, eq, sql } from 'drizzle-orm'
import {
  qboConnections,
  qboSyncRuns,
  stripeConnections,
  taxProfiles,
  auditLog,
} from '@nzila/db/schema'
import { getStripeClient } from '@nzila/payments-stripe'
import { checkCRMHealth } from '@/lib/crm'
import { checkCalendarHealth } from '@/lib/calendar'
import { getUpcomingDeadlines } from '@/lib/tax'
import {
  withCfoPlatformPurpose,
  assertCfoContextPermission,
  CfoScopeError,
  cfoAuthoritySource,
  type CfoActionContext,
  type OrganizationContext,
} from '@/lib/resolve-org'
import { appendCfoPrimaryAudit } from './cfo-records'
import { CfoCapabilityUnavailableError } from './capability-unavailable'
export type IntegrationProvider =
  'stripe' | 'quickbooks' | 'tax-engine' | 'hubspot' | 'outlook-calendar' | 'google-calendar'
export interface IntegrationStatus {
  id: string
  name: string
  provider: IntegrationProvider
  connected: boolean
  lastSync: Date | null
  health: 'healthy' | 'degraded' | 'disconnected'
  details: string
}
const names: Record<IntegrationProvider, string> = {
  stripe: 'Stripe',
  quickbooks: 'QuickBooks Online',
  'tax-engine': 'Tax Engine',
  hubspot: 'HubSpot CRM',
  'outlook-calendar': 'Outlook Calendar',
  'google-calendar': 'Google Calendar',
}
const providers: readonly IntegrationProvider[] = [
  'stripe',
  'quickbooks',
  'tax-engine',
  'hubspot',
  'outlook-calendar',
  'google-calendar',
]
function provider(value: IntegrationProvider) {
  if (!providers.includes(value)) throw new Error('Invalid integration provider')
  return value
}
function state(
  key: IntegrationProvider,
  connected: boolean,
  lastSync: Date | null,
  details: string,
): IntegrationStatus {
  return {
    id: key,
    name: names[key],
    provider: key,
    connected,
    lastSync,
    health: connected ? 'healthy' : 'disconnected',
    details,
  }
}
function global(
  context: CfoActionContext,
  permission: 'integrations:view' | 'integrations:manage',
) {
  assertCfoContextPermission(context, permission)
  if (context.purpose !== 'platform') throw new CfoScopeError()
}
async function configuredHealth(
  context: CfoActionContext,
  key: IntegrationProvider,
  permission: 'integrations:view' | 'integrations:manage',
) {
  global(context, permission)
  provider(key)
  switch (key) {
    case 'stripe': {
      const client = getStripeClient()
      if (!client) return { ok: false }
      await client.balance.retrieve()
      return { ok: true }
    }
    case 'hubspot':
      return checkCRMHealth()
    case 'outlook-calendar':
    case 'google-calendar': {
      const token =
        key === 'outlook-calendar'
          ? process.env.OUTLOOK_ACCESS_TOKEN
          : process.env.GOOGLE_CALENDAR_ACCESS_TOKEN
      return token
        ? checkCalendarHealth(key === 'outlook-calendar' ? 'outlook' : 'google', {
            accessToken: token,
          })
        : { ok: false }
    }
    case 'tax-engine':
      await getUpcomingDeadlines(new Date().getFullYear())
      return { ok: true }
    case 'quickbooks':
      throw new CfoCapabilityUnavailableError('QBO_OAUTH_SOURCE_UNAVAILABLE')
  }
}
export async function integrationStatuses(
  context: OrganizationContext,
): Promise<IntegrationStatus[]> {
  assertCfoContextPermission(context, 'integrations:view')
  const orgId = context.organizationId
  const [[stripe], [qbo], [sync], [tax]] = await Promise.all([
    context.db
      .select({
        id: stripeConnections.id,
        lastEventAt: stripeConnections.lastEventAt,
        connectedAt: stripeConnections.connectedAt,
        status: stripeConnections.status,
      })
      .from(stripeConnections)
      .where(eq(stripeConnections.orgId, orgId))
      .orderBy(desc(stripeConnections.updatedAt))
      .limit(1),
    context.db
      .select({ id: qboConnections.id, connectedAt: qboConnections.connectedAt })
      .from(qboConnections)
      .where(and(eq(qboConnections.orgId, orgId), eq(qboConnections.isActive, true)))
      .orderBy(desc(qboConnections.updatedAt))
      .limit(1),
    context.db
      .select({ completedAt: qboSyncRuns.completedAt })
      .from(qboSyncRuns)
      .where(eq(qboSyncRuns.orgId, orgId))
      .orderBy(desc(qboSyncRuns.completedAt))
      .limit(1),
    context.db
      .select({ updatedAt: taxProfiles.updatedAt })
      .from(taxProfiles)
      .where(eq(taxProfiles.orgId, orgId))
      .limit(1),
  ])
  const rows = [
    state(
      'stripe',
      !!stripe && stripe.status === 'connected',
      stripe?.lastEventAt ?? stripe?.connectedAt ?? null,
      stripe
        ? 'Stored organization connection; no sync attestation'
        : 'No stored organization connection',
    ),
    state(
      'quickbooks',
      !!qbo,
      sync?.completedAt ?? qbo?.connectedAt ?? null,
      qbo ? 'Stored organization connection' : 'No stored organization connection',
    ),
    state(
      'tax-engine',
      !!tax,
      tax?.updatedAt ?? null,
      tax ? 'Organization tax profile configured' : 'No organization tax profile',
    ),
  ]
  for (const key of ['hubspot', 'outlook-calendar', 'google-calendar'] as const) {
    let connected = false,
      details = 'Platform operator access is required for this configured global client'
    try {
      const result = await withCfoPlatformPurpose(
        context,
        'integrations:view',
        async (operator) => {
          if (operator.userId !== context.userId) throw new CfoScopeError()
          return configuredHealth(operator, key, 'integrations:view')
        },
      )
      connected = result.ok
      details = connected
        ? 'Configured global client connectivity verified'
        : 'Global client is not configured or reachable'
    } catch (error) {
      if (!(error instanceof CfoScopeError)) details = 'Global client connectivity unavailable'
    }
    rows.push(state(key, connected, connected ? new Date() : null, details))
  }
  return rows
}
export async function checkIntegration(context: CfoActionContext, key: IntegrationProvider) {
  const value = provider(key),
    result = await configuredHealth(context, value, 'integrations:manage')
  if (!result.ok) return { success: false, message: 'Configured global client is not reachable' }
  const [receipt] = await context.db
    .insert(auditLog)
    .values({
      action: 'integration.connectivity_checked',
      actorId: context.userId,
      entityType: 'integration',
      orgId: null,
      metadata: {
        provider: value,
        operation: 'connectivity-check',
        authoritySource: 'cfo.platform-permissions',
        permission: 'integrations:manage',
      },
    })
    .returning({ id: auditLog.id })
  if (!receipt) throw new Error('Integration receipt was not stored')
  return {
    success: true,
    message: `${value} connectivity verified; no synchronization was performed`,
  }
}
export async function connectScopedIntegration(
  context: OrganizationContext,
  key: IntegrationProvider,
): Promise<{ success: boolean; message: string; redirectUrl?: string }> {
  assertCfoContextPermission(context, 'integrations:manage')
  provider(key)
  const orgId = context.organizationId
  if (key === 'quickbooks') throw new CfoCapabilityUnavailableError('QBO_OAUTH_SOURCE_UNAVAILABLE')
  if (key === 'tax-engine') {
    const [profile] = await context.db
      .select({ id: taxProfiles.id })
      .from(taxProfiles)
      .where(eq(taxProfiles.orgId, orgId))
      .limit(1)
    return {
      success: !!profile,
      message: profile
        ? 'Organization tax profile is configured'
        : 'Tax profile is not configured for this organization',
    }
  }
  return withCfoPlatformPurpose(context, 'integrations:manage', async (operator) => {
    if (operator.userId !== context.userId) throw new CfoScopeError()
    if (key !== 'stripe') {
      const result = await configuredHealth(operator, key, 'integrations:manage')
      return {
        success: result.ok,
        message: result.ok
          ? 'Configured global client connectivity verified'
          : 'Global client is not configured or reachable',
      }
    }
    global(operator, 'integrations:manage')
    const accountId = process.env.STRIPE_ACCOUNT_ID,
      client = getStripeClient()
    if (!client || !accountId || !/^acct_[A-Za-z0-9]+$/.test(accountId))
      return { success: false, message: 'An explicit configured Stripe account is required' }
    const account = await client.accounts.retrieve(accountId)
    if (account.id !== accountId || ('deleted' in account && account.deleted))
      return { success: false, message: 'Configured Stripe account verification failed' }
    await context.db.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`cfo.integration:${orgId}:stripe`}))`,
    )
    const [existing] = await context.db
      .select({ id: stripeConnections.id, accountId: stripeConnections.accountId })
      .from(stripeConnections)
      .where(eq(stripeConnections.orgId, orgId))
      .orderBy(desc(stripeConnections.updatedAt))
      .limit(1)
    if (existing && existing.accountId !== accountId)
      return {
        success: false,
        message: 'Stored organization account differs from the configured account',
      }
    const id =
      existing?.id ??
      (
        await context.db
          .insert(stripeConnections)
          .values({
            orgId,
            accountId,
            livemode: process.env.NODE_ENV === 'production',
            status: 'connected',
            connectedBy: context.userId,
          })
          .returning({ id: stripeConnections.id })
      )[0]?.id
    if (!id) throw new Error('Organization Stripe connection was not stored')
    await appendCfoPrimaryAudit(context, {
      organizationId: orgId,
      action: 'cfo.integration.connection_verified',
      targetType: 'stripe_connection',
      targetId: id,
      afterJson: {
        provider: 'stripe',
        connectionId: id,
        authoritySource: cfoAuthoritySource(context, orgId, 'integrations:manage'),
      },
    })
    return { success: true, message: 'Organization Stripe account verified' }
  })
}
export async function taxDeadlines(context: OrganizationContext) {
  assertCfoContextPermission(context, 'tax_tools:view')
  const [profile] = await context.db
    .select({
      fiscalYearEnd: taxProfiles.fiscalYearEnd,
      province: taxProfiles.provinceOfRegistration,
    })
    .from(taxProfiles)
    .where(eq(taxProfiles.orgId, context.organizationId))
    .limit(1)
  return getUpcomingDeadlines(new Date().getFullYear(), {
    fiscalYearEnd: profile?.fiscalYearEnd ?? undefined,
    province: profile?.province ?? undefined,
  })
}
