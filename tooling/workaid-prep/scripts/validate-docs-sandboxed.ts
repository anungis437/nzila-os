/**
 * Runs the repository's own documentation-consistency validator without
 * letting it write anywhere that matters (WA-C-002).
 *
 * The repository script derives its output directory from the current working
 * directory and writes `reports/doc-consistency.{json,md}` there. Run from a
 * checkout it would modify tracked files. So:
 *   - the validator source is read from THIS worktree (unmodified platform file);
 *   - it is executed by plain `node` (type stripping), not by another checkout's tooling;
 *   - the working directory is a temporary sandbox containing only a copy of the
 *     WorkAid docs and tooling plus the workspace marker file it looks for;
 *   - reports are therefore written into the sandbox, which is then deleted.
 *
 *   node scripts/validate-docs-sandboxed.ts
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { preflight, repoRoot, safeCopyTree, safeRemoveTemp, safeTempDir, safeWrite } from './guard.ts';

export interface SandboxedValidation {
  readonly exitCode: number | null;
  readonly errors: number;
  readonly warnings: number;
  readonly info: number;
  readonly findingsByRule: Record<string, number>;
  readonly warningDetails: readonly unknown[];
  readonly sandboxWasUnderTemp: boolean;
  readonly worktreeReportsUntouched: boolean;
  readonly validatorSource: string;
}

const reportsStatus = () => execFileSync('git', ['--no-optional-locks', 'status', '--porcelain', '--', 'reports'], { cwd: repoRoot, encoding: 'utf8' }).trim();

export function validateDocsSandboxed(): SandboxedValidation {
  preflight();
  const validator = join(repoRoot, 'packages', 'platform-validation', 'src', 'doc-consistency.ts');
  if (!existsSync(validator)) throw new Error('validator source missing from this worktree');
  const before = reportsStatus();
  const sandbox = safeTempDir('workaid-docs-validate-');
  try {
    safeCopyTree(join(repoRoot, 'docs', 'union-eyes', 'workaid'), join(sandbox, 'docs', 'union-eyes', 'workaid'));
    safeCopyTree(join(repoRoot, 'tooling', 'workaid-prep'), join(sandbox, 'tooling', 'workaid-prep'));
    safeWrite(join(sandbox, 'pnpm-workspace.yaml'), '# sandbox marker so the validator resolves its root here\n');
    const run = spawnSync(process.execPath, [validator], { cwd: sandbox, encoding: 'utf8', env: { ...process.env, NODE_NO_WARNINGS: '1' } });
    const reportPath = join(sandbox, 'reports', 'doc-consistency.json');
    const report = existsSync(reportPath) ? (JSON.parse(readFileSync(reportPath, 'utf8')) as { findingsBySeverity: Record<string, number>; findings: { rule: string; file: string; severity: string }[] }) : null;
    const mine = report?.findings.filter((f) => f.file.startsWith('docs/union-eyes/workaid/')) ?? [];
    const byRule: Record<string, number> = {};
    for (const f of mine) byRule[`${f.rule}/${f.severity}`] = (byRule[`${f.rule}/${f.severity}`] ?? 0) + 1;
    return {
      exitCode: run.status,
      errors: report?.findingsBySeverity['error'] ?? -1,
      warnings: report?.findingsBySeverity['warning'] ?? -1,
      info: report?.findingsBySeverity['info'] ?? -1,
      findingsByRule: byRule,
      warningDetails: mine.filter((f) => f.severity === 'warning'),
      sandboxWasUnderTemp: true,
      worktreeReportsUntouched: reportsStatus() === before,
      validatorSource: 'packages/platform-validation/src/doc-consistency.ts (this worktree)',
    };
  } finally {
    safeRemoveTemp(sandbox);
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop()!)) {
  const r = validateDocsSandboxed();
  console.log(JSON.stringify(r, null, 2));
  if (r.errors !== 0 || !r.worktreeReportsUntouched) process.exitCode = 1;
}
