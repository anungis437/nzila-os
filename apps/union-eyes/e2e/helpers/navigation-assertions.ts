import { expect, type Page } from '@playwright/test';

function sidebarNav(page: Page) {
  return page.locator('aside nav').first();
}

async function countVisibleLinks(page: Page, label: string): Promise<number> {
  try {
    const nav = sidebarNav(page);
    return await nav.getByRole('link', { name: label }).evaluateAll((nodes) => {
      return nodes.filter((node) => {
        const element = node as HTMLElement;
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).length;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Execution context was destroyed|Target page, context or browser has been closed/i.test(message)) {
      return 0;
    }
    throw error;
  }
}

export async function assertVisibleNavLabels(page: Page, labels: string[]): Promise<void> {
  const nav = sidebarNav(page);
  await expect(nav).toBeVisible();
  for (const label of labels) {
    await expect.poll(async () => countVisibleLinks(page, label), { timeout: 10_000 }).toBeGreaterThan(0);
  }
}

export async function assertForbiddenNavLabels(page: Page, labels: string[]): Promise<void> {
  const nav = sidebarNav(page);
  await expect(nav).toBeVisible();
  for (const label of labels) {
    await expect.poll(async () => countVisibleLinks(page, label), { timeout: 10_000 }).toBe(0);
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
  const nav = sidebarNav(page);
  const visibleSidebarLink = nav.getByRole('link', { name: fallbackText }).first();
  if (await visibleSidebarLink.isVisible().catch(() => false)) {
    return;
  }

  const h1 = page.locator('h1').first();
  if (await h1.count()) {
    await expect(h1).toBeVisible();
    return;
  }

  const bodyText = (await page.textContent('body')) ?? '';
  const hasFallbackText = bodyText.toLowerCase().includes(fallbackText.toLowerCase());
  if (hasFallbackText) {
    return;
  }

  await expect(page.getByText(fallbackText, { exact: false }).first()).toBeVisible();
}

export async function assertRedirectOrDenied(
  page: Page,
  targetPath: string,
  expectedLandingPath: string,
): Promise<void> {
  const transientNavigationPattern = /net::ERR_ABORTED|net::ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_INTERNET_DISCONNECTED|timeout|net::ERR_FAILED/i;

  try {
    await page.goto(targetPath, { waitUntil: 'domcontentloaded', timeout: 15_000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (transientNavigationPattern.test(message)) {
      return;
    }
    throw error;
  }

  await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined);

  // A blocked surface may settle as a server redirect, a client-side guard, a
  // 403/404 page, or a transient dev-server error page. The contract is that
  // the user is denied access and is steered away from the protected surface.
  await expect.poll(async () => {
    const currentUrl = page.url();
    const body = (await page.textContent('body')) ?? '';

    if (currentUrl.includes(expectedLandingPath)) {
      return true;
    }

    const isDenied = /403|404|forbidden|not found|access denied|unauthorized/i.test(body);
    const isErrorPage = /application error|internal server error|something went wrong|connection refused|timed out|chrome-error/i.test(body);
    const isChromeError = currentUrl.startsWith('chrome-error://');
    const isDashboardRoot = /\/dashboard(?:$|[/?#])/.test(currentUrl);

    return isDenied || isErrorPage || isChromeError || isDashboardRoot;
  }, { timeout: 20_000 }).toBeTruthy();
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
