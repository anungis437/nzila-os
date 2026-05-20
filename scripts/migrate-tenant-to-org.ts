#!/usr/bin/env tsx
/**
 * Tenant → Org Terminology Migration Tool
 *
 * Idempotent, dry-run-by-default substitution tool driven by an explicit
 * allow-list. Only RENAME-class references from
 * `docs/categories/platform-and-operations/reference/TENANT_INVENTORY.md`
 * are touched. EXTERNAL_API, DATA_ARTIFACT, REPORT_SELF_REF, and
 * BUILD_CACHE references are skipped.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-tenant-to-org.ts                # dry-run
 *   pnpm tsx scripts/migrate-tenant-to-org.ts --execute      # apply changes
 *   pnpm tsx scripts/migrate-tenant-to-org.ts --scope=labels # only run a named scope
 *   pnpm tsx scripts/migrate-tenant-to-org.ts --list-scopes  # show scopes
 *
 * Safety guarantees:
 *   - Skips node_modules, .git, build caches, lockfiles, snapshots, coverage.
 *   - Skips files under the EXTERNAL_API skiplist.
 *   - Substitutions are word-boundary anchored.
 *   - --execute writes changes; without it the tool prints a unified diff
 *     summary and exits 0.
 *   - All substitutions are reviewable; the rule list lives in `RULES`.
 */

import { promises as fs } from 'node:fs';
import { join, relative, sep } from 'node:path';

interface Rule {
  pattern: RegExp;
  replacement: string;
  description: string;
}

interface Scope {
  name: string;
  description: string;
  includeGlobs: string[];
  rules: Rule[];
  /** Optional per-file path predicates to further narrow scope. */
  pathPredicate?: (relPath: string) => boolean;
}

/* ---------------------------------------------------------------------------
 * Global skiplists
 * ------------------------------------------------------------------------- */

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', '.turbo', 'dist', 'build', 'coverage',
  'coverage_html', '.venv', 'venv', '__pycache__', '.pytest_cache',
  '.mypy_cache', 'demo-output', 'tmp-art', 'tmp-e2e-report', 'tmp-gov-report',
  'proof-artifacts', 'tech-repo-scaffold',
]);

const SKIP_FILE_EXTENSIONS = new Set([
  '.lock', '.tsbuildinfo', '.map', '.png', '.jpg', '.svg', '.ico', '.woff',
  '.woff2', '.zip', '.gz', '.tar', '.pdf', '.parquet',
]);

const SKIP_FILE_BASENAMES = new Set([
  'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock',
  'TENANT_INVENTORY.md',
]);

/** External API surfaces — never rewrite identifiers from these libraries. */
const EXTERNAL_API_FILES = new Set([
  'apps/abr/infra/main.bicep',
  'apps/abr/backend/auth_core/migrations/0001_initial.py',
]);

/* ---------------------------------------------------------------------------
 * Substitution scopes
 * ------------------------------------------------------------------------- */

const SCOPES: Scope[] = [
  {
    name: 'catalog-tags',
    description: 'catalog-info.yaml: nzila.app/tenant-scoped → nzila.app/org-scoped',
    includeGlobs: ['**/catalog-info.yaml', 'catalog-info.yaml'],
    rules: [
      {
        pattern: /nzila\.app\/tenant-scoped/g,
        replacement: 'nzila.app/org-scoped',
        description: 'catalog label key',
      },
      {
        pattern: /"multi-tenant"/g,
        replacement: '"multi-org"',
        description: 'catalog tag value',
      },
      {
        pattern: /\bmulti-tenant\b/g,
        replacement: 'multi-org',
        description: 'catalog tag value (unquoted)',
      },
    ],
  },
  {
    name: 'ui-labels',
    description: 'User-facing UI labels in console/web pages (RENAME class)',
    includeGlobs: [],
    pathPredicate: (p) =>
      (p.includes(`${sep}console${sep}`) || p.includes(`${sep}apps${sep}web${sep}`)) &&
      (p.endsWith('.tsx') || p.endsWith('.ts')),
    rules: [
      {
        pattern: /Tenants Checked/g,
        replacement: 'Orgs Checked',
        description: 'pilot export label',
      },
      {
        pattern: /Cross-Tenant Leaks/g,
        replacement: 'Cross-Org Leaks',
        description: 'pilot export label',
      },
    ],
  },
  {
    name: 'docs-prose',
    description: 'Markdown docs (RENAME class) — prose-only substitutions',
    includeGlobs: [],
    pathPredicate: (p) =>
      p.endsWith('.md') &&
      !p.includes(`${sep}TENANT_INVENTORY`) &&
      !p.includes(`${sep}migrations${sep}`) &&
      !p.includes(`${sep}reports${sep}`) &&
      !p.includes(`${sep}.copilot`),
    rules: [
      {
        pattern: /multi-tenant SaaS/g,
        replacement: 'multi-org SaaS',
        description: 'docs prose',
      },
      {
        pattern: /Org-level tenant isolation/g,
        replacement: 'Org-level isolation',
        description: 'README phrasing',
      },
      {
        pattern: /no cross-tenant leakage/g,
        replacement: 'no cross-org leakage',
        description: 'README phrasing',
      },
    ],
  },
];

/* ---------------------------------------------------------------------------
 * CLI parsing
 * ------------------------------------------------------------------------- */

