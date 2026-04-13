/**
 * REST API Connector — communicates with external REST APIs.
 * Capabilities: inbound (polling), outbound (send).
 */
import type { IntegrationConnection } from '@nzila/platform-integrations-types'
import type {
  ConnectorAdapter,
  ConnectionTestResult,
  ConnectorExecutionResult,
} from '@nzila/platform-integrations/connector-registry'

interface RestApiConfig {
  baseUrl: string
  authType?: 'api_key' | 'bearer' | 'basic' | 'none'
  apiKeyHeader?: string
  apiKeyValue?: string
  bearerToken?: string
  basicUser?: string
  basicPassword?: string
  defaultHeaders?: Record<string, string>
  timeoutMs?: number
}

export class RestApiConnector implements ConnectorAdapter {
  readonly definition = {
    id: 'nzila.rest-api',
    type: 'rest_api' as const,
    name: 'REST API',
    description: 'Connect to external REST APIs with configurable authentication.',
    version: '1.0.0',
    capabilities: ['inbound', 'outbound', 'polling'] as const,
    configSchema: {
      baseUrl: { type: 'string', description: 'Base URL for the API', required: true },
      authType: { type: 'string', enum: ['api_key', 'bearer', 'basic', 'none'] },
      apiKeyHeader: { type: 'string', description: 'Header name for API key auth' },
      timeoutMs: { type: 'number', default: 30000 },
    },
    authMethods: ['api_key', 'bearer', 'basic', 'none'] as const,
  }

  async testConnection(connection: IntegrationConnection): Promise<ConnectionTestResult> {
    const config = connection.configJson as unknown as RestApiConfig
    const start = Date.now()

    if (!config.baseUrl) {
      return { success: false, latencyMs: 0, message: 'baseUrl is required.' }
    }

    try {
      const url = new URL(config.baseUrl)
      if (!['http:', 'https:'].includes(url.protocol)) {
        return { success: false, latencyMs: 0, message: `Invalid protocol: ${url.protocol}` }
      }
      const headers = this.buildHeaders(config)
      const response = await fetch(config.baseUrl, {
        method: 'HEAD',
        headers,
        signal: AbortSignal.timeout(config.timeoutMs ?? 10_000),
      })
      return {
        success: response.ok || response.status === 405,
        latencyMs: Date.now() - start,
        message: response.ok ? 'API reachable.' : `HTTP ${response.status}`,
      }
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : 'Connection test failed.',
      }
    }
  }

  async executeInbound(
    connection: IntegrationConnection,
    payload: Record<string, unknown>,
  ): Promise<ConnectorExecutionResult> {
    const config = connection.configJson as unknown as RestApiConfig
    const start = Date.now()

    const endpoint = payload.endpoint as string | undefined
    const method = (payload.method as string | undefined) ?? 'GET'
    const queryParams = payload.queryParams as Record<string, string> | undefined

    const url = new URL(endpoint ?? '', config.baseUrl)
    const baseOrigin = new URL(config.baseUrl).origin
    if (url.origin !== baseOrigin) {
      return {
        success: false,
        data: null,
        statusCode: null,
        error: 'Endpoint must be on the same origin as baseUrl.',
        durationMs: Date.now() - start,
        retryable: false,
      }
    }
    if (queryParams) {
      for (const [k, v] of Object.entries(queryParams)) {
        url.searchParams.set(k, v)
      }
    }

    try {
      const headers = this.buildHeaders(config)
      const response = await fetch(url.toString(), {
        method,
        headers,
        signal: AbortSignal.timeout(config.timeoutMs ?? 30_000),
      })
      const text = await response.text()
      let data: Record<string, unknown> | null = null
      try {
        data = JSON.parse(text) as Record<string, unknown>
      } catch {
        data = { raw: text }
      }

      return {
        success: response.ok,
        data,
        statusCode: response.status,
        error: response.ok ? null : `HTTP ${response.status}`,
        durationMs: Date.now() - start,
        retryable: response.status >= 500 || response.status === 429,
      }
    } catch (err) {
      return {
        success: false,
        data: null,
        statusCode: null,
        error: err instanceof Error ? err.message : 'Inbound fetch failed.',
        durationMs: Date.now() - start,
        retryable: true,
      }
    }
  }

  async executeOutbound(
    connection: IntegrationConnection,
    payload: Record<string, unknown>,
  ): Promise<ConnectorExecutionResult> {
    const config = connection.configJson as unknown as RestApiConfig
    const start = Date.now()

    const endpoint = payload.endpoint as string | undefined
    const method = (payload.method as string | undefined) ?? 'POST'
    const body = payload.body as Record<string, unknown> | undefined

    const url = new URL(endpoint ?? '', config.baseUrl)
    const baseOrigin = new URL(config.baseUrl).origin
    if (url.origin !== baseOrigin) {
      return {
        success: false,
        data: null,
        statusCode: null,
        error: 'Endpoint must be on the same origin as baseUrl.',
        durationMs: Date.now() - start,
        retryable: false,
      }
    }

    try {
      const headers = this.buildHeaders(config)
      headers['Content-Type'] = 'application/json'

      const response = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(config.timeoutMs ?? 30_000),
      })
      const text = await response.text()
      let data: Record<string, unknown> | null = null
      try {
        data = JSON.parse(text) as Record<string, unknown>
      } catch {
        data = { raw: text }
      }

      return {
        success: response.ok,
        data,
        statusCode: response.status,
        error: response.ok ? null : `HTTP ${response.status}: ${text.slice(0, 500)}`,
        durationMs: Date.now() - start,
        retryable: response.status >= 500 || response.status === 429,
      }
    } catch (err) {
      return {
        success: false,
        data: null,
        statusCode: null,
        error: err instanceof Error ? err.message : 'Outbound request failed.',
        durationMs: Date.now() - start,
        retryable: true,
      }
    }
  }

  private buildHeaders(config: RestApiConfig): Record<string, string> {
    const headers: Record<string, string> = { ...config.defaultHeaders }

    switch (config.authType) {
      case 'api_key':
        if (config.apiKeyHeader && config.apiKeyValue) {
          headers[config.apiKeyHeader] = config.apiKeyValue
        }
        break
      case 'bearer':
        if (config.bearerToken) {
          headers['Authorization'] = `Bearer ${config.bearerToken}`
        }
        break
      case 'basic':
        if (config.basicUser && config.basicPassword) {
          const encoded = Buffer.from(`${config.basicUser}:${config.basicPassword}`).toString('base64')
          headers['Authorization'] = `Basic ${encoded}`
        }
        break
    }

    return headers
  }
}
