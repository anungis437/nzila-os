#!/usr/bin/env tsx
/**
 * build-baseline.ts — Measure and track monorepo build performance
 *
 * Records build times for all Turbo tasks and compares against a baseline.
 * Detects regressions (>20% slower) and improvements (>20% faster).
 *
 * Usage:
 *   pnpm exec tsx scripts/build-baseline.ts                 # measure + compare
 *   pnpm exec tsx scripts/build-baseline.ts --save          # measure + save as new baseline
 *   pnpm exec tsx scripts/build-baseline.ts --ci            # CI mode: fail on regression
 *   pnpm exec tsx scripts/build-baseline.ts --dry           # show current baseline without building
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname ?? __dirname, '..');
const BASELINE_PATH = join(ROOT, '.build-baseline.json');
const RESULTS_DIR = join(ROOT, 'ops', 'outputs');

// ── Types ───────────────────────────────────────────────

interface TaskTiming {
  task: string;
  package: string;
  duration: number; // ms
  cached: boolean;
}

interface Baseline {
  timestamp: string;
  gitSha: string;
  nodeVersion: string;
  turboVersion: string;
  totalDuration: number;
  tasks: TaskTiming[];
}

interface Comparison {
  task: string;
  package: string;
  baseline: number;
  current: number;
  deltaMs: number;
  deltaPercent: number;
  status: 'regression' | 'improvement' | 'stable' | 'new';
}

// ── Helpers ─────────────────────────────────────────────

function exec(cmd: string): string {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 600_000 }).trim();
  } catch {
    return '';
  }
}

function getGitSha(): string {
  return exec('git rev-parse --short HEAD') || 'unknown';
}

function getNodeVersion(): string {
  return process.version;
}

function getTurboVersion(): string {
  return exec('npx turbo --version') || 'unknown';
}

// ── Build + Measure ─────────────────────────────────────

function runBuildWithTiming(): TaskTiming[] {
  console.log('\n  Running full build (no cache)...\n');

  // Clear turbo cache to get clean timings
  exec('npx turbo clean');

  const start = Date.now();

  // Run turbo build with JSON output for timing data
  let turboOutput: string;
  try {
    turboOutput = execSync(
      'npx turbo build typecheck lint --dry=json 2>/dev/null || npx turbo build --dry=json',
      { cwd: ROOT, encoding: 'utf-8', timeout: 600_000 },
    );
  } catch {
    turboOutput = '';
  }

  // Parse turbo dry-run for task list
  const tasks: TaskTiming[] = [];

  // Run actual build and time it per package
  const packages = [
    'build',
    'typecheck',
    'lint',
  ];

  for (const taskName of packages) {
    const taskStart = Date.now();
    try {
      execSync(`npx turbo ${taskName} --force`, {
        cwd: ROOT,
        encoding: 'utf-8',
        timeout: 600_000,
        stdio: 'pipe',
      });
      const duration = Date.now() - taskStart;
      tasks.push({
        task: taskName,
        package: 'root',
        duration,
        cached: false,
      });
      console.log(`  ${taskName.padEnd(20)} ${(duration / 1000).toFixed(1)}s`);
    } catch (err) {
      const duration = Date.now() - taskStart;
      tasks.push({
        task: taskName,
        package: 'root',
        duration,
        cached: false,
      });
      console.log(`  ${taskName.padEnd(20)} ${(duration / 1000).toFixed(1)}s (with errors)`);
    }
  }

  // Also time individual critical-path apps
  const criticalApps = ['web', 'console', 'union-eyes', 'partners'];
  for (const app of criticalApps) {
    const appStart = Date.now();
    try {
      execSync(`npx turbo build --filter=@nzila/${app} --force`, {
        cwd: ROOT,
        encoding: 'utf-8',
        timeout: 300_000,
        stdio: 'pipe',
      });
      const duration = Date.now() - appStart;
      tasks.push({
        task: 'build',
        package: app,
        duration,
        cached: false,
      });
      console.log(`  build:${app.padEnd(15)} ${(duration / 1000).toFixed(1)}s`);
    } catch {
      console.log(`  build:${app.padEnd(15)} skipped (build error)`);
    }
  }

  return tasks;
}

// ── Comparison ──────────────────────────────────────────

function compare(baseline: Baseline, current: TaskTiming[]): Comparison[] {
  const comparisons: Comparison[] = [];
  const baselineMap = new Map(baseline.tasks.map(t => [`${t.task}:${t.package}`, t]));

  for (const task of current) {
    const key = `${task.task}:${task.package}`;
    const baseTask = baselineMap.get(key);

    if (!baseTask) {
      comparisons.push({
        task: task.task,
        package: task.package,
        baseline: 0,
        current: task.duration,
        deltaMs: task.duration,
        deltaPercent: 100,
        status: 'new',
      });
      continue;
    }

    const deltaMs = task.duration - baseTask.duration;
    const deltaPercent = baseTask.duration > 0
      ? (deltaMs / baseTask.duration) * 100
      : 0;

    let status: Comparison['status'] = 'stable';
    if (deltaPercent > 20) status = 'regression';
    if (deltaPercent < -20) status = 'improvement';

    comparisons.push({
      task: task.task,
      package: task.package,
      baseline: baseTask.duration,
      current: task.duration,
      deltaMs,
      deltaPercent,
      status,
    });
  }

  return comparisons;
}

function printComparisons(comparisons: Comparison[]): void {
  console.log('\n  ┌─────────────────────────────────────────────────────────────────┐');
  console.log('  │ Build Performance Comparison                                    │');
  console.log('  ├────────────────────┬──────────┬──────────┬──────────┬───────────┤');
  console.log('  │ Task               │ Baseline │ Current  │ Delta    │ Status    │');
  console.log('  ├────────────────────┼──────────┼──────────┼──────────┼───────────┤');

  for (const c of comparisons) {
    const label = c.package === 'root' ? c.task : `build:${c.package}`;
    const base = c.baseline > 0 ? `${(c.baseline / 1000).toFixed(1)}s` : 'N/A';
    const curr = `${(c.current / 1000).toFixed(1)}s`;
    const delta = c.status === 'new' ? 'new' : `${c.deltaPercent >= 0 ? '+' : ''}${c.deltaPercent.toFixed(0)}%`;
    const icon = { regression: '🔴', improvement: '🟢', stable: '⚪', new: '🔵' }[c.status];

    console.log(
      `  │ ${label.padEnd(18)} │ ${base.padStart(8)} │ ${curr.padStart(8)} │ ${delta.padStart(8)} │ ${icon} ${c.status.padEnd(6)} │`,
    );
  }

  console.log('  └────────────────────┴──────────┴──────────┴──────────┴───────────┘');
}

// ── Main ────────────────────────────────────────────────

const args = process.argv.slice(2);
const saveMode = args.includes('--save');
const ciMode = args.includes('--ci');
const dryMode = args.includes('--dry');

console.log('\n  ╔═══════════════════════════════════╗');
console.log('  ║   Nzila OS — Build Baseline        ║');
console.log('  ╚═══════════════════════════════════╝');

if (dryMode) {
  if (existsSync(BASELINE_PATH)) {
    const baseline: Baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));
    console.log(`\n  Baseline from: ${baseline.timestamp}`);
    console.log(`  Git SHA:       ${baseline.gitSha}`);
    console.log(`  Total:         ${(baseline.totalDuration / 1000).toFixed(1)}s`);
    console.log(`  Tasks:         ${baseline.tasks.length}`);
    for (const t of baseline.tasks) {
      const label = t.package === 'root' ? t.task : `build:${t.package}`;
      console.log(`    ${label.padEnd(20)} ${(t.duration / 1000).toFixed(1)}s`);
    }
  } else {
    console.log('\n  No baseline found. Run with --save to create one.');
  }
  process.exit(0);
}

const tasks = runBuildWithTiming();
const totalDuration = tasks.reduce((sum, t) => sum + t.duration, 0);

console.log(`\n  Total: ${(totalDuration / 1000).toFixed(1)}s across ${tasks.length} tasks`);

if (saveMode || !existsSync(BASELINE_PATH)) {
  const baseline: Baseline = {
    timestamp: new Date().toISOString(),
    gitSha: getGitSha(),
    nodeVersion: getNodeVersion(),
    turboVersion: getTurboVersion(),
    totalDuration,
    tasks,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2));
  console.log(`\n  Baseline saved to ${BASELINE_PATH}`);
} else {
  const baseline: Baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));
  const comparisons = compare(baseline, tasks);
  printComparisons(comparisons);

  // Save results
  if (!existsSync(RESULTS_DIR)) mkdirSync(RESULTS_DIR, { recursive: true });
  const resultPath = join(RESULTS_DIR, `build-baseline-${Date.now()}.json`);
  writeFileSync(resultPath, JSON.stringify({ baseline, current: tasks, comparisons }, null, 2));
  console.log(`\n  Results saved to ${resultPath}`);

  // CI mode: fail on regression
  if (ciMode) {
    const regressions = comparisons.filter(c => c.status === 'regression');
    if (regressions.length > 0) {
      console.error(`\n  ✗ ${regressions.length} regression(s) detected. Failing CI.`);
      process.exit(1);
    }
    console.log('\n  ✓ No regressions detected.');
  }
}

console.log();
