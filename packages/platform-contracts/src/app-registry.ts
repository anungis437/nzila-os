/**
 * @nzila/platform-contracts — Control Plane App Registry
 *
 * Extends module-registry with full control-plane authority:
 * - Governance / compliance requirements per app
 * - Integration dependency declarations
 * - Health contract bindings
 * - Feature flag namespacing
 * - Deployment tier and environment metadata
 * - Policy attachment model
 * - Reporting bindings
 *
 * The control plane uses this to validate app compliance,
 * aggregate health, enforce policies, and manage app lifecycle.
 */
import { z } from 'zod'
import { moduleRegistrationSchema } from './module-registry.js'

// ── Governance Requirements ─────────────────────────────────────────────────

export const governanceRequirementSchema = z.object({
  /** Governance control ID (matches docs/governance/controls). */
  controlId: z.string().min(1),
  /** Human-readable control name. */
  name: z.string().min(1),
  /** Whether this control is mandatory for production. */
  mandatory: z.boolean().default(true),
  /** Evidence class required. */
  evidenceClass: z.enum(['audit-trail', 'hash-chain', 'dual-control', 'none']).default('audit-trail'),
  /** Retention period. */
  retentionClass: z.enum(['90_DAYS', '1_YEAR', '3_YEARS', '7_YEARS', 'PERMANENT']).default('7_YEARS'),
})

export type GovernanceRequirement = z.infer<typeof governanceRequirementSchema>

// ── Integration Dependency ──────────────────────────────────────────────────

export const integrationDependencySchema = z.object({
  /** Integration provider name. */
  provider: z.string().min(1),
  /** Whether this integration is required for the app to function. */
  required: z.boolean().default(false),
  /** Type of integration. */
  type: z.enum(['auth', 'payment', 'crm', 'erp', 'storage', 'messaging', 'analytics', 'ai', 'other']),
  /** Required env vars for this integration. */
  envVars: z.array(z.string()).default([]),
})

export type IntegrationDependency = z.infer<typeof integrationDependencySchema>

// ── Reporting Binding ───────────────────────────────────────────────────────

export const reportingBindingSchema = z.object({
  /** Canonical entity types this app emits. */
  entityTypes: z.array(z.string()).default([]),
  /** Canonical event types this app emits. */
  eventTypes: z.array(z.string()).default([]),
  /** Canonical metric names this app produces. */
  metricNames: z.array(z.string()).default([]),
  /** Whether this app emits financial records. */
  emitsFinancialRecords: z.boolean().default(false),
  /** Whether this app participates in canonical reporting. */
  reportingEnabled: z.boolean().default(true),
})

export type ReportingBinding = z.infer<typeof reportingBindingSchema>

// ── Health Contract Binding ─────────────────────────────────────────────────

export const healthBindingSchema = z.object({
  /** Health endpoint path (relative to base). */
  healthPath: z.string().default('/api/health'),
  /** Readiness endpoint path. */
  readinessPath: z.string().default('/api/health/ready'),
  /** Critical dependencies for health. */
  criticalDeps: z.array(z.string()).default([]),
  /** SLO targets. */
  slo: z.object({
    availabilityTarget: z.number().min(0).max(100).default(99.9),
    latencyP99Ms: z.number().positive().default(2000),
  }).optional(),
})

export type HealthBinding = z.infer<typeof healthBindingSchema>

// ── Deployment Metadata ─────────────────────────────────────────────────────

export const deploymentMetadataSchema = z.object({
  /** Container image name (ACR repository path). */
  containerImage: z.string().optional(),
  /** Docker Compose service name. */
  composeService: z.string().optional(),
  /** Azure Container App name. */
  containerAppName: z.string().optional(),
  /** Target environments. */
  environments: z.array(z.enum(['local', 'preview', 'staging', 'production'])).default(['local']),
  /** Whether the app requires a database. */
  requiresDatabase: z.boolean().default(false),
  /** Whether the app requires blob storage. */
  requiresBlobStorage: z.boolean().default(false),
})

export type DeploymentMetadata = z.infer<typeof deploymentMetadataSchema>

