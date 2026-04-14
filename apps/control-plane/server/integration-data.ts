/**
 * Control Plane — Integration Data Layer
 *
 * Reads integration state from persisted Integration Fabric tables only.
 */
import 'server-only'

import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'

export interface IntegrationSummary {
  state: 'ok' | 'no_data' | 'error'
  connections: { total: number; active: number; error: number }
  runs: { total: number; completed: number; failed: number }
  deadLetters: { total: number; unresolved: number }
  registeredConnectors: number
  errorMessage?: string
}

export interface ConnectorOverviewRow {
  type: string
  name: string
  version: string
  capabilities: readonly string[]
}

export interface DeadLetterRow {
  id: string
  eventType: string
  errorMessage: string
  totalAttempts: number
  replayed: boolean
  createdAt: string
}

export async function getRegisteredConnectors(): Promise<ConnectorOverviewRow[]> {
  const rows = (await platformDb.execute(sql`
    SELECT connector_type, connector_id, COUNT(*)::int AS connections
    FROM integration_connections
    GROUP BY connector_type, connector_id
    ORDER BY connector_type, connector_id
  `)) as unknown as Array<{ connector_type: string; connector_id: string; connections: number }>

  return rows.map((row) => ({
    type: row.connector_type,
    name: row.connector_id,
    version: 'unknown',
    capabilities: [`connections:${row.connections}`],
  }))
}

export async function getIntegrationSummary(): Promise<IntegrationSummary> {
  try {
    const summaryRows = (await platformDb.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM integration_connections) AS connection_total,
        (SELECT COUNT(*)::int FROM integration_connections WHERE status = 'active') AS connection_active,
        (SELECT COUNT(*)::int FROM integration_connections WHERE status = 'error') AS connection_error,
        (SELECT COUNT(*)::int FROM integration_runs) AS run_total,
        (SELECT COUNT(*)::int FROM integration_runs WHERE status = 'completed') AS run_completed,
        (SELECT COUNT(*)::int FROM integration_runs WHERE status = 'failed') AS run_failed,
        (SELECT COUNT(*)::int FROM integration_dead_letters) AS dead_letter_total,
        (SELECT COUNT(*)::int FROM integration_dead_letters WHERE replayed = false) AS dead_letter_unresolved,
        (SELECT COUNT(DISTINCT connector_id)::int FROM integration_connections) AS connector_total
    `)) as unknown as Array<{
      connection_total: number
      connection_active: number
      connection_error: number
      run_total: number
      run_completed: number
      run_failed: number
      dead_letter_total: number
      dead_letter_unresolved: number
      connector_total: number
    }>

    const summary = summaryRows[0]
    const noData = !summary || (summary.connection_total === 0 && summary.run_total === 0 && summary.dead_letter_total === 0)

    return {
      state: noData ? 'no_data' : 'ok',
      connections: {
        total: summary?.connection_total ?? 0,
        active: summary?.connection_active ?? 0,
        error: summary?.connection_error ?? 0,
      },
      runs: {
        total: summary?.run_total ?? 0,
        completed: summary?.run_completed ?? 0,
        failed: summary?.run_failed ?? 0,
      },
      deadLetters: {
        total: summary?.dead_letter_total ?? 0,
        unresolved: summary?.dead_letter_unresolved ?? 0,
      },
      registeredConnectors: summary?.connector_total ?? 0,
    }
  } catch (error) {
    return {
      state: 'error',
      connections: { total: 0, active: 0, error: 0 },
      runs: { total: 0, completed: 0, failed: 0 },
      deadLetters: { total: 0, unresolved: 0 },
      registeredConnectors: 0,
      errorMessage: error instanceof Error ? error.message : 'Integration data unavailable',
    }
  }
}

export async function getDeadLetters(): Promise<DeadLetterRow[]> {
  const rows = (await platformDb.execute(sql`
    SELECT id, event_type, error_message, total_attempts, replayed, created_at
    FROM integration_dead_letters
    ORDER BY created_at DESC
    LIMIT 200
  `)) as unknown as Array<{
    id: string
    event_type: string
    error_message: string
    total_attempts: number
    replayed: boolean
    created_at: string
  }>

  return rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    errorMessage: row.error_message,
    totalAttempts: row.total_attempts,
    replayed: row.replayed,
    createdAt: row.created_at,
  }))
}
