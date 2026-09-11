/**
 * Control-plane provider/entity approval policy.
 *
 * This is the PRODUCTION SECURITY AUTHORIZATION boundary for
 * lib/integrations/control-plane.ts — NOT IntegrationRegistry (which is a
 * product/catalog object: `status: 'available' | 'beta' | ...` answers
 * "should this show up in the product UI", not "is this approved to run
 * against tenant data"). Round 40 used `registry.isAvailable()` as the
 * authorization decision; that conflated the two questions, so a future
 * catalog-only change (e.g. flipping a provider to 'beta') could silently
 * make a new adapter production-reachable, activate downstream tables,
 * and invalidate storage-authority classifications without any
 * authority-manifest review. See the round-40-correction census/tests for
 * the concrete case this caused (17 previously CONTAINED_NO_AUTHORITY
 * external-integration tables became reachable through this exact path).
 *
 * `assertKnownProvider`/entity validation in control-plane.ts MUST consult
 * this policy, not `IntegrationRegistry.isAvailable()`, for the approval
 * decision. Adding a provider here is a deliberate, reviewed security
 * decision — it must be accompanied by:
 *   1. verifying every entity's adapter write path is org+provider-scoped
 *      (no cross-tenant existence-lookup defect — see the Workday
 *      round-40-correction fix for the failure mode this guards against),
 *   2. updating every table's db/rls-storage-authority/*.ts entry to match
 *      the exact reachable DML set declared below,
 *   3. adding/updating the parameterized reachability ratchet test.
 */

export type ControlPlaneDmlOperation = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

export interface ControlPlaneEntityPolicy {
  /** Physical table(s) this entity's sync writes/reads. */
  tables: readonly string[];
  /** Minimum actual DML the adapter performs for this entity — not FULL_DML. */
  dml: readonly ControlPlaneDmlOperation[];
}

export interface ControlPlaneProviderPolicy {
  /** Entity name -> table/DML mapping, keyed exactly as capabilities.supportedEntities. */
  entities: Readonly<Record<string, ControlPlaneEntityPolicy>>;
  /**
   * Non-secret configuration keys this provider's adapter is allowed to
   * read from a config's `settings` object. Any other key is rejected at
   * the API boundary — `settings` is echoed back verbatim via GET, so it
   * must never be able to hold secret-shaped values (tokens, client
   * secrets, API keys). Real credential material has no resolution path
   * in this codebase yet (`credentialRef` is a placeholder, never
   * resolved to a vault-backed secret) — that gap is out of scope for
   * this policy, which only closes the observable leak.
   */
  publicSettingsKeys: readonly string[];
}

/**
 * The only providers approved to execute against tenant data through
 * app/api/integrations/framework/**. A provider absent from this map is
 * rejected by assertKnownProvider regardless of IntegrationRegistry status.
 *
 * OTPP is registered in IntegrationRegistry as 'beta' but is deliberately
 * excluded here: IntegrationFactory.createInstance() throws
 * 'NOT_IMPLEMENTED' for OTPP, so it has no functioning adapter — approving
 * it here would be aspirational, not evidence-backed.
 *
 * SHAREPOINT is deliberately excluded: it has no IntegrationRegistry entry
 * at all (registry.isAvailable('sharepoint') is false), so it cannot
 * reach IntegrationFactory today regardless of this policy. Do not add it
 * here until it is actually registered AND its adapter's write paths are
 * verified org-scoped.
 */
