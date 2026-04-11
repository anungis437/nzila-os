/**
 * @nzila/pilot-mode — Registry
 *
 * In-memory registry for pilot flags and cohorts.
 * Validates on registration (fail-fast).
 *
 * @module @nzila/pilot-mode/registry
 */
import type { PilotFlagDef, PilotCohort } from './types'
import { validatePilotFlag } from './engine'

// ── Flag Registry ───────────────────────────────────────────────────────────

const flagRegistry = new Map<string, PilotFlagDef>()

/**
 * Register a pilot flag. Validates and throws on structural errors.
 */
export function registerPilotFlag(flag: PilotFlagDef): void {
  const errors = validatePilotFlag(flag)
  if (errors.length > 0) {
    throw new Error(
      `Invalid pilot flag "${flag.name}": ${errors.join('; ')}`,
    )
  }
  flagRegistry.set(flag.name, flag)
}

/**
 * Retrieve a registered pilot flag.
 */
export function getPilotFlag(name: string): PilotFlagDef | undefined {
  return flagRegistry.get(name)
}

/**
 * List all registered pilot flag names.
 */
export function listPilotFlags(): readonly string[] {
  return [...flagRegistry.keys()]
}

/**
 * Get all registered pilot flag definitions.
 */
export function getAllPilotFlags(): readonly PilotFlagDef[] {
  return [...flagRegistry.values()]
}

/**
 * Remove a pilot flag from the registry.
 */
export function unregisterPilotFlag(name: string): boolean {
  return flagRegistry.delete(name)
}

// ── Cohort Registry ─────────────────────────────────────────────────────────

const cohortRegistry = new Map<string, PilotCohort>()

/**
 * Register a pilot cohort.
 */
export function registerCohort(cohort: PilotCohort): void {
  if (!cohort.id) throw new Error('Cohort must have an id')
  if (cohort.orgIds.length === 0) {
    throw new Error(`Cohort "${cohort.id}" must have at least one org`)
  }
  cohortRegistry.set(cohort.id, cohort)
}

/**
 * Retrieve a registered cohort.
 */
export function getCohort(id: string): PilotCohort | undefined {
  return cohortRegistry.get(id)
}

/**
 * List all registered cohort IDs.
 */
export function listCohorts(): readonly string[] {
  return [...cohortRegistry.keys()]
}

/**
 * Get the full cohort map (for passing to evaluatePilotFlag).
 */
export function getCohortMap(): ReadonlyMap<string, PilotCohort> {
  return cohortRegistry
}

/**
 * Remove a cohort from the registry.
 */
export function unregisterCohort(id: string): boolean {
  return cohortRegistry.delete(id)
}

// ── Reset ───────────────────────────────────────────────────────────────────

/**
 * Clear all registries (for testing).
 */
export function clearPilotRegistry(): void {
  flagRegistry.clear()
  cohortRegistry.clear()
}
