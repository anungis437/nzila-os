#!/usr/bin/env tsx
/**
 * UnionEyes — Evidence Artifact Collector
 *
 * Scans the CI workspace for security scan outputs, test reports, and SBOM
 * files, then writes a manifest (artifacts.json) for the seal step.
 *
 * Usage:
 *   pnpm tsx scripts/evidence/collect.mjs [--output <dir>]
 *
 * Produces:
 *   <output>/artifacts.json  — ordered list of artifact descriptors
 */
// @ts-check
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

// ── CLI args ─────────────────────────────────────────────────────────────────
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    output: { type: 'string', default: 'evidence-output' },
    'base-path': { type: 'string', default: process.cwd() },
  },
  strict: false,
})

const OUTPUT_DIR = resolve(typeof values.output === 'string' ? values.output : 'evidence-output')
const BASE_PATH = resolve(typeof values['base-path'] === 'string' ? values['base-path'] : process.cwd())

// ── Known artifact locations (produced by CI steps) ──────────────────────────
const ARTIFACT_CANDIDATES = [
  { path: 'audit-report.json', category: 'dependency-audit', name: 'pnpm-audit' },
  { path: 'audit-report-high.json', category: 'dependency-audit', name: 'pnpm-audit-high' },
  // cSpell:ignore cyclonedx sarif
  { path: 'sbom.json', category: 'sbom', name: 'cyclonedx-sbom' },
  { path: 'trivy-fs.sarif', category: 'trivy-scan', name: 'trivy-filesystem' },
  { path: 'trivy-results.sarif', category: 'trivy-scan', name: 'trivy-container' },
  // UE-specific test reports
  { path: 'test-results.json', category: 'unit-tests', name: 'ue-unit-tests' },
  { path: 'coverage/lcov.info', category: 'test-coverage', name: 'ue-coverage' },
]

// ── Hash a file ────────────────────────────────────────────────────────────────
function sha256File(/** @type {string} */ filePath) {
  const content = readFileSync(filePath)
  return createHash('sha256').update(content).digest('hex')
}

// ── Collect ────────────────────────────────────────────────────────────────────
function collect() {
  mkdirSync(OUTPUT_DIR, { recursive: true })

  const collected = []
  const missing = []

  for (const candidate of ARTIFACT_CANDIDATES) {
    const fullPath = join(BASE_PATH, candidate.path)
    if (!existsSync(fullPath)) {
      missing.push(candidate.name)
      continue
    }

    const stat = statSync(fullPath)
    const sha256 = sha256File(fullPath)

    collected.push({
      name: candidate.name,
      category: candidate.category,
      sha256,
      path: candidate.path,
      sizeBytes: stat.size,
      collectedAt: new Date().toISOString(),
    })

    console.log(`  ✅ Collected: ${candidate.name} (${sha256.slice(0, 16)}...)`)
  }

  if (missing.length > 0) {
    console.log(`  ⚠️  Missing (optional): ${missing.join(', ')}`)
  }

  const manifest = {
    version: '1',
    collectedAt: new Date().toISOString(),
    source: 'union-eyes',
    runId: process.env.GITHUB_RUN_ID ?? 'local',
    commitSha: process.env.GITHUB_SHA ?? 'unknown',
    artifacts: collected,
  }

  const outPath = join(OUTPUT_DIR, 'artifacts.json')
  writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf-8')
  console.log(`\n📦 Artifact manifest written: ${outPath}`)
  console.log(`   Collected ${collected.length} artifact(s).`)

  return manifest
}

collect()
