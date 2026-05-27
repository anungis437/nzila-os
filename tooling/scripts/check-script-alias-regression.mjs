#!/usr/bin/env node

import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const scripts = pkg.scripts ?? {};

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

if (violations.length === 0) {
  console.log('script-alias-guard: PASS (no thin wrapper aliases detected)');
  process.exit(0);
}

console.error('script-alias-guard: FAIL');
console.error('Detected thin wrapper aliases in package.json scripts:');
for (const violation of violations) {
  console.error(`- ${violation.name} [${violation.pattern}] -> ${violation.command}`);
}
console.error('Use explicit commands directly in docs/workflows, and keep scripts for true entrypoints/composites only.');
process.exit(1);
