import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Level 1 (development) typecheck: only the workspace packages that contain
// staged TypeScript files. Dependents and the full workspace are qualified by
// CI (see docs/architecture/VALIDATION_LEVELS.md). --only skips upstream ^build\n// tasks, so the local gate does not rebuild the dependency graph; CI runs the full graph.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staged = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
  cwd: repoRoot,
  encoding: 'utf8',
});
if (staged.status !== 0) {
  console.error('typecheck-changed: unable to read staged files');
  process.exit(1);
}

const names = new Set();
for (const file of staged.stdout.split('\n').map((line) => line.trim()).filter((line) => /\.(ts|tsx)$/.test(line))) {
  let dir = path.dirname(path.resolve(repoRoot, file));
  while (dir.startsWith(repoRoot) && dir !== repoRoot) {
    const manifest = path.join(dir, 'package.json');
    if (existsSync(manifest)) {
      const { name, scripts } = JSON.parse(readFileSync(manifest, 'utf8'));
      if (name && scripts?.typecheck) names.add(name);
      break;
    }
    dir = path.dirname(dir);
  }
}

if (names.size === 0) {
  console.log('typecheck-changed: no staged package defines a typecheck task');
  process.exit(0);
}

console.log(`typecheck-changed: ${[...names].sort().join(', ')}`);
const result = spawnSync(
  'pnpm',
  ['exec', 'turbo', 'run', 'typecheck', ...[...names].sort().map((name) => `--filter=${name}`), '--only', '--concurrency=1', '--output-logs=errors-only'],
  { cwd: repoRoot, stdio: 'inherit', shell: process.platform === 'win32' },
);
process.exit(result.status ?? 1);
