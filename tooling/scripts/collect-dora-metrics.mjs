#!/usr/bin/env node
/**
 * collect-dora-metrics.mjs
 *
 * Computes DORA metrics from git history and writes to ops/outputs/dora-metrics.json.
 *
 * Metrics computed:
 *   - deployment_frequency:  merges to main per week (30-day rolling)
 *   - lead_time_for_change:  avg hours from first feat/fix commit on branch to merge
 *   - change_failure_rate:   ratio of revert/* or fix(revert)* merges to total merges
 *   - mttr_hours:            null (requires incident tracker integration)
 *
 * Usage:  node tooling/scripts/collect-dora-metrics.mjs
 */

import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const OUTPUT = resolve(
  ROOT,
  process.env.DORA_OUTPUT_PATH ?? 'ops/outputs/dora-metrics.json',
);
const WINDOW_DAYS = Number(process.env.DORA_WINDOW_DAYS ?? 30);
const LOOKBACK_WEEKS = Number(process.env.DORA_LOOKBACK_WEEKS ?? 12);
const TARGET_BRANCH = process.env.DORA_TARGET_BRANCH ?? 'main';
const FORCE_ENFORCE_FROM_ARG = process.argv.includes('--enforce');

const ENFORCE_THRESHOLDS =
  FORCE_ENFORCE_FROM_ARG ||
  String(process.env.DORA_ENFORCE_THRESHOLDS ?? '0').toLowerCase() === '1' ||
  String(process.env.DORA_ENFORCE_THRESHOLDS ?? '0').toLowerCase() === 'true';
const MIN_DEPLOYS_PER_WEEK = process.env.DORA_MIN_DEPLOYS_PER_WEEK
  ? Number(process.env.DORA_MIN_DEPLOYS_PER_WEEK)
  : null;
const MAX_LEAD_TIME_HOURS = process.env.DORA_MAX_LEAD_TIME_HOURS
  ? Number(process.env.DORA_MAX_LEAD_TIME_HOURS)
  : null;
const MAX_CHANGE_FAILURE_RATE_PCT = process.env.DORA_MAX_CHANGE_FAILURE_RATE_PCT
  ? Number(process.env.DORA_MAX_CHANGE_FAILURE_RATE_PCT)
  : null;

function git(args) {
  return execSync(`git -C "${ROOT}" ${args}`, { encoding: 'utf8' }).trim();
}

function safeGit(args, fallback = '') {
  try {
    return git(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`WARN: git command failed: ${args}`);
    console.warn(`WARN: ${message.split('\n')[0]}`);
    return fallback;
  }
}

function gitRefExists(ref) {
  const out = safeGit(`rev-parse --verify --quiet "${ref}^{commit}"`, '');
  return out.length > 0;
}

function resolveTargetRef(requestedBranch) {
  const candidates = [];
  const addCandidate = (ref) => {
    if (!ref || candidates.includes(ref)) return;
    candidates.push(ref);
  };

  const normalizedRequested = String(requestedBranch || '').trim();
  const githubBaseRef = String(process.env.GITHUB_BASE_REF ?? '').trim();

  // Prefer explicit config first.
  addCandidate(normalizedRequested);
  addCandidate(`origin/${normalizedRequested}`);
  addCandidate(`refs/remotes/origin/${normalizedRequested}`);

  // On PR workflows, base ref is usually the canonical branch to evaluate.
  addCandidate(githubBaseRef);
  addCandidate(`origin/${githubBaseRef}`);
  addCandidate(`refs/remotes/origin/${githubBaseRef}`);

  // Common defaults.
  for (const branch of ['main', 'master']) {
    addCandidate(branch);
    addCandidate(`origin/${branch}`);
    addCandidate(`refs/remotes/origin/${branch}`);
  }

  const remoteHead = safeGit('symbolic-ref --quiet refs/remotes/origin/HEAD', '');
  if (remoteHead) {
    addCandidate(remoteHead);
    const shortRemoteHead = remoteHead.replace(/^refs\/remotes\//, '');
    addCandidate(shortRemoteHead);
  }

  for (const candidate of candidates) {
    if (gitRefExists(candidate)) {
      return candidate;
    }
  }

  // Try fetching likely branches in shallow CI clones, then retry.
  for (const branch of [normalizedRequested, githubBaseRef, 'main', 'master']) {
    if (!branch) continue;
    safeGit(`fetch --depth=200 origin "${branch}:refs/remotes/origin/${branch}"`, '');
  }

  for (const candidate of candidates) {
    if (gitRefExists(candidate)) {
      return candidate;
    }
  }

  // Final fallback: current commit. This avoids hard failure from ambiguous refs.
  const head = safeGit('rev-parse --verify --quiet HEAD', '');
  if (head) {
    console.warn(
      `WARN: could not resolve target branch '${requestedBranch}', falling back to HEAD for DORA calculation`,
    );
    return 'HEAD';
  }

  return requestedBranch;
}

function ensureOutputDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

function startOfUtcWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

function weekKey(date) {
  const monday = startOfUtcWeek(date);
  return monday.toISOString().split('T')[0];
}

function linearRegressionSlope(series) {
  if (series.length < 2) return 0;
  const n = series.length;
  const xMean = (n - 1) / 2;
  const yMean = series.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = i - xMean;
    num += dx * (series[i] - yMean);
    den += dx * dx;
  }
  return den === 0 ? 0 : num / den;
}

