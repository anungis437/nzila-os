#!/usr/bin/env tsx
/**
 * Generate the governance sovereignty report.
 *
 * Outputs:
 *   - reports/governance-simulation-ledger.json  (sovereignty ledger snapshot)
 *   - reports/federation-sovereignty-summary.json
 *   - docs/procurement/FEDERATION_SOVEREIGNTY_OVERVIEW.md
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

async function main() {
  console.log('📊 Generating Governance Sovereignty Report…\n');

  const {
    getAllSimulationScenarios,
    runCrossFederationSimulation,
    BUILT_IN_SCENARIOS,
  } = await import('../lib/federation-sovereignty/simulation.js');

  const { computeSovereigntyReadiness } = await import(
    '../lib/federation-sovereignty/scoring.js'
  );

  const {
    recordSovereigntyEvent,
    getSovereigntyLedgerSummary,
    peekSovereigntyLedger,
    clearSovereigntyLedger,
  } = await import('../lib/federation-sovereignty/ledger.js');

  clearSovereigntyLedger();

  // ── Contracts for report generation ───────────────────────────────────────
  const contracts = [
    {
      federationId: 'national-cupe',
      sovereigntyTier: 'national' as const,
      sovereigntyMode: 'fully-autonomous' as const,
      delegatedAuthorities: ['publication', 'policy-enforcement', 'ai-operations', 'member-governance', 'audit-visibility', 'continuity-management'] as const,
      inheritedPolicies: ['policy.national-baseline'],
      overrideRestrictions: [],
      escalationRequirements: [],
      continuityRequirements: [],
      auditVisibility: 'national' as const,
    },
    {
      federationId: 'regional-ontario',
      sovereigntyTier: 'regional' as const,
      sovereigntyMode: 'federation-aligned' as const,
      delegatedAuthorities: ['publication', 'member-governance', 'continuity-management'] as const,
      inheritedPolicies: ['policy.national-baseline'],
      overrideRestrictions: [],
      escalationRequirements: [],
      continuityRequirements: ['require.succession-plan'],
      auditVisibility: 'regional' as const,
    },
    {
      federationId: 'local-toronto-001',
      sovereigntyTier: 'local' as const,
      sovereigntyMode: 'federation-aligned' as const,
      delegatedAuthorities: ['publication', 'member-governance'] as const,
      inheritedPolicies: ['policy.national-baseline'],
      overrideRestrictions: [],
      escalationRequirements: [],
      continuityRequirements: [],
      auditVisibility: 'local' as const,
    },
  ];

  // ── Run all scenarios ──────────────────────────────────────────────────────
  const scenarioResults: Array<{
    scenarioId: string;
    description: string;
    participatingTiers: string[];
    conflictsDetected: string[];
    resolutionPaths: string[];
    escalationChain: string[];
    outcomesMatched: boolean;
    actualOutcomes: string[];
    governanceMode: 'shadow';
  }> = [];
  const scenarios = getAllSimulationScenarios();

  for (const scenario of scenarios) {
    recordSovereigntyEvent({
      federationId: 'report-run',
      eventType: 'coordination-event',
      tier: 'national',
      outcome: 'accepted',
      correlationId: `report:${scenario.id}`,
      diagnostics: { scenario: scenario.id },
    });

    const result = runCrossFederationSimulation(
      scenario,
      contracts as never,
      `report:${scenario.id}`,
    );
    scenarioResults.push({
      scenarioId: scenario.id,
      description: scenario.description,
      participatingTiers: scenario.participatingTiers,
      conflictsDetected: result.conflictsDetected,
      resolutionPaths: result.resolutionPaths,
      escalationChain: result.escalationChain,
      outcomesMatched: result.outcomesMatched,
      actualOutcomes: result.actualOutcomes,
      governanceMode: result.governanceMode,
    });
  }

  // ── Readiness assessment ───────────────────────────────────────────────────
  const readiness = computeSovereigntyReadiness(contracts as never);

  // ── Ledger summary ─────────────────────────────────────────────────────────
  const ledgerSummary = getSovereigntyLedgerSummary();
  const ledgerSnapshot = peekSovereigntyLedger();

  // ── Write reports ──────────────────────────────────────────────────────────
  const reportsDir = resolve(ROOT, 'reports');
  const docsDir = resolve(ROOT, 'docs', 'procurement');
  mkdirSync(reportsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  const summary = {
    generatedAt: new Date().toISOString(),
    governanceMode: 'shadow',
    scenariosRun: scenarios.length,
    scenarioResults,
    readinessAssessment: readiness,
    ledgerSummary,
    metadata: {
      wave: 10,
      module: 'federation-sovereignty',
      productionImpact: 'none',
    },
  };

  writeFileSync(
    resolve(reportsDir, 'federation-sovereignty-summary.json'),
    JSON.stringify(summary, null, 2),
  );
  console.log('  ✅ reports/federation-sovereignty-summary.json');

  writeFileSync(
    resolve(reportsDir, 'federation-sovereignty-ledger.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        governanceMode: 'shadow',
        entries: ledgerSnapshot,
        summary: ledgerSummary,
      },
      null,
      2,
    ),
  );
  console.log('  ✅ reports/federation-sovereignty-ledger.json');

  // ── Procurement overview ───────────────────────────────────────────────────
  const conflictCount = scenarioResults.reduce(
    (acc, r) => acc + r.conflictsDetected.length,
    0,
  );
  const escalationCount = scenarioResults.filter((r) => r.escalationChain.length > 0).length;

  const procurementDoc = `# Federation Sovereignty Governance Overview

> Generated: ${new Date().toISOString()}
> Governance mode: shadow (production runtime unchanged)
> Wave: 10 — Sovereign Federation Execution Fabric

---

## Summary

Union Eyes models and orchestrates sovereign institutional governance,
delegated federation authority, continuity-sharing semantics, AI governance
jurisdiction, and explainable operational autonomy across federated labour
structures.

This document is generated from the governance simulation engine. All results
are shadow-mode only — production operations are never mutated.

---

## Readiness Assessment

| Dimension              | Score |
|------------------------|-------|
| **Overall**            | ${readiness.overall}/100 |
| Autonomy               | ${readiness.autonomy.score.toFixed(1)}/100 |
| Delegation             | ${readiness.delegation.score.toFixed(1)}/100 |
| Continuity             | ${readiness.continuity.score.toFixed(1)}/100 |
| Jurisdiction           | ${readiness.jurisdiction.score.toFixed(1)}/100 |

- Units assessed: ${readiness.autonomy.unitsAssessed}
- Fully autonomous units: ${readiness.autonomy.fullyAutonomousUnits}
- Simulation scenarios registered: ${readiness.simulationCount}

---

## Simulated Governance Paths

${scenarios.length} scenarios executed:

${scenarioResults
  .map(
    (r) =>
      `### ${r.scenarioId}\n\n` +
      `> ${scenarios.find((s) => s.id === r.scenarioId)?.description ?? ''}\n\n` +
      `- **Tiers**: ${r.participatingTiers.join(' → ')}\n` +
      `- **Conflicts detected**: ${r.conflictsDetected.join(', ') || 'none'}\n` +
      `- **Resolution paths**: ${r.resolutionPaths.join(', ') || 'none'}\n` +
      `- **Escalation chain**: ${r.escalationChain.join(' → ') || 'none'}\n` +
      `- **Outcomes matched**: ${r.outcomesMatched ? '✅' : '⚠️ partial'}\n`,
  )
  .join('\n---\n\n')}

---

## Conflict and Escalation Summary

| Metric | Count |
|--------|-------|
| Total conflicts detected | ${conflictCount} |
| Scenarios with escalation | ${escalationCount} |

---

## AI Governance Jurisdiction

AI governance restrictions cascade downward through the federation hierarchy.
The maximum permitted AI risk tier is:

- \`fully-autonomous\` units with AI authority: **sensitive**
- \`federation-aligned\` units with AI authority: **advisory**
- All other units: **assistive**

Human review jurisdiction is scoped by tier (local → regional → national).

---

## Audit Visibility Sovereignty

Each federation unit controls local audit detail.
Parent tiers receive escalated summaries only — not private operational detail.

---

## Continuity-Sharing Semantics

- Continuity sharing agreements active: ${readiness.continuity.sharingAgreementsActive}
- Continuity gaps detected: ${readiness.continuity.continuityGapsDetected}
- Jurisdiction intact: ${readiness.continuity.jurisdictionIntact ? '✅' : '⚠️'}

---

## Institutional Legitimacy Guarantee

All sovereign governance operations:

- Classify, simulate, ledger, and escalate — never auto-resolve
- Preserve local sovereignty while enabling federation coordination
- Maintain explainable institutional evidence for every governance event
- Leave production runtime completely unchanged

---

*Generated by Union Eyes governance simulation engine (Wave 10).*
*Shadow-mode only. All findings are institutional preparedness evidence.*
`;

  writeFileSync(resolve(docsDir, 'FEDERATION_SOVEREIGNTY_OVERVIEW.md'), procurementDoc);
  console.log('  ✅ docs/procurement/FEDERATION_SOVEREIGNTY_OVERVIEW.md');

  console.log('\n✅ Sovereignty report generation complete.');
}

main().catch((err) => {
  console.error('Report generation error:', err);
  process.exit(1);
});
