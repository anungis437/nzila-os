/**
 * Canonical Repo Inventory Generator
 *
 * Scans the monorepo and produces a machine-generated JSON inventory
 * plus a markdown summary. CI uses the JSON artifact to detect drift
 * in docs that reference specific counts.
 *
 * Usage:
 *   pnpm --filter @nzila/repo-inventory generate
 */

import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateInventorySchema } from './schema';

// ── Types ───────────────────────────────────────────────

export interface AppMeta {
  name: string;
  language: 'typescript' | 'python' | 'polyglot';
  framework: string;
  port: number | null;
  hasReadme: boolean;
  hasEnvExample: boolean;
  dependsOnPlatformShell: boolean;
  dependsOnPlatformAuth: boolean;
  nzilaDeps: string[];
  purpose: string;
  codeFileCount: number;
}

export interface RepoInventory {
  generatedAt: string;
  appCount: number;
  packageCount: number;
  workspacePackageCount: number;
  workflowCount: number;
  contractTestCount: number;
  tsTestFileCount: number;
  pythonTestFileCount: number;
  apps: AppMeta[];
  workflows: string[];
}

// ── Helpers ─────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, '..', '..', '..');

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}

function canonicalPath(value: string): string {
  const normalized = normalizePath(value);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function isWithinBase(candidate: string, base: string): boolean {
  const candidateCanonical = canonicalPath(candidate);
  const baseCanonical = canonicalPath(base);
  return candidateCanonical === baseCanonical || candidateCanonical.startsWith(`${baseCanonical}/`);
}

function safeJoinUnder(base: string, ...parts: string[]): string | null {
  if (parts.some((part) => part.includes('\0') || /(^|[\\/])\.\.([\\/]|$)/.test(part))) return null;
  const candidate = normalizePath([base, ...parts].join('/'));
  return isWithinBase(candidate, base) ? candidate : null;
}

function readUtf8(filePath: string): string {
  return readFileSync(filePath, 'utf-8');
}

function readJson(filePath: string): Record<string, unknown> | null {
  try {
    if (!isWithinBase(filePath, ROOT)) return null;
    return JSON.parse(readUtf8(filePath));
  } catch {
    return null;
  }
}

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', '.next', '__pycache__', '.venv',
  'coverage', 'coverage_html', 'demo-output', '.turbo', '.cache',
  'tech-repo-scaffold', 'fixtures',
]);

function countFiles(dir: string, pattern: RegExp, visited = new Set<string>()): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = safeJoinUnder(dir, entry.name);
    if (!full) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.isDirectory()) {
      const real = statSync(full).ino?.toString() ?? full;
      if (visited.has(real)) continue;
      visited.add(real);
      count += countFiles(full, pattern, visited);
    } else if (pattern.test(entry.name)) {
      count++;
    }
  }
  return count;
}

function countTrackedFiles(relativeDir: string, pattern: RegExp): number {
  const result = spawnSync('git', ['ls-files', '--', relativeDir], {
    cwd: ROOT,
    encoding: 'utf-8',
  });

  if (result.status !== 0 || !result.stdout) {
    const fallbackPath = safeJoinUnder(ROOT, relativeDir);
    return fallbackPath ? countFiles(fallbackPath, pattern) : 0;
  }

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => pattern.test(file))
    .length;
}

// ── Scanners ────────────────────────────────────────────

