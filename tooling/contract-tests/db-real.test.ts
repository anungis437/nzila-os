/**
 * Contract Test — No In-Memory Fake Databases (STUDIO-DB-01)
 *
 * Verifies:
 *   No `lib/db.ts`, `lib/store.ts`, or `src/db.ts` file uses in-memory
 *   Map/Set/Array patterns as a primary data store.
 *
 *   Specifically bans:
 *     - `new Map<string,` (typed Map stores)
 *     - `new Map()` used for persistence (not caching)
 *     - `const DB =` or `const store =` assigned to a plain object/Map
 *     - `globalThis.__db` or similar global state hacks
 *
 *   Allowed:
 *     - Cache maps (clearly named *cache*, *memo*, *lru*)
 *     - Drizzle ORM usage (`drizzle(...)`, `import { db }`)
 *     - Connection pooling constructs
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../..')

const APPS = [
  'console',
  'partners',
  'union-eyes',
  'cfo',
  'nacp-exams',
  'zonga',
  'abr',
  'orchestrator-api',
]

/** Patterns indicating in-memory fake persistence */
const FAKE_DB_PATTERNS = [
  /const\s+(?:DB|store|database)\s*=\s*new Map/i,
  /globalThis\.__db/,
  /global\.__db/,
  /const\s+(?:DB|store|database)\s*:\s*Record<string,/i,
]

/** Paths to check within each app */
function dbFilesCandidates(app: string): string[] {
  const base = resolve(ROOT, 'apps', app)
  return [
    resolve(base, 'lib', 'db.ts'),
    resolve(base, 'lib', 'store.ts'),
    resolve(base, 'src', 'db.ts'),
    resolve(base, 'src', 'store.ts'),
  ]
}

function read(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, 'utf-8') : ''
}

describe('No in-memory fake databases — STUDIO-DB-01 contract', () => {
  for (const app of APPS) {
    const files = dbFilesCandidates(app).filter(existsSync)
    if (files.length === 0) continue

    describe(`apps/${app}`, () => {
      for (const file of files) {
        const rel = file.replace(ROOT + '\\', '').replace(ROOT + '/', '')
        const content = read(file)

        for (const pattern of FAKE_DB_PATTERNS) {
          it(`${rel} — does not use in-memory fake pattern: ${pattern.source}`, () => {
            expect(
              pattern.test(content),
              `${rel} uses an in-memory Map/object as a database ` +
              `(matched ${pattern.source}). Replace with @nzila/db Drizzle queries.`,
            ).toBe(false)
          })
        }
      }
    })
  }
})
