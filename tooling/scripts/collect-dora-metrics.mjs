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
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const OUTPUT = resolve(ROOT, 'ops/outputs/dora-metrics.json');

function git(args) {
  return execSync(`git -C "${ROOT}" ${args}`, { encoding: 'utf8' }).trim();
}

// ── Deployment Frequency ─────────────────────────────────────────────────────
// Count merges to main in the last 30 days
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .split('T')[0];

let mergeCommits;
try {
  mergeCommits = git(
    `log main --merges --since="${thirtyDaysAgo}" --format="%H %ai %s"`,
  ).split('\n').filter(Boolean);
} catch {
  mergeCommits = [];
}

const deploymentCount = mergeCommits.length;
const deploymentFrequencyPerWeek =
  deploymentCount > 0 ? Number((deploymentCount / 4.3).toFixed(2)) : 0;

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
    const parents = git(`log --pretty=%P -n 1 ${hash}`).split(' ');
    if (parents.length < 2) continue; // not a merge commit
    const branchHead = parents[1];
    const mergeTimestamp = Number(git(`log -1 --format=%ct ${hash}`));
    const branchCommitTimestamps = git(
      `log --format=%ct ${branchHead} ^${parents[0]}`,
    ).split('\n').filter(Boolean).map(Number);
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
  window_days: 30,
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
  },
};

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
