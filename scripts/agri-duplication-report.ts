#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// scripts/agri-duplication-report.ts
//
// Generates a readable duplication report as a CI artifact.
// Detects: duplicate type names, function signatures, enum definitions
// across app code that shadow shared agri packages.
//
// Exits non-zero if any duplication is detected.
// ---------------------------------------------------------------------------

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __scriptDir = typeof import.meta.dirname === 'string'
  ? import.meta.dirname
  : path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__scriptDir, '..')

const SHARED_PACKAGES = [
  'packages/agri-core',
  'packages/agri-reporting',
  'packages/agri-provenance',
  'packages/agri-forecasting',
  'packages/agri-supply-chain',
  'packages/agri-sync-contracts',
  'packages/agri-intelligence',
  'packages/agri-traceability',
  'packages/agri-events',
  'packages/agri-adapters',
  'packages/agri-db',
  'packages/agrimo-core',
  'packages/agrimo-intelligence',
]

const SCAN_DIRS = ['apps/cora', 'apps/agrimo']

const SKIP_DIRS = new Set([
  'node_modules', '.next', 'dist', '.turbo', 'coverage', '__mocks__',
])

function walkTs(dir: string): string[] {
  const abs = path.resolve(ROOT, dir)
  if (!fs.existsSync(abs)) return []
  const results: string[] = []
  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/\.tsx?$/.test(entry.name)) results.push(full)
    }
  }
  walk(abs)
  return results
}

// ─── Collect shared exports ───────────────────────────────────────────────

interface SymbolOrigin {
  name: string
  package: string
  file: string
}

function collectSharedExports(): Map<string, SymbolOrigin> {
  const symbols = new Map<string, SymbolOrigin>()
  const exportRe = /export\s+(?:interface|type|const|function|class|enum)\s+(\w+)/g

  for (const pkg of SHARED_PACKAGES) {
    const files = walkTs(pkg)
    for (const file of files) {
      if (file.includes('__tests__') || file.includes('.test.')) continue
      const content = fs.readFileSync(file, 'utf-8')
      let m: RegExpExecArray | null
      while ((m = exportRe.exec(content)) !== null) {
        const name = m[1]!
        if (!symbols.has(name)) {
          symbols.set(name, {
            name,
            package: pkg,
            file: path.relative(ROOT, file),
          })
        }
      }
    }
  }
  return symbols
}

// ─── Scan app code ────────────────────────────────────────────────────────

interface DuplicationEntry {
  symbol: string
  appFile: string
  appLine: number
  sharedPackage: string
  sharedFile: string
}

function scanForDuplication(
  sharedSymbols: Map<string, SymbolOrigin>,
): DuplicationEntry[] {
  const allowlistPath = path.join(ROOT, 'ops/agri/agri-core-enforcement-allowlist.json')
  const allowedFiles = new Set<string>()
  if (fs.existsSync(allowlistPath)) {
    const data = JSON.parse(fs.readFileSync(allowlistPath, 'utf-8')) as {
      allowlist: { file: string }[]
    }
    for (const e of data.allowlist) allowedFiles.add(path.normalize(e.file))
  }

  const defRe = /^\s*(?:export\s+)?(?:interface|type|const|enum)\s+(\w+)/gm
  const entries: DuplicationEntry[] = []

  for (const dir of SCAN_DIRS) {
    for (const file of walkTs(dir)) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/')
      if (allowedFiles.has(path.normalize(rel))) continue
      if (rel.includes('__tests__') || rel.includes('.test.')) continue

      const content = fs.readFileSync(file, 'utf-8')
      // Strip import lines so we only flag re-definitions, not imports
      const contentNoImports = content.replace(
        /^\s*import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm,
        '',
      )
      let m: RegExpExecArray | null
      defRe.lastIndex = 0
      while ((m = defRe.exec(contentNoImports)) !== null) {
        const sym = m[1]!
        const origin = sharedSymbols.get(sym)
        if (origin) {
          entries.push({
            symbol: sym,
            appFile: rel,
            appLine: contentNoImports.substring(0, m.index).split('\n').length,
            sharedPackage: origin.package,
            sharedFile: origin.file,
          })
        }
      }
    }
  }

  return entries
}

// ─── Main ─────────────────────────────────────────────────────────────────

function main() {
  const sharedSymbols = collectSharedExports()
  const duplications = scanForDuplication(sharedSymbols)

  const report = {
    generatedAt: new Date().toISOString(),
    sharedSymbolCount: sharedSymbols.size,
    scannedDirs: SCAN_DIRS,
    duplicationsFound: duplications.length,
    duplications,
  }

  // Write JSON report for CI artifacts
  const outDir = path.join(ROOT, 'ops/outputs')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const reportPath = path.join(outDir, 'agri-duplication-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))

  // Console output
  console.log('')
  console.log('┌─────────────────────────────────────────────────┐')
  console.log('│         Agri Duplication Detection Report       │')
  console.log('└─────────────────────────────────────────────────┘')
  console.log('')
  console.log(`  Shared symbols tracked: ${sharedSymbols.size}`)
  console.log(`  Scanned: ${SCAN_DIRS.join(', ')}`)
  console.log(`  Report: ${path.relative(ROOT, reportPath)}`)
  console.log('')

  if (duplications.length === 0) {
    console.log('  ✅ No domain duplication detected')
    console.log('')
    process.exit(0)
  }

  for (const d of duplications) {
    console.log(`  ✗  "${d.symbol}" in ${d.appFile}:${d.appLine}`)
    console.log(`     └─ already defined in ${d.sharedPackage} (${d.sharedFile})`)
  }

  console.log('')
  console.log(`  Total duplications: ${duplications.length}`)
  console.log('')
  process.exit(1)
}

main()
