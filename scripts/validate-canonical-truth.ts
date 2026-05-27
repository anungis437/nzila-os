#!/usr/bin/env npx tsx

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  PORTFOLIO_CATALOG_PATH,
  PORTFOLIO_INVESTOR_VIEW_PATH,
  PORTFOLIO_MATRIX_PATH,
  PORTFOLIO_OPS_DASHBOARD_PATH,
  PORTFOLIO_STATUS_JSON_PATH,
  PORTFOLIO_STATUS_MD_PATH,
  TRUTH_MANIFEST_PATH,
  findRepoRoot,
  validatePortfolioGovernance,
} from './lib/portfolio-governance'

function main(): void {
  const root = findRepoRoot()
  const validation = validatePortfolioGovernance(root)
  const issues = [...validation.errors]

  const required = [
    PORTFOLIO_CATALOG_PATH,
    TRUTH_MANIFEST_PATH,
    PORTFOLIO_STATUS_JSON_PATH,
    PORTFOLIO_STATUS_MD_PATH,
    PORTFOLIO_INVESTOR_VIEW_PATH,
    PORTFOLIO_OPS_DASHBOARD_PATH,
    PORTFOLIO_MATRIX_PATH,
    'docs/proof-center/portfolio-proof-index.md',
  ]

  for (const relativePath of required) {
    if (!existsSync(join(root, relativePath))) issues.push(`Missing required canonical artifact: ${relativePath}`)
  }

  const readme = readFileSync(join(root, 'README.md'), 'utf8')
  if (!readme.includes('## Portfolio Governance')) {
    issues.push('README.md must explain portfolio governance')
  }

  if (!readme.includes(PORTFOLIO_CATALOG_PATH) || !readme.includes(PORTFOLIO_STATUS_MD_PATH)) {
    issues.push('README.md must link to the canonical catalog and generated portfolio report')
  }

  if (issues.length > 0) {
    console.log('\n[validate-canonical-truth] FAIL')
    for (const issue of issues) console.log(` - ${issue}`)
    for (const warning of validation.warnings) console.log(` ! ${warning}`)
    process.exit(1)
  }

  console.log('\n[validate-canonical-truth] PASS')
  console.log('Canonical truth is generated from the portfolio catalog and linked from README.')
  for (const warning of validation.warnings) console.log(` ! ${warning}`)
}

main()
