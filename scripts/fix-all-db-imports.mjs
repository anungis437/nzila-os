/**
 * Fix all 14 raw `db` import violations — migrate to withRLSContext / withSystemRLSContext.
 *
 * Categories:
 *   A — withRLSContext already present but callback ignores tx (5 route files)
 *   B — completely raw db access with no RLS wrapper (4 route files)
 *   C — private withSystemContext API; wrong tx (1 route file)
 *   D — background-job functions need withSystemRLSContext (1 lib file)
 *   E — large query-library files with many db.execute calls (3 query files)
 *
 * Run once from repo root: node scripts/fix-all-db-imports.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BASE = resolve(ROOT, 'apps/union-eyes');

function fixFile(relPath, fn) {
  const fullPath = resolve(BASE, relPath.replace(/\//g, process.platform === 'win32' ? '\\' : '/'));
  let content = readFileSync(fullPath, 'utf8');
  const wasCRLF = content.includes('\r\n');
  content = content.replace(/\r\n/g, '\n');
  const before = content;
  content = fn(content);
  if (content === before) {
    console.warn(`  ⚠  No changes detected: ${relPath}`);
  } else {
    console.log(`  ✓  ${relPath}`);
  }
  if (wasCRLF) content = content.replace(/\n/g, '\r\n');
  writeFileSync(fullPath, content, 'utf8');
}

const removeDbImport = (c) =>
  c.replace(/^import \{ db \} from '@\/db\/db';\n/m, '');

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY A — wrong tx pattern; withRLSContext already imported
// ─────────────────────────────────────────────────────────────────────────────
function fixCategoryA(c) {
  c = removeDbImport(c);
  // async () => → async (tx) =>
  c = c.replace(/withRLSContext\(async \(\) =>/g, 'withRLSContext(async (tx) =>');
  // sync () => → async (tx) =>
  c = c.replace(/withRLSContext\(\(\) =>/g,       'withRLSContext(async (tx) =>');
  // db.METHOD → tx.METHOD (word boundary — won't affect platformDb.)
  c = c.replace(/\bdb\.(execute|select|insert|update|delete)\b/g, 'tx.$1');
  // standalone `db` on its own line followed by .METHOD on next line (e.g. timeline route)
  c = c.replace(/\bdb\b(?=[ \t]*\n[ \t]+\.(?:execute|select|insert|update|delete))/g, 'tx');
  return c;
}

console.log('\n── Category A ──');
fixFile('app/api/cases/[caseId]/evidence/route.ts', fixCategoryA);
fixFile('app/api/cases/[caseId]/timeline/route.ts', fixCategoryA);
fixFile('app/api/cases/[caseId]/route.ts',          fixCategoryA);
fixFile('app/api/cases/route.ts',                   fixCategoryA);
fixFile('app/api/claims/[id]/route.ts',             fixCategoryA);

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY B — raw db access; withRLSContext import must be added / used
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Category B ──');

// B1: escalate — missing org filter + missing withRLSContext
fixFile('app/api/cases/[caseId]/escalate/route.ts', (c) => {
  c = removeDbImport(c);
  c = c.replace("import { eq } from 'drizzle-orm';", "import { eq, and } from 'drizzle-orm';");
  // Replace the raw unscoped claim-fetch with an org-guarded, RLS-wrapped version
  c = c.replace(
    `    // Fetch the claim\n    const [claim] = await db\n      .select()\n      .from(claims)\n      .where(eq(claims.claimId, caseId))\n      .limit(1);`,
    [
      `    if (!ctx.organizationId) {`,
      `      return NextResponse.json(`,
      `        { success: false, error: 'Organization context required' },`,
      `        { status: 403 },`,
      `      );`,
      `    }`,
      ``,
      `    // Fetch the claim (org-scoped + RLS)`,
      `    const [claim] = await withRLSContext(async (tx) =>`,
      `      tx`,
      `        .select()`,
      `        .from(claims)`,
      `        .where(and(eq(claims.claimId, caseId), eq(claims.organizationId, ctx.organizationId!)))`,
      `        .limit(1)`,
      `    );`,
    ].join('\n'),
  );
  return c;
});

// B2: bulk-import — idempotency hash missing orgId prefix + raw duplicate-check
fixFile('app/api/cases/bulk-import/route.ts', (c) => {
  c = removeDbImport(c);
  c = c.replace("import { eq } from 'drizzle-orm';", "import { eq, and } from 'drizzle-orm';");
  // Fix idempotency hash: prefix with orgId to prevent cross-org collision
  c = c.replace(
    "? `ext:${record.externalSourceId}`\n          : `${record.memberId}|${record.caseType}|${record.incidentDate}|${record.title}`;",
    "? `${orgId}|ext:${record.externalSourceId}`\n          : `${orgId}|${record.memberId}|${record.caseType}|${record.incidentDate}|${record.title}`;",
  );
  // Wrap duplicate-check in withRLSContext + add org scope
  c = c.replace(
    `        // Check for existing\n        const [existing] = await db\n          .select({ claimId: claims.claimId, claimNumber: claims.claimNumber })\n          .from(claims)\n          .where(eq(claims.idempotencyHash, idempotencyHash))\n          .limit(1);`,
    [
      `        // Check for existing (org-scoped + RLS)`,
      `        const [existing] = await withRLSContext(async (tx) =>`,
      `          tx`,
      `            .select({ claimId: claims.claimId, claimNumber: claims.claimNumber })`,
      `            .from(claims)`,
      `            .where(and(eq(claims.idempotencyHash, idempotencyHash), eq(claims.organizationId, orgId)))`,
      `            .limit(1)`,
      `        );`,
    ].join('\n'),
  );
  return c;
});

// B3: claims/[id]/evidence — 3 raw db queries; swap import
fixFile('app/api/claims/[id]/evidence/route.ts', (c) => {
  c = c.replace(
    "import { db } from '@/db/db'",
    "import { withRLSContext } from '@/lib/db/with-rls-context'",
  );
  c = c.replace(
    `    const [claim] = await db\n      .select()\n      .from(claims)\n      .where(claimFilter)\n      .limit(1)`,
    `    const [claim] = await withRLSContext(async (tx) =>\n      tx\n        .select()\n        .from(claims)\n        .where(claimFilter)\n        .limit(1)\n    )`,
  );
  c = c.replace(
    `    const updates = await db\n      .select()\n      .from(claimUpdates)\n      .where(eq(claimUpdates.claimId, claimId))\n      .orderBy(claimUpdates.createdAt)`,
    `    const updates = await withRLSContext(async (tx) =>\n      tx\n        .select()\n        .from(claimUpdates)\n        .where(eq(claimUpdates.claimId, claimId))\n        .orderBy(claimUpdates.createdAt)\n    )`,
  );
  c = c.replace(
    `    const [pack] = await db\n      .select()\n      .from(defensibilityPacks)\n      .where(eq(defensibilityPacks.caseId, claimId))\n      .orderBy(desc(defensibilityPacks.generatedAt))\n      .limit(1)`,
    `    const [pack] = await withRLSContext(async (tx) =>\n      tx\n        .select()\n        .from(defensibilityPacks)\n        .where(eq(defensibilityPacks.caseId, claimId))\n        .orderBy(desc(defensibilityPacks.generatedAt))\n        .limit(1)\n    )`,
  );
  return c;
});

// B4: claims/[id]/workflow/history — 1 raw db query; swap import
fixFile('app/api/claims/[id]/workflow/history/route.ts', (c) => {
  c = c.replace(
    "import { db } from '@/db/db';",
    "import { withRLSContext } from '@/lib/db/with-rls-context';",
  );
  c = c.replace(
    `  const history = await db\n    .select()\n    .from(grievanceTransitions)\n    .where(\n      and(\n        eq(grievanceTransitions.claimId, id),\n        eq(grievanceTransitions.organizationId, user.organizationId),\n      )\n    )\n    .orderBy(desc(grievanceTransitions.transitionedAt));`,
    [
      `  const history = await withRLSContext(async (tx) =>`,
      `    tx`,
      `      .select()`,
      `      .from(grievanceTransitions)`,
      `      .where(`,
      `        and(`,
      `          eq(grievanceTransitions.claimId, id),`,
      `          eq(grievanceTransitions.organizationId, user.organizationId),`,
      `        )`,
      `      )`,
      `      .orderBy(desc(grievanceTransitions.transitionedAt))`,
      `  );`,
    ].join('\n'),
  );
  return c;
});

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY C — withSystemContext (private API) → withSystemRLSContext
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Category C ──');
fixFile('app/api/claims/route.ts', (c) => {
  c = removeDbImport(c);
  c = c.replace(
    "import { withSystemContext } from '@/lib/db/with-rls-context';",
    "import { withSystemRLSContext } from '@/lib/db/with-rls-context';",
  );
  c = c.replace(
    "return withSystemContext(async () => {",
    "return withSystemRLSContext('system-query: create-claim', async (tx) => {",
  );
  c = c.replace(/\bdb\.execute\b/g, 'tx.execute');
  c = c.replace(/\bdb\.insert\b/g,  'tx.insert');
  return c;
});

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY D — background jobs need withSystemRLSContext (no HTTP context)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Category D ──');
fixFile('lib/workflow-engine.ts', (c) => {
  c = c.replace('import { db } from "../db/db";\n', '');
  c = c.replace(
    'import { withRLSContext } from "./db/with-rls-context";',
    'import { withRLSContext, withSystemRLSContext } from "./db/with-rls-context";',
  );
  // Replace first occurrence (getOverdueClaims) and second (getClaimsApproachingDeadline)
  let first = true;
  c = c.replace(/const allClaims = await db\.select\(\)\.from\(claims\);/g, () => {
    const reason = first
      ? 'background-job: overdue-claims-scan'
      : 'background-job: approaching-deadline-scan';
    first = false;
    return `const allClaims = await withSystemRLSContext('${reason}', async (tx) => tx.select().from(claims));`;
  });
  return c;
});

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY E — large query-library files; wrap every db.execute(sql`...`)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Category E ──');

// E1: analytics-queries — all functions are HTTP-context (org-scoped dashboard queries)
fixFile('db/queries/analytics-queries.ts', (c) => {
  c = c.replace(
    "import { db } from '@/db/db';",
    "import { withRLSContext } from '@/lib/db/with-rls-context';",
  );
  // Wrap every: await db.execute(sql`...`) → await withRLSContext(async (tx) => tx.execute(sql`...`))
  // eslint-disable-next-line no-useless-escape
  c = c.replace(/await db\.execute\(sql`([\s\S]*?)`\)/g,
    "await withRLSContext(async (tx) => tx.execute(sql`$1`))");
  return c;
});

// E2: deadline-queries — all functions are HTTP-context (org-scoped deadline data)
fixFile('db/queries/deadline-queries.ts', (c) => {
  c = c.replace(
    "import { db } from '@/db/db';",
    "import { withRLSContext } from '@/lib/db/with-rls-context';",
  );
  c = c.replace(/await db\.execute\(sql`([\s\S]*?)`\)/g,
    "await withRLSContext(async (tx) => tx.execute(sql`$1`))");
  return c;
});

// E3: enhanced-rbac-queries — 4 system functions (role_definitions) use withSystemRLSContext;
//     all member/org-scoped functions use withRLSContext.
fixFile('db/queries/enhanced-rbac-queries.ts', (c) => {
  c = c.replace(
    "import { db } from '@/db/db';",
    "import { withRLSContext, withSystemRLSContext } from '@/lib/db/with-rls-context';",
  );
  // System functions query the platform role_definitions table (no org scoping).
  // Match by distinctive SQL content: FROM role_definitions (for SELECT) or INSERT INTO role_definitions.
  c = c.replace(
    /await db\.execute\(sql`(\s*\n\s*SELECT[\s\S]*?FROM role_definitions[\s\S]*?)`\)/g,
    "await withSystemRLSContext('system-query: role-definitions', async (tx) => tx.execute(sql`$1`))",
  );
  c = c.replace(
    /await db\.execute\(sql`(\s*\n\s*INSERT INTO role_definitions[\s\S]*?)`\)/g,
    "await withSystemRLSContext('system-query: role-definitions', async (tx) => tx.execute(sql`$1`))",
  );
  // All remaining db.execute calls → withRLSContext (org-scoped member/role queries)
  c = c.replace(/await db\.execute\(sql`([\s\S]*?)`\)/g,
    "await withRLSContext(async (tx) => tx.execute(sql`$1`))");
  return c;
});

console.log('\n✅ All files processed.\n');
