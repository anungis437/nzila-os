/**
 * Contract Test — Console Legacy Coverage (CONSOLE-LEGACY-01)
 *
 * Guarantees the subordination invariant from the Workspace Doctrine
 * (docs/doctrine/NZILA_CONSOLE_WORKSPACE_MAP.md §5): every legacy `(dashboard)`
 * route advertised in `apps/console/lib/nav-config` `legacyNavGroups` is framed
 * inside the workspace house — i.e. it appears in the legacy surface map
 * (`workspace/_lib/legacy-map.ts`) as a `LegacyBridge` link.
 *
 * If a new legacy route is added to nav-config but not subordinated into a
 * workspace sub-tab, this test fails — nothing can fall out of the house.
 */
import { describe, it, expect } from 'vitest'
import { legacyNavGroups } from '../../apps/console/lib/nav-config'
import { allMappedHrefs } from '../../apps/console/app/(dashboard)/workspace/_lib/legacy-map'

const mapped = new Set(allMappedHrefs())

// External links are not subordinated surfaces.
const legacyHrefs = legacyNavGroups
  .flatMap((g) => g.items.map((i) => i.href))
  .filter((h) => !/^https?:\/\//.test(h))

describe('Console legacy coverage (CONSOLE-LEGACY-01)', () => {
  it('every legacy nav href is subordinated into a workspace sub-tab', () => {
    const orphans = legacyHrefs.filter((h) => !mapped.has(h))
    expect(
      orphans,
      `Legacy routes not framed in any workspace (add them to workspace/_lib/legacy-map.ts): ${orphans.join(', ')}`,
    ).toEqual([])
  })

  it('the legacy map has no duplicate hrefs', () => {
    const all = allMappedHrefs()
    const dupes = all.filter((h, i) => all.indexOf(h) !== i)
    expect(dupes, `Duplicate hrefs in legacy-map: ${[...new Set(dupes)].join(', ')}`).toEqual([])
  })
})
