/**
 * @nzila/platform-integrations — Connector Registry
 *
 * Registry for connector definitions and adapter instances.
 * Connectors are the execution adapters that know how to communicate
 * with external systems (REST, webhook, SFTP, etc.).
 */
import type {
  ConnectorDefinition,
  ConnectorType,
  ConnectorCapability,
  IntegrationConnection,
  CreateConnectionInput,
  UpdateConnectionInput,
  ConnectionStatus,
} from '@nzila/platform-integrations-types'

// ─── Connector Adapter Interface ─────────────────────────────────────────────

export interface ConnectorAdapter {
  readonly definition: ConnectorDefinition
  testConnection(connection: IntegrationConnection): Promise<ConnectionTestResult>
  executeInbound(connection: IntegrationConnection, payload: Record<string, unknown>): Promise<ConnectorExecutionResult>
  executeOutbound(connection: IntegrationConnection, payload: Record<string, unknown>): Promise<ConnectorExecutionResult>
}

export interface ConnectionTestResult {
  readonly success: boolean
  readonly latencyMs: number
  readonly message: string
  readonly details?: Record<string, unknown>
}

export interface ConnectorExecutionResult {
  readonly success: boolean
  readonly data: Record<string, unknown> | null
  readonly statusCode: number | null
  readonly error: string | null
  readonly durationMs: number
  readonly retryable: boolean
}

// ─── Connection Store Interface ──────────────────────────────────────────────

export interface ConnectionStore {
  create(input: CreateConnectionInput & { createdBy: string }): Promise<IntegrationConnection>
  getById(id: string): Promise<IntegrationConnection | null>
  listByOrg(orgId: string, appScope?: string): Promise<IntegrationConnection[]>
  update(id: string, orgId: string, input: UpdateConnectionInput): Promise<IntegrationConnection | null>
  updateStatus(id: string, orgId: string, status: ConnectionStatus): Promise<void>
  updateHealthCheck(id: string, status: 'healthy' | 'degraded' | 'unhealthy'): Promise<void>
  delete(id: string, orgId: string): Promise<boolean>
}

// ─── Connector Registry ──────────────────────────────────────────────────────

export class ConnectorRegistry {
  private readonly adapters = new Map<ConnectorType, ConnectorAdapter>()

  register(adapter: ConnectorAdapter): void {
    this.adapters.set(adapter.definition.type, adapter)
  }

  get(type: ConnectorType): ConnectorAdapter | undefined {
    return this.adapters.get(type)
  }

  getOrThrow(type: ConnectorType): ConnectorAdapter {
    const adapter = this.adapters.get(type)
    if (!adapter) {
      throw new Error(`No connector adapter registered for type: ${type}`)
    }
    return adapter
  }

  has(type: ConnectorType): boolean {
    return this.adapters.has(type)
  }

  listTypes(): ConnectorType[] {
    return [...this.adapters.keys()]
  }

  listDefinitions(): ConnectorDefinition[] {
    return [...this.adapters.values()].map(a => a.definition)
  }

  getByCapability(capability: ConnectorCapability): ConnectorAdapter[] {
    return [...this.adapters.values()].filter(a =>
      a.definition.capabilities.includes(capability),
    )
  }

  clear(): void {
    this.adapters.clear()
  }
}

/** Singleton connector registry for the platform */
export const connectorRegistry = new ConnectorRegistry()
