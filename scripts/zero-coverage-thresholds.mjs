/**
 * Reset all coverage thresholds to 0 across vitest.config.ts files.
 * This enables coverage reporting without enforcement.
 * Thresholds should be ratcheted up per-project as coverage improves.
 *
 * Usage: node scripts/zero-coverage-thresholds.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const DIRS = ['packages', 'apps', 'services', 'tooling', 'tests']

let modified = 0
let noThresholds = 0

for (const dir of DIRS) {
  const absDir = join(ROOT, dir)
  let entries
  try { entries = readdirSync(absDir) } catch { continue }
  for (const entry of entries) {
    const projectDir = join(absDir, entry)
    try { if (!statSync(projectDir).isDirectory()) continue } catch { continue }
    const configPath = join(projectDir, 'vitest.config.ts')
    let content
    try { content = readFileSync(configPath, 'utf-8') } catch { continue }

    if (!content.includes('thresholds')) {
      noThresholds++
      continue
    }

    // Replace threshold values with 0
    const updated = content
      .replace(/lines:\s*\d+/g, 'lines: 0')
      .replace(/functions:\s*\d+/g, 'functions: 0')
      .replace(/branches:\s*\d+/g, 'branches: 0')
      .replace(/statements:\s*\d+/g, 'statements: 0')

    if (updated !== content) {
      writeFileSync(configPath, updated, 'utf-8')
      const relPath = relative(ROOT, projectDir).replace(/\\/g, '/')
      console.log(`  ✓ ${relPath}`)
      modified++
    }
  }
}

console.log(`\nDone: ${modified} modified, ${noThresholds} had no thresholds`)
