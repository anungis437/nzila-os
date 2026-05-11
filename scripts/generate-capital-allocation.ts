#!/usr/bin/env npx tsx

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  buildCapitalOutputs,
  buildHiringRecommendation,
  type CapitalOutputs,
  type ProductScore,
} from './lib/capital-allocation'
import { findRepoRoot } from './lib/portfolio-governance'

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString()}`
}

function writeFile(root: string, relativePath: string, content: string): void {
  const absolutePath = join(root, relativePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, content)
}

function fundCandidates(scores: ProductScore[]): ProductScore[] {
  return scores.filter((score) => score.final_decision === 'FUND NOW' || score.final_decision === 'BET THE COMPANY')
}

function buildCapitalAllocationReport(outputs: CapitalOutputs): string {
  const funded = fundCandidates(outputs.scores)
  const totalFundScore = funded.reduce((acc, score) => acc + score.composite_allocation_score, 0)
  const immediatePlan = funded.map((score) => {
    const share = totalFundScore > 0 ? score.composite_allocation_score / totalFundScore : 0
    return {
      name: score.product.name,
      confidence: `${score.data_confidence_pct.toFixed(1)}%`,
      budget: Math.round(100000 * share),
      hours: Math.round(400 * share),
    }
  })

  return [
    '# Capital Allocation Report',
    '',
    'Generated from governance/portfolio/product-catalog.json plus governance/foundations/capital/* operating inputs.',
    '',
    '| Product | Score | Confidence | Engine | Final | Revenue Source | Pipeline Source |',
    '| --- | ---: | ---: | --- | --- | --- | --- |',
    ...outputs.scores.map((score) => `| ${score.product.name} | ${score.composite_allocation_score.toFixed(1)} | ${score.data_confidence_pct.toFixed(1)}% | ${score.decision} | ${score.final_decision} | ${score.live_signals.metrics.monthly_revenue_actual.source} | ${score.live_signals.metrics.pipeline_actual.source} |`),
    '',
    '## Next $100K and 400 Engineering Hours',
    '',
    '| Product | Confidence | Capital Allocation | Engineering Hours |',
    '| --- | ---: | ---: | ---: |',
    ...immediatePlan.map((row) => `| ${row.name} | ${row.confidence} | ${formatMoney(row.budget)} | ${row.hours} |`),
    '',
    '## Score Explainability',
    '',
    ...outputs.scores.slice(0, 5).flatMap((score) => [
      `### ${score.product.name}`,
      '',
      ...score.explainability.map((line) => `- ${line}`),
      '',
    ]),
  ].join('\n') + '\n'
}

function buildResourceAllocationReport(outputs: CapitalOutputs): string {
  return [
    '# Resource Allocation',
    '',
    '| Product | Dev Hours | Founder Hours | Budget | Final Decision | Execution Flag |',
    '| --- | ---: | ---: | ---: | --- | --- |',
    ...outputs.scores.map((score) => `| ${score.product.name} | ${score.recommended_eng_hours} | ${score.recommended_founder_hours} | ${formatMoney(score.recommended_monthly_budget)} | ${score.final_decision} | ${score.execution_efficiency_flag ? 'Yes' : 'No'} |`),
    '',
  ].join('\n') + '\n'
}

function buildTop3Report(outputs: CapitalOutputs): string {
  const top = outputs.scores.slice(0, 3)
  return [
    '# Top 3 To Fund',
    '',
    ...top.map((score, index) => `${index + 1}. ${score.product.name} — ${score.final_decision} (score ${score.composite_allocation_score.toFixed(1)}, confidence ${score.data_confidence_pct.toFixed(1)}%)`),
    '',
  ].join('\n') + '\n'
}

