# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\ocra-adaptive-flow.spec.ts >> OCRA adaptive live flow — smoke >> fr-CA route renders the assessment flow
- Location: e2e\ocra-adaptive-flow.spec.ts:47:7

# Error details

```
TimeoutError: page.goto: Timeout 45000ms exceeded.
Call log:
  - navigating to "http://localhost:3002/fr-CA/continuity-assessment/start", waiting until "load"

```

# Test source

```ts
  1   | /**
  2   |  * E2E SPEC — OCRA Adaptive Live Flow
  3   |  *
  4   |  * SCOPE: Live respondent flow end-to-end with three representative
  5   |  * organizational profiles + recovery + bilingual parity.
  6   |  *
  7   |  * STATUS: SCAFFOLD. Some scenarios are wired up; the deeper interactions
  8   |  * (full 7-section traversal, PDF download verification) are deliberately
  9   |  * marked `test.skip` until stable data-testid attributes are in place on
  10  |  * the entire question bank.
  11  |  *
  12  |  * The data-testid attributes added during the hardening sprint:
  13  |  *   - data-testid="icra-consent-step"
  14  |  *   - data-testid="icra-org-context-step"
  15  |  *   - data-testid="icra-adaptive-explanation-card"
  16  |  *   - data-testid="icra-adaptive-continue"
  17  |  *   - data-testid="icra-section-step"
  18  |  *   - data-testid="icra-assessment-flow"
  19  |  *   - data-testid="icra-question-${id}"    (per-question wrapper inside a section)
  20  |  *   - data-testid="icra-org-question-${id}" (per-question wrapper in org context step)
  21  |  *   - data-testid="adaptive-interpretation-block" (results page)
  22  |  *
  23  |  * RUN: `pnpm --filter @nzila/union-eyes test:e2e` (Playwright)
  24  |  */
  25  | 
  26  | import { expect, test } from '@playwright/test';
  27  | 
  28  | // The assessment flow lives at `/[locale]/continuity-assessment/start`.
  29  | // `/[locale]/continuity-assessment` (no `/start`) is the marketing landing
  30  | // page and does NOT mount ICRAAssessmentFlow.
  31  | const ASSESSMENT_PATH_EN = '/en-CA/continuity-assessment/start';
  32  | const ASSESSMENT_PATH_FR = '/fr-CA/continuity-assessment/start';
  33  | 
  34  | test.describe('OCRA adaptive live flow — smoke', () => {
  35  |   test('renders the consent step and exposes the assessment flow root', async ({
  36  |     page,
  37  |   }) => {
  38  |     await page.goto(ASSESSMENT_PATH_EN);
  39  |     await expect(
  40  |       page.getByTestId('icra-assessment-flow').first(),
  41  |     ).toBeVisible({ timeout: 20_000 });
  42  |     await expect(
  43  |       page.getByTestId('icra-consent-step').first(),
  44  |     ).toBeVisible();
  45  |   });
  46  | 
  47  |   test('fr-CA route renders the assessment flow', async ({ page }) => {
> 48  |     await page.goto(ASSESSMENT_PATH_FR);
      |                ^ TimeoutError: page.goto: Timeout 45000ms exceeded.
  49  |     await expect(
  50  |       page.getByTestId('icra-assessment-flow').first(),
  51  |     ).toBeVisible({ timeout: 20_000 });
  52  |   });
  53  | });
  54  | 
  55  | test.describe('OCRA adaptive live flow — telemetry privacy (network)', () => {
  56  |   test('telemetry POSTs never carry org names or free text', async ({
  57  |     page,
  58  |   }) => {
  59  |     const violations: string[] = [];
  60  |     page.on('request', (req) => {
  61  |       if (!req.url().includes('/api/icra/telemetry')) return;
  62  |       const post = req.postData() ?? '';
  63  |       const forbiddenPatterns = [
  64  |         /\borgName\b/,
  65  |         /\bemail\b/,
  66  |         /\bphone\b/,
  67  |         /\bprimary_challenge\b/,
  68  |         /\bfree_text\b/,
  69  |       ];
  70  |       for (const re of forbiddenPatterns) {
  71  |         if (re.test(post)) violations.push(`${re.source}: ${post.slice(0, 100)}`);
  72  |       }
  73  |     });
  74  | 
  75  |     await page.goto(ASSESSMENT_PATH_EN);
  76  |     // Give the page a moment to settle any initial telemetry beacon
  77  |     await page.waitForLoadState('load');
  78  |     expect(violations).toEqual([]);
  79  |   });
  80  | });
  81  | 
  82  | // ─── Deeper interaction scenarios — kept skipped until stable selectors land
  83  | // across every question component. Authors completing the hardening sprint
  84  | // can enable these incrementally.
  85  | 
  86  | test.describe('OCRA adaptive live flow — full traversal', () => {
  87  |   test('per-question testid attributes are wired in the assessment flow source', async () => {
  88  |     // Doctrine guard: the data-testid="icra-question-${id}" hook is the
  89  |     // anchor every full-traversal test will rely on. If this drifts away
  90  |     // from the source, every traversal test will silently break. We keep
  91  |     // the deep traversal tests scaffolded (skipped) below, but lock the
  92  |     // selector contract here.
  93  |     const fs = await import('node:fs/promises');
  94  |     const path = await import('node:path');
  95  |     // Use __dirname (Playwright transpiles specs as CJS). Using
  96  |     // `import.meta.url` would force ESM and break `require` in the
  97  |     // wider spec graph.
  98  |     const here = __dirname;
  99  |     const file = path.resolve(here, '../components/icra/ICRAAssessmentFlow.tsx');
  100 |     const src = await fs.readFile(file, 'utf8');
  101 |     expect(src).toMatch(/data-testid=\{`icra-question-\$\{q\.id\}`\}/);
  102 |     expect(src).toMatch(/data-testid=\{`icra-org-question-\$\{q\.id\}`\}/);
  103 |   });
  104 | 
  105 |   test.skip('small local union: consent → org context → adaptive card → submit', async () => {
  106 |     // Pending: data-testids on each question/radio in the bank.
  107 |   });
  108 | 
  109 |   test.skip('federated national union: distinct band assignment + distinct routed count', async () => {
  110 |     // Pending: org context option testids.
  111 |   });
  112 | 
  113 |   test.skip('healthcare authority — adaptive card reflects healthcare exposure band', async () => {
  114 |     // Pending: org context option testids.
  115 |   });
  116 | 
  117 |   test.skip('resume mid-flow restores adaptive context', async () => {
  118 |     // Pending: stable localStorage namespace + page.evaluate harness.
  119 |   });
  120 | 
  121 |   test.skip('corrupted persisted state falls back to consent step gracefully', async () => {
  122 |     // Pending: as above.
  123 |   });
  124 | });
  125 | 
```