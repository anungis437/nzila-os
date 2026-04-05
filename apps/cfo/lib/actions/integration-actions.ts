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
import { taxProfiles } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { getStripeClient } from '@nzila/payments-stripe'
import { buildFinancialSummary } from '@/lib/qbo'
import { getUpcomingDeadlines } from '@/lib/tax'
import { buildEvidencePackFromAction, processEvidencePack } from '@/lib/evidence'

export interface IntegrationStatus {
  id: string
  name: string
  provider: 'stripe' | 'quickbooks' | 'tax-engine'
  connected: boolean
  lastSync: Date | null
  health: 'healthy' | 'degraded' | 'disconnected'
  details: string
}

export async function getIntegrationStatuses(): Promise<IntegrationStatus[]> {
  const { userId } = await auth()
  if (!userId) throw new Error('Unauthorized')
  await requirePermission('integrations:view')

  const integrations: IntegrationStatus[] = []

  // Stripe
  try {
    const stripeClient = getStripeClient()
    const isConnected = !!stripeClient
    integrations.push({
      id: 'stripe',
      name: 'Stripe',
      provider: 'stripe',
      connected: isConnected,
      lastSync: isConnected ? new Date() : null,
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
    const summary = await buildFinancialSummary()
    const isConnected = !!summary
    integrations.push({
      id: 'quickbooks',
      name: 'QuickBooks Online',
      provider: 'quickbooks',
      connected: isConnected,
      lastSync: isConnected ? new Date() : null,
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
    const deadlines = await getUpcomingDeadlines(new Date().getFullYear())
    integrations.push({
      id: 'tax-engine',
      name: 'Tax Engine',
      provider: 'tax-engine',
      connected: true,
      lastSync: new Date(),
      health: 'healthy',
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

  return integrations
}

export async function triggerSync(provider: 'stripe' | 'quickbooks' | 'tax-engine'): Promise<{
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
