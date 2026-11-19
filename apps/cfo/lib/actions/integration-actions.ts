/** Stored tenant connections and explicitly privileged global provider clients. */
'use server'
import { logger } from '@/lib/logger'
import { CfoScopeError, resolveOrgContext } from '@/lib/resolve-org'
import {
  integrationStatuses,
  checkIntegration,
  connectScopedIntegration,
  taxDeadlines,
  type IntegrationStatus,
  type IntegrationProvider,
} from '@/lib/services/integrations'
export type { IntegrationStatus, IntegrationProvider } from '@/lib/services/integrations'
/** Log a failed action with the structured logger and rethrow it unchanged.
 * Scope denials are not operational failures and are not logged here. */
function logged<T>(operation: string, run: () => Promise<T>): Promise<T> {
  return run().catch((error: unknown) => {
    if (!(error instanceof CfoScopeError))
      logger.error(`Integration ${operation} failed`, { error })
    throw error
  })
}
export async function getIntegrationStatuses(
  organizationId?: string,
): Promise<IntegrationStatus[]> {
  return logged('status read', () =>
    resolveOrgContext(
      'organization',
      { permission: 'integrations:view', organizationId },
      integrationStatuses,
    ),
  )
}
export async function triggerSync(
  provider: IntegrationProvider,
): Promise<{ success: boolean; message: string }> {
  return logged('connectivity check', () =>
    resolveOrgContext('platform', { permission: 'integrations:manage' }, (context) =>
      checkIntegration(context, provider),
    ),
  )
}
export async function connectIntegration(
  provider: IntegrationProvider,
  organizationId?: string,
): Promise<{ success: boolean; message: string; redirectUrl?: string }> {
  return logged('connect', () =>
    resolveOrgContext(
      'organization',
      { permission: 'integrations:manage', organizationId },
      (context) => connectScopedIntegration(context, provider),
    ),
  )
}
export async function getTaxDeadlines(orgId?: string) {
  return logged('tax deadline read', () =>
    resolveOrgContext(
      'organization',
      { permission: 'tax_tools:view', organizationId: orgId },
      taxDeadlines,
    ),
  )
}
