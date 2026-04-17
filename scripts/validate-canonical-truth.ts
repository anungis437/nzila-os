#!/usr/bin/env npx tsx

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

function findRepoRoot(): string {
  let dir = process.cwd()
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = dirname(dir)
  }
  throw new Error('Could not find repo root')
}

function mustExist(pathname: string, issues: string[]) {
  if (!existsSync(pathname)) issues.push(`Missing required canonical artifact: ${pathname}`)
}

function hasText(pathname: string, text: string): boolean {
  if (!existsSync(pathname)) return false
  return readFileSync(pathname, 'utf8').includes(text)
}

function main() {
  const root = findRepoRoot()
  const issues: string[] = []

  const required = [
    'reports/final-repo-scorecard.md',
    'reports/final-focus-matrix.md',
    'reports/final-10-blocker-audit.md',
    'reports/console-value-proof.md',
    'docs/proof-center/portfolio-proof-index.md',
    'docs/proof-center/flow-proof.md',
    'docs/proof-center/union-eyes-proof.md',
    'docs/buyers/flow-buyer-pack.md',
    'docs/buyers/union-eyes-buyer-pack.md',
    'docs/investor/final-investor-onepager.md',
  ]

  for (const rel of required) {
    mustExist(join(root, rel), issues)
  }

  const deprecatedReports = [
    'reports/scorecard.md',
    'reports/scorecard.json',
    'reports/portfolio-maturity.md',
    'reports/portfolio-maturity.json',
    'reports/platform-grade-adjusted.md',
    'reports/platform-scorecard-adjusted.md',
  ]

  for (const rel of deprecatedReports) {
    const fullPath = join(root, rel)
    if (existsSync(fullPath)) {
      issues.push(`Legacy report should be archived to prevent score drift: ${rel}`)
    }
  }

  const productCatalogPath = join(root, 'governance/portfolio/product-catalog.json')
  if (!hasText(productCatalogPath, '"canonical_score_source"')) {
    issues.push('product-catalog.json missing canonical_score_source field')
  }

  const readmePath = join(root, 'README.md')
  if (!hasText(readmePath, 'SELL NOW')) {
    issues.push('README.md must include canonical SELL NOW / USE INTERNALLY / INCUBATE segmentation')
  }

  const docsReadmePath = join(root, 'docs/README.md')
  if (!hasText(docsReadmePath, 'Proof Center')) {
    issues.push('docs/README.md must link to Proof Center')
  }

  const portfolioMatrixPath = join(root, 'docs/platform/portfolio-matrix.md')
  if (!hasText(portfolioMatrixPath, 'Proof Status')) {
    issues.push('docs/platform/portfolio-matrix.md must include Proof Status from canonical truth')
  }

  if (issues.length > 0) {
    console.log('\n[validate:canonical-truth] FAIL')
    for (const issue of issues) {
      console.log(` - ${issue}`)
    }
    process.exit(1)
  }

  console.log('\n[validate:canonical-truth] PASS')
  console.log('Canonical truth artifacts, links, and anti-drift constraints are valid.')
}

main()
