import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (relative: string) => readFileSync(join(__dirname, '..', '..', '..', relative), 'utf8')

describe('F08 outbound fetches of supplied addresses', () => {
  // DEF-0B4-CBA-INGESTION-FETCHES-UNRESTRICTED-URLS
  it('every CBA ingestion adapter fetches through the guarded base fetch', () => {
    const base = read('lib/services/cba-intelligence/adapters/base-adapter.ts')
    expect(base).toContain('assertPublicHttpUrlResolved(url)')
    expect(base).toContain('redirect: "manual"')
    const adapters = ['canlii', 'esdc', 'fpslreb', 'html-bulletin', 'provincial-board', 'statscan-csv', 'union-bargaining']
    for (const name of adapters) {
      const source = read(`lib/services/cba-intelligence/adapters/${name}-adapter.ts`)
      expect(source, name).toContain('this.fetchWithRetry(')
      expect(source, name).not.toMatch(/await fetch\(/)
    }
  })

  it('a source address is checked when it is saved', () => {
    const source = read('app/api/cba-intelligence/sources/route.ts')
    expect(source).toContain('assertPublicHttpUrl(value)')
    expect(source).toContain('baseUrl: publicUrl.optional()')
  })
})
