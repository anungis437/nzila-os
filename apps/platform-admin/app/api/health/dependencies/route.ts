import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type DependencyStatus = 'up' | 'degraded' | 'down' | 'optional'

type DependencyCheck = {
  name: 'control-plane' | 'orchestrator' | 'db' | 'queues' | 'metrics'
  optional?: boolean
  status: DependencyStatus
  detail: string
  latencyMs?: number
}

async function checkHttpDependency(name: DependencyCheck['name'], url: string | undefined): Promise<DependencyCheck> {
  if (!url) {
    return { name, status: 'down', detail: 'URL not configured' }
  }

  const start = Date.now()
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    const latencyMs = Date.now() - start
    if (!res.ok) {
      return { name, status: 'degraded', detail: `HTTP ${res.status}`, latencyMs }
    }
    return { name, status: 'up', detail: 'reachable', latencyMs }
  } catch (error) {
    return { name, status: 'down', detail: `unreachable: ${String(error)}` }
  }
}

async function getQueueAndMetricsStatus(orchestratorBase: string | undefined): Promise<{ queue: DependencyCheck; metrics: DependencyCheck }> {
  // Queues and metrics are optional telemetry features not yet deployed as standalone endpoints.
  // Mark as optional so they do not pull overall health to 'warning'.
  void orchestratorBase
  return {
    queue: { name: 'queues', optional: true, status: 'optional', detail: 'not deployed — optional telemetry' },
    metrics: { name: 'metrics', optional: true, status: 'optional', detail: 'not deployed — optional telemetry' },
  }
}

export async function GET() {
  const controlPlaneUrl = process.env.CONTROL_PLANE_URL
  const orchestratorUrl = process.env.ORCHESTRATOR_API_URL

  const [controlPlane, orchestrator, queueMetrics] = await Promise.all([
    checkHttpDependency('control-plane', controlPlaneUrl ? `${controlPlaneUrl.replace(/\/$/, '')}/api/health` : undefined),
    checkHttpDependency('orchestrator', orchestratorUrl ? `${orchestratorUrl.replace(/\/$/, '')}/api/health` : undefined),
    getQueueAndMetricsStatus(orchestratorUrl),
  ])

  const db: DependencyCheck = process.env.DATABASE_URL
    ? { name: 'db', status: 'up', detail: 'DATABASE_URL configured' }
    : { name: 'db', status: 'down', detail: 'DATABASE_URL not configured' }

  const dependencies: DependencyCheck[] = [
    controlPlane,
    orchestrator,
    db,
    queueMetrics.queue,
    queueMetrics.metrics,
  ]

  // Exclude optional dependencies from overall health calculation
  const required = dependencies.filter((d) => !d.optional)
  const overall = required.some((d) => d.status === 'down')
    ? 'degraded'
    : required.some((d) => d.status === 'degraded')
      ? 'warning'
      : 'healthy'

  return NextResponse.json({
    ok: true,
    data: {
      generatedAt: new Date().toISOString(),
      overall,
      dependencies,
    },
  })
}
