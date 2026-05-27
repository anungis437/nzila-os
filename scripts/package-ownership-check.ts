/**
 * Package Ownership Check — verifies every package under packages/ has a valid
 * package.meta.json with all required fields.
 *
 * Usage: pnpm exec tsx scripts/package-ownership-check.ts
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const PACKAGES_DIR = path.join(ROOT, 'packages')

const VALID_CATEGORIES = ['PLATFORM_CORE', 'DOMAIN_SHARED', 'APP_SUPPORT', 'APP_LOCAL_EXTRACTION', 'DEPRECATED'] as const
const VALID_STABILITY = ['STABLE', 'EVOLVING', 'EXPERIMENTAL', 'DEPRECATED'] as const
const REQUIRED_FIELDS = ['owner', 'category', 'stability', 'allowed_dependents', 'forbidden_dependents', 'deprecated'] as const

interface MetaSchema {
  owner: string
  category: string
  stability: string
  allowed_dependents: string[]
  forbidden_dependents: string[]
  replacement_for: string | null
  deprecated: boolean
  deprecation_note: string | null
}

interface Violation {
  pkg: string
  issue: string
}

const violations: Violation[] = []

function fail(pkg: string, issue: string): void {
  violations.push({ pkg, issue })
}

// ── Scan packages ───────────────────────────────────

const dirs = fs.readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(PACKAGES_DIR, d.name, 'package.json')))

for (const dir of dirs) {
  const metaPath = path.join(PACKAGES_DIR, dir.name, 'package.meta.json')

  if (!fs.existsSync(metaPath)) {
    fail(dir.name, 'Missing package.meta.json')
    continue
  }

  let meta: MetaSchema
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
  } catch {
    fail(dir.name, 'Invalid JSON in package.meta.json')
    continue
  }

  // Required fields
  for (const field of REQUIRED_FIELDS) {
    if (!(field in meta)) {
      fail(dir.name, `Missing required field: ${field}`)
    }
  }

  // Category validation
  if (meta.category && !VALID_CATEGORIES.includes(meta.category as (typeof VALID_CATEGORIES)[number])) {
    fail(dir.name, `Invalid category "${meta.category}" — must be one of: ${VALID_CATEGORIES.join(', ')}`)
  }

  // Stability validation
  if (meta.stability && !VALID_STABILITY.includes(meta.stability as (typeof VALID_STABILITY)[number])) {
    fail(dir.name, `Invalid stability "${meta.stability}" — must be one of: ${VALID_STABILITY.join(', ')}`)
  }

  // Owner must be non-empty
  if (meta.owner !== undefined && (!meta.owner || typeof meta.owner !== 'string')) {
    fail(dir.name, 'Owner must be a non-empty string')
  }

  // allowed_dependents must be array
  if (meta.allowed_dependents !== undefined && !Array.isArray(meta.allowed_dependents)) {
    fail(dir.name, 'allowed_dependents must be an array')
  }

  // Deprecation consistency
  if (meta.deprecated && meta.stability !== 'DEPRECATED') {
    fail(dir.name, 'Package is deprecated but stability is not DEPRECATED')
  }

  if (meta.deprecated && !meta.deprecation_note) {
    fail(dir.name, 'Deprecated package must have deprecation_note')
  }

  if (meta.category === 'DEPRECATED' && !meta.deprecated) {
    fail(dir.name, 'Category is DEPRECATED but deprecated flag is false')
  }
}

// ── Report ──────────────────────────────────────────

const total = dirs.length
const passing = total - new Set(violations.map((v) => v.pkg)).size

process.stdout.write('\n')
process.stdout.write('═══════════════════════════════════════\n')
process.stdout.write('  Package Ownership Check\n')
process.stdout.write('═══════════════════════════════════════\n\n')
process.stdout.write(`  Packages scanned: ${total}\n`)
process.stdout.write(`  Passing:          ${passing}\n`)
process.stdout.write(`  Violations:       ${violations.length}\n\n`)

if (violations.length > 0) {
  for (const v of violations) {
    process.stderr.write(`  ✗ packages/${v.pkg}: ${v.issue}\n`)
  }
  process.stderr.write('\n')
  process.exit(1)
} else {
  process.stdout.write('  ✓ All packages have valid ownership metadata\n\n')
}