function buildKillListReport(outputs: CapitalOutputs): string {
  const candidates = outputs.scores
    .filter((score) => score.final_decision === 'PAUSE' || score.final_decision === 'SUNSET')
    .sort((left, right) => left.composite_allocation_score - right.composite_allocation_score)
    .slice(0, 8)

  return [
    '# Kill List',
    '',
    '| Product | Score | Final Decision | Burn | Monthly Savings | Confidence |',
    '| --- | ---: | --- | ---: | ---: | ---: |',
    ...candidates.map((score) => `| ${score.product.name} | ${score.composite_allocation_score.toFixed(1)} | ${score.final_decision} | ${formatMoney(score.product.monthly_burn)} | ${formatMoney(score.product.monthly_burn - score.recommended_monthly_budget)} | ${score.data_confidence_pct.toFixed(1)}% |`),
    '',
  ].join('\n') + '\n'
}

function buildFounderTimeMap(outputs: CapitalOutputs): string {
  return [
    '# Founder Time Map',
    '',
    '| Product | Weekly Founder Hours | Final Decision | Override |',
    '| --- | ---: | --- | --- |',
    ...outputs.scores.map((score) => `| ${score.product.name} | ${Math.round(score.recommended_founder_hours / 4)} | ${score.final_decision} | ${score.override_reason ? 'Yes' : 'No'} |`),
    '',
  ].join('\n') + '\n'
}

function buildRunwayReport(outputs: CapitalOutputs): string {
  return [
    '# Runway Scenarios',
    '',
    `Assumptions: ${outputs.scenario_pack.assumptions_note}`,
    '',
    `- Baseline runway today: ${outputs.runway_months_today.toFixed(1)} months`,
    ...outputs.scenario_outcomes.map((outcome) => `- ${outcome.scenario.title}: ${outcome.runway_months.toFixed(1)} months runway, survival ${outcome.survival_probability_pct.toFixed(1)}%, hiring = ${outcome.hiring_recommendation}`),
    '',
  ].join('\n') + '\n'
}

function buildSignalReadiness(outputs: CapitalOutputs): string {
  return [
    '# Capital Signal Adapters',
    '',
    'Signals are labeled live, manual, estimate, or unavailable. No connector claims production telemetry unless a real source is present.',
    '',
    '| Product | Revenue | Pipeline | Collections | Active Users | Eng Velocity |',
    '| --- | --- | --- | --- | --- | --- |',
    ...outputs.scores.map((score) => `| ${score.product.name} | ${score.live_signals.metrics.monthly_revenue_actual.source} / ${score.live_signals.metrics.monthly_revenue_actual.confidence} | ${score.live_signals.metrics.pipeline_actual.source} / ${score.live_signals.metrics.pipeline_actual.confidence} | ${score.live_signals.metrics.collections_outstanding.source} / ${score.live_signals.metrics.collections_outstanding.confidence} | ${score.live_signals.metrics.active_users.source} / ${score.live_signals.metrics.active_users.confidence} | ${score.live_signals.metrics.engineering_velocity.source} / ${score.live_signals.metrics.engineering_velocity.confidence} |`),
    '',
    '## Connector Status',
    '',
    '| Product | Connector | Status | Note |',
    '| --- | --- | --- | --- |',
    ...outputs.scores.flatMap((score) => score.live_signals.connectors.map((connector) => `| ${score.product.name} | ${connector.connector} | ${connector.status} | ${connector.note} |`)),
    '',
  ].join('\n') + '\n'
}

function buildCashCalendarReport(outputs: CapitalOutputs): string {
  return [
    '# Cash Calendar',
    '',
    `Assumptions: ${outputs.cash_calendar.assumptions_note}`,
    '',
    '| Horizon | Date | Starting Cash | Obligations | Receivables | Ending Cash | Net Change |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
    ...outputs.cash_forecast.map((checkpoint) => `| ${checkpoint.days} days | ${checkpoint.date} | ${formatMoney(checkpoint.starting_cash)} | ${formatMoney(checkpoint.obligations)} | ${formatMoney(checkpoint.receivables)} | ${formatMoney(checkpoint.ending_cash)} | ${formatMoney(checkpoint.net_change)} |`),
    '',
    '## Stress Points',
    '',
    ...outputs.cash_forecast.flatMap((checkpoint) => checkpoint.stress_points.length === 0
      ? [`- Day ${checkpoint.days}: no modeled stress trigger.`]
      : checkpoint.stress_points.map((point) => `- Day ${checkpoint.days}: ${point}`)),
    '',
  ].join('\n') + '\n'
}

