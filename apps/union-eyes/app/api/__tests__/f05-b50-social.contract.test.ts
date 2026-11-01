import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(fileURLToPath(new URL('../../../', import.meta.url)), path), 'utf8')

describe('B50 social analytics export and lookups', () => {
  const analytics = read('app/api/social-media/analytics/route.ts')
  // The export now lives in a GET-reached staff handler (the DELETE verb answers 405), so the contract reads that handler (disclosed update).
  const exportHandler = analytics.slice(analytics.indexOf('const exportSocialMediaAnalyticsWithAuth'), analytics.indexOf('export const DELETE'))

  it('is a staff read, rate limited and bounded (DEF-0B11-SOC-ANALYTICS-EXPORT-IS-A-DELETE-VERB-READ-AT-MEMBER-...)', () => {
    expect(exportHandler).toContain("withRoleAuth('steward'")
    expect(exportHandler).toContain('social-analytics-export:')
    expect(exportHandler.match(/\.limit\(MAX_EXPORT_ROWS \+ 1\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
    expect(analytics).toContain("export const DELETE = withRoleAuth('steward', async () =>")
    expect(analytics).toContain('status: 405')
  })

  it('neutralises formula cells and reads campaign columns by their own keys', () => {
    expect(exportHandler).toContain('csvCell(String(value))')
    expect(exportHandler).toContain('CAMPAIGN_EXPORT_KEYS[header]')
    expect(exportHandler).toContain("row[key] ?? ''")
  })

  it('names the caller organization in the post and campaign lookups, so another organization answers 404 (DEF-0B11-SOC-RECORD-IS-LOADED-BY-ID-ALONE-...)', () => {
    expect(read('app/api/social-media/posts/route.ts')).toContain('eq(socialAccounts.organizationId, organizationId)))')
    expect(analytics).toContain('eq(socialCampaigns.organizationId, organizationId)))')
    expect(analytics).not.toContain('organizationId !== campaign.organizationId')
    expect(read('app/api/social-media/posts/route.ts')).not.toContain('organizationId !== post.orgId')
  })
})
