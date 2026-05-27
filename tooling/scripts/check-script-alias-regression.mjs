#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const scripts = pkg.scripts ?? {};
const BASELINE_PATH = path.join('tooling', 'scripts', 'baselines', 'script-alias-regression-baseline.json');
const WRITE_BASELINE = process.argv.includes('--write-baseline');

// Guardrail: disallow thin wrapper aliases that only expose direct script executors.
const forbiddenPatterns = [
  { label: 'tsx-root', regex: /^\s*tsx\s+/ },
  { label: 'node-root', regex: /^\s*node\s+(scripts|tooling\/scripts)\// },
  { label: 'pnpm-exec-tsx-root', regex: /^\s*pnpm\s+exec\s+tsx\s+/ }
];

const violations = [];
for (const [name, command] of Object.entries(scripts)) {
  for (const pattern of forbiddenPatterns) {
    if (pattern.regex.test(command)) {
      violations.push({ name, command, pattern: pattern.label });
      break;
    }
  }

  // Detect thin alias forwarding like: "pnpm some:alias".
  // Ignore composed commands (&&, ||, ;) and non-alias pnpm forms (exec/filter).
  const isSingleStep = !command.includes('&&') && !command.includes('||') && !command.includes(';');
  if (isSingleStep) {
    const m = command.match(/^\s*pnpm\s+([^\s]+)/i);
    if (m) {
      const token = m[1];
      const isAliasLike = token.includes(':');
      const isNonAliasPnpmForm = token === 'exec' || token === '--filter' || token.startsWith('-');
      if (isAliasLike && !isNonAliasPnpmForm) {
        violations.push({ name, command, pattern: 'pnpm-alias-forward' });
      }
    }
  }
}

function toBaselineKey(violation) {
  return `${violation.name}::${violation.pattern}`;
}

function sortViolations(rows) {
  return [...rows].sort((left, right) => {
    const leftKey = toBaselineKey(left);
    const rightKey = toBaselineKey(right);
    return leftKey.localeCompare(rightKey);
  });
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) {
    return [];
  }

  const raw = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  if (!raw || !Array.isArray(raw.violations)) {
    throw new Error(`Invalid baseline format in ${BASELINE_PATH}`);
  }

  return raw.violations
    .filter((item) => item && typeof item.name === 'string' && typeof item.pattern === 'string')
    .map((item) => ({ name: item.name, pattern: item.pattern }));
}

function writeBaseline(rows) {
  const dir = path.dirname(BASELINE_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    violations: sortViolations(rows),
  };
  fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

if (WRITE_BASELINE) {
  writeBaseline(violations.map(({ name, pattern }) => ({ name, pattern })));
  console.log(`script-alias-guard: baseline written to ${BASELINE_PATH} (${violations.length} entries)`);
  process.exit(0);
}

const baselineViolations = loadBaseline();
const baselineKeys = new Set(baselineViolations.map(toBaselineKey));
const currentViolations = violations.map(({ name, command, pattern }) => ({ name, command, pattern }));
const newViolations = sortViolations(currentViolations).filter((violation) => !baselineKeys.has(toBaselineKey(violation)));

if (newViolations.length === 0) {
  console.log('script-alias-guard: PASS (no thin wrapper aliases detected)');
  if (currentViolations.length > 0) {
    console.log(`script-alias-guard: baseline contains ${baselineViolations.length} known legacy aliases; no new regressions.`);
  }
  process.exit(0);
}

console.error('script-alias-guard: FAIL');
console.error('Detected new thin wrapper aliases in package.json scripts:');
for (const violation of newViolations) {
  console.error(`- ${violation.name} [${violation.pattern}] -> ${violation.command}`);
}
console.error('Use explicit commands directly in docs/workflows, and keep scripts for true entrypoints/composites only.');
console.error(`If these are intentionally accepted, update baseline with: node tooling/scripts/check-script-alias-regression.mjs --write-baseline`);
process.exit(1);
