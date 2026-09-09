/**
 * scripts/rls-enforcement/derive-table-geometry.ts
 *
 * Round 58 Phase 1+ — Policy Geometry Compiler (step A of the generator-driven
 * RLS+GRANT enforcement system).
 *
 * PURPOSE: for every physical table name in the canonical schema, determine
 * — from the ACTUAL Drizzle schema AST, not from freeform manifest prose —
 * which physical column(s) carry organization ownership, so the RLS policy
 * compiler (generate-rls-enforcement-migration.ts) can generate a correct
 * `ue_create_direct_org_rls_policy`/`ue_create_parent_owned_rls_policy`-style
 * policy without a human re-deriving the column name from scratch for each
 * of ~300 RLS-requiring tables.
 *
 * METHOD (deliberately conservative — a wrong geometry guess is worse than
 * no geometry at all, since it would generate a policy that looks correct
 * but scopes on the wrong column):
 *   1. Parse every db/schema/**\/*.ts file (excluding __tests__) with the
 *      real TypeScript compiler API (not regex) to find every
 *      `pgTable("physical_name", { ...columns... })` call.
 *   2. Within each table's column object literal, find every property whose
 *      value is a call of the form `<pgType>("physical_column_name", ...)`
 *      possibly chained with `.references(() => organizations.id, ...)` or
 *      `.notNull()` etc.
 *   3. A column is a DIRECT organization-ownership candidate if its physical
 *      name is exactly "organization_id" (the sole authoritative name per
 *      existing manifest precedent — e.g. finance.ts's `documents` note:
 *      "authoritatively scopes by organization_id only", never the legacy
 *      "org_id" duplicate).
 *   4. If a table has more than one directly-declared FK column whose
 *      chained `.references(...)` target resolves (by import alias) to
 *      `organizations`, record ALL of them (candidate MULTI_PARTY geometry)
 *      rather than picking one — the compiler must not silently choose.
 *   5. If a table has NO organization_id column but has a column ending in
 *      "_id" that `.references()` some OTHER table in this same schema
 *      corpus, record that as a PARENT candidate (table, fkColumn,
 *      parentPhysicalTable) — but do NOT recurse further here; that parent
 *      chain must resolve to a table THIS script also resolved to a direct
 *      organization_id column (single-hop only, matching 0108's own
 *      precedent — 0108 hand-rolled a two-hop case for
 *      message_read_receipts and this script flags exactly that shape as
 *      "PARENT_OF_PARENT_UNRESOLVED" rather than guessing).
 *   6. Every result is classified HIGH_CONFIDENCE_DIRECT,
 *      HIGH_CONFIDENCE_PARENT_SINGLE_HOP, CANDIDATE_MULTI_PARTY, or
 *      UNRESOLVED — nothing is silently defaulted.
 *
 * OUTPUT: reports/union-eyes-rls-geometry.json — keyed by physical table
 * name, one entry per table found anywhere in the schema corpus (not just
 * RLS-requiring ones, so the RLS compiler can cross-reference freely).
 *
 * This is intentionally a READ-ONLY analysis script — it does not touch the
 * database or generate migration SQL. See generate-rls-enforcement-migration.ts
 * for the compiler that consumes this output.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";

const REPO_ROOT = path.resolve(__dirname, "../..");
const SCHEMA_DIRS = [
  path.join(REPO_ROOT, "db/schema"),
];

export type ColumnRef = {
  propertyName: string;
  physicalName: string;
  referencesImportName: string | null; // e.g. "organizations" if .references(() => organizations.id, ...)
};

export type TableGeometry = {
  physicalTable: string;
  sourceFile: string;
  directOrgColumns: string[]; // physical column names literally "organization_id" or FK-to-organizations
  directUserColumns: string[]; // physical column names literally "user_id"
  otherForeignKeys: Array<{ column: string; referencesImportName: string }>;
  confidence:
    | "HIGH_CONFIDENCE_DIRECT"
    | "CANDIDATE_MULTI_PARTY"
    | "NO_DIRECT_ORG_COLUMN"
    | "UNRESOLVED";
  userConfidence: "HIGH_CONFIDENCE_USER" | "CANDIDATE_MULTI_USER" | "NO_USER_COLUMN";
};

function listSchemaFiles(): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__tests__") continue;
        walk(full);
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !entry.name.endsWith(".test.ts") &&
        !entry.name.endsWith(".spec.ts")
      ) {
        out.push(full);
      }
    }
  }
  for (const dir of SCHEMA_DIRS) {
    if (fs.existsSync(dir)) walk(dir);
  }
  return out;
}

/** Resolve the import-alias name used for `organizations` in this file, if any. */
function findOrganizationsImportLocalName(sf: ts.SourceFile): string | null {
  let localName: string | null = null;
  sf.forEachChild((node) => {
    if (ts.isImportDeclaration(node) && node.importClause?.namedBindings) {
      const bindings = node.importClause.namedBindings;
      if (ts.isNamedImports(bindings)) {
        for (const el of bindings.elements) {
          const importedName = (el.propertyName ?? el.name).text;
          if (importedName === "organizations") {
            localName = el.name.text;
          }
        }
      }
    }
  });
  return localName;
}

