/**
 * Nzila OS — Compliance Scorecard Generator
 * iSSDLC W3-3: Automated compliance scorecard from control test results
 *
 * Reads control test results, SBOM, audit report, and evidence artifacts
 * to generate a compliance scorecard.
 *
 * Usage: pnpm tsx tooling/security/compliance-scorecard.ts
 */
import { readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..', '..')

// ── Types ────────────────────────────────────────────────────────────────────

interface ControlTestResult {
  controlId: string
  name: string
  status: 'pass' | 'fail' | 'skip' | 'unknown'
  lastRun: string | null
  evidencePath: string | null
}

interface ScorecardEntry {
  domain: string
  control: string
  status: 'compliant' | 'non_compliant' | 'partial' | 'not_assessed'
  evidence: string[]
  notes: string
}

interface Scorecard {
  generatedAt: string
  overallScore: number
  totalControls: number
  compliant: number
  nonCompliant: number
  partial: number
  notAssessed: number
  entries: ScorecardEntry[]
}

// ── SOC 2 Control Families ───────────────────────────────────────────────────

const CONTROL_FAMILIES = [
  { domain: 'Access Control', controls: ['CT-01', 'CT-02'] },
  { domain: 'Change Management', controls: ['CT-03', 'CT-04'] },
  { domain: 'System Operations', controls: ['CT-05', 'CT-06'] },
  { domain: 'Risk Assessment', controls: ['CT-07'] },
  { domain: 'Monitoring', controls: ['CT-08', 'CT-09'] },
  { domain: 'Vendor Management', controls: ['CT-10'] },
]

// ── Evidence collection ──────────────────────────────────────────────────────

function findEvidence(controlId: string): string[] {
  const evidenceDirs = [
    join(ROOT, 'ops', 'compliance'),
    join(ROOT, 'proof-artifacts'),
    join(ROOT, 'ops', 'security'),
  ]
  const evidence: string[] = []

  for (const dir of evidenceDirs) {
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir)) {
      if (file.toLowerCase().includes(controlId.toLowerCase())) {
        evidence.push(relative(ROOT, join(dir, file)))
      }
    }
  }

  return evidence
}

function checkControlTestPlan(): Map<string, { status: string; description: string }> {
  const planPath = join(ROOT, 'ops', 'compliance', 'Control-Test-Plan.md')
  const results = new Map<string, { status: string; description: string }>()

  if (!existsSync(planPath)) return results

  const content = readFileSync(planPath, 'utf-8')
  const lines = content.split('\n')

  for (const line of lines) {
    const match = line.match(/\|\s*(CT-\d+)\s*\|([^|]+)\|/)
    if (match) {
      results.set(match[1], {
        status: line.includes('✅') ? 'pass' : (line.includes('❌') ? 'fail' : 'unknown'),
        description: match[2].trim(),
      })
    }
  }

  return results
}

// ── Scorecard generation ─────────────────────────────────────────────────────

function generateScorecard(): Scorecard {
  const controlTests = checkControlTestPlan()
  const entries: ScorecardEntry[] = []

  for (const family of CONTROL_FAMILIES) {
    for (const controlId of family.controls) {
      const testResult = controlTests.get(controlId)
      const evidence = findEvidence(controlId)

      let status: ScorecardEntry['status'] = 'not_assessed'
      if (testResult) {
        status = testResult.status === 'pass' ? 'compliant' : (testResult.status === 'fail' ? 'non_compliant' : 'partial')
      } else if (evidence.length > 0) {
        status = 'partial'
      }

      entries.push({
        domain: family.domain,
        control: controlId,
        status,
        evidence,
        notes: testResult?.description ?? '',
      })
    }
  }

  const compliant = entries.filter(e => e.status === 'compliant').length
  const nonCompliant = entries.filter(e => e.status === 'non_compliant').length
  const partial = entries.filter(e => e.status === 'partial').length
  const notAssessed = entries.filter(e => e.status === 'not_assessed').length
  const total = entries.length

  return {
    generatedAt: new Date().toISOString(),
    overallScore: Math.round((compliant / total) * 100),
    totalControls: total,
    compliant,
    nonCompliant,
    partial,
    notAssessed,
    entries,
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function main() {
  const scorecard = generateScorecard()

  console.log('\n=== Nzila OS — Compliance Scorecard ===\n')
  console.log(`Generated: ${scorecard.generatedAt}`)
  console.log(`Overall Score: ${scorecard.overallScore}%`)
  console.log(`Controls: ${scorecard.totalControls} total`)
  console.log(`  ✅ Compliant:    ${scorecard.compliant}`)
  console.log(`  ❌ Non-compliant: ${scorecard.nonCompliant}`)
  console.log(`  🔶 Partial:      ${scorecard.partial}`)
  console.log(`  ⬜ Not assessed: ${scorecard.notAssessed}`)
  console.log('')

  for (const entry of scorecard.entries) {
    const icon = { compliant: '✅', non_compliant: '❌', partial: '🔶', not_assessed: '⬜' }[entry.status]
    console.log(`${icon} ${entry.control} — ${entry.domain}`)
    if (entry.evidence.length > 0) {
      console.log(`   Evidence: ${entry.evidence.join(', ')}`)
    }
    if (entry.notes) {
      console.log(`   Notes: ${entry.notes}`)
    }
  }

  // Write JSON
  const outputPath = join(ROOT, 'ops', 'compliance', 'compliance-scorecard.json')
  writeFileSync(outputPath, JSON.stringify(scorecard, null, 2))
  console.log(`\nWritten to: ${relative(ROOT, outputPath)}`)
}

main()