const TARGET_REF = resolveTargetRef(TARGET_BRANCH);

// ── Deployment Frequency ─────────────────────────────────────────────────────
// Count merges to main in the last 30 days
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
const sinceDate = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
  .toISOString()
  .split('T')[0];

const mergeCommits = safeGit(
  `log "${TARGET_REF}" --merges --since="${sinceDate}" --format="%H %ai %s"`,
  '',
)
  .split('\n')
  .filter(Boolean);

const deploymentCount = mergeCommits.length;
const deploymentFrequencyPerWeek =
  deploymentCount > 0 ? Number((deploymentCount / 4.3).toFixed(2)) : 0;

// ── Predictive trend and anomaly signals ─────────────────────────────────────
const trendSinceDate = new Date(Date.now() - LOOKBACK_WEEKS * 7 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split('T')[0];
const trendMergeCommits = safeGit(
  `log "${TARGET_REF}" --merges --since="${trendSinceDate}" --format="%ct %s"`,
  '',
)
  .split('\n')
  .filter(Boolean);
const weeklyBuckets = new Map();
for (let i = LOOKBACK_WEEKS - 1; i >= 0; i -= 1) {
  const d = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);
  weeklyBuckets.set(weekKey(d), 0);
}
for (const line of trendMergeCommits) {
  const [epoch] = line.split(' ');
  const ts = Number(epoch);
  if (!Number.isFinite(ts)) continue;
  const key = weekKey(new Date(ts * 1000));
  if (weeklyBuckets.has(key)) {
    weeklyBuckets.set(key, (weeklyBuckets.get(key) ?? 0) + 1);
  }
}
const weeklyDeployCounts = Array.from(weeklyBuckets.values());
const slopePerWeek = Number(linearRegressionSlope(weeklyDeployCounts).toFixed(2));
const trailing4WeekAverage =
  weeklyDeployCounts.length >= 4
    ? Number(
        (
          weeklyDeployCounts.slice(-4).reduce((a, b) => a + b, 0) /
          4
        ).toFixed(2),
      )
    : Number((weeklyDeployCounts.reduce((a, b) => a + b, 0) / Math.max(weeklyDeployCounts.length, 1)).toFixed(2));
const projectedNextWeekDeploys = Number(
  Math.max(0, weeklyDeployCounts[weeklyDeployCounts.length - 1] + slopePerWeek).toFixed(2),
);
const projectedDeploysPerWeek = projectedNextWeekDeploys;
const severeDropRisk =
  trailing4WeekAverage > 0 &&
  projectedNextWeekDeploys < trailing4WeekAverage * 0.6;
const thresholdDropRisk =
  MIN_DEPLOYS_PER_WEEK !== null && projectedDeploysPerWeek < MIN_DEPLOYS_PER_WEEK;
const predictiveRisk = severeDropRisk || thresholdDropRisk ? 'elevated' : 'normal';

// ── Change Failure Rate ───────────────────────────────────────────────────────
const reverts = mergeCommits.filter((line) =>
  /revert|Revert/.test(line.slice(line.indexOf(' ', 42))),
).length;
const changeFailureRate =
  deploymentCount > 0
    ? Number(((reverts / deploymentCount) * 100).toFixed(1))
    : 0;

// ── Lead Time for Change ──────────────────────────────────────────────────────
// For each merge commit into main, find the oldest commit in that merge branch
// by looking at the parents of the merge commit.
const leadTimes = [];
for (const line of mergeCommits.slice(0, 20)) {
  // Only take first 20 for speed
  const hash = line.split(' ')[0];
  try {
    const parents = safeGit(`log --pretty=%P -n 1 ${hash}`, '').split(' ');
    if (parents.length < 2) continue; // not a merge commit
    const branchHead = parents[1];
    const mergeTimestamp = Number(safeGit(`log -1 --format=%ct ${hash}`, '0'));
    const branchCommitTimestamps = safeGit(
      `log --format=%ct ${branchHead} ^${parents[0]}`,
      '',
    )
      .split('\n')
      .filter(Boolean)
      .map(Number);
    const branchStartTimestamp =
      branchCommitTimestamps.length > 0
        ? branchCommitTimestamps[branchCommitTimestamps.length - 1]
        : 0;
    if (branchStartTimestamp && mergeTimestamp > branchStartTimestamp) {
      leadTimes.push((mergeTimestamp - branchStartTimestamp) / 3600);
    }
  } catch {
    // skip commits with git errors
  }
}

