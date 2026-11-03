#!/usr/bin/env node
/**
 * npm-bulk-audit.mjs
 *
 * Drop-in replacement for `pnpm audit --audit-level=<level>` that calls the
 * new npm bulk advisory endpoint directly:
 *   POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk
 *
 * Motivation: npm retired the legacy `/v1/security/audits` and
 * `/v1/security/audits/quick` endpoints (410 Gone, April 2026).
 * pnpm still calls those endpoints (tracked: pnpm/pnpm#11265).
 *
 * Usage:
 *   node tooling/security/npm-bulk-audit.mjs [options]
 *
 * Options:
 *   --audit-level=<low|moderate|high|critical>  Minimum severity to report (default: critical)
 *   --json                                       Write JSON report to stdout
 *   --output=<path>                              Write JSON report to file (and print summary to stdout)
 *   Audit/network/lockfile/response failures are always blocking (fail closed).
 *
 * Exit codes:
 *   0 — no vulnerabilities at or above --audit-level
 *   1 — one or more vulnerabilities at or above --audit-level
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const BULK_ENDPOINT = 'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk'
const SEVERITY_ORDER = ['info', 'low', 'moderate', 'high', 'critical']

// ── CLI args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const auditLevel = args.find((a) => a.startsWith('--audit-level='))?.split('=')[1] ?? 'critical'
const jsonMode = args.includes('--json')
const outFile = args.find((a) => a.startsWith('--output='))?.split('=')[1]
const invalidOptions = args.filter((a) =>
  a !== '--json' && !/^--audit-level=(info|low|moderate|high|critical)$/.test(a) && !a.startsWith('--output='),
)
if (invalidOptions.length) {
  console.error(`Unsupported audit option(s): ${invalidOptions.join(', ')}. Registry or audit failures cannot be ignored.`)
  process.exit(2)
}

const minSeverityIdx = SEVERITY_ORDER.indexOf(auditLevel)
if (minSeverityIdx === -1) {
  console.error(`Unknown --audit-level value: "${auditLevel}". Use: low|moderate|high|critical`)
  process.exit(1)
}

// ── Parse pnpm-lock.yaml (v9 snapshots section) ───────────────────────────

/**
 * Reads pnpm-lock.yaml and returns a Map<packageName, Set<version>>.
 * Parses the `snapshots:` block (pnpm lockfile v9) to enumerate all
 * installed packages without any YAML library dependency.
 *
 * Snapshot key format examples:
 *   "  express@4.18.2:"
 *   "  @scope/pkg@1.0.0:"
 *   "  webpack@5.0.0(esbuild@0.19.0):"  ← peer suffix is stripped
 */
export function parseLockfilePackages(lockfilePath) {
  const content = readFileSync(lockfilePath, 'utf-8')
  const pkgMap = new Map()

  // Find the snapshots section (may also be called 'packages' in v6)
  const snapshotsMatch = content.match(/\n(snapshots|packages):\n([\s\S]*)$/)
  if (!snapshotsMatch) {
    throw new Error('Missing snapshots/packages section in pnpm-lock.yaml; cannot establish dependency inventory')
  }

  const snapshotsBlock = snapshotsMatch[2]

  // Each key is a 2-space-indented line followed by a colon
  // e.g:  "  @scope/pkg@1.2.3(peer@x):"
  const lineRe = /^ {2}(@?[^@\n(]+)@([^(\n:]+)/gm
  let m
  while ((m = lineRe.exec(snapshotsBlock)) !== null) {
    const name = m[1].trim()
    const version = m[2].trim()
    if (!name || !version) continue
    if (!pkgMap.has(name)) pkgMap.set(name, new Set())
    pkgMap.get(name).add(version)
  }

  if (pkgMap.size === 0) {
    throw new Error('No resolved packages found in pnpm-lock.yaml; cannot certify an empty graph')
  }
  return pkgMap
}

// ── Call npm bulk advisory endpoint ───────────────────────────────────────

/**
 * Calls the bulk advisory endpoint and returns a flat map of
 * advisoryId => advisoryObject (compatible with supply-chain-policy check-vulns).
 *
 * New endpoint response shape:
 *   { "package-name": [ { id, title, severity, vulnerable_versions, ... } ] }
 */
export function normalizeAdvisoryResponse(raw, pkgMap) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid npm bulk audit payload: expected package-to-advisory object')
  }
  const flat = {}
  for (const [pkgName, advisoryList] of Object.entries(raw)) {
    if (!pkgMap.has(pkgName) || !Array.isArray(advisoryList)) {
      throw new Error(`Invalid audit package entry: ${pkgName}`)
    }
    for (const adv of advisoryList) {
      if (!adv || typeof adv !== 'object' || Array.isArray(adv) ||
          !Number.isSafeInteger(Number(adv.id)) || Number(adv.id) <= 0 ||
          !SEVERITY_ORDER.includes(adv.severity) ||
          typeof adv.title !== 'string' || !adv.title.trim()) {
        throw new Error(`Invalid advisory record for ${pkgName}`)
      }
      const key = String(adv.id)
      if (flat[key] && flat[key].package !== pkgName) {
        throw new Error(`Advisory ID collision across packages: ${key}`)
      }
      flat[key] = { ...adv, package: pkgName }
    }
  }
  return flat
}