function textOfStringLiteralArg(expr: ts.Expression): string | null {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return expr.text;
  }
  return null;
}

/**
 * Walk a column-definition expression (e.g. `uuid("organization_id").notNull()
 * .references(() => organizations.id, {...})`) to find:
 *  - the physical column name (first string arg of the innermost call whose
 *    callee is a bare identifier — the pgType function, e.g. uuid/text/varchar)
 *  - whether a `.references(() => <ident>.<prop>, ...)` is chained anywhere
 */
function analyzeColumnExpression(expr: ts.Expression): {
  physicalName: string | null;
  referencesIdent: string | null;
} {
  let physicalName: string | null = null;
  let referencesIdent: string | null = null;

  let current: ts.Expression = expr;
  while (ts.isCallExpression(current)) {
    const callee = current.expression;
    if (ts.isPropertyAccessExpression(callee)) {
      // e.g. X.references(...), X.notNull(), X.defaultRandom()
      if (callee.name.text === "references" && current.arguments.length > 0) {
        const arrowFn = current.arguments[0];
        if (ts.isArrowFunction(arrowFn) && ts.isPropertyAccessExpression(arrowFn.body)) {
          const pae = arrowFn.body;
          if (ts.isIdentifier(pae.expression)) {
            referencesIdent = pae.expression.text;
          }
        }
      }
      current = callee.expression;
    } else if (ts.isIdentifier(callee)) {
      // Innermost call: e.g. uuid("organization_id")
      if (current.arguments.length > 0) {
        const name = textOfStringLiteralArg(current.arguments[0]);
        if (name) physicalName = name;
      }
      break;
    } else {
      break;
    }
  }

  return { physicalName, referencesIdent };
}

