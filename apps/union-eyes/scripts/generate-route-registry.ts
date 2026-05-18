#!/usr/bin/env tsx
/**
 * generate-route-registry.ts
 *
 * Generates a governed route inventory from static analysis of all
 * apps/union-eyes/app/api/** /route.ts files.
 *
 * Output: apps/union-eyes/reports/route-registry.json
 *
 * The registry captures:
 *   - route path
 *   - HTTP methods exported
 *   - auth wrapper type (governed/deprecated/public/cron/ungoverned)
 *   - auth strategy (extracted from withApi options where readable)
 *   - org-scoping (detected from requireOrg / withOrganizationAuth usage)
 *   - entitlement (extracted from withApi entitlement field where readable)
 *   - OpenAPI tags (extracted where present)
 *   - governance registry metadata (from registry: { ... } field if present)
 *
 * This file is a governance artifact and should be committed.
 * Regenerate after adding or modifying API routes.
 *
 * Usage:
 *   pnpm --filter @nzila/union-eyes registry:generate
 *   tsx apps/union-eyes/scripts/generate-route-registry.ts
 */

import * as fs from "fs";
import * as path from "path";

// ── Configuration ─────────────────────────────────────────────────────────

const APP_API_DIR = path.join(__dirname, "../app/api");
const OUTPUT_FILE = path.join(__dirname, "../reports/route-registry.json");

const APPROVED_WRAPPERS = [
  "withApi(",
  "crudRoutes(",
  "withOrganizationAuth(",
  "createCronHandler(",
  "cognitionRoute(",
];
const DEPRECATED_WRAPPERS = [
  "withRoleAuth(",
  "withMinRole(",
  "withApiAuth(",
  "withAdminAuth(",
];
const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] as const;

const PUBLIC_PREFIXES = [
  "/api/health",
  "/api/status",
  "/api/docs",
  "/api/webhooks",
  "/api/signatures/webhooks",
  "/api/integrations/shopify/webhooks",
  "/api/payments/webhooks",
  "/api/whop/webhooks",
  "/api/whop/unauthenticated-checkout",
  "/api/auth",
  "/api/communications/track",
  "/api/communications/unsubscribe",
  "/api/gdpr/cookie-consent",
];

const CRON_PREFIXES = ["/api/cron", "/api/rewards/cron"];

// ── Utilities ─────────────────────────────────────────────────────────────

function walkDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) out.push(...walkDir(full));
    else if (entry === "route.ts" || entry === "route.tsx") out.push(full);
  }
  return out;
}

function routePathFromFile(filePath: string): string {
  const norm = filePath.replace(/\\/g, "/");
  const match = norm.match(/app\/api\/(.+?)\/route\.tsx?$/);
  return match ? `/api/${match[1]}` : filePath;
}

function exportedMethods(content: string): string[] {
  const methods: string[] = [];
  for (const m of HTTP_METHODS) {
    const direct = new RegExp(`export\\s+const\\s+${m}\\s*=`, "m").test(content);
    const reExport = new RegExp(`export\\s*\\{[^}]*\\b${m}\\b[^}]*\\}`, "m").test(content);
    if (direct || reExport) methods.push(m);
  }
  return methods;
}

type WrapperType = "governed" | "deprecated" | "public" | "cron" | "ungoverned";

function wrapperType(content: string, routePath: string): WrapperType {
  if (PUBLIC_PREFIXES.some((p) => routePath.startsWith(p))) return "public";
  if (CRON_PREFIXES.some((p) => routePath.startsWith(p))) return "cron";
  if (APPROVED_WRAPPERS.some((p) => content.includes(p))) return "governed";
  if (DEPRECATED_WRAPPERS.some((p) => content.includes(p))) return "deprecated";
  return "ungoverned";
}

/** Extract the primary approved wrapper name, if any. */
function primaryWrapper(content: string): string | null {
  if (content.includes("withApi(")) return "withApi";
  if (content.includes("crudRoutes(")) return "crudRoutes";
  if (content.includes("createCronHandler(")) return "createCronHandler";
  if (content.includes("withOrganizationAuth(")) return "withOrganizationAuth";
  if (content.includes("withMinRole(")) return "withMinRole";
  if (content.includes("withRoleAuth(")) return "withRoleAuth";
  return null;
}

