/**
 * Narrative-CI orchestrator for UnionEyes public marketing surfaces.
 *
 * Walks `app/[locale]/(marketing)/**` plus `messages/*.json`, runs the forbidden-
 * vocabulary check and all five rule modules, and produces:
 *  - A console summary (always).
 *  - JSON + markdown reports under `reports/narrative/` (always).
 *  - Exit code 1 in `--ci` mode if any hard-fail vocabulary violation is found
 *    on a public surface, or any rule reports `status: "fail"`.
 *
 * Usage:
 *   pnpm --filter @nzila/union-eyes narrative:audit
 *   pnpm --filter @nzila/union-eyes narrative:check   # --ci
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import fg from "fast-glob";

import { findViolations, PUBLIC_MESSAGES_NAMESPACES, type ForbiddenTerm } from "./config/forbidden-vocabulary";
import { narrativeBalanceRule } from "./rules/narrative-balance";
import { coexistencePositioningRule } from "./rules/coexistence-positioning";
import { proceduralNeutralityRule } from "./rules/procedural-neutrality";
import { labourSafeAiRule } from "./rules/labour-safe-ai";
import { canadianPositioningRule } from "./rules/canadian-positioning";
import { writeNarrativeReport } from "./reporting/generate-narrative-report";
import type { PageContext, RuleModule, RuleResult } from "./rules/types";

const APP_ROOT = path.resolve(__dirname, "..", "..");
// Public marketing surfaces only — explicitly enumerated to avoid scanning
// internal dashboards/admin/api routes under app/[locale]/.
const PUBLIC_MARKETING_ROUTES = [
  "", // root locale page
  "trust",
  "story",
  "governance",
  "contact",
  "pilot-request",
  // "case-studies", // hidden until pilots complete — re-add when CASE_STUDIES_VISIBLE flips true
  "pricing",
  "solutions",
  "status",
  "platform",
  "features",
  "executive-intelligence",
  "insights",
  // TODO(oci-routes): rename route dir to `organizational-continuity` + add
  // redirect from `/institutional-continuity`. Slug kept here to match the
  // actual on-disk path until that follow-up lands.
  "institutional-continuity",
  "conventions",
  "for-clc",
  "for-federations",
  "for-leadership",
  "for-members",
  "for-representatives",
  "proof",
];
const MARKETING_GLOBS = [
  "app/[[]locale[]]/page.tsx",
  "app/[[]locale[]]/layout.tsx",
  "app/[[]locale[]]/[(]marketing[)]/layout.tsx",
  "app/[[]locale[]]/[(]marketing[)]/page.tsx",
  ...PUBLIC_MARKETING_ROUTES.filter(Boolean).map(
    (r) => `app/[[]locale[]]/[(]marketing[)]/${r}/**/page.tsx`,
  ),
  ...PUBLIC_MARKETING_ROUTES.filter(Boolean).map(
    (r) => `app/[[]locale[]]/[(]marketing[)]/${r}/**/layout.tsx`,
  ),
  // Legacy fallback: top-level (marketing) and direct [locale] routes
  ...PUBLIC_MARKETING_ROUTES.filter(Boolean).map(
    (r) => `app/[[]locale[]]/${r}/**/page.tsx`,
  ),
  ...PUBLIC_MARKETING_ROUTES.filter(Boolean).map(
    (r) => `app/[[]locale[]]/${r}/**/layout.tsx`,
  ),
  "app/[(]marketing[)]/**/page.tsx",
  "app/[(]marketing[)]/**/layout.tsx",
];
const MESSAGES_GLOB = "messages/*.json";

// Wave 18 — Namespace-aware messages scoping.
// `PUBLIC_MESSAGES_NAMESPACES` is now exported from
// `./config/forbidden-vocabulary` so the marketing-vocabulary contract test
// can share the exact same allowlist. Update that file when adding new public
// marketing namespaces.

// Workstream B4 — internal runtime-narrative surfaces. Vocabulary-only sweep
// (no public-marketing rule modules). Keeps the organizational posture
// consistent inside dashboards, taxonomy files, and platform services.
const INTERNAL_NARRATIVE_GLOBS = [
  "app/[[]locale[]]/[(]dashboard[)]/**/page.tsx",
  "app/[[]locale[]]/[(]dashboard[)]/**/layout.tsx",
  // Workstream F: priority dashboard routes live under the plain `dashboard/` segment
  // (not the `(dashboard)` route group). Sweep them explicitly so internal runtime
  // copy stays aligned with the organizational continuity ontology.
  "app/[[]locale[]]/dashboard/governance-center/**/page.tsx",
  "app/[[]locale[]]/dashboard/continuity-intelligence/**/page.tsx",
  "app/[[]locale[]]/dashboard/continuity-planning/**/page.tsx",
  "app/[[]locale[]]/dashboard/continuity-simulation/**/page.tsx",
  "app/[[]locale[]]/dashboard/longitudinal-cognition/**/page.tsx",
  "app/[[]locale[]]/dashboard/executive-operating-intelligence/**/page.tsx",
  // TODO(oci-routes): rename dashboard dirs to organizational-* + add
  // redirects. Globs kept on the actual on-disk paths so the internal
  // narrative sweep continues to scan them.
  "app/[[]locale[]]/dashboard/institutional-memory/**/page.tsx",
  // Workstream G: organizational observability surfaces.
  "app/[[]locale[]]/dashboard/institutional-observability/**/page.tsx",
  "app/[[]locale[]]/dashboard/institutional-observability/**/layout.tsx",
  "lib/dashboard/role-experience.ts",
  "lib/dashboard/**/labels.ts",
  "services/platform-economics/entitlement-guard.ts",
];

const RULES: RuleModule[] = [
  narrativeBalanceRule,
  coexistencePositioningRule,
  proceduralNeutralityRule,
  labourSafeAiRule,
  canadianPositioningRule,
];

const RULE_WEIGHTS: Record<string, number> = {
  "narrative-balance": 0.25,
  "coexistence-positioning": 0.2,
  "procedural-neutrality": 0.2,
  "labour-safe-ai": 0.2,
  "canadian-positioning": 0.15,
};

export interface FileAuditResult {
  ctx: PageContext;
  violations: Array<{ term: ForbiddenTerm; line: number; excerpt: string }>;
  ruleResults: RuleResult[];
  maturity: number;
}

export interface AuditReport {
  generatedAt: string;
  files: FileAuditResult[];
  summary: {
    totalFiles: number;
    publicFiles: number;
    hardFails: number;
    warnings: number;
    ruleFailures: number;
    averageMaturity: number;
  };
}

function maturityFor(results: RuleResult[]): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const r of results) {
    const w = RULE_WEIGHTS[r.rule] ?? 0.1;
    weighted += r.score * w;
    totalWeight += w;
  }
  if (totalWeight === 0) return 0;
  return Math.round(weighted / totalWeight);
}

function labelFor(rel: string): string {
  const m = rel.match(/\(marketing\)\/(.+?)\/(?:page|layout)\.tsx$/);
  if (m) return `marketing/${m[1]}`;
  const loc = rel.match(/\[locale\]\/(.+?)\/(?:page|layout)\.tsx$/);
  if (loc) return `locale/${loc[1]}`;
  if (rel.startsWith("messages/")) return rel;
  return rel.replace(/\\/g, "/");
}

async function readSurface(absPath: string): Promise<string> {
  return fs.readFile(absPath, "utf8");
}

async function collectFiles(): Promise<string[]> {
  const marketing = await fg(MARKETING_GLOBS, {
    cwd: APP_ROOT,
    absolute: true,
    dot: false,
  });
  const messages = await fg(MESSAGES_GLOB, {
    cwd: APP_ROOT,
    absolute: true,
    dot: false,
  });
  return [...marketing, ...messages].sort();
}

async function collectInternalFiles(): Promise<string[]> {
  return (
    await fg(INTERNAL_NARRATIVE_GLOBS, {
      cwd: APP_ROOT,
      absolute: true,
      dot: false,
    })
  ).sort();
}

export async function runAudit(): Promise<AuditReport> {
  const files = await collectFiles();
  const out: FileAuditResult[] = [];

  for (const abs of files) {
    const rel = path.relative(APP_ROOT, abs).replace(/\\/g, "/");
    const isMessages = rel.startsWith("messages/");
    const ctx: PageContext = {
      path: rel,
      isPublicSurface: true,
      label: labelFor(rel),
      ...(isMessages
        ? { locale: path.basename(rel, ".json") }
        : (() => {
            const m = rel.match(/app\/\[locale\]\/\(marketing\)/);
            return m ? {} : {};
          })()),
    };

    const content = await readSurface(abs);
    const violations = findViolations(content, {
      isPublicSurface: true,
      ...(isMessages
        ? { publicMessagesNamespaces: PUBLIC_MESSAGES_NAMESPACES }
        : {}),
    });
    const ruleResults = RULES.map((r) => r.evaluate(content, ctx));
    out.push({
      ctx,
      violations,
      ruleResults,
      maturity: maturityFor(ruleResults),
    });
  }

  // Workstream B4 — internal narrative pass: vocabulary check only, no rule
  // modules (those target public-marketing tone). Surfaces are flagged
  // isPublicSurface=false so the future warning/hard-fail switch in
  // procedural-neutrality etc. continues to behave correctly.
  const internalFiles = await collectInternalFiles();
  for (const abs of internalFiles) {
    const rel = path.relative(APP_ROOT, abs).replace(/\\/g, "/");
    const ctx: PageContext = {
      path: rel,
      isPublicSurface: false,
      label: `internal/${rel}`,
    };
    const content = await readSurface(abs);
    const violations = findViolations(content, { isPublicSurface: false });
    out.push({
      ctx,
      violations,
      ruleResults: [],
      maturity: 0,
    });
  }

  const hardFails = out.reduce(
    (n, f) => n + f.violations.filter((v) => v.term.severity === "hard-fail").length,
    0,
  );
  const warnings = out.reduce(
    (n, f) => n + f.violations.filter((v) => v.term.severity === "warning").length,
    0,
  );
  const ruleFailures = out.reduce(
    (n, f) => n + f.ruleResults.filter((r) => r.status === "fail").length,
    0,
  );
  const averageMaturity = (() => {
    // Maturity is only meaningful for files actually scored by rule modules
    // (public marketing surfaces). Internal narrative surfaces are vocabulary-
    // checked only — they always carry maturity = 0 and would otherwise
    // dilute the average as the internal sweep grows.
    const scored = out.filter((f) => f.ruleResults.length > 0);
    if (scored.length === 0) return 0;
    return Math.round(scored.reduce((n, f) => n + f.maturity, 0) / scored.length);
  })();

  const publicFiles = out.filter((f) => f.ctx.isPublicSurface).length;

  return {
    generatedAt: new Date().toISOString(),
    files: out,
    summary: {
      totalFiles: out.length,
      publicFiles,
      hardFails,
      warnings,
      ruleFailures,
      averageMaturity,
    },
  };
}

function printSummary(report: AuditReport): void {
  const { summary } = report;
  // eslint-disable-next-line no-console
  console.log("\nUnionEyes — Narrative CI Audit");
  // eslint-disable-next-line no-console
  console.log("=".repeat(60));
  // eslint-disable-next-line no-console
  console.log(`Files scanned        : ${summary.totalFiles}`);
  // eslint-disable-next-line no-console
  console.log(`Hard-fail violations : ${summary.hardFails}`);
  // eslint-disable-next-line no-console
  console.log(`Warning violations   : ${summary.warnings}`);
  // eslint-disable-next-line no-console
  console.log(`Rule failures        : ${summary.ruleFailures}`);
  // eslint-disable-next-line no-console
  console.log(`Organizational Maturity (avg) : ${summary.averageMaturity}/100`);

  if (summary.hardFails > 0) {
    // eslint-disable-next-line no-console
    console.log("\nHard-fail violations:");
    for (const f of report.files) {
      const hf = f.violations.filter((v) => v.term.severity === "hard-fail");
      if (hf.length === 0) continue;
      // eslint-disable-next-line no-console
      console.log(`  ${f.ctx.label} (${f.ctx.path})`);
      for (const v of hf) {
        // eslint-disable-next-line no-console
        console.log(`    L${v.line}  [${v.term.category}] "${v.term.term}"`);
      }
    }
  }
}

async function main(): Promise<void> {
  const ci = process.argv.includes("--ci");
  const report = await runAudit();
  await writeNarrativeReport(report, path.resolve(APP_ROOT, "reports", "narrative"));
  printSummary(report);

  if (ci && (report.summary.hardFails > 0 || report.summary.ruleFailures > 0)) {
    // eslint-disable-next-line no-console
    console.error(
      `\nNarrative CI failed: ${report.summary.hardFails} hard-fail violations, ${report.summary.ruleFailures} rule failures.`,
    );
    process.exit(1);
  }
}

// Execute when run as a script (works under tsx).
if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(2);
  });
}
