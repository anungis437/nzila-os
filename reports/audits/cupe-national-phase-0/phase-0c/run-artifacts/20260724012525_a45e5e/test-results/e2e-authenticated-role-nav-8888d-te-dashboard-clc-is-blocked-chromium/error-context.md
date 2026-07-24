# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\authenticated-role-navigation.spec.ts >> UnionEyes authenticated role-centric navigation >> member: cross-role route /dashboard/clc is blocked
- Location: e2e\authenticated-role-navigation.spec.ts:115:9

# Error details

```
Error: page.goto: Page crashed
Call log:
  - navigating to "http://localhost:3002/en-CA/dashboard/clc", waiting until "domcontentloaded"

```

# Test source

```ts
  1  | import { expect, type Page } from '@playwright/test';
  2  | 
  3  | function sidebarNav(page: Page) {
  4  |   return page.locator('aside nav').first();
  5  | }
  6  | 
  7  | export async function assertVisibleNavLabels(page: Page, labels: string[]): Promise<void> {
  8  |   const nav = sidebarNav(page);
  9  |   await expect(nav).toBeVisible();
  10 |   for (const label of labels) {
  11 |     await expect(nav.getByRole('link', { name: label }).first()).toBeVisible();
  12 |   }
  13 | }
  14 | 
  15 | export async function assertForbiddenNavLabels(page: Page, labels: string[]): Promise<void> {
  16 |   const nav = sidebarNav(page);
  17 |   await expect(nav).toBeVisible();
  18 |   for (const label of labels) {
  19 |     await expect(nav.getByRole('link', { name: label }).first()).toHaveCount(0);
  20 |   }
  21 | }
  22 | 
  23 | export async function assertSidebarActiveLabel(page: Page, label: string): Promise<void> {
  24 |   const nav = sidebarNav(page);
  25 |   await expect(nav).toBeVisible();
  26 |   const link = nav.getByRole('link', { name: label }).first();
  27 |   await expect(link).toBeVisible();
  28 |   await expect(link).toHaveClass(/bg-blue-600/);
  29 | }
  30 | 
  31 | export async function assertHeadingOrFallback(page: Page, fallbackText: string): Promise<void> {
  32 |   const h1 = page.locator('h1').first();
  33 |   if (await h1.count()) {
  34 |     await expect(h1).toBeVisible();
  35 |     return;
  36 |   }
  37 |   await expect(page.getByText(fallbackText, { exact: false }).first()).toBeVisible();
  38 | }
  39 | 
  40 | export async function assertRedirectOrDenied(
  41 |   page: Page,
  42 |   targetPath: string,
  43 |   expectedLandingPath: string,
  44 | ): Promise<void> {
> 45 |   await page.goto(targetPath, { waitUntil: 'domcontentloaded' });
     |              ^ Error: page.goto: Page crashed
  46 | 
  47 |   // A blocked surface may settle either as a server redirect (already resolved
  48 |   // by goto) or as a client-side guard that redirects/renders a denial slightly
  49 |   // after DOMContentLoaded. Poll so we don't read an empty body mid-redirect.
  50 |   await expect(async () => {
  51 |     if (page.url().includes(expectedLandingPath)) {
  52 |       return; // redirected to a safe landing — acceptable.
  53 |     }
  54 |     const body = (await page.textContent('body')) ?? '';
  55 |     expect(body).toMatch(/403|404|forbidden|not found|access denied|unauthorized/i);
  56 |   }).toPass({ timeout: 10_000 });
  57 | }
  58 | 
  59 | export async function navigateFromSidebarOrGoto(page: Page, label: string, localizedPath: string): Promise<void> {
  60 |   const link = page.getByRole('link', { name: label }).first();
  61 |   if (await link.count()) {
  62 |     try {
  63 |       // The sidebar can re-render during hydration/route transitions, detaching
  64 |       // the resolved <a> mid-click. Bound the click so a detachment race falls
  65 |       // back to a direct navigation instead of burning the full action timeout.
  66 |       await link.click({ timeout: 8_000 });
  67 |       await page.waitForLoadState('domcontentloaded');
  68 |       return;
  69 |     } catch {
  70 |       // fall through to direct navigation below.
  71 |     }
  72 |   }
  73 | 
  74 |   await page.goto(localizedPath, { waitUntil: 'domcontentloaded' });
  75 | }
  76 | 
  77 | export async function assertNoTextExposure(page: Page, terms: string[]): Promise<void> {
  78 |   const bodyText = (
  79 |     await page.evaluate(() => {
  80 |       const visibleRoots = [
  81 |         document.querySelector('main'),
  82 |         document.querySelector('[role="main"]'),
  83 |         document.body,
  84 |       ].filter(Boolean) as HTMLElement[];
  85 | 
  86 |       for (const root of visibleRoots) {
  87 |         const text = root.innerText?.trim();
  88 |         if (text) return text;
  89 |       }
  90 | 
  91 |       return '';
  92 |     })
  93 |   ).toLowerCase();
  94 | 
  95 |   for (const term of terms) {
  96 |     expect(bodyText).not.toContain(term.toLowerCase());
  97 |   }
  98 | }
  99 | 
```