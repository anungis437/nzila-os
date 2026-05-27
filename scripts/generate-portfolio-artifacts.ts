#!/usr/bin/env npx tsx

import {
  buildGeneratedArtifacts,
  detectArtifactDrift,
  findRepoRoot,
  loadPortfolioContext,
  validateCatalogData,
  writeArtifacts,
} from './lib/portfolio-governance'

function main(): void {
  const checkOnly = process.argv.includes('--check')
  const root = findRepoRoot()
  const context = loadPortfolioContext(root)
  const validation = validateCatalogData(context.catalog, context.appIds)

  if (validation.errors.length > 0) {
    console.log('\n[generate-portfolio-artifacts] FAIL')
    for (const error of validation.errors) console.log(` - ${error}`)
    for (const warning of validation.warnings) console.log(` ! ${warning}`)
    process.exit(1)
  }

  const artifacts = buildGeneratedArtifacts(context)
  const drift = detectArtifactDrift(root, artifacts, { ignoreDailyStamps: checkOnly })

  if (checkOnly) {
    if (drift.length > 0) {
      console.log('\n[generate-portfolio-artifacts] FAIL')
      for (const item of drift) console.log(` - stale artifact: ${item}`)
      for (const warning of validation.warnings) console.log(` ! ${warning}`)
      process.exit(1)
    }

    console.log('\n[generate-portfolio-artifacts] PASS')
    console.log(`Validated ${artifacts.length} generated portfolio artifacts.`)
    for (const warning of validation.warnings) console.log(` ! ${warning}`)
    return
  }

  writeArtifacts(root, artifacts)
  console.log('\n[generate-portfolio-artifacts] PASS')
  console.log(`Wrote ${artifacts.length} generated portfolio artifacts.`)
  for (const warning of validation.warnings) console.log(` ! ${warning}`)
}

main()
