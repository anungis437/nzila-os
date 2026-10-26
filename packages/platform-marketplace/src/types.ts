/**
 * @nzila/platform-marketplace — Types
 *
 * Integration marketplace: provider manifests, installation lifecycle,
 * and redacted configuration export for proof packs.
 *
 * @module @nzila/platform-marketplace/types
 */
import { z } from 'zod'

// ── Provider Manifest ───────────────────────────────────────────────────────

export type ProviderStatus = 'available' | 'installed' | 'suspended' | 'deprecated'

export interface ProviderManifest {
  readonly providerKey: string
  readonly name: string
  readonly version: string
  readonly description: string
  readonly category: string
  readonly scopes: readonly string[]
  readonly webhookSigning: WebhookSigningConfig
  readonly retryPolicy: RetryPolicyConfig
  readonly requiredSecrets: readonly RequiredSecret[]
  readonly healthCheckUrl?: string
  readonly documentationUrl?: string
  readonly iconUrl?: string
  readonly metadata: Record<string, string>
}

export interface WebhookSigningConfig {
  readonly algorithm: 'hmac-sha256' | 'hmac-sha1' | 'rsa-sha256'
  readonly headerName: string
  readonly timestampHeaderName?: string
  readonly toleranceSeconds?: number
}

export interface RetryPolicyConfig {
  readonly maxAttempts: number
  readonly initialDelayMs: number
  readonly maxDelayMs: number
  readonly backoffMultiplier: number
}

export interface RequiredSecret {
  readonly key: string
  readonly description: string
  readonly example?: string
  readonly required: boolean
}

// ── Installation ────────────────────────────────────────────────────────────

export type InstallationStatus = 'pending' | 'validating' | 'active' | 'failed' | 'uninstalled'

export interface ProviderInstallation {
  readonly installationId: string
  readonly orgId: string
  readonly providerKey: string
  readonly status: InstallationStatus
  readonly installedBy: string
  readonly installedAt: string
  readonly secretsValidated: boolean
  readonly testCallSucceeded: boolean
  readonly testCallAt?: string
  readonly configuration: Record<string, string>
  readonly lastError?: string
}

// ── Export for Proof Pack ───────────────────────────────────────────────────

export interface RedactedProviderConfig {
  readonly providerKey: string
  readonly name: string
  readonly version: string
  readonly status: InstallationStatus
  readonly scopes: readonly string[]
  readonly secretsConfigured: boolean
  readonly testCallSucceeded: boolean
  readonly installedAt: string
  readonly installedBy: string
  /** All secret values are redacted to "***" */
  readonly redactedConfiguration: Record<string, string>
}

// ── Ports ───────────────────────────────────────────────────────────────────

export interface MarketplacePorts {
  /** Load a provider manifest by key */
  readonly loadManifest: (providerKey: string) => Promise<ProviderManifest | null>
  /** List all available provider manifests */
  readonly listManifests: () => Promise<readonly ProviderManifest[]>
  /** Save an installation record */
  readonly saveInstallation: (installation: ProviderInstallation) => Promise<void>
  /** Load installation by org + provider */
  readonly loadInstallation: (orgId: string, providerKey: string) => Promise<ProviderInstallation | null>
  /** List installations for an org */
  readonly listInstallations: (orgId: string) => Promise<readonly ProviderInstallation[]>
  /** Validate that secrets are set and well-formed */
  readonly validateSecrets: (providerKey: string, secrets: Record<string, string>) => Promise<boolean>
  /** Run a test API call against the provider */
  readonly runTestCall: (providerKey: string, secrets: Record<string, string>) => Promise<{ ok: boolean; error?: string }>
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

export const webhookSigningSchema = z.object({
  algorithm: z.enum(['hmac-sha256', 'hmac-sha1', 'rsa-sha256']),
  headerName: z.string().min(1),
  timestampHeaderName: z.string().optional(),
  toleranceSeconds: z.number().int().positive().optional(),
})

export const retryPolicySchema = z.object({
  maxAttempts: z.number().int().positive(),
  initialDelayMs: z.number().int().positive(),
  maxDelayMs: z.number().int().positive(),
  backoffMultiplier: z.number().positive(),
})

export const requiredSecretSchema = z.object({
  key: z.string().min(1),
  description: z.string(),
  example: z.string().optional(),
  required: z.boolean(),
})

export const providerManifestSchema = z.object({
  providerKey: z.string().min(1),
  name: z.string().min(1),
  version: z.string(),
  description: z.string(),
  category: z.string().min(1),
  scopes: z.array(z.string()),
  webhookSigning: webhookSigningSchema,
  retryPolicy: retryPolicySchema,
  requiredSecrets: z.array(requiredSecretSchema),
  healthCheckUrl: z.string().url().optional(),
  documentationUrl: z.string().url().optional(),
  iconUrl: z.string().url().optional(),
  metadata: z.record(z.string()).prefault({}),
})
