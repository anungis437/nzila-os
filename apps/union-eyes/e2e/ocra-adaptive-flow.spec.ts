/**
 * E2E SPEC — OCRA Adaptive Live Flow
 *
 * SCOPE: Live respondent flow end-to-end with three representative
 * organizational profiles + recovery + bilingual parity.
 *
 * STATUS: SCAFFOLD. Some scenarios are wired up; the deeper interactions
 * (full 7-section traversal, PDF download verification) are deliberately
 * marked `test.skip` until stable data-testid attributes are in place on
 * the entire question bank.
 *
 * The data-testid attributes added during the hardening sprint:
 *   - data-testid="icra-consent-step"
 *   - data-testid="icra-org-context-step"
 *   - data-testid="icra-adaptive-explanation-card"
 *   - data-testid="icra-adaptive-continue"
 *   - data-testid="icra-section-step"
 *   - data-testid="icra-assessment-flow"
 *   - data-testid="icra-question-${id}"    (per-question wrapper inside a section)
 *   - data-testid="icra-org-question-${id}" (per-question wrapper in org context step)
 *   - data-testid="adaptive-interpretation-block" (results page)
 *
 * RUN: `pnpm --filter @nzila/union-eyes test:e2e` (Playwright)
 */

import { expect, test } from '@playwright/test';

const ASSESSMENT_PATH_EN = '/en-CA/continuity-assessment';
const ASSESSMENT_PATH_FR = '/fr-CA/continuity-assessment';

test.describe('OCRA adaptive live flow — smoke', () => {
  test('renders the consent step and exposes the assessment flow root', async ({
    page,
  }) => {
    await page.goto(ASSESSMENT_PATH_EN);
    await expect(
      page.getByTestId('icra-assessment-flow').first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByTestId('icra-consent-step').first(),
    ).toBeVisible();
  });

  test('fr-CA route renders the assessment flow', async ({ page }) => {
    await page.goto(ASSESSMENT_PATH_FR);
    await expect(
      page.getByTestId('icra-assessment-flow').first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('OCRA adaptive live flow — telemetry privacy (network)', () => {
  test('telemetry POSTs never carry org names or free text', async ({
    page,
  }) => {
    const violations: string[] = [];
    page.on('request', (req) => {
      if (!req.url().includes('/api/icra/telemetry')) return;
      const post = req.postData() ?? '';
      const forbiddenPatterns = [
        /\borgName\b/,
        /\bemail\b/,
        /\bphone\b/,
        /\bprimary_challenge\b/,
        /\bfree_text\b/,
      ];
      for (const re of forbiddenPatterns) {
        if (re.test(post)) violations.push(`${re.source}: ${post.slice(0, 100)}`);
      }
    });

    await page.goto(ASSESSMENT_PATH_EN);
    // Give the page a moment to settle any initial telemetry beacon
    await page.waitForLoadState('networkidle');
    expect(violations).toEqual([]);
  });
});

// ─── Deeper interaction scenarios — kept skipped until stable selectors land
// across every question component. Authors completing the hardening sprint
// can enable these incrementally.

test.describe('OCRA adaptive live flow — full traversal', () => {
  test('per-question testid attributes are wired in the assessment flow source', async () => {
    // Doctrine guard: the data-testid="icra-question-${id}" hook is the
    // anchor every full-traversal test will rely on. If this drifts away
    // from the source, every traversal test will silently break. We keep
    // the deep traversal tests scaffolded (skipped) below, but lock the
    // selector contract here.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const here = path
      .dirname(new URL(import.meta.url).pathname)
      .replace(/^\/([A-Za-z]:)/, '$1');
    const file = path.resolve(here, '../components/icra/ICRAAssessmentFlow.tsx');
    const src = await fs.readFile(file, 'utf8');
    expect(src).toMatch(/data-testid=\{`icra-question-\$\{q\.id\}`\}/);
    expect(src).toMatch(/data-testid=\{`icra-org-question-\$\{q\.id\}`\}/);
  });

  test.skip('small local union: consent → org context → adaptive card → submit', async () => {
    // Pending: data-testids on each question/radio in the bank.
  });

  test.skip('federated national union: distinct band assignment + distinct routed count', async () => {
    // Pending: org context option testids.
  });

  test.skip('healthcare authority — adaptive card reflects healthcare exposure band', async () => {
    // Pending: org context option testids.
  });

  test.skip('resume mid-flow restores adaptive context', async () => {
    // Pending: stable localStorage namespace + page.evaluate harness.
  });

  test.skip('corrupted persisted state falls back to consent step gracefully', async () => {
    // Pending: as above.
  });
});
