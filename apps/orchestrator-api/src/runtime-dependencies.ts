/**
 * Orchestrator runtime dependency model.
 *
 * Codifies which external/internal dependencies the orchestrator-api needs in
 * order to be considered "ready" to serve traffic. This is the single source of
 * truth used by the `/ready` route to decide HTTP 200 vs 503.
 *
 * Hard rule (Delta-7):
 *   - Readiness MUST NOT be weakened for optics. A `critical` dependency that
 *     is unhealthy MUST flip readiness to `not_ready` (HTTP 503).
 *   - A non-critical (`important` or `optional`) dependency that is degraded
 *     MUST NOT flip readiness to `not_ready`. It surfaces as `degraded_ready`
 *     with HTTP 200 so the app keeps serving while the optional capability is
 *     marked degraded for observability.
 *
 * In particular: the absence of `GITHUB_TOKEN` MUST NOT cause `not_ready`. The
 * GitHub dispatcher is an optional capability — when invoked without a token
 * the dispatch itself will fail loudly, but the orchestrator's core API surface
 * (database-backed runs, event bus, evidence storage) remains operational.
 */

export type OrchestratorDependencyCriticality = 'critical' | 'important' | 'optional'

export type OrchestratorDependencyDefinition = {
  /** Stable id used as the key in `/health` and `/ready` `checks` maps. */
  id: string
  /** Human-readable label for reports and dashboards. */
  label: string
  /** Drives readiness gating semantics. */
  criticality: OrchestratorDependencyCriticality
  /** Whether the `/health` route probes this dependency. */
  probedByHealth: boolean
  /** Whether the `/ready` route probes this dependency. */
  probedByReadiness: boolean
  /** Short note describing why this criticality was chosen. */
  rationale: string
}

/**
 * Canonical dependency catalog for orchestrator-api.
 *
 * Order matters: this is also the order in which checks are emitted in the
 * `/ready` payload, which keeps reports and snapshots stable.
 */
export const ORCHESTRATOR_DEPENDENCIES: readonly OrchestratorDependencyDefinition[] = [
  {
    id: 'database',
    label: 'PostgreSQL (runs, events, evidence)',
    criticality: 'critical',
    probedByHealth: true,
    probedByReadiness: true,
    rationale:
      'Every orchestrator endpoint reads or writes runs/events. A failed DB probe means the API cannot serve traffic.',
  },
  {
    id: 'github',
    label: 'GitHub Actions dispatcher (workflow_dispatch)',
    criticality: 'optional',
    probedByHealth: true,
    probedByReadiness: true,
    rationale:
      'GITHUB_TOKEN gates outbound workflow dispatches only. Absence MUST NOT block readiness — dispatches will fail loudly when invoked, but the rest of the API stays available.',
  },
] as const

export function getDependency(id: string): OrchestratorDependencyDefinition | undefined {
  return ORCHESTRATOR_DEPENDENCIES.find((dep) => dep.id === id)
}

export function readinessDependencies(): readonly OrchestratorDependencyDefinition[] {
  return ORCHESTRATOR_DEPENDENCIES.filter((dep) => dep.probedByReadiness)
}
