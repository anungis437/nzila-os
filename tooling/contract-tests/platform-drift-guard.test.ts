/**
 * Contract Test — No Silent Platform Drift
 *
 * Every app MUST adopt @nzila/platform-shell and @nzila/platform-auth
 * UNLESS it has an explicit, justified exception in governance/platform-exceptions.yaml.
 *
 * This test ensures NO app can silently diverge from platform standards.
 *
 *   DRIFT-01: All apps without platform-shell have an exception
 *   DRIFT-02: All apps without platform-auth have an exception
 *   DRIFT-03: All exceptions have a justification
 *   DRIFT-04: YAML and JSON exception registries are consistent
 *
 * @invariant GOV-NO-SILENT-DRIFT: No app may diverge from platform without governance approval
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

// ── Load inventory ──────────────────────────────────────

const INVENTORY_PATH = join(ROOT, 'tooling', 'repo-inventory', 'output', 'inventory.json')

interface AppMeta {
  name: string
  dependsOnPlatformShell: boolean
  dependsOnPlatformAuth: boolean
}

interface Inventory {
  apps: AppMeta[]
}

function loadInventory(): Inventory {
  if (!existsSync(INVENTORY_PATH)) {
    throw new Error('inventory.json not found — run: pnpm --filter @nzila/repo-inventory generate')
  }
  return JSON.parse(readFileSync(INVENTORY_PATH, 'utf-8'))
}

// ── Load YAML exceptions (parsed as simplified YAML) ────

const YAML_PATH = join(ROOT, 'governance', 'platform-exceptions.yaml')

interface PlatformException {
  app: string
  missing: string
  reason: string
  owner: string
  reviewDate: string
}

function loadYamlExceptions(): PlatformException[] {
  if (!existsSync(YAML_PATH)) return []
  const content = readFileSync(YAML_PATH, 'utf-8')
  // Simple YAML array parser — each item starts with "  - app:"
  const entries: PlatformException[] = []
  const blocks = content.split(/\n\s+-\s+app:\s+/).slice(1)
  for (const block of blocks) {
    const lines = `app: ${block}`.split('\n')
    const get = (key: string): string => {
      for (const line of lines) {
        const match = line.match(new RegExp(`^\\s*${key}:\\s*[>|]?-?\\s*(.+)`, 'm'))
        if (match) return match[1].trim().replace(/^["']|["']$/g, '')
      }
      return ''
    }
    entries.push({
      app: get('app'),
      missing: get('missing'),
      reason: get('reason'),
      owner: get('owner'),
      reviewDate: get('reviewDate'),
    })
  }
  return entries
}

const inventory = loadInventory()
const exceptions = loadYamlExceptions()
const exceptionSet = new Set(exceptions.map(e => `${e.app}::${e.missing}`))

// ── DRIFT-01: platform-shell adoption or exception ──────

describe('DRIFT-01 — All apps adopt platform-shell or have an exception', () => {
  for (const app of inventory.apps) {
    if (app.dependsOnPlatformShell) continue
    it(`${app.name} — has platform-shell exception`, () => {
      expect(exceptionSet.has(`${app.name}::platform-shell`)).toBe(true)
    })
  }
})

// ── DRIFT-02: platform-auth adoption or exception ───────

describe('DRIFT-02 — All apps adopt platform-auth or have an exception', () => {
  for (const app of inventory.apps) {
    if (app.dependsOnPlatformAuth) continue
    it(`${app.name} — has platform-auth exception`, () => {
      expect(exceptionSet.has(`${app.name}::platform-auth`)).toBe(true)
    })
  }
})

// ── DRIFT-03: Every exception has justification ─────────

describe('DRIFT-03 — All exceptions have justification, owner, and review date', () => {
  for (const exc of exceptions) {
    it(`${exc.app} / ${exc.missing} has justification`, () => {
      expect(exc.reason.length).toBeGreaterThan(10)
    })
    it(`${exc.app} / ${exc.missing} has owner`, () => {
      expect(exc.owner.length).toBeGreaterThan(0)
    })
    it(`${exc.app} / ${exc.missing} has review date`, () => {
      expect(exc.reviewDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  }
})

// ── DRIFT-04: YAML + JSON registries are consistent ─────

describe('DRIFT-04 — YAML exceptions match JSON exception registry', () => {
  const JSON_PATH = join(ROOT, 'governance', 'exceptions', 'platform-adoption-exceptions.json')
  if (!existsSync(JSON_PATH)) return

  const jsonRegistry = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
  const jsonSet = new Set(
    jsonRegistry.entries.map((e: { path: string; package: string }) =>
      `${e.path.replace('apps/', '')}::${e.package}`
    )
  )

  it('every YAML exception exists in JSON registry', () => {
    for (const exc of exceptions) {
      const key = `${exc.app}::${exc.missing.replace('platform-', '')}`
      // Normalize: YAML uses "platform-shell", JSON uses "platform-shell"
      const yamlKey = `${exc.app}::${exc.missing}`
      expect(jsonSet.has(yamlKey) || jsonSet.has(key)).toBe(true)
    }
  })
})
