import { describe, expect, it } from 'vitest'
import { LEGACY_SCRIPTS, getLegacyScript } from '../src/legacy-bridge/registry'
import { main } from '../src/cli'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

function tmpReport(): string {
  return path.join(os.tmpdir(), `seed-legacy-report-${Date.now()}-${Math.random()}.json`)
}

describe('legacy registry', () => {
  it('exposes the three currently-deprecated seed scripts', () => {
    expect(LEGACY_SCRIPTS.map((s) => s.id).sort()).toEqual(
      ['cba-intelligence', 'cupe-pilot', 'union-eyes-demo'].sort(),
    )
  })

  it('every entry points to a file that exists in the repo', () => {
    const repoRoot = path.resolve(__dirname, '../../..')
    for (const s of LEGACY_SCRIPTS) {
      const abs = path.resolve(repoRoot, s.path)
      expect(fs.existsSync(abs), `missing: ${s.path}`).toBe(true)
    }
  })

  it('runner is "tsx" for .ts entries and "node" for .mjs entries', () => {
    for (const s of LEGACY_SCRIPTS) {
      if (s.path.endsWith('.mjs')) expect(s.runner).toBe('node')
      else if (s.path.endsWith('.ts')) expect(s.runner).toBe('tsx')
    }
  })

  it('getLegacyScript resolves known ids and returns undefined otherwise', () => {
    expect(getLegacyScript('union-eyes-demo')?.app).toBe('union-eyes')
    expect(getLegacyScript('does-not-exist')).toBeUndefined()
  })
})

describe('cli legacy command', () => {
  it('legacy --list exits 0', async () => {
    const code = await main(['legacy', '--list', `--report=${tmpReport()}`])
    expect(code).toBe(0)
  })

  it('legacy without --script and without --list exits 2', async () => {
    const code = await main(['legacy', `--report=${tmpReport()}`])
    expect(code).toBe(2)
  })

  it('legacy --script=unknown exits 2', async () => {
    const code = await main(['legacy', '--script=does-not-exist', `--report=${tmpReport()}`])
    expect(code).toBe(2)
  })
})
