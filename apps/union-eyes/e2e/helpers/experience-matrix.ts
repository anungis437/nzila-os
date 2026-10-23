import type { Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { captureVisualEvidence, EXPERIENCE_VIEWPORTS, inspectVisualStructure, waitForVisualReadiness, type VisualIdentity } from './visual-acceptance';

export type ExperienceDestination = {
  /** Actual route with owned dynamic parameters already resolved. No invented IDs. */
  path: string;
  expected: 'rendered' | 'denied' | 'redirect' | 'not-implemented';
  expectedRedirect?: string;
};

/** Used by the governed native-session controller; never creates or fabricates authentication. */
export async function runExperienceMatrix(options: {
  page: Page; origin: string; output: string; identity: Omit<VisualIdentity, 'route' | 'locale' | 'state'>;
  destinations: ExperienceDestination[];
}) {
  const { page, origin, output, identity } = options;
  if (!origin.startsWith('https://')) throw new Error('HTTPS_CANDIDATE_REQUIRED');
  const versionResponse = await page.request.get(origin + '/api/version');
  const version = await versionResponse.json();
  if (versionResponse.status() !== 200 || version.gitSha !== identity.sourceSha) throw new Error('CANDIDATE_SOURCE_MISMATCH');
  const require = createRequire(resolve(process.cwd(), 'package.json'));
  const axePath = require.resolve('axe-core/axe.min.js');
  mkdirSync(output, { recursive: true });
  const results: Record<string, unknown>[] = [];
  const report = resolve(output, 'matrix.json');
  writeFileSync(report, JSON.stringify({ status: 'IN_PROGRESS', identity, results }), { flag: 'wx' });
  const save = (status = 'IN_PROGRESS') => writeFileSync(report, JSON.stringify({ status, identity, results }, null, 2) + '\n');
  for (const destination of options.destinations) for (const locale of ['en-CA', 'fr-CA']) for (const width of EXPERIENCE_VIEWPORTS) {
    const route = '/' + locale + destination.path;
    const errors: string[] = [];
    const errorListener = (error: Error) => errors.push(error.message);
    page.on('pageerror', errorListener);
    let result: Record<string, unknown> = { route, role: identity.role, locale, width, expected: destination.expected };
    try {
      await page.setViewportSize({ width, height: width < 768 ? 900 : 1000 });
      const response = await page.goto(origin + route, { waitUntil: 'load', timeout: 45_000 });
      const landedUrl = new URL(page.url()); const landed = landedUrl.pathname + landedUrl.search;
      const status = response?.status();
      if (landed !== route) {
        result = { ...result, landed, httpStatus: status, classification: destination.expected === 'redirect'
          && landed === '/' + locale + destination.expectedRedirect ? 'EXPECTED_REDIRECT' : 'UNEXPECTED_REDIRECT', visualAccepted: false };
      } else if (status === 401 || status === 403) {
        result = { ...result, httpStatus: status, classification: destination.expected === 'denied' ? 'EXPECTED_AUTHORIZATION_DENIAL' : 'UNEXPECTED_AUTHORIZATION_DENIAL', visualAccepted: false };
      } else if (status === 404 || status === 501) {
        result = { ...result, httpStatus: status, classification: 'MISSING_IMPLEMENTATION', visualAccepted: false };
      } else if (status !== 200) {
        result = { ...result, httpStatus: status, classification: 'APPLICATION_ERROR', visualAccepted: false };
      } else {
        await waitForVisualReadiness(page);
        const privacy = page.getByRole('button', { name: /^(Reject All|Tout refuser)$/ });
        if (await privacy.isVisible()) {
          const firstVisit = await captureVisualEvidence(page, resolve(output, 'first-visit'), { ...identity, route, locale, state: 'first-visit' });
          result.firstVisit = firstVisit;
          await privacy.click();
          await page.getByRole('dialog', { name: /We value your privacy|Votre vie privée compte/ }).waitFor({ state: 'hidden' });
        }
        await waitForVisualReadiness(page);
        const structure = await inspectVisualStructure(page);
        let drawerInteraction = 'NOT_APPLICABLE';
        if (width < 768) {
          const trigger = page.locator('#ue-navigation-trigger');
          await trigger.click();
          const drawer = page.locator('#ue-mobile-drawer');
          await drawer.waitFor({ state: 'visible' });
          await page.keyboard.press('Escape');
          await drawer.waitFor({ state: 'hidden' });
          drawerInteraction = await trigger.evaluate(element => document.activeElement === element) ? 'PASS_OPEN_ESCAPE_FOCUS_RETURN' : 'FAIL_FOCUS_RETURN';
        }
        await page.addScriptTag({ path: axePath });
        const accessibility = await page.evaluate(async () => {
          const axe = (window as unknown as { axe: { run: (context: Document, options: object) => Promise<{ violations: unknown[]; incomplete: unknown[] }> } }).axe;
          const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
          return { violations: result.violations, incomplete: result.incomplete };
        });
        const evidence = await captureVisualEvidence(page, resolve(output, 'normal'), { ...identity, route, locale, state: 'normal' });
        const automaticPass = !structure.duplicateActive && structure.criticalFailures.length === 0 && !structure.documentOverflow
          && !drawerInteraction.startsWith('FAIL') && accessibility.violations.length === 0 && errors.length === 0;
        result = { ...result, classification: 'RENDERED_PAGE', evidence, structure, drawerInteraction, accessibility, browserErrors: errors,
          automaticPass, visualAccepted: false, humanOrAgentVisualReview: 'PENDING', stateCoverage: ['normal', ...(result.firstVisit ? ['first-visit'] : [])] };
      }
    } catch (error) {
      result = { ...result, classification: error instanceof Error && error.message === 'VISUAL_CONTENT_DID_NOT_STABILIZE'
        ? 'SKELETON_OR_LOADING_STATE' : 'BROWSER_ASSERTION_FAILURE', error: error instanceof Error ? error.message : String(error), visualAccepted: false };
    } finally { page.off('pageerror', errorListener); }
    results.push(result); save();
  }
  save('EXECUTED_REQUIRES_VISUAL_REVIEW_AND_STATE_COVERAGE');
  return results;
}
