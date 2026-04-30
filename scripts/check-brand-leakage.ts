#!/usr/bin/env npx tsx

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')
const ROOT = resolve(__dirname, '..')

const ENGINE_ROOT = join(ROOT, 'packages', 'flow-engine')
const ENGINE_SRC_ROOT = join(ENGINE_ROOT, 'src')
const MAESTRIA_ROOT = join(ROOT, 'apps', 'maestria')

const BRAND_PATTERNS = [
  /maestria/i,
  /atelieros/i,
  /union[ -]?eyes/i,
  /veridian/i,
  /zonga/i,
  /trade/i,
  /mobility/i,
]

interface Violation {
  rule: string
  file: string
  line: number
  content: string
}

const violations: Violation[] = []

function collectFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) {
      if (['node_modules', '.next', '.turbo', 'dist'].includes(entry)) continue
      collectFiles(full, files)
      continue
    }

    if (/\.(ts|tsx|js|jsx|json|md)$/i.test(entry)) {
      files.push(full)
    }
  }
  return files
}

function addViolation(rule: string, file: string, line: number, content: string): void {
  violations.push({
    rule,
    file: relative(ROOT, file).replace(/\\/g, '/'),
    line,
    content: content.trim(),
  })
}

function scanEnginePackage(): void {
  const files = collectFiles(ENGINE_ROOT)
  for (const file of files) {
    const rel = relative(ROOT, file).replace(/\\/g, '/')
    if (file.endsWith('.tsx')) {
      addViolation('ENGINE_UI_FILE', file, 1, rel)
    }

    const content = readFileSync(file, 'utf8')
    const lines = content.split('\n')
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      if (/<[A-Z][A-Za-z0-9]*|return\s*\(/.test(line) && file.startsWith(ENGINE_SRC_ROOT)) {
        addViolation('ENGINE_UI_PATTERN', file, index + 1, line)
      }
      if (/from ['"].*apps\//.test(line) || /from ['"]@\//.test(line)) {
        addViolation('ENGINE_APP_IMPORT', file, index + 1, line)
      }
      for (const pattern of BRAND_PATTERNS) {
        if (pattern.test(line)) {
          addViolation('ENGINE_BRAND_LEAKAGE', file, index + 1, line)
        }
      }
    }
  }
}

function scanMaestriaImports(): void {
  const files = collectFiles(MAESTRIA_ROOT)
  for (const file of files) {
    if (!/\.(ts|tsx)$/i.test(file)) continue
    const content = readFileSync(file, 'utf8')
    const lines = content.split('\n')
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]
      if (/from ['"]@nzila\/flow-engine\//.test(line)) {
        addViolation('PRODUCT_INTERNAL_IMPORT', file, index + 1, line)
      }
    }
  }
}

scanEnginePackage()
scanMaestriaImports()

if (violations.length > 0) {
  console.error(`\n[brand-leakage] FAIL (${violations.length} violation${violations.length === 1 ? '' : 's'})`)
  for (const violation of violations) {
    console.error(` - ${violation.rule} ${violation.file}:${violation.line}`)
    console.error(`   ${violation.content}`)
  }
  process.exit(1)
}

console.log('[brand-leakage] PASS')