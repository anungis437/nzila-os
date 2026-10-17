#!/usr/bin/env npx tsx

import { findRepoRoot } from './lib/portfolio-governance'
import { formatDoctrineFinding, validateCivicArchiveReview } from './lib/civic-oci-doctrine'

const root = findRepoRoot()
const findings = validateCivicArchiveReview(root)

if (findings.length > 0) {
  console.error('\n[validate-civic-oci-doctrine] FAIL')
  for (const item of findings) console.error(formatDoctrineFinding(item))
  process.exit(1)
}

console.log('\n[validate-civic-oci-doctrine] PASS')
console.log(
  'CIVIC / OCI invariants and terminated archive commitments are intact; no execution admission.',
)
