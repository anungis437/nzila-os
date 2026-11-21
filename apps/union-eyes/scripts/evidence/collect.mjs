#!/usr/bin/env tsx
/**
 * UnionEyes — Evidence Artifact Collector
 *
 * Scans the CI workspace for security scan outputs, test reports, and SBOM
 * files, then writes a manifest (artifacts.json) for the seal step.
 *
 * Usage:
 *   pnpm tsx scripts/evidence/collect.mjs [--output <dir>] [--include-file <repo-relative-file>]...
 *
 * Produces:
 *   <output>/artifacts.json  — ordered list of artifact descriptors
 */
// @ts-check
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync, statSync, mkdirSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep, win32 } from 'node:path'
import { parseArgs } from 'node:util'

// ── CLI args ─────────────────────────────────────────────────────────────────
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    output: { type: 'string', default: 'evidence-output' },
    'base-path': { type: 'string', default: process.cwd() },
    'include-file': { type: 'string', multiple: true, default: [] },
  },
  strict: false,
})

const OUTPUT_DIR = resolve(typeof values.output === 'string' ? values.output : 'evidence-output')
const BASE_PATH = realpathSync(resolve(typeof values['base-path'] === 'string' ? values['base-path'] : process.cwd()))
const INCLUDED_FILES = values['include-file'] ?? []

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
// ── Collect ────────────────────────────────────────────────────────────────────
function collect() {
  const collected = []
  const missing = []
  const names = new Map()
  const files = new Set()
  const candidates = [
    ...ARTIFACT_CANDIDATES.map((candidate) => ({ ...candidate, required: false })),
    ...INCLUDED_FILES.map((file) => ({ path: file, name: file, category: 'qualification-evidence', required: true })),
  ]

  for (const candidate of candidates) {
    if (typeof candidate.path !== 'string' || !candidate.path || candidate.path.includes('\0') ||
        isAbsolute(candidate.path) || win32.isAbsolute(candidate.path) ||
        candidate.path.split(/[\\/]/).includes('..')) {
      throw new Error('Evidence include must name a confined relative file')
    }
    const fullPath = resolve(BASE_PATH, candidate.path)
    if (!existsSync(fullPath)) {
      if (candidate.required) throw new Error(`Required evidence file is missing: ${candidate.path}`)
      missing.push(candidate.name)
      continue
    }

    const realPath = realpathSync(fullPath)
    const realRelative = relative(BASE_PATH, realPath)
    if (realRelative === '..' || realRelative.startsWith(`..${sep}`) || isAbsolute(realRelative)) {
      throw new Error('Evidence file resolves outside the artifact base path')
    }
    if (!statSync(realPath).isFile()) throw new Error(`Evidence file is not a regular file: ${candidate.path}`)
    if (['artifacts.json', 'pack.json', 'seal.json'].some((name) => {
      const outputPath = resolve(OUTPUT_DIR, name)
      return realPath === outputPath || (existsSync(outputPath) && realPath === realpathSync(outputPath))
    })) {
      throw new Error('Evidence collection cannot include its own generated outputs')
    }
    const bytes = readFileSync(realPath)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const artifactPath = relative(BASE_PATH, fullPath).split(sep).join('/')
    const name = candidate.required ? artifactPath : candidate.name
    const prior = names.get(name)
    if (prior && (prior.path !== artifactPath || prior.sha256 !== sha256 || prior.sizeBytes !== bytes.length)) {
      throw new Error(`Conflicting evidence artifact name: ${name}`)
    }
    // Repeating the same explicit file is idempotent; every recorded name still
    // identifies exactly one path and byte sequence.
    if (prior || files.has(realPath)) continue

    const artifact = {
      name,
      category: candidate.category,
      sha256,
      path: artifactPath,
      sizeBytes: bytes.length,
      collectedAt: new Date().toISOString(),
    }
    collected.push(artifact)
    names.set(name, artifact)
    files.add(realPath)

    console.log(`  ✅ Collected: ${name} (${sha256.slice(0, 16)}...)`)
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
  // Validate the entire explicit selection before replacing an earlier manifest.
  mkdirSync(OUTPUT_DIR, { recursive: true })
  writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf-8')
  console.log(`\n📦 Artifact manifest written: ${outPath}`)
  console.log(`   Collected ${collected.length} artifact(s).`)

  return manifest
}

collect()
