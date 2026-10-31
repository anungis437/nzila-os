import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { likeContaining } from '../like-pattern'
import { boundedJsonRecord } from '../bounded-json-record'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('B48 literal search terms and bounded free-form JSON', () => {
  it('takes LIKE wildcards in a term literally', () => {
    expect(likeContaining('50%_off\\')).toBe('%50\\%\\_off\\\\%')
    expect(likeContaining('plain')).toBe('%plain%')
  })

  describe('boundedJsonRecord (DEF-0B10-PIL-PUBLIC-APPLICATION-RESPONSES-OBJECT-AND-ASSESSMENT-...)', () => {
    const schema = boundedJsonRecord({ maxBytes: 200, maxKeys: 3, maxDepth: 2 })

    it('accepts a small shallow object', () => {
      expect(schema.safeParse({ a: 'x', b: { c: [1, 2] } }).success).toBe(true)
    })

    it.each([
      ['too many keys', { a: 1, b: 2, c: 3, d: 4 }],
      ['too deep', { a: { b: { c: { d: 1 } } } }],
      ['too large', { a: 'x'.repeat(300) }],
      ['an over-long key', { ['k'.repeat(101)]: 1 }],
    ])('refuses %s', (_name, value) => {
      expect(schema.safeParse(value).success).toBe(false)
    })
  })

  it('lists no platform, suspended or archived organization with or without a term, in a stable order (DEF-0B10-OPL-06)', () => {
    const route = read('app/api/organizations/search/route.ts')
    expect(route).toContain("ne(organizations.organizationType, 'platform')")
    expect(route).toContain("coalesce(${organizations.status}, 'active') = 'active'")
    expect(route).toContain('likeContaining(q)')
    expect(route).toContain('.orderBy(asc(organizations.name), asc(organizations.id))')
    expect(route).not.toContain('`%${q}%`')
  })

  it('stores caller metadata before, never over, the audited target and role (DEF-0B9-ASM-ONBOARDING-EVENT-METADATA-IS-UNBOUNDED-...)', () => {
    const route = read('app/api/onboarding/events/route.ts')
    const spread = route.indexOf('...(parsed.data.metadata ?? {})')
    expect(spread).toBeGreaterThan(0)
    expect(route.indexOf('targetUserId: parsed.data.targetUserId,', spread)).toBeGreaterThan(spread)
    expect(route).toContain('.max(255)')
    expect(route).toContain('metadata has too many keys')
  })

  it('bounds the anonymous pilot application responses and keeps only the assessment score', () => {
    const route = read('app/api/pilot/apply/route.ts')
    expect(route).toContain('boundedJsonRecord({ maxBytes: 16 * 1024, maxKeys: 60, maxDepth: 4 })')
    expect(route).not.toContain('.passthrough()')
  })
})
