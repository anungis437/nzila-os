/**
 * Org Provisioning Automation
 *
 * Automates new org onboarding with:
 * - Resource quota assignment
 * - Database schema provisioning (RLS)
 * - Default configuration
 * - Evidence trail for compliance
 *
 * Invariant: Every org operation is org-scoped.
 */

import { z } from 'zod';

// ── Schemas ───────────────────────────────────────────────────────────────────

export const OrgTierSchema = z.enum(['free', 'starter', 'professional', 'enterprise']);
export type OrgTier = z.infer<typeof OrgTierSchema>;

export const OrgProvisionRequestSchema = z.object({
  orgId: z.string().min(1, 'orgId is required'),
  orgName: z.string().min(1),
  tier: OrgTierSchema,
  region: z.string().default('canadacentral'),
  adminEmail: z.string().email(),
  features: z.array(z.string()).default([]),
  metadata: z.record(z.string()).optional(),
});

export type OrgProvisionRequest = z.infer<typeof OrgProvisionRequestSchema>;

export const OrgConfigSchema = z.object({
  orgId: z.string(),
  tier: OrgTierSchema,
  quotas: z.object({
    maxUsers: z.number(),
    maxAiRequestsPerDay: z.number(),
    maxStorageGb: z.number(),
    maxApiCallsPerDay: z.number(),
    maxIntegrations: z.number(),
  }),
  features: z.array(z.string()),
  database: z.object({
    rlsEnabled: z.boolean(),
    schema: z.string(),
  }),
  security: z.object({
    mfaRequired: z.boolean(),
    sessionTimeoutMinutes: z.number(),
    ipAllowlist: z.array(z.string()),
  }),
  provisionedAt: z.string().datetime(),
  provisionedBy: z.string(),
});

export type OrgConfig = z.infer<typeof OrgConfigSchema>;

// ── Tier-Based Defaults ───────────────────────────────────────────────────────

const TIER_DEFAULTS: Record<OrgTier, Omit<OrgConfig, 'orgId' | 'tier' | 'features' | 'provisionedAt' | 'provisionedBy'>> = {
  free: {
    quotas: {
      maxUsers: 5,
      maxAiRequestsPerDay: 100,
      maxStorageGb: 1,
      maxApiCallsPerDay: 1_000,
      maxIntegrations: 1,
    },
    database: { rlsEnabled: true, schema: 'org_free' },
    security: { mfaRequired: false, sessionTimeoutMinutes: 480, ipAllowlist: [] },
  },
  starter: {
    quotas: {
      maxUsers: 25,
      maxAiRequestsPerDay: 5_000,
      maxStorageGb: 25,
      maxApiCallsPerDay: 50_000,
      maxIntegrations: 5,
    },
    database: { rlsEnabled: true, schema: 'org_starter' },
    security: { mfaRequired: false, sessionTimeoutMinutes: 480, ipAllowlist: [] },
  },
  professional: {
    quotas: {
      maxUsers: 100,
      maxAiRequestsPerDay: 50_000,
      maxStorageGb: 250,
      maxApiCallsPerDay: 500_000,
      maxIntegrations: 20,
    },
    database: { rlsEnabled: true, schema: 'org_professional' },
    security: { mfaRequired: true, sessionTimeoutMinutes: 240, ipAllowlist: [] },
  },
  enterprise: {
    quotas: {
      maxUsers: -1, // unlimited
      maxAiRequestsPerDay: 1_000_000,
      maxStorageGb: 5_000,
      maxApiCallsPerDay: -1, // unlimited
      maxIntegrations: -1, // unlimited
    },
    database: { rlsEnabled: true, schema: 'org_enterprise' },
    security: { mfaRequired: true, sessionTimeoutMinutes: 120, ipAllowlist: [] },
  },
};

// ── Provisioning ──────────────────────────────────────────────────────────────

export interface ProvisioningStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface ProvisioningResult {
  orgId: string;
  status: 'success' | 'partial' | 'failed';
  config: OrgConfig;
  steps: ProvisioningStep[];
  duration: number;
}

