/**
 * @nzila/ai-core — Cross-Tenant Data Governance Policy (NZ-RISK-017)
 *
 * Enforces that AI analytics, model training, and aggregate queries
 * NEVER span multiple organizations without explicit opt-in consent.
 *
 * This is the code-level enforcement counterpart of the governance policy
 * described in governance/ai/AI_DATA_GOVERNANCE.md.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface CrossTenantAnalyticsRequest {
  /** The org initiating the request */
  requestingOrgId: string;
  /** Org IDs whose data would be included in the analytics */
  targetOrgIds: string[];
  /** Purpose of the cross-tenant access */
  purpose: string;
  /** The actor requesting the operation */
  actor: string;
}

export interface DataGovernanceResult {
  allowed: boolean;
  reason: string;
}

// ── Guard ───────────────────────────────────────────────────────────────────

/**
 * Asserts that an analytics or training-data operation does NOT aggregate
 * data across multiple organizations. Throws if it does.
 *
 * Call this guard at the entry point of any analytics pipeline, batch
 * export, or model-training job that accepts an orgId filter.
 *
 * @throws {Error} When the request attempts cross-tenant aggregation
 */
export function assertNoCrossTenantAggregation(
  request: CrossTenantAnalyticsRequest,
): DataGovernanceResult {
  const uniqueOrgs = new Set([request.requestingOrgId, ...request.targetOrgIds]);

  if (uniqueOrgs.size > 1) {
    const msg =
      `[NZ-RISK-017] Cross-tenant data aggregation denied. ` +
      `Org "${request.requestingOrgId}" attempted to access data from ` +
      `${uniqueOrgs.size} organizations (${[...uniqueOrgs].join(', ')}). ` +
      `Purpose: "${request.purpose}". ` +
      `Cross-org analytics require explicit opt-in consent per the ` +
      `AI Data Governance Policy (governance/ai/AI_DATA_GOVERNANCE.md).`;

    throw new Error(msg);
  }

  return {
    allowed: true,
    reason: 'Single-org operation — no cross-tenant aggregation',
  };
}

/**
 * Non-throwing variant — returns a result instead of throwing.
 * Useful for policy-check endpoints that return structured decisions.
 */
export function checkCrossTenantPolicy(
  request: CrossTenantAnalyticsRequest,
): DataGovernanceResult {
  const uniqueOrgs = new Set([request.requestingOrgId, ...request.targetOrgIds]);

  if (uniqueOrgs.size > 1) {
    return {
      allowed: false,
      reason:
        `Cross-tenant aggregation across ${uniqueOrgs.size} organizations is prohibited ` +
        `without explicit opt-in consent. See AI Data Governance Policy.`,
    };
  }

  return {
    allowed: true,
    reason: 'Single-org operation — no cross-tenant aggregation',
  };
}
