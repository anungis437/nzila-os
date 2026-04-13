/**
 * @nzila/platform-integrations-connectors — barrel export
 *
 * Pre-built connectors for the Integration Fabric.
 * Register these with the ConnectorRegistry at app boot.
 */
export { WebhookConnector } from './webhook-connector'
export { RestApiConnector } from './rest-api-connector'
export { CsvSftpConnector } from './csv-sftp-connector'

import { connectorRegistry } from '@nzila/platform-integrations'
import { WebhookConnector } from './webhook-connector'
import { RestApiConnector } from './rest-api-connector'
import { CsvSftpConnector } from './csv-sftp-connector'

/**
 * Register all built-in connectors with the global registry.
 * Call this once at app initialization.
 */
export function registerBuiltinConnectors(): void {
  connectorRegistry.register(new WebhookConnector())
  connectorRegistry.register(new RestApiConnector())
  connectorRegistry.register(new CsvSftpConnector())
}
