/**
 * System State — unified health/status model for the control plane.
 *
 * Aggregates signals from governance, revenue, anomaly, and observability
 * packages to produce a single "system pulse."
 */

export interface DomainHealth {
  domain: string
  status: 'healthy' | 'degraded' | 'critical'
  lastCheck: string
  details?: string
}

export interface SystemState {
  timestamp: string
  overallStatus: 'healthy' | 'degraded' | 'critical'
  domains: DomainHealth[]
  appCount: number
  packageCount: number
  activeGates: number
  passedGates: number
  revenueApps: string[]
}

/**
 * Collect current system state from platform packages.
 * In production this would call live health endpoints;
 * here it returns a structural snapshot.
 */
export function getSystemState(): SystemState {
  const now = new Date().toISOString()

  const domains: DomainHealth[] = [
    { domain: 'governance', status: 'healthy', lastCheck: now },
    { domain: 'revenue', status: 'healthy', lastCheck: now },
    { domain: 'auth', status: 'healthy', lastCheck: now },
    { domain: 'observability', status: 'healthy', lastCheck: now },
    { domain: 'anomaly-detection', status: 'healthy', lastCheck: now },
    { domain: 'intelligence', status: 'healthy', lastCheck: now },
  ]

  const degraded = domains.filter(d => d.status !== 'healthy').length
  const overallStatus: SystemState['overallStatus'] =
    degraded === 0 ? 'healthy' : degraded <= 2 ? 'degraded' : 'critical'

  return {
    timestamp: now,
    overallStatus,
    domains,
    appCount: 17,
    packageCount: 159,
    activeGates: 18,
    passedGates: 18,
    revenueApps: ['zonga', 'cfo', 'flow', 'partners', 'trade'],
  }
}
