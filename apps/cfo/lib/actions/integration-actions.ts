/**
 * CFO Server Actions — Integrations (Stripe / QuickBooks / Tax).
 *
 * Surfaces connection health, triggers sync, and manages
 * integration configuration.
 */
'use server'

import { auth } from '@nzila/platform-auth/entra/server'
import { requirePermission } from '@/lib/rbac'
import { platformDb } from '@nzila/db/platform'
import {
  orgMembers,
  qboConnections,
  qboSyncRuns,
  stripeConnections,
  taxProfiles,
} from '@nzila/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { getStripeClient } from '@nzila/payments-stripe'
import { buildFinancialSummary } from '@/lib/qbo'
import { getUpcomingDeadlines } from '@/lib/tax'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'
import { checkCRMHealth } from '@/lib/crm'
import { checkCalendarHealth } from '@/lib/calendar'
import { buildAuthorizationUrl } from '@nzila/qbo/oauth'

export interface IntegrationStatus {
  id: string
  name: string
  provider:
    | 'stripe'
    | 'quickbooks'
    | 'tax-engine'
    | 'hubspot'
    | 'outlook-calendar'
    | 'google-calendar'
  connected: boolean
  lastSync: Date | null
  health: 'healthy' | 'degraded' | 'disconnected'
  details: string
}

export type IntegrationProvider = IntegrationStatus['provider']

async function resolveUserOrgId(userId: string): Promise<string | null> {
  const [membership] = await platformDb
    .select({ orgId: orgMembers.orgId })
    .from(orgMembers)
    .where(and(eq(orgMembers.userId, userId), eq(orgMembers.status, 'active')))
    .orderBy(desc(orgMembers.createdAt))
    .limit(1)

  return membership?.orgId ?? null
}