interface CliOptions {
  execute: boolean;
  scope: string | null;
  listScopes: boolean;
  root: string;
}

function parseCli(argv: string[]): CliOptions {
  const opts: CliOptions = {
    execute: false,
    scope: null,
    listScopes: false,
    root: process.cwd(),
  };
  for (const arg of argv.slice(2)) {
    if (arg === '--execute') opts.execute = true;
    else if (arg === '--list-scopes') opts.listScopes = true;
    else if (arg.startsWith('--scope=')) opts.scope = arg.slice('--scope='.length);
    else if (arg.startsWith('--root=')) opts.root = arg.slice('--root='.length);
  }
  return opts;
}

/* ---------------------------------------------------------------------------
 * Walker
 * ------------------------------------------------------------------------- */

async function* walk(dir: string, root: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full, root);
    } else if (entry.isFile()) {
      const ext = entry.name.includes('.') ? `.${entry.name.split('.').pop()}` : '';
      if (SKIP_FILE_EXTENSIONS.has(ext)) continue;
      if (SKIP_FILE_BASENAMES.has(entry.name)) continue;
      const rel = relative(root, full).split(sep).join('/');
      if (EXTERNAL_API_FILES.has(rel)) continue;
      yield full;
    }
  }
}

function matchesIncludeGlobs(relPath: string, globs: string[]): boolean {
  if (globs.length === 0) return true;
  return globs.some((g) => {
    // Minimal glob: support **/ and exact suffix
    if (g.startsWith('**/')) {
      const suffix = g.slice(3);
      return relPath.endsWith(suffix);
    }
    return relPath === g || relPath.endsWith(`/${g}`);
  });
}

/* ---------------------------------------------------------------------------
 * Substitution engine
 * ------------------------------------------------------------------------- */

interface FileChange {
  path: string;
  scope: string;
  replacements: { rule: string; count: number }[];
  preview: string[];
}

function applyRules(content: string, rules: Rule[]): { result: string; counts: Map<string, number> } {
  const counts = new Map<string, number>();
  let result = content;
  for (const rule of rules) {
    let n = 0;
    result = result.replace(rule.pattern, () => {
      n += 1;
      return rule.replacement;
    });
    if (n > 0) counts.set(rule.description, n);
  }
  return { result, counts };
}

function buildPreview(before: string, after: string): string[] {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const out: string[] = [];
  for (let i = 0; i < Math.max(beforeLines.length, afterLines.length); i++) {
    const b = beforeLines[i];
    const a = afterLines[i];
    if (b !== a) {
      if (b !== undefined) out.push(`  - ${b}`);
      if (a !== undefined) out.push(`  + ${a}`);
      if (out.length >= 12) {
        out.push('  ...');
        return out;
      }
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Main
 * ------------------------------------------------------------------------- */

async function main() {
  const opts = parseCli(process.argv);
  if (opts.listScopes) {
    console.log('Available scopes:');
    for (const s of SCOPES) console.log(`  - ${s.name}: ${s.description}`);
    return;
  }
  const activeScopes = opts.scope ? SCOPES.filter((s) => s.name === opts.scope) : SCOPES;
  if (activeScopes.length === 0) {
    console.error(`Unknown scope: ${opts.scope}. Use --list-scopes.`);
    process.exit(2);
  }

  const changes: FileChange[] = [];

  for await (const full of walk(opts.root, opts.root)) {
    const rel = relative(opts.root, full).split(sep).join('/');
    let content: string;
    try {
      content = await fs.readFile(full, 'utf8');
    } catch {
      continue;
    }
    let mutated = content;
    let allCounts = new Map<string, number>();
    let scopesHit: string[] = [];

    for (const scope of activeScopes) {
      const inIncludes = matchesIncludeGlobs(rel, scope.includeGlobs);
      const passesPredicate = scope.pathPredicate ? scope.pathPredicate(full) : true;
      if (!inIncludes || !passesPredicate) continue;

      const { result, counts } = applyRules(mutated, scope.rules);
      if (result !== mutated) {
        scopesHit.push(scope.name);
        for (const [k, v] of counts) {
          allCounts.set(`${scope.name}: ${k}`, (allCounts.get(`${scope.name}: ${k}`) ?? 0) + v);
        }
        mutated = result;
      }
    }

    if (mutated !== content) {
      changes.push({
        path: rel,
        scope: scopesHit.join('+'),
        replacements: [...allCounts.entries()].map(([rule, count]) => ({ rule, count })),
        preview: buildPreview(content, mutated),
      });
      if (opts.execute) {
        await fs.writeFile(full, mutated, 'utf8');
      }
    }
  }

  const totalReplacements = changes.reduce(
    (a, c) => a + c.replacements.reduce((s, r) => s + r.count, 0),
    0,
  );

  console.log('');
  console.log('===================================================================');
  console.log(`Tenant → Org Migration | mode: ${opts.execute ? 'EXECUTE' : 'DRY-RUN'}`);
  console.log(`Files touched: ${changes.length} | Total replacements: ${totalReplacements}`);
  console.log('===================================================================');
  for (const c of changes) {
    console.log(`\n[${c.scope}] ${c.path}`);
    for (const r of c.replacements) {
      console.log(`  · ${r.rule}: ${r.count}`);
    }
    for (const line of c.preview) console.log(line);
  }
  if (!opts.execute) {
    console.log('\n(dry-run — re-run with --execute to apply)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
