import type { Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const EXPERIENCE_VIEWPORTS = [360, 375, 390, 430, 768, 1024, 1440] as const;
export type VisualIdentity = {
  route: string; role: string; locale: string; state: string; sourceSha: string;
  candidateRevision: string; frontendImage: string; backendImage: string;
};

/** Observe actual readiness. A timeout is a failure, never a screenshot baseline. */
export async function waitForVisualReadiness(page: Page, timeout = 45_000) {
  await page.locator('main').first().waitFor({ state: 'visible', timeout });
  await page.evaluate(() => document.fonts.ready);
  const deadline = Date.now() + timeout;
  let previous = ''; let stableSince = 0;
  while (Date.now() < deadline) {
    const state = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return null;
      const visible = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
      };
      const pending = [...main.querySelectorAll('[aria-busy="true"], [role="progressbar"], .animate-pulse, .animate-spin')].some(visible);
      const animations = document.getAnimations().some(animation => animation.playState === 'running'
        && animation.effect?.getComputedTiming().iterations !== Infinity);
      const box = main.getBoundingClientRect();
      return { pending, animations, fonts: document.fonts.status,
        signature: JSON.stringify({ text: (main as HTMLElement).innerText, width: box.width, height: box.height }) };
    });
    if (state && !state.pending && !state.animations && state.fonts === 'loaded') {
      if (state.signature !== previous) { previous = state.signature; stableSince = Date.now(); }
      if (Date.now() - stableSince >= 750) return;
    } else { previous = ''; stableSince = 0; }
    // Poll observed content stability; this is not a fixed capture delay.
    await page.waitForTimeout(150);
  }
  throw new Error('VISUAL_CONTENT_DID_NOT_STABILIZE');
}

export async function inspectVisualStructure(page: Page) {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect(); const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
        && !element.closest('[aria-hidden="true"], [inert]');
    };
    const modal = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].find(visible);
    const scope = modal ?? document;
    const controls = [...scope.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, [role="tab"]')]
      .filter(visible).map(element => {
        const rect = element.getBoundingClientRect(); const style = getComputedStyle(element);
        const inViewport = rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
        const center = document.elementFromPoint(Math.max(0, Math.min(innerWidth - 1, rect.x + rect.width / 2)),
          Math.max(0, Math.min(innerHeight - 1, rect.y + rect.height / 2)));
        const critical = !!element.closest('.ue-global-header, [role="dialog"]');
        const clipped = rect.left < -1 || rect.right > innerWidth + 1 || (critical && (rect.top < -1 || rect.bottom > innerHeight + 1));
        return { tag: element.tagName, name: element.getAttribute('aria-label') || (element as HTMLElement).innerText || element.getAttribute('placeholder'),
          href: element.getAttribute('href'), critical, inViewport, clipped,
          occluded: inViewport && !!center && center !== element && !element.contains(center),
          truncated: style.textOverflow === 'ellipsis' && element.scrollWidth > element.clientWidth + 1,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
      });
    const activeSurfaces = [...document.querySelectorAll('nav')].filter(visible).map(nav => ({
      name: nav.getAttribute('aria-label'), selected: [...nav.querySelectorAll('[aria-current="page"]')].filter(visible).map(a => a.getAttribute('href')),
    }));
    return { controls, activeSurfaces, modalOpen: !!modal,
      duplicateActive: activeSurfaces.some(surface => surface.selected.length > 1),
      criticalFailures: controls.filter(control => control.critical && (control.clipped || control.occluded || control.truncated)),
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
  });
}

/** Exact image/source identity is supplied by the release controller, never guessed. */
export async function captureVisualEvidence(page: Page, directory: string, identity: VisualIdentity) {
  if (!/^[a-f0-9]{40}$/.test(identity.sourceSha) || !identity.frontendImage.includes('@sha256:')
    || !identity.backendImage.includes('@sha256:')) throw new Error('EXACT_SOURCE_AND_IMAGE_IDENTITY_REQUIRED');
  await waitForVisualReadiness(page);
  const actual = new URL(page.url());
  const landed = actual.pathname + actual.search;
  const structure = await inspectVisualStructure(page);
  const viewport = page.viewportSize();
  const key = createHash('sha256').update(JSON.stringify({ ...identity, viewport })).digest('hex').slice(0, 20);
  const record = { ...identity, viewport, landed, capturedAt: new Date().toISOString(), structure,
    classification: landed === identity.route ? 'RENDERED_REQUIRES_VISUAL_REVIEW' : 'REDIRECT_NOT_DESTINATION_ACCEPTANCE' };
  mkdirSync(directory, { recursive: true });
  // Reserve metadata before capture so a repeated case cannot overwrite earlier evidence.
  const metadata = resolve(directory, key + '.json');
  writeFileSync(metadata, JSON.stringify({ ...record, captureStatus: 'IN_PROGRESS' }, null, 2), { flag: 'wx' });
  const screenshot = resolve(directory, key + '.png');
  const bytes = await page.screenshot({ path: screenshot, fullPage: true, animations: 'allow' });
  const result = { ...record, captureStatus: 'CAPTURED', screenshot,
    screenshotSha256: createHash('sha256').update(bytes).digest('hex') };
  writeFileSync(metadata, JSON.stringify(result, null, 2) + '\n');
  return result;
}
