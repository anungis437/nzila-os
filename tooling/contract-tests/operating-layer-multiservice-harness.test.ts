import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { AddressInfo } from 'node:net'

type ServiceHandle = {
  name: string
  origin: string
  close: () => Promise<void>
}

type Harness = {
  consoleService: ServiceHandle
  controlPlaneService: ServiceHandle
  orchestratorService: ServiceHandle
  platformAdminService: ServiceHandle
  traces: {
    policyEvaluations: number
    authorizations: number
    executions: number
    dependencyChecks: number
  }
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

function text(res: ServerResponse, status: number, body: string): void {
  res.statusCode = status
  res.setHeader('content-type', 'text/plain; version=0.0.4')
  res.end(body)
}

async function startService(
  name: string,
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void,
): Promise<ServiceHandle> {
  const server = createServer((req, res) => {
    Promise.resolve(handler(req, res)).catch((error) => {
      json(res, 500, { ok: false, error: String(error) })
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })

  const address = server.address() as AddressInfo
  const origin = `http://127.0.0.1:${address.port}`

  return {
    name,
    origin,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error)
        else resolve()
      })
    }),
  }
}

async function buildHarness(): Promise<Harness> {
  const traces = {
    policyEvaluations: 0,
    authorizations: 0,
    executions: 0,
    dependencyChecks: 0,
  }

  const orchestratorService = await startService('orchestrator', async (req, res) => {
    const url = req.url ?? '/'

    if (req.method === 'GET' && url === '/health') {
      return json(res, 200, { ok: true, status: 'healthy' })
    }

    if (req.method === 'GET' && url === '/metrics') {
      return text(res, 200, 'queue_depth 3\np95_latency_ms 72\n')
    }

    if (req.method === 'POST' && url === '/execute') {
      const body = await readJson(req)
      if (typeof body.authorizationDecisionId !== 'string' || body.authorizationDecisionId.length === 0) {
        return json(res, 400, { ok: false, error: { code: 'AUTHORIZATION_REQUIRED' } })
      }

      traces.executions += 1
      return json(res, 202, {
        ok: true,
        data: {
          correlationId: `corr-${traces.executions}`,
          executionId: `exec-${traces.executions}`,
          acceptedAt: new Date().toISOString(),
        },
      })
    }

    return json(res, 404, { ok: false, error: 'not found' })
  })

  const controlPlaneService = await startService('control-plane', async (req, res) => {
    const url = req.url ?? '/'

    if (req.method === 'GET' && url === '/api/health') {
      return json(res, 200, { ok: true, status: 'healthy' })
    }

    if (req.method === 'POST' && url === '/api/control-plane/policy/evaluate') {
      traces.policyEvaluations += 1
      return json(res, 200, {
        ok: true,
        data: {
          blocked: false,
          needsApproval: false,
          reason: 'allowed',
          evaluations: [],
          approverRoles: [],
          requiredApprovers: 0,
        },
      })
    }

    if (req.method === 'POST' && url === '/api/control-plane/authority/authorize-workflow') {
      traces.authorizations += 1
      return json(res, 200, {
        ok: true,
        data: {
          decision: 'allow',
          authorizationDecisionId: `authz-${traces.authorizations}`,
        },
      })
    }

    return json(res, 404, { ok: false, error: 'not found' })
  })

  const consoleService = await startService('console', async (req, res) => {
    const url = req.url ?? '/'

    if (req.method !== 'POST' || url !== '/api/operator/workflows/run') {
      return json(res, 404, { ok: false, error: 'not found' })
    }

    const body = await readJson(req)

    const policyRes = await fetch(`${controlPlaneService.origin}/api/control-plane/policy/evaluate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'workflow.execute',
        resource: String(body.workflowId ?? 'unknown'),
        orgId: String(body.orgId ?? 'unknown'),
      }),
    })
    const policyJson = (await policyRes.json()) as { ok: boolean; data?: { blocked?: boolean } }
    if (!policyRes.ok || !policyJson.ok || policyJson.data?.blocked) {
      return json(res, 403, { ok: false, error: { code: 'WORKFLOW_DENIED' } })
    }

    const authzRes = await fetch(`${controlPlaneService.origin}/api/control-plane/authority/authorize-workflow`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workflowId: String(body.workflowId ?? 'unknown'),
        orgId: String(body.orgId ?? 'unknown'),
      }),
    })
    const authzJson = (await authzRes.json()) as {
      ok: boolean
      data?: { decision?: string; authorizationDecisionId?: string }
    }
    if (!authzRes.ok || !authzJson.ok || authzJson.data?.decision !== 'allow') {
      return json(res, 403, { ok: false, error: { code: 'AUTHORIZATION_DENIED' } })
    }

    const executeRes = await fetch(`${orchestratorService.origin}/execute`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        authorizationDecisionId: authzJson.data.authorizationDecisionId,
        workflowId: String(body.workflowId ?? 'unknown'),
        orgId: String(body.orgId ?? 'unknown'),
      }),
    })

    const executeJson = await executeRes.json()
    if (!executeRes.ok) {
      return json(res, 502, { ok: false, error: { code: 'ORCHESTRATOR_EXECUTION_FAILED', detail: executeJson } })
    }

    return json(res, 202, executeJson)
  })

  const platformAdminService = await startService('platform-admin', async (req, res) => {
    const url = req.url ?? '/'

    if (req.method !== 'GET' || url !== '/api/health/dependencies') {
      return json(res, 404, { ok: false, error: 'not found' })
    }

    traces.dependencyChecks += 1

    const [controlHealth, orchestratorHealth, orchestratorMetrics] = await Promise.all([
      fetch(`${controlPlaneService.origin}/api/health`),
      fetch(`${orchestratorService.origin}/health`),
      fetch(`${orchestratorService.origin}/metrics`),
    ])

    const metricsText = orchestratorMetrics.ok ? await orchestratorMetrics.text() : ''
    const dependencies = [
      {
        name: 'control-plane',
        status: controlHealth.ok ? 'up' : 'down',
      },
      {
        name: 'orchestrator',
        status: orchestratorHealth.ok ? 'up' : 'down',
      },
      {
        name: 'metrics',
        status: metricsText.includes('queue_depth') && metricsText.includes('p95_latency_ms') ? 'up' : 'degraded',
      },
    ] as const

    const overall = dependencies.some((d) => d.status === 'down')
      ? 'degraded'
      : dependencies.some((d) => d.status === 'degraded')
        ? 'warning'
        : 'healthy'

    return json(res, 200, {
      ok: true,
      data: {
        generatedAt: new Date().toISOString(),
        overall,
        dependencies,
      },
    })
  })

  return {
    consoleService,
    controlPlaneService,
    orchestratorService,
    platformAdminService,
    traces,
  }
}

describe('Operating Layer Multi-Service Harness', () => {
  let harness: Harness

  beforeAll(async () => {
    harness = await buildHarness()
  })

  afterAll(async () => {
    await harness.consoleService.close()
    await harness.platformAdminService.close()
    await harness.controlPlaneService.close()
    await harness.orchestratorService.close()
  })

  it('executes Console -> Control Plane -> Orchestrator chain over live HTTP services', async () => {
    const response = await fetch(`${harness.consoleService.origin}/api/operator/workflows/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workflowId: 'wf-operating-layer',
        orgId: 'org_001',
        userId: 'user_001',
      }),
    })

    const payload = await response.json() as {
      ok: boolean
      data?: { correlationId?: string; executionId?: string }
    }

    expect(response.status).toBe(202)
    expect(payload.ok).toBe(true)
    expect(payload.data?.correlationId).toMatch(/^corr-/)
    expect(payload.data?.executionId).toMatch(/^exec-/)

    expect(harness.traces.policyEvaluations).toBe(1)
    expect(harness.traces.authorizations).toBe(1)
    expect(harness.traces.executions).toBe(1)
  })

  it('checks cross-service dependency health via platform-admin service', async () => {
    const response = await fetch(`${harness.platformAdminService.origin}/api/health/dependencies`)
    const payload = await response.json() as {
      ok: boolean
      data?: {
        overall?: string
        dependencies?: Array<{ name: string; status: string }>
      }
    }

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.data?.overall).toBe('healthy')

    const dependencies = payload.data?.dependencies ?? []
    const byName = new Map(dependencies.map((item) => [item.name, item.status]))
    expect(byName.get('control-plane')).toBe('up')
    expect(byName.get('orchestrator')).toBe('up')
    expect(byName.get('metrics')).toBe('up')

    expect(harness.traces.dependencyChecks).toBe(1)
  })
})
