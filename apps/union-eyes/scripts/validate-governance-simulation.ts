#!/usr/bin/env tsx
/**
 * validate-governance-simulation.ts
 *
 * Wave 9 CI governance simulation gate.
 *
 * Checks:
 *   1. All scenarios have valid contracts (required fields populated).
 *   2. All federation scenarios have inheritance chains that resolve.
 *   3. All continuity scenarios detect continuity gaps.
 *   4. All AI scenarios return deterministic outcomes.
 *   5. Replay chains are deterministic (no unexpected divergence on clean replay).
 *
 * Mode: warn-only. Never fails production. Exits 0 in all cases.
 */

import { _resetScenarioCatalog, getAllScenarios, getScenariosByScope } from '../lib/governance-simulation/scenarios.js';
import { replayScenario } from '../lib/governance-simulation/simulation.js';
import { simulateFederationConflict } from '../lib/governance-simulation/federation.js';
import { simulateContinuityStress } from '../lib/governance-simulation/continuity.js';
import { simulateAIGovernance } from '../lib/governance-simulation/ai-simulation.js';
import { clearSimulationLedger, getSimulationSummary } from '../lib/governance-simulation/ledger.js';

_resetScenarioCatalog();
clearSimulationLedger();

const warnings: string[] = [];
let checksRun = 0;

function warn(msg: string): void {
  warnings.push(`  WARN  ${msg}`);
}

function check(label: string): void {
  checksRun++;
  process.stdout.write(`  checking: ${label}… `);
}

function pass(): void {
  console.log('✓');
}

function warnFail(msg: string): void {
  console.log('△');
  warn(msg);
}

// ── 1. Scenario contract validation ─────────────────────────────────────────

check('scenario contracts valid');
const allScenarios = getAllScenarios();
let contractIssues = 0;
for (const s of allScenarios) {
  if (!s.id) { warn(`Scenario missing id`); contractIssues++; }
  if (!s.description) { warn(`Scenario '${s.id}' missing description`); contractIssues++; }
  if (!s.scope) { warn(`Scenario '${s.id}' missing scope`); contractIssues++; }
  if (!s.governanceSensitivity) { warn(`Scenario '${s.id}' missing governanceSensitivity`); contractIssues++; }
  if (!Array.isArray(s.assumptions) || s.assumptions.length === 0) {
    warn(`Scenario '${s.id}' has no assumptions`);
    contractIssues++;
  }
  if (!Array.isArray(s.expectedOutcomes) || s.expectedOutcomes.length === 0) {
    warn(`Scenario '${s.id}' has no expectedOutcomes`);
    contractIssues++;
  }
}
if (contractIssues === 0) {
  pass();
} else {
  warnFail(`${contractIssues} contract issue(s) found`);
}

// ── 2. Federation inheritance chain resolution ───────────────────────────────

check('federation inheritance chains resolvable');
const fedScenarios = getScenariosByScope('federation');
let fedIssues = 0;
for (const s of fedScenarios) {
  try {
    const result = simulateFederationConflict(s);
    if (result.inheritancePath.length === 0) {
      warn(`Federation scenario '${s.id}' produced empty inheritance path`);
      fedIssues++;
    }
    if (!result.inheritancePath.includes('national')) {
      warn(`Federation scenario '${s.id}' inheritance path does not reach 'national'`);
      fedIssues++;
    }
  } catch (err) {
    warn(`Federation scenario '${s.id}' threw: ${String(err)}`);
    fedIssues++;
  }
}
if (fedIssues === 0) {
  pass();
} else {
  warnFail(`${fedIssues} federation inheritance issue(s)`);
}

// ── 3. Continuity stress gap detection ──────────────────────────────────────

check('continuity scenarios detect gaps');
const continuityScenarios = getScenariosByScope('continuity');
let continuityIssues = 0;
for (const s of continuityScenarios) {
  try {
    const result = simulateContinuityStress(s);
    if (!result.continuityGapDetected) {
      warn(`Continuity scenario '${s.id}' did not detect a continuity gap`);
      continuityIssues++;
    }
  } catch (err) {
    warn(`Continuity scenario '${s.id}' threw: ${String(err)}`);
    continuityIssues++;
  }
}
if (continuityIssues === 0) {
  pass();
} else {
  warnFail(`${continuityIssues} continuity gap detection issue(s)`);
}

// ── 4. AI scenario determinism ───────────────────────────────────────────────

check('AI scenarios produce deterministic outcomes');
const aiScenarios = getScenariosByScope('ai-operation');
let aiIssues = 0;
for (const s of aiScenarios) {
  try {
    const r1 = simulateAIGovernance(s);
    const r2 = simulateAIGovernance(s);
    if (r1.riskTier !== r2.riskTier ||
        r1.humanReviewRequired !== r2.humanReviewRequired ||
        r1.operationBlocked !== r2.operationBlocked) {
      warn(`AI scenario '${s.id}' produced non-deterministic outcomes`);
      aiIssues++;
    }
  } catch (err) {
    warn(`AI scenario '${s.id}' threw: ${String(err)}`);
    aiIssues++;
  }
}
if (aiIssues === 0) {
  pass();
} else {
  warnFail(`${aiIssues} AI determinism issue(s)`);
}

// ── 5. Replay chain determinism ──────────────────────────────────────────────

check('replay chains deterministic');
const replayScenarios = allScenarios.slice(0, 5); // check first 5 to keep CI fast
let replayIssues = 0;
for (const s of replayScenarios) {
  try {
    const replay = replayScenario({ scenarioId: s.id, replayLabel: 'ci-determinism-check' });
    // A clean replay (no overrides) should not diverge
    if (replay.divergenceDetected) {
      warn(`Scenario '${s.id}' diverged on clean replay: ${replay.divergenceDimensions.join(', ')}`);
      replayIssues++;
    }
  } catch (err) {
    warn(`Scenario '${s.id}' replay threw: ${String(err)}`);
    replayIssues++;
  }
}
if (replayIssues === 0) {
  pass();
} else {
  warnFail(`${replayIssues} replay determinism issue(s)`);
}

// ── Summary ──────────────────────────────────────────────────────────────────

const ledgerSummary = getSimulationSummary();

console.log('\n  ─────────────────────────────────────────');
console.log(`  Checks run:         ${checksRun}`);
console.log(`  Warnings:           ${warnings.length}`);
console.log(`  Simulations run:    ${ledgerSummary.totalSimulations}`);
console.log(`  Outcome match rate: ${Math.round(ledgerSummary.outcomeMatchRate * 100)}%`);

if (warnings.length > 0) {
  console.log('\n  Warnings (governance:simulation — warn-only):');
  for (const w of warnings) {
    console.log(w);
  }
}

console.log('\n  governance:simulation complete (warn-only mode)\n');
process.exit(0); // Always exit 0 — warn-only, never fails CI
