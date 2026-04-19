#!/usr/bin/env npx tsx

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  PORTFOLIO_CATALOG_PATH,
  PORTFOLIO_MATRIX_PATH,
  PORTFOLIO_STATUS_JSON_PATH,
  PORTFOLIO_STATUS_MD_PATH,
  TRUTH_MANIFEST_PATH,
  findRepoRoot,
  validatePortfolioGovernance,
} from './lib/portfolio-governance'

function main(): void {
  const root = findRepoRoot()
  const validation = validatePortfolioGovernance(root)
  const findings = [...validation.errors]

  if (!existsSync(join(root, TRUTH_MANIFEST_PATH))) {
    findings.push(`Missing ${TRUTH_MANIFEST_PATH}`)
  }

  const readme = readFileSync(join(root, 'README.md'), 'utf8')
  if (readme.includes('## Products at a Glance')) {
    findings.push('README.md must not carry an independent Products at a Glance truth table')
  }

  for (const relativePath of [PORTFOLIO_STATUS_JSON_PATH, PORTFOLIO_STATUS_MD_PATH, PORTFOLIO_MATRIX_PATH]) {
    const absolutePath = join(root, relativePath)
    if (!existsSync(absolutePath)) {
      findings.push(`Missing generated portfolio surface: ${relativePath}`)
      continue
    }

    const content = readFileSync(absolutePath, 'utf8')
    if (!content.includes(PORTFOLIO_CATALOG_PATH)) {
      findings.push(`${relativePath} must reference ${PORTFOLIO_CATALOG_PATH}`)
    }
  }

  if (findings.length > 0) {
    console.log('\n[validate:truth-authority] FAIL')
    for (const finding of findings) console.log(` - ${finding}`)
    for (const warning of validation.warnings) console.log(` ! ${warning}`)
    process.exit(1)
  }

  console.log('\n[validate:truth-authority] PASS')
  console.log('Portfolio truth now flows from one editable source into all published surfaces.')
  for (const warning of validation.warnings) console.log(` ! ${warning}`)
}

main()