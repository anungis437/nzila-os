/**
 * scripts/rls-enforcement/census-111-declarations.ts
 *
 * Round 58D — deterministic re-run of the 111-declaration discovery
 * (mandate sections 17-19). For every physical pgTable(...) name found
 * anywhere in the repo (excluding .next build output) but NOT present in
 * the 700-entry storageAuthorityManifest, records:
 *   - physicalName
 *   - declaration path(s)
 *   - whether it's declared under db/schema/** (canonical main-app root)
 *   - whether it's declared under services/financial-service/** only
 *   - whether the SAME name is ALSO declared in the canonical db/schema/**
 *     tree (i.e. financial-service duplicates a table the main app already
 *     owns) vs a name that ONLY exists in financial-service
 *   - a v_*-prefix heuristic flag (likely a SQL VIEW, not a base table)
 *
 * This does not yet assign a final disposition (VIEW/DEAD/GENUINE/etc) —
 * that requires per-table judgment (see reports/union-eyes-authority-
 * enforcement-round58.md for the round 58D disposition table). This script
 * produces the deterministic INPUT to that judgment.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { storageAuthorityManifest } from "../../db/rls-storage-authority/index";

const REPO_ROOT = path.resolve(__dirname, "../..");

function walk(dir: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
}

function main() {
  const files: string[] = [];
  walk(REPO_ROOT, files);

  const declarations = new Map<string, string[]>(); // physicalName -> [relFilePaths]
  const pgTableRegex = /pgTable\(\s*["']([a-z0-9_]+)["']/g;

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    pgTableRegex.lastIndex = 0;
    while ((match = pgTableRegex.exec(content)) !== null) {
      const name = match[1];
      const rel = path.relative(REPO_ROOT, file).split(path.sep).join("/");
      const list = declarations.get(name) ?? [];
      if (!list.includes(rel)) list.push(rel);
      declarations.set(name, list);
    }
  }

  const manifestTables = new Set(storageAuthorityManifest.map((e) => e.table));
  const outside: Array<{
    physicalName: string;
    declarationPaths: string[];
    canonicalMainAppDeclaration: boolean;
    financialServiceOnlyDeclaration: boolean;
    duplicateAcrossBothRoots: boolean;
    likelyView: boolean;
  }> = [];

  for (const [name, paths] of declarations) {
    if (manifestTables.has(name)) continue;
    const inFinancialService = paths.some((p) => p.startsWith("services/financial-service/"));
    const inMainSchema = paths.some(
      (p) => p.startsWith("db/schema") || (p.startsWith("db/") && !p.startsWith("services/"))
    );
    outside.push({
      physicalName: name,
      declarationPaths: paths,
      canonicalMainAppDeclaration: inMainSchema,
      financialServiceOnlyDeclaration: inFinancialService && !inMainSchema,
      duplicateAcrossBothRoots: inFinancialService && inMainSchema,
      likelyView: name.startsWith("v_"),
    });
  }

  outside.sort((a, b) => a.physicalName.localeCompare(b.physicalName));

  console.log(`Total distinct pgTable declarations found: ${declarations.size}`);
  console.log(`Manifest entries: ${manifestTables.size}`);
  console.log(`Outside manifest: ${outside.length}`);
  console.log(`  financial-service-only: ${outside.filter((o) => o.financialServiceOnlyDeclaration).length}`);
  console.log(`  duplicate across both roots: ${outside.filter((o) => o.duplicateAcrossBothRoots).length}`);
  console.log(`  likely views (v_* prefix): ${outside.filter((o) => o.likelyView).length}`);
  console.log(`  other (neither financial-service nor main schema pattern): ${
    outside.filter((o) => !o.financialServiceOnlyDeclaration && !o.duplicateAcrossBothRoots && !o.canonicalMainAppDeclaration).length
  }`);

  fs.writeFileSync(
    path.join(REPO_ROOT, "reports/union-eyes-111-declaration-census.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), total: outside.length, declarations: outside }, null, 2) + "\n"
  );
  console.log("Written to reports/union-eyes-111-declaration-census.json");
}

main();