/** Attempt to extract minRole value from withApi options via regex. */
function extractMinRole(content: string): string | null {
  const match = content.match(/minRole:\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

/** Attempt to extract auth.required: false (marks public-within-wrapper). */
function isAuthOptional(content: string): boolean {
  return /auth:\s*\{[^}]*required:\s*false/.test(content);
}

/** Check if requireOrg is explicitly set to false. */
function isOrgRequired(content: string): boolean | null {
  if (/requireOrg:\s*false/.test(content)) return false;
  if (/requireOrg:\s*true/.test(content)) return true;
  if (content.includes("withOrganizationAuth(")) return true;
  return null; // not declared — defaulted by withApi
}

/** Extract first openapi.tags value. */
function extractTags(content: string): string[] {
  const match = content.match(/tags:\s*\[([^\]]+)\]/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((t) => t.replace(/['"]/g, "").trim())
    .filter(Boolean);
}

/** Extract entitlement value. */
function extractEntitlement(content: string): string | null {
  const match = content.match(/entitlement:\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

/** Extract audience from registry field. */
function extractAudience(content: string): string | null {
  const match = content.match(/audience:\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

/** Extract productionStatus from registry field. */
function extractProductionStatus(content: string): string | null {
  const match = content.match(/productionStatus:\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

/** Extract evidenceRequired from registry field. */
function extractEvidenceRequired(content: string): boolean | null {
  const inRegistry = content.match(/registry\s*:\s*\{[^}]*evidenceRequired\s*:\s*(true|false)/);
  if (inRegistry) return inRegistry[1] === 'true';
  return null;
}

/** Extract orgScoping from registry field. */
function extractOrgScoping(content: string): string | null {
  const match = content.match(/orgScoping:\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

/** Extract pilotEligible from registry field. */
function extractPilotEligible(content: string): boolean | null {
  const inRegistry = content.match(/registry\s*:\s*\{[^}]*pilotEligible\s*:\s*(true|false)/);
  if (inRegistry) return inRegistry[1] === 'true';
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────

interface RegistryEntry {
  file: string;
  routePath: string;
  methods: string[];
  wrapper: string | null;
  governance: WrapperType;
  authStrategy: {
    required: boolean;
    minRole: string | null;
  };
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

function main(): void {
  const routeFiles = walkDir(APP_API_DIR);

  const entries: RegistryEntry[] = [];

  for (const filePath of routeFiles) {
    const content = fs.readFileSync(filePath, "utf-8");
    const methods = exportedMethods(content);
    if (methods.length === 0) continue;

    const routePath = routePathFromFile(filePath);
    const relFile = path
      .relative(path.join(__dirname, ".."), filePath)
      .replace(/\\/g, "/");

    entries.push({
      file: relFile,
      routePath,
      methods,
      wrapper: primaryWrapper(content),
      governance: wrapperType(content, routePath),
      authStrategy: {
        required: !isAuthOptional(content),
        minRole: extractMinRole(content),
      },
      orgRequired: isOrgRequired(content),
      entitlement: extractEntitlement(content),
      tags: extractTags(content),
      registry: {
        audience: extractAudience(content),
        productionStatus: extractProductionStatus(content),
        evidenceRequired: extractEvidenceRequired(content),
        orgScoping: extractOrgScoping(content),
        pilotEligible: extractPilotEligible(content),
      },
    });
  }

  // Sort by route path for stable diff
  entries.sort((a, b) => a.routePath.localeCompare(b.routePath));

  const governed = entries.filter((e) => e.governance === "governed").length;
  const deprecated = entries.filter((e) => e.governance === "deprecated").length;
  const publicCount = entries.filter((e) => e.governance === "public").length;
  const cronCount = entries.filter((e) => e.governance === "cron").length;
  const ungoverned = entries.filter((e) => e.governance === "ungoverned").length;
  const audienceAnnotated = entries.filter((e) => e.registry.audience !== null).length;
  const evidenceAnnotated = entries.filter((e) => e.registry.evidenceRequired !== null).length;
  const pilotAnnotated = entries.filter((e) => e.registry.pilotEligible !== null).length;

  const report = {
    generatedAt: new Date().toISOString(),
    generatedBy: "scripts/generate-route-registry.ts",
    repository: "anungis437/nzila-os",
    app: "@nzila/union-eyes",
    summary: {
      totalRouteFiles: routeFiles.length,
      totalRoutesWithExports: entries.length,
      governed,
      deprecated,
      public: publicCount,
      cron: cronCount,
      ungoverned,
      coverage: {
        audienceAnnotated,
        evidenceAnnotated,
        pilotAnnotated,
        audiencePct: entries.length > 0 ? Math.round((audienceAnnotated / entries.length) * 100) : 0,
        evidencePct: entries.length > 0 ? Math.round((evidenceAnnotated / entries.length) * 100) : 0,
      },
    },
    routes: entries,
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2) + "\n");

  console.log(`\n── Route Registry Generated ─────────────────────────────────`);
  console.log(`  Output   : ${path.relative(process.cwd(), OUTPUT_FILE)}`);
  console.log(`  Total    : ${entries.length} routes`);
  console.log(`  governed : ${governed}`);
  console.log(`  deprecated (warn): ${deprecated}`);
  console.log(`  public   : ${publicCount}`);
  console.log(`  cron     : ${cronCount}`);
  if (ungoverned > 0) {
    console.log(`  ✗ UNGOVERNED: ${ungoverned}`);
  }
  console.log(`  Registry coverage:`);
  console.log(`    audience:         ${audienceAnnotated}/${entries.length} (${Math.round((audienceAnnotated / entries.length) * 100)}%)`);
  console.log(`    evidenceRequired: ${evidenceAnnotated}/${entries.length} (${Math.round((evidenceAnnotated / entries.length) * 100)}%)`);
  console.log(`    pilotEligible:    ${pilotAnnotated}/${entries.length} (${Math.round((pilotAnnotated / entries.length) * 100)}%)`);
  console.log(`──────────────────────────────────────────────────────────────\n`);
}

main();
