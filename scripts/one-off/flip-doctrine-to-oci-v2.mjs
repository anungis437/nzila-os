#!/usr/bin/env node
/**
 * v2 OCI doctrine flip — covers ALL marketing page/layout files.
 *
 * Flips the doctrinal ADJECTIVE only (preserves the noun "institution(s)"):
 *   EN: Institutional → Organizational  /  institutional → organizational
 *   FR: institutionnel(le)(s) → organisationnel(le)(s)
 *
 * Safe-guards to preserve identifiers, URL slugs, and import paths:
 *   - Lookbehind (?<![/\.\-_]) skips matches preceded by / . - _
 *     (catches `from '@/lib/institutional-legitimacy'`, `heroImagery.institutionalContinuity`)
 *   - Lookahead (?![-_A-Z]) skips matches followed by - _ or an uppercase letter
 *     (catches `institutional-continuity` URL slug, `institutionalContinuity` camelCase key)
 *   - \b boundaries already exclude `institutionalContinuity` (no boundary between letters)
 *     and `Institutionnelle` (the longer FR form still matches its own pattern below).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const MARKETING_ROOTS = [
  "apps/union-eyes/app/[locale]/(marketing)",
  "apps/union-eyes/app/(marketing)",
];

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && (entry.name === "page.tsx" || entry.name === "layout.tsx")) {
      yield full;
    }
  }
}

// Order matters: do the longest FR forms first so we don't partial-match shorter
// forms inside them.
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
  // English adjective
  out = out.replace(
    /(?<![/.\-_])\b(Institutional|institutional|INSTITUTIONAL)\b(?![-_A-Z])/g,
    (m) => {
      n += 1;
      if (m === "Institutional") return "Organizational";
      if (m === "INSTITUTIONAL") return "ORGANIZATIONAL";
      return "organizational";
    }
  );
  // French adjective forms
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

for (const root of MARKETING_ROOTS) {
  const absRoot = path.join(REPO_ROOT, root);
  for await (const file of walk(absRoot)) {
    const before = await fs.readFile(file, "utf8");
    const { next, count } = flipProse(before);
    if (next === before) continue;
    await fs.writeFile(file, next, "utf8");
    const rel = path.relative(REPO_ROOT, file).replaceAll("\\", "/");
    console.log(`✓ ${rel} (${count} prose flips)`);
    totalChanged += count;
    totalFiles += 1;
  }
}

console.log(`\nDone — ${totalChanged} prose flips across ${totalFiles} files.`);
