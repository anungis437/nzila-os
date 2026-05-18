#!/usr/bin/env tsx
/**
 * Governance sovereignty validation gate.
 *
 * Checks:
 *   1. All built-in simulation scenarios are registered and resolvable
 *   2. Delegation chains are evaluable for representative contracts
 *   3. Continuity resilience snapshot is producible
 *   4. Sovereignty ledger is operational
 *   5. Readiness scoring is functional (shadow-mode only)
 *
 * Always exits 0 (warn-only). Never production-blocking.
 */

import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('⚙️  Governance Sovereignty Validation\n');

  const warnings: string[] = [];
  let passed = 0;

  // ── 1. Simulation scenarios ────────────────────────────────────────────────
  try {
    const { getAllSimulationScenarios, BUILT_IN_SCENARIOS } = await import(
      '../lib/federation-sovereignty/simulation.js'
    );
    const scenarios = getAllSimulationScenarios();
    if (scenarios.length >= BUILT_IN_SCENARIOS.length) {
      console.log(`  ✅ [1/5] Simulation scenarios registered: ${scenarios.length}`);
      passed++;
    } else {
      warnings.push(`[1/5] Expected ≥${BUILT_IN_SCENARIOS.length} scenarios, got ${scenarios.length}`);
      console.warn(`  ⚠️  [1/5] ${warnings[warnings.length - 1]}`);
    }
  } catch (err) {
    warnings.push(`[1/5] Simulation scenarios check failed: ${err}`);
    console.warn(`  ⚠️  [1/5] ${warnings[warnings.length - 1]}`);
  }

  // ── 2. Delegation chains ───────────────────────────────────────────────────
  try {
    const { evaluateAllDelegations } = await import(
      '../lib/federation-sovereignty/delegation.js'
    );
    const contract = {
      federationId: 'validate-test',
      sovereigntyTier: 'local' as const,
      sovereigntyMode: 'federation-aligned' as const,
      delegatedAuthorities: ['publication', 'member-governance'] as const,
      inheritedPolicies: [],
      overrideRestrictions: [],
      escalationRequirements: [],
      continuityRequirements: [],
      auditVisibility: 'local' as const,
    };
    const results = evaluateAllDelegations(contract as never);
    if (results.size === 6) {
      console.log(`  ✅ [2/5] Delegation chains evaluable (6 authorities)`);
      passed++;
    } else {
      warnings.push(`[2/5] Expected 6 delegation results, got ${results.size}`);
      console.warn(`  ⚠️  [2/5] ${warnings[warnings.length - 1]}`);
    }
  } catch (err) {
    warnings.push(`[2/5] Delegation chain check failed: ${err}`);
    console.warn(`  ⚠️  [2/5] ${warnings[warnings.length - 1]}`);
  }

  // ── 3. Continuity resilience ───────────────────────────────────────────────
  try {
    const { snapshotContinuityResilience } = await import(
      '../lib/federation-sovereignty/coordination.js'
    );
    const snapshot = snapshotContinuityResilience([]);
    if (snapshot.score === 100) {
      console.log(`  ✅ [3/5] Continuity resilience snapshot operational`);
      passed++;
    } else {
      warnings.push(`[3/5] Unexpected continuity baseline score: ${snapshot.score}`);
      console.warn(`  ⚠️  [3/5] ${warnings[warnings.length - 1]}`);
    }
  } catch (err) {
    warnings.push(`[3/5] Continuity resilience check failed: ${err}`);
    console.warn(`  ⚠️  [3/5] ${warnings[warnings.length - 1]}`);
  }

  // ── 4. Sovereignty ledger ──────────────────────────────────────────────────
  try {
    const { recordSovereigntyEvent, peekSovereigntyLedger, clearSovereigntyLedger } =
      await import('../lib/federation-sovereignty/ledger.js');
    clearSovereigntyLedger();
    recordSovereigntyEvent({
      federationId: 'validate',
      eventType: 'authority-exercised',
      tier: 'local',
      outcome: 'accepted',
      correlationId: 'validate-gate',
      diagnostics: {},
    });
    const entries = peekSovereigntyLedger();
    clearSovereigntyLedger();
    if (entries.length === 1) {
      console.log(`  ✅ [4/5] Sovereignty ledger operational`);
      passed++;
    } else {
      warnings.push(`[4/5] Ledger did not record event correctly`);
      console.warn(`  ⚠️  [4/5] ${warnings[warnings.length - 1]}`);
    }
  } catch (err) {
    warnings.push(`[4/5] Sovereignty ledger check failed: ${err}`);
    console.warn(`  ⚠️  [4/5] ${warnings[warnings.length - 1]}`);
  }

  // ── 5. Readiness scoring ───────────────────────────────────────────────────
  try {
    const { computeSovereigntyReadiness } = await import(
      '../lib/federation-sovereignty/scoring.js'
    );
    const assessment = computeSovereigntyReadiness([]);
    if (assessment.governanceMode === 'shadow' && assessment.overall === 100) {
      console.log(`  ✅ [5/5] Readiness scoring operational (shadow-mode, baseline 100)`);
      passed++;
    } else {
      warnings.push(
        `[5/5] Unexpected scoring result: mode=${assessment.governanceMode} overall=${assessment.overall}`,
      );
      console.warn(`  ⚠️  [5/5] ${warnings[warnings.length - 1]}`);
    }
  } catch (err) {
    warnings.push(`[5/5] Readiness scoring check failed: ${err}`);
    console.warn(`  ⚠️  [5/5] ${warnings[warnings.length - 1]}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n📊 Sovereignty validation: ${passed}/5 checks passed`);

  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    for (const w of warnings) {
      console.log(`   - ${w}`);
    }
    console.log('\n  (warn-only — not production-blocking)');
  } else {
    console.log('\n✅ All sovereignty governance checks passed.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Sovereignty validation error:', err);
  process.exit(0); // warn-only: never exit 1
});
