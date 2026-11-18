/** Stored tenant connections and explicitly privileged global provider clients. */
'use server'
import { resolveOrgContext } from '@/lib/resolve-org'
import {
  integrationStatuses,
  checkIntegration,
  connectScopedIntegration,
  taxDeadlines,
  type IntegrationStatus,
  type IntegrationProvider,
} from '@/lib/services/integrations'
export type { IntegrationStatus, IntegrationProvider } from '@/lib/services/integrations'
export async function getIntegrationStatuses(
  organizationId?: string,
): Promise<IntegrationStatus[]> {
  return resolveOrgContext(
    'organization',
    { permission: 'integrations:view', organizationId },
    integrationStatuses,
  )
}
export async function triggerSync(
  provider: IntegrationProvider,
): Promise<{ success: boolean; message: string }> {
  return resolveOrgContext('platform', { permission: 'integrations:manage' }, (context) =>
    checkIntegration(context, provider),
  )
}
export async function connectIntegration(
  provider: IntegrationProvider,
  organizationId?: string,
): Promise<{ success: boolean; message: string; redirectUrl?: string }> {
  return resolveOrgContext(
    'organization',
    { permission: 'integrations:manage', organizationId },
    (context) => connectScopedIntegration(context, provider),
  )
}
export async function getTaxDeadlines(orgId?: string) {
  return resolveOrgContext(
    'organization',
    { permission: 'tax_tools:view', organizationId: orgId },
    taxDeadlines,
  )
}
