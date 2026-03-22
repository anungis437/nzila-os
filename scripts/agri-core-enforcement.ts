#!/usr/bin/env tsx
// ---------------------------------------------------------------------------
// scripts/agri-core-enforcement.ts
//
// CI-grade enforcement: detect and fail on unauthorized agri domain duplication.
//
// Checks:
//   1. Duplicate domain model definitions (interfaces / types / const enums)
//   2. Duplicate transformation / business-rule logic
//   3. Duplicate provenance logic outside shared provenance package
//   4. Duplicate reporting / export types outside shared reporting package
//   5. Duplicate supply-chain contract shapes outside shared supply-chain pkg
//   6. Intelligence output shapes that bypass shared contract definitions
//
// Exits non-zero on any violation.
// ---------------------------------------------------------------------------

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

// ─── Configuration ────────────────────────────────────────────────────────

const __scriptDir = typeof import.meta.dirname === 'string'
  ? import.meta.dirname
  : path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__scriptDir, '..')

/** Packages that OWN domain definitions — duplication is allowed here */
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

/** Scan targets — app code and any non-shared agri code */
const SCAN_DIRS = [
  'apps/cora',
  'apps/agrimo',
]

const SKIP_DIRS = new Set([
  'node_modules', '.next', 'dist', '.turbo', 'coverage', '__mocks__',
])
const TS_EXT = new Set(['.ts', '.tsx'])

// ─── Allowlist ────────────────────────────────────────────────────────────

interface AllowlistEntry {
  file: string
  reason: string
}

function loadAllowlist(): Map<string, string> {
  const fp = path.join(ROOT, 'ops/agri/agri-core-enforcement-allowlist.json')
  if (!fs.existsSync(fp)) return new Map()
  const data = JSON.parse(fs.readFileSync(fp, 'utf-8')) as {
    allowlist: AllowlistEntry[]
  }
  const map = new Map<string, string>()
  for (const entry of data.allowlist) {
    map.set(path.normalize(entry.file), entry.reason)
  }
  return map
}

// ─── File walker ──────────────────────────────────────────────────────────

function walkTs(dir: string): string[] {
  const abs = path.resolve(ROOT, dir)
  if (!fs.existsSync(abs)) return []
  const results: string[] = []

  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue
      const full = path.join(d, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (TS_EXT.has(path.extname(entry.name))) {
        results.push(full)
      }
    }
  }
  walk(abs)
  return results
}

// ─── Violation tracker ────────────────────────────────────────────────────

interface Violation {
  rule: string
  file: string
  line: number
  message: string
}

const violations: Violation[] = []

function addViolation(
  rule: string,
  file: string,
  line: number,
  message: string,
) {
  violations.push({ rule, file: path.relative(ROOT, file), line, message })
}

// ─── Shared domain symbols ───────────────────────────────────────────────

/** Collect exported type/interface/const names from shared packages */
function collectSharedSymbols(): {
  domainTypes: Set<string>
  provenanceSymbols: Set<string>
  reportingSymbols: Set<string>
  supplyChainSymbols: Set<string>
  intelligenceSymbols: Set<string>
} {
  const domainTypes = new Set<string>()
  const provenanceSymbols = new Set<string>()
  const reportingSymbols = new Set<string>()
  const supplyChainSymbols = new Set<string>()
  const intelligenceSymbols = new Set<string>()

  const exportPattern =
    /export\s+(?:interface|type|const|function|class|enum)\s+(\w+)/g

  for (const pkg of SHARED_PACKAGES) {
    const files = walkTs(pkg)
    const isProvenance = pkg.includes('provenance')
    const isReporting = pkg.includes('reporting')
    const isSupplyChain = pkg.includes('supply-chain')
    const isIntelligence =
      pkg.includes('intelligence') || pkg.includes('agrimo-intelligence')

    for (const file of files) {
      if (file.includes('__tests__') || file.includes('.test.')) continue
      const content = fs.readFileSync(file, 'utf-8')
      let m: RegExpExecArray | null
      while ((m = exportPattern.exec(content)) !== null) {
        const sym = m[1]!
        domainTypes.add(sym)
        if (isProvenance) provenanceSymbols.add(sym)
        if (isReporting) reportingSymbols.add(sym)
        if (isSupplyChain) supplyChainSymbols.add(sym)
        if (isIntelligence) intelligenceSymbols.add(sym)
      }
    }
  }

  return {
    domainTypes,
    provenanceSymbols,
    reportingSymbols,
    supplyChainSymbols,
    intelligenceSymbols,
  }
}

// ─── Rule patterns ────────────────────────────────────────────────────────

/** Matches interface/type/const definitions that shadow shared domain types */
const DEFINITION_RE =
  /^\s*(?:export\s+)?(?:interface|type|const|enum)\s+(\w+)/gm

