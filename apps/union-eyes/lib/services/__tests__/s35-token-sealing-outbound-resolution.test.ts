import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B91: provider token sealing and the resolving outbound guard', () => {
  it('stores provider tokens sealed on connect and on refresh', () => {
    const callback = src('app/api/social-media/accounts/callback/route.ts')
    expect(callback).toContain('await sealToken(accessToken)')
    expect(callback).toContain('accessToken: sealedAccessToken')
    for (const file of ['lib/social-media/social-media-service.ts', 'app/api/social-media/accounts/route.ts']) {
      const source = src(file)
      expect(source).toContain('accessToken: await sealToken(newAccessToken)')
      expect(source).toContain('refreshToken: await sealToken(newRefreshToken)')
    }
  })

  it('opens a stored token only where a provider client is built', () => {
    const service = src('lib/social-media/social-media-service.ts')
    expect(service).toContain('createMetaClient((await openToken(typedAccount.accessToken)))')
    expect(service).not.toMatch(/createMetaClient\(typedAccount\.accessToken\)/)
  })

  it('fetches CBA sources only after resolving the host, and applies the public-address rule to a source update', () => {
    expect(src('lib/services/cba-intelligence/adapters/base-adapter.ts')).toContain('await assertPublicHttpUrlResolved(url)')
    const update = src('app/api/cba-intelligence/sources/[id]/route.ts')
    expect(update).toContain('baseUrl: publicUrl.optional()')
    expect(update).toContain('feedUrl: publicUrl.nullable().optional()')
  })
})
