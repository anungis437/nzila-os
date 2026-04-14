/**
 * Control Plane — Integration Data Layer
 *
 * Server-side functions for the Integrations dashboard.
 * Uses @nzila/platform-integrations ConnectorRegistry for live
 * connector metadata, with graceful seed fallback.
 */
import 'server-only'

import {
  connectorRegistry,
  type ConnectionStore,
} from '@nzila/platform-integrations'
import type { DlqEntry } from '@nzila/platform-integrations-control-plane/types'

// ── Types ────────────────────────────────────────────────────────────────

export interface IntegrationSummary {
  connections: { total: number; active: number; error: number }
  runs: { total: number; completed: number; failed: number }
  deadLetters: { total: number; unresolved: number }
  registeredConnectors: number
}

export interface ConnectorOverviewRow {
  type: string
  name: string
  version: string
  capabilities: readonly string[]
}

// ── Seed data (deterministic fallback) ───────────────────────────────────

function seedIntegrationSummary(): IntegrationSummary {
  return {
    connections: { total: 4, active: 3, error: 1 },
    runs: { total: 128, completed: 121, failed: 7 },
    deadLetters: { total: 3, unresolved: 2 },
    registeredConnectors: 4,
  }
}

function seedConnectors(): ConnectorOverviewRow[] {
  return [
    { type: 'webhook', name: 'Webhook Connector', version: '1.0.0', capabilities: ['inbound', 'webhook_receive'] },
    { type: 'rest_api', name: 'REST API Connector', version: '1.0.0', capabilities: ['outbound', 'polling'] },
    { type: 'csv_sftp', name: 'CSV/SFTP Connector', version: '1.0.0', capabilities: ['batch_import', 'batch_export'] },
    { type: 'crm', name: 'CRM Connector', version: '1.0.0', capabilities: ['bidirectional', 'polling'] },
  ]
}

// ── Live data accessors ──────────────────────────────────────────────────

/**
 * Get registered connectors from the ConnectorRegistry.
 * Falls back to seed data when registry is empty (first boot / dev).
 */
export async function getRegisteredConnectors(): Promise<ConnectorOverviewRow[]> {
  try {
    const defs = connectorRegistry.listDefinitions()
    if (defs.length > 0) {
      return defs.map((def) => ({
        type: def.type,
        name: def.name,
        version: def.version,
        capabilities: def.capabilities,
      }))
    }
  } catch {
    /* fall through to seed */
  }
  return seedConnectors()
}

/**
 * Get aggregated integration summary.
 * Uses live ConnectorRegistry count + seed baseline for event counts.
 */
export async function getIntegrationSummary(): Promise<IntegrationSummary> {
  try {
    const defs = connectorRegistry.listDefinitions()
    if (defs.length > 0) {
      return {
        ...seedIntegrationSummary(),
        registeredConnectors: defs.length,
      }
    }
  } catch {
    /* fall through to seed */
  }
  return seedIntegrationSummary()
}

// ── Dead Letters ──────────────────────────────────────────────────────────

export interface DeadLetterRow {
  id: string
  eventType: string
  errorMessage: string
  totalAttempts: number
  replayed: boolean
  createdAt: string
}

function seedDeadLetters(): DeadLetterRow[] {
  return [
    { id: 'dl-001', eventType: 'webhook.inbound', errorMessage: 'Signature verification failed for provider crm-sync', totalAttempts: 3, replayed: false, createdAt: new Date(Date.now() - 86_400_000 * 2).toISOString() },
    { id: 'dl-002', eventType: 'batch_export.complete', errorMessage: 'SFTP connection refused at 10.0.4.12:22', totalAttempts: 5, replayed: false, createdAt: new Date(Date.now() - 86_400_000).toISOString() },
    { id: 'dl-003', eventType: 'rest_api.callback', errorMessage: 'HTTP 502 from downstream partner endpoint', totalAttempts: 3, replayed: true, createdAt: new Date(Date.now() - 86_400_000 * 4).toISOString() },
  ]
}

/**
 * Fetch dead letter entries.
 * Uses DlqManager list when available, falls back to seed data.
 */
export async function getDeadLetters(): Promise<DeadLetterRow[]> {
  try {
    // DlqManager requires DlqPorts adapter — use API route as live source when available
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/control-plane/integrations/dead-letters`, {
      cache: 'no-store',
    })
    if (res.ok) {
      const json = (await res.json()) as { ok: boolean; data?: { deadLetters: DlqEntry[] } }
      if (json.ok && json.data && json.data.deadLetters.length > 0) {
        return json.data.deadLetters.map((e) => ({
          id: e.id,
          eventType: `${e.provider}.${e.channel}`,
          errorMessage: e.error,
          totalAttempts: e.attempts,
          replayed: false,
          createdAt: e.failedAt,
        }))
      }
    }
  } catch {
    /* fall through to seed */
  }
  return seedDeadLetters()
}
