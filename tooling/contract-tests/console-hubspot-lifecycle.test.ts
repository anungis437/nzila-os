/**
 * Contract Test — Console HubSpot Deal Lifecycle (CONSOLE-HUBSPOT-01)
 *
 * Ensures the Sales workspace keeps full lifecycle linkage with HubSpot:
 * - create/update actions push to HubSpot
 * - manual sync action pulls from HubSpot
 * - HubSpot credentials resolve from org-scoped integration secrets
 * - Sales workspace UI renders the HubSpot sync control
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

function read(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), 'utf-8')
}

describe('Console HubSpot lifecycle (CONSOLE-HUBSPOT-01)', () => {
  it('sales actions push on create/update and pull on manual sync', () => {
    const src = read('apps/console/app/(dashboard)/workspace/_lib/sales-actions.ts')

    expect(src).toContain('pushDealToHubspot(toPushInput(created), orgId)')
    expect(src).toContain('pushDealToHubspot(toPushInput(saved), orgId)')
    expect(src).toContain('const summary = await pullHubspotDeals({ orgId })')
  })

  it('hubspot sync resolves org-scoped secrets with env fallback', () => {
    const src = read('apps/console/app/(dashboard)/workspace/_lib/hubspot-sync.ts')

    expect(src).toContain("getDecryptedProviderSecrets(orgId, 'hubspot')")
    expect(src).toContain('let apiKey = process.env.HUBSPOT_API_KEY')
    expect(src).toContain('opts?: { maxPages?: number; orgId?: string | null }')
  })

  it('partner stage mapping includes every persisted stage', () => {
    const src = read('apps/console/app/(dashboard)/workspace/_lib/hubspot-sync.ts')

    for (const stage of ['registered', 'submitted', 'approved', 'won', 'lost']) {
      expect(src).toContain(`${stage}:`)
    }
  })

  it('sales workspace renders HubSpot sync button from org-scoped configured state', () => {
    const src = read('apps/console/app/(dashboard)/workspace/sales/page.tsx')

    expect(src).toContain('const orgId = await resolveWorkspaceOrgIdForUser(userId)')
    expect(src).toContain('const hubspotConfigured = await isHubspotConfigured(orgId)')
    expect(src).toContain('<HubspotSyncButton configured={hubspotConfigured} />')
  })
})
