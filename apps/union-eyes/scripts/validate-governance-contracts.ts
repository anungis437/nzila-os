/**
 * CI governance contracts validation gate.
 *
 * Checks that the governance policy layer is structurally coherent:
 *
 * W1 — All platform contracts are registered.
 * W2 — All governed API routes have a resolvable policy contract.
 * W3 — All public-experience contracts are registered.
 * W4 — All AI operations have a risk classification and resolvable contract.
 * W5 — No inheritance violations exist among registered contracts.
 * W6 — No contract is in enforce mode without evidenceRequired.
 *
 * Currently: warn-only (exits 0 regardless of warnings).
 * Switch `FAIL_ON_VIOLATIONS=true` to make this a hard gate.
 *
 * Run: `pnpm governance:contracts`
 */

import { bootstrapPlatformContracts, getAllContracts, resolveContract } from '../lib/governance-policy/registry';
import { PLATFORM_CONTRACTS } from '../lib/governance-policy/contracts';
import { UE_AI_OPERATIONS } from '../lib/governance-policy/ai-governance';
import { evaluateAIAction } from '../lib/governance-policy/ai-governance';
import { validateInheritanceStrength } from '../lib/governance-policy/inheritance';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

bootstrapPlatformContracts();

const warnings: string[] = [];
const errors: string[] = [];

const failOnViolations = process.env['FAIL_ON_VIOLATIONS'] === 'true';

function warn(msg: string): void {
  warnings.push(msg);
  console.warn(`  ⚠️  ${msg}`);
}

function error(msg: string): void {
  errors.push(msg);
  console.error(`  ❌  ${msg}`);
}

// ── W1 — Platform contracts registered ────────────────────────────────────────

console.log('\n[W1] Platform contracts registered');
let w1Pass = true;
for (const pc of PLATFORM_CONTRACTS) {
  const resolved = resolveContract(pc.id);
  if (!resolved) {
    error(`W1: Platform contract '${pc.id}' not found in registry after bootstrap`);
    w1Pass = false;
  }
}
if (w1Pass) console.log(`  ✅  All ${PLATFORM_CONTRACTS.length} platform contracts registered`);

// ── W2 — Route registry contract alignment ────────────────────────────────────

console.log('\n[W2] Route registry contract alignment');
const routeRegistryPath = resolve(__dirname, '../reports/route-registry.json');
if (!existsSync(routeRegistryPath)) {
  warn('W2: route-registry.json not found — run pnpm governance:routes first');
} else {
  const registry = JSON.parse(readFileSync(routeRegistryPath, 'utf-8')) as {
    routes?: Array<Record<string, unknown>>;
  };
  const routes = registry.routes ?? [];
  let ungoverned = 0;

  for (const route of routes) {
    const status = route['governanceStatus'] as string | undefined;
    if (status === 'ungoverned') {
      ungoverned++;
    }
  }

  if (ungoverned > 0) {
    warn(`W2: ${ungoverned} routes have status 'ungoverned' in route-registry.json`);
  } else {
    console.log(`  ✅  All ${routes.length} routes are governed or deprecated-wrapped`);
  }

  const missingRouteDefault = !resolveContract('route.default');
  const missingRouteAdmin = !resolveContract('route.admin');
  if (missingRouteDefault) error('W2: route.default contract missing');
  if (missingRouteAdmin) error('W2: route.admin contract missing');
}

// ── W3 — Public-experience contracts ─────────────────────────────────────────

console.log('\n[W3] Public-experience contracts');
const peContractIds = ['public-experience.surface', 'public-experience.federation'];
let w3Pass = true;
for (const id of peContractIds) {
  if (!resolveContract(id)) {
    error(`W3: Public-experience contract '${id}' not registered`);
    w3Pass = false;
  }
}
if (w3Pass) console.log(`  ✅  Public-experience contracts registered`);

// ── W4 — AI operations have contracts ────────────────────────────────────────

console.log('\n[W4] AI operations governance');
let w4Pass = true;
for (const op of UE_AI_OPERATIONS) {
  const result = evaluateAIAction(op);
  const contractId =
    result.risk === 'sensitive' || result.risk === 'restricted'
      ? 'ai-operation.sensitive'
      : 'ai-operation.assistive';

  if (!resolveContract(contractId)) {
    error(`W4: AI contract '${contractId}' for operation '${op.operationId}' not registered`);
    w4Pass = false;
  }
}
if (w4Pass) {
  console.log(`  ✅  All ${UE_AI_OPERATIONS.length} AI operations have resolvable contracts`);
}

// ── W5 — No inheritance weakening among same-id contracts ───────────────────

console.log('\n[W5] No inheritance violations');
const allContracts = getAllContracts();
// Check all contracts against route.default as the baseline
const routeDefault = resolveContract('route.default');
if (routeDefault) {
  const routeContracts = allContracts.filter(
    (c) => c.scope === 'route' && c.id !== 'route.default',
  );
  let w5Pass = true;
  for (const child of routeContracts) {
    const violations = validateInheritanceStrength(routeDefault, child);
    if (violations.length > 0) {
      w5Pass = false;
      for (const v of violations) {
        warn(`W5: Contract '${child.id}' weakens 'route.default': ${v}`);
      }
    }
  }
  if (w5Pass) console.log(`  ✅  No inheritance weakening detected`);
}

// ── W6 — enforce mode contracts require evidenceRequired ─────────────────────

console.log('\n[W6] Enforce mode contracts have evidenceRequired');
let w6Pass = true;
for (const c of allContracts) {
  if (c.mode === 'enforce' && !c.evidenceRequired) {
    warn(
      `W6: Contract '${c.id}' is in enforce mode but evidenceRequired=false — evidence is recommended`,
    );
    w6Pass = false;
  }
}
if (w6Pass) console.log(`  ✅  All enforce-mode contracts have evidenceRequired (or no enforce contracts yet)`);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n─────────────────────────────────────────────────');
console.log(`Governance contract validation complete`);
console.log(`  Warnings : ${warnings.length}`);
console.log(`  Errors   : ${errors.length}`);
console.log(
  `  Mode     : ${failOnViolations ? 'fail-on-violations (FAIL_ON_VIOLATIONS=true)' : 'warn-only (safe for CI rollout)'}`,
);

if (failOnViolations && (errors.length > 0 || warnings.length > 0)) {
  process.exit(1);
}

process.exit(0);