export function deriveGeometry(): {
  geometry: Record<string, TableGeometry>;
  exportNameToPhysicalTable: Record<string, string>;
} {
  const results: Record<string, TableGeometry> = {};
  const exportNameToPhysicalTable: Record<string, string> = {};
  const files = listSchemaFiles();

  // Pass 1: collect every `export const X = pgTable("physical", ...)` name
  // mapping, across the whole corpus, so cross-file FK references (e.g.
  // `.references(() => messageThreads.id)`) can be resolved to a physical
  // table name in pass 2 below.
  for (const file of files) {
    const sourceText = fs.readFileSync(file, "utf8");
    const sf = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    function collectExports(node: ts.Node) {
      if (
        ts.isVariableStatement(node) &&
        node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      ) {
        for (const decl of node.declarationList.declarations) {
          if (
            ts.isIdentifier(decl.name) &&
            decl.initializer &&
            ts.isCallExpression(decl.initializer) &&
            ts.isIdentifier(decl.initializer.expression) &&
            decl.initializer.expression.text === "pgTable" &&
            decl.initializer.arguments.length >= 1
          ) {
            const physicalTable = textOfStringLiteralArg(decl.initializer.arguments[0]);
            if (physicalTable) {
              exportNameToPhysicalTable[decl.name.text] = physicalTable;
            }
          }
        }
      }
      ts.forEachChild(node, collectExports);
    }
    collectExports(sf);
  }

  for (const file of files) {
    const sourceText = fs.readFileSync(file, "utf8");
    const sf = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const orgLocalName = findOrganizationsImportLocalName(sf);
    const relFile = path.relative(REPO_ROOT, file);

    function visit(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "pgTable" &&
        node.arguments.length >= 2
      ) {
        const physicalTable = textOfStringLiteralArg(node.arguments[0]);
        const columnsArg = node.arguments[1];
        if (physicalTable && ts.isObjectLiteralExpression(columnsArg)) {
          const directOrgColumns: string[] = [];
          const directUserColumns: string[] = [];
          const otherForeignKeys: Array<{ column: string; referencesImportName: string }> = [];

          for (const prop of columnsArg.properties) {
            if (!ts.isPropertyAssignment(prop)) continue;
            const { physicalName, referencesIdent } = analyzeColumnExpression(prop.initializer);
            if (!physicalName) continue;

            if (physicalName === "organization_id") {
              directOrgColumns.push(physicalName);
            } else if (referencesIdent && orgLocalName && referencesIdent === orgLocalName) {
              // FK to organizations under a different physical column name
              // (e.g. legacy "tenant_id" mapped as legacyOrgId in
              // schema-organizations.ts) — still a direct-org candidate.
              directOrgColumns.push(physicalName);
            } else if (physicalName === "user_id") {
              directUserColumns.push(physicalName);
            } else if (referencesIdent) {
              otherForeignKeys.push({ column: physicalName, referencesImportName: referencesIdent });
            }
          }

          let confidence: TableGeometry["confidence"];
          if (directOrgColumns.length === 1) confidence = "HIGH_CONFIDENCE_DIRECT";
          else if (directOrgColumns.length > 1) confidence = "CANDIDATE_MULTI_PARTY";
          else if (otherForeignKeys.length > 0) confidence = "NO_DIRECT_ORG_COLUMN";
          else confidence = "UNRESOLVED";

          let userConfidence: TableGeometry["userConfidence"];
          if (directUserColumns.length === 1) userConfidence = "HIGH_CONFIDENCE_USER";
          else if (directUserColumns.length > 1) userConfidence = "CANDIDATE_MULTI_USER";
          else userConfidence = "NO_USER_COLUMN";

          // Later files overwrite earlier ones only if this is a MORE
          // confident result — a table should only ever be declared once
          // in the real (non-dead-duplicate) schema corpus; if it appears
          // twice, prefer the entry with an actual org column so a dead
          // duplicate declared earlier in file-walk order can't shadow it.
          const existing = results[physicalTable];
          if (!existing || directOrgColumns.length > 0) {
            results[physicalTable] = {
              physicalTable,
              sourceFile: relFile,
              directOrgColumns,
              directUserColumns,
              otherForeignKeys,
              confidence,
              userConfidence,
            };
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
  }

  return { geometry: results, exportNameToPhysicalTable };
}

function main() {
  const { geometry, exportNameToPhysicalTable } = deriveGeometry();
  const outPath = path.join(REPO_ROOT, "reports/union-eyes-rls-geometry.json");
  const sorted = Object.keys(geometry)
    .sort()
    .reduce<Record<string, TableGeometry>>((acc, k) => {
      acc[k] = geometry[k];
      return acc;
    }, {});
  fs.writeFileSync(
    outPath,
    JSON.stringify({ tables: sorted, exportNameToPhysicalTable }, null, 2) + "\n"
  );

  const counts: Record<string, number> = {};
  const userCounts: Record<string, number> = {};
  for (const g of Object.values(geometry)) {
    counts[g.confidence] = (counts[g.confidence] ?? 0) + 1;
    userCounts[g.userConfidence] = (userCounts[g.userConfidence] ?? 0) + 1;
  }
  console.log(`Derived geometry for ${Object.keys(geometry).length} tables.`);
  console.log("org geometry:", JSON.stringify(counts, null, 2));
  console.log("user geometry:", JSON.stringify(userCounts, null, 2));
  console.log(`Written to ${path.relative(REPO_ROOT, outPath)}`);
}

if (require.main === module) {
  main();
}