/**
 * Provision a new org with tier-appropriate resources.
 *
 * Executes provisioning steps in sequence:
 * 1. Validate request
 * 2. Create org configuration
 * 3. Provision database schema (RLS)
 * 4. Set up resource quotas
 * 5. Configure security policies
 * 6. Enable features
 * 7. Record evidence
 */
export async function provisionOrg(
  request: OrgProvisionRequest,
  executor: ProvisioningExecutor = defaultExecutor,
): Promise<ProvisioningResult> {
  const validated = OrgProvisionRequestSchema.parse(request);
  const start = Date.now();

  const tierDefaults = TIER_DEFAULTS[validated.tier];
  const config: OrgConfig = {
    orgId: validated.orgId,
    tier: validated.tier,
    ...tierDefaults,
    features: validated.features,
    provisionedAt: new Date().toISOString(),
    provisionedBy: validated.adminEmail,
  };

  const steps: ProvisioningStep[] = [
    { name: 'validate-request', status: 'pending' },
    { name: 'create-configuration', status: 'pending' },
    { name: 'provision-database', status: 'pending' },
    { name: 'setup-quotas', status: 'pending' },
    { name: 'configure-security', status: 'pending' },
    { name: 'enable-features', status: 'pending' },
    { name: 'record-evidence', status: 'pending' },
  ];

  let hasFailure = false;

  for (const step of steps) {
    step.status = 'running';
    step.startedAt = new Date().toISOString();

    try {
      await executor.execute(step.name, config);
      step.status = 'completed';
      step.completedAt = new Date().toISOString();
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : String(error);
      step.completedAt = new Date().toISOString();
      hasFailure = true;

      // Continue with remaining steps for partial provisioning
    }
  }

  const allFailed = steps.every((s) => s.status === 'failed');

  return {
    orgId: validated.orgId,
    status: allFailed ? 'failed' : hasFailure ? 'partial' : 'success',
    config,
    steps,
    duration: Date.now() - start,
  };
}

// ── Deprovisioning ────────────────────────────────────────────────────────────

export interface DeprovisionResult {
  orgId: string;
  status: 'success' | 'failed';
  dataRetentionDays: number;
  steps: ProvisioningStep[];
}

/**
 * Deprovision an org with data retention compliance.
 *
 * Steps:
 * 1. Disable access (immediate)
 * 2. Export data for retention
 * 3. Remove quota allocations
 * 4. Schedule data deletion after retention period
 * 5. Record evidence
 */
export async function deprovisionOrg(
  orgId: string,
  reason: string,
  executor: ProvisioningExecutor = defaultExecutor,
): Promise<DeprovisionResult> {
  if (!orgId) throw new Error('orgId is required');

  // Data retention: 90 days for compliance
  const dataRetentionDays = 90;

  const steps: ProvisioningStep[] = [
    { name: 'disable-access', status: 'pending' },
    { name: 'export-data', status: 'pending' },
    { name: 'remove-quotas', status: 'pending' },
    { name: 'schedule-deletion', status: 'pending' },
    { name: 'record-evidence', status: 'pending' },
  ];

  let hasFailure = false;

  for (const step of steps) {
    step.status = 'running';
    step.startedAt = new Date().toISOString();

    try {
      await executor.execute(step.name, { orgId, reason, dataRetentionDays });
      step.status = 'completed';
      step.completedAt = new Date().toISOString();
    } catch (error) {
      step.status = 'failed';
      step.error = error instanceof Error ? error.message : String(error);
      hasFailure = true;
    }
  }

  return {
    orgId,
    status: hasFailure ? 'failed' : 'success',
    dataRetentionDays,
    steps,
  };
}

// ── Executor Interface ────────────────────────────────────────────────────────

export interface ProvisioningExecutor {
  execute(step: string, context: unknown): Promise<void>;
}

/** Default no-op executor (for testing / dry-run) */
const defaultExecutor: ProvisioningExecutor = {
  execute: async () => {},
};