// ── Full App Manifest (Control-Plane Authority) ─────────────────────────────

export const appManifestSchema = moduleRegistrationSchema.extend({
  /** App type classification. */
  appType: z.enum([
    'web-app',
    'api-service',
    'background-worker',
    'static-site',
    'hybrid',
  ]).default('web-app'),

  /** Supported org scopes (org IDs or '*' for all). */
  supportedOrgScopes: z.array(z.string()).default(['*']),

  /** Governance requirements this app must satisfy. */
  governanceRequirements: z.array(governanceRequirementSchema).default([]),

  /** Integration dependencies. */
  integrationDependencies: z.array(integrationDependencySchema).default([]),

  /** Reporting bindings for canonical schema. */
  reportingBindings: reportingBindingSchema.optional(),

  /** Health contract binding. */
  healthBinding: healthBindingSchema.optional(),

  /** Feature flag namespace. */
  featureFlagNamespace: z.string().optional(),

  /** Deployment metadata. */
  deployment: deploymentMetadataSchema.optional(),

  /** Policy bundles this app is bound to. */
  policyBindings: z.array(z.string()).default([]),

  /** Domain verticals this app serves. */
  domains: z.array(z.string()).default([]),

  /** Canonical modules/capabilities enabled. */
  enabledCapabilities: z.array(z.enum([
    'auth',
    'org-scope',
    'evidence',
    'telemetry',
    'canonical-events',
    'canonical-reporting',
    'feature-flags',
    'rate-limiting',
    'webhooks',
    'health-check',
  ])).default([]),
})

export type AppManifest = z.infer<typeof appManifestSchema>

// ── Validation Helpers ──────────────────────────────────────────────────────

export function validateAppManifest(manifest: unknown): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const result = appManifestSchema.safeParse(manifest)
  const errors: string[] = []
  const warnings: string[] = []

  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`${issue.path.join('.')}: ${issue.message}`)
    }
    return { valid: false, errors, warnings }
  }

  const m = result.data

  // Production apps must have governance requirements
  if (m.tier === 'PRODUCTION' && m.governanceRequirements.length === 0) {
    warnings.push(`Production app "${m.id}" has no governance requirements declared`)
  }

  // Apps requiring org scope should have enabledCapabilities include 'org-scope'
  if (m.requiresOrgScope && !m.enabledCapabilities.includes('org-scope')) {
    warnings.push(`App "${m.id}" requires org scope but does not declare 'org-scope' capability`)
  }

  // Production apps should have health binding
  if (m.tier === 'PRODUCTION' && !m.healthBinding) {
    warnings.push(`Production app "${m.id}" has no health binding declared`)
  }

  // Apps with financial records should have evidence capability
  if (m.reportingBindings?.emitsFinancialRecords && !m.enabledCapabilities.includes('evidence')) {
    errors.push(`App "${m.id}" emits financial records but does not declare 'evidence' capability`)
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ── Platform App Registry ───────────────────────────────────────────────────

export type AppRegistryEntry = AppManifest & {
  /** Runtime registration timestamp. */
  registeredAt: string
  /** Last health check result. */
  lastHealthCheck?: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    checkedAt: string
  }
}

/**
 * Validates an entire registry of app manifests for cross-app consistency.
 */
export function validateAppRegistry(manifests: AppManifest[]): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  const ids = new Set<string>()

  for (const m of manifests) {
    // Check for duplicate IDs
    if (ids.has(m.id)) {
      errors.push(`Duplicate app ID: "${m.id}"`)
    }
    ids.add(m.id)

    // Validate individual manifest
    const result = validateAppManifest(m)
    errors.push(...result.errors)
    warnings.push(...result.warnings)
  }

  // Check that all integration dependencies reference known providers
  const knownProviders = new Set(manifests.flatMap(m =>
    m.integrationDependencies.map(d => d.provider),
  ))

  if (knownProviders.size > 0) {
    warnings.push(`Registry uses ${knownProviders.size} integration providers: ${[...knownProviders].join(', ')}`)
  }

  return { valid: errors.length === 0, errors, warnings }
}
