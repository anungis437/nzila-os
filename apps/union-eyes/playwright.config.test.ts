import { describe, expect, it, vi } from 'vitest';

// The real getE2EEnv() throws when DATABASE_URL is unset — but for
// config-shape unit tests we don't need a real DB URL. Stub the module
// so `playwright.config.ts` can be imported in a bare vitest run.
vi.mock('./tests/e2e/e2e-env', () => ({
  getE2EEnv: () => ({
    AUTH_SECRET: 'test-secret',
    VOTING_SECRET: 'test-voting-secret',
    QA_TEST_ENV: 'true' as const,
    NODE_ENV: 'test' as const,
    DATABASE_URL: 'postgres://test:test@localhost:5433/test',
    PLAYWRIGHT_BASE_URL: 'http://localhost:3002',
  }),
}));

const configModule = await import('./playwright.config');
const config = configModule.default;
const { PLAYWRIGHT_AUTH_DIR, PLAYWRIGHT_PROJECT_MANIFEST, PLAYWRIGHT_STORAGE_STATE_PATHS } =
  configModule;

/**
 * Phase 0C.2 §8 — Playwright projects: config structure invariants.
 *
 * These tests assert the shape of `playwright.config.ts` so that a
 * regression that (a) drops a project, (b) points a persona at the wrong
 * storageState, (c) forgets a `dependencies: ['setup']` link, or (d)
 * mis-routes a spec into the wrong project can NEVER pass CI silently.
 */

const EXPECTED_PROJECTS = [
  'setup',
  'public',
  'member',
  'steward',
  'staff',
  'admin',
  'executive',
  'security',
  'bilingual-en',
  'bilingual-fr',
  'accessibility',
] as const;

const EXPECTED_STORAGE_STATE_ROLES = ['member', 'steward', 'staff', 'executive', 'admin'] as const;

// Persona projects that MUST point storageState at a real generated file.
const PERSONA_PROJECTS: ReadonlyArray<{
  name: string;
  role: (typeof EXPECTED_STORAGE_STATE_ROLES)[number];
}> = [
  { name: 'member', role: 'member' },
  { name: 'steward', role: 'steward' },
  { name: 'staff', role: 'staff' },
  { name: 'admin', role: 'admin' },
  { name: 'executive', role: 'executive' },
];

// Bilingual-en/fr default to `member` per config.
const BILINGUAL_PROJECTS = ['bilingual-en', 'bilingual-fr'] as const;

// Every project that consumes generated auth state must depend on `setup`.
const SETUP_DEPENDENT_PROJECTS = [
  'member',
  'steward',
  'staff',
  'admin',
  'executive',
  'security',
  'bilingual-en',
  'bilingual-fr',
  'accessibility',
] as const;

// Projects that must start unauthenticated (empty storageState).
const UNAUTHENTICATED_PROJECTS = ['security', 'accessibility'] as const;

describe('phase-0c2-s8 playwright.config.ts — project structure', () => {
  it('declares exactly the 11 canonical project names in the expected order', () => {
    expect(config.projects).toBeDefined();
    const names = (config.projects ?? []).map((p) => p.name);
    expect(names).toEqual([...EXPECTED_PROJECTS]);
  });

  it('exports PLAYWRIGHT_AUTH_DIR = "playwright/.auth"', () => {
    expect(PLAYWRIGHT_AUTH_DIR).toBe('playwright/.auth');
  });

  it('exports PLAYWRIGHT_STORAGE_STATE_PATHS with all five canonical roles under playwright/.auth/', () => {
    const keys = Object.keys(PLAYWRIGHT_STORAGE_STATE_PATHS).sort();
    expect(keys).toEqual([...EXPECTED_STORAGE_STATE_ROLES].sort());
    for (const role of EXPECTED_STORAGE_STATE_ROLES) {
      expect(PLAYWRIGHT_STORAGE_STATE_PATHS[role]).toBe(`playwright/.auth/${role}.json`);
    }
  });

  it('PLAYWRIGHT_PROJECT_MANIFEST exposes every project so tooling can discover routing', () => {
    const keys = Object.keys(PLAYWRIGHT_PROJECT_MANIFEST).sort();
    expect(keys).toEqual([...EXPECTED_PROJECTS].sort());
  });
});

