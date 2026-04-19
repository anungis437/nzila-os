#!/usr/bin/env npx tsx

import { buildCapitalOutputs } from './lib/capital-allocation'
import { findRepoRoot } from './lib/portfolio-governance'

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function parseArgNumber(flag: string): number | null {
  const token = process.argv.find((value) => value.startsWith(`${flag}=`))
  if (!token) return null
  const parsed = Number(token.split('=')[1])
  return Number.isNaN(parsed) ? null : parsed
}

function monthsOfRunway(cash: number, netBurn: number): number {
  if (netBurn <= 0) return 120
  return cash / netBurn
}

function main(): void {
  const root = findRepoRoot()
  const { catalog, validation, scores } = buildCapitalOutputs(root)

  if (validation.errors.length > 0) {
    console.log('\n[runway-model] FAIL')
    for (const error of validation.errors) console.log(` - ${error}`)
    process.exit(1)
  }

  const model = catalog.capital_model.scenarios
  const cash = parseArgNumber('--cash') ?? model.current_cash
  const overhead = parseArgNumber('--overhead') ?? model.monthly_overhead

  const totalProductBurn = scores.reduce((acc, score) => acc + score.recommended_monthly_budget, 0)
  const totalMonthlyRevenue = scores.reduce((acc, score) => acc + score.product.monthly_revenue, 0)

  const conservativeNetBurn = (overhead + totalProductBurn) - (totalMonthlyRevenue + model.expected_closes_monthly.conservative)
  const baseNetBurn = (overhead + totalProductBurn) - (totalMonthlyRevenue + model.expected_closes_monthly.base)
  const aggressiveNetBurn = (overhead + totalProductBurn) - (totalMonthlyRevenue + model.expected_closes_monthly.aggressive)

  const conservative = monthsOfRunway(cash, conservativeNetBurn)
  const base = monthsOfRunway(cash, baseNetBurn)
  const aggressive = monthsOfRunway(cash, aggressiveNetBurn)

  console.log('\n[runway-model] PASS')
  console.log(`Assumptions: ${model.assumptions_note}`)
  console.log(`Cash: ${cash.toLocaleString()}`)
  console.log(`Monthly overhead: ${overhead.toLocaleString()}`)
  console.log(`Total product budget: ${round2(totalProductBurn).toLocaleString()}`)
  console.log(`Total monthly revenue: ${round2(totalMonthlyRevenue).toLocaleString()}`)
  console.log('')
  console.log(`Scenario A Conservative: ${round2(conservative)} months runway`) 
  console.log(`Scenario B Base: ${round2(base)} months runway`) 
  console.log(`Scenario C Aggressive: ${round2(aggressive)} months runway`) 
}

main()