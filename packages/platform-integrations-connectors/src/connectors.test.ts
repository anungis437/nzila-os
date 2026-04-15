import { afterEach, describe, expect, it } from 'vitest'
import type { IntegrationConnection } from '@nzila/platform-integrations-types'
import { connectorRegistry } from '@nzila/platform-integrations'
import { CsvSftpConnector } from './csv-sftp-connector'
import { registerBuiltinConnectors } from './index'

function createConnection(
  connectorType: IntegrationConnection['connectorType'],
  configJson: Record<string, unknown>,
): IntegrationConnection {
  return {
    id: 'conn-1',
    orgId: 'org-1',
    appScope: 'platform',
    connectorType,
    name: 'Test Connection',
    status: 'active',
    configJson,
    credentialRef: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'tester',
    lastHealthCheckAt: null,
    lastHealthStatus: null,
  }
}

afterEach(() => {
  connectorRegistry.clear()
})

describe('registerBuiltinConnectors', () => {
  it('registers all built-in connector adapters', () => {
    registerBuiltinConnectors()

    expect(connectorRegistry.listTypes().sort()).toEqual([
      'csv_sftp',
      'rest_api',
      'webhook',
    ])
  })
})

describe('CsvSftpConnector', () => {
  it('parses inbound csv content using headers', async () => {
    const connector = new CsvSftpConnector()
    const connection = createConnection('csv_sftp', { hasHeader: true })

    const result = await connector.executeInbound(connection, {
      csvContent: 'name,age\nAlice,30\nBob,25',
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      records: [
        { name: 'Alice', age: '30' },
        { name: 'Bob', age: '25' },
      ],
      count: 2,
    })
  })

  it('generates outbound csv content from records', async () => {
    const connector = new CsvSftpConnector()
    const connection = createConnection('csv_sftp', { hasHeader: true })

    const result = await connector.executeOutbound(connection, {
      records: [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ],
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      csvContent: 'name,age\nAlice,30\nBob,25',
      rowCount: 2,
    })
  })
})
