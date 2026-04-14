/**
 * @nzila/platform-integrations-types — Connector Types
 *
 * Canonical types for integration connectors, connections, and credentials.
 */

// ─── Branded Types ───────────────────────────────────────────────────────────

export type ConnectionId = string & { readonly __brand: 'ConnectionId' }
export type ConnectorId = string & { readonly __brand: 'ConnectorId' }
export type CredentialRef = string & { readonly __brand: 'CredentialRef' }

// ─── Connector Types ─────────────────────────────────────────────────────────

export type ConnectorType =
  | 'webhook'
  | 'rest_api'
  | 'email_ingestion'
  | 'csv_sftp'
  | 'document_system'
  | 'crm'
  | 'hris'
  | 'custom'

export type ConnectionStatus =
  | 'active'
  | 'inactive'
  | 'error'
  | 'suspended'
  | 'pending_setup'

export type AppScope =
  | 'union-eyes'
  | 'zonga'
  | 'flow'
  | 'console'
  | 'platform'

// ─── Connector Definition ────────────────────────────────────────────────────

export interface ConnectorDefinition {
  readonly id: string
  readonly type: ConnectorType
  readonly name: string
  readonly description: string
  readonly version: string
  readonly capabilities: readonly ConnectorCapability[]
  readonly configSchema: Record<string, unknown>
  readonly authMethods: readonly AuthMethod[]
}

export type ConnectorCapability =
  | 'inbound'
  | 'outbound'
  | 'bidirectional'
  | 'webhook_receive'
  | 'webhook_send'
  | 'polling'
  | 'streaming'
  | 'batch_import'
  | 'batch_export'

export type AuthMethod =
  | 'api_key'
  | 'oauth2'
  | 'basic'
  | 'bearer'
  | 'hmac_signature'
  | 'mtls'
  | 'none'

// ─── Integration Connection ──────────────────────────────────────────────────

export interface IntegrationConnection {
  readonly id: string
  readonly orgId: string
  readonly appScope: AppScope
  readonly connectorType: ConnectorType
  readonly name: string
  readonly status: ConnectionStatus
  readonly configJson: Record<string, unknown>
  readonly credentialRef: CredentialRef | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly createdBy: string
  readonly lastHealthCheckAt: string | null
  readonly lastHealthStatus: 'healthy' | 'degraded' | 'unhealthy' | null
}

export interface CreateConnectionInput {
  readonly orgId: string
  readonly appScope: AppScope
  readonly connectorType: ConnectorType
  readonly name: string
  readonly configJson: Record<string, unknown>
  readonly credentialRef?: string
}

export interface UpdateConnectionInput {
  readonly name?: string
  readonly status?: ConnectionStatus
  readonly configJson?: Record<string, unknown>
  readonly credentialRef?: string
}

// ─── Credential Reference ────────────────────────────────────────────────────

export interface IntegrationCredentialRef {
  readonly id: string
  readonly orgId: string
  readonly connectionId: string
  readonly provider: string
  readonly secretRef: string // vault path / secret manager reference
  readonly authMethod: AuthMethod
  readonly expiresAt: string | null
  readonly rotatedAt: string | null
  readonly createdAt: string
}
