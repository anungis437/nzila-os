/**
 * Script to add v8 coverage configuration to all vitest.config.ts files
 * that don't already have it.
 *
 * Usage: node scripts/add-coverage-config.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const DIRS = ['packages', 'apps', 'services', 'tooling', 'tests']

// Exclusions — these should NOT get coverage (contract tests, integration tests, etc.)
const SKIP = new Set([
  'tooling/contract-tests',     // architectural invariant tests, no "source"
  'tooling/staging-certification', // certifications, not source
  'tooling/chaos',              // chaos engineering harness
])

function findVitestConfigs() {
  const configs = []
  for (const dir of DIRS) {
    const absDir = join(ROOT, dir)
    let entries
    try { entries = readdirSync(absDir) } catch { continue }
    for (const entry of entries) {
      const projectDir = join(absDir, entry)
      if (!statSync(projectDir).isDirectory()) continue
      const configPath = join(projectDir, 'vitest.config.ts')
      try {
        const content = readFileSync(configPath, 'utf-8')
        const relPath = relative(ROOT, projectDir).replace(/\\/g, '/')
        configs.push({ relPath, configPath, content })
      } catch { /* no config */ }
    }
  }
  return configs
}

function inferSourceGlob(content, relPath) {
  // Check the include pattern to infer source location
  const includeMatch = content.match(/include:\s*\[([^\]]+)\]/)
  if (includeMatch) {
    const includes = includeMatch[1]
    if (includes.includes('lib/')) return 'lib'
    if (includes.includes('src/')) return 'src'
  }
  // For apps, check if lib/ or src/ dir exists
  if (relPath.startsWith('apps/')) return 'lib'
  return 'src'
}

function buildCoverageBlock(sourceDir, isApp) {
  // Apps get lower thresholds since they have route handlers, UI, etc.
  const thresholds = isApp
    ? { lines: 50, functions: 50, branches: 40, statements: 50 }
    : { lines: 60, functions: 60, branches: 50, statements: 60 }

  return `    coverage: {
      provider: 'v8',
      include: ['${sourceDir}/**/*.ts', '${sourceDir}/**/*.tsx'],
      exclude: ['${sourceDir}/**/*.test.ts', '${sourceDir}/**/*.test.tsx', '${sourceDir}/**/__tests__/**', '${sourceDir}/**/__mocks__/**'],
      thresholds: {
        lines: ${thresholds.lines},
        functions: ${thresholds.functions},
        branches: ${thresholds.branches},
        statements: ${thresholds.statements},
      },
    },`
}

function injectCoverage(content, relPath) {
  const isApp = relPath.startsWith('apps/')
  const sourceDir = inferSourceGlob(content, relPath)
  const coverageBlock = buildCoverageBlock(sourceDir, isApp)

  // Strategy: find `test: {` and insert coverage block after the last property
  // before the closing `}` of the test block.

  // Find the test: { ... } block
  const testBlockStart = content.indexOf('test:')
  if (testBlockStart === -1) {
    console.warn(`  ⚠ No test: block found in ${relPath}`)
    return null
  }

  // Find the opening brace of test: { or test: {\n
  let bracePos = content.indexOf('{', testBlockStart)
  if (bracePos === -1) return null

  // Count braces to find the matching close
  let depth = 0
  let closeBracePos = -1
  for (let i = bracePos; i < content.length; i++) {
    if (content[i] === '{') depth++
    else if (content[i] === '}') {
      depth--
      if (depth === 0) {
        closeBracePos = i
        break
      }
    }
  }

  if (closeBracePos === -1) {
    console.warn(`  ⚠ Could not find matching brace in ${relPath}`)
    return null
  }

  // Insert coverage block before the closing brace of test: {}
  // Check if there's a trailing comma before the closing brace
  const beforeClose = content.substring(bracePos, closeBracePos).trimEnd()
  const needsComma = !beforeClose.endsWith(',')

  const indent = '  ' // base indent for test block properties
  const insertion = (needsComma ? ',\n' : '\n') + coverageBlock + '\n  '

  // Insert just before closeBracePos
  // Walk back from closeBracePos to skip whitespace
  let insertPos = closeBracePos
  while (insertPos > 0 && (content[insertPos - 1] === ' ' || content[insertPos - 1] === '\n' || content[insertPos - 1] === '\r')) {
    insertPos--
  }

  const result = content.substring(0, insertPos) + insertion + content.substring(closeBracePos)
  return result
}

// ---- Main ----
const configs = findVitestConfigs()
let modified = 0
let skipped = 0
let alreadyHas = 0

for (const { relPath, configPath, content } of configs) {
  if (SKIP.has(relPath)) {
    console.log(`  ⊘ SKIP ${relPath} (excluded)`)
    skipped++
    continue
  }

  if (content.includes('coverage')) {
    console.log(`  ✓ ${relPath} (already has coverage)`)
    alreadyHas++
    continue
  }

  const updated = injectCoverage(content, relPath)
  if (updated) {
    writeFileSync(configPath, updated, 'utf-8')
    console.log(`  + ${relPath}`)
    modified++
  } else {
    console.warn(`  ⚠ FAILED ${relPath}`)
  }
}

console.log(`\nDone: ${modified} modified, ${alreadyHas} already had coverage, ${skipped} skipped`)