function buildAlertsReport(outputs: CapitalOutputs): string {
  return [
    '# Capital Alerts',
    '',
    ...(outputs.alerts.length === 0
      ? ['- No capital alerts triggered.']
      : outputs.alerts.map((alert) => `- [${alert.severity.toUpperCase()}] ${alert.title}: ${alert.detail}`)),
    '',
  ].join('\n') + '\n'
}

function buildOverridesReport(outputs: CapitalOutputs): string {
  return [
    '# Override Analytics',
    '',
    `- Override frequency: ${outputs.override_analytics.override_frequency.toFixed(2)} per product in current log.`,
    `- Override accuracy: ${outputs.override_analytics.accuracy_pct === null ? 'Not enough resolved override outcomes yet.' : `${outputs.override_analytics.accuracy_pct.toFixed(1)}%`}`,
    `- Open overrides: ${outputs.override_analytics.open_overrides.length}`,
    '',
    '## Open Overrides',
    '',
    ...(outputs.override_analytics.open_overrides.length === 0
      ? ['- None.']
      : outputs.override_analytics.open_overrides.map((override) => `- ${override.date} — ${override.product}: ${override.engine_recommendation} -> ${override.override_decision} (${override.owner}) because ${override.reason}`)),
    '',
  ].join('\n') + '\n'
}

function buildScenarioReport(outputs: CapitalOutputs): string {
  return [
    '# Scenario Pack',
    '',
    '| Scenario | Runway | Survival | Hiring | Key Allocation Changes |',
    '| --- | ---: | ---: | --- | --- |',
    ...outputs.scenario_outcomes.map((outcome) => `| ${outcome.scenario.title} | ${outcome.runway_months.toFixed(1)} months | ${outcome.survival_probability_pct.toFixed(1)}% | ${outcome.hiring_recommendation} | ${(outcome.allocation_changes.map((change) => `${change.product}: ${change.from} -> ${change.to}`).join('; ') || 'No major decision change')} |`),
    '',
  ].join('\n') + '\n'
}

function buildShutdownPlaybook(outputs: CapitalOutputs): string {
  const candidates = outputs.scores.filter((score) => score.final_decision === 'PAUSE' || score.final_decision === 'SUNSET')
  return [
    '# Product Shutdown Playbooks',
    '',
    ...candidates.flatMap((score) => [
      `## ${score.product.name}`,
      '',
      `- Monthly savings: ${formatMoney(score.product.monthly_burn - score.recommended_monthly_budget)}`,
      `- Migration steps: freeze roadmap, preserve core data, and route any remaining workflows through Console/Web control surfaces.`,
      `- Customer comms: ${score.product.monthly_revenue > 0 || score.product.customers > 0 || score.product.pilots > 0 ? 'Notify any active users or pilots within 10 business days.' : 'No active external customer communication required unless a dormant account reactivates.'}`,
      `- Code archive plan: snapshot app path, tag final release, and move residual TODOs into governance backlog.`,
      `- Reusable IP extraction: preserve workflow primitives, integration contracts, and UI patterns tied to ${score.product.strategic_role.toLowerCase()}`,
      '',
    ]),
  ].join('\n') + '\n'
}

