/**
 * Platform Admin — Control Plane Client
 *
 * Platform Admin MUST route all mutations through this client.
 * Direct DB calls, direct policy evaluation, or direct feature-flag
 * reads are forbidden from Platform Admin.
 *
 * This is a thin re-export of the shared client from platform-contracts,
 * combined with an org-scope assertion to prevent cross-org mutations.
 */

import {
  getControlPlaneClient,
  createControlPlaneClient,
  type ControlPlaneClient,
  type EntitlementResult,
} from '@nzila/platform-contracts/control-plane-client'

export { getControlPlaneClient, createControlPlaneClient }
export type { ControlPlaneClient, EntitlementResult }

/**
 * Org-scoped wrapper around the Control Plane client.
 * Automatically injects orgId on every call and prevents
 * cross-org access.
 */
export function getOrgScopedCpClient(orgId: string) {
  const cp = getControlPlaneClient()

  return {
    /**
     * Check if a feature is entitled for THIS org only.
     */
    async checkEntitlement(
      feature: string,
      actorId?: string,
    ): Promise<EntitlementResult> {
      return cp.resolveEntitlement({ orgId, feature, actorId })
    },

    /**
     * Get recent decisions for THIS org only.
     */
    async getOrgDecisions(filter?: { correlationId?: string; workflowId?: string }) {
      return cp.getDecisions({ orgId, ...filter })
    },
  }
}