describe('phase-0c2-s8 playwright.config.ts — setup gate', () => {
  it('setup project points at playwright/setup/auth-state.setup.ts', () => {
    const setup = (config.projects ?? []).find((p) => p.name === 'setup');
    expect(setup, 'setup project missing').toBeDefined();
    expect(setup!.testMatch).toEqual(['playwright/setup/auth-state.setup.ts']);
  });

  it('setup project does NOT declare storageState (it verifies, does not consume)', () => {
    const setup = (config.projects ?? []).find((p) => p.name === 'setup');
    // storageState is undefined on the setup project itself
    expect(setup!.use?.storageState).toBeUndefined();
  });

  it('setup project has no dependencies (runs first)', () => {
    const setup = (config.projects ?? []).find((p) => p.name === 'setup');
    expect(setup!.dependencies ?? []).toEqual([]);
  });
});

describe('phase-0c2-s8 playwright.config.ts — persona projects', () => {
  it.each(PERSONA_PROJECTS)(
    '$name project uses storageState playwright/.auth/$role.json and depends on setup',
    ({ name, role }) => {
      const project = (config.projects ?? []).find((p) => p.name === name);
      expect(project, `${name} project missing`).toBeDefined();
      expect(project!.use?.storageState).toBe(`playwright/.auth/${role}.json`);
      expect(project!.dependencies).toContain('setup');
    },
  );

  it.each(BILINGUAL_PROJECTS)(
    '%s project uses the member storageState (bilingual seed) and depends on setup',
    (name) => {
      const project = (config.projects ?? []).find((p) => p.name === name);
      expect(project, `${name} project missing`).toBeDefined();
      expect(project!.use?.storageState).toBe(PLAYWRIGHT_STORAGE_STATE_PATHS.member);
      expect(project!.dependencies).toContain('setup');
    },
  );

  it('bilingual-en uses locale en-CA and bilingual-fr uses locale fr-CA', () => {
    const en = (config.projects ?? []).find((p) => p.name === 'bilingual-en');
    const fr = (config.projects ?? []).find((p) => p.name === 'bilingual-fr');
    expect(en!.use?.locale).toBe('en-CA');
    expect(fr!.use?.locale).toBe('fr-CA');
  });
});

describe('phase-0c2-s8 playwright.config.ts — unauthenticated projects', () => {
  it.each(UNAUTHENTICATED_PROJECTS)(
    '%s project starts with an empty storageState (cold session)',
    (name) => {
      const project = (config.projects ?? []).find((p) => p.name === name);
      expect(project, `${name} project missing`).toBeDefined();
      expect(project!.use?.storageState).toEqual({ cookies: [], origins: [] });
      expect(project!.dependencies).toContain('setup');
    },
  );

  it('public project has NO storageState and NO setup dependency (fully independent)', () => {
    const pub = (config.projects ?? []).find((p) => p.name === 'public');
    expect(pub!.use?.storageState).toBeUndefined();
    expect(pub!.dependencies ?? []).toEqual([]);
  });
});

describe('phase-0c2-s8 playwright.config.ts — dependency graph', () => {
  it.each(SETUP_DEPENDENT_PROJECTS)('%s project depends on setup', (name) => {
    const project = (config.projects ?? []).find((p) => p.name === name);
    expect(project, `${name} project missing`).toBeDefined();
    expect(project!.dependencies, `${name} must depend on ['setup']`).toContain('setup');
  });
});

