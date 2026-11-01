import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B96: honest availability and endpoint rules', () => {
  it('says when engagement snapshots were never computed', () => {
    expect(src('app/api/cognition/engagement/route.ts')).toContain("availability: latest.length === 0 ? 'not_computed' : 'computed'")
  })

  it('accepts only a public http(s) address as an integration endpoint', () => {
    const route = src('app/api/extensions/[id]/route.ts')
    expect(route).toContain('assertPublicHttpUrl(value)')
    expect(route).toContain("'Must be a public http(s) address'")
  })
})
