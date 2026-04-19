#!/usr/bin/env npx tsx

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  buildCapitalOutputs,
  type ProductScore,
} from './lib/capital-allocation'
import { getCapitalSignalPlaceholders } from './lib/capital-signal-adapters'
import { findRepoRoot } from './lib/portfolio-governance'

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString()}`
}

function writeFile(root: string, relativePath: string, content: string): void {
  const absolutePath = join(root, relativePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}

function topByDecision(scores: ProductScore[], decision: ProductScore['decision'], count: number): ProductScore[] {
  return scores.filter((score) => score.decision === decision).slice(0, count)
}

function buildCapitalAllocationReport(scores: ProductScore[]): string {
  const fundCandidates = scores.filter((score) => score.decision === 'FUND NOW' || score.decision === 'BET THE COMPANY')
  const totalFundScore = fundCandidates.reduce((acc, score) => acc + score.composite_allocation_score, 0)
  const immediatePlan = fundCandidates.map((score) => {
    const share = totalFundScore > 0 ? score.composite_allocation_score / totalFundScore : 0
    return {
      name: score.product.name,
      budget: Math.round(100000 * share),
      hours: Math.round(400 * share),
    }
  })

  const lines = [
    '# Capital Allocation Report',
    '',
    'Generated from governance/portfolio/product-catalog.json',
    '',
    '| Product | Burn | Revenue | Margin % | Pipeline | Score | Decision |',
    '| --- | ---: | ---: | ---: | ---: | ---: | --- |',
    ...scores.map((score) => `| ${score.product.name} | ${formatMoney(score.product.monthly_burn)} | ${formatMoney(score.product.monthly_revenue)} | ${score.product.gross_margin_pct} | ${formatMoney(score.product.pipeline_value)} | ${score.composite_allocation_score.toFixed(1)} | ${score.decision} |`),
    '',
    '## Next $100K and 400 Engineering Hours',
    '',
    '| Product | Capital Allocation | Engineering Hours |',
    '| --- | ---: | ---: |',
    ...immediatePlan.map((row) => `| ${row.name} | ${formatMoney(row.budget)} | ${row.hours} |`),
    '',
  ]

  return `${lines.join('\n')}\n`
}

function buildResourceAllocationReport(scores: ProductScore[]): string {
  const lines = [
    '# Resource Allocation',
    '',
    '| Product | Dev Hours | Founder Hours | Budget | Decision |',
    '| --- | ---: | ---: | ---: | --- |',
    ...scores.map((score) => `| ${score.product.name} | ${score.recommended_eng_hours} | ${score.recommended_founder_hours} | ${formatMoney(score.recommended_monthly_budget)} | ${score.decision} |`),
    '',
  ]

  return `${lines.join('\n')}\n`
}

function buildTop3Report(scores: ProductScore[]): string {
  const top = scores.slice(0, 3)
  return [
    '# Top 3 To Fund',
    '',
    ...top.map((score, index) => `${index + 1}. ${score.product.name} — ${score.decision} (score ${score.composite_allocation_score.toFixed(1)})`),
    '',
  ].join('\n') + '\n'
}

function buildKillListReport(scores: ProductScore[]): string {
  const killCandidates = scores
    .filter((score) => score.decision === 'PAUSE' || score.decision === 'SUNSET')
    .sort((left, right) => left.composite_allocation_score - right.composite_allocation_score)
    .slice(0, 8)

  return [
    '# Kill List',
    '',
    '| Product | Score | Decision | Burn | Strategic |',
    '| --- | ---: | --- | ---: | ---: |',
    ...killCandidates.map((score) => `| ${score.product.name} | ${score.composite_allocation_score.toFixed(1)} | ${score.decision} | ${formatMoney(score.product.monthly_burn)} | ${score.strategic_value_score.toFixed(1)} |`),
    '',
  ].join('\n') + '\n'
}

function buildFounderTimeMap(scores: ProductScore[]): string {
  const weekly = scores.map((score) => ({
    name: score.product.name,
    hours: Math.round(score.recommended_founder_hours / 4),
    decision: score.decision,
  }))

  const lines = [
    '# Founder Time Map',
    '',
    '| Product | Weekly Founder Hours | Decision |',
    '| --- | ---: | --- |',
    ...weekly.map((row) => `| ${row.name} | ${row.hours} | ${row.decision} |`),
    '',
  ]

  return `${lines.join('\n')}\n`
}

function buildRunwayReport(scores: ProductScore[], assumptions: {
  current_cash: number
  monthly_overhead: number
  expected_closes_monthly: { conservative: number; base: number; aggressive: number }
  assumptions_note: string
}): string {
  const budget = scores.reduce((acc, score) => acc + score.recommended_monthly_budget, 0)
  const revenue = scores.reduce((acc, score) => acc + score.product.monthly_revenue, 0)

  const calc = (closeValue: number): number => {
    const netBurn = (assumptions.monthly_overhead + budget) - (revenue + closeValue)
    if (netBurn <= 0) return 120
    return assumptions.current_cash / netBurn
  }

  return [
    '# Runway Scenarios',
    '',
    `Assumptions: ${assumptions.assumptions_note}`,
    '',
    `- Scenario A Conservative: ${calc(assumptions.expected_closes_monthly.conservative).toFixed(1)} months`,
    `- Scenario B Base: ${calc(assumptions.expected_closes_monthly.base).toFixed(1)} months`,
    `- Scenario C Aggressive: ${calc(assumptions.expected_closes_monthly.aggressive).toFixed(1)} months`,
    '',
  ].join('\n') + '\n'
}

async function buildSignalReadiness(scores: ProductScore[]): Promise<string> {
  const sampled = scores.slice(0, 3)
  const rows: string[] = []
  for (const score of sampled) {
    const placeholders = await getCapitalSignalPlaceholders(score.product)
    for (const signal of placeholders) {
      rows.push(`| ${score.product.name} | ${signal.note} |`)
    }
  }

  return [
    '# Capital Signal Adapters',
    '',
    'Adapters are placeholders and intentionally marked as non-live until wired to production systems.',
    '',
    '| Product | Adapter Status |',
    '| --- | --- |',
    ...rows,
    '',
  ].join('\n') + '\n'
}

async function main(): Promise<void> {
  const root = findRepoRoot()
  const { catalog, validation, scores } = buildCapitalOutputs(root)

  if (validation.errors.length > 0) {
    console.log('\n[generate:capital-allocation] FAIL')
    for (const error of validation.errors) console.log(` - ${error}`)
    for (const warning of validation.warnings) console.log(` ! ${warning}`)
    process.exit(1)
  }

  writeFile(root, 'reports/capital-allocation.md', buildCapitalAllocationReport(scores))
  writeFile(root, 'reports/resource-allocation.md', buildResourceAllocationReport(scores))
  writeFile(root, 'reports/top-3-to-fund.md', buildTop3Report(scores.filter((score) => score.decision !== 'SUNSET')))
  writeFile(root, 'reports/kill-list.md', buildKillListReport(scores))
  writeFile(root, 'reports/founder-time-map.md', buildFounderTimeMap(scores))
  writeFile(root, 'reports/runway-scenarios.md', buildRunwayReport(scores, catalog.capital_model.scenarios))
  writeFile(root, 'reports/capital-signal-readiness.md', await buildSignalReadiness(scores))

  console.log('\n[generate:capital-allocation] PASS')
  console.log(`Wrote ${7} capital allocation reports.`)
  for (const warning of validation.warnings) console.log(` ! ${warning}`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.log('\n[generate:capital-allocation] FAIL')
  console.log(` - ${message}`)
  process.exit(1)
})