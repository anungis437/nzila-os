#!/usr/bin/env npx tsx

import { findRepoRoot, validatePortfolioGovernance } from './lib/portfolio-governance'

function main(): void {
  const result = validatePortfolioGovernance(findRepoRoot())

  if (result.errors.length > 0) {
    console.log('\n[validate-portfolio] FAIL')
    for (const error of result.errors) console.log(` - ${error}`)
    for (const warning of result.warnings) console.log(` ! ${warning}`)
    process.exit(1)
  }

  console.log('\n[validate-portfolio] PASS')
  console.log('Canonical portfolio artifacts are fresh and free of drift.')
  for (const warning of result.warnings) console.log(` ! ${warning}`)
}

main()