describe('phase-0c2-s8 playwright.config.ts — spec routing (testMatch)', () => {
  // Sanity: no spec is routed to more than one project (except by
  // pattern-based bilingual/accessibility projects which point at
  // different directories that don't overlap existing specs).
  it('no explicit spec path is duplicated across project testMatch lists', () => {
    const explicitPaths: string[] = [];
    for (const [name, matches] of Object.entries(PLAYWRIGHT_PROJECT_MANIFEST)) {
      // Skip pattern-based projects (bilingual/accessibility use globs)
      if (name.startsWith('bilingual-') || name === 'accessibility' || name === 'setup') continue;
      for (const m of matches) {
        // Only track explicit .spec.ts paths, not glob patterns
        if (m.includes('*')) continue;
        explicitPaths.push(m);
      }
    }
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const p of explicitPaths) {
      if (seen.has(p)) dupes.push(p);
      seen.add(p);
    }
    expect(dupes, `Duplicate spec routing detected: ${dupes.join(', ')}`).toEqual([]);
  });

  it('routes known persona-primary specs to the expected project', () => {
    const cases: ReadonlyArray<{ spec: string; project: keyof typeof PLAYWRIGHT_PROJECT_MANIFEST }> = [
      { spec: 'e2e/member-journey.spec.ts', project: 'member' },
      { spec: 'tests/e2e/member-intake.spec.ts', project: 'member' },
      { spec: 'tests/e2e/steward-review.spec.ts', project: 'steward' },
      { spec: 'tests/e2e/case-escalation.spec.ts', project: 'staff' },
      { spec: 'tests/e2e/admin-assignment.spec.ts', project: 'admin' },
      { spec: 'e2e/cba-intelligence.spec.ts', project: 'executive' },
    ];
    for (const { spec, project } of cases) {
      const matches = PLAYWRIGHT_PROJECT_MANIFEST[project] as readonly string[];
      expect(matches, `${project} project testMatch missing`).toBeDefined();
      expect(matches, `${spec} must be routed to project "${project}"`).toContain(spec);
    }
  });

  it('routes negative / cross-org specs to the security project', () => {
    const securityMatches = PLAYWRIGHT_PROJECT_MANIFEST.security as readonly string[];
    for (const spec of [
      'tests/e2e/cross-org-block.spec.ts',
      'tests/e2e/org-isolation-negative.spec.ts',
      'tests/e2e/auth-failure-handling.spec.ts',
      'tests/e2e/auth-session-switch.spec.ts',
      'tests/e2e/evidence-misuse.spec.ts',
      'tests/e2e/negative-workflow-transitions.spec.ts',
    ]) {
      expect(securityMatches, `${spec} must be in security project`).toContain(spec);
    }
  });

  it('routes truly public/unauthenticated specs to the public project', () => {
    const publicMatches = PLAYWRIGHT_PROJECT_MANIFEST.public as readonly string[];
    for (const spec of [
      'e2e/smoke.spec.ts',
      'e2e/pilot-mode-gating.spec.ts',
      'e2e/no-fsm-overexposure.spec.ts',
    ]) {
      expect(publicMatches, `${spec} must be in public project`).toContain(spec);
    }
  });

  it('bilingual & accessibility projects use glob patterns (populated by §13 / §14)', () => {
    expect(PLAYWRIGHT_PROJECT_MANIFEST['bilingual-en']).toEqual([
      'e2e/bilingual/**/*.en.spec.ts',
    ]);
    expect(PLAYWRIGHT_PROJECT_MANIFEST['bilingual-fr']).toEqual([
      'e2e/bilingual/**/*.fr.spec.ts',
    ]);
    expect(PLAYWRIGHT_PROJECT_MANIFEST.accessibility).toEqual(['e2e/a11y/**/*.spec.ts']);
  });
});

describe('phase-0c2-s8 playwright.config.ts — global settings preserved', () => {
  it('workers is 1 (single-worker; §15 will evaluate multi-worker separately)', () => {
    expect(config.workers).toBe(1);
  });

  it('fullyParallel is false (avoids destabilising the baseline before §10)', () => {
    expect(config.fullyParallel).toBe(false);
  });

  it('timeout stays at 60_000ms (no timeout inflation)', () => {
    expect(config.timeout).toBe(60_000);
  });
});
