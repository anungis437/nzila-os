/**
 * Contract Test — Console Nav Config Integrity (CONSOLE-NAV-01)
 *
 * Verifies that:
 *   1. Every NavItem href under apps/console/lib/nav-config.ts points to a
 *      real route segment under apps/console/app/(dashboard)/<segment>/
 *      (or to the well-known top-level segments console/, sign-in/, sign-up/).
 *      External absolute URLs (http(s)://) are skipped.
 *   2. There are no duplicate hrefs across groups.
 *   3. Every group is non-empty.
 *
 * This test catches accidental dead links when routes are renamed but the
 * nav config is not updated.
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { navGroups, legacyNavGroups } from '../../apps/console/lib/nav-config'

// The sidebar renders only `navGroups` (the six-workspace surface). Legacy
// direct routes live in `legacyNavGroups` and remain reachable via the command
// palette. Both must still resolve to real routes — validate them together.
const allGroups = [...navGroups, ...legacyNavGroups]

const DASHBOARD = resolve(__dirname, '../../apps/console/app/(dashboard)')

function hrefToSegmentPath(href: string): string {
  // Strip leading slash, split, drop query/hash
  const [pathOnly] = href.replace(/^\//, '').split(/[?#]/)
  return pathOnly
}

describe('Console nav config integrity (CONSOLE-NAV-01)', () => {
  it('has at least one group', () => {
    expect(navGroups.length).toBeGreaterThan(0)
  })

  it('every group is non-empty', () => {
    const empty = allGroups.filter(g => g.items.length === 0).map(g => g.label)
    expect(empty, `Empty nav groups: ${empty.join(', ')}`).toEqual([])
  })

  it('has no duplicate hrefs across groups', () => {
    const all = allGroups.flatMap(g => g.items.map(i => i.href))
    const dupes = all.filter((h, i) => all.indexOf(h) !== i)
    expect(dupes, `Duplicate nav hrefs: ${[...new Set(dupes)].join(', ')}`).toEqual([])
  })

  for (const group of allGroups) {
    describe(`group "${group.label}"`, () => {
      for (const item of group.items) {
        if (/^https?:\/\//.test(item.href)) continue
        it(`href "${item.href}" points to a real route segment`, () => {
          const segPath = hrefToSegmentPath(item.href)
          // Try (dashboard)/<seg>, then any nested path
          const candidates = [
            resolve(DASHBOARD, segPath),
            resolve(DASHBOARD, segPath, 'page.tsx'),
            resolve(DASHBOARD, segPath, 'page.ts'),
          ]
          const ok = candidates.some(p => existsSync(p))
          expect(
            ok,
            `Nav href "${item.href}" (group "${group.label}", item "${item.name}") does not resolve to a route under apps/console/app/(dashboard)/${segPath}`,
          ).toBe(true)
        })
      }
    })
  }
})