function buildBoardPack(outputs: CapitalOutputs): string {
  const risks = outputs.alerts.slice(0, 5)
  const wins = outputs.scores.slice(0, 3)
  const doubles = fundCandidates(outputs.scores).slice(0, 3)
  const kills = outputs.scores.filter((score) => score.final_decision === 'PAUSE' || score.final_decision === 'SUNSET').slice(0, 3)
  const fundraisingStatus = outputs.runway_months_today < 6 ? 'RED — raise or cut now.' : outputs.runway_months_today < 9 ? 'AMBER — start fundraising prep now.' : 'GREEN — runway is acceptable, but keep pipeline pressure high.'
  const hiringRecommendation = buildHiringRecommendation(outputs.runway_months_today, outputs.alerts)

  return [
    '# Board Pack',
    '',
    '## Executive Summary',
    '',
    `- Baseline runway: ${outputs.runway_months_today.toFixed(1)} months.`,
    `- Top allocation posture: ${(doubles.map((score) => score.product.name).join(', ') || 'No double-down candidates')}.`,
    `- Hidden bet: ${outputs.most_mispriced_hidden_bet ? `${outputs.most_mispriced_hidden_bet.product.name} (${outputs.most_mispriced_hidden_bet.data_confidence_pct.toFixed(1)}% confidence)` : 'None.'}`,
    '',
    '## Cash Position',
    '',
    `- Current cash assumption: ${formatMoney(outputs.catalog.capital_model.scenarios.current_cash)}.`,
    `- 90-day ending cash: ${formatMoney(outputs.cash_forecast[2]?.ending_cash ?? outputs.catalog.capital_model.scenarios.current_cash)}.`,
    '',
    '## Runway Delta',
    '',
    ...outputs.scenario_outcomes.map((outcome) => `- ${outcome.scenario.title}: ${outcome.runway_months.toFixed(1)} months, survival ${outcome.survival_probability_pct.toFixed(1)}%.`),
    '',
    '## Allocation Changes',
    '',
    ...wins.map((score) => `- ${score.product.name}: ${score.final_decision} at ${score.composite_allocation_score.toFixed(1)} with ${score.data_confidence_pct.toFixed(1)}% confidence.`),
    '',
    '## Top Risks',
    '',
    ...(risks.length === 0 ? ['- None.'] : risks.map((risk) => `- ${risk.title}: ${risk.detail}`)),
    '',
    '## Top Wins',
    '',
    ...wins.map((score) => `- ${score.product.name}: ${score.explainability[0]}`),
    '',
    '## Hiring Recommendation',
    '',
    `- ${hiringRecommendation}`,
    '',
    '## Fundraising Trigger Status',
    '',
    `- ${fundraisingStatus}`,
    '',
    '## Products To Kill / Double Down',
    '',
    `- Kill or pause: ${(kills.map((score) => score.product.name).join(', ') || 'None')}.`,
    `- Double down: ${(doubles.map((score) => score.product.name).join(', ') || 'None')}.`,
    '',
  ].join('\n') + '\n'
}

function main(): void {
  const root = findRepoRoot()
  const outputs = buildCapitalOutputs(root)

  if (outputs.validation.errors.length > 0) {
    console.log('\n[generate:capital-allocation] FAIL')
    for (const error of outputs.validation.errors) console.log(` - ${error}`)
    for (const warning of outputs.validation.warnings) console.log(` ! ${warning}`)
    process.exit(1)
  }

  writeFile(root, 'reports/capital-allocation.md', buildCapitalAllocationReport(outputs))
  writeFile(root, 'reports/resource-allocation.md', buildResourceAllocationReport(outputs))
  writeFile(root, 'reports/top-3-to-fund.md', buildTop3Report(outputs))
  writeFile(root, 'reports/kill-list.md', buildKillListReport(outputs))
  writeFile(root, 'reports/founder-time-map.md', buildFounderTimeMap(outputs))
  writeFile(root, 'reports/runway-scenarios.md', buildRunwayReport(outputs))
  writeFile(root, 'reports/capital-signal-readiness.md', buildSignalReadiness(outputs))
  writeFile(root, 'reports/cash-calendar.md', buildCashCalendarReport(outputs))
  writeFile(root, 'reports/capital-alerts.md', buildAlertsReport(outputs))
  writeFile(root, 'reports/capital-overrides.md', buildOverridesReport(outputs))
  writeFile(root, 'reports/capital-scenarios.md', buildScenarioReport(outputs))
  writeFile(root, 'reports/product-shutdown-playbooks.md', buildShutdownPlaybook(outputs))
  writeFile(root, 'reports/board-pack.md', buildBoardPack(outputs))

  console.log('\n[generate:capital-allocation] PASS')
  console.log('Wrote 13 capital operating system reports.')
  for (const warning of outputs.validation.warnings) console.log(` ! ${warning}`)
}

main()