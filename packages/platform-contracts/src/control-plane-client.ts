/**
 * @nzila/platform-contracts — Control Plane Authority Client
 *
 * Shared HTTP client for Console and Platform Admin to call the
 * Control Plane authority APIs. Neither app may bypass this client
 * to make direct DB calls or import Control Plane server modules.
 *
 * All calls are authenticated with CONTROL_PLANE_API_KEY.
 * All calls propagate correlation IDs for observability.
 *
 * Usage:
 *   import { createControlPlaneClient } from '@nzila/platform-contracts/control-plane-client'
 *   const cp = createControlPlaneClient()
 *   const auth = await cp.authorizeWorkflow(request)
 *   const ent = await cp.resolveEntitlement({ orgId, feature })
 */

import type {
  WorkflowTriggerRequest,
  WorkflowAuthorization,
  PolicyEvalRequest,
  PolicyEvalResponse,
  DecisionEvent,
} from './control-system.js'

export interface ControlPlaneClientConfig {
  baseUrl: string
  apiKey: string
  timeoutMs?: number
}

export interface WorkflowAuthorizationResult {
  authorized: boolean
  authorization?: WorkflowAuthorization
  requiresApproval?: boolean
  reason?: string
}

export interface EntitlementResult {
  orgId: string
  feature: string
  granted: boolean
  tier: string | null
  limit: number | null
  expiresAt: string | null
  source: string
  resolvedAt: string
  decisionId: string
}

// ── Internal fetch helper ────────────────────────────────────────────────────

async function cpFetch<T>(
  config: ControlPlaneClientConfig,
  path: string,
  options: RequestInit = {},
  correlationId?: string,
): Promise<{ ok: true; data: T } | { ok: false; error: { code: string; message: string } }> {
  const url = `${config.baseUrl}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': config.apiKey,
    ...(correlationId ? { 'x-correlation-id': correlationId } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  }

  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: config.timeoutMs
        ? AbortSignal.timeout(config.timeoutMs)
        : undefined,
    })
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'CP_UNREACHABLE',
        message: `Control Plane unreachable at ${url}: ${String(err)}`,
      },
    }
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '{}')
    let parsed: { error?: { code?: string; message?: string } } = {}
    try { parsed = JSON.parse(text) } catch { /**/ }
    return {
      ok: false,
      error: {
        code: parsed.error?.code ?? `HTTP_${response.status}`,
        message: parsed.error?.message ?? `Control Plane returned ${response.status}`,
      },
    }
  }

  const json = (await response.json()) as { ok: boolean; data?: T; error?: { code?: string; message?: string } }
  if (!json.ok) {
    return {
      ok: false,
      error: {
        code: json.error?.code ?? 'CP_ERROR',
        message: json.error?.message ?? 'Control Plane returned ok:false',
      },
    }
  }

  return { ok: true, data: json.data as T }
}

// ── Control Plane Client ─────────────────────────────────────────────────────

export interface ControlPlaneClient {
  /**
   * Authorize a workflow trigger request.
   * MUST be called before submitting to Orchestrator.
   */
  authorizeWorkflow(
    request: WorkflowTriggerRequest,
    correlationId?: string,
  ): Promise<WorkflowAuthorizationResult>

  /**
   * Evaluate policy for an actor+action+resource.
   */
  evaluatePolicy(
    request: PolicyEvalRequest,
    correlationId?: string,
  ): Promise<PolicyEvalResponse>

  /**
   * Resolve entitlement for an org+feature.
   */
  resolveEntitlement(
    query: { orgId: string; feature: string; actorId?: string },
    correlationId?: string,
  ): Promise<EntitlementResult>

  /**
   * Query decision events for traceability.
   */
  getDecisions(
    filter: { orgId?: string; correlationId?: string; workflowId?: string },
  ): Promise<DecisionEvent[]>
}

export function createControlPlaneClient(
  config?: Partial<ControlPlaneClientConfig>,
): ControlPlaneClient {
  const resolved: ControlPlaneClientConfig = {
    baseUrl: config?.baseUrl ?? process.env['CONTROL_PLANE_URL'] ?? 'http://localhost:3010',
    apiKey: config?.apiKey ?? process.env['CONTROL_PLANE_API_KEY'] ?? '',
    timeoutMs: config?.timeoutMs ?? 10_000,
  }

  return {
    async authorizeWorkflow(request, correlationId) {
      const result = await cpFetch<{ authorized: boolean; authorization?: WorkflowAuthorization; requiresApproval?: boolean; reason?: string }>(
        resolved,
        '/api/control-plane/authority/authorize-workflow',
        { method: 'POST', body: JSON.stringify(request) },
        correlationId,
      )
      if (!result.ok) {
        return { authorized: false, reason: result.error.message }
      }
      return result.data
    },

    async evaluatePolicy(request, correlationId) {
      const result = await cpFetch<PolicyEvalResponse>(
        resolved,
        '/api/control-plane/policy/evaluate',
        { method: 'POST', body: JSON.stringify(request) },
        correlationId,
      )
      if (!result.ok) {
        // Safe fallback: block on error
        return {
          blocked: true,
          needsApproval: false,
          reason: `Policy evaluation failed: ${result.error.message}`,
          evaluations: [],
          approverRoles: [],
          requiredApprovers: 0,
          evaluatedAt: new Date().toISOString(),
        }
      }
      return result.data
    },

    async resolveEntitlement(query, correlationId) {
      const result = await cpFetch<EntitlementResult>(
        resolved,
        '/api/control-plane/authority/entitlements',
        { method: 'POST', body: JSON.stringify(query) },
        correlationId,
      )
      if (!result.ok) {
        return {
          orgId: query.orgId,
          feature: query.feature,
          granted: false,
          tier: null,
          limit: null,
          expiresAt: null,
          source: 'denied',
          resolvedAt: new Date().toISOString(),
          decisionId: crypto.randomUUID(),
        }
      }
      return result.data
    },

    async getDecisions(filter) {
      const params = new URLSearchParams()
      if (filter.orgId) params.set('orgId', filter.orgId)
      if (filter.correlationId) params.set('correlationId', filter.correlationId)
      if (filter.workflowId) params.set('workflowId', filter.workflowId)

      const result = await cpFetch<DecisionEvent[]>(
        resolved,
        `/api/control-plane/authority/decisions?${params}`,
        { method: 'GET' },
      )
      if (!result.ok) return []
      return result.data
    },
  }
}

// ── Convenience singleton for server contexts ────────────────────────────────

let _sharedClient: ControlPlaneClient | null = null

export function getControlPlaneClient(): ControlPlaneClient {
  if (!_sharedClient) {
    _sharedClient = createControlPlaneClient()
  }
  return _sharedClient
}
