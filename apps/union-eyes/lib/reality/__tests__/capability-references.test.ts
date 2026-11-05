/**
 * Every capability a screen names is in the registry.
 *
 * A screen that shows `<CapabilityUnavailable capability="UE-X">` for a capability the registry does not carry shows a notice that cannot say what is unavailable or why, and the
 * registry, which is the one place the product states what is real, is silent about it. The registry also lists the files that own each capability: a path that names a file
 * that is gone sends the next person to nothing. This reads every capability id a UI or route file names and holds it to the registry.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CAPABILITY_REGISTRY, getCapability } from '../capability-registry'

const APP_ROOT = path.resolve(__dirname, '..', '..', '..')
const SKIP_DIRS = new Set(['node_modules', '.next', '__tests__', '__mocks__', 'e2e', 'tests', 'backend', 'mobile', 'archive', 'backups', 'scripts', 'docs', 'public', 'messages', '.git'])

function productionFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) productionFiles(full, found)
    } else if (/\.(?:ts|tsx)$/.test(entry.name) && !/\.(?:test|spec)\.|\.d\.ts$/.test(entry.name) && entry.name !== 'capability-registry.ts') found.push(full)
  }
  return found
}

// The component's own prop (`capability="UE-X"` / `capability={'UE-X'}`), and the string a route or helper hands it.
const NAMED = /\bcapability(?:Id)?\s*[=:]\s*\{?\s*['"](UE-[A-Z0-9][A-Z0-9-]*)['"]/g

describe('the capability registry', () => {
  it('knows every capability a screen or a route names', () => {
    const unknown: string[] = []
    let named = 0
    for (const file of productionFiles(APP_ROOT)) {
      const text = readFileSync(file, 'utf8')
      for (const match of text.matchAll(NAMED)) {
        named += 1
        if (!getCapability(match[1])) unknown.push(`${path.relative(APP_ROOT, file).replace(/\\/g, '/')}: ${match[1]}`)
      }
    }
    expect(named).toBeGreaterThan(40)
    expect(unknown).toEqual([])
  })

  it('has no two entries with one id', () => {
    const seen = new Set<string>()
    const duplicated = CAPABILITY_REGISTRY.map((capability) => capability.id).filter((id) => (seen.has(id) ? true : (seen.add(id), false)))
    expect(duplicated).toEqual([])
  })
})
