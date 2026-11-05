/**
 * Static guard (directive 2026-11-04 item 4): infrastructure must never ship
 * a test-authentication or risk-bypass switch to a deployed environment.
 *
 * Scans every file under `infrastructure/bicep/**` and `.github/workflows/**`.
 * Any mention of a switch from `TEST_BYPASS_SWITCHES` fails, unless it sits
 * inside a workflow job on the allow-list below. Allow-listed jobs are also
 * checked for Azure deployment commands, so a job cannot be both allow-listed
 * and a deployer.
 *
 * The runtime half is `lib/reality/test-bypass-guard.ts`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEST_BYPASS_SWITCHES } from '../test-bypass-guard';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const SCAN_ROOTS = ['infrastructure/bicep', '.github/workflows'];

interface AllowedJob {
  file: string;
  job: string;
  reason: string;
}

/**
 * The only places a bypass switch may appear. Each entry names a workflow
 * job that runs the app on the GitHub runner against `localhost` with a
 * throwaway Postgres container, then discards it.
 */
const ALLOWED_JOBS: readonly AllowedJob[] = [
  {
    file: '.github/workflows/e2e.yml',
    job: 'e2e',
    reason:
      'Playwright suite against the standalone server started on the runner (localhost:<port>) with the ' +
      'ephemeral ci_e2e Postgres container; UE_ENVIRONMENT=local. Seeded QA personas need PLAYWRIGHT_TEST_AUTH ' +
      'and UE_E2E_RISK_BYPASS to log in without MFA enrolment; QA_TEST_ENV selects the credential-free seed.',
  },
  {
    file: '.github/workflows/e2e.yml',
    job: 'e2e-canonical',
    reason:
      'Same as e2e, run after a push to main: a fresh synthetic ci_e2e Postgres container on the runner (no ' +
      'staging snapshot, no Azure login), the server on localhost with UE_ENVIRONMENT=local, discarded with the runner.',
  },
];

/**
 * Commands that would mean a job changes deployed Azure resources. Logging
 * in alone is not enough to count as one.
 */
const DEPLOYMENT_MARKERS = [
  /\baz\s+containerapp\b/,
  /\baz\s+deployment\b/,
  /\baz\s+webapp\b/,
  /azure\/arm-deploy@/,
  /azure\/container-apps-deploy-action@/,
];

const SWITCH_PATTERN = new RegExp(`\\b(${TEST_BYPASS_SWITCHES.map((sw) => sw.name).join('|')})\\b`);

function walk(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Map each line of a workflow to the job id it belongs to (top-level `jobs:` keys). */
function jobForEachLine(lines: string[]): (string | null)[] {
  let inJobs = false;
  let current: string | null = null;
  return lines.map((line) => {
    if (/^jobs:\s*$/.test(line)) {
      inJobs = true;
      current = null;
      return null;
    }
    if (/^\S/.test(line) && !line.startsWith('#')) {
      inJobs = false;
      current = null;
    }
    const match = inJobs ? /^ {2}([A-Za-z0-9_-]+):\s*(#.*)?$/.exec(line) : null;
    if (match) current = match[1];
    return current;
  });
}

interface Finding {
  file: string;
  line: number;
  job: string | null;
  switchName: string;
}

/**
 * A whole-line comment documents a switch (for example "never set here: PLAYWRIGHT_TEST_AUTH"); it cannot set one.
 * YAML comments start with `#`; Bicep comments with `//`, or `/*` / `*` inside a block comment. A switch after code on
 * the same line is still a finding.
 */
function isCommentOnly(rel: string, text: string): boolean {
  const t = text.trim();
  if (rel.endsWith('.yml') || rel.endsWith('.yaml')) return t.startsWith('#');
  return t.startsWith('//') || t.startsWith('/*') || t.startsWith('*');
}

function scan(): Finding[] {
  const findings: Finding[] = [];
  for (const root of SCAN_ROOTS) {
    for (const abs of walk(path.join(REPO_ROOT, root))) {
      const rel = path.relative(REPO_ROOT, abs).split(path.sep).join('/');
      const lines = readFileSync(abs, 'utf8').split('\n');
      const jobs = rel.startsWith('.github/workflows/') ? jobForEachLine(lines) : lines.map(() => null);
      lines.forEach((text, i) => {
        if (isCommentOnly(rel, text)) return;
        const match = SWITCH_PATTERN.exec(text);
        if (match) findings.push({ file: rel, line: i + 1, job: jobs[i], switchName: match[1] });
      });
    }
  }
  return findings;
}

function isAllowed(finding: Finding): boolean {
  return ALLOWED_JOBS.some((a) => a.file === finding.file && a.job === finding.job);
}

describe('infrastructure never ships test-auth / risk-bypass switches', () => {
  const findings = scan();

  it('ignores whole-line comments only, never a switch set after code', () => {
    expect(isCommentOnly('.github/workflows/x.yml', '# Never set here: PLAYWRIGHT_TEST_AUTH')).toBe(true);
    expect(isCommentOnly('.github/workflows/x.yml', '  PLAYWRIGHT_TEST_AUTH: "1" # set')).toBe(false);
    expect(isCommentOnly('infrastructure/bicep/a.bicep', '  // UE_E2E_RISK_BYPASS is refused')).toBe(true);
    expect(isCommentOnly('infrastructure/bicep/a.bicep', " { name: 'UE_E2E_RISK_BYPASS', value: '1' } // no")).toBe(false);
  });

  it('scans both roots', () => {
    expect(walk(path.join(REPO_ROOT, '.github/workflows')).length).toBeGreaterThan(0);
    expect(walk(path.join(REPO_ROOT, 'infrastructure/bicep')).length).toBeGreaterThan(0);
  });

  it('no Bicep file or non-allow-listed workflow job mentions a bypass switch', () => {
    const violations = findings
      .filter((f) => !isAllowed(f))
      .map((f) => `${f.file}:${f.line} [job=${f.job ?? '-'}] ${f.switchName}`);
    expect(violations, 'Remove the setting; deployed environments must not carry it').toEqual([]);
  });

  it.each(ALLOWED_JOBS)('allow-listed job $file#$job exists, changes no Azure resource, and pins UE_ENVIRONMENT=local', (allowed) => {
    expect(allowed.reason.length).toBeGreaterThan(40);
    const lines = readFileSync(path.join(REPO_ROOT, allowed.file), 'utf8').split('\n');
    const jobs = jobForEachLine(lines);
    const body = lines.filter((_, i) => jobs[i] === allowed.job);
    expect(body.length, `job ${allowed.job} not found in ${allowed.file}`).toBeGreaterThan(0);
    for (const marker of DEPLOYMENT_MARKERS) {
      expect(body.some((l) => marker.test(l)), `${allowed.job} must not match ${marker}`).toBe(false);
    }
    const text = body.join('\n');
    if (/\b(PLAYWRIGHT_TEST_AUTH|UE_E2E_RISK_BYPASS):/.test(text)) {
      expect(text).toMatch(/UE_ENVIRONMENT:\s*(local\b|\$\{\{[^}]*'local')/);
    }
  });

  it('every allow-list entry is still used (no stale exemptions)', () => {
    for (const allowed of ALLOWED_JOBS) {
      expect(
        findings.some((f) => f.file === allowed.file && f.job === allowed.job),
        `${allowed.file}#${allowed.job} no longer sets a bypass switch; drop it from ALLOWED_JOBS`,
      ).toBe(true);
    }
  });
});
