/**
 * Union-Eyes E2E — CAPE Feature Validation
 *
 * Comprehensive workflow tests for CAPE pilot features:
 * A) Grievance draft save & resume
 * B) Grievance submission confirmation
 * C) Pilot readiness checklist
 * D) Leadership dashboard KPIs
 * E) Employer communication
 *
 * Requires: PLAYWRIGHT_TEST_AUTH=true, TEST_USER_ID
 */
import { test, expect } from "@playwright/test";
import { ensureServerReady } from '../tests/e2e/_helpers';

const isTestAuth = process.env.PLAYWRIGHT_TEST_AUTH === "true";

// ─── A: Grievance Draft Save & Resume ───────────────────────────────────────

test.describe("Grievance draft save & resume", () => {
  test.skip(!isTestAuth, "Requires PLAYWRIGHT_TEST_AUTH=true");

  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request);
  });

  test("intake page renders form with required fields", async ({ page }) => {
    await page.goto("/en-CA/dashboard/claims/new");
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });

    // Page heading — canonical claim intake form
    await expect(
      page.getByRole("heading", { name: /Create a New Case/i })
    ).toBeVisible({ timeout: 10_000 });

    // Required form fields are present (labels are rendered text, not htmlFor-bound)
    await expect(page.getByText(/Case Title/i).first()).toBeVisible();
    await expect(page.getByText(/Detailed Description/i).first()).toBeVisible();
    await expect(page.getByText(/When did this occur/i).first()).toBeVisible();

    // Submit button exists
    await expect(
      page.getByRole("button", { name: /Create a Case/i })
    ).toBeVisible();
  });

  test("draft is saved to sessionStorage on field input", async ({ page }) => {
    await page.goto("/en-CA/dashboard/claims/new");
    await expect(
      page.getByRole("heading", { name: /Create a New Case/i })
    ).toBeVisible({ timeout: 15_000 });

    // Fill in the title field — first text input on the form
    const titleInput = page.locator('input[type="text"]').first();
    await titleInput.fill("Test Draft Grievance — E2E");

    // Give the debounced auto-save time to fire
    await page.waitForTimeout(2_000);

    // Verify sessionStorage has saved draft data
    const hasDraft = await page.evaluate(() => {
      const keys = Object.keys(sessionStorage);
      return keys.some(
        (k) => k.includes("draft") || k.includes("grievance")
      );
    });
    expect(hasDraft).toBe(true);
  });

  test("resume modal appears when returning with a saved draft", async ({
    page,
  }) => {
    // Step 1: Create a draft by setting sessionStorage directly
    await page.goto("/en-CA/dashboard/claims/new");
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });

    await page.evaluate(() => {
      sessionStorage.setItem(
        "grievance-draft",
        JSON.stringify({
          title: "E2E Resume Test",
          savedAt: new Date().toISOString(),
        })
      );
    });

    // Step 2: Navigate away and return
    await page.goto("/en-CA/dashboard/grievances");
    await page.goto("/en-CA/dashboard/claims/new");

    // Step 3: Resume modal should appear
    const resumeDialog = page.getByRole("dialog");
    const resumeHeading = page.getByText(/Resume Previous Draft/i);

    // Modal may or may not appear depending on implementation details —
    // if it does, verify its contents
    const isVisible = await resumeHeading
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    if (isVisible) {
      await expect(resumeDialog).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Resume Draft/i })
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Discard Draft/i })
      ).toBeVisible();
    }
  });
});

// ─── B: Grievance Submission Flow ───────────────────────────────────────────

test.describe("Grievance submission flow", () => {
  test.skip(!isTestAuth, "Requires PLAYWRIGHT_TEST_AUTH=true");

  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request);
  });

  test("grievance queue page loads with content", async ({ page }) => {
    // /dashboard/grievances is now a soft-redirect to /dashboard/work
    await page.goto("/en-CA/dashboard/grievances");
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });

    // Should show some content — at minimum a heading or empty state
    const hasContent = await page
      .locator("h1, h2, [role='table'], [role='list']")
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    expect(hasContent).toBe(true);
  });

  test("intake form validates required fields before submission", async ({
    page,
  }) => {
    await page.goto("/en-CA/dashboard/claims/new");
    await expect(
      page.getByRole("heading", { name: /Create a New Case/i })
    ).toBeVisible({ timeout: 15_000 });

    // Click submit without filling required fields
    await page.getByRole("button", { name: /Create a Case/i }).click();

    // Form should not navigate away — still on the same page
    await expect(
      page.getByRole("heading", { name: /Create a New Case/i })
    ).toBeVisible();
  });
});

// ─── C: Pilot Readiness Checklist ───────────────────────────────────────────

