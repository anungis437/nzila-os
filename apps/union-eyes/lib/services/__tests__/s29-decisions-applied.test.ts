import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B85: decisions applied (organization types, calendar revocation, social approval, bot challenge)', () => {
  it('offers only the canonical organization types and tells the user when a create or update is refused', () => {
    const ui = src('components/admin/OrganizationHierarchyAdmin.tsx')
    expect(ui).toContain("const ORGANIZATION_TYPES = ['platform', 'congress', 'federation', 'union', 'local', 'region', 'district'] as const")
    expect(ui).not.toContain('local_union')
    // The hierarchy read answers success; create and update decide from the HTTP status.
    expect(ui.match(/data\.success/g)).toHaveLength(1)
    expect(ui).toContain('if (!response.ok)')
    for (const locale of ['en', 'fr']) {
      const messages = JSON.parse(src(`messages/${locale}.json`))
      expect(Object.keys(messages.organizationHierarchyAdmin.types)).toEqual(['platform', 'congress', 'federation', 'union', 'local', 'region', 'district'])
      expect(messages.organizationHierarchyAdmin.createFailed).toBeTruthy()
    }
  })

  it('asks Google to revoke the grant on disconnect, and says plainly when a provider cannot', () => {
    const revocation = src('lib/external-calendar-sync/provider-revocation.ts')
    expect(revocation).toContain('https://oauth2.googleapis.com/revoke')
    expect(revocation).toContain("if (provider !== 'google') return 'not_supported'")
    const route = src('app/api/calendar-sync/connections/[id]/route.ts')
    expect(route).toContain('providerRevocationVerified: providerRevocation === \'revoked\'')
  })

  it('drafts social posts for named accounts and publishes only on a second officer\'s approval', () => {
    const posts = src('app/api/social-media/posts/route.ts')
    expect(posts).toContain("status: 'draft'")
    expect(posts).toContain('account_ids: z.array')
    expect(posts).not.toContain('publishPost(')
    const review = src('app/api/social-media/posts/review/route.ts')
    expect(review).toContain('draft.createdBy === userId')
    expect(review).toContain('stillPending(draft.id, organizationId)')
    expect(review).toContain("{ accountIds: [draft.accountId], existingPostId: draft.id }")
  })

  it('challenges public writes with Turnstile, failing closed in production', () => {
    for (const route of ['contact', 'workbook/start', 'icra/start', 'icra/checkout', 'workbook/checkout']) {
      expect(src(`app/api/${route}/route.ts`), route).toContain('challenge: true')
    }
    expect(src('lib/public-intake/bot-challenge.ts')).toContain("code: 'BOT_CHALLENGE_NOT_CONFIGURED'")
    expect(src('app/api/icra/submit/route.ts')).toContain("turnstile.notConfigured && process.env.NODE_ENV === 'production'")
  })
})