export const CONTROL_PLANE_PROVIDER_POLICY: Readonly<Record<string, ControlPlaneProviderPolicy>> = Object.freeze({
  workday: Object.freeze({
    entities: Object.freeze({
      employees: Object.freeze({ tables: ['external_employees'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      positions: Object.freeze({ tables: ['external_positions'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      departments: Object.freeze({ tables: ['external_departments'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
    }),
    publicSettingsKeys: ['tenantUrl', 'organizationId', 'environment'],
  }),
  bamboohr: Object.freeze({
    entities: Object.freeze({
      employees: Object.freeze({ tables: ['external_employees'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      departments: Object.freeze({ tables: ['external_departments'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
    }),
    publicSettingsKeys: ['subdomain'],
  }),
  adp: Object.freeze({
    entities: Object.freeze({
      employees: Object.freeze({ tables: ['external_employees'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      departments: Object.freeze({ tables: ['external_departments'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
    }),
    publicSettingsKeys: ['clientId'],
  }),
  quickbooks: Object.freeze({
    entities: Object.freeze({
      invoices: Object.freeze({ tables: ['external_invoices'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      payments: Object.freeze({ tables: ['external_payments'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      customers: Object.freeze({ tables: ['external_customers'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      accounts: Object.freeze({ tables: ['external_accounts'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
    }),
    publicSettingsKeys: ['realmId', 'environment'],
  }),
  xero: Object.freeze({
    entities: Object.freeze({
      invoices: Object.freeze({ tables: ['external_invoices'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      payments: Object.freeze({ tables: ['external_payments'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      customers: Object.freeze({ tables: ['external_customers'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      accounts: Object.freeze({ tables: ['external_accounts'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
    }),
    publicSettingsKeys: ['tenantId'],
  }),
  sunlife: Object.freeze({
    entities: Object.freeze({
      plans: Object.freeze({ tables: ['external_benefit_plans'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      enrollments: Object.freeze({ tables: ['external_benefit_enrollments'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      dependents: Object.freeze({ tables: ['external_benefit_dependents'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      coverage: Object.freeze({ tables: ['external_benefit_coverage'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
    }),
    publicSettingsKeys: ['groupPolicyNumber'],
  }),
  manulife: Object.freeze({
    entities: Object.freeze({
      claims: Object.freeze({ tables: ['external_insurance_claims'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      policies: Object.freeze({ tables: ['external_insurance_policies'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      beneficiaries: Object.freeze({ tables: ['external_insurance_beneficiaries'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      utilization: Object.freeze({ tables: ['external_benefit_utilization'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
    }),
    publicSettingsKeys: ['groupPolicyNumber'],
  }),
  linkedin_learning: Object.freeze({
    entities: Object.freeze({
      courses: Object.freeze({ tables: ['external_lms_courses'], dml: ['INSERT', 'UPDATE'] as const }),
      enrollments: Object.freeze({ tables: ['external_lms_enrollments'], dml: ['INSERT', 'UPDATE'] as const }),
      progress: Object.freeze({ tables: ['external_lms_progress'], dml: ['INSERT', 'UPDATE'] as const }),
      completions: Object.freeze({ tables: ['external_lms_completions'], dml: ['INSERT', 'UPDATE'] as const }),
      learners: Object.freeze({ tables: ['external_lms_learners'], dml: ['INSERT', 'UPDATE'] as const }),
    }),
    publicSettingsKeys: ['organizationUrn'],
  }),
  slack: Object.freeze({
    entities: Object.freeze({
      channels: Object.freeze({ tables: ['external_communication_channels'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      messages: Object.freeze({ tables: ['external_communication_messages'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      users: Object.freeze({ tables: ['external_communication_users'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      files: Object.freeze({ tables: ['external_communication_files'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
    }),
    publicSettingsKeys: ['workspaceId', 'apiUrl'],
  }),
  microsoft_teams: Object.freeze({
    entities: Object.freeze({
      channels: Object.freeze({ tables: ['external_communication_channels'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      messages: Object.freeze({ tables: ['external_communication_messages'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      users: Object.freeze({ tables: ['external_communication_users'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
      files: Object.freeze({ tables: ['external_communication_files'], dml: ['SELECT', 'INSERT', 'UPDATE'] as const }),
    }),
    publicSettingsKeys: ['tenantId', 'teamId'],
  }),
});

export function isProviderApprovedForControlPlane(provider: string): boolean {
  return provider in CONTROL_PLANE_PROVIDER_POLICY;
}

export function getApprovedEntityNames(provider: string): readonly string[] {
  const policy = CONTROL_PLANE_PROVIDER_POLICY[provider];
  return policy ? Object.keys(policy.entities) : [];
}

/** Returns the subset of `requested` that is NOT an approved entity for `provider`. */
export function findUnapprovedEntities(provider: string, requested: readonly string[]): string[] {
  const approved = new Set(getApprovedEntityNames(provider));
  return requested.filter((e) => !approved.has(e));
}

/** Returns the subset of `settingsKeys` that is NOT an approved public setting for `provider`. */
export function findDisallowedSettingsKeys(provider: string, settingsKeys: readonly string[]): string[] {
  const policy = CONTROL_PLANE_PROVIDER_POLICY[provider];
  const approved = new Set(policy?.publicSettingsKeys ?? []);
  return settingsKeys.filter((k) => !approved.has(k));
}
