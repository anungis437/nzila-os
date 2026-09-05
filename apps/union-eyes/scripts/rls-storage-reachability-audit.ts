/**
 * ARTIFACT TYPE: Script
 * DOCTRINE_VERSION: 1.0.0
 *
 * RLS storage reachability audit — PROPOSAL-ONLY reachability scanner.
 *
 * Promoted from ad-hoc /tmp analysis scripts used during PR #752's Phase-3A
 * authority tranches (round 6). This tool enumerates every physical
 * pgTable() declaration under db/schema/**, finds real (non-test,
 * non-schema, non-migration) production references to each Drizzle export,
 * and infers a reachability classification.
 *
 * CRITICAL SAFETY RULE: this script NEVER writes to
 * db/rls-storage-authority-manifest.ts. It only prints/writes proposals to
 * a separate output file. Every classification in the manifest must be
 * individually reviewed and written by a human/agent — see the manifest's
 * own file header for why ("this manifest can honestly represent a
 * large-scale gap... without silently passing the parts that have not
 * actually been verified").
 *
 * KEY REGRESSION THIS TOOL MUST NOT REINTRODUCE (found during round 6):
 * a table can have BOTH a real, unused union-eyes-native pgTable()
 * declaration AND a same-named table in services/financial-service's own
 * separate database. If the scan only looks at ONE declaration site, it can
 * wrongly conclude "financial-service only" (SEPARATE_DATABASE_BOUNDARY)
 * when a genuine, unreachable-but-real union-eyes declaration also exists
 * (correct disposition: LATENT_UNREACHABLE, not SEPARATE_DATABASE_BOUNDARY).
 * This tool ALWAYS enumerates every declaration site for a table name
 * before proposing SEPARATE_DATABASE_BOUNDARY, and only proposes it when
 * NO union-eyes-native (non-financial-service) declaration exists at all.
 * See scripts/__tests__/rls-storage-reachability-audit.test.ts.
 */
import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

export type ReachabilityBucket =
  | 'TENANT_HTTP'
  | 'PLATFORM_ADMIN_HTTP'
  | 'SERVER_ACTION'
  | 'SYSTEM_JOB'
  | 'WEBHOOK'
  | 'WORKER'
  | 'INTERNAL_REACHABLE'
  | 'LATENT_UNREACHABLE'
  | 'UNKNOWN_REQUIRES_REVIEW';

export interface DeclarationSite {
  file: string;
  exportName: string;
  isFinancialService: boolean;
  hasOrganizationIdColumn: boolean;
}

export interface TableProposal {
  table: string;
  declarations: DeclarationSite[];
  usageFiles: string[];
  buckets: ReachabilityBucket[];
  /** Never a final manifest classification — always human-reviewed before use. */
  proposedClassification:
    | 'LATENT_UNREACHABLE'
    | 'SEPARATE_DATABASE_BOUNDARY'
    | 'UNKNOWN_REQUIRES_REVIEW';
  proposalReason: string;
}

function toRepoPath(file: string): string {
  return path.relative(REPO_ROOT, file).split(path.sep).join('/');
}

function walkSourceFiles(relativeRoots: string[]): string[] {
  const out: string[] = [];

  function visit(dir: string) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'dist' || entry.name === 'node_modules') continue;
        visit(full);
      } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
        out.push(toRepoPath(full));
      }
    }
  }

  for (const root of relativeRoots) visit(path.join(REPO_ROOT, root));
  return out;
}

/** Finds every file that declares a pgTable() with the given physical table name string. */
function findDeclarationFiles(table: string): string[] {
  // Search the whole repo (not just db/schema/**) — other packages/services
  // (e.g. services/financial-service) can declare a same-named physical
  // table in their OWN separate database. Enumerating every declaration
  // site (not just the canonical schema tree) is required to correctly
  // distinguish LATENT_UNREACHABLE (a real, unused union-eyes declaration
  // exists) from SEPARATE_DATABASE_BOUNDARY (no union-eyes declaration
  // exists at all, only a same-named table elsewhere) — see the file header.
  return walkSourceFiles(['db/schema', 'services']).filter((file) => {
    const content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
    return content.includes(`'${table}'`) || content.includes(`"${table}"`);
  });
}

