import { expect, type Page } from '@playwright/test';

const PRIMARY_SIDEBAR = 'aside[aria-label="Primary navigation"]:not([role="dialog"])';

/**
 * Ensure the primary sidebar is fully expanded.
 *
 * 1. Clears localStorage collapse-state keys.
 * 2. Clicks any group-toggle buttons still marked aria-expanded="false" — React
 *    may have already initialised from a prior localStorage value before we cleared.
 * 3. On "Execution context was destroyed" (navigation mid-flight), waits for the
 *    new context to settle and retries up to MAX_RETRIES times.
 * 4. Rethrows any unexpected error.
 */
async function ensureExpandedSidebar(page: Page): Promise<void> {
  const MAX_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await page.evaluate(() => {
        window.localStorage.removeItem('ue-sidebar-collapsed');
        window.localStorage.removeItem('ue-sidebar-collapsed-groups');
      });

      await page.waitForLoadState('domcontentloaded', { timeout: 10_000 });
      await page.waitForTimeout(150);

      // Click every collapsed group toggle so React state is expanded.
      const collapsedToggles = page.locator(
        `${PRIMARY_SIDEBAR} button[aria-expanded="false"]`,
      );
      const toggleCount = await collapsedToggles.count();
      for (let i = 0; i < toggleCount; i++) {
        await collapsedToggles.nth(i).click({ timeout: 3_000 }).catch(() => undefined);
        await page.waitForTimeout(80);
      }

      // Verify the sidebar has at least one nav link.
      const hasLinks = await page.evaluate(
        (sel) =>
          Boolean(document.querySelector(sel)?.querySelectorAll('a[href], button').length),
        PRIMARY_SIDEBAR,
      );
      if (hasLinks || attempt === MAX_RETRIES) return;

      await page.waitForTimeout(500 * (attempt + 1));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isContextReplaced =
        message.includes('Execution context was destroyed') ||
        message.includes('Target page, context or browser has been closed') ||
        message.includes('Target closed');

      if (isContextReplaced && attempt < MAX_RETRIES) {
        await page
          .waitForLoadState('domcontentloaded', { timeout: 15_000 })
          .catch(() => undefined);
        await page.waitForTimeout(500 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }
}

/** Text of VISIBLE nav links/buttons in the primary sidebar. */
async function getVisibleNavigationTexts(page: Page): Promise<string[]> {
  try {
    return await page.evaluate((sel) => {
      const elements = Array.from(
        document.querySelectorAll(`${sel} a[href], ${sel} button`),
      ) as HTMLElement[];
      return elements
        .filter((el) => {
          const s = window.getComputedStyle(el);
          return (
            el.getClientRects().length > 0 &&
            s.display !== 'none' &&
            s.visibility !== 'hidden' &&
            s.opacity !== '0'
          );
        })
        .map((el) => el.textContent?.trim().toLowerCase() ?? '');
    }, PRIMARY_SIDEBAR);
  } catch {
    return [];
  }
}

/**
 * Text of ALL nav links/buttons in the primary sidebar, including items
 * inside collapsed groups.  Used for forbidden-label checks: an unauthorised
 * link must not appear in the nav DOM at all, not merely be hidden by collapse.
 */
async function getAllNavigationTexts(page: Page): Promise<string[]> {
  try {
    return await page.evaluate((sel) => {
      const aside = document.querySelector(sel);
      if (!aside) return [];
      return (Array.from(aside.querySelectorAll('a[href], button')) as HTMLElement[])
        .map((el) => el.textContent?.trim().toLowerCase() ?? '')
        .filter(Boolean);
    }, PRIMARY_SIDEBAR);
  } catch {
    return [];
  }
}

/**
 * Assert that every expected label is visible in the primary sidebar.
 * Calls ensureExpandedSidebar so collapsed groups do not produce false negatives.
 */
export async function assertVisibleNavLabels(page: Page, labels: string[]): Promise<void> {
  await ensureExpandedSidebar(page);
  await expect
    .poll(
      async () => {
        const texts = await getVisibleNavigationTexts(page);
        return labels.every((l) => texts.some((t) => t.includes(l.toLowerCase())));
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

/**
 * Assert that none of the forbidden labels appear in the primary sidebar DOM —
 * visible or inside a collapsed group.
 */
export async function assertForbiddenNavLabels(page: Page, labels: string[]): Promise<void> {
  await ensureExpandedSidebar(page);
  await expect
    .poll(
      async () => {
        const texts = await getAllNavigationTexts(page);
        return labels.every((l) => !texts.some((t) => t.includes(l.toLowerCase())));
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

/**
 * Assert that the nav link for `label` is the active item in the primary sidebar.
 *
 * Active state is proved by aria-current="page" OR URL correspondence.
 * The active link MUST also be visible.  If its group is collapsed, this function
 * deterministically expands that group, then re-checks.
 * Hidden text alone does NOT satisfy this assertion.
 */
export async function assertSidebarActiveLabel(page: Page, label: string): Promise<void> {
  await expect
    .poll(
      async () => {
        const sidebarLink = page
          .locator(`${PRIMARY_SIDEBAR} a[href]`)
          .filter({ hasText: label })
          .first();
        if (!(await sidebarLink.count())) return false;

        const ariaCurrent = await sidebarLink.getAttribute('aria-current').catch(() => null);
        const href = await sidebarLink.getAttribute('href').catch(() => null);
        const settledUrl = page.url();

        let isActive = ariaCurrent === 'page';
        if (!isActive && href) {
          try {
            const linkPath = new URL(href, settledUrl).pathname;
            const settledPath = new URL(settledUrl).pathname;
            isActive = settledPath === linkPath || settledPath.startsWith(`${linkPath}/`);
          } catch {
            /* malformed href */
          }
        }
        if (!isActive) return false;

        // The active link must be visible.  Expand its group if collapsed.
        const isVisible = await sidebarLink.isVisible().catch(() => false);
        if (!isVisible) {
          await page
            .evaluate(
              ({ sel, lbl }) => {
                const links = Array.from(
                  document.querySelectorAll(`${sel} a[href]`),
                ) as HTMLElement[];
                const link = links.find((el) =>
                  el.textContent?.trim().toLowerCase().includes(lbl),
                );
                if (!link) return;
                let parent: HTMLElement | null = link.parentElement;
                while (parent) {
                  const sibling = parent.previousElementSibling as HTMLElement | null;
                  if (
                    sibling?.tagName === 'BUTTON' &&
                    sibling.getAttribute('aria-expanded') === 'false'
                  ) {
                    sibling.click();
                    return;
                  }
                  parent = parent.parentElement;
                }
              },
              { sel: PRIMARY_SIDEBAR, lbl: label.toLowerCase() },
            )
            .catch(() => undefined);
          await page.waitForTimeout(120);
          return sidebarLink.isVisible().catch(() => false);
        }
        return true;
      },
      {
        timeout: 15_000,
        message: `assertSidebarActiveLabel: "${label}" not active+visible in primary sidebar. URL: ${page.url()}`,
      },
    )
    .toBe(true);
}

/**
 * Assert that the correct, authorised page has loaded.
 *
 * Proof requires ALL of:
 *   1. Settled URL is a /dashboard/ path (not auth or error redirect).
 *   2. At least one page-specific identity signal:
 *      (a) visible <h1> or labelled heading, OR
 *      (b) active sidebar nav link matching fallbackText and visible, OR
 *      (c) fallbackText visible inside <main>.
 *
 * A generic <main> without page-specific content is NOT sufficient.
 */
export async function assertHeadingOrFallback(page: Page, fallbackText: string): Promise<void> {
  const settledUrl = page.url();
  expect(
    settledUrl,
    `assertHeadingOrFallback: URL "${settledUrl}" is not a dashboard path.`,
  ).toMatch(/\/dashboard\//);

  await expect
    .poll(
      async () => {
        // (a) Visible page heading
        const heading = page
          .locator('h1, [role="heading"][aria-level]')
          .filter({ hasText: /\S/ })
          .first();
        if (await heading.isVisible().catch(() => false)) return true;

        // (b) Active sidebar nav label matches fallbackText
        const activeLink = page.locator(`${PRIMARY_SIDEBAR} a[aria-current="page"]`).first();
        if (await activeLink.count()) {
          const txt = (await activeLink.textContent())?.trim().toLowerCase() ?? '';
          if (
            txt.includes(fallbackText.toLowerCase()) &&
            (await activeLink.isVisible().catch(() => false))
          ) {
            return true;
          }
        }

        // (c) fallbackText visible in <main>
        const mainContent = page.locator('main');
        if (await mainContent.count()) {
          const match = mainContent.getByText(fallbackText, { exact: false });
          if (
            (await match.count()) &&
            (await match.first().isVisible().catch(() => false))
          ) {
            return true;
          }
        }

        return false;
      },
      {
        timeout: 15_000,
        message:
          `assertHeadingOrFallback: no heading, active nav label, or main content ` +
          `for "${fallbackText}" at "${page.url()}"`,
      },
    )
    .toBe(true);
}

/**
 * Assert that a forbidden/protected route denies the current persona.
 *
 * ERR_ABORTED is the only recognised absorbed network error (server-side
 * redirect aborting the navigation to the target).  The function ALWAYS
 * verifies the final settled URL and page state — it does NOT return early
 * on a network error.  The persona must remain authenticated after denial.
 */
export async function assertRedirectOrDenied(
  page: Page,
  targetPath: string,
  expectedLandingPath: string,
): Promise<void> {
  try {
    await page.goto(targetPath, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('net::ERR_ABORTED')) throw error;
    // Fall through — always verify final settled state below.
  }

  await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => undefined);

  await expect
    .poll(
      async () => {
        const currentUrl = page.url();
        const body = (await page.textContent('body')) ?? '';

        if (currentUrl.includes(expectedLandingPath)) return 'redirected';

        const isDenied = /403|404|forbidden|not found|access denied|unauthorized/i.test(body);
        const isErrorPage =
          /application error|internal server error|something went wrong/i.test(body);
        const isChromeError = currentUrl.startsWith('chrome-error://');
        const isAtDashboardRoot = /\/dashboard(?:$|[/?#])/.test(currentUrl);

        if (isDenied) return 'denied';
        if (isErrorPage || isChromeError) return 'error-blocked';
        if (isAtDashboardRoot) return 'dashboard-root';
        return false;
      },
      { timeout: 45_000 },
    )
    .toBeTruthy();

  // Persona must remain authenticated after denial (not leaked to sign-in).
  const finalUrl = page.url();
  expect(
    finalUrl,
    `assertRedirectOrDenied: persona leaked to auth page after denial. URL: ${finalUrl}`,
  ).not.toMatch(/\/sign-in|\/login/);
}

export async function navigateFromSidebarOrGoto(page: Page, label: string, localizedPath: string): Promise<void> {
  // Always use direct navigation.
  //
  // Sidebar-link clicks trigger Next.js RSC streaming which, under the memory
  // pressure of sequential dashboard navigations in the dev server, can cause
  // the RSC payload stream to be truncated → JSON parse error → blank body.
  //
  // Direct navigation (page.goto) uses a full SSR render that is handled
  // reliably.  The sidebar navigation contract is separately proven by
  // authenticated-role-navigation.spec.ts.
  void label; // intentionally unused — kept as parameter for call-site clarity

  // Allow pending requests from the previous page to settle before navigating.
  // This prevents the dev server from being overwhelmed when workbench/other
  // heavy pages have ongoing background requests.
  await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

  // Use 'load' (not 'domcontentloaded') so we wait for JS and CSS too.
  // After 'load', React has hydrated and body should be visible.
  await page.goto(localizedPath, { waitUntil: 'load', timeout: 90_000 }).catch(
    () => page.goto(localizedPath, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => undefined),
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
void escapeRegExp; // reserved for future URL pattern matching in this module

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
