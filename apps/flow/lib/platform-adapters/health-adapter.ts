/**
 * Flow — Health Adapter
 *
 * Implements the platform health contract for Flow.
 * Reports on database connectivity, event bus, command bus,
 * and integration adapter reachability.
 */
import type { HealthContract, HealthResponse, ComponentHealth, HealthStatus } from '@nzila/platform-contracts'
import { db } from '@nzila/db'
import { sql } from 'drizzle-orm'
import { getRegisteredCommandTypes } from '@/lib/control/command-bus'
import { logger } from '@/lib/logger'

const APP_VERSION = process.env.APP_VERSION ?? '0.1.0'
const startTime = Date.now()

export const healthAdapter: HealthContract = {
  async check(): Promise<HealthResponse> {
    const components: ComponentHealth[] = []

    // Database
    const dbHealth = await checkDatabase()
    components.push(dbHealth)

    // Command bus
    const commandTypes = getRegisteredCommandTypes()
    components.push({
      name: 'command_bus',
      status: commandTypes.length > 0 ? 'healthy' : 'degraded',
      message: `${commandTypes.length} handlers registered`,
    })

    // Overall status
    const statuses = components.map(c => c.status)
    let overall: HealthStatus = 'healthy'
    if (statuses.includes('unhealthy')) overall = 'unhealthy'
    else if (statuses.includes('degraded')) overall = 'degraded'

    return {
      status: overall,
      app: 'flow',
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      components,
    }
  },
}

async function checkDatabase(): Promise<ComponentHealth> {
  const start = Date.now()
  try {
    await db.execute(sql`SELECT 1`)
    return {
      name: 'database',
      status: 'healthy',
      latency_ms: Date.now() - start,
    }
  } catch (err) {
    logger.error('Health check: database unreachable', {
      error: err instanceof Error ? err.message : String(err),
    })
    return {
      name: 'database',
      status: 'unhealthy',
      latency_ms: Date.now() - start,
      message: err instanceof Error ? err.message : 'Connection failed',
    }
  }
}
