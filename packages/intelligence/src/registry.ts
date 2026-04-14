/**
 * @nzila/intelligence — Registry
 *
 * In-memory capability registry for the Nzila Intelligence Layer.
 * Each capability describes a specific AI/intelligence function
 * (e.g. "grievance-triage", "cash-forecast") and the apps that may use it.
 */
import type { IntelligenceCapability, NilApp } from './types.js'
import { NilError } from './types.js'

export interface CapabilityExecutionTelemetry {
  readonly latencyMs: number
  readonly success: boolean
  readonly recordedAt?: string
}

export interface CapabilityHealth {
  readonly capabilityId: string
  readonly totalRequests: number
  readonly successfulRequests: number
  readonly failedRequests: number
  readonly successRate: number
  readonly averageLatencyMs: number
  readonly p95LatencyMs: number
  readonly lastInvokedAt?: string
  readonly availabilityScore: number
}

// ── Internal store ──────────────────────────────────────────────────────────

const capabilities = new Map<string, IntelligenceCapability>()
const capabilityTelemetry = new Map<string, CapabilityExecutionTelemetry[]>()

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Register an intelligence capability.
 * Throws if a capability with the same id is already registered.
 */
export function registerCapability(cap: IntelligenceCapability): void {
  if (capabilities.has(cap.id)) {
    throw new NilError(
      'validation_error',
      `Capability "${cap.id}" is already registered`,
    )
  }
  capabilities.set(cap.id, cap)
  if (!capabilityTelemetry.has(cap.id)) {
    capabilityTelemetry.set(cap.id, [])
  }
}

/**
 * Look up a capability by id.
 */
export function getCapability(id: string): IntelligenceCapability | undefined {
  return capabilities.get(id)
}

/**
 * Resolve a capability for a given app and use-case.
 * Returns the first capability whose supportedApps includes the app
 * and whose useCases includes the useCase.
 */
export function resolveCapability(
  app: NilApp,
  useCase: string,
): IntelligenceCapability | undefined {
  for (const cap of capabilities.values()) {
    if (
      cap.supportedApps.includes(app) &&
      cap.useCases.includes(useCase)
    ) {
      return cap
    }
  }
  return undefined
}

/**
 * Health-aware resolver that prefers the most reliable capability when
 * multiple candidates can satisfy the same app/use-case.
 */
export function resolveCapabilityAdaptive(
  app: NilApp,
  useCase: string,
): IntelligenceCapability | undefined {
  const candidates = Array.from(capabilities.values()).filter(
    (cap) => cap.supportedApps.includes(app) && cap.useCases.includes(useCase),
  )

  if (candidates.length === 0) return undefined
  if (candidates.length === 1) return candidates[0]

  const ranked = candidates
    .map((cap) => ({
      cap,
      health: getCapabilityHealth(cap.id),
    }))
    .sort((a, b) => {
      const aScore = a.health?.availabilityScore ?? 0.5
      const bScore = b.health?.availabilityScore ?? 0.5
      return bScore - aScore
    })

  return ranked[0]?.cap
}

/**
 * List all registered capabilities, optionally filtered by app.
 */
export function listCapabilities(app?: NilApp): readonly IntelligenceCapability[] {
  const all = Array.from(capabilities.values())
  if (!app) return all
  return all.filter((c) => c.supportedApps.includes(app))
}

/**
 * Remove a capability by id. Returns true if it was present.
 */
export function unregisterCapability(id: string): boolean {
  capabilityTelemetry.delete(id)
  return capabilities.delete(id)
}

/**
 * Clear the registry (primarily for testing).
 */
export function clearRegistry(): void {
  capabilities.clear()
  capabilityTelemetry.clear()
}

export function recordCapabilityExecution(
  capabilityId: string,
  telemetry: CapabilityExecutionTelemetry,
): void {
  if (!capabilities.has(capabilityId)) {
    throw new NilError(
      'capability_not_found',
      `Capability "${capabilityId}" is not registered`,
      404,
    )
  }

  const history = capabilityTelemetry.get(capabilityId) ?? []
  history.push({
    ...telemetry,
    recordedAt: telemetry.recordedAt ?? new Date().toISOString(),
  })

  // Keep a bounded window for in-memory efficiency and meaningful recency.
  if (history.length > 500) {
    history.splice(0, history.length - 500)
  }

  capabilityTelemetry.set(capabilityId, history)
}

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

export function getCapabilityHealth(capabilityId: string): CapabilityHealth | undefined {
  if (!capabilities.has(capabilityId)) return undefined

  const history = capabilityTelemetry.get(capabilityId) ?? []
  const totalRequests = history.length
  const successfulRequests = history.filter((entry) => entry.success).length
  const failedRequests = totalRequests - successfulRequests
  const latencies = history.map((entry) => entry.latencyMs)
  const averageLatencyMs =
    latencies.length > 0
      ? latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length
      : 0
  const p95LatencyMs = percentile(latencies, 95)
  const successRate = totalRequests === 0 ? 1 : successfulRequests / totalRequests
  const lastInvokedAt = history[history.length - 1]?.recordedAt

  // Availability blends success and latency quality.
  const latencyPenalty = Math.min(1, averageLatencyMs / 2_000)
  const availabilityScore = Math.max(0, Math.min(1, successRate * 0.8 + (1 - latencyPenalty) * 0.2))

  return {
    capabilityId,
    totalRequests,
    successfulRequests,
    failedRequests,
    successRate,
    averageLatencyMs,
    p95LatencyMs,
    lastInvokedAt,
    availabilityScore,
  }
}

export function listCapabilityHealth(app?: NilApp): CapabilityHealth[] {
  return listCapabilities(app)
    .map((capability) => getCapabilityHealth(capability.id))
    .filter((health): health is CapabilityHealth => Boolean(health))
    .sort((a, b) => b.availabilityScore - a.availabilityScore)
}
