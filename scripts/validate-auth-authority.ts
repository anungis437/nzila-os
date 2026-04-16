#!/usr/bin/env npx tsx
/**
 * validate-auth-authority
 *
 * Fail-closed auth authority checks:
 * 1) platform-auth must remain explicit as canonical authority.
 * 2) No direct Clerk SDK usage in protected runtime surfaces.
 * 3) Report legacy Clerk residue in union-eyes for migration tracking.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'

type Finding = { severity: 'error' | 'warning'; message: string }

type ResidueSummary = {
  runtime: number
  docs: number
  data: number
  other: number
  total: number
}

const CANONICAL_PHRASE = 'All apps use `@nzila/platform-auth`'

const PROTECTED_ROOTS = [
  'apps/web',
  'apps/console',
  'apps/partners',
  'apps/control-plane',
  'apps/flow',
  'apps/cfo',
  'apps/trade',
  'apps/cora',
  'apps/agrimo',
  'apps/zonga',
  'apps/nacp-exams',
  'apps/mobility',
  'apps/mobility-client-portal',
  'apps/abr',
  'apps/platform-admin',
]

const ALLOWED_FILE_SUBSTRINGS = [
  '/.env.local',
  '/.env.development',
  '/.env.test',
  '/__mocks__/platform-auth-server.ts',
  '/backend/',
]

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.yml', '.yaml'])

const BLOCK_PATTERNS = [
  /@clerk\//,
  /from\s+['"]@clerk\//,
  /NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/,
  /CLERK_SECRET_KEY/,
]

function findRepoRoot(): string {
  let dir = process.cwd()
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = dirname(dir)
  }
  throw new Error('Cannot locate repo root')
}

function walkFiles(root: string, files: string[] = []): string[] {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name)

    if (entry.isDirectory()) {
      if (['node_modules', '.next', '.turbo', '.git', 'dist', 'coverage', '.clerk'].includes(entry.name)) {
        continue
      }
      walkFiles(full, files)
      continue
    }

    const ext = full.slice(full.lastIndexOf('.'))
    if (SCAN_EXTENSIONS.has(ext)) {
      files.push(full)
    }
  }

  return files
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

function shouldAllow(path: string): boolean {
  const normalized = normalizePath(path)
  return ALLOWED_FILE_SUBSTRINGS.some((allowed) => normalized.includes(allowed))
}

function scanProtectedSurfaces(root: string): Finding[] {
  const findings: Finding[] = []

  for (const relRoot of PROTECTED_ROOTS) {
    const fullRoot = join(root, relRoot)
    if (!existsSync(fullRoot) || !statSync(fullRoot).isDirectory()) continue

    const files = walkFiles(fullRoot)
    for (const file of files) {
      if (shouldAllow(file)) continue
      const content = readFileSync(file, 'utf8')

      for (const pattern of BLOCK_PATTERNS) {
        if (pattern.test(content)) {
          findings.push({
            severity: 'error',
            message: `Blocked Clerk provider usage in ${normalizePath(file.replace(`${root}\\`, '').replace(`${root}/`, ''))}: pattern ${pattern}`,
          })
          break
        }
      }
    }
  }

  return findings
}

function classifyResidueFile(relPath: string): keyof Omit<ResidueSummary, 'total'> {
  const p = normalizePath(relPath)
  if (p.includes('/docs/') || p.endsWith('.md')) return 'docs'
  if (p.includes('/db/') || p.includes('/migrations') || p.endsWith('.sql') || p.endsWith('.json')) return 'data'
  if (p.includes('/app/') || p.includes('/lib/') || p.includes('/backend/') || p.includes('/middleware')) return 'runtime'
  return 'other'
}

function summarizeUnionEyesResidue(root: string): ResidueSummary {
  const target = join(root, 'apps', 'union-eyes')
  const summary: ResidueSummary = { runtime: 0, docs: 0, data: 0, other: 0, total: 0 }
  if (!existsSync(target)) return summary

  for (const file of walkFiles(target)) {
    const content = readFileSync(file, 'utf8')
    if (!/\bclerk\b|\bClerk\b|CLERK_/m.test(content)) continue

    const rel = normalizePath(file.replace(`${root}\\`, '').replace(`${root}/`, ''))
    const bucket = classifyResidueFile(rel)
    summary[bucket] += 1
    summary.total += 1
  }

  return summary
}

function main(): void {
  const root = findRepoRoot()
  const findings: Finding[] = []

  const rootReadme = readFileSync(join(root, 'README.md'), 'utf8')
  if (!rootReadme.includes(CANONICAL_PHRASE)) {
    findings.push({ severity: 'error', message: 'README.md must explicitly declare @nzila/platform-auth as canonical auth authority' })
  }

  const ueReadme = readFileSync(join(root, 'apps', 'union-eyes', 'README.md'), 'utf8')
  if (!ueReadme.includes('Clerk is legacy compatibility only')) {
    findings.push({ severity: 'error', message: 'apps/union-eyes/README.md must preserve the legacy-compatibility-only Clerk declaration' })
  }

  findings.push(...scanProtectedSurfaces(root))

  const residue = summarizeUnionEyesResidue(root)
  findings.push({
    severity: 'warning',
    message: `Union-eyes Clerk residue inventory — runtime=${residue.runtime}, docs=${residue.docs}, data=${residue.data}, other=${residue.other}, total=${residue.total}`,
  })

  console.log('\nAuth Authority Validation\n')
  for (const finding of findings) {
    const prefix = finding.severity === 'error' ? 'ERROR' : 'WARN '
    console.log(`${prefix} ${finding.message}`)
  }

  const errorCount = findings.filter((f) => f.severity === 'error').length
  const warningCount = findings.filter((f) => f.severity === 'warning').length
  console.log(`\nErrors: ${errorCount}`)
  console.log(`Warnings: ${warningCount}`)

  if (errorCount > 0) {
    process.exit(1)
  }
}

main()
