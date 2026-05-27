#!/usr/bin/env tsx
/**
 * @nzila/openapi-gen — CLI entry point
 *
 * Usage:
 *   pnpm exec tsx tooling/openapi-gen/src/cli.ts                 # generate all specs as JSON
 *   pnpm exec tsx tooling/openapi-gen/src/cli.ts --format yaml   # YAML output
 *   pnpm exec tsx tooling/openapi-gen/src/cli.ts --apps web,console  # specific apps only
 *   pnpm exec tsx tooling/openapi-gen/src/cli.ts --no-combined   # skip combined spec
 */

import { resolve } from 'node:path';
import { generate } from './generator.js';
import type { GeneratorConfig } from './types.js';

const args = process.argv.slice(2);

function getFlag(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const rootDir = resolve(import.meta.dirname ?? __dirname, '..', '..', '..');
const outputDir = resolve(rootDir, 'docs', 'api', 'specs');
const format = (getFlag('format') ?? 'json') as 'json' | 'yaml';
const appsFilter = getFlag('apps')?.split(',');
const combined = !args.includes('--no-combined');

const config: GeneratorConfig = {
  rootDir,
  outputDir,
  format,
  apps: appsFilter,
  combined,
};

console.log('\n  @nzila/openapi-gen');
console.log('  ─────────────────\n');
console.log(`  Root:     ${rootDir}`);
console.log(`  Output:   ${outputDir}`);
console.log(`  Format:   ${format}`);
console.log(`  Apps:     ${appsFilter?.join(', ') ?? 'all'}`);
console.log(`  Combined: ${combined}\n`);

const result = generate(config);

console.log(`  Routes discovered: ${result.totalRoutes}`);
console.log(`  With Zod schemas:  ${result.routesWithSchemas}`);
console.log();

for (const app of result.apps) {
  console.log(`  ${app.name.padEnd(20)} ${app.routeCount} routes → ${app.specPath}`);
}

if (result.combinedSpecPath) {
  console.log(`\n  Combined spec → ${result.combinedSpecPath}`);
}

console.log();
