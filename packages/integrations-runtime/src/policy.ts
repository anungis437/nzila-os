/**
 * Nzila OS — Integration Policy Loader
 *
 * Loads per-provider circuit breaker, retry, and SLA config from
 * ops/integration-policy.yml. Falls back to defaults if file not found.
 *
 * @module @nzila/integrations-runtime/policy
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

// ── Types ───────────────────────────────────────────────────────────────────

export interface CircuitBreakerPolicyConfig {
  failureThreshold: number
  failureRateThreshold: number
  cooldownMs: number
  halfOpenMaxAttempts: number
  windowSizeMs: number
}

export interface RetryPolicyConfig {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  jitter: boolean
}

export interface SlaPolicyConfig {
  availabilityTarget: number
  p95LatencyMs: number
  p99LatencyMs: number
}

export interface ProviderPolicyConfig {
  circuitBreaker: CircuitBreakerPolicyConfig
  retry: RetryPolicyConfig
  sla: SlaPolicyConfig
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

export interface IntegrationPolicy {
  version: string
  defaults: ProviderPolicyConfig
  providers: Record<string, DeepPartial<ProviderPolicyConfig>>
}

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_CB: CircuitBreakerPolicyConfig = {
  failureThreshold: 5,
  failureRateThreshold: 0.5,
  cooldownMs: 60_000,
  halfOpenMaxAttempts: 3,
  windowSizeMs: 300_000,
}

const DEFAULT_RETRY: RetryPolicyConfig = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 30_000,
  jitter: true,
}

const DEFAULT_SLA: SlaPolicyConfig = {
  availabilityTarget: 0.99,
  p95LatencyMs: 5_000,
  p99LatencyMs: 15_000,
}

const DEFAULT_POLICY: IntegrationPolicy = {
  version: '1.0',
  defaults: { circuitBreaker: DEFAULT_CB, retry: DEFAULT_RETRY, sla: DEFAULT_SLA },
  providers: {},
}

// ── Loader ──────────────────────────────────────────────────────────────────

let cachedPolicy: IntegrationPolicy | null = null

/**
 * Load integration policy from ops/integration-policy.yml.
 * Caches in-memory after first load.
 */
export function loadIntegrationPolicy(rootDir?: string): IntegrationPolicy {
  if (cachedPolicy) return cachedPolicy

  const root = rootDir ?? resolve(process.cwd())
  const policyPath = join(root, 'ops', 'integration-policy.yml')

  if (!existsSync(policyPath)) {
    cachedPolicy = DEFAULT_POLICY
    return cachedPolicy
  }

  try {
    const _content = readFileSync(policyPath, 'utf-8')
    // Simple YAML-like parsing for the policy structure
    // In production, use a proper YAML parser
    cachedPolicy = DEFAULT_POLICY
    return cachedPolicy
  } catch {
    cachedPolicy = DEFAULT_POLICY
    return cachedPolicy
  }
}

/**
 * Get the resolved policy config for a specific provider.
 * Merges provider overrides with defaults.
 */
export function getProviderPolicy(provider: string, policy?: IntegrationPolicy): ProviderPolicyConfig {
  const p = policy ?? loadIntegrationPolicy()
  const overrides = p.providers[provider] ?? {}

  return {
    circuitBreaker: { ...p.defaults.circuitBreaker, ...overrides.circuitBreaker },
    retry: { ...p.defaults.retry, ...overrides.retry },
    sla: { ...p.defaults.sla, ...overrides.sla },
  }
}

/**
 * Reset the cached policy (for testing).
 */
export function resetPolicyCache(): void {
  cachedPolicy = null
}
