import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(fileURLToPath(new URL('../../../', import.meta.url)), path), 'utf8')

describe('B50 social analytics export and lookups', () => {
  const analytics = read('app/api/social-media/analytics/route.ts')
  const exportHandler = analytics.slice(analytics.indexOf('export const DELETE'))

  it('is a staff read, rate limited and bounded (DEF-0B11-SOC-ANALYTICS-EXPORT-IS-A-DELETE-VERB-READ-AT-MEMBER-...)', () => {
    expect(exportHandler).toContain("withRoleAuth('steward'")
    expect(exportHandler).toContain('social-analytics-export:')
    expect(exportHandler.match(/\.limit\(MAX_EXPORT_ROWS\)/g)).toHaveLength(3)
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
