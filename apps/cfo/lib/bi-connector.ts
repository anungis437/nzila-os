/**
 * BI Connectors — Business Intelligence & Reporting Integrations
 *
 * Provides data export pipelines for Power BI, Tableau, Metabase, and
 * generic OData/REST feeds. Enables real-time and scheduled data pushes
 * of financial data (GL, AP/AR aging, P&L, Balance Sheet, KPIs) to
 * external BI/reporting platforms.
 *
 * @module cfo/bi-connector
 */
import { logger } from '@/lib/logger'

// ── Types ───────────────────────────────────────────────────────────────────

export type BIProvider = 'powerbi' | 'tableau' | 'metabase' | 'odata'

export interface BIConnectorConfig {
  provider: BIProvider
  endpoint: string
  apiKey?: string
  clientId?: string
  clientSecret?: string
  workspaceId?: string
  datasetId?: string
}

export interface BIDataset {
  id: string
  name: string
  tables: BITable[]
  refreshSchedule?: string
  lastRefreshedAt?: string
}

export interface BITable {
  name: string
  columns: BIColumn[]
}

export interface BIColumn {
  name: string
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'decimal'
}

export interface BIPushResult {
  provider: BIProvider
  dataset: string
  table: string
  rowsPushed: number
  timestamp: string
  error?: string
}

export interface ODataFeedConfig {
  entitySets: string[]
  baseUrl: string
  pageSize: number
}

/** Standard CFO data tables for BI export */
export interface CFOFinancialData {
  trialBalance: TrialBalanceRow[]
  profitAndLoss: PnLRow[]
  balanceSheet: BSRow[]
  arAging: AgingRow[]
  apAging: AgingRow[]
  kpis: KPIRow[]
}

export interface TrialBalanceRow {
  accountCode: string
  accountName: string
  accountType: string
  debit: number
  credit: number
  balance: number
  period: string
}

export interface PnLRow {
  category: string
  subcategory: string
  amount: number
  budget: number
  variance: number
  period: string
}

export interface BSRow {
  category: string
  subcategory: string
  amount: number
  priorPeriod: number
  period: string
}

export interface AgingRow {
  contactName: string
  current: number
  days30: number
  days60: number
  days90: number
  over90: number
  total: number
  period: string
}

export interface KPIRow {
  metric: string
  value: number
  target: number
  unit: string
  trend: 'up' | 'down' | 'flat'
  period: string
}

// ── CFO BI Tables Schema ────────────────────────────────────────────────────

export const CFO_BI_TABLES: BITable[] = [
  {
    name: 'TrialBalance',
    columns: [
      { name: 'AccountCode', dataType: 'string' },
      { name: 'AccountName', dataType: 'string' },
      { name: 'AccountType', dataType: 'string' },
      { name: 'Debit', dataType: 'decimal' },
      { name: 'Credit', dataType: 'decimal' },
      { name: 'Balance', dataType: 'decimal' },
      { name: 'Period', dataType: 'string' },
    ],
  },
  {
    name: 'ProfitAndLoss',
    columns: [
      { name: 'Category', dataType: 'string' },
      { name: 'Subcategory', dataType: 'string' },
      { name: 'Amount', dataType: 'decimal' },
      { name: 'Budget', dataType: 'decimal' },
      { name: 'Variance', dataType: 'decimal' },
      { name: 'Period', dataType: 'string' },
    ],
  },
  {
    name: 'BalanceSheet',
    columns: [
      { name: 'Category', dataType: 'string' },
      { name: 'Subcategory', dataType: 'string' },
      { name: 'Amount', dataType: 'decimal' },
      { name: 'PriorPeriod', dataType: 'decimal' },
      { name: 'Period', dataType: 'string' },
    ],
  },
  {
    name: 'ARAging',
    columns: [
      { name: 'ContactName', dataType: 'string' },
      { name: 'Current', dataType: 'decimal' },
      { name: 'Days30', dataType: 'decimal' },
      { name: 'Days60', dataType: 'decimal' },
      { name: 'Days90', dataType: 'decimal' },
      { name: 'Over90', dataType: 'decimal' },
      { name: 'Total', dataType: 'decimal' },
      { name: 'Period', dataType: 'string' },
    ],
  },
  {
    name: 'APAging',
    columns: [
      { name: 'ContactName', dataType: 'string' },
      { name: 'Current', dataType: 'decimal' },
      { name: 'Days30', dataType: 'decimal' },
      { name: 'Days60', dataType: 'decimal' },
      { name: 'Days90', dataType: 'decimal' },
      { name: 'Over90', dataType: 'decimal' },
      { name: 'Total', dataType: 'decimal' },
      { name: 'Period', dataType: 'string' },
    ],
  },
  {
    name: 'KPIs',
    columns: [
      { name: 'Metric', dataType: 'string' },
      { name: 'Value', dataType: 'decimal' },
      { name: 'Target', dataType: 'decimal' },
      { name: 'Unit', dataType: 'string' },
      { name: 'Trend', dataType: 'string' },
      { name: 'Period', dataType: 'string' },
    ],
  },
]

// ── Client ──────────────────────────────────────────────────────────────────

let _config: BIConnectorConfig | null = null

