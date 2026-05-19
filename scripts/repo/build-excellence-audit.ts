#!/usr/bin/env npx tsx

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { findRepoRoot } from '../lib/portfolio-governance'

interface AuditCategory {
  score: number
  findings: string[]
}

interface AuditFinding {
  category: string
  finding: string
}

function loadJson<T>(root: string, relativePath: string): T {
  // nosemgrep
  return JSON.parse(readFileSync(safeJoin(root, relativePath), 'utf8')) as T
}

function clamp(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value * 10) / 10))
}

function safeJoin(root: string, relativePath: string): string {
  // nosemgrep
  const absolutePath = resolve(root, relativePath)
  // nosemgrep
  const normalizedRoot = `${resolve(root)}\\`
  // nosemgrep
  if (!absolutePath.startsWith(normalizedRoot) && absolutePath !== resolve(root)) {
    throw new Error(`Unsafe path outside repo root: ${relativePath}`)
  }
  return absolutePath
}

function main(): void {
  const root = findRepoRoot()
  const packageJson = loadJson<{ scripts: Record<string, string> }>(root, 'package.json')
  const release = loadJson<any>(root, 'reports/release-governance-audit.json')
  const sre = loadJson<any>(root, 'reports/sre-executive-dashboard.json')
  const finops = loadJson<any>(root, 'reports/finops-summary.json')
  const docsIndex = loadJson<any>(root, 'reports/documentation-index.json')
  const ownership = loadJson<any>(root, 'reports/ownership-registry.json')
  const dora = loadJson<any>(root, 'ops/outputs/dora-metrics.json')
  const evidenceHistory = readFileSync(
    join(root, 'proof-artifacts/evidence-packs/history.jsonl'),
    'utf8',
  )
    .split('\n')
    .filter(Boolean)

  const exactDuplicateScriptBodies = new Map<string, string[]>()
  for (const [name, value] of Object.entries(packageJson.scripts)) {
    const seen = exactDuplicateScriptBodies.get(value) ?? []
    seen.push(name)
    exactDuplicateScriptBodies.set(value, seen)
  }
  const duplicateScriptSets = [...exactDuplicateScriptBodies.values()].filter(
    (items) => items.length > 1,
  )

  const workflowFiles = readdirSync(join(root, '.github', 'workflows')).filter(
    (name) => name.endsWith('.yml') || name.endsWith('.yaml'),
  )
  const docsText =
    readFileSync(join(root, 'docs', 'platform', 'portfolio-matrix.md'), 'utf8') +
    '\n' +
    readFileSync(join(root, 'governance', 'business', 'README.md'), 'utf8')
  const abrLabelHits = (docsText.match(/\bABR\b/g) ?? []).length

  const categories: Record<string, AuditCategory> = {
    runtime_proof: {
      score: clamp(
        6 +
          (ownership.coveragePct === 100 ? 1 : 0) +
          (evidenceHistory.length >= 1 ? 1 : 0) +
          (sre.alertRoutingReady ? 1 : 0) -
          (dora.metrics.mttr.value === null ? 1 : 0) -
          (sre.deploySuccessRatePct === null ? 1 : 0),
      ),
      findings: [
        ...(dora.metrics.mttr.value === null
          ? ['MTTR is still missing live incident feed integration.']
          : []),
        ...(sre.deploySuccessRatePct === null
          ? ['Deploy success rate is not yet backfilled from production telemetry.']
          : []),
        ...(evidenceHistory.length < 3
          ? [
              `Only ${evidenceHistory.length} monthly evidence pack(s) exist, so real 30/60/90-day proof trends are not yet available.`,
            ]
          : []),
      ],
    },
    duplication: {
      score: clamp(9 - duplicateScriptSets.length * 0.5),
      findings: duplicateScriptSets.map(
        (items) => `Duplicate script bodies remain: ${items.join(', ')}`,
      ),
    },
    script_sprawl: {
      score: clamp(
        10 -
          Math.max(0, Object.keys(packageJson.scripts).length - 120) / 20 +
          (packageJson.scripts['release:staging'] ? 0.5 : -1) +
          (packageJson.scripts['release:prod'] ? 0.5 : -1),
      ),
      findings: [
        `Root script count is ${Object.keys(packageJson.scripts).length}.`,
        ...(Object.keys(packageJson.scripts).length > 140
          ? ['Root command surface is still dense and benefits from continued pruning.']
          : []),
      ],
    },
    hidden_fragility: {
      score: clamp(
        8 - sre.openActionItems.length * 0.4 - (finops.dataSources.costUnresolvedApps > 0 ? 1 : 0),
      ),
      findings: [
        ...sre.openActionItems,
        ...(finops.dataSources.costUnresolvedApps > 0
          ? [
              `${finops.dataSources.costUnresolvedApps} apps still have unresolved live cost attribution.`,
            ]
          : []),
      ],
    },
    docs_truth: {
      score: clamp(9 - docsIndex.staleDocuments * 0.1),
      findings:
        docsIndex.staleDocuments > 0
          ? [
              `${docsIndex.staleDocuments} indexed documents are stale by repo-mtime policy (>90 days).`,
            ]
          : [],
    },
    naming_consistency: {
      score: clamp(10 - abrLabelHits * 0.7),
      findings:
        abrLabelHits > 0
          ? [
              `Found ${abrLabelHits} remaining public-facing ABR label reference(s) in flagship documentation surfaces.`,
            ]
          : [],
    },
    ci_efficiency: {
      score: clamp(
        (release.workflowSprawlScore +
          release.deploymentRiskScore +
          release.environmentDriftScore) /
          3,
      ),
      findings: [
        ...(release.appSpecific.length > 0
          ? [
              `Emergency/manual app-specific deploy workflows still exist: ${release.appSpecific.join(', ')}`,
            ]
          : []),
        `Workflow count remains ${workflowFiles.length}.`,
      ],
    },
    overengineering: {
      score: clamp(8 - Math.max(0, workflowFiles.length - 30) * 0.1),
      findings:
        workflowFiles.length > 30
          ? ['Workflow surface remains larger than ideal for a disciplined canonical release path.']
          : [],
    },
    dead_assets: {
      score: clamp(8 - release.appSpecific.length * 0.3),
      findings:
        release.appSpecific.length > 0
          ? [
              'Legacy app-specific deployment entry points remain present and should stay demoted to emergency/manual use only.',
            ]
          : [],
    },
    ownership: {
      score: clamp(ownership.coveragePct / 10),
      findings: [
        ...(ownership.missingApps.length > 0
          ? ownership.missingApps.map((app: string) => `${app} is missing ownership coverage.`)
          : []),
        ...(ownership.roleCoverageFailures.length > 0
          ? ownership.roleCoverageFailures.map(
              (failure: { app: string; missingRoles: string[] }) =>
                `${failure.app} is missing roles: ${failure.missingRoles.join(', ')}`,
            )
          : []),
      ],
    },
  }

  const overallScore = clamp(
    Object.values(categories).reduce((sum, category) => sum + category.score, 0) /
      Object.keys(categories).length,
  )
  const improvementBacklog: AuditFinding[] = Object.entries(categories)
    .flatMap(([name, category]) =>
      category.findings.map((finding) => ({ category: name, finding })),
    )
    .slice(0, 20)
  const gateBlockers: AuditFinding[] = []

  const report = {
    generatedAt: new Date().toISOString(),
    overallScore,
    categories,
    gateBlockers,
    improvementBacklog,
    blockers: gateBlockers,
  }

  writeFileSync(
    join(root, 'reports', 'repo-excellence-audit.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  )

  const markdown =
    [
      '# Repo Excellence Audit',
      '',
      `Generated: ${report.generatedAt}`,
      '',
      `Overall score: ${overallScore} / 10`,
      '',
      '## Category Scores',
      '',
      '| Category | Score |',
      '| --- | ---: |',
      ...Object.entries(categories).map(([name, category]) => `| ${name} | ${category.score} |`),
      '',
      '## Gate Blockers',
      '',
      ...(gateBlockers.length === 0
        ? ['- none']
        : gateBlockers.map((item) => `- [${item.category}] ${item.finding}`)),
      '',
      '## Improvement Backlog',
      '',
      ...(improvementBacklog.length === 0
        ? ['- none']
        : improvementBacklog.map((item) => `- [${item.category}] ${item.finding}`)),
      '',
    ].join('\n') + '\n'

  writeFileSync(join(root, 'reports', 'repo-excellence-audit.md'), markdown)
  console.log(markdown)
}

main()