const leadTimeHours =
  leadTimes.length > 0
    ? Number((leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length).toFixed(1))
    : null;

// ── DORA performance tier ─────────────────────────────────────────────────────
function deployFreqTier(perWeek) {
  if (perWeek >= 7) return 'elite';
  if (perWeek >= 1) return 'high';
  if (perWeek >= 0.25) return 'medium';
  return 'low';
}

function leadTimeTier(hours) {
  if (hours === null) return 'unknown';
  if (hours <= 24) return 'elite';
  if (hours <= 168) return 'high';
  if (hours <= 720) return 'medium';
  return 'low';
}

function cfr_tier(pct) {
  if (pct <= 5) return 'elite';
  if (pct <= 10) return 'high';
  if (pct <= 15) return 'medium';
  return 'low';
}

const output = {
  _schema: '1.0',
  collected_at: new Date().toISOString(),
  window_days: WINDOW_DAYS,
  source: {
    requested_branch: TARGET_BRANCH,
    branch: TARGET_REF,
    lookback_weeks_for_trend: LOOKBACK_WEEKS,
  },
  metrics: {
    deployment_frequency: {
      value: deploymentFrequencyPerWeek,
      unit: 'deploys_per_week',
      raw_count_30d: deploymentCount,
      tier: deployFreqTier(deploymentFrequencyPerWeek),
    },
    lead_time_for_change: {
      value: leadTimeHours,
      unit: 'hours',
      tier: leadTimeTier(leadTimeHours),
      note: leadTimeHours === null ? 'Insufficient merge history to compute' : undefined,
    },
    change_failure_rate: {
      value: changeFailureRate,
      unit: 'percent',
      revert_count_30d: reverts,
      tier: cfr_tier(changeFailureRate),
    },
    mttr: {
      value: null,
      unit: 'hours',
      tier: 'unknown',
      note: 'Requires incident tracker integration (e.g. PagerDuty API)',
    },
    predictive_signal: {
      value: predictiveRisk,
      unit: 'state',
      slope_per_week: slopePerWeek,
      trailing_4_week_average: trailing4WeekAverage,
      projected_next_week_deploys: projectedNextWeekDeploys,
      weekly_deploy_series: weeklyDeployCounts,
    },
  },
};

const enforcementErrors = [];
if (ENFORCE_THRESHOLDS) {
  if (
    MIN_DEPLOYS_PER_WEEK !== null &&
    deploymentFrequencyPerWeek < MIN_DEPLOYS_PER_WEEK
  ) {
    enforcementErrors.push(
      `deployment_frequency ${deploymentFrequencyPerWeek}/week below minimum ${MIN_DEPLOYS_PER_WEEK}/week`,
    );
  }
  if (MAX_LEAD_TIME_HOURS !== null && leadTimeHours !== null && leadTimeHours > MAX_LEAD_TIME_HOURS) {
    enforcementErrors.push(
      `lead_time_for_change ${leadTimeHours}h exceeds maximum ${MAX_LEAD_TIME_HOURS}h`,
    );
  }
  if (
    MAX_CHANGE_FAILURE_RATE_PCT !== null &&
    changeFailureRate > MAX_CHANGE_FAILURE_RATE_PCT
  ) {
    enforcementErrors.push(
      `change_failure_rate ${changeFailureRate}% exceeds maximum ${MAX_CHANGE_FAILURE_RATE_PCT}%`,
    );
  }
  if (predictiveRisk === 'elevated') {
    enforcementErrors.push('predictive deployment trend risk is elevated');
  }
}

ensureOutputDir(OUTPUT);
writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');
console.log(`✓ DORA metrics written to ${OUTPUT}`);
console.log(
  `  Deployment frequency : ${deploymentFrequencyPerWeek}/week (${deploymentCount} merges in 30d) [${output.metrics.deployment_frequency.tier}]`,
);
console.log(
  `  Lead time            : ${leadTimeHours ?? 'n/a'} h [${output.metrics.lead_time_for_change.tier}]`,
);
console.log(
  `  Change failure rate  : ${changeFailureRate}% [${output.metrics.change_failure_rate.tier}]`,
);
console.log(`  MTTR                 : n/a (needs incident tracker)`);
console.log(
  `  Predictive signal    : ${predictiveRisk} (slope ${slopePerWeek}/week, projected ${projectedNextWeekDeploys} deploys next week)`,
);

if (enforcementErrors.length > 0) {
  console.error('✗ DORA threshold enforcement failed:');
  for (const error of enforcementErrors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}