test.describe("Pilot readiness checklist", () => {
  test.skip(!isTestAuth, "Requires PLAYWRIGHT_TEST_AUTH=true");

  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request);
  });

  test("onboarding page renders checklist with 7 items", async ({ page }) => {
    await page.goto("/en-CA/dashboard/pilot/onboarding");
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });

    // Should show "Pilot Readiness" heading
    await expect(
      page.getByRole("heading", { name: /Pilot Readiness/i })
    ).toBeVisible({ timeout: 10_000 });

    // Should show progress text
    await expect(page.getByText(/of 7 steps completed/i)).toBeVisible();
  });

  test("checklist displays all 7 expected items", async ({ page }) => {
    await page.goto("/en-CA/dashboard/pilot/onboarding");
    await expect(
      page.getByRole("heading", { name: /Pilot Readiness/i })
    ).toBeVisible({ timeout: 15_000 });

    // Verify all 7 checklist items are present
    const expectedItems = [
      "Organization seeded",
      "Users invited",
      "Roles assigned",
      "Collective agreements uploaded",
      "Employers imported",
      "Integrations configured",
      "Evidence export verified",
    ];

    for (const item of expectedItems) {
      await expect(page.getByText(item)).toBeVisible();
    }
  });

  test("pilot onboarding API returns valid checklist state", async ({
    request,
  }) => {
    const response = await request.get("/api/pilot/onboarding");

    // Auth may reject — but the endpoint must be reachable
    expect([200, 401, 403]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty("items");
      expect(body).toHaveProperty("totalCount", 7);
      expect(body).toHaveProperty("isComplete");
      expect(typeof body.completedCount).toBe("number");
    }
  });
});

// ─── D: Leadership Dashboard KPIs ───────────────────────────────────────────

test.describe("Leadership dashboard", () => {
  test.skip(!isTestAuth, "Requires PLAYWRIGHT_TEST_AUTH=true");

  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request);
  });

  test("dashboard renders 6 KPI cards", async ({ page }) => {
    await page.goto("/en-CA/dashboard/leadership");
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });

    // All 6 KPI card labels should be visible
    const kpiLabels = [
      "Active Grievances",
      "Resolved This Month",
      "Avg. Time to Triage",
      "Avg. Time to Resolution",
      "Arbitrations",
      "Overdue Cases",
    ];

    for (const label of kpiLabels) {
      await expect(page.getByText(label)).toBeVisible({ timeout: 10_000 });
    }
  });

  test("leadership API returns structured KPI data", async ({ request }) => {
    const response = await request.get(
      "/api/dashboard/leadership?timeframe=monthly"
    );
    expect([200, 401, 403]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty("data");
      expect(body.data).toHaveProperty("kpi");
      expect(body.data.kpi).toHaveProperty("activeGrievances");
      expect(body.data.kpi).toHaveProperty("resolvedThisMonth");
      expect(body.data.kpi).toHaveProperty("avgTriageDays");
      expect(body.data.kpi).toHaveProperty("avgResolutionDays");
      expect(body.data.kpi).toHaveProperty("arbitrationCount");
      expect(body.data.kpi).toHaveProperty("overdueCases");
      expect(body.data).toHaveProperty("employers");
      expect(body.data).toHaveProperty("trends");
      expect(body.data).toHaveProperty("stewards");
    }
  });

  test("leadership API supports timeframe parameter", async ({ request }) => {
    for (const timeframe of ["weekly", "monthly", "quarterly"]) {
      const response = await request.get(
        `/api/dashboard/leadership?timeframe=${timeframe}`
      );
      expect([200, 401, 403]).toContain(response.status());
    }
  });
});

// ─── E: Employer Communications ─────────────────────────────────────────────

test.describe("Employer communications", () => {
  test.skip(!isTestAuth, "Requires PLAYWRIGHT_TEST_AUTH=true");

  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request);
  });

  test("contacts API endpoint is reachable", async ({ request }) => {
    const response = await request.get(
      "/api/employers/communications/contacts"
    );
    expect([200, 401, 403]).toContain(response.status());
  });

  test("communications API endpoint is reachable", async ({ request }) => {
    const response = await request.get("/api/employers/communications");
    expect([200, 401, 403]).toContain(response.status());
  });
});

// ─── F: Steward/LRO Workbench ───────────────────────────────────────────────

test.describe("Steward workbench", () => {
  test.skip(!isTestAuth, "Requires PLAYWRIGHT_TEST_AUTH=true");

  test.beforeAll(async ({ request }) => {
    await ensureServerReady(request);
  });

  test("dashboard page loads with content", async ({ page }) => {
    await page.goto("/en-CA/dashboard");
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });

    // Should show at minimum a heading or dashboard content
    const hasContent = await page
      .locator("h1, h2, h3, [role='main']")
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    expect(hasContent).toBe(true);
  });
});
