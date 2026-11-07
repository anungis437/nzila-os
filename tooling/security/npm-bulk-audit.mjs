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
const outFile = args.find((a) => a.startsWith('--output='))?.slice('--output='.length)
const invalidOptions = args.filter((a) =>
  a !== '--json' && !/^--audit-level=(info|low|moderate|high|critical)$/.test(a) && !a.startsWith('--output='),
)
if (invalidOptions.length) {
  console.error(`Unsupported audit option(s): ${invalidOptions.join(', ')}. Registry or audit failures cannot be ignored.`)
  process.exit(2)
}

// Ambiguous repeated flags must not allow a wrapper or caller to silently
// select a weaker threshold or redirect the report to an unexpected path.
const levelFlags = args.filter((a) => a.startsWith('--audit-level='))
const outputFlags = args.filter((a) => a.startsWith('--output='))
if (levelFlags.length > 1 || outputFlags.length > 1 || args.filter((a) => a === '--json').length > 1 ||
    (jsonMode && outputFlags.length > 0) || outputFlags.some((a) => a.length === '--output='.length)) {
  console.error('Ambiguous or empty audit options: provide at most one --audit-level, one output mode, and a nonempty --output')
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
  const seenSnapshots = new Set()

  // A lockfile inventory must be derived from one top-level resolved section,
  // never from arbitrary indented text or sections appended after snapshots.
  const lines = content.split(/\r?\n/)
  const versions = lines.filter((line) => /^lockfileVersion\s*:/.test(line))
  if (versions.length !== 1 || !/^lockfileVersion: ['\"]?9(?:\.0)?['\"]?\s*$/.test(versions[0])) {
    throw new Error('Unsupported pnpm lockfile version or ambiguous declarations; expected exactly one v9 declaration')
  }
  // Reject noncanonical snapshot headers, including trailing whitespace, before
  // they can evade the exact-section count and hide a second resolved graph.
  const snapshotHeaders = lines.filter((line) => /^snapshots\s*:/.test(line))
  if (snapshotHeaders.some((line) => line !== 'snapshots:')) {
    throw new Error('Malformed snapshots section header in pnpm-lock.yaml')
  }
  const start = lines.findIndex((line) => line === 'snapshots:')
  if (start === -1) {
    throw new Error('Missing snapshots/packages section in pnpm-lock.yaml; cannot establish dependency inventory')
  }
  if (lines.filter((line) => line === 'snapshots:').length !== 1) {
    throw new Error('Ambiguous pnpm lockfile: expected exactly one snapshots section')
  }
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    // YAML forbids tab indentation. A tab-prefixed snapshot can otherwise be
    // silently skipped, allowing a resolved dependency to evade the audit.
    if (/^[ \t]*\t/.test(line)) {
      throw new Error('Tab indentation in pnpm-lock.yaml snapshots is not permitted')
    }
    if (/^[^\s#][^:]*:/.test(line)) break // next top-level YAML section
    if (!line.startsWith('  ') || line.startsWith('    ') || !line.trim() || line.trimStart().startsWith('#')) continue
    // pnpm writes a snapshot key either bare or single-quoted (it quotes every key
    // that starts with `@`), followed by `:` and either nothing (a nested mapping
    // follows) or an empty inline mapping ` {}` (a package with no dependencies).
    // Those are the only two accepted shapes; anything else is malformed.
    const entry = /^ {2}(?:'([^'\n]+)'|([^\s'"][^\n]*?)):(?: \{\})?\s*$/.exec(line)
    const snapshotKey = entry ? (entry[1] ?? entry[2]) : null
    const match = snapshotKey
      ? /^((?:@[^\s@/:]+\/)?[^\s@/:]+)@([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?)(?:\([^\n]*\))?$/.exec(snapshotKey)
      : null
    if (!match) {
      throw new Error('Malformed resolved snapshot key in pnpm-lock.yaml')
    }
    const [, name, version] = match
    // YAML duplicate mapping keys can silently replace an earlier resolution.
    // Reject them rather than certifying an incomplete or ambiguous inventory;
    // a quoted and an unquoted spelling of one key are the same key.
    if (seenSnapshots.has(snapshotKey)) {
      throw new Error(`Duplicate resolved snapshot key in pnpm-lock.yaml: ${snapshotKey}`)
    }
    seenSnapshots.add(snapshotKey)
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
          !(Number.isSafeInteger(adv.id) && adv.id > 0 ||
            typeof adv.id === 'string' && /^[1-9][0-9]*$/.test(adv.id) &&
            Number.isSafeInteger(Number(adv.id))) ||
          !SEVERITY_ORDER.includes(adv.severity) ||
          typeof adv.title !== 'string' || !adv.title.trim()) {
        throw new Error(`Invalid advisory record for ${pkgName}`)
      }
      const key = String(adv.id)
      // Never let a repeated advisory ID overwrite an earlier finding. The
      // registry may return several affected versions for one package; a
      // collision must be investigated, not silently downgraded or hidden.
      if (Object.prototype.hasOwnProperty.call(flat, key)) {
        throw new Error(`Duplicate advisory ID in registry response: ${key}`)
      }
      // The policy binds each map key to a string id (it refuses coerced identities), and the registry sends
      // numbers: record the canonical decimal string that was just validated, so the two always agree.
      flat[key] = { ...adv, id: key, package: pkgName }
    }
  }
  return flat
}

export async function fetchAdvisories(pkgMap) {
  const requestBody = {}
  for (const [name, versions] of pkgMap) requestBody[name] = [...versions]

  const response = await fetch(BULK_ENDPOINT, {
    method: 'POST',
    // Never forward the installed dependency inventory to a redirected origin.
    // Registry redirects are not audit completion evidence.
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(30000),
  }).catch((err) => {
    throw new Error(`Audit registry unreachable: ${err.message}`)
  })

  // A successful status is insufficient if a transport shim or future fetch
  // implementation followed a redirect despite the manual policy. Reject
  // redirected responses before parsing or certifying their advisory payload.
  if (response.redirected === true ||
      (typeof response.url === 'string' && response.url !== '' && response.url !== BULK_ENDPOINT)) {
    throw new Error('Audit registry response was redirected or came from an unexpected endpoint')
  }
  // Partial-content and other non-200 2xx responses cannot certify a complete audit.
  // Check the actual HTTP status, not only the transport's `ok` flag.
  if (response.status !== 200 || response.ok !== true) {
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
