#!/usr/bin/env npx tsx

import { buildCapitalOutputs } from './lib/capital-allocation'
import { findRepoRoot } from './lib/portfolio-governance'

function main(): void {
  const root = findRepoRoot()
  const { validation, scores } = buildCapitalOutputs(root)
  const errors = [...validation.errors]
  const warnings = [...validation.warnings]

  for (const score of scores) {
    if (score.product.gross_margin_pct < 0) {
      errors.push(`${score.product.id}: negative margin anomaly`) 
    }

    if (score.product.tier === 1) {
      if (score.recommended_eng_hours <= 0 || score.recommended_founder_hours <= 0) {
        errors.push(`${score.product.id}: tier 1 product has zero resource plan`) 
      }
    }

    if (score.product.status === 'sunset' || score.product.gtm_posture === 'sunset') {
      if (score.recommended_monthly_budget > 0 || score.recommended_eng_hours > 0 || score.recommended_founder_hours > 0) {
        errors.push(`${score.product.id}: sunset product received new allocation`) 
      }
    }
  }

  if (errors.length > 0) {
    console.log('\n[validate:capital-discipline] FAIL')
    for (const error of errors) console.log(` - ${error}`)
    for (const warning of warnings) console.log(` ! ${warning}`)
    process.exit(1)
  }

  console.log('\n[validate:capital-discipline] PASS')
  console.log(`Validated capital discipline across ${scores.length} products.`)
  for (const warning of warnings) console.log(` ! ${warning}`)
}

main()