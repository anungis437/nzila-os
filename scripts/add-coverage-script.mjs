/**
 * Add "test:coverage": "vitest run --coverage" to every package.json
 * that has a vitest.config.ts but no test:coverage script.
 *
 * Usage: node scripts/add-coverage-script.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const DIRS = ['packages', 'apps', 'services', 'tooling']
const SKIP = new Set([
  'tooling/contract-tests',
  'tooling/staging-certification',
  'tooling/chaos',
])

let modified = 0
let skipped = 0

for (const dir of DIRS) {
  const absDir = join(ROOT, dir)
  let entries
  try {
    entries = execSync(`dir /b "${absDir}"`, { encoding: 'utf-8' }).trim().split('\r\n')
  } catch { continue }

  for (const entry of entries) {
    const projectDir = join(absDir, entry)
    const pkgPath = join(projectDir, 'package.json')
    const vitestPath = join(projectDir, 'vitest.config.ts')
    const relPath = relative(ROOT, projectDir).replace(/\\/g, '/')

    if (SKIP.has(relPath)) continue
    if (!existsSync(pkgPath) || !existsSync(vitestPath)) continue

    const raw = readFileSync(pkgPath, 'utf-8')
    const pkg = JSON.parse(raw)

    if (pkg.scripts?.['test:coverage']) {
      skipped++
      continue
    }

    // Ensure scripts object exists
    if (!pkg.scripts) pkg.scripts = {}

    // Add after "test" script if it exists, otherwise at the end
    pkg.scripts['test:coverage'] = 'vitest run --coverage'

    // Preserve formatting: detect indent
    const indentMatch = raw.match(/^(\s+)"name"/m)
    const indent = indentMatch ? indentMatch[1].length : 2

    writeFileSync(pkgPath, JSON.stringify(pkg, null, indent) + '\n', 'utf-8')
    console.log(`  + ${relPath}`)
    modified++
  }
}

console.log(`\nDone: ${modified} modified, ${skipped} already had test:coverage`)
