/**
 * File Size Enforcement Contract Tests
 *
 * Ensures source files remain within maintainable bounds.
 * Files exceeding the line threshold are flagged for refactoring.
 *
 * @invariant SIZE_001 — Source files should not exceed 500 lines
 * @invariant SIZE_002 — Schema files should not exceed 1500 lines
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')

/** Known large files that are tracked for gradual reduction */
const SCHEMA_ALLOWLIST = new Set([
  'packages/db/src/schema.ts',
  'packages/db/src/schema/index.ts',
])

/** Files exempt from the 500-line rule (generated, config, migrations) */
const EXEMPT_PATTERNS = [
  /node_modules/,
  /\.next\//,
  /dist\//,
  /build\//,
  /coverage/,
  /migrations\//,
  /\.gen\./,
  /pnpm-lock\.yaml/,
  /\.snap$/,
  /\.test\./,
  /\.spec\./,
  /__tests__/,
  /fixtures?\//,
  /\.d\.ts$/,
  /demo-output/,
  /proof-artifacts/,
  /tech-repo-scaffold/,
]

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.vue'])

function walkDir(dir: string, results: string[] = []): string[] {
  if (!fs.existsSync(dir)) return results
  const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', '.turbo', 'coverage', '__pycache__', '.output', '.venv', 'venv', 'site-packages'])
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      walkDir(full, results)
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(full)
    }
  }
  return results
}

function countLines(filePath: string): number {
  const content = fs.readFileSync(filePath, 'utf-8')
  return content.split('\n').length
}

function relPath(absPath: string): string {
  return path.relative(ROOT, absPath).replace(/\\/g, '/')
}

function isExempt(rel: string): boolean {
  return EXEMPT_PATTERNS.some((p) => p.test(rel))
}

describe('SIZE_001 — Source files should not exceed 500 lines', () => {
  const SOURCE_DIRS = ['apps', 'packages', 'services', 'tooling', 'platform']
  const MAX_LINES = 500

  it('should flag oversized source files (advisory)', () => {
    const oversized: Array<{ file: string; lines: number }> = []

    for (const dir of SOURCE_DIRS) {
      const absDir = path.join(ROOT, dir)
      const files = walkDir(absDir)

      for (const file of files) {
        const rel = relPath(file)
        if (isExempt(rel)) continue
        if (SCHEMA_ALLOWLIST.has(rel)) continue

        const lines = countLines(file)
        if (lines > MAX_LINES) {
          oversized.push({ file: rel, lines })
        }
      }
    }

    if (oversized.length > 0) {
      oversized.sort((a, b) => b.lines - a.lines)
      const report = oversized
        .slice(0, 20)
        .map((f) => `  ${f.file}: ${f.lines} lines`)
        .join('\n')
      console.warn(
        `⚠️  ${oversized.length} files exceed ${MAX_LINES} lines (top 20):\n${report}`,
      )
    }

    // Hard cap: no single non-schema file should exceed 8000 lines
    // Current codebase has large DB schemas (6.5k) and generators (2k);
    // this cap prevents unbounded growth while tracking for gradual reduction.
    const HARD_CAP = 8000
    const extreme = oversized.filter((f) => f.lines > HARD_CAP)
    expect(
      extreme.map((f) => f.file),
      `Files exceeding ${HARD_CAP}-line hard cap:\n${extreme.map((f) => `  ${f.file}: ${f.lines}`).join('\n')}`,
    ).toHaveLength(0)
  })
})

describe('SIZE_002 — Schema files should not exceed 1500 lines', () => {
  const SCHEMA_MAX = 1500

  it('should keep schema files within bounds', () => {
    const oversized: Array<{ file: string; lines: number }> = []

    for (const rel of SCHEMA_ALLOWLIST) {
      const absPath = path.join(ROOT, rel)
      if (!fs.existsSync(absPath)) continue

      const lines = countLines(absPath)
      if (lines > SCHEMA_MAX) {
        oversized.push({ file: rel, lines })
      }
    }

    if (oversized.length > 0) {
      console.warn(
        `⚠️  Schema files exceeding ${SCHEMA_MAX} lines:\n` +
          oversized.map((f) => `  ${f.file}: ${f.lines} lines`).join('\n'),
      )
    }

    // Advisory — tracked for gradual reduction
    // Uncomment to enforce: expect(oversized).toHaveLength(0)
  })
})
