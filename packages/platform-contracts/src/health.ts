/**
 * Health Contract — canonical interface for app health reporting.
 *
 * Every app MUST expose a /api/health endpoint that returns a
 * response conforming to this contract.
 */

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface ComponentHealth {
  name: string
  status: HealthStatus
  latency_ms?: number
  message?: string
}

export interface HealthResponse {
  status: HealthStatus
  app: string
  version: string
  timestamp: string
  uptime_seconds: number
  components: ComponentHealth[]
}

export interface HealthContract {
  check(): Promise<HealthResponse>
}
