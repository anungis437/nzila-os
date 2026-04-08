/**
 * @nzila/intelligence — Registry
 *
 * In-memory capability registry for the Nzila Intelligence Layer.
 * Each capability describes a specific AI/intelligence function
 * (e.g. "grievance-triage", "cash-forecast") and the apps that may use it.
 */
import type { IntelligenceCapability, NilApp } from './types.js'
import { NilError } from './types.js'

// ── Internal store ──────────────────────────────────────────────────────────

const capabilities = new Map<string, IntelligenceCapability>()

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
  return capabilities.delete(id)
}

/**
 * Clear the registry (primarily for testing).
 */
export function clearRegistry(): void {
  capabilities.clear()
}
