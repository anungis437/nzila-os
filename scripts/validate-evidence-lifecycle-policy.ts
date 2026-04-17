import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const policyPath = join(root, 'docs', 'platform', 'EVIDENCE_LIFECYCLE_POLICY.md')

function fail(msg: string): never {
  console.error(`ERROR: ${msg}`)
  process.exit(1)
}

if (!existsSync(policyPath)) {
  fail('docs/platform/EVIDENCE_LIFECYCLE_POLICY.md is missing')
}

const body = readFileSync(policyPath, 'utf8')

const requiredSnippets = [
  '## Evidence Classes',
  '## Legal Hold',
  '## Chain of Custody Requirements',
  '## Ownership and Review Cadence',
  '## Minimum CI Expectations',
]

const missing = requiredSnippets.filter((snippet) => !body.includes(snippet))
if (missing.length > 0) {
  fail(`Policy missing required sections: ${missing.join(', ')}`)
}

const hasComplianceClass = /\|\s*Compliance\s*\|/i.test(body)
const hasForensicClass = /\|\s*Forensic\s*\|/i.test(body)
const hasProcurementClass = /\|\s*Procurement\s*\|/i.test(body)

if (!hasComplianceClass || !hasForensicClass || !hasProcurementClass) {
  fail('Policy table must include Compliance, Forensic, and Procurement classes')
}

console.log('Evidence lifecycle policy validation passed')
