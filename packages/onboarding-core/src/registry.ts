/**
 * @nzila/onboarding-core — Flow Registry
 *
 * In-memory registry for onboarding flow definitions.
 * Validates flows on registration (fail-fast).
 *
 * @module @nzila/onboarding-core/registry
 */
import type { OnboardingFlowDef } from './types'
import { validateFlow } from './engine'

const registry = new Map<string, OnboardingFlowDef>()

/**
 * Register an onboarding flow. Validates and throws on structural errors.
 */
export function registerFlow(flow: OnboardingFlowDef): void {
  const errors = validateFlow(flow)
  if (errors.length > 0) {
    throw new Error(
      `Invalid onboarding flow "${flow.id}": ${errors.join('; ')}`,
    )
  }
  registry.set(flow.id, flow)
}

/**
 * Retrieve a registered flow by ID.
 */
export function getFlow(id: string): OnboardingFlowDef | undefined {
  return registry.get(id)
}

/**
 * List all registered flow IDs.
 */
export function listFlows(): readonly string[] {
  return [...registry.keys()]
}

/**
 * Remove a flow from the registry.
 */
export function unregisterFlow(id: string): boolean {
  return registry.delete(id)
}

/**
 * Clear the entire registry (for testing).
 */
export function clearFlowRegistry(): void {
  registry.clear()
}
