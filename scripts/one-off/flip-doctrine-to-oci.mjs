#!/usr/bin/env node
/**
 * Flip "institutional" → "organizational" across the marketing narrative
 * tooling and JSDoc Positioning Manifests. Preserves the underlying
 * anti-surveillance / anti-scoring / continuity-first doctrine — only the
 * doctrinal noun is renamed in line with the Organizational Continuity
 * Infrastructure (OCI) whitepaper.
 *
 * Scope:
 *   - apps/union-eyes/tooling/marketing/**\/*.ts
 *   - apps/union-eyes/app/**\/*.tsx (JSDoc header blocks only; the body of
 *     these files was already covered by the prior rename pass + i18n flip)
 *
 * Case-preserving:
 *   - "Institutional" → "Organizational"
 *   - "institutional" → "organizational"
 *   - "INSTITUTIONAL" → "ORGANIZATIONAL"
 *
 * URL paths, identifier-hyphenated tokens, and file paths are preserved by
 * the same regex pattern used by the forbidden-vocabulary scanner. We use a
 * simple word-boundary match here because we're rewriting source code, not
 * scanning prose.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const TARGETS = [
  // Marketing narrative tooling
  "apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts",
  "apps/union-eyes/tooling/marketing/config/required-vocabulary.ts",
  "apps/union-eyes/tooling/marketing/narrative-audit.ts",
  "apps/union-eyes/tooling/marketing/reporting/generate-narrative-report.ts",
  "apps/union-eyes/tooling/marketing/rules/canadian-positioning.ts",
  "apps/union-eyes/tooling/marketing/rules/coexistence-positioning.ts",
  "apps/union-eyes/tooling/marketing/rules/labour-safe-ai.ts",
  "apps/union-eyes/tooling/marketing/rules/narrative-balance.ts",
  "apps/union-eyes/tooling/marketing/rules/procedural-neutrality.ts",
];

// JSDoc Positioning Manifest headers — discovered by grep
const JSDOC_FILES = [
  "apps/union-eyes/app/[locale]/layout.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/trust/page.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/story/page.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/status/page.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/solutions/technology-leadership/page.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/solutions/procurement/page.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/solutions/page.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/solutions/operations-leadership/page.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/solutions/labour-leadership/page.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/solutions/governance-leadership/page.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/solutions/executive-leadership/page.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/proof/page.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/pricing/page.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/platform/page.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/platform/organizational-memory/page.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/platform/operational-coherence/page.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/platform/governance-intelligence/page.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/platform/explainable-intelligence/page.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/pilot-request/page.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/legal/terms/page.tsx",
  "apps/union-eyes/app/[locale]/(marketing)/legal/security/page.tsx",
  "apps/union-eyes/app/(marketing)/case-studies/[slug]/page.tsx",
  "apps/union-eyes/app/(marketing)/case-studies/page.tsx",
  "apps/union-eyes/app/(marketing)/page.tsx",
  "apps/union-eyes/app/(marketing)/layout.tsx",
  "apps/union-eyes/app/(marketing)/[...slug]/page.tsx",
];

function flipCasePreserving(text) {
  return text
    .replace(/Institutional/g, "Organizational")
    .replace(/INSTITUTIONAL/g, "ORGANIZATIONAL")
    .replace(/institutional/g, "organizational");
}

// For JSDoc files, restrict transform to the leading block-comment region
// (between /** and the first */) so we never touch runtime identifiers,
// route segments, or i18n keys further down the file.
function flipJsdocHeader(text) {
  const match = text.match(/^(\/\*\*[\s\S]*?\*\/\s*)/);
  if (!match) return { changed: false, next: text };
  const header = match[1];
  const flipped = flipCasePreserving(header);
  if (flipped === header) return { changed: false, next: text };
  return { changed: true, next: flipped + text.slice(header.length) };
}

let totalChanged = 0;
let totalFiles = 0;

for (const rel of TARGETS) {
  const abs = path.join(REPO_ROOT, rel);
  try {
    const before = await fs.readFile(abs, "utf8");
    const after = flipCasePreserving(before);
    if (after === before) {
      console.log(`= ${rel} (no change)`);
      continue;
    }
    const diff = (before.match(/institutional/gi) || []).length;
    await fs.writeFile(abs, after, "utf8");
    console.log(`✓ ${rel} (${diff} replacements)`);
    totalChanged += diff;
    totalFiles += 1;
  } catch (err) {
    console.error(`✗ ${rel}: ${err.message}`);
  }
}

console.log("\n--- JSDoc Positioning Manifest headers ---\n");

for (const rel of JSDOC_FILES) {
  const abs = path.join(REPO_ROOT, rel);
  try {
    const before = await fs.readFile(abs, "utf8");
    const { changed, next } = flipJsdocHeader(before);
    if (!changed) {
      console.log(`= ${rel} (no header change)`);
      continue;
    }
    const headerLen = before.indexOf("*/") + 2;
    const headerSlice = before.slice(0, headerLen);
    const diff = (headerSlice.match(/institutional/gi) || []).length;
    await fs.writeFile(abs, next, "utf8");
    console.log(`✓ ${rel} (${diff} header replacements)`);
    totalChanged += diff;
    totalFiles += 1;
  } catch (err) {
    console.error(`✗ ${rel}: ${err.message}`);
  }
}

console.log(`\nDone — ${totalChanged} replacements across ${totalFiles} files.`);
