import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { composePostText } from '@/lib/social-media/social-media-service'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B81: social scheduling, campaign link, graph query and health-safety statistics', () => {
  it('writes the hashtags into the post text', () => {
    expect(composePostText({ text: 'Solidarity', hashtags: [] })).toBe('Solidarity')
    expect(composePostText({ text: 'Solidarity', hashtags: ['union', 'strong'] })).toBe('Solidarity\n\n#union #strong')
  })

  it('refuses a schedule on a platform that cannot schedule, instead of publishing at once', () => {
    const service = src('lib/social-media/social-media-service.ts')
    expect(service).toContain("const SCHEDULING_PLATFORMS: readonly SocialPlatform[] = ['facebook']")
    expect(service).toContain('Scheduled publishing is not supported on')
  })

  it('links a post to a campaign of the organization and refuses mentions nothing sends', () => {
    const route = src('app/api/social-media/posts/route.ts')
    expect(route).toContain('eq(socialCampaigns.organizationId, organizationId)')
    expect(route).toContain('Mentions are not supported')
    expect(route).not.toContain('campaign_id: _campaign_id')
    expect(src('lib/social-media/social-media-service.ts')).toContain('campaignId: content.campaign_id ?? null')
  })

  it('refuses graph-query filters the reasoner does not read', () => {
    const route = src('app/api/exit-interviews/graph-query/route.ts')
    expect(route).toContain('}).strict().optional(),')
    expect(route).not.toContain('roleFilter')
    expect(route).toContain('minimumRiskLevel applies to isolated_knowledge queries only')
  })

  it('reports an unknown resolution time as null, not zero', () => {
    for (const path of ['app/api/health-safety/incidents/stats/route.ts', 'app/api/health-safety/hazards/stats/route.ts']) {
      expect(src(path)).toContain(': null, // Unknown is not zero')
    }
  })
})