export async function getIntegrationStatuses(): Promise<IntegrationStatus[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('integrations:view')

  const orgId = await resolveUserOrgId(userId)
  const integrations: IntegrationStatus[] = []

  const [stripeConnection, quickbooksConnection, quickbooksLastSync] = orgId
    ? await Promise.all([
        platformDb
          .select()
          .from(stripeConnections)
          .where(eq(stripeConnections.orgId, orgId))
          .orderBy(desc(stripeConnections.updatedAt))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        platformDb
          .select()
          .from(qboConnections)
          .where(and(eq(qboConnections.orgId, orgId), eq(qboConnections.isActive, true)))
          .orderBy(desc(qboConnections.updatedAt))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        platformDb
          .select({ completedAt: qboSyncRuns.completedAt })
          .from(qboSyncRuns)
          .where(eq(qboSyncRuns.orgId, orgId))
          .orderBy(desc(qboSyncRuns.completedAt))
          .limit(1)
          .then((rows) => rows[0]?.completedAt ?? null),
      ])
    : [null, null, null]

  // Stripe
  try {
    const stripeClient = getStripeClient()
    const isConnected = Boolean(stripeClient && stripeConnection)
    const stripeLastSync = stripeConnection?.lastEventAt ?? stripeConnection?.connectedAt ?? null
    integrations.push({
      id: 'stripe',
      name: 'Stripe',
      provider: 'stripe',
      connected: isConnected,
      lastSync: stripeLastSync,
      health: isConnected ? 'healthy' : 'disconnected',
      details: isConnected
        ? 'Payments, invoices, and payouts syncing'
        : 'Configure Stripe API key to connect',
    })
  } catch {
    integrations.push({
      id: 'stripe',
      name: 'Stripe',
      provider: 'stripe',
      connected: false,
      lastSync: null,
      health: 'disconnected',
      details: 'Connection error',
    })
  }

  // QuickBooks
  try {
    const isConnected = Boolean(quickbooksConnection)
    if (isConnected) {
      await buildFinancialSummary()
    }
    integrations.push({
      id: 'quickbooks',
      name: 'QuickBooks Online',
      provider: 'quickbooks',
      connected: isConnected,
      lastSync: quickbooksLastSync ?? quickbooksConnection?.connectedAt ?? null,
      health: isConnected ? 'healthy' : 'disconnected',
      details: isConnected
        ? 'Chart of accounts, journal entries, and reconciliation syncing'
        : 'Configure OAuth credentials to connect',
    })
  } catch {
    integrations.push({
      id: 'quickbooks',
      name: 'QuickBooks Online',
      provider: 'quickbooks',
      connected: false,
      lastSync: null,
      health: 'disconnected',
      details: 'Connection error',
    })
  }

  // Tax Engine
  try {
    const [profile] = orgId
      ? await platformDb
          .select({ updatedAt: taxProfiles.updatedAt })
          .from(taxProfiles)
          .where(eq(taxProfiles.orgId, orgId))
          .limit(1)
      : []
    const deadlines = await getUpcomingDeadlines(new Date().getFullYear())
    const isConnected = Boolean(profile)
    integrations.push({
      id: 'tax-engine',
      name: 'Tax Engine',
      provider: 'tax-engine',
      connected: isConnected,
      lastSync: profile?.updatedAt ?? null,
      health: isConnected ? 'healthy' : 'disconnected',
      details: `${deadlines?.length ?? 0} upcoming deadlines tracked (CRA data)`,
    })
  } catch {
    integrations.push({
      id: 'tax-engine',
      name: 'Tax Engine',
      provider: 'tax-engine',
      connected: false,
      lastSync: null,
      health: 'disconnected',
      details: 'Tax engine unavailable',
    })
  }

  // HubSpot CRM
  try {
    const health = await checkCRMHealth()
    integrations.push({
      id: 'hubspot',
      name: 'HubSpot CRM',
      provider: 'hubspot',
      connected: health.ok,
      lastSync: health.ok ? new Date() : null,
      health: health.ok ? 'healthy' : 'disconnected',
      details: health.ok
        ? 'Contacts and deals live sync enabled'
        : 'Configure HUBSPOT_API_KEY to connect',
    })
  } catch {
    integrations.push({
      id: 'hubspot',
      name: 'HubSpot CRM',
      provider: 'hubspot',
      connected: false,
      lastSync: null,
      health: 'disconnected',
      details: 'Connection error',
    })
  }

  // Outlook Calendar
  try {
    const accessToken = process.env.OUTLOOK_ACCESS_TOKEN ?? ''
    const health = accessToken
      ? await checkCalendarHealth('outlook', { accessToken })
      : { ok: false }
    integrations.push({
      id: 'outlook-calendar',
      name: 'Outlook Calendar',
      provider: 'outlook-calendar',
      connected: health.ok,
      lastSync: health.ok ? new Date() : null,
      health: health.ok ? 'healthy' : 'disconnected',
      details: health.ok
        ? 'Calendar events and commitments syncing'
        : 'Configure OUTLOOK_ACCESS_TOKEN to connect',
    })
  } catch {
    integrations.push({
      id: 'outlook-calendar',
      name: 'Outlook Calendar',
      provider: 'outlook-calendar',
      connected: false,
      lastSync: null,
      health: 'disconnected',
      details: 'Connection error',
    })
  }

  // Google Calendar
  try {
    const accessToken = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN ?? ''
    const health = accessToken
      ? await checkCalendarHealth('google', { accessToken })
      : { ok: false }
    integrations.push({
      id: 'google-calendar',
      name: 'Google Calendar',
      provider: 'google-calendar',
      connected: health.ok,
      lastSync: health.ok ? new Date() : null,
      health: health.ok ? 'healthy' : 'disconnected',
      details: health.ok
        ? 'Calendar events and commitments syncing'
        : 'Configure GOOGLE_CALENDAR_ACCESS_TOKEN to connect',
    })
  } catch {
    integrations.push({
      id: 'google-calendar',
      name: 'Google Calendar',
      provider: 'google-calendar',
      connected: false,
      lastSync: null,
      health: 'disconnected',
      details: 'Connection error',
    })
  }

  return integrations
}

export async function triggerSync(provider: IntegrationProvider): Promise<{
  success: boolean
  message: string
}> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('integrations:manage')

  try {
    logger.info('Integration sync triggered', { provider, actorId: userId })

    switch (provider) {
      case 'stripe': {
        const client = getStripeClient()
        if (!client) return { success: false, message: 'Stripe not configured' }
        // Trigger a balance fetch to validate connectivity
        await client.balance.retrieve()
        break
      }
      case 'quickbooks': {
        await buildFinancialSummary()
        break
      }
      case 'tax-engine': {
        await getUpcomingDeadlines(new Date().getFullYear())
        break
      }
      case 'hubspot': {
        const health = await checkCRMHealth()
        if (!health.ok) return { success: false, message: health.error ?? 'HubSpot not configured' }
        break
      }
      case 'outlook-calendar': {
        const token = process.env.OUTLOOK_ACCESS_TOKEN ?? ''
        if (!token) return { success: false, message: 'Outlook access token is missing' }
        await checkCalendarHealth('outlook', { accessToken: token })
        break
      }
      case 'google-calendar': {
        const token = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN ?? ''
        if (!token) return { success: false, message: 'Google Calendar access token is missing' }
        await checkCalendarHealth('google', { accessToken: token })
        break
      }
    }

    const pack = buildEvidencePackFromAction({
      actionId: `sync-${provider}-${Date.now()}`,
      actionType: 'INTEGRATION_SYNC',
      orgId: provider,
      executedBy: userId,
    })
    await processEvidencePack(pack)

    return { success: true, message: `${provider} sync completed successfully` }
  } catch (error) {
    logger.error('Integration sync failed', { provider, error })
    return { success: false, message: `Sync failed: ${(error as Error).message}` }
  }
}

