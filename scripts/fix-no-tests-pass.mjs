/**
 * Add passWithNoTests: true to vitest configs that have no test files.
 * Usage: node scripts/fix-no-tests-pass.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const PROJECTS = [
  'packages/cfo-core',
  'packages/cfo-intelligence',
  'packages/comms-email',
  'packages/crm-hubspot',
  'packages/intelligence',
  'packages/platform-ai-contract',
]

for (const proj of PROJECTS) {
  const configPath = join(ROOT, proj, 'vitest.config.ts')
  let content = readFileSync(configPath, 'utf-8')

  if (content.includes('passWithNoTests')) {
    console.log(`  ✓ ${proj} (already has passWithNoTests)`)
    continue
  }

  // Insert passWithNoTests: true right after test: {
  content = content.replace(/(test:\s*\{)/, '$1\n    passWithNoTests: true,')
  writeFileSync(configPath, content, 'utf-8')
  console.log(`  + ${proj}`)
}

console.log('\nDone')