function scanApps(): AppMeta[] {
  const appsDir = join(ROOT, 'apps');
  const appDirs = readdirSync(appsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  return appDirs.map(d => {
    const appDir = safeJoinUnder(appsDir, d.name);
    if (!appDir) {
      throw new Error(`Unsafe app directory path: ${d.name}`);
    }
    const pkgPath = safeJoinUnder(appDir, 'package.json');
    if (!pkgPath) {
      throw new Error(`Unsafe package path for app: ${d.name}`);
    }
    const pkg = readJson(pkgPath) as Record<string, unknown> | null;
    const deps = {
      ...(pkg?.dependencies as Record<string, string> ?? {}),
      ...(pkg?.devDependencies as Record<string, string> ?? {}),
    };

    const nzilaDeps = Object.keys(deps)
      .filter(k => k.startsWith('@nzila/'))
      .map(k => k.replace('@nzila/', ''))
      .sort();

    const backendPath = safeJoinUnder(appDir, 'backend', 'manage.py');
    const hasBackend = backendPath ? existsSync(backendPath) : false;
    const isFastify = Object.keys(deps).some(k => k === 'fastify');

    let framework = 'Next.js';
    let language: AppMeta['language'] = 'typescript';
    if (hasBackend) {
      framework = 'Next.js + Django';
      language = 'polyglot';
    } else if (isFastify) {
      framework = 'Fastify';
      language = 'typescript';
    }

    // Extract port from package.json dev script
    let port: number | null = null;
    const scripts = pkg?.scripts as Record<string, string> | undefined;
    if (scripts?.dev) {
      const portMatch = scripts.dev.match(/--port\s+(\d+)/);
      if (portMatch) port = parseInt(portMatch[1], 10);
    }

    // Extract purpose from README
    let purpose = '';
    const readmePath = safeJoinUnder(appDir, 'README.md');
    const hasReadme = readmePath ? existsSync(readmePath) : false;
    if (readmePath && existsSync(readmePath)) {
      const readme = readUtf8(readmePath);
      const descMatch = readme.match(/^>\s*(.+)/m);
      if (descMatch) purpose = descMatch[1].trim();
    }

    const envExamplePath = safeJoinUnder(appDir, '.env.example');

    return {
      name: d.name,
      language,
      framework,
      port,
      hasReadme,
      hasEnvExample: envExamplePath ? existsSync(envExamplePath) : false,
      dependsOnPlatformShell: '@nzila/platform-shell' in deps,
      dependsOnPlatformAuth: '@nzila/platform-auth' in deps,
      nzilaDeps,
      purpose,
      // Use tracked files to keep counts stable across CI/local environments.
      codeFileCount: countTrackedFiles(`apps/${d.name}`, /\.(ts|tsx|js|jsx|py)$/),
    };
  });
}

function scanPackages(): number {
  const pkgsDir = join(ROOT, 'packages');
  if (!existsSync(pkgsDir)) return 0;
  return readdirSync(pkgsDir, { withFileTypes: true })
    .filter(d => {
      if (!d.isDirectory() || d.name === 'node_modules' || d.name === 'packages') return false;
      const pkgJsonPath = safeJoinUnder(pkgsDir, d.name, 'package.json');
      return pkgJsonPath ? existsSync(pkgJsonPath) : false;
    })
    .length;
}

function scanWorkspacePackages(): number {
  const roots = ['apps', 'packages', 'services', 'tooling'];
  let count = 0;

  for (const root of roots) {
    const rootDir = join(ROOT, root);
    if (!existsSync(rootDir)) continue;

    for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const relPath = `${root}/${entry.name}`;
      if (relPath === 'packages/automation' || relPath === 'packages/packages') continue;
      if (existsSync(join(rootDir, entry.name, 'package.json'))) count++;
    }
  }

  return count;
}

function scanWorkflows(): string[] {
  const wfDir = join(ROOT, '.github', 'workflows');
  if (!existsSync(wfDir)) return [];
  return readdirSync(wfDir)
    .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
    .sort();
}

function scanContractTests(): number {
  return countTrackedFiles('tooling/contract-tests', /\.test\.(ts|tsx|js|jsx)$/);
}

function scanTsTests(): number {
  let count = 0;
  for (const dir of ['apps', 'packages', 'tooling']) {
    count += countTrackedFiles(dir, /\.(test|spec)\.(ts|tsx|js|jsx)$/);
  }
  return count;
}

