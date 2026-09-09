/**
 * scripts/rls-enforcement/__tests__/supabase-purge-ratchet.test.ts
 *
 * Round 58D — Supabase purge regression ratchet (mandate sections 6, 39,
 * 72). Fails if Union Eyes runtime/deployment code reintroduces a Supabase
 * runtime dependency. Scoped to apps/union-eyes/** only — this is not a
 * repo-wide ban across unrelated Nzila products.
 *
 * Historical/comparative references are explicitly allowlisted below
 * (accurate "NOT Supabase" clarifications, generic Postgres-compatibility
 * notes, manifest audit-trail text, and this repo's own negative e2e test
 * asserting no supabase.co URL ever leaks in a response) — this ratchet
 * targets NEW runtime/deployment dependencies, not historical accuracy.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const APP_ROOT = path.resolve(__dirname, "../../..");

// Files allowed to mention "supabase" (case-insensitive) — all previously
// reviewed as accurate historical/comparative/negative-test content, never
// a live runtime dependency. Adding a new entry here requires the same
// review this round applied: confirm it is not a real, current Supabase
// runtime/deployment dependency.
const ALLOWLIST = new Set([
  "db/queries/organization-queries.ts",
  "db/rls-storage-authority/finance.ts",
  "db/rls-storage-authority/reference-latent.ts",
  "db/schema/domains/member/profiles.ts",
  "db/schema/profiles-schema.ts",
  "lib/database/multi-db-client.ts",
  "lib/documents/batch-operations-service.ts",
  "tests/e2e/evidence-misuse.spec.ts",
  "reports/union-eyes-canonical-database-topology-round58d.json",
  "reports/union-eyes-canonical-database-topology-round58d.md",
]);

const FORBIDDEN_RUNTIME_PATTERNS = [
  "@supabase/",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

function walk(dir: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (
      /\.(ts|tsx|js|jsx|json|md|env|env\.example)$/.test(entry.name) &&
      full !== __filename
    ) {
      out.push(full);
    }
  }
}

describe("Round 58D Supabase purge ratchet (apps/union-eyes/** only)", () => {
  const files: string[] = [];
  walk(APP_ROOT, files);

  it("no non-allowlisted file contains a forbidden Supabase runtime/deployment pattern", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = path.relative(APP_ROOT, file).split(path.sep).join("/");
      if (ALLOWLIST.has(rel)) continue;
      const content = fs.readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
        if (content.includes(pattern)) {
          offenders.push(`${rel}: contains "${pattern}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("apps/union-eyes/package.json has no @supabase/* production dependency", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(APP_ROOT, "package.json"), "utf8"));
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    const supabaseDeps = Object.keys(deps).filter((d) => d.startsWith("@supabase/"));
    expect(supabaseDeps).toEqual([]);
  });

  it("services/financial-service/package.json has no @supabase/* dependency", () => {
    const pkgPath = path.join(APP_ROOT, "services/financial-service/package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    const supabaseDeps = Object.keys(deps).filter((d) => d.startsWith("@supabase/"));
    expect(supabaseDeps).toEqual([]);
  });
});