function getConfig(): BIConnectorConfig {
  if (_config) return _config

  const provider = (process.env.BI_PROVIDER ?? 'odata') as BIProvider

  _config = {
    provider,
    endpoint: process.env.BI_ENDPOINT ?? '',
    apiKey: process.env.BI_API_KEY,
    clientId: process.env.BI_CLIENT_ID,
    clientSecret: process.env.BI_CLIENT_SECRET,
    workspaceId: process.env.BI_WORKSPACE_ID,
    datasetId: process.env.BI_DATASET_ID,
  }

  return _config
}

// ── Power BI Push ───────────────────────────────────────────────────────────

async function pushToPowerBI(
  table: string,
  rows: Record<string, unknown>[],
): Promise<BIPushResult> {
  const config = getConfig()
  const url = `https://api.powerbi.com/v1.0/myorg/groups/${config.workspaceId}/datasets/${config.datasetId}/tables/${table}/rows`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rows }),
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error('Power BI push failed', { table, status: response.status, error })
      return {
        provider: 'powerbi', dataset: config.datasetId ?? '', table,
        rowsPushed: 0, timestamp: new Date().toISOString(), error,
      }
    }

    logger.info('Power BI push succeeded', { table, rows: rows.length })
    return {
      provider: 'powerbi', dataset: config.datasetId ?? '', table,
      rowsPushed: rows.length, timestamp: new Date().toISOString(),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return {
      provider: 'powerbi', dataset: config.datasetId ?? '', table,
      rowsPushed: 0, timestamp: new Date().toISOString(), error: msg,
    }
  }
}

// ── Tableau Export ───────────────────────────────────────────────────────────

/**
 * Push data to Tableau via Hyper API / REST endpoint.
 */
async function pushToTableau(
  table: string,
  rows: Record<string, unknown>[],
): Promise<BIPushResult> {
  const config = getConfig()
  const url = `${config.endpoint}/api/3.19/sites/${config.workspaceId}/datasources`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Tableau-Auth': config.apiKey ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ table, rows }),
    })

    if (!response.ok) {
      const error = await response.text()
      return {
        provider: 'tableau', dataset: '', table,
        rowsPushed: 0, timestamp: new Date().toISOString(), error,
      }
    }

    return {
      provider: 'tableau', dataset: '', table,
      rowsPushed: rows.length, timestamp: new Date().toISOString(),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return {
      provider: 'tableau', dataset: '', table,
      rowsPushed: 0, timestamp: new Date().toISOString(), error: msg,
    }
  }
}

// ── OData Feed ──────────────────────────────────────────────────────────────

/**
 * Generate an OData-compatible JSON response for a table.
 */
export function generateODataFeed(
  tableName: string,
  rows: Record<string, unknown>[],
  baseUrl: string,
): {
  '@odata.context': string
  '@odata.count': number
  value: Record<string, unknown>[]
} {
  return {
    '@odata.context': `${baseUrl}/$metadata#${tableName}`,
    '@odata.count': rows.length,
    value: rows,
  }
}

// ── Unified Push API ────────────────────────────────────────────────────────

/**
 * Push data to the configured BI provider.
 */
export async function pushData(
  table: string,
  rows: Record<string, unknown>[],
): Promise<BIPushResult> {
  const config = getConfig()

  switch (config.provider) {
    case 'powerbi':
      return pushToPowerBI(table, rows)
    case 'tableau':
      return pushToTableau(table, rows)
    case 'metabase':
    case 'odata':
      // Metabase/OData are pull-based — data is served via API endpoints
      logger.info('OData/Metabase: data ready for pull', { table, rows: rows.length })
      return {
        provider: config.provider, dataset: '', table,
        rowsPushed: rows.length, timestamp: new Date().toISOString(),
      }
  }
}

/**
 * Push all CFO financial data to BI.
 */
export async function pushAllFinancialData(data: CFOFinancialData): Promise<BIPushResult[]> {
  const results: BIPushResult[] = []

  const pushes: [string, Record<string, unknown>[]][] = [
    ['TrialBalance', data.trialBalance as unknown as Record<string, unknown>[]],
    ['ProfitAndLoss', data.profitAndLoss as unknown as Record<string, unknown>[]],
    ['BalanceSheet', data.balanceSheet as unknown as Record<string, unknown>[]],
    ['ARAging', data.arAging as unknown as Record<string, unknown>[]],
    ['APAging', data.apAging as unknown as Record<string, unknown>[]],
    ['KPIs', data.kpis as unknown as Record<string, unknown>[]],
  ]

  for (const [table, rows] of pushes) {
    const result = await pushData(table, rows)
    results.push(result)
  }

  const totalRows = results.reduce((sum, r) => sum + r.rowsPushed, 0)
  const errors = results.filter((r) => r.error)

  logger.info('BI data push complete', {
    tables: results.length,
    totalRows,
    errors: errors.length,
  })

  return results
}

// ── Health ───────────────────────────────────────────────────────────────────

export async function checkBIConnectorHealth(): Promise<{
  healthy: boolean
  provider: BIProvider
  error?: string
}> {
  const config = getConfig()
  if (!config.endpoint && config.provider !== 'powerbi') {
    return { healthy: false, provider: config.provider, error: 'No BI_ENDPOINT configured' }
  }
  return { healthy: true, provider: config.provider }
}
