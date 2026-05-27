#!/usr/bin/env npx tsx

import { buildCapitalOutputs } from './lib/capital-allocation'
import { findRepoRoot } from './lib/portfolio-governance'

function main(): void {
  const root = findRepoRoot()
  const outputs = buildCapitalOutputs(root)
  const { validation, scores } = outputs
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

    if (score.data_confidence_pct <= 0 || score.data_confidence_pct > 100) {
      errors.push(`${score.product.id}: invalid confidence percentage`) 
    }

    if (score.explainability.length < 4) {
      errors.push(`${score.product.id}: explainability output incomplete`) 
    }
  }

  if (outputs.cash_forecast.length !== 3) {
    errors.push('cash forecast must include 30/60/90 day checkpoints')
  }

  if (outputs.override_log.overrides === undefined) {
    errors.push('override log missing overrides array')
  }

  if (outputs.scenario_pack.scenarios.length < 6) {
    errors.push('scenario pack missing required board-grade scenario set')
  }

  if (outputs.alerts.length === 0) {
    warnings.push('no capital alerts triggered; verify trigger thresholds still reflect current operating posture')
  }

  if (errors.length > 0) {
    console.log('\n[validate-capital-discipline] FAIL')
    for (const error of errors) console.log(` - ${error}`)
    for (const warning of warnings) console.log(` ! ${warning}`)
    process.exit(1)
  }

  console.log('\n[validate-capital-discipline] PASS')
  console.log(`Validated capital discipline across ${scores.length} products.`)
  for (const warning of warnings) console.log(` ! ${warning}`)
}

main()