/**
 * The orphan census (UE-CONV-H-027): files nothing reaches.
 *
 * Two parts. The first pins what counts as reached (lib/orphan-census/graph.ts) on a small tree built for each case: a route reaches what it imports, however it imports it; a
 * test reaching a module does not make the module reachable; tooling reaches modules the application does not, and that is not enough for a screen. The second runs the census
 * over the real tree: no file in the UI scope may be unreachable (a screen nobody can open is a fake with a file name), and the `lib` modules nothing reaches are held at or
 * below a ceiling that can only fall. Closing findings means deleting the file, with the tests and the evidence that name it; a new orphan fails here.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { findOrphans } from '../lib/orphan-census/graph'
import { ACCEPTED_UI, runCensus } from '../runtime/orphan-census'

const roots: string[] = []

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'orphan-census-'))
  roots.push(root)
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), text)
  }
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('what counts as reached', () => {
  it('reaches what a page imports by alias, by relative path, through a barrel and by a literal dynamic import', () => {
    const root = tree({
      'app/page.tsx': `import { A } from '@/components/a'\nimport B from '../components/b/index'\nconst C = () => import('@/components/c')\nexport default () => null`,
      'components/a.tsx': `export { D } from './d'\nexport const A = 1`,
      'components/d.tsx': `export const D = 1`,
      'components/b/index.ts': `export * from './inner'`,
      'components/b/inner.tsx': `export default 1`,
      'components/c.tsx': `export default 1`,
    })
    expect(findOrphans(root).unreachableUi).toEqual([])
  })

  it('reads a module nothing imports as unreachable, and one only its own test imports as unreachable too', () => {
    const root = tree({
      'app/page.tsx': `export default () => null`,
      'components/alone.tsx': `export const Alone = 1`,
      'components/tested.tsx': `export const Tested = 1`,
      'components/__tests__/tested.test.tsx': `import { Tested } from '../tested'\nexport const x = Tested`,
    })
    expect(findOrphans(root).unreachableUi).toEqual(['components/alone.tsx', 'components/tested.tsx'])
  })

  it('does not report tests, declaration files or stories, and does not follow an import out of a test', () => {
    const root = tree({
      'app/page.tsx': `export default () => null`,
      'components/__tests__/x.test.tsx': `export const a = 1`,
      'components/x.stories.tsx': `export const b = 1`,
      'types/ambient.d.ts': `declare const c: number`,
    })
    expect(findOrphans(root).unreachableUi).toEqual([])
  })

  it('reads a UI file only tooling reaches as unreachable, and a lib module only tooling reaches as alive', () => {
    const root = tree({
      'app/page.tsx': `export default () => null`,
      'scripts/tool.ts': `import { Screen } from '../components/screen'\nimport { helper } from '../lib/helper'\nexport const t = [Screen, helper]`,
      'components/screen.tsx': `export const Screen = 1`,
      'lib/helper.ts': `export const helper = 1`,
      'lib/dead.ts': `export const dead = 1`,
    })
    const report = findOrphans(root)
    expect(report.unreachableUi).toEqual(['components/screen.tsx'])
    expect(report.deadLib).toEqual(['lib/dead.ts'])
  })

  it('reaches what the middleware, the instrumentation hook and a route handler import', () => {
    const root = tree({
      'middleware.ts': `import { a } from '@/lib/a'\nexport const m = a`,
      'instrumentation.ts': `import { b } from '@/lib/b'\nexport const i = b`,
      'app/api/x/route.ts': `import { c } from '@/lib/c'\nexport const GET = c`,
      'lib/a.ts': `export const a = 1`,
      'lib/b.ts': `export const b = 1`,
      'lib/c.ts': `export const c = 1`,
    })
    expect(findOrphans(root).deadLib).toEqual([])
  })

  it('returns a dynamic import whose specifier is computed, and not a comment that mentions one', () => {
    const root = tree({
      'app/page.tsx': `const load = (name: string) => import(name)\nexport default load`,
      'lib/prose.ts': `// the helper does not import (or require) anything at run time\nexport const p = 1`,
    })
    expect(findOrphans(root).dynamic).toEqual(['app/page.tsx'])
  })
})

describe('the real tree', () => {
  const report = runCensus()

  it('finds the tree, so the check is not vacuous', () => {
    expect(report.files).toBeGreaterThan(3000)
  })

  it('has no screen, control, e-mail template or server action that no route reaches', () => {
    expect(report.unreachableUi).toEqual([])
  })

  it('accepts a file only with a reason, and only while it is still unreachable', () => {
    const unreachable = new Set(findOrphans(path.resolve(__dirname, '..', '..')).unreachableUi)
    for (const [file, reason] of Object.entries(ACCEPTED_UI)) {
      expect(reason.length, file).toBeGreaterThan(20)
      expect(unreachable.has(file), `${file} is reachable now: remove it from ACCEPTED_UI`).toBe(true)
    }
  })

  // F03 deliberately removed the only HTTP reachability of the legacy TypeScript cross-organization dues/payment jobs.
  // Their Django/Celery replacements remain scheduled, while these two modules stay as migration-comparison evidence until the
  // finance owners remove them in a dedicated retirement. They are unreachable by design; this temporary increase must fall again.
  const CEILING_DEAD_LIB = 376

  it('holds the lib modules nothing reaches at or below the ceiling', () => {
    expect(report.deadLib.length).toBeLessThanOrEqual(CEILING_DEAD_LIB)
  })
})
