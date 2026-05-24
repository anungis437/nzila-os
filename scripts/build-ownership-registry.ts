#!/usr/bin/env npx tsx

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

import { findRepoRoot } from './lib/portfolio-governance'

interface AppOwnershipFile {
  version: string
  lastUpdated: string
  roles: string[]
  owners: Record<string, Record<string, string>>
}

interface DeploymentInventory {
  apps: Record<
    string,
    {
      tier: string
      releaseStatus: string
      track?: string
    }
  >
}

interface ServiceTiers {
  apps: Array<{
    id: string
    name: string
    tier: string
    supportModel: string
  }>
}

const REQUIRED_ROLES = [
  'businessOwner',
  'technicalOwner',
  'runtimeOwner',
  'releaseOwner',
  'supportPrimary',
  'escalation',
] as const

function loadJson<T>(root: string, relativePath: string): T {
  const absolutePath = safeJoin(root, relativePath)
  // nosemgrep
  return JSON.parse(readFileSync(absolutePath, 'utf8')) as T
}

function writeText(root: string, relativePath: string, content: string): void {
  const absolutePath = safeJoin(root, relativePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}

function safeJoin(root: string, relativePath: string): string {
  // nosemgrep
  const absolutePath = resolve(root, relativePath)
  const rootPath = resolve(root)
  const rel = relative(rootPath, absolutePath)
  if (rel === '') {
    return absolutePath
  }
  if (rel.startsWith('..') || rel.includes('/..') || rel.includes('\\..')) {
    throw new Error(`Unsafe path outside repo root: ${relativePath}`)
  }
  return absolutePath
}

function main(): void {
  const root = findRepoRoot()
  const ownership = loadJson<AppOwnershipFile>(root, 'governance/release/app-ownership.json')
  const inventory = loadJson<DeploymentInventory>(root, 'governance/release/deployment-inventory.json')
  const serviceTiers = loadJson<ServiceTiers>(root, 'governance/sre/service-tiers.json')

  const seriousApps = [...new Set([...Object.keys(inventory.apps), ...serviceTiers.apps.map((app) => app.id)])].sort()
  const missingApps = seriousApps.filter((app) => !ownership.owners[app])
  const roleCoverageFailures: Array<{ app: string; missingRoles: string[] }> = []

  for (const app of seriousApps) {
    const entry = ownership.owners[app]
    if (!entry) continue
    const missingRoles = REQUIRED_ROLES.filter((role) => !entry[role]?.trim())
    if (missingRoles.length > 0) {
      roleCoverageFailures.push({ app, missingRoles: [...missingRoles] })
    }
  }

  const coveragePct = Number((((seriousApps.length - missingApps.length) / seriousApps.length) * 100).toFixed(1))
  const registry = seriousApps.map((app) => {
    const inventoryEntry = inventory.apps[app]
    const serviceEntry = serviceTiers.apps.find((item) => item.id === app)
    return {
      app,
      name: serviceEntry?.name ?? app,
      tier: inventoryEntry?.tier ?? serviceEntry?.tier ?? 'unknown',
      releaseStatus: inventoryEntry?.releaseStatus ?? 'unknown',
      track: inventoryEntry?.track ?? 'unknown',
      supportModel: serviceEntry?.supportModel ?? 'unknown',
      owners: ownership.owners[app] ?? null,
    }
  })

  const report = {
    generatedAt: new Date().toISOString(),
    source: 'governance/release/app-ownership.json',
    seriousAppCount: seriousApps.length,
    coveragePct,
    missingApps,
    roleCoverageFailures,
    registry,
  }

  writeText(root, 'reports/ownership-registry.json', `${JSON.stringify(report, null, 2)}\n`)

  const markdown = [
    '# Ownership Registry',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Coverage: ${coveragePct}% (${seriousApps.length - missingApps.length}/${seriousApps.length} serious systems owned)`,
    '',
    '## Missing Ownership Coverage',
    '',
    ...(missingApps.length === 0 ? ['- none'] : missingApps.map((app) => `- ${app}`)),
    '',
    '## Missing Role Coverage',
    '',
    ...(roleCoverageFailures.length === 0
      ? ['- none']
      : roleCoverageFailures.map((failure) => `- ${failure.app}: ${failure.missingRoles.join(', ')}`)),
    '',
    '## Registry',
    '',
    '| App | Tier | Release Status | Runtime Owner | Support Owner | Business Owner | Technical Owner |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...registry.map((entry) => `| ${entry.app} | ${entry.tier} | ${entry.releaseStatus} | ${entry.owners?.runtimeOwner ?? 'missing'} | ${entry.owners?.supportPrimary ?? 'missing'} | ${entry.owners?.businessOwner ?? 'missing'} | ${entry.owners?.technicalOwner ?? 'missing'} |`),
    '',
  ].join('\n') + '\n'

  writeText(root, 'docs/ops/ownership-registry.md', markdown)

  if (missingApps.length > 0 || roleCoverageFailures.length > 0) {
    console.error('Ownership registry audit failed.')
    process.exit(1)
  }

  console.log(markdown)
}

main()