/**
 * Zoho Integration — Contract Tests
 *
 * Validates the structural contracts between nzila commerce tables and Zoho APIs.
 * Tests field mapping, sync service shape, and webhook payload validation.
 *
 * These are unit-level contract tests that verify integration contracts
 * WITHOUT making real API calls — all external calls are mocked.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const APP = resolve(__dirname, '..')

// ── Structural contract tests ──────────────────────────────────────────────

describe('Zoho integration structural contracts', () => {
  it('exports ZohoSyncService class with syncContacts and syncDeals', () => {
    const content = readFileSync(resolve(APP, 'lib/zoho/sync-service.ts'), 'utf-8')
    expect(content).toContain('class ZohoSyncService')
    expect(content).toContain('async syncContacts(')
    expect(content).toContain('async syncDeals(')
  })

  it('exports ZohoCrmClient with CRUD operations for Contacts and Deals', () => {
    const content = readFileSync(resolve(APP, 'lib/zoho/crm-client.ts'), 'utf-8')
    expect(content).toContain('class ZohoCrmClient')
    expect(content).toContain('getContacts(')
    expect(content).toContain('createContact(')
    expect(content).toContain('updateContact(')
    expect(content).toContain('getDeals(')
    expect(content).toContain('createDeal(')
    expect(content).toContain('updateDeal(')
  })

  it('exports ZohoOAuthClient with token management', () => {
    const content = readFileSync(resolve(APP, 'lib/zoho/oauth.ts'), 'utf-8')
    expect(content).toContain('class ZohoOAuthClient')
    expect(content).toContain('getAccessToken')
    expect(content).toContain('exchangeCodeForTokens')
  })

  it('has webhook route handler', () => {
    const webhookPath = resolve(APP, 'app/api/zoho/webhook/route.ts')
    expect(existsSync(webhookPath)).toBe(true)
    const content = readFileSync(webhookPath, 'utf-8')
    expect(content).toContain('export async function POST')
    expect(content).toContain('ZOHO_WEBHOOK_TOKEN')
  })

  it('has barrel export in lib/zoho/index.ts', () => {
    const content = readFileSync(resolve(APP, 'lib/zoho/index.ts'), 'utf-8')
    expect(content).toContain('ZohoSyncService')
    expect(content).toContain('ZohoCrmClient')
  })
})

// ── Field mapping contracts ────────────────────────────────────────────────

describe('Zoho field mapping contracts', () => {
  it('maps customer -> ZohoContact with required fields', () => {
    const content = readFileSync(resolve(APP, 'lib/zoho/sync-service.ts'), 'utf-8')
    // Contact mapping must include these Zoho fields
    expect(content).toContain('First_Name')
    expect(content).toContain('Last_Name')
    expect(content).toContain('Email')
    expect(content).toContain('Phone')
  })

  it('maps quote -> ZohoDeal with required fields', () => {
    const content = readFileSync(resolve(APP, 'lib/zoho/sync-service.ts'), 'utf-8')
    // Deal mapping must include these Zoho fields
    expect(content).toContain('Deal_Name')
    expect(content).toContain('Amount')
    expect(content).toContain('Stage')
    expect(content).toContain('Contact_Name')
  })

  it('maps quote status to Zoho deal stage', () => {
    const content = readFileSync(resolve(APP, 'lib/zoho/sync-service.ts'), 'utf-8')
    expect(content).toContain('QUOTE_STATUS_TO_DEAL_STAGE')
    // Must include key lifecycle stages
    expect(content).toContain("'Qualification'")
    expect(content).toContain("'Closed Won'")
    expect(content).toContain("'Closed Lost'")
  })

  it('ZOHO_MODULE_MAPPING covers all required modules', () => {
    const content = readFileSync(resolve(APP, 'lib/zoho/types.ts'), 'utf-8')
    expect(content).toContain('commerce_customers')
    expect(content).toContain('commerce_quotes')
    expect(content).toContain("'Contacts'")
    expect(content).toContain("'Deals'")
  })
})

// ── Webhook payload contract ───────────────────────────────────────────────

describe('Zoho webhook payload contract', () => {
  it('ZohoWebhookPayload type has required fields', () => {
    const content = readFileSync(resolve(APP, 'lib/zoho/types.ts'), 'utf-8')
    expect(content).toContain('interface ZohoWebhookPayload')
    expect(content).toContain('module: string')
    expect(content).toContain("operation: 'insert' | 'update' | 'delete'")
    expect(content).toContain('ids: string[]')
    expect(content).toContain('token?: string')
    expect(content).toContain('timestamp: string')
  })

  it('webhook route validates payload with Zod', () => {
    const content = readFileSync(resolve(APP, 'app/api/zoho/webhook/route.ts'), 'utf-8')
    expect(content).toContain('z.object(')
    expect(content).toContain('safeParse')
  })
})

// ── Sync options contract ──────────────────────────────────────────────────

describe('Zoho sync options contract', () => {
  it('SyncOptions supports direction, fullSync, dryRun, conflictResolution', () => {
    const content = readFileSync(resolve(APP, 'lib/zoho/sync-service.ts'), 'utf-8')
    expect(content).toContain('interface SyncOptions')
    expect(content).toContain('direction?:')
    expect(content).toContain('fullSync?:')
    expect(content).toContain('dryRun?:')
    expect(content).toContain('conflictResolution?:')
  })

  it('SyncResult tracks processed/created/updated/failed/conflicts', () => {
    const content = readFileSync(resolve(APP, 'lib/zoho/types.ts'), 'utf-8')
    expect(content).toContain('interface SyncResult')
    expect(content).toContain('recordsProcessed:')
    expect(content).toContain('recordsCreated:')
    expect(content).toContain('recordsUpdated:')
    expect(content).toContain('recordsFailed:')
    expect(content).toContain('conflicts:')
  })
})
