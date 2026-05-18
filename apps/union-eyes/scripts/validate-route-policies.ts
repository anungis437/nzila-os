#!/usr/bin/env tsx
/**
 * validate-route-policies.ts
 *
 * Advisory CI script: cross-checks route registry metadata for policy
 * consistency problems. Designed to help teams improve annotation coverage
 * incrementally. Always exits 0 — purely advisory during rollout.
 *
 * Prerequisite: run `pnpm registry:generate` first.
 *
 * Checks performed:
 *   W1 — Governance/admin/platform routes missing evidenceRequired: true
 *   W2 — platform-admin-only routes with non-admin/platform audience
 *   W3 — pilot-only productionStatus with pilotEligible: false (inconsistent)
 *   W4 — Deprecated routes still missing audience annotation (coverage gap)
 *
 * Usage:
 *   pnpm --filter @nzila/union-eyes validate:route-policies
 *   tsx apps/union-eyes/scripts/validate-route-policies.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Registry shape (mirrors generate-route-registry output) ──────────────────

interface RegistryEntry {
  file: string;
  routePath: string;
  methods: string[];
  wrapper: string | null;
  governance: 'governed' | 'deprecated' | 'public' | 'cron' | 'ungoverned';
  authStrategy: { required: boolean; minRole: string | null };
  orgRequired: boolean | null;
  entitlement: string | null;
  tags: string[];
  registry: {
    audience: string | null;
    productionStatus: string | null;
    evidenceRequired: boolean | null;
    orgScoping: string | null;
    pilotEligible: boolean | null;
  };
}

interface RouteRegistry {
  generatedAt: string;
  summary: {
    totalRoutesWithExports: number;
    governed: number;
    deprecated: number;
    public: number;
    cron: number;
    ungoverned: number;
    coverage?: {
      audienceAnnotated: number;
      evidenceAnnotated: number;
      pilotAnnotated: number;
      audiencePct: number;
      evidencePct: number;
    };
  };
  routes: RegistryEntry[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REGISTRY_FILE = path.join(__dirname, '../reports/route-registry.json');

const SENSITIVE_AUDIENCES = new Set(['governance', 'admin', 'platform']);
const ADMIN_AUDIENCES = new Set(['admin', 'platform']);

// ── Warning accumulators ───────────────────────────────────────────────────────

interface Warning {
  code: string;
  routePath: string;
  detail: string;
}

const warnings: Warning[] = [];

function warn(code: string, routePath: string, detail: string): void {
  warnings.push({ code, routePath, detail });
}

// ── Checks ────────────────────────────────────────────────────────────────────

function checkW1EvidenceRequired(routes: RegistryEntry[]): void {
  for (const r of routes) {
    if (!r.registry.audience) continue;
    if (!SENSITIVE_AUDIENCES.has(r.registry.audience)) continue;
    if (r.registry.evidenceRequired === true) continue;
    warn(
      'W1',
      r.routePath,
      `audience='${r.registry.audience}' but evidenceRequired is not set to true — ` +
        `sensitive routes should emit audit evidence`,
    );
  }
}

function checkW2PlatformAdminOnlyConsistency(routes: RegistryEntry[]): void {
  for (const r of routes) {
    if (r.registry.orgScoping !== 'platform-admin-only') continue;
    if (!r.registry.audience) continue;
    if (ADMIN_AUDIENCES.has(r.registry.audience)) continue;
    warn(
      'W2',
      r.routePath,
      `orgScoping='platform-admin-only' but audience='${r.registry.audience}' — ` +
        `expected audience 'admin' or 'platform' for platform-admin-only routes`,
    );
  }
}

function checkW3PilotOnlyConsistency(routes: RegistryEntry[]): void {
  for (const r of routes) {
    if (r.registry.productionStatus !== 'pilot-only') continue;
    if (r.registry.pilotEligible === true) continue;
    if (r.registry.pilotEligible === null) continue; // not declared — acceptable
    warn(
      'W3',
      r.routePath,
      `productionStatus='pilot-only' but pilotEligible=false — ` +
        `pilot-only routes should declare pilotEligible: true`,
    );
  }
}

function checkW4DeprecatedAudienceGap(routes: RegistryEntry[]): void {
  for (const r of routes) {
    if (r.governance !== 'deprecated') continue;
    if (r.registry.audience !== null) continue;
    warn(
      'W4',
      r.routePath,
      `deprecated route has no audience annotation — ` +
        `add a registry.audience to enable policy enforcement during migration`,
    );
  }
}

// ── Coverage summary ──────────────────────────────────────────────────────────

function printCoverageSummary(registry: RouteRegistry): void {
  const routes = registry.routes;
  const total = routes.length;
  const audienceAnnotated = routes.filter((r) => r.registry.audience !== null).length;
  const evidenceAnnotated = routes.filter((r) => r.registry.evidenceRequired !== null).length;
  const pilotAnnotated = routes.filter((r) => r.registry.pilotEligible !== null).length;
  const govAudienced = routes.filter(
    (r) => r.registry.audience && SENSITIVE_AUDIENCES.has(r.registry.audience),
  ).length;
  const govWithEvidence = routes.filter(
    (r) =>
      r.registry.audience &&
      SENSITIVE_AUDIENCES.has(r.registry.audience) &&
      r.registry.evidenceRequired === true,
  ).length;

  const pct = (n: number, d: number) =>
    d > 0 ? `${Math.round((n / d) * 100)}%` : 'n/a';

  console.log('\n── Route Policy Coverage ────────────────────────────────────');
  console.log(`  Registry generated : ${registry.generatedAt}`);
  console.log(`  Total routes       : ${total}`);
  console.log(`  audience annotated : ${audienceAnnotated}/${total} (${pct(audienceAnnotated, total)})`);
  console.log(`  evidence annotated : ${evidenceAnnotated}/${total} (${pct(evidenceAnnotated, total)})`);
  console.log(`  pilot annotated    : ${pilotAnnotated}/${total} (${pct(pilotAnnotated, total)})`);
  console.log(`  sensitive + evidence covered: ${govWithEvidence}/${govAudienced} governance/admin/platform routes`);
  console.log('─────────────────────────────────────────────────────────────\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  if (!fs.existsSync(REGISTRY_FILE)) {
    console.error(
      `\n[validate-route-policies] Registry not found: ${REGISTRY_FILE}\n` +
        `Run 'pnpm --filter @nzila/union-eyes registry:generate' first.\n`,
    );
    process.exit(0); // advisory — not a hard failure
  }

  const registry: RouteRegistry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));

  checkW1EvidenceRequired(registry.routes);
  checkW2PlatformAdminOnlyConsistency(registry.routes);
  checkW3PilotOnlyConsistency(registry.routes);
  checkW4DeprecatedAudienceGap(registry.routes);

  printCoverageSummary(registry);

  if (warnings.length === 0) {
    console.log('[validate-route-policies] ✓ No policy consistency issues found.\n');
    process.exit(0);
  }

  // Group by warning code for readability
  const byCode: Record<string, Warning[]> = {};
  for (const w of warnings) {
    (byCode[w.code] ??= []).push(w);
  }

  console.log(`[validate-route-policies] ${warnings.length} advisory warning(s):\n`);

  const codeDescriptions: Record<string, string> = {
    W1: 'Sensitive audience routes missing evidenceRequired: true',
    W2: 'platform-admin-only orgScoping with non-admin audience',
    W3: 'pilot-only productionStatus with pilotEligible: false',
    W4: 'Deprecated routes without audience annotation',
  };

  for (const [code, items] of Object.entries(byCode)) {
    console.log(`  ${code} — ${codeDescriptions[code] ?? code} (${items.length})`);
    for (const w of items.slice(0, 5)) {
      console.log(`    • ${w.routePath}: ${w.detail}`);
    }
    if (items.length > 5) {
      console.log(`    … and ${items.length - 5} more`);
    }
    console.log();
  }

  console.log('[validate-route-policies] Advisory only — exit 0 (no CI failure).\n');
  console.log(
    'Incrementally add registry.evidenceRequired / registry.audience to governed routes to clear warnings.\n',
  );
  // Always exit 0 — advisory during rollout
  process.exit(0);
}

main();
