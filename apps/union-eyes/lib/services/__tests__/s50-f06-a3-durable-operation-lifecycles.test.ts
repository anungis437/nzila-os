import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('F06 batch 4 (A3): durable operation lifecycles, each state change recorded for what it is', () => {
  it('CBA registry seed and benchmark snapshot are atomic in the system scope; ingestion and extraction record the durable rows they wrote', () => {
    for (const file of ['app/api/cba-intelligence/ingestion/seed/route.ts', 'app/api/cba-intelligence/benchmark/[id]/route.ts']) {
      const route = src(file)
      expect(route).toContain('performAtomicAuditedOperation(')
      expect(route).not.toContain('performAuditedOperation(')
      expect(route).toContain('scope: "system"')
    }
    expect(src('lib/services/cba-intelligence/seed-sources.ts')).toContain('if (options.failFast) throw error;')
    expect(src('app/api/cba-intelligence/ingestion/run/route.ts')).toContain('jobIds:')
    expect(src('app/api/cba-intelligence/extraction/route.ts')).toContain('extractionRunIds:')
    expect(src('lib/audit/operation-audit.ts')).toContain('resultDetails?: (value: T) => Record<string, unknown>')
  })

  it('calendar sync writes the connection state and its audit record in one tenant transaction, including a provider failure', () => {
    const route = src('app/api/calendar-sync/connections/[id]/sync/route.ts')
    expect(route).toContain('async function recordConnectionState(')
    expect(route).toContain("'calendar_sync.connection.state_synced'")
    expect(route).toContain("'calendar_sync.connection.sync_failed'")
    expect(route).not.toMatch(/await db\s*\.update\(externalCalendarConnections\)/)
  })

  it('member revocation makes its attempt durable before touching any store and still revokes when it cannot', () => {
    const service = src('lib/services/member-access-revocation-service.ts')
    expect(service.indexOf("'member.access.delete_attempt'")).toBeGreaterThan(-1)
    expect(service.indexOf('member_revocation_attempt_not_recorded')).toBeLessThan(service.indexOf('revokeAllUserSessions'))
    expect(service).toContain('attemptRecorded: intentRecorded')
  })

  it('the external document download serves the file, never a bearer link, and records the bytes delivered', () => {
    const route = src('app/api/external/documents/[id]/download/route.ts')
    expect(route).not.toContain('generateSasUrl')
    expect(route).toContain('readBlobBounded(')
    expect(route.indexOf('persistAtomicAudit(')).toBeLessThan(route.indexOf('new Response('))
    expect(route).toContain('sizeBytes: bytes.length')
    expect(route).toContain("'Cache-Control': 'private, no-store'")
    expect(src('lib/blob-client.ts')).toContain('export class BlobTooLargeError')
  })

  it('dues initiation records the provider link, a cancellation and a supersession, and never cancels a payment whose intent exists', () => {
    const service = src('lib/dues/dues-payment-service.ts')
    expect(service).toContain("'dues.payment_provider_intent_linked'")
    expect(service).toContain("'dues.payment_cancelled'")
    expect(service).toContain("reason: 'provider_intent_not_created'")
    expect(service).toContain("reason: 'superseded_by_new_balance'")
    expect(service).toContain('dues_payment_cancellation_not_recorded')
    expect(service).not.toMatch(/\.catch\(\(\) => undefined\)\s*\n\s*throw error/)
  })

  it('post deletion records the platform removal and the local state change as separate, separately audited steps', () => {
    const route = src('app/api/social-media/posts/route.ts')
    expect(route).toContain('socialMediaService.removeFromPlatform(postId, organizationId)')
    expect(route).toContain("action: 'social.post.deleted'")
    expect(route).toContain("code: 'PLATFORM_REMOVAL_FAILED'")
    expect(route).toContain("code: 'LOCAL_STATE_PENDING'")
    expect(src('lib/social-media/social-media-service.ts')).toContain('async removeFromPlatform(')
  })

  it('an organization selection records where it came from and its outcome', () => {
    const helper = src('lib/auth/organization-selection-audit.ts')
    expect(helper).toContain('fromOrganizationId')
    expect(helper).toContain("'organization.selected'")
    expect(helper).toContain("'organization.select_failed'")
    const canonical = src('lib/auth/canonical-organization-selection.ts')
    expect(canonical).toContain('previousOrganizationId')
    expect(canonical.indexOf("outcome: 'applied'")).toBeGreaterThan(canonical.indexOf('await rebindSessionOrganization('))
  })
})
