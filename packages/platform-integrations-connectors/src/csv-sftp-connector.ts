/**
 * CSV / SFTP Connector — batch import/export via CSV files.
 * Capabilities: batch_import, batch_export.
 *
 * This connector handles CSV file parsing for inbound and CSV generation
 * for outbound. SFTP transport is delegated to a configurable transport layer.
 */
import type { IntegrationConnection } from '@nzila/platform-integrations-types'
import type {
  ConnectorAdapter,
  ConnectionTestResult,
  ConnectorExecutionResult,
} from '@nzila/platform-integrations/connector-registry'

interface CsvSftpConfig {
  delimiter?: string
  hasHeader?: boolean
  encoding?: string
}

export class CsvSftpConnector implements ConnectorAdapter {
  readonly definition = {
    id: 'nzila.csv-sftp',
    type: 'csv_sftp' as const,
    name: 'CSV / SFTP',
    description: 'Batch import/export via CSV files. Supports configurable delimiters and encoding.',
    version: '1.0.0',
    capabilities: ['inbound', 'outbound', 'batch_import', 'batch_export'] as const,
    configSchema: {
      delimiter: { type: 'string', default: ',' },
      hasHeader: { type: 'boolean', default: true },
      encoding: { type: 'string', default: 'utf-8' },
    },
    authMethods: ['none'] as const,
  }

  async testConnection(_connection: IntegrationConnection): Promise<ConnectionTestResult> {
    // CSV connector is local — always ready
    return { success: true, latencyMs: 0, message: 'CSV connector ready.' }
  }

  async executeInbound(
    connection: IntegrationConnection,
    payload: Record<string, unknown>,
  ): Promise<ConnectorExecutionResult> {
    const start = Date.now()
    const config = connection.configJson as unknown as CsvSftpConfig
    const csvContent = payload.csvContent as string | undefined

    if (!csvContent) {
      return {
        success: false,
        data: null,
        statusCode: null,
        error: 'csvContent is required for inbound CSV processing.',
        durationMs: 0,
        retryable: false,
      }
    }

    try {
      const rows = this.parseCsv(csvContent, config)
      return {
        success: true,
        data: { records: rows, count: rows.length },
        statusCode: 200,
        error: null,
        durationMs: Date.now() - start,
        retryable: false,
      }
    } catch (err) {
      return {
        success: false,
        data: null,
        statusCode: null,
        error: err instanceof Error ? err.message : 'CSV parsing failed.',
        durationMs: Date.now() - start,
        retryable: false,
      }
    }
  }

  async executeOutbound(
    connection: IntegrationConnection,
    payload: Record<string, unknown>,
  ): Promise<ConnectorExecutionResult> {
    const start = Date.now()
    const config = connection.configJson as unknown as CsvSftpConfig
    const records = payload.records as Record<string, unknown>[] | undefined

    if (!records || !Array.isArray(records) || records.length === 0) {
      return {
        success: false,
        data: null,
        statusCode: null,
        error: 'records array is required for outbound CSV generation.',
        durationMs: 0,
        retryable: false,
      }
    }

    try {
      const csv = this.generateCsv(records, config)
      return {
        success: true,
        data: { csvContent: csv, rowCount: records.length },
        statusCode: 200,
        error: null,
        durationMs: Date.now() - start,
        retryable: false,
      }
    } catch (err) {
      return {
        success: false,
        data: null,
        statusCode: null,
        error: err instanceof Error ? err.message : 'CSV generation failed.',
        durationMs: Date.now() - start,
        retryable: false,
      }
    }
  }

  /**
   * Parse CSV content into an array of records.
   * If hasHeader is true, uses the first row as keys.
   */
  private parseCsv(content: string, config: CsvSftpConfig): Record<string, unknown>[] {
    const delimiter = config.delimiter ?? ','
    const hasHeader = config.hasHeader ?? true
    const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0)

    if (lines.length === 0) return []

    const parseRow = (line: string): string[] => {
      const values: string[] = []
      let current = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]!
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"'
            i++ // skip escaped quote
          } else {
            inQuotes = !inQuotes
          }
        } else if (char === delimiter && !inQuotes) {
          values.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      values.push(current.trim())
      return values
    }

    if (hasHeader) {
      const headers = parseRow(lines[0]!)
      return lines.slice(1).map((line) => {
        const values = parseRow(line)
        const record: Record<string, unknown> = {}
        for (let i = 0; i < headers.length; i++) {
          record[headers[i]!] = values[i] ?? null
        }
        return record
      })
    }

    return lines.map((line) => {
      const values = parseRow(line)
      const record: Record<string, unknown> = {}
      for (let i = 0; i < values.length; i++) {
        record[`col_${i}`] = values[i]
      }
      return record
    })
  }

  /**
   * Generate CSV content from records.
   */
  private generateCsv(records: Record<string, unknown>[], config: CsvSftpConfig): string {
    const delimiter = config.delimiter ?? ','
    const hasHeader = config.hasHeader ?? true

    if (records.length === 0) return ''

    const headers = Object.keys(records[0]!)
    const escapeField = (value: unknown): string => {
      const str = String(value ?? '')
      if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const lines: string[] = []
    if (hasHeader) {
      lines.push(headers.map(escapeField).join(delimiter))
    }

    for (const record of records) {
      const row = headers.map((h) => escapeField(record[h]))
      lines.push(row.join(delimiter))
    }

    return lines.join('\n')
  }
}
