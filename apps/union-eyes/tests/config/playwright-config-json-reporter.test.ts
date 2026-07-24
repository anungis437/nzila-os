import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Phase 0C.2R §3.1 evidence-infrastructure guard.
 *
 * `apps/union-eyes/playwright.config.ts` MUST unconditionally emit a JSON
 * reporter so every governed lifecycle run (`scripts/lifecycle/run.ts`) and
 * every ad-hoc developer run produces a stable, per-test artefact that can
 * be reconciled across the mandated three-run baseline (§3).
 *
 * Runs 1 and 2 of §BR-9 were reconstruction-only because no JSON reporter
 * existed at the time. This regression test locks the reporter in place so
 * that gap cannot silently reopen.
 *
 * We deliberately assert against the RAW SOURCE TEXT of the config file
 * (rather than importing and evaluating it) so this test:
 *   • has zero runtime dependency on @playwright/test
 *   • cannot be defeated by a `process.env.CI` branch flipping at test time
 *   • runs cleanly under the union-eyes vitest project
 */
describe("playwright.config.ts — JSON reporter (Phase 0C.2R §3.1)", () => {
  const configPath = path.resolve(__dirname, "../../playwright.config.ts");
  const source = fs.readFileSync(configPath, "utf8");

  it("exists at the canonical path", () => {
    expect(fs.existsSync(configPath)).toBe(true);
  });

  it("declares a `reporter:` property", () => {
    expect(source).toMatch(/\breporter\s*:/);
  });

  it("wires a JSON reporter entry", () => {
    // Matches: ['json', { outputFile: ... }]
    expect(source).toMatch(/\[\s*['"]json['"]\s*,\s*\{[^}]*outputFile\s*:/);
  });

  it("keys the JSON output file by NZILA_E2E_RUN_ID", () => {
    expect(source).toContain("NZILA_E2E_RUN_ID");
    // The outputFile expression must reference the run-id env var.
    const runIdMatches = source.match(
      /outputFile\s*:\s*`[^`]*NZILA_E2E_RUN_ID[^`]*`/g,
    );
    expect(runIdMatches, "outputFile must reference NZILA_E2E_RUN_ID").not.toBeNull();
    expect((runIdMatches ?? []).length).toBeGreaterThanOrEqual(2); // one CI, one local
  });

  it("emits the JSON reporter in BOTH the CI and non-CI branches", () => {
    // The reporter block uses a `process.env.CI ? [...] : [...]` ternary.
    // Each branch must contain its own `['json', { outputFile: ... }]` entry.
    // We count `'json'` reporter-array headers — this is robust against the
    // `${process.env.NZILA_E2E_RUN_ID ?? 'ci'}` template-literal interpolation
    // (which contains an unbalanced `}` from the `?? 'ci'}` expression and
    // therefore defeats naive `\[...\]` bracket matching).
    const jsonEntryHeaders =
      source.match(/\[\s*['"]json['"]\s*,\s*\{/g) ?? [];
    expect(
      jsonEntryHeaders.length,
      "expected JSON reporter entry in BOTH the CI and non-CI ternary branches",
    ).toBe(2);
  });

  it("writes JSON output under test-results/ so it is picked up by artefact collection", () => {
    expect(source).toMatch(/outputFile\s*:\s*`test-results\/results-/);
  });
});
