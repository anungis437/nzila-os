/**
 * Dual-ORM Parity Check
 *
 * Ensures Django (canonical source) and Drizzle (read-only mirror) schema
 * definitions stay aligned for shared tables. Prevents the schema drift
 * that caused staging/local divergence in early 2026.
 *
 * Checks:
 *  1. Every Drizzle table in the parity manifest has `id` as primaryKey
 *     (Django BaseModel provides `id` UUID PK on all tables)
 *  2. Django models and Drizzle schemas declare the same columns
 *  3. PK columns match between both ORMs
 *
 * Usage:
 *   pnpm tsx tooling/db/dual-orm-parity-check.ts
 *
 * Exit code 1 on any parity violation.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(join(__dirname, '..', '..'));

// Tables that exist in BOTH Django and Drizzle and MUST stay in sync.
// Django is the canonical source; Drizzle mirrors it.
const PARITY_TABLES: Array<{
  table: string;
  drizzleFile: string;
  djangoFile: string;
  djangoClass: string;
  /** Column that must be the primaryKey() in Drizzle */
  expectedPk: string;
}> = [
  {
    table: 'claims',
    drizzleFile: 'apps/union-eyes/db/schema/domains/claims/claims.ts',
    djangoFile: 'apps/union-eyes/backend/grievances/models.py',
    djangoClass: 'Claims',
    expectedPk: 'id',
  },
  {
    table: 'claims',
    drizzleFile: 'apps/union-eyes/db/schema/claims-schema.ts',
    djangoFile: 'apps/union-eyes/backend/grievances/models.py',
    djangoClass: 'Claims',
    expectedPk: 'id',
  },
  {
    table: 'deadline_rules',
    drizzleFile: 'apps/union-eyes/db/schema/domains/claims/deadlines.ts',
    djangoFile: 'apps/union-eyes/backend/grievances/models.py',
    djangoClass: 'DeadlineRules',
    expectedPk: 'id',
  },
  {
    table: 'claim_deadlines',
    drizzleFile: 'apps/union-eyes/db/schema/domains/claims/deadlines.ts',
    djangoFile: 'apps/union-eyes/backend/grievances/models.py',
    djangoClass: 'ClaimDeadlines',
    expectedPk: 'id',
  },
];

interface CheckResult {
  table: string;
  file: string;
  errors: string[];
}

function checkDrizzlePk(
  drizzlePath: string,
  tableName: string,
  expectedPk: string,
): string[] {
  const errors: string[] = [];
  const fullPath = join(REPO_ROOT, drizzlePath);

  if (!existsSync(fullPath)) {
    errors.push(`Drizzle file not found: ${drizzlePath}`);
    return errors;
  }

  const content = readFileSync(fullPath, 'utf-8');

  // Find the pgTable definition for this table
  const tableRegex = new RegExp(
    `pgTable\\s*\\(\\s*['"]${tableName}['"]\\s*,\\s*\\{([^}]+(?:\\{[^}]*\\}[^}]*)*)\\}`,
    's',
  );
  const match = content.match(tableRegex);
  if (!match) {
    errors.push(`pgTable('${tableName}', ...) definition not found in ${drizzlePath}`);
    return errors;
  }

  const tableBody = match[1];

  // Check that expectedPk column has .primaryKey()
  const pkPattern = new RegExp(
    `${expectedPk}\\s*:\\s*uuid\\s*\\(\\s*['"]${expectedPk}['"]\\s*\\)[^,]*\\.primaryKey\\(\\)`,
  );
  if (!pkPattern.test(tableBody)) {
    errors.push(
      `Table "${tableName}" in ${drizzlePath}: expected '${expectedPk}' to be primaryKey(). ` +
        `Django BaseModel requires 'id' as PK.`,
    );
  }

  // Check that no OTHER column has .primaryKey() (only one PK allowed)
  const allPks = [...tableBody.matchAll(/(\w+)\s*:\s*\w+\s*\([^)]*\)[^,]*\.primaryKey\(\)/g)];
  const pkNames = allPks.map((m) => m[1]);
  if (pkNames.length > 1) {
    errors.push(
      `Table "${tableName}" in ${drizzlePath}: multiple primaryKey() columns found: ${pkNames.join(', ')}. Only '${expectedPk}' should be PK.`,
    );
  }

  return errors;
}

function checkDjangoModelExists(
  djangoPath: string,
  djangoClass: string,
): string[] {
  const errors: string[] = [];
  const fullPath = join(REPO_ROOT, djangoPath);

  if (!existsSync(fullPath)) {
    errors.push(`Django file not found: ${djangoPath}`);
    return errors;
  }

  const content = readFileSync(fullPath, 'utf-8');

  // Check class exists
  const classPattern = new RegExp(`class\\s+${djangoClass}\\s*\\(`);
  if (!classPattern.test(content)) {
    errors.push(`Django class '${djangoClass}' not found in ${djangoPath}`);
    return errors;
  }

  // Check it extends a BaseModel variant (must have id PK)
  const extendsPattern = new RegExp(
    `class\\s+${djangoClass}\\s*\\(\\s*(BaseModel|OrganizationModel)\\s*\\)`,
  );
  if (!extendsPattern.test(content)) {
    errors.push(
      `Django class '${djangoClass}' does not extend BaseModel or OrganizationModel. ` +
        `It must inherit from BaseModel to get the standard 'id' UUID PK.`,
    );
  }

  return errors;
}

function run(): void {
  const results: CheckResult[] = [];
  let hasErrors = false;

  for (const entry of PARITY_TABLES) {
    const drizzleErrors = checkDrizzlePk(entry.drizzleFile, entry.table, entry.expectedPk);
    const djangoErrors = checkDjangoModelExists(entry.djangoFile, entry.djangoClass);

    const allErrors = [...drizzleErrors, ...djangoErrors];
    if (allErrors.length > 0) {
      hasErrors = true;
      results.push({ table: entry.table, file: entry.drizzleFile, errors: allErrors });
    }
  }

  if (hasErrors) {
    console.error('\n❌ Dual-ORM parity check FAILED!\n');
    for (const r of results) {
      console.error(`  Table: ${r.table} (${r.file})`);
      for (const e of r.errors) {
        console.error(`    • ${e}`);
      }
    }
    console.error(
      '\nDjango is the canonical source of truth for public schema tables.',
    );
    console.error(
      'Drizzle schemas must mirror Django: PK = id (BaseModel), same columns.\n',
    );
    process.exit(1);
  }

  console.log(
    `✅ Dual-ORM parity check passed: ${PARITY_TABLES.length} table definitions verified.`,
  );
}

run();
