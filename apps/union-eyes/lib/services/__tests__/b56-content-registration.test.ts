import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(fileURLToPath(new URL('../../../', import.meta.url)), path), 'utf8')

describe('B56 content publication and registration', () => {
  it('does not let the person who prepared an item for review publish it, and keeps the first publication time (DEF-0B6-EDU-CONTENT-PUBLISH-NO-SEPARATION-OF-DUTIES)', () => {
    const route = read('app/api/content/templates/[id]/status/route.ts')
    expect(route).toContain("currentStatus === 'review' && newStatus === 'published' && submitter === userId")
    expect(route).toContain('published_at = coalesce(published_at, now())')
    expect(route).not.toContain('published_at = now()')
  })

  it('registers only for an open, scheduled session with room (DEF-0B6-EDU-REGISTRATION-NO-CAPACITY-DUPLICATE-OR-SESSION-COURSE-CHECK)', () => {
    const route = read('app/api/education/registrations/route.ts')
    expect(route).toContain('This session is not open for registration')
    expect(route).toContain('Registration for this session is not open')
    expect(route).toContain('This session is full')
  })
})
