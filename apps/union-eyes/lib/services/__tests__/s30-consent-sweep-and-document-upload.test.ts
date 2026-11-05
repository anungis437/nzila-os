import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { interviewDocumentBlobPath, checkDocumentLocation } from '@/lib/knowledge-transfer/governance/document-location'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')
const ORG = '11111111-1111-4111-8111-111111111111'
const INTERVIEW = '33333333-3333-4333-8333-333333333333'

describe('Gate 0 batch B86: consent expiry sweep and the interview document producer', () => {
  it('records the lapse of expired consents in the retention transaction, one member at a time', () => {
    const service = src('services/geofence-privacy-service.ts')
    const sweep = service.slice(service.indexOf('static async expireLapsedConsents'), service.indexOf('static async deleteExpiredLocationData'))
    expect(sweep).toContain('eq(memberLocationConsent.userId, userId)')
    expect(sweep).toContain('lte(memberLocationConsent.expiresAt, now)')
    expect(sweep).toContain('consentStatus: "expired"')
    const cron = src('app/api/cron/location-retention/route.ts')
    expect(cron).toContain('expireLapsedConsents(tx)')
    expect(cron).toContain('deleteExpiredLocationData(tx)')
  })

  it('gives the system role the narrow privileges the sweep needs and no more', () => {
    const manifest = src('db/rls-storage-authority/organizations-membership.ts')
    const entry = manifest.slice(manifest.indexOf('table: "member_location_consent"'), manifest.indexOf('table: "organization_sharing_grants"'))
    expect(entry).toContain('requiredSystemPrivileges: ["SELECT","UPDATE"]')
    expect(entry).not.toContain('DELETE"]')
  })

  it('builds the storage path inside the organization area and reduces the file name', () => {
    const path = interviewDocumentBlobPath(ORG.toUpperCase(), INTERVIEW, '..\\..\\etc/Pass wd (final).pdf', 'abcdef0123456789')
    expect(path).toBe(`interviews/${ORG}/${INTERVIEW}/abcdef0123456789-Pass_wd_final_.pdf`)
    expect(path).not.toContain('..')
    expect(checkDocumentLocation(`https://nzilacanadastore.blob.core.windows.net/union-eyes/${path}`, ORG, { NODE_ENV: 'production' } as NodeJS.ProcessEnv).ok).toBe(true)
  })

  it('the upload route is the producer: scan first, store under the helper path, unsigned location, and removal on a failed record', () => {
    const route = src('app/api/exit-interviews/[id]/documents/upload/route.ts')
    expect(route.indexOf('assertBufferSafeForUpload')).toBeLessThan(route.indexOf('uploadBuffer({'))
    expect(route).toContain('interviewDocumentBlobPath(organizationId')
    expect(route).toContain(".url.split('?')[0]")
    expect(route).toContain('await deleteBlob(stored.blobPath)')
  })
})
