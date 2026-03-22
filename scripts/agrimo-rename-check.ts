/**
 * Agrimo Rename Check — CI script.
 * Fails if any "pondu" reference remains in the codebase.
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

const ROOT = join(import.meta.dirname, '..')
const EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.yaml', '.yml', '.md',
  '.css', '.html', '.py', '.sql', '.sh', '.ps1',
])

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', '.next', '.turbo',
  'coverage', '.pnpm', '.venv',
])

const IGNORED_FILES = new Set([
  'agrimo-rename-check.ts', // this script
  'pnpm-lock.yaml',
])

const PATTERN = /\bpondu\b/gi

let violations = 0

function scan(dir: string): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && IGNORED_DIRS.has(entry.name)) continue
    if (IGNORED_DIRS.has(entry.name)) continue

    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      scan(fullPath)
      continue
    }

    if (IGNORED_FILES.has(entry.name)) continue
    if (!EXTENSIONS.has(extname(entry.name))) continue

    const content = readFileSync(fullPath, 'utf-8')
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const matches = lines[i]!.match(PATTERN)
      if (matches) {
        const relative = fullPath.replace(ROOT, '').replace(/\\/g, '/')
        console.error(`  ✗ ${relative}:${i + 1} — "${matches.join('", "')}"`)
        violations++
      }
    }
  }
}

console.log('Agrimo rename check — scanning for residual "pondu" references...\n')
scan(ROOT)

if (violations > 0) {
  console.error(`\n✗ FAIL — ${violations} residual "pondu" reference(s) found.`)
  process.exit(1)
} else {
  console.log('\n✓ PASS — no "pondu" references found.')
}