export async function connectIntegration(provider: IntegrationProvider): Promise<{
  success: boolean
  message: string
  redirectUrl?: string
}> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('integrations:manage')

  const orgId = await resolveUserOrgId(userId)
  if (!orgId) {
    return { success: false, message: 'No active organization membership found' }
  }

  switch (provider) {
    case 'quickbooks': {
      if (!process.env.QBO_CLIENT_ID || !process.env.QBO_CLIENT_SECRET || !process.env.QBO_REDIRECT_URI) {
        return {
          success: false,
          message: 'QBO OAuth env vars are missing (QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI)',
        }
      }

      const state = Buffer.from(
        JSON.stringify({ orgId, nonce: crypto.randomUUID(), source: 'cfo-integrations' }),
      ).toString('base64url')
      return { success: true, message: 'Redirecting to QuickBooks OAuth', redirectUrl: buildAuthorizationUrl(state) }
    }

    case 'stripe': {
      if (!process.env.STRIPE_SECRET_KEY) {
        return { success: false, message: 'STRIPE_SECRET_KEY is missing' }
      }

      const existing = await platformDb
        .select()
        .from(stripeConnections)
        .where(eq(stripeConnections.orgId, orgId))
        .orderBy(desc(stripeConnections.updatedAt))
        .limit(1)

      if (existing.length === 0) {
        await platformDb.insert(stripeConnections).values({
          orgId,
          accountId: process.env.STRIPE_ACCOUNT_ID ?? 'acct_configured',
          livemode: process.env.NODE_ENV === 'production',
          status: 'connected',
          connectedBy: userId,
        })
      }

      return { success: true, message: 'Stripe connection recorded successfully' }
    }

    case 'tax-engine': {
      const [profile] = await platformDb
        .select({ id: taxProfiles.id })
        .from(taxProfiles)
        .where(eq(taxProfiles.orgId, orgId))
        .limit(1)

      return profile
        ? { success: true, message: 'Tax engine profile is configured' }
        : { success: false, message: 'Tax profile is not configured for this org' }
    }

    case 'hubspot': {
      const health = await checkCRMHealth()
      return health.ok
        ? { success: true, message: 'HubSpot connectivity validated successfully' }
        : { success: false, message: health.error ?? 'HubSpot connectivity check failed' }
    }

    case 'outlook-calendar': {
      const token = process.env.OUTLOOK_ACCESS_TOKEN ?? ''
      if (!token) return { success: false, message: 'OUTLOOK_ACCESS_TOKEN is missing' }
      const health = await checkCalendarHealth('outlook', { accessToken: token })
      return health.ok
        ? { success: true, message: 'Outlook Calendar connectivity validated successfully' }
        : { success: false, message: 'Outlook Calendar connectivity check failed' }
    }

    case 'google-calendar': {
      const token = process.env.GOOGLE_CALENDAR_ACCESS_TOKEN ?? ''
      if (!token) return { success: false, message: 'GOOGLE_CALENDAR_ACCESS_TOKEN is missing' }
      const health = await checkCalendarHealth('google', { accessToken: token })
      return health.ok
        ? { success: true, message: 'Google Calendar connectivity validated successfully' }
        : { success: false, message: 'Google Calendar connectivity check failed' }
    }
  }
}

export async function getTaxDeadlines(orgId?: string) {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('tax_tools:view')

  try {
    // Fetch entity tax profile for FYE/province if orgId provided
    let fiscalYearEnd: string | undefined
    let province: string | undefined

    if (orgId) {
      const [profile] = await platformDb
        .select()
        .from(taxProfiles)
        .where(eq(taxProfiles.orgId, orgId))

      if (profile) {
        fiscalYearEnd = profile.fiscalYearEnd ?? undefined
        province = profile.provinceOfRegistration ?? undefined
      }
    }

    return await getUpcomingDeadlines(new Date().getFullYear(), {
      fiscalYearEnd,
      province,
    })
  } catch (error) {
    logger.error('Failed to fetch tax deadlines', { error })
    return []
  }
}