/** Extracts the exported Drizzle identifier and org-column presence for a table within a file. */
function inspectDeclaration(file: string, table: string): DeclarationSite | null {
  const fullPath = path.join(REPO_ROOT, file);
  if (!fs.existsSync(fullPath)) return null;
  const content = fs.readFileSync(fullPath, 'utf8');

  let idx = content.indexOf(`'${table}'`);
  if (idx < 0) idx = content.indexOf(`"${table}"`);
  if (idx < 0) return null;

  const before = content.slice(0, idx);
  let exportName = '';
  const directMatch = before.match(/export const (\w+)\s*=\s*pgTable\(\s*$/);
  if (directMatch) {
    exportName = directMatch[1];
  } else {
    const fallback = before.slice(-300).match(/export const (\w+)\s*=\s*pgTable/);
    exportName = fallback?.[1] ?? '';
  }

  const block = content.slice(idx, idx + 4000);
  const hasOrganizationIdColumn = /organization_id|organizationId/.test(block);
  const isFinancialService = file.startsWith('services/financial-service');

  return { file, exportName, isFinancialService, hasOrganizationIdColumn };
}

/** Finds real (non-test, non-schema, non-financial-service) usage files for a Drizzle export name. */
function findUsageFiles(exportName: string): string[] {
  if (!exportName) return [];
  const exportPattern = new RegExp(`\\b${exportName}\\b`);
  return walkSourceFiles(['app', 'lib', 'services', 'actions']).filter((file) => {
    if (file.includes('__tests__') || /\.(test|spec)\.(ts|tsx)$/.test(file)) return false;
    if (file.startsWith('services/financial-service')) return false;
    if (file.startsWith('db/schema')) return false;

    const content = fs.readFileSync(path.join(REPO_ROOT, file), 'utf8');
    return exportPattern.test(content);
  });
}

function classifyUsageFile(file: string): ReachabilityBucket {
  if (/platform-admin|\/admin\//.test(file)) return 'PLATFORM_ADMIN_HTTP';
  if (/^app\/api\/.*route\.(ts|tsx)$/.test(file)) return 'TENANT_HTTP';
  if (/actions\//.test(file) || /\.action\.ts$/.test(file)) return 'SERVER_ACTION';
  if (/cron/i.test(file)) return 'SYSTEM_JOB';
  if (/webhook/i.test(file)) return 'WEBHOOK';
  if (/workers?\//.test(file)) return 'WORKER';
  if (/^(lib|services|domain)\//.test(file)) return 'INTERNAL_REACHABLE';
  return 'UNKNOWN_REQUIRES_REVIEW';
}

/**
 * Analyzes a single physical table name across the whole schema tree.
 * Enumerates ALL declaration sites (see the safety rule in the file header)
 * before proposing a disposition.
 */
export function analyzeTable(table: string): TableProposal {
  const files = findDeclarationFiles(table);
  const declarations = files
    .map((f) => inspectDeclaration(f, table))
    .filter((d): d is DeclarationSite => d !== null);

  const nonFinancialServiceDecls = declarations.filter((d) => !d.isFinancialService);

  const usageFiles = new Set<string>();
  for (const decl of declarations) {
    if (!decl.exportName) continue;
    for (const f of findUsageFiles(decl.exportName)) usageFiles.add(f);
  }
  const usageArr = Array.from(usageFiles);
  const buckets = Array.from(new Set(usageArr.map(classifyUsageFile)));

  let proposedClassification: TableProposal['proposedClassification'];
  let proposalReason: string;

  if (nonFinancialServiceDecls.length === 0 && declarations.length > 0) {
    // Only financial-service declares this table name — genuinely out of
    // this schema's remit.
    proposedClassification = 'SEPARATE_DATABASE_BOUNDARY';
    proposalReason =
      `No union-eyes-native pgTable('${table}', ...) declaration exists; ` +
      `only services/financial-service declares it (own DATABASE_URL/drizzle.config.ts).`;
  } else if (usageArr.length === 0) {
    proposedClassification = 'LATENT_UNREACHABLE';
    proposalReason =
      declarations.length > 0
        ? `Real union-eyes-native declaration(s) found (${declarations.map((d) => d.file).join(', ')}) but zero non-test production references.`
        : `No declaration or usage found at all.`;
  } else {
    proposedClassification = 'UNKNOWN_REQUIRES_REVIEW';
    proposalReason = `Reachable via: ${buckets.join(', ')}. Requires human review for authority class + minimum privilege — this tool does not propose TENANT_RLS_REQUIRED/SYSTEM_ONLY/etc.`;
  }

  return { table, declarations, usageFiles: usageArr, buckets, proposedClassification, proposalReason };
}

/** CLI entrypoint: `tsx scripts/rls-storage-reachability-audit.ts table1 table2 ...` */
function main() {
  const tables = process.argv.slice(2);
  if (tables.length === 0) {
    console.error('Usage: tsx scripts/rls-storage-reachability-audit.ts <table1> [table2 ...]');
    process.exit(1);
  }
  const proposals = tables.map(analyzeTable);
  console.log(JSON.stringify(proposals, null, 2));
}

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  main();
}
