#!/usr/bin/env npx tsx

import { findRepoRoot, loadPortfolioContext, validateCatalogData } from './lib/portfolio-governance'

function main(): void {
  const root = findRepoRoot()
  const context = loadPortfolioContext(root)
  const validation = validateCatalogData(context.catalog, context.appIds)

  if (validation.errors.length > 0) {
    console.log('\n[validate:product-catalog] FAIL')
    for (const error of validation.errors) console.log(` - ${error}`)
    for (const warning of validation.warnings) console.log(` ! ${warning}`)
    process.exit(1)
  }

  console.log('\n[validate:product-catalog] PASS')
  console.log(`Validated ${context.catalog.products.length} canonical products against apps/ coverage and tier logic.`)
  for (const warning of validation.warnings) console.log(` ! ${warning}`)
}

main()
