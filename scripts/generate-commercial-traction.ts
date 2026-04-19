#!/usr/bin/env npx tsx

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { buildTractionOutputs, type ForecastBucket, type TractionOutputs } from './lib/traction-engine'
import { findRepoRoot } from './lib/portfolio-governance'

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString()}`
}

function writeFile(root: string, relativePath: string, content: string): void {
  if (!relativePath.startsWith('reports/') || relativePath.includes('..')) {
    throw new Error(`Unsafe report path: ${relativePath}`)
  }
  const absolutePath = join(root, relativePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}

function forecastRow(bucket: ForecastBucket): string {
  return `| ${bucket.horizon_days} days | ${formatMoney(bucket.expected_closes)} | ${formatMoney(bucket.weighted_pipeline)} | ${formatMoney(bucket.likely_bookings)} |`
}

function buildRevenueForecastReport(outputs: TractionOutputs): string {
  return [
    '# Revenue Forecast',
    '',
    `As of ${outputs.asOfDate}. Values are weighted by stage, probability, and source confidence.`,
    '',
    '| Horizon | Expected Closes | Weighted Pipeline | Likely Bookings |',
    '| --- | ---: | ---: | ---: |',
    ...outputs.forecast.map(forecastRow),
    '',
    '## By Product (90 Days)',
    '',
    '| Product | Weighted | Likely |',
    '| --- | ---: | ---: |',
    ...((outputs.forecast.find((bucket) => bucket.horizon_days === 90)?.by_product ?? []).map((row) => `| ${row.product} | ${formatMoney(row.weighted)} | ${formatMoney(row.likely)} |`)),
    '',
    '## Top 5 Deals To Win Now',
    '',
    '| Account | Product | Stage | Value | Probability | Owner | Next Step |',
    '| --- | --- | --- | ---: | ---: | --- | --- |',
    ...outputs.topDealsToWinNow.map((opportunity) => `| ${opportunity.account} | ${opportunity.product} | ${opportunity.stage} | ${formatMoney(opportunity.value)} | ${(opportunity.probability * 100).toFixed(0)}% | ${opportunity.owner} | ${opportunity.next_step} |`),
    '',
  ].join('\n') + '\n'
}

function buildPilotConversionReport(outputs: TractionOutputs): string {
  return [
    '# Pilot Conversion',
    '',
    '| Account | Product | Conversion Score | Classification | Engagement | Paid Likelihood | Procurement Path |',
    '| --- | --- | ---: | --- | ---: | ---: | --- |',
    ...outputs.pilots.map((pilot) => `| ${pilot.account} | ${pilot.product} | ${pilot.conversion_score} | ${pilot.classification} | ${(pilot.weekly_engagement * 100).toFixed(0)}% | ${pilot.paid_likelihood_pct}% | ${pilot.procurement_path_defined ? 'Yes' : 'No'} |`),
    '',
  ].join('\n') + '\n'
}

function buildFounderRoiReport(outputs: TractionOutputs): string {
  return [
    '# Founder Commercial ROI',
    '',
    '| Lane | Activity | Hours | Pipeline Created | Revenue Closed | ROI |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...outputs.founderActivities.map((activity) => `| ${activity.lane} | ${activity.activity} | ${activity.hours} | ${formatMoney(activity.pipeline_created)} | ${formatMoney(activity.revenue_closed)} | ${formatMoney(activity.roi)} |`),
    '',
    `Highest ROI lane: ${outputs.founderActivities[0]?.lane ?? 'none'}`,
    '',
  ].join('\n') + '\n'
}

function buildMarketPullReport(outputs: TractionOutputs): string {
  return [
    '# Market Pull',
    '',
    '| Product | Pull Score | Classification | Drivers |',
    '| --- | ---: | --- | --- |',
    ...outputs.marketPull.map((entry) => `| ${entry.product} | ${entry.pull_score} | ${entry.classification} | ${entry.drivers.join(', ')} |`),
    '',
    `Best product pull signal: ${outputs.marketPull[0]?.product ?? 'none'} (${outputs.marketPull[0]?.classification ?? 'n/a'})`,
    '',
  ].join('\n') + '\n'
}

function buildRetentionRiskReport(outputs: TractionOutputs): string {
  return [
    '# Retention Risk',
    '',
    '| Account | Product | ARR | Risk Score | Risk Level | Save Plan |',
    '| --- | --- | ---: | ---: | --- | --- |',
    ...outputs.retentionRisk.map((account) => `| ${account.account} | ${account.product} | ${formatMoney(account.arr)} | ${account.risk_score} | ${account.risk_level} | ${account.saves.join(' ')} |`),
    '',
  ].join('\n') + '\n'
}

function buildAlertsReport(outputs: TractionOutputs): string {
  return [
    '# Commercial Alerts',
    '',
    ...(outputs.alerts.length === 0
      ? ['- No commercial alerts triggered.']
      : outputs.alerts.map((alert) => `- [${alert.severity.toUpperCase()}] ${alert.message}`)),
    '',
  ].join('\n') + '\n'
}

function buildBoardPack(outputs: TractionOutputs): string {
  const f30 = outputs.forecast.find((bucket) => bucket.horizon_days === 30)
  const f60 = outputs.forecast.find((bucket) => bucket.horizon_days === 60)
  const f90 = outputs.forecast.find((bucket) => bucket.horizon_days === 90)
  const highestRoiLane = outputs.founderActivities[0]?.lane ?? 'none'
  const strongestPull = outputs.marketPull[0]

  return [
    '# Commercial Board Pack',
    '',
    `As of ${outputs.asOfDate}. This report separates evidence (pipeline, pilot and retention signals) from assumptions and manual estimates.`,
    '',
    '## Executive Answers',
    '',
    `- Revenue Expected Next 30 / 60 / 90 Days: ${formatMoney(f30?.expected_closes ?? 0)} / ${formatMoney(f60?.expected_closes ?? 0)} / ${formatMoney(f90?.expected_closes ?? 0)}.`,
    `- Top 5 Deals To Win Now: ${outputs.topDealsToWinNow.map((deal) => `${deal.account} (${deal.product})`).join('; ') || 'none'}.`,
    `- Best Product Pull Signal: ${strongestPull ? `${strongestPull.product} (${strongestPull.classification}, score ${strongestPull.pull_score})` : 'none'}.`,
    `- Founder Time Highest ROI Lane: ${highestRoiLane}.`,
    `- Weakest Funnel Leak: ${outputs.weakestFunnelLeak}.`,
    `- Which Product Deserves More Sales Attention Immediately: ${outputs.productSalesFocusNow}.`,
    '',
    '## Connector Status',
    '',
    '| Connector | Enabled | Status | Note |',
    '| --- | --- | --- | --- |',
    ...outputs.connectorStatus.map((status) => `| ${status.connector} | ${status.enabled ? 'Yes' : 'No'} | ${status.status} | ${status.note} |`),
    '',
  ].join('\n') + '\n'
}

function main(): void {
  const root = findRepoRoot()
  const outputs = buildTractionOutputs()

  writeFile(root, 'reports/revenue-forecast.md', buildRevenueForecastReport(outputs))
  writeFile(root, 'reports/pilot-conversion.md', buildPilotConversionReport(outputs))
  writeFile(root, 'reports/founder-commercial-roi.md', buildFounderRoiReport(outputs))
  writeFile(root, 'reports/market-pull.md', buildMarketPullReport(outputs))
  writeFile(root, 'reports/retention-risk.md', buildRetentionRiskReport(outputs))
  writeFile(root, 'reports/commercial-alerts.md', buildAlertsReport(outputs))
  writeFile(root, 'reports/commercial-board-pack.md', buildBoardPack(outputs))

  const f30 = outputs.forecast.find((bucket) => bucket.horizon_days === 30)
  const f60 = outputs.forecast.find((bucket) => bucket.horizon_days === 60)
  const f90 = outputs.forecast.find((bucket) => bucket.horizon_days === 90)

  console.log('Commercial Traction reports generated.')
  console.log(`Expected closes (30/60/90): ${formatMoney(f30?.expected_closes ?? 0)} / ${formatMoney(f60?.expected_closes ?? 0)} / ${formatMoney(f90?.expected_closes ?? 0)}`)
  console.log(`Top deals: ${outputs.topDealsToWinNow.map((deal) => `${deal.account} (${deal.product})`).join('; ') || 'none'}`)
  console.log(`Best pull: ${outputs.marketPull[0]?.product ?? 'none'}`)
  console.log(`Highest ROI lane: ${outputs.founderActivities[0]?.lane ?? 'none'}`)
  console.log(`Weakest leak: ${outputs.weakestFunnelLeak}`)
  console.log(`Sales attention now: ${outputs.productSalesFocusNow}`)
}

main()