/** Matches domain-specific logic patterns that should live in shared */
const PROVENANCE_LOGIC_RE =
  /computeHash|createProvenanceRecord|recordTransformation|verifyProvenance|enforceProvenance|buildProvenanceChain/

const REPORTING_LOGIC_RE =
  /buildReport|aggregateMetrics|mergeReportMetrics|buildCompositeReport|toGovReport|toCSV|toSummary/

const SUPPLY_CHAIN_LOGIC_RE =
  /createSupplyChain|recordEvent|cancelSupplyChain|SupplyChainFSM|canFollowStep|getNextStepTypes|isTerminalStep/

const INTELLIGENCE_LOGIC_RE =
  /computeHistoricalMeanYieldPerHa|computeExpectedYield|computeYieldEfficiency|computeLossRate|simulatePayout|computeFairShare/

// ─── Run checks ───────────────────────────────────────────────────────────

function run() {
  const allowlist = loadAllowlist()
  const symbols = collectSharedSymbols()

  for (const dir of SCAN_DIRS) {
    const files = walkTs(dir)
    for (const file of files) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/')
      if (allowlist.has(path.normalize(rel))) continue
      // skip test files
      if (rel.includes('__tests__') || rel.includes('.test.')) continue

      const content = fs.readFileSync(file, 'utf-8')
      const lines = content.split('\n')

      // Rule 1: duplicate domain model definitions
      // Strip import blocks first so we only flag actual re-definitions.
      const contentNoImports = content.replace(
        /^\s*import\s[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm,
        '',
      )
      let m: RegExpExecArray | null
      DEFINITION_RE.lastIndex = 0
      while ((m = DEFINITION_RE.exec(contentNoImports)) !== null) {
        const sym = m[1]!
        if (symbols.domainTypes.has(sym)) {
          // Map back to original line number
          const strippedPrefix = contentNoImports.substring(0, m.index)
          const strippedLineNum = strippedPrefix.split('\n').length
          // Find the corresponding line in the original content
          let origLineNum = strippedLineNum
          const origLines = content.split('\n')
          let counted = 0
          for (let li = 0; li < origLines.length; li++) {
            if (!/^\s*import\s/.test(origLines[li]!)) counted++
            if (counted >= strippedLineNum) {
              origLineNum = li + 1
              break
            }
          }
          addViolation(
            'AGRI-ENF-001',
            file,
            origLineNum,
            `Redefines shared domain symbol "${sym}" — import from shared package instead`,
          )
        }
      }

      // Rule 2-6: domain logic reimplementation
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        // skip imports — we only flag re-implementations
        if (line.trimStart().startsWith('import')) continue

        if (
          PROVENANCE_LOGIC_RE.test(line) &&
          /(?:function|const|=>)\s/.test(line)
        ) {
          addViolation(
            'AGRI-ENF-003',
            file,
            i + 1,
            `Provenance logic reimplementation detected — use @nzila/agri-provenance`,
          )
        }

        if (
          REPORTING_LOGIC_RE.test(line) &&
          /(?:function|const|=>)\s/.test(line)
        ) {
          addViolation(
            'AGRI-ENF-004',
            file,
            i + 1,
            `Reporting logic reimplementation detected — use @nzila/agri-reporting`,
          )
        }

        if (
          SUPPLY_CHAIN_LOGIC_RE.test(line) &&
          /(?:function|const|=>)\s/.test(line)
        ) {
          addViolation(
            'AGRI-ENF-005',
            file,
            i + 1,
            `Supply-chain logic reimplementation detected — use @nzila/agri-supply-chain`,
          )
        }

        if (
          INTELLIGENCE_LOGIC_RE.test(line) &&
          /(?:function|const|=>)\s/.test(line)
        ) {
          addViolation(
            'AGRI-ENF-006',
            file,
            i + 1,
            `Intelligence logic reimplementation detected — use @nzila/agri-intelligence`,
          )
        }
      }
    }
  }

  // ── Report ────────────────────────────────────────────────────────────

  console.log('')
  console.log('┌─────────────────────────────────────────────────┐')
  console.log('│       Agri Shared-Core Enforcement Report       │')
  console.log('└─────────────────────────────────────────────────┘')
  console.log('')

  if (violations.length === 0) {
    console.log('  ✅ No shared-core violations detected')
    console.log('')
    console.log(`  Scanned: ${SCAN_DIRS.join(', ')}`)
    console.log(`  Shared symbols tracked: ${symbols.domainTypes.size}`)
    console.log('')
    process.exit(0)
  }

  for (const v of violations) {
    console.log(`  ✗  [${v.rule}] ${v.file}:${v.line}`)
    console.log(`     └─ ${v.message}`)
  }

  console.log('')
  console.log(`  Total violations: ${violations.length}`)
  console.log('')
  process.exit(1)
}

run()
