#!/usr/bin/env tsx
/**
 * generate-simulation-report.ts
 *
 * Wave 9 procurement report generator.
 *
 * Executes all built-in governance simulation scenarios, aggregates results
 * into readiness scores, and writes:
 *
 *   reports/governance-simulation-summary.json
 *   docs/procurement/GOVERNANCE_SIMULATION_OVERVIEW.md
 *
 * Safe to run in CI — write-only, never mutates runtime state.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, '..');

// Dynamic imports ensure modules bootstrap cleanly in script context
const { getAllScenarios } = await import('../lib/governance-simulation/scenarios.js');
const { runScenario } = await import('../lib/governance-simulation/simulation.js');
const { getSimulationSummary, clearSimulationLedger } = await import('../lib/governance-simulation/ledger.js');
const { computeInstitutionalReadinessScore } = await import('../lib/governance-simulation/scoring.js');

clearSimulationLedger();

// Run all built-in scenarios
const scenarios = getAllScenarios();
console.log(`\n  Running ${scenarios.length} governance simulation scenarios…\n`);

const results: Awaited<ReturnType<typeof runScenario>>[] = [];
for (const scenario of scenarios) {
  const result = runScenario(scenario.id);
  results.push(result);
  const icon = result.outcomesMatched ? '✓' : '△';
  console.log(`  ${icon}  ${scenario.id} [${result.severity}]`);
}

const summary = getSimulationSummary();
const readiness = computeInstitutionalReadinessScore(results);

// ── Write JSON report ─────────────────────────────────────────────────────────

const reportPayload = {
  generatedAt: new Date().toISOString(),
  governanceMode: 'shadow',
  summary,
  readinessScore: readiness,
  scenarios: results.map((r) => ({
    id: r.scenarioId,
    severity: r.severity,
    outcomesMatched: r.outcomesMatched,
    actualOutcomes: r.actualOutcomes,
    unmatchedExpected: r.unmatchedExpected,
    escalationChain: r.escalationChain,
    continuityGapDetected: r.continuityGapDetected,
    federationConflictDetected: r.federationConflictDetected,
    correlationId: r.correlationId,
  })),
};

const reportsDir = join(appRoot, 'reports');
mkdirSync(reportsDir, { recursive: true });
const jsonPath = join(reportsDir, 'governance-simulation-summary.json');
writeFileSync(jsonPath, JSON.stringify(reportPayload, null, 2), 'utf-8');
console.log(`\n  → JSON report: reports/governance-simulation-summary.json`);

// ── Write Markdown procurement report ────────────────────────────────────────

const outcomeMatchPct = Math.round(summary.outcomeMatchRate * 100);
const bySeverity = summary.severityBreakdown;

const md = `# Governance Simulation Overview

> **Governance mode:** shadow-only — all simulations are read-only and never mutate production state.

## Summary

| Metric | Value |
| --- | --- |
| Simulations run | ${summary.totalSimulations} |
| Outcome match rate | ${outcomeMatchPct}% |
| Escalations triggered | ${summary.escalationsTriggered} |
| Continuity gaps detected | ${summary.continuityGapsDetected} |
| Federation conflicts detected | ${summary.federationConflictsDetected} |
| Generated at | ${summary.generatedAt} |

## Institutional Readiness Score

> Shadow-mode only. Not a certification. Internal governance maturity telemetry.

| Dimension | Score |
| --- | --- |
| **Overall** | **${readiness.overall}/100** |
| Governance Continuity | ${readiness.continuity.score}/100 |
| Federation Stability | ${readiness.federation.score}/100 |
| Publication Governance | ${readiness.publication.score}/100 |
| AI Accountability | ${readiness.aiAccountability.score}/100 |

### Continuity Dimension

- Continuity gaps detected: ${readiness.continuity.continuityGapsDetected}
- Leadership vulnerabilities: ${readiness.continuity.leadershipVulnerabilities}
- Audit chain integrity: ${readiness.continuity.auditChainIntegrity ? '✓ intact' : '⚠ gap detected'}

### Federation Dimension

- Conflicts simulated: ${readiness.federation.conflictsSimulated}
- Conflicts with governance response: ${readiness.federation.conflictsResolved}
- Inheritance violations: ${readiness.federation.inheritanceViolations}

### Publication Dimension

- Escalations required: ${readiness.publication.escalationsRequired}
- Unauthorized attempts: ${readiness.publication.unauthorizedAttempts}
- Approval coverage complete: ${readiness.publication.approvalCoverageComplete ? '✓' : '⚠'}

### AI Accountability Dimension

- High-risk operations simulated: ${readiness.aiAccountability.highRiskOperationsSimulated}
- Human review triggered: ${readiness.aiAccountability.humanReviewTriggered}
- Escalations resolved: ${readiness.aiAccountability.escalationsResolved}

## Severity Breakdown

| Severity | Count |
| --- | --- |
| Institutional risk | ${bySeverity['institutional-risk'] ?? 0} |
| Critical | ${bySeverity['critical'] ?? 0} |
| Elevated | ${bySeverity['elevated'] ?? 0} |
| Informational | ${bySeverity['informational'] ?? 0} |

## Scenario Coverage

| Scenario | Severity | Outcomes Matched | Escalation Chain |
| --- | --- | --- | --- |
${results
  .map(
    (r) =>
      `| \`${r.scenarioId}\` | ${r.severity} | ${r.outcomesMatched ? '✓' : '△'} | ${r.escalationChain.join(' → ') || '—'} |`,
  )
  .join('\n')}

## Architecture

Union Eyes governance simulation infrastructure provides:

- **Deterministic scenario execution** — identical inputs produce identical outcomes
- **Federation inheritance modeling** — national → regional → local conflict resolution
- **Continuity stress analysis** — leadership turnover, audit chain loss, governance orphaning
- **AI governance simulation** — risk classification, escalation paths, federation restrictions
- **Replay engine** — previous simulations can be replayed under new policy conditions to detect governance divergence
- **Procurement evidence** — all simulation results recorded in governance evidence ledger

> Simulation infrastructure is additive and shadow-mode only.
> No production runtime behavior is modified by simulation execution.
`;

const procurementDir = join(appRoot, 'docs', 'procurement');
mkdirSync(procurementDir, { recursive: true });
const mdPath = join(procurementDir, 'GOVERNANCE_SIMULATION_OVERVIEW.md');
writeFileSync(mdPath, md, 'utf-8');
console.log(`  → Markdown report: docs/procurement/GOVERNANCE_SIMULATION_OVERVIEW.md`);

console.log(`\n  Readiness score: ${readiness.overall}/100`);
console.log(`  Outcome match:   ${outcomeMatchPct}%`);
console.log(`  Done.\n`);