async function fetchAdvisories(pkgMap) {
  const requestBody = {}
  for (const [name, versions] of pkgMap) requestBody[name] = [...versions]

  const response = await fetch(BULK_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(30000),
  }).catch((err) => {
    throw new Error(`Audit registry unreachable: ${err.message}`)
  })

  if (!response.ok) {
    throw new Error(`Audit registry returned HTTP ${response.status}; a failed request is never an empty audit`)
  }
  let raw
  try {
    raw = await response.json()
  } catch (err) {
    throw new Error(`Audit registry returned malformed JSON: ${err.message}`)
  }
  return normalizeAdvisoryResponse(raw, pkgMap)
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const lockfilePath = resolve(process.cwd(), 'pnpm-lock.yaml')

  let pkgMap
  try {
    pkgMap = parseLockfilePackages(lockfilePath)
  } catch (err) {
    console.error(`Failed to read pnpm-lock.yaml: ${err.message}`)
    process.exit(1)
  }

  let advisories
  try {
    advisories = await fetchAdvisories(pkgMap)
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }

  // Build structured report (pnpm-audit-report-compatible schema)
  const vulnCounts = { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 }
  for (const advisory of Object.values(advisories)) {
    const sev = advisory.severity ?? 'unknown'
    if (sev in vulnCounts) {
      vulnCounts[sev]++
      vulnCounts.total++
    }
  }

  const report = {
    advisories,
    metadata: {
      vulnerabilities: vulnCounts,
      totalDependencies: pkgMap.size,
      source: 'npm-bulk-advisories',
      status: 'complete',
      lockfile: 'pnpm-lock.yaml',
    },
  }

  if (outFile) {
    writeFileSync(outFile, JSON.stringify(report, null, 2))
  } else if (jsonMode) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  }

  // Determine which advisories breach the threshold
  const breaching = Object.entries(advisories).filter(([, adv]) => {
    const sevIdx = SEVERITY_ORDER.indexOf(adv.severity ?? '')
    return sevIdx >= minSeverityIdx
  })

  // Human-readable output (always written to stderr so it doesn't pollute --json stdout)
  if (!jsonMode) {
    if (Object.keys(advisories).length === 0) {
      console.log(`No vulnerabilities found across ${pkgMap.size} packages.`)
    } else {
      for (const [id, adv] of Object.entries(advisories)) {
        const marker = SEVERITY_ORDER.indexOf(adv.severity ?? '') >= minSeverityIdx ? '✖' : '●'
        console.log(`  ${marker} [${(adv.severity ?? '?').toUpperCase().padEnd(8)}] ${adv.title} (${id})`)
      }
      const total = Object.keys(advisories).length
      console.log(`\n${total} vulnerabilities found, ${breaching.length} at or above "${auditLevel}" level.`)
    }
  }

  if (breaching.length > 0) {
    if (!jsonMode) {
      console.error(`\nError: ${breaching.length} vulnerability/vulnerabilities found at audit level "${auditLevel}".`)
    }
    process.exit(1)
  }

  process.exit(0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error('Fatal audit error:', err.message)
    process.exit(1)
  })
}
