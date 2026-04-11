/**
 * @nzila/governed-workflow — Workflow registry
 *
 * In-memory registry for named workflow definitions.
 * Follows the same pattern as fsm-core and ingestion-core registries.
 */
import type { GovernedWorkflowDef } from './types'

const registry = new Map<string, GovernedWorkflowDef>()

function key(name: string, version: string): string {
  return `${name}@${version}`
}

/** Register a workflow definition. Throws if already registered. */
export function registerWorkflow(def: GovernedWorkflowDef): void {
  const k = key(def.name, def.version)
  if (registry.has(k)) {
    throw new Error(`Workflow "${k}" is already registered`)
  }
  registry.set(k, def)
}

/** Retrieve a workflow definition by name and version. */
export function getWorkflow(name: string, version: string): GovernedWorkflowDef | undefined {
  return registry.get(key(name, version))
}

/** List all registered workflow definitions. */
export function listWorkflows(): readonly GovernedWorkflowDef[] {
  return [...registry.values()]
}

/** Unregister a workflow definition. Returns true if it existed. */
export function unregisterWorkflow(name: string, version: string): boolean {
  return registry.delete(key(name, version))
}

/** Clear the entire registry. Mainly useful in tests. */
export function clearWorkflowRegistry(): void {
  registry.clear()
}
