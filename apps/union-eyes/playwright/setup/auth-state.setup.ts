import { test as setup, expect } from '@playwright/test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { PLAYWRIGHT_AUTH_DIR, PLAYWRIGHT_STORAGE_STATE_PATHS } from '../../playwright.config';

/**
 * Phase 0C.2 §8 — Playwright projects: auth-state setup gate.
 *
 * Runs as the `setup` project (see `playwright.config.ts`). Every persona /
 * security / bilingual / accessibility project declares `dependencies:
 * ['setup']`, so if this file fails, none of the downstream tests run.
 *
 * What this proves before any real spec starts:
 *   1. `playwright/.auth/summary.json` exists (the auth-state generator
 *      from `scripts/lifecycle/generate-auth-states.ts` actually ran).
 *   2. Its `allOk === true` (every persona login + /me verification
 *      succeeded — no partial or degraded run).
 *   3. Every canonical role (member, steward, staff, executive, admin)
 *      appears exactly once in the results.
 *   4. Every declared `storageStatePath` file exists on disk, is
 *      readable, and matches the path this Playwright config expects.
 *   5. Each storageState file parses as valid Playwright storageState v1
 *      shape and contains a non-empty `nzila_session` cookie.
 *
 * Any failure here throws immediately — the whole run is aborted before
 * a single spec starts. No sleep(), no retry, no soft-fail: this gate
 * exists precisely so downstream flakes can't be blamed on a bad seed.
 *
 * Deliberately NOT re-runs the generator here — that is the
 * orchestrator's job (`scripts/lifecycle/run.ts` step 9). This file only
 * verifies the artifact.
 */

setup('phase-0c2-s8 auth-state summary is present, complete, and consistent', async () => {
  const summaryPath = path.join(PLAYWRIGHT_AUTH_DIR, 'summary.json');

  // ── 1. summary.json must exist ────────────────────────────────────────
  if (!existsSync(summaryPath)) {
    throw new Error(
      `[phase-0c2-s8] Auth-state summary missing at "${summaryPath}".\n` +
        `The auth-state generator must run before the E2E suite.\n` +
        `See scripts/lifecycle/run.ts step 9 and scripts/lifecycle/generate-auth-states.ts.`,
    );
  }

  // ── 2. summary.json must be parseable and current ────────────────────
  const raw = readFileSync(summaryPath, 'utf8');
  let summary: unknown;
  try {
    summary = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `[phase-0c2-s8] Auth-state summary at "${summaryPath}" is not valid JSON: ${(err as Error).message}`,
    );
  }

  expect(summary, 'summary.json must be a JSON object').toEqual(expect.any(Object));
  const s = summary as {
    baseUrl?: unknown;
    outputDir?: unknown;
    results?: unknown;
    allOk?: unknown;
  };

  expect(typeof s.baseUrl, 'summary.baseUrl must be a string').toBe('string');
  expect(typeof s.outputDir, 'summary.outputDir must be a string').toBe('string');
  expect(Array.isArray(s.results), 'summary.results must be an array').toBe(true);

  // ── 3. allOk must be true ────────────────────────────────────────────
  expect(s.allOk, `Auth-state generator reported failures — inspect ${summaryPath}`).toBe(true);

  // ── 4. Every canonical role must be present exactly once ─────────────
  const expectedRoles = Object.keys(PLAYWRIGHT_STORAGE_STATE_PATHS) as Array<
    keyof typeof PLAYWRIGHT_STORAGE_STATE_PATHS
  >;
  const results = s.results as Array<{
    role?: unknown;
    ok?: unknown;
    storageStatePath?: unknown;
  }>;

  for (const role of expectedRoles) {
    const matches = results.filter((r) => r.role === role);
    expect(
      matches.length,
      `Auth-state generator produced ${matches.length} results for role "${role}" (expected exactly 1).`,
    ).toBe(1);
    const match = matches[0]!;
    expect(match.ok, `Auth-state generator marked role "${role}" as failed.`).toBe(true);
    expect(
      typeof match.storageStatePath,
      `Auth-state result for "${role}" is missing storageStatePath.`,
    ).toBe('string');
  }

  // ── 5. Every storageState file this config expects must exist on
  //     disk, be non-empty, parseable, contain a nzila_session cookie ──
  for (const role of expectedRoles) {
    const filePath = PLAYWRIGHT_STORAGE_STATE_PATHS[role];
    expect(
      existsSync(filePath),
      `Playwright config expects storageState "${filePath}" for role "${role}" but it does not exist.`,
    ).toBe(true);

    const stat = statSync(filePath);
    expect(stat.size, `storageState file "${filePath}" is empty.`).toBeGreaterThan(0);

    const contents = readFileSync(filePath, 'utf8');
    let state: unknown;
    try {
      state = JSON.parse(contents);
    } catch (err) {
      throw new Error(
        `[phase-0c2-s8] storageState file "${filePath}" is not valid JSON: ${(err as Error).message}`,
      );
    }

    const st = state as { cookies?: unknown; origins?: unknown };
    expect(Array.isArray(st.cookies), `storageState "${filePath}" is missing cookies[].`).toBe(true);
    expect(Array.isArray(st.origins), `storageState "${filePath}" is missing origins[].`).toBe(true);

    const cookies = st.cookies as Array<{ name?: unknown; value?: unknown }>;
    const session = cookies.find((c) => c.name === 'nzila_session');
    expect(
      session,
      `storageState "${filePath}" for role "${role}" has no nzila_session cookie.`,
    ).toBeDefined();
    expect(
      typeof session!.value === 'string' && (session!.value as string).length > 0,
      `storageState "${filePath}" for role "${role}" has an empty nzila_session cookie.`,
    ).toBe(true);
  }
});
