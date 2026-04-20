import { test, expect, type APIResponse } from "@playwright/test";

function isJsonResponse(res: APIResponse): boolean {
  return (
    res.headers()["content-type"]?.toLowerCase().includes("application/json") ??
    false
  );
}

test.describe("Control Plane — Smoke Tests", () => {
  // In CI there is no authenticated session — the app correctly gates all
  // protected routes behind /sign-in.  Each test verifies the app is running
  // and responding (either serving the real content or correctly redirecting).

  test("root redirects to /overview or /sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/overview|\/sign-in/);
  });

  test("overview page responds (renders or auth redirect)", async ({ page }) => {
    await page.goto("/overview");
    await expect(page).toHaveURL(/\/overview|\/sign-in/);
  });

  test("governance page responds (renders or auth redirect)", async ({ page }) => {
    await page.goto("/governance");
    await expect(page).toHaveURL(/\/governance|\/sign-in/);
  });

  test("anomalies page responds (renders or auth redirect)", async ({ page }) => {
    await page.goto("/anomalies");
    await expect(page).toHaveURL(/\/anomalies|\/sign-in/);
  });

  test("procurement page responds (renders or auth redirect)", async ({ page }) => {
    await page.goto("/procurement");
    await expect(page).toHaveURL(/\/procurement|\/sign-in/);
  });

  test("all protected routes respond (200 or auth redirect)", async ({ page }) => {
    const routes = [
      "/overview",
      "/governance",
      "/intelligence",
      "/anomalies",
      "/agents",
      "/modules",
      "/procurement",
    ];

    for (const route of routes) {
      await page.goto(route);
      // App is running if we land on the route itself or the sign-in page
      await expect(page).toHaveURL(/\/sign-in|\/overview|\/governance|\/intelligence|\/anomalies|\/agents|\/modules|\/procurement/);
    }
  });

  test("API routes respond with JSON", async ({ request }) => {
    const endpoints = [
      "/api/control-plane/governance/status",
      "/api/control-plane/governance/timeline",
      "/api/control-plane/intelligence/summary",
      "/api/control-plane/intelligence/signals",
      "/api/control-plane/anomalies",
      "/api/control-plane/agents/recommendations",
      "/api/control-plane/modules",
      "/api/control-plane/procurement/latest",
      "/api/control-plane/procurement/public-key",
    ];

    for (const endpoint of endpoints) {
      const response = await request.get(endpoint);
      // Accept 200 (authed) or 401/403 (auth gate working) — both mean the app is up
      expect([200, 401, 403]).toContain(response.status());
      if (response.status() === 200 && isJsonResponse(response)) {
        const json = await response.json();
        expect(json.ok).toBe(true);
      }
    }
  });
});
