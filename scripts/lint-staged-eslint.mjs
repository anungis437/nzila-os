import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const stagedFiles = process.argv.slice(2)
  .map((filePath) => filePath.trim())
  .filter(Boolean)
  .map((filePath) => path.resolve(repoRoot, filePath));

const eslintConfigNames = [
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc.yaml',
  '.eslintrc.yml',
];

function findLintRoot(filePath) {
  let currentDir = path.dirname(filePath);

  while (currentDir.startsWith(repoRoot)) {
    const hasEslintConfig = eslintConfigNames.some((configName) =>
      existsSync(path.join(currentDir, configName)),
    );

    if (hasEslintConfig) {
      return currentDir;
    }

    if (currentDir === repoRoot) {
      break;
    }

    currentDir = path.dirname(currentDir);
  }

  return null;
}

const filesByLintRoot = new Map();

for (const filePath of stagedFiles) {
  if (!existsSync(filePath)) {
    continue;
  }

  const lintRoot = findLintRoot(filePath);
  if (!lintRoot) {
    console.warn(`Skipping staged lint for ${path.relative(repoRoot, filePath)}; no ESLint config found.`);
    continue;
  }

  const relativeFile = path.relative(lintRoot, filePath);
  const fileList = filesByLintRoot.get(lintRoot) ?? [];
  fileList.push(relativeFile);
  filesByLintRoot.set(lintRoot, fileList);
}

let exitCode = 0;

for (const [lintRoot, filePaths] of filesByLintRoot.entries()) {
  const dedupedFiles = [...new Set(filePaths)];
  const result = spawnSync('pnpm', ['exec', 'eslint', ...dedupedFiles], {
    cwd: lintRoot,
    stdio: 'inherit',
    // shell:true is required on Windows so that Node can locate the `pnpm.cmd`
    // shim on PATH. Without it, spawnSync fails with ENOENT before ESLint runs
    // and the hook exits 1 with no diagnostic output.
    shell: process.platform === 'win32',
  });

  if (result.error) {
    console.error(`lint-staged-eslint: failed to spawn ESLint in ${lintRoot}: ${result.error.message}`);
    exitCode = 1;
    continue;
  }

  if (result.status !== 0) {
    exitCode = result.status ?? 1;
  }
}

process.exit(exitCode);