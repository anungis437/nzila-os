#!/usr/bin/env tsx
/**
 * validate-api-governance.ts
 *
 * Scans all apps/union-eyes/app/api/** /route.ts files and validates that every
 * exported HTTP method handler is wrapped with an approved auth wrapper or is
 * explicitly registered as a public/cron route.
 *
 * Exit codes:
 *   0 — all routes are governed
 *   1 — ungoverned routes found
 *
 * Usage:
 *   pnpm --filter @nzila/union-eyes validate:api-governance
 *   tsx apps/union-eyes/scripts/validate-api-governance.ts
 *
 * Governance classification:
 *   governed   — uses withApi(), crudRoutes(), withOrganizationAuth(), createCronHandler()
 *   deprecated — uses withRoleAuth() or withMinRole() (still governed, but needs migration)
 *   public     — route path is explicitly listed in public-routes.ts allowlist
 *   cron       — route path is in the CRON_API_ROUTES set (auth via cron secret)
 *   UNGOVERNED — none of the above (CI FAIL)
 */

import * as fs from "fs";
import * as path from "path";
import { isPublicRoute, isCronRoute } from "../lib/public-routes";

// ── Configuration ─────────────────────────────────────────────────────────

const APP_DIR = path.join(__dirname, "../app/api");

/** Wrappers that represent modern, approved auth governance. */
const APPROVED_WRAPPER_PATTERNS = [
  "withApi(",
  "crudRoutes(",
  "withOrganizationAuth(",
  "createCronHandler(",
  // cognitionRoute is a domain-specific factory that internally calls withApi()
  "cognitionRoute(",
];

/**
 * Wrappers that are still functional but deprecated — warn, don't fail.
 * These should be migrated to withApi() over time.
 */
const DEPRECATED_WRAPPER_PATTERNS = [
  "withRoleAuth(",
  "withMinRole(",
  // withApiAuth / withAdminAuth are legacy wrappers from lib/api-auth-guard — migrate to withApi()
  "withApiAuth(",
  "withAdminAuth(",
];

/** HTTP method names that are legal Next.js route exports. */
const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"] as const;

// ── Utilities ─────────────────────────────────────────────────────────────

function walkDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkDir(full));
    } else if (entry === "route.ts" || entry === "route.tsx") {
      results.push(full);
    }
  }
  return results;
}

/** Derive /api/... route path from an absolute file path. */
function routePathFromFile(filePath: string): string {
  // Normalize to forward slashes for consistent matching
  const normalized = filePath.replace(/\\/g, "/");
  const match = normalized.match(/app\/api\/(.+?)\/route\.tsx?$/);
  if (!match) return filePath;
  // Remove Next.js dynamic segment brackets for path matching purposes
  const routeSegment = match[1].replace(/\[.*?\]/g, "*");
  return `/api/${routeSegment}`;
}

/** Check if the file exports any HTTP method handler. */
function hasExportedMethods(content: string): boolean {
  // Direct export: export const GET = ...
  const directExportPattern = new RegExp(
    `export\\s+const\\s+(${HTTP_METHODS.join("|")})\\s*=`,
    "m"
  );
  if (directExportPattern.test(content)) return true;

  // Re-export: export { GET, POST }
  const reExportPattern = new RegExp(
    `export\\s*\\{[^}]*(${HTTP_METHODS.join("|")})[^}]*\\}`,
    "m"
  );
  return reExportPattern.test(content);
}

/** Detect which governance classification applies to this file. */
function classifyRoute(
  content: string,
  routePath: string
): "governed" | "deprecated" | "public" | "cron" | "ungoverned" {
  if (isPublicRoute(routePath)) return "public";
  if (isCronRoute(routePath)) return "cron";

  const usesApproved = APPROVED_WRAPPER_PATTERNS.some((p) => content.includes(p));
  if (usesApproved) return "governed";

  const usesDeprecated = DEPRECATED_WRAPPER_PATTERNS.some((p) => content.includes(p));
  if (usesDeprecated) return "deprecated";

  return "ungoverned";
}

// ── Main ──────────────────────────────────────────────────────────────────

interface RouteResult {
  file: string;
  routePath: string;
  classification: "governed" | "deprecated" | "public" | "cron" | "ungoverned";
}

function main(): void {
  const routeFiles = walkDir(APP_DIR);

  const results: RouteResult[] = [];
  const ungoverned: RouteResult[] = [];
  const deprecated: RouteResult[] = [];

  for (const filePath of routeFiles) {
    const content = fs.readFileSync(filePath, "utf-8");

    if (!hasExportedMethods(content)) continue;

    const routePath = routePathFromFile(filePath);
    const classification = classifyRoute(content, routePath);

    const relFile = path.relative(path.join(__dirname, ".."), filePath).replace(/\\/g, "/");
    const result: RouteResult = { file: relFile, routePath, classification };
    results.push(result);

    if (classification === "ungoverned") ungoverned.push(result);
    if (classification === "deprecated") deprecated.push(result);
  }

  const counts = {
    total: results.length,
    governed: results.filter((r) => r.classification === "governed").length,
    deprecated: deprecated.length,
    public: results.filter((r) => r.classification === "public").length,
    cron: results.filter((r) => r.classification === "cron").length,
    ungoverned: ungoverned.length,
  };

  console.log("\n── API Governance Audit ──────────────────────────────────────");
  console.log(`  Total route files scanned : ${routeFiles.length}`);
  console.log(`  Files with HTTP exports   : ${results.length}`);
  console.log(`  ✓ governed (withApi etc.) : ${counts.governed}`);
  console.log(`  ✓ public (allowlisted)    : ${counts.public}`);
  console.log(`  ✓ cron (secret-gated)     : ${counts.cron}`);
  console.log(`  ⚠ deprecated wrappers    : ${counts.deprecated}`);
  console.log(`  ✗ UNGOVERNED              : ${counts.ungoverned}`);
  console.log("──────────────────────────────────────────────────────────────\n");

  if (deprecated.length > 0) {
    console.warn("⚠  Deprecated wrapper usage (migrate to withApi):");
    for (const r of deprecated) {
      console.warn(`     ${r.file}`);
    }
    console.warn("");
  }

  if (ungoverned.length > 0) {
    console.error("✗  UNGOVERNED routes (each must use an approved auth wrapper or");
    console.error("   be registered in lib/public-routes.ts):\n");
    for (const r of ungoverned) {
      console.error(`     ${r.file}`);
      console.error(`       route: ${r.routePath}`);
    }
    console.error(
      "\n  Fix: wrap the handler with withApi(), add to PUBLIC_API_ROUTES,\n" +
        "  or add to CRON_API_ROUTES if it is a cron endpoint.\n"
    );
    process.exit(1);
  }

  console.log("✓  All API routes are governed.\n");
}

main();
