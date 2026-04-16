#!/usr/bin/env npx tsx
/**
 * validate:truth-authority
 *
 * Enforces cross-surface truth coherence:
 * 1) App tier mappings in docs must match canonical registry tiers.
 * 2) Auth canonical declaration must be explicit and legacy paths labeled.
 * 3) Inventory package count must match actual workspace package manifests.
 * 4) GA readiness wording must remain state-machine consistent.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

type Severity = 'error' | 'warning'

type Finding = {
  severity: Severity
  scope: string
  message: string
}

function findRepoRoot(): string {
  let dir = process.cwd()
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      return dir
    }
    dir = dirname(dir)
  }
  throw new Error('Cannot find repo root from current working directory')
}

function normalizeAppName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, '-')

  const aliases: Record<string, string> = {
    unioneyes: 'union-eyes',
    'control-plane': 'control-plane',
    'orchestrator-api': 'orchestrator-api',
    'mobility-client-portal': 'mobility-client-portal',
    'platform-admin': 'platform-admin',
    'nacp-exams': 'nacp-exams',
  }

  const collapsed = normalized.replace(/-/g, '')
  if (aliases[normalized]) return aliases[normalized]
  if (aliases[collapsed]) return aliases[collapsed]
  return normalized
}

function loadRegistryTiers(root: string): Map<string, string> {
  const registryPath = join(root, 'packages', 'platform-contracts', 'src', 'registry.ts')
  const content = readFileSync(registryPath, 'utf8')
  const map = new Map<string, string>()

  const appBlockRegex = /id:\s*'([^']+)'[\s\S]*?tier:\s*'([^']+)'/g
  let match: RegExpExecArray | null
  while ((match = appBlockRegex.exec(content)) !== null) {
    map.set(match[1], match[2])
  }
  return map
}

function loadRegistryDevPorts(root: string): Map<string, number> {
  const registryPath = join(root, 'packages', 'platform-contracts', 'src', 'registry.ts')
  const content = readFileSync(registryPath, 'utf8')
  const map = new Map<string, number>()

  const appBlockRegex = /id:\s*'([^']+)'[\s\S]*?devPort:\s*(\d+)/g
  let match: RegExpExecArray | null
  while ((match = appBlockRegex.exec(content)) !== null) {
    map.set(match[1], Number(match[2]))
  }

  return map
}

function loadAppPackageDevPorts(root: string): Map<string, number> {
  const appsRoot = join(root, 'apps')
  const map = new Map<string, number>()

  if (!existsSync(appsRoot)) {
    return map
  }

  for (const entry of readdirSync(appsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const pkgPath = join(appsRoot, entry.name, 'package.json')
    if (!existsSync(pkgPath)) continue

    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string> }
      const devScript = pkg.scripts?.dev ?? ''
      const match = devScript.match(/--port\s+(\d+)/)
      if (match) {
        map.set(entry.name, Number(match[1]))
      }
    } catch {
      // Skip malformed package manifests; parser errors are surfaced by package tooling.
    }
  }

  return map
}

function parsePortfolioTiers(root: string): Map<string, string> {
  const portfolioPath = join(root, 'docs', 'platform', 'portfolio-matrix.md')
  const md = readFileSync(portfolioPath, 'utf8')
  const map = new Map<string, string>()

  const rowRegex = /^\|\s*\*\*([^*]+)\*\*\s*\|[^|]*\|[^|]*\|[^|]*\|\s*([A-Z_]+)\s*\|/gm
  let match: RegExpExecArray | null
  while ((match = rowRegex.exec(md)) !== null) {
    map.set(normalizeAppName(match[1]), match[2])
  }

  return map
}

function parseReadmeTiers(root: string): Map<string, string> {
  const readmePath = join(root, 'README.md')
  const md = readFileSync(readmePath, 'utf8')
  const map = new Map<string, string>()

  const sectionMatch = md.match(/## Products at a Glance[\s\S]*?(?:\n## |$)/)
  if (!sectionMatch) {
    return map
  }

  const section = sectionMatch[0]
  const tierRowRegex = /^\|\s*\*\*([A-Z_]+)\*\*\s*\|\s*([^|]+)\|/gm
  let match: RegExpExecArray | null

  while ((match = tierRowRegex.exec(section)) !== null) {
    const tier = match[1].trim()
    const apps = match[2]
      .split(',')
      .map((a) => normalizeAppName(a))
      .filter(Boolean)

    for (const app of apps) {
      map.set(app, tier)
    }
  }

  return map
}

function countWorkspacePackageManifests(root: string): number {
  const packagesRoot = join(root, 'packages')
  if (!existsSync(packagesRoot)) {
    return 0
  }

  let count = 0
  for (const entry of readdirSync(packagesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const pkgDir = join(packagesRoot, entry.name)
    if (existsSync(join(pkgDir, 'package.json'))) {
      count += 1
    }
  }

  return count
}

function loadInventoryPackageCount(root: string): number {
  const inventoryPath = join(root, 'tooling', 'repo-inventory', 'output', 'inventory.json')
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8')) as { packageCount?: number }
  return Number(inventory.packageCount ?? 0)
}

function main(): void {
  const root = resolve(findRepoRoot())
  const findings: Finding[] = []

  const registryTiers = loadRegistryTiers(root)
  const registryPorts = loadRegistryDevPorts(root)
  const portfolioTiers = parsePortfolioTiers(root)
  const readmeTiers = parseReadmeTiers(root)
  const appPorts = loadAppPackageDevPorts(root)

  for (const [app, tier] of registryTiers.entries()) {
    const portfolioTier = portfolioTiers.get(app)
    if (!portfolioTier) {
      findings.push({ severity: 'error', scope: 'portfolio', message: `Missing app row for ${app}` })
    } else if (portfolioTier !== tier) {
      findings.push({
        severity: 'error',
        scope: 'portfolio',
        message: `Tier mismatch for ${app}: registry=${tier}, portfolio=${portfolioTier}`,
      })
    }

    const readmeTier = readmeTiers.get(app)
    if (!readmeTier) {
      findings.push({ severity: 'error', scope: 'readme', message: `Missing app mapping for ${app} in Products at a Glance` })
    } else if (readmeTier !== tier) {
      findings.push({
        severity: 'error',
        scope: 'readme',
        message: `Tier mismatch for ${app}: registry=${tier}, README=${readmeTier}`,
      })
    }
  }

  for (const [app, registryPort] of registryPorts.entries()) {
    const appPort = appPorts.get(app)
    if (appPort == null) {
      if (app === 'orchestrator-api') {
        continue
      }
      findings.push({
        severity: 'error',
        scope: 'ports',
        message: `Missing app package dev port for ${app}`,
      })
      continue
    }

    if (appPort !== registryPort) {
      findings.push({
        severity: 'error',
        scope: 'ports',
        message: `Dev port mismatch for ${app}: registry=${registryPort}, package=${appPort}`,
      })
    }
  }

  const rootReadme = readFileSync(join(root, 'README.md'), 'utf8')
  if (!rootReadme.includes('All apps use `@nzila/platform-auth`')) {
    findings.push({
      severity: 'error',
      scope: 'auth',
      message: 'README.md is missing explicit canonical platform-auth declaration',
    })
  }

  const ueReadme = readFileSync(join(root, 'apps', 'union-eyes', 'README.md'), 'utf8')
  if (!ueReadme.includes('Clerk is legacy compatibility only')) {
    findings.push({
      severity: 'error',
      scope: 'auth',
      message: 'apps/union-eyes/README.md must explicitly mark Clerk as legacy compatibility only',
    })
  }

  const manifestCount = countWorkspacePackageManifests(root)
  const inventoryCount = loadInventoryPackageCount(root)
  if (manifestCount !== inventoryCount) {
    findings.push({
      severity: 'error',
      scope: 'inventory',
      message: `inventory.json packageCount=${inventoryCount} does not match workspace package manifests=${manifestCount}`,
    })
  }

  const gaReadiness = readFileSync(join(root, 'docs', 'ga', 'GA_READINESS_GATE.md'), 'utf8')
  const gaReport = readFileSync(join(root, 'docs', 'ga', 'GA_CERTIFICATION_REPORT.md'), 'utf8')

  const redTeamPending = gaReadiness.includes('Not executed') || gaReadiness.includes('PENDING RED TEAM')
  const reportIncomplete = gaReport.includes('Status: INCOMPLETE')
  const claimsAllPass = gaReadiness.includes('ALL HARD GATES PASS AS OF')

  if (redTeamPending && reportIncomplete && claimsAllPass) {
    findings.push({
      severity: 'error',
      scope: 'ga-state',
      message: 'GA readiness claims final hard-gate pass while red-team and certification report are still incomplete',
    })
  }

  console.log('\n=====================================')
  console.log(' Truth Authority Validation')
  console.log('=====================================\n')

  if (findings.length === 0) {
    console.log('PASS: truth authority validation passed')
    return
  }

  const errors = findings.filter((f) => f.severity === 'error')
  const warnings = findings.filter((f) => f.severity === 'warning')

  for (const finding of findings) {
    const icon = finding.severity === 'error' ? 'ERROR' : 'WARN'
    console.log(`${icon} [${finding.scope}] ${finding.message}`)
  }

  console.log(`\nErrors: ${errors.length}`)
  console.log(`Warnings: ${warnings.length}`)

  if (errors.length > 0) {
    process.exit(1)
  }
}

main()
