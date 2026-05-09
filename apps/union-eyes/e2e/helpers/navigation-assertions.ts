import { expect, type Page } from '@playwright/test';

export async function assertVisibleNavLabels(page: Page, labels: string[]): Promise<void> {
  for (const label of labels) {
    await expect(page.getByRole('link', { name: label }).first()).toBeVisible();
  }
}

export async function assertForbiddenNavLabels(page: Page, labels: string[]): Promise<void> {
  for (const label of labels) {
    await expect(page.getByRole('link', { name: label }).first()).toHaveCount(0);
  }
}

export async function assertSidebarActiveLabel(page: Page, label: string): Promise<void> {
  const link = page.getByRole('link', { name: label }).first();
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
  const current = page.url();

  if (current.includes(expectedLandingPath)) {
    return;
  }

  const body = (await page.textContent('body')) ?? '';
  expect(body).toMatch(/403|404|forbidden|not found|access denied|unauthorized/i);
}

export async function navigateFromSidebarOrGoto(page: Page, label: string, localizedPath: string): Promise<void> {
  const link = page.getByRole('link', { name: label }).first();
  if (await link.count()) {
    await link.click();
    await page.waitForLoadState('domcontentloaded');
    return;
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
