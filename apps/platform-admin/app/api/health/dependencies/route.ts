import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type DependencyStatus = 'up' | 'degraded' | 'down'

type DependencyCheck = {
  name: 'control-plane' | 'orchestrator' | 'db' | 'queues' | 'metrics'
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
  if (!orchestratorBase) {
    return {
      queue: { name: 'queues', status: 'down', detail: 'ORCHESTRATOR_API_URL not configured' },
      metrics: { name: 'metrics', status: 'down', detail: 'ORCHESTRATOR_API_URL not configured' },
    }
  }

  const metricsUrl = `${orchestratorBase.replace(/\/$/, '')}/metrics`
  try {
    const start = Date.now()
    const res = await fetch(metricsUrl, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    const latencyMs = Date.now() - start

    if (!res.ok) {
      return {
        queue: { name: 'queues', status: 'degraded', detail: `metrics HTTP ${res.status}`, latencyMs },
        metrics: { name: 'metrics', status: 'degraded', detail: `metrics HTTP ${res.status}`, latencyMs },
      }
    }

    const body = await res.text()
    const hasQueueDepth = body.includes('queue_depth')
    const hasLatency = body.includes('p95_latency_ms')

    return {
      queue: {
        name: 'queues',
        status: hasQueueDepth ? 'up' : 'degraded',
        detail: hasQueueDepth ? 'queue telemetry available' : 'queue_depth metric missing',
        latencyMs,
      },
      metrics: {
        name: 'metrics',
        status: hasLatency ? 'up' : 'degraded',
        detail: hasLatency ? 'metrics endpoint healthy' : 'core metrics missing',
        latencyMs,
      },
    }
  } catch (error) {
    return {
      queue: { name: 'queues', status: 'down', detail: `metrics unreachable: ${String(error)}` },
      metrics: { name: 'metrics', status: 'down', detail: `metrics unreachable: ${String(error)}` },
    }
  }
}

export async function GET() {
  const controlPlaneUrl = process.env.CONTROL_PLANE_URL
  const orchestratorUrl = process.env.ORCHESTRATOR_API_URL

  const [controlPlane, orchestrator, queueMetrics] = await Promise.all([
    checkHttpDependency('control-plane', controlPlaneUrl ? `${controlPlaneUrl.replace(/\/$/, '')}/api/health` : undefined),
    checkHttpDependency('orchestrator', orchestratorUrl ? `${orchestratorUrl.replace(/\/$/, '')}/health` : undefined),
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

  const overall = dependencies.some((d) => d.status === 'down')
    ? 'degraded'
    : dependencies.some((d) => d.status === 'degraded')
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
