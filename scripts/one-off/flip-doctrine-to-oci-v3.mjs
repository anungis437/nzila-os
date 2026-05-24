#!/usr/bin/env node
/**
 * v3 OCI doctrine flip — full union-eyes app surface.
 *
 * Same safe regex as v2 (preserves snake_case `institutional_memory`,
 * kebab-case `institutional-precedent`, PascalCase `InstitutionalContinuityProfile`,
 * camelCase `institutionalScale`, and import paths) but globs across:
 *   - apps/union-eyes/components/**\/*.{ts,tsx}
 *   - apps/union-eyes/lib/**\/*.{ts,tsx}
 *
 * Excludes:
 *   - Files under lib/institutional-*\/** (the directory name itself is
 *     identifier-shaped and the modules inside reference external package
 *     types like @nzila/institutional-cognition-core — keep their JSDoc on
 *     the same doctrine wording as the upstream package).
 *   - Migration / drizzle SQL files.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const ROOTS = [
  "apps/union-eyes/components",
  "apps/union-eyes/lib",
];

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  // Doctrine-bound on upstream package names — flipping in-place would
  // diverge from the imported types' wording.
  "institutional-cognition-core",
  "institutional-governance-graph",
]);

// Top-level lib dirs to skip entirely (they shadow external package names)
const SKIP_LIB_TOP = new Set([
  "institutional-observability",
  "institutional-topology",
  "institutional-narratives",
  "institutional-storytelling",
  "institutional-operating-intelligence",
]);

async function* walk(dir, depth = 0) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      if (depth === 0 && dir.endsWith(path.join("apps", "union-eyes", "lib")) && SKIP_LIB_TOP.has(entry.name)) continue;
      yield* walk(full, depth + 1);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      yield full;
    }
  }
}

const FR_FORMS = [
  ["institutionnelles", "organisationnelles"],
  ["Institutionnelles", "Organisationnelles"],
  ["institutionnels", "organisationnels"],
  ["Institutionnels", "Organisationnels"],
  ["institutionnelle", "organisationnelle"],
  ["Institutionnelle", "Organisationnelle"],
  ["institutionnel", "organisationnel"],
  ["Institutionnel", "Organisationnel"],
];

function flipProse(text) {
  let out = text;
  let n = 0;
  out = out.replace(
    /(?<![/.\-_])\b(Institutional|institutional|INSTITUTIONAL)\b(?![-_A-Z])/g,
    (m) => {
      n += 1;
      if (m === "Institutional") return "Organizational";
      if (m === "INSTITUTIONAL") return "ORGANIZATIONAL";
      return "organizational";
    }
  );
  for (const [from, to] of FR_FORMS) {
    const re = new RegExp(`(?<![/.\\-_])\\b${from}\\b(?![-_A-Z])`, "g");
    out = out.replace(re, () => {
      n += 1;
      return to;
    });
  }
  return { next: out, count: n };
}

let totalChanged = 0;
let totalFiles = 0;

for (const root of ROOTS) {
  const absRoot = path.join(REPO_ROOT, root);
  for await (const file of walk(absRoot)) {
    const before = await fs.readFile(file, "utf8");
    const { next, count } = flipProse(before);
    if (next === before) continue;
    await fs.writeFile(file, next, "utf8");
    const rel = path.relative(REPO_ROOT, file).replaceAll("\\", "/");
    console.log(`✓ ${rel} (${count})`);
    totalChanged += count;
    totalFiles += 1;
  }
}

console.log(`\nDone — ${totalChanged} prose flips across ${totalFiles} files.`);
