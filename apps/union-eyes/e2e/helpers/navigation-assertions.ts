import { expect, type Page } from '@playwright/test';

function sidebarNav(page: Page) {
  return page.locator('aside nav').first();
}

export async function assertVisibleNavLabels(page: Page, labels: string[]): Promise<void> {
  const nav = sidebarNav(page);
  await expect(nav).toBeVisible();
  for (const label of labels) {
    await expect(nav.getByRole('link', { name: label }).first()).toBeVisible();
  }
}

export async function assertForbiddenNavLabels(page: Page, labels: string[]): Promise<void> {
  const nav = sidebarNav(page);
  await expect(nav).toBeVisible();
  for (const label of labels) {
    await expect(nav.getByRole('link', { name: label }).first()).toHaveCount(0);
  }
}

export async function assertSidebarActiveLabel(page: Page, label: string): Promise<void> {
  const nav = sidebarNav(page);
  await expect(nav).toBeVisible();
  const link = nav.getByRole('link', { name: label }).first();
  await expect(link).toBeVisible();
  await expect(link).toHaveClass(/bg-blue-600/);
}

export async function assertHeadingOrFallback(page: Page, fallbackText: string): Promise<void> {
  const h1 = page.locator('h1').first();
  if (await h1.count()) {
    await expect(h1).toBeVisible();
    return;
  }
  await expect(page.getByText(fallbackText, { exact: false }).first()).toBeVisible();
}

export async function assertRedirectOrDenied(
  page: Page,
  targetPath: string,
  expectedLandingPath: string,
): Promise<void> {
  await page.goto(targetPath, { waitUntil: 'domcontentloaded' });

  // A blocked surface may settle either as a server redirect (already resolved
  // by goto) or as a client-side guard that redirects/renders a denial slightly
  // after DOMContentLoaded. Poll so we don't read an empty body mid-redirect.
  await expect(async () => {
    if (page.url().includes(expectedLandingPath)) {
      return; // redirected to a safe landing — acceptable.
    }
    const body = (await page.textContent('body')) ?? '';
    expect(body).toMatch(/403|404|forbidden|not found|access denied|unauthorized/i);
  }).toPass({ timeout: 10_000 });
}

export async function navigateFromSidebarOrGoto(page: Page, label: string, localizedPath: string): Promise<void> {
  const link = page.getByRole('link', { name: label }).first();
  if (await link.count()) {
    try {
      // The sidebar can re-render during hydration/route transitions, detaching
      // the resolved <a> mid-click. Bound the click so a detachment race falls
      // back to a direct navigation instead of burning the full action timeout.
      await link.click({ timeout: 8_000 });
      await page.waitForLoadState('domcontentloaded');
      return;
    } catch {
      // fall through to direct navigation below.
    }
  }

  await page.goto(localizedPath, { waitUntil: 'domcontentloaded' });
}

export async function assertNoTextExposure(page: Page, terms: string[]): Promise<void> {
  const bodyText = (
    await page.evaluate(() => {
      const visibleRoots = [
        document.querySelector('main'),
        document.querySelector('[role="main"]'),
        document.body,
      ].filter(Boolean) as HTMLElement[];

      for (const root of visibleRoots) {
        const text = root.innerText?.trim();
        if (text) return text;
      }

      return '';
    })
  ).toLowerCase();

  for (const term of terms) {
    expect(bodyText).not.toContain(term.toLowerCase());
  }
}
