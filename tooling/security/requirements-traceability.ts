/**
 * Nzila OS — Requirements Traceability Matrix Generator
 * iSSDLC W2-1: Links policy YAML → contract test IDs → evidence artifacts
 *
 * Usage: pnpm tsx tooling/security/requirements-traceability.ts
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { join, relative, basename } from 'node:path'
import { parse as parseYaml } from 'yaml'

const ROOT = join(__dirname, '..', '..')

// ── Types ────────────────────────────────────────────────────────────────────

interface TraceabilityEntry {
  requirementId: string
  source: string
  sourcePath: string
  testIds: string[]
  testPaths: string[]
  evidenceArtifacts: string[]
  status: 'covered' | 'partial' | 'untested'
}

// ── Collect policies ─────────────────────────────────────────────────────────

function collectPolicies(): Array<{ id: string; name: string; path: string }> {
  const policiesDir = join(ROOT, 'ops', 'policies')
  const policies: Array<{ id: string; name: string; path: string }> = []

  if (!existsSync(policiesDir)) return policies

  for (const file of readdirSync(policiesDir)) {
    if (!file.endsWith('.yml') && !file.endsWith('.yaml')) continue
    const filePath = join(policiesDir, file)
    const content = readFileSync(filePath, 'utf-8')
    const doc = parseYaml(content) as Record<string, unknown>
    const policyId = (doc.id as string) ?? basename(file, '.yml').toUpperCase()
    policies.push({
      id: policyId,
      name: (doc.name as string) ?? file,
      path: relative(ROOT, filePath),
    })
  }

  return policies
}

// ── Collect contract tests ───────────────────────────────────────────────────

function collectContractTests(): Array<{ id: string; path: string; describes: string[] }> {
  const testsDir = join(ROOT, 'tooling', 'contract-tests')
  const tests: Array<{ id: string; path: string; describes: string[] }> = []

  if (!existsSync(testsDir)) return tests

  for (const file of readdirSync(testsDir)) {
    if (!file.endsWith('.test.ts')) continue
    const filePath = join(testsDir, file)
    const content = readFileSync(filePath, 'utf-8')
    const id = basename(file, '.test.ts').toUpperCase()
    const describes = Array.from(content.matchAll(/describe\(['"`]([^'"`]+)/g)).map(m => m[1])
    tests.push({ id, path: relative(ROOT, filePath), describes })
  }

  return tests
}

// ── Collect evidence artifacts ───────────────────────────────────────────────

function collectEvidencePaths(): string[] {
  const paths: string[] = []
  const evidenceDirs = [
    join(ROOT, 'ops', 'compliance'),
    join(ROOT, 'ops', 'security'),
    join(ROOT, 'proof-artifacts'),
  ]
  for (const dir of evidenceDirs) {
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir)) {
      paths.push(relative(ROOT, join(dir, file)))
    }
  }
  return paths
}

// ── Map policies to tests ────────────────────────────────────────────────────

function buildTraceabilityMatrix(): TraceabilityEntry[] {
  const policies = collectPolicies()
  const tests = collectContractTests()
  const evidence = collectEvidencePaths()

  const matrix: TraceabilityEntry[] = []

  for (const policy of policies) {
    const policyNameLower = policy.name.toLowerCase()
    const matchingTests = tests.filter(t =>
      t.describes.some(d => d.toLowerCase().includes(policyNameLower.split(' ')[0]))
    )
    const matchingEvidence = evidence.filter(e =>
      e.toLowerCase().includes(policy.id.toLowerCase().replace(/-/g, ''))
    )

    matrix.push({
      requirementId: policy.id,
      source: policy.name,
      sourcePath: policy.path,
      testIds: matchingTests.map(t => t.id),
      testPaths: matchingTests.map(t => t.path),
      evidenceArtifacts: matchingEvidence,
      status: matchingTests.length > 0 ? 'covered' : (matchingEvidence.length > 0 ? 'partial' : 'untested'),
    })
  }

  return matrix
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function main() {
  const matrix = buildTraceabilityMatrix()

  const covered = matrix.filter(e => e.status === 'covered').length
  const partial = matrix.filter(e => e.status === 'partial').length
  const untested = matrix.filter(e => e.status === 'untested').length

  console.log('\n=== Nzila OS — Requirements Traceability Matrix ===\n')
  console.log(`Total requirements: ${matrix.length}`)
  console.log(`  Covered:  ${covered}`)
  console.log(`  Partial:  ${partial}`)
  console.log(`  Untested: ${untested}`)
  console.log('')

  for (const entry of matrix) {
    const icon = entry.status === 'covered' ? '✅' : entry.status === 'partial' ? '🔶' : '❌'
    console.log(`${icon} ${entry.requirementId} — ${entry.source}`)
    console.log(`   Source: ${entry.sourcePath}`)
    if (entry.testPaths.length > 0) {
      console.log(`   Tests:  ${entry.testPaths.join(', ')}`)
    }
    if (entry.evidenceArtifacts.length > 0) {
      console.log(`   Evidence: ${entry.evidenceArtifacts.join(', ')}`)
    }
    console.log('')
  }

  // Write JSON output
  const outputPath = join(ROOT, 'ops', 'compliance', 'requirements-traceability-matrix.json')
  writeFileSync(outputPath, JSON.stringify({ generated: new Date().toISOString(), matrix }, null, 2))
  console.log(`Written to: ${relative(ROOT, outputPath)}`)
}

main()
