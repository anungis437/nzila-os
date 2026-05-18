/**
 * Generate the governance decision ledger.
 *
 * Flushes the in-process evaluation ledger and writes it to
 * `reports/governance-decision-ledger.json`.
 *
 * Run: `pnpm tsx scripts/generate-governance-ledger.ts`
 *
 * In production this is called periodically (or at deploy time) to persist
 * the accumulated governance evaluation evidence.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

// Bootstrap the registry before importing evaluation so auto-registered
// platform contracts are available.
import { bootstrapPlatformContracts, getAllContracts } from '../lib/governance-policy/registry';
import { evaluatePolicy } from '../lib/governance-policy/evaluation';
import { flushDecisionLedger } from '../lib/governance-policy/evaluation';
import { PLATFORM_CONTRACTS } from '../lib/governance-policy/contracts';
import { UE_AI_OPERATIONS } from '../lib/governance-policy/ai-governance';
import { evaluateAIAction } from '../lib/governance-policy/ai-governance';

bootstrapPlatformContracts();

// ── Seed illustrative evaluations for ledger evidence ─────────────────────────

// Run a shadow evaluation of all AI operations against their contracts
for (const op of UE_AI_OPERATIONS) {
  const aiResult = evaluateAIAction(op);
  const contractId =
    aiResult.risk === 'sensitive' || aiResult.risk === 'restricted'
      ? 'ai-operation.sensitive'
      : 'ai-operation.assistive';

  const contract = getAllContracts().find((c) => c.id === contractId);
  if (contract) {
    evaluatePolicy(contract, {
      operationId: op.operationId,
      isPublic: op.outputPubliclyVisible,
    });
  }
}

// Shadow evaluation of route contracts
const routeDefault = PLATFORM_CONTRACTS.find((c) => c.id === 'route.default')!;
const routeAdmin = PLATFORM_CONTRACTS.find((c) => c.id === 'route.admin')!;

evaluatePolicy(routeDefault, {
  operationId: 'route.sample-governed',
  actor: { userId: 'system', role: 'officer', orgId: 'org-1' },
});

evaluatePolicy(routeAdmin, {
  operationId: 'route.sample-admin',
  actor: { userId: 'system', role: 'admin', orgId: 'org-1' },
});

// ── Flush and write ────────────────────────────────────────────────────────────

const decisions = flushDecisionLedger();

const ledger = {
  generatedAt: new Date().toISOString(),
  totalDecisions: decisions.length,
  shadowDecisions: decisions.filter((d) => d.mode === 'shadow').length,
  enforceDecisions: decisions.filter((d) => d.mode === 'enforce').length,
  decisions,
};

const outDir = resolve(__dirname, '../reports');
mkdirSync(outDir, { recursive: true });

const outPath = resolve(outDir, 'governance-decision-ledger.json');
writeFileSync(outPath, JSON.stringify(ledger, null, 2), 'utf-8');

console.log(`✅  Governance decision ledger written: ${outPath}`);
console.log(`    Total decisions: ${ledger.totalDecisions}`);
console.log(`    Shadow: ${ledger.shadowDecisions}  |  Enforce: ${ledger.enforceDecisions}`);
