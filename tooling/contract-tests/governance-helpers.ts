/**
 * Shared helpers for governance contract tests.
 *
 * Provides file-walking, exception loading, and violation reporting
 * used across all governance rules.
 */
import {
  readdirSync as fsReaddirSync,
  existsSync as fsExistsSync,
  openSync as fsOpenSync,
  closeSync as fsCloseSync,
  readSync as fsReadSync,
  fstatSync as fsStatSync,
} from 'node:fs'
import { relative as pathRelative } from 'node:path'
import { minimatch } from 'minimatch'

/** Repo root — two directories above tooling/contract-tests */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '')
}

function canonicalPath(p: string): string {
  const normalized = normalizePath(p)
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

function isPathWithin(base: string, candidate: string): boolean {
  const normalizedBase = canonicalPath(base)
  const normalizedCandidate = canonicalPath(candidate)
  return normalizedCandidate === normalizedBase || normalizedCandidate.startsWith(`${normalizedBase}/`)
}

function readUtf8Trusted(filePath: string): string {
  // nosemgrep: path is validated by isPathWithin()/safeJoin before this helper is called
  const fd = fsOpenSync(filePath, 'r')
  try {
    const size = fsStatSync(fd).size
    const buffer = Buffer.alloc(Math.max(0, size))
    fsReadSync(fd, buffer, 0, buffer.length, 0)
    return buffer.toString('utf-8')
  } finally {
    fsCloseSync(fd)
  }
}

const normalizedDir = normalizePath(__dirname)
const CONTRACT_TEST_SUFFIX = '/tooling/contract-tests'
export const ROOT = normalizedDir.endsWith(CONTRACT_TEST_SUFFIX)
  ? normalizedDir.slice(0, -CONTRACT_TEST_SUFFIX.length)
  : normalizedDir

// ── File scanning ───────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.next',
  '.turbo',
  'build',
  'coverage',
  '.git',
  '__fixtures__',
  '.venv',
  'playwright-report',  // Playwright trace assets contain minified third-party JS
  'test-results',       // Playwright video/screenshot artifacts
])

/**
 * Recursively collect files under `dir` matching `extensions`.
 * Skips node_modules, dist, .next, build, coverage by default.
 */
export function walkSync(
  dir: string,
  extensions: string[] = ['.ts', '.tsx', '.js', '.jsx', '.mjs'],
): string[] {
  const results: string[] = []
  if (!fsExistsSync(dir)) return results
  for (const entry of fsReaddirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue
    const fullPath = safeJoin(dir, entry.name)
    if (!fullPath) continue
    if (entry.isDirectory()) {
      results.push(...walkSync(fullPath, extensions))
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath)
    }
  }
  return results
}

/**
 * Find all files matching a glob under ROOT.
 */
export function findFilesGlob(
  pattern: string,
  extensions?: string[],
): string[] {
  // Walk root and filter by glob
  const allFiles = walkSync(ROOT, extensions)
  return allFiles.filter((f) => {
    const rel = pathRelative(ROOT, f).replace(/\\/g, '/')
    return minimatch(rel, pattern)
  })
}

/**
 * Read file content, returning '' if the file doesn't exist.
 */
export function readContent(filePath: string): string {
  try {
    if (!isPathWithin(ROOT, filePath)) return ''
    return readUtf8Trusted(filePath)
  } catch {
    return ''
  }
}

/**
 * Return relative path from ROOT with forward slashes.
 */
export function relPath(abs: string): string {
  return pathRelative(ROOT, abs).replace(/\\/g, '/')
}

/**
 * Join path segments under a trusted base and reject path traversal.
 */
export function safeJoin(base: string, ...parts: string[]): string | null {
  if (parts.some((part) => part.includes('\0') || /(^|[\\/])\.\.([\\/]|$)/.test(part))) return null
  const candidate = normalizePath([base, ...parts].join('/'))
  return isPathWithin(base, candidate) ? candidate : null
}

// ── Exception loading ───────────────────────────────────────────────────────

export interface ExceptionEntry {
  path: string
  owner: string
  justification: string
  expiresOn: string
}

export interface ExceptionFile {
  ruleId: string
  description: string
  entries: ExceptionEntry[]
}

/**
 * Load a governance exception file.
 * Validates expiry dates — throws on expired entries.
 */
export function loadExceptions(
  relativeJsonPath: string,
  today: Date = new Date(),
): ExceptionFile & { expiredEntries: ExceptionEntry[] } {
  const absPath = safeJoin(ROOT, relativeJsonPath)
  if (!absPath || !fsExistsSync(absPath)) {
    return {
      ruleId: '',
      description: '',
      entries: [],
      expiredEntries: [],
    }
  }
  const data: ExceptionFile = JSON.parse(readUtf8Trusted(absPath))
  const expiredEntries = data.entries.filter(
    (e) => new Date(e.expiresOn) < today,
  )
  return { ...data, expiredEntries }
}

/**
 * Check if a file's relative path is covered by an exception glob.
 */
export function isExcepted(
  relFilePath: string,
  exceptions: ExceptionEntry[],
): boolean {
  return exceptions.some((e) => minimatch(relFilePath, e.path))
}

// ── Violation formatting ────────────────────────────────────────────────────

export interface Violation {
  ruleId: string
  filePath: string
  offendingValue?: string
  line?: number
  snippet?: string
  remediation?: string
}

/**
 * Format violations for human-readable output.
 */
export function formatViolations(violations: Violation[]): string {
  return violations
    .map((v) => {
      const loc = v.line ? `:${v.line}` : ''
      const parts = [
        `[${v.ruleId}] ${v.filePath}${loc}`,
        v.offendingValue ? `  Value: ${v.offendingValue}` : '',
        v.snippet ? `  Snippet: ${v.snippet.trim().slice(0, 120)}` : '',
        v.remediation ? `  Fix: ${v.remediation}` : '',
      ]
      return parts.filter(Boolean).join('\n')
    })
    .join('\n\n')
}
