/**
 * Nzila OS — Org Activation Matrix (Server Actions)
 *
 * Handles app activation/deactivation toggles for an org.
 * Each toggle:
 *   1. Updates the entity's policyConfig feature flags
 *   2. Records an audit event
 */
'use server'

import { platformDb } from '@nzila/db/platform'
import { entities } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { recordAuditEvent } from '@/lib/audit-db'
import { auth } from '@clerk/nextjs/server'
import { getUserRole } from '@/lib/rbac'

export const MANAGED_APPS = [
  'union-eyes',
  'zonga',
  'shop-quoter',
  'cfo',
  'nacp',
  'abr',
] as const

export type ManagedApp = (typeof MANAGED_APPS)[number]

export interface AppActivationState {
  app: ManagedApp
  enabled: boolean
}

/**
 * Get the current activation state for all managed apps in an org.
 */
export async function getOrgActivationState(
  orgId: string,
): Promise<AppActivationState[]> {
  const [entity] = await platformDb
    .select({ policyConfig: entities.policyConfig })
    .from(entities)
    .where(eq(entities.id, orgId))
    .limit(1)

  const config = (entity?.policyConfig ?? {}) as Record<string, unknown>
  const flags = (config.featureFlags ?? {}) as Record<string, boolean>

  return MANAGED_APPS.map((app) => ({
    app,
    enabled: flags[app] ?? false,
  }))
}

/**
 * Toggle an app's activation state for an org.
 * Records an audit event for traceability.
 */
export async function toggleAppActivation(
  orgId: string,
  app: ManagedApp,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { success: false, error: 'Unauthorized' }

  const role = await getUserRole()

  // Only platform_admin, studio_admin, or ops can toggle
  if (!['platform_admin', 'studio_admin', 'ops'].includes(role)) {
    return { success: false, error: 'Insufficient permissions' }
  }

  if (!MANAGED_APPS.includes(app)) {
    return { success: false, error: 'Invalid app name' }
  }

  // Read current config
  const [entity] = await platformDb
    .select({ policyConfig: entities.policyConfig })
    .from(entities)
    .where(eq(entities.id, orgId))
    .limit(1)

  if (!entity) return { success: false, error: 'Org not found' }

  const config = (entity.policyConfig ?? {}) as Record<string, unknown>
  const flags = (config.featureFlags ?? {}) as Record<string, boolean>
  const previousState = flags[app] ?? false

  // Update
  const updatedFlags = { ...flags, [app]: enabled }
  const updatedConfig = { ...config, featureFlags: updatedFlags }

  await platformDb
    .update(entities)
    .set({
      policyConfig: updatedConfig,
      updatedAt: new Date(),
    })
    .where(eq(entities.id, orgId))

  // Record audit event
  await recordAuditEvent({
    entityId: orgId,
    actorClerkUserId: userId,
    actorRole: role,
    action: enabled ? 'app.activate' : 'app.deactivate',
    targetType: 'feature_flag',
    beforeJson: { app, enabled: previousState },
    afterJson: { app, enabled },
  })

  return { success: true }
}
