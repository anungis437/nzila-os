import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B87: platform reads, communications tracking and signatures', () => {
  it('records the cross-tenant platform statistics read in the same transaction as the read', () => {
    const query = src('lib/queries/platform-stats.ts')
    expect(query).toContain("action: 'platform_stats.read'")
    expect(query.indexOf('computePlatformStats(tx')).toBeLessThan(query.indexOf('persistAtomicAudit(tx'))
    expect(src('app/api/platform/stats/route.ts')).toContain('getPlatformStatsFromDb({ userId, organizationId })')
  })

  it('keeps the platform metric routes at the system_admin floor and unimplemented', () => {
    for (const name of ['mrr', 'churn', 'unit-economics']) {
      const route = src(`app/api/platform/metrics/${name}/route.ts`)
      expect(route).toContain("minRole: 'system_admin'")
      expect(route).toContain('status: 501')
    }
  })

  it('records where a typed precedent came from and keeps it a draft', () => {
    const service = src('lib/services/precedent-audited-service.ts')
    expect(service).toContain('isPublic: false')
    expect(service).toContain('importedFrom: `typed:')
  })

  it('revokes a campaign-less unsubscribe per organization with a consent record each', () => {
    const route = src('app/api/communications/unsubscribe/[recipientId]/route.ts')
    expect(route).toContain('for (const orgId of organizationIds)')
    expect(route).toContain('unsubscribe-all')
    expect(route).toContain("scope !== 'all'")
    expect(route).toContain('revokeEmailForOrganization(tx, orgId, recipientId, reason, null)')
    expect(route).toContain('.slice(0, 200)')
    const helper = route.slice(route.indexOf('async function revokeEmailForOrganization'), route.indexOf('export async function GET'))
    expect(helper).toContain("status: 'revoked'")
    expect(helper).toContain('update(newsletterListSubscribers)')
  })

  it('counts a click in one transaction with a conditional claim and database increments', () => {
    const route = src('app/api/communications/track/click/route.ts')
    expect(route).toContain('withSystemContext(async (tx)')
    expect(route).not.toMatch(/await db\b/)
    expect(route).toContain('isNull(messageLog.clickedAt)')
    expect(route).toContain('jsonb_set')
    expect(route).toContain("action: 'campaign.message.clicked'")
    expect(route).not.toContain('incrementStat')
  })

  it('refuses to attribute an inbound text to an ambiguous number', () => {
    const service = src('services/twilio-sms-service.ts')
    expect(service).toContain('.limit(2)')
    expect(service).toContain('matches.length > 1')
  })

  it('reads signature status without the provider and compensates a failed record', () => {
    const service = src('lib/signature/signature-service.ts')
    const status = service.slice(service.indexOf('static async getDocumentStatus'), service.indexOf('static async syncDocumentStatus'))
    expect(status).not.toContain('syncDocumentStatus(documentId)')
    expect(service).toContain('provider.voidEnvelope(envelope.envelopeId')
    expect(service).toContain('storageService.deleteDocument(uploadResult.key)')
    const route = src('app/api/signatures/documents/[id]/route.ts')
    expect(route).toContain('export const POST')
    expect(route).toContain('sender !== user.id')
  })
})
