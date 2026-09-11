/**
 * Enforces the canonical-source map (PR #752 review, round 3, section 7):
 * production code may not directly import a declaration marked
 * STALE_DUPLICATE by CANONICAL_SCHEMA_DECLARATIONS. Re-export shims are
 * acceptable — they resolve to the same canonical object — but a fresh,
 * independently-declared stale `pgTable()`/`.table()` call for a physical
 * table with a recorded canonical source must not be imported directly by
 * real (non-test) app/, actions/, lib/, or services/ code.
 */
import { describe, it, expect } from 'vitest'
import { scanSchemaDeclarations, getDeclarationStatus } from '../schema-duplicate-table-scan'
import { CANONICAL_SCHEMA_DECLARATIONS } from '../canonical-schema-map'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const APP_ROOT = join(__dirname, '../..')

function findDirectImporters(modulePath: string, exportName: string): string[] {
  let candidateFiles: string[]
  try {
    const out = execFileSync(
      'git',
      ['grep', '-l', `@/db/schema/${modulePath}`, '--', 'app/', 'actions/', 'lib/', 'services/'],
      { cwd: APP_ROOT, encoding: 'utf8' },
    )
    candidateFiles = out.split('\n').map((s) => s.trim()).filter(Boolean)
      .filter((f) => !/__tests__|\.test\.|\.spec\./.test(f))
  } catch {
    return []
  }
  const escaped = modulePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const importRe = new RegExp(`import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s+from\\s+["'\`]@/db/schema/${escaped}["'\`]`, 'g')
  const importers: string[] = []
  for (const file of candidateFiles) {
    let src: string
    try {
      src = readFileSync(join(APP_ROOT, file), 'utf8')
    } catch {
      continue
    }
    importRe.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = importRe.exec(src))) {
      const names = m[1].split(',').map((p) => p.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, '').trim())
      if (names.includes(exportName)) importers.push(file)
    }
  }
  return importers
}

describe('canonical schema map enforcement (PR #752 review)', () => {
  it('no production code directly imports a declaration marked STALE_DUPLICATE', () => {
    const byTable = scanSchemaDeclarations()
    const violations: string[] = []

    for (const key of Object.keys(CANONICAL_SCHEMA_DECLARATIONS)) {
      const decls = byTable.get(key)
      if (!decls) continue
      for (const d of decls) {
        if (getDeclarationStatus(key, d.modulePath) !== 'STALE_DUPLICATE') continue
        const importers = findDirectImporters(d.modulePath, d.exportName)
        if (importers.length > 0) {
          violations.push(`${key}: db/schema/${d.modulePath}(${d.exportName}) imported directly by ${importers.join(', ')}`);
        }
      }
    }

    expect(violations, violations.join('\n')).toEqual([])
  })
})