function scanPythonTests(): number {
  let count = 0;
  for (const dir of ['apps', 'packages']) {
    count += countTrackedFiles(dir, /(^|\/)test_[^/]*\.py$|(^|\/)[^/]*_test\.py$/);
  }
  return count;
}

// ── Generate ────────────────────────────────────────────

function generate(): RepoInventory {
  const apps = scanApps();
  const workflows = scanWorkflows();
  const dayStamp = new Date().toISOString().split('T')[0];

  return {
    // Use a day-stable timestamp to prevent non-functional CI drift on reruns.
    generatedAt: `${dayStamp}T00:00:00.000Z`,
    appCount: apps.length,
    packageCount: scanPackages(),
    workspacePackageCount: scanWorkspacePackages(),
    workflowCount: workflows.length,
    contractTestCount: scanContractTests(),
    tsTestFileCount: scanTsTests(),
    pythonTestFileCount: scanPythonTests(),
    apps,
    workflows,
  };
}

// ── Markdown ────────────────────────────────────────────

function toMarkdown(inv: RepoInventory): string {
  const lines: string[] = [];
  lines.push('# Nzila OS — Canonical Repo Inventory');
  lines.push('');
  lines.push(`> Auto-generated on ${inv.generatedAt.split('T')[0]} by \`tooling/repo-inventory\`. Do not edit manually.`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Apps | ${inv.appCount} |`);
  lines.push(`| Packages (packages/*) | ${inv.packageCount} |`);
  lines.push(`| Workspace Packages (apps|packages|services|tooling) | ${inv.workspacePackageCount} |`);
  lines.push(`| GitHub Workflows | ${inv.workflowCount} |`);
  lines.push(`| Contract Test Files | ${inv.contractTestCount} |`);
  lines.push(`| TS/JS Test Files | ${inv.tsTestFileCount} |`);
  lines.push(`| Python Test Files | ${inv.pythonTestFileCount} |`);
  lines.push('');
  lines.push('## Apps');
  lines.push('');
  lines.push('| App | Framework | Port | README | .env.example | platform-shell | platform-auth | Code Files | Purpose |');
  lines.push('|-----|-----------|------|--------|--------------|----------------|---------------|------------|---------|');
  for (const app of inv.apps) {
    const yn = (v: boolean) => v ? '✅' : '❌';
    lines.push(
      `| ${app.name} | ${app.framework} | ${app.port ?? '—'} | ${yn(app.hasReadme)} | ${yn(app.hasEnvExample)} | ${yn(app.dependsOnPlatformShell)} | ${yn(app.dependsOnPlatformAuth)} | ${app.codeFileCount} | ${app.purpose.slice(0, 80)} |`
    );
  }
  lines.push('');
  lines.push('## Workflows');
  lines.push('');
  for (const wf of inv.workflows) {
    lines.push(`- ${wf}`);
  }
  lines.push('');
  return lines.join('\n');
}

// ── Main ────────────────────────────────────────────────

const outDir = join(ROOT, 'tooling', 'repo-inventory', 'output');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const inventory = validateInventorySchema(generate());

writeFileSync(join(outDir, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
writeFileSync(join(outDir, 'inventory.md'), toMarkdown(inventory));
writeFileSync(join(outDir, 'repo-inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
writeFileSync(join(outDir, 'repo-inventory.md'), toMarkdown(inventory));

console.log(`✓ Repo inventory generated at ${new Date().toISOString().split('T')[0]}`);
console.log(`  Apps: ${inventory.appCount}`);
console.log(`  Packages (packages/*): ${inventory.packageCount}`);
console.log(`  Workspace packages: ${inventory.workspacePackageCount}`);
console.log(`  Workflows: ${inventory.workflowCount}`);
console.log(`  Contract tests: ${inventory.contractTestCount}`);
console.log(`  TS/JS test files: ${inventory.tsTestFileCount}`);
console.log(`  Python test files: ${inventory.pythonTestFileCount}`);
