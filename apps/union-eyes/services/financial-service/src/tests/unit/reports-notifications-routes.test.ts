import { describe, it, expect, vi, beforeEach } from "vitest";
import { invokeRoute } from "./_route-harness";

const svc = vi.hoisted(() => ({
  reports: {
    getCollectionMetrics: vi.fn(),
    getArrearsStatistics: vi.fn(),
    getRevenueAnalysis: vi.fn(),
    getMemberPaymentPatterns: vi.fn(),
    getFinancialDashboard: vi.fn(),
  },
  notify: {
    queueNotification: vi.fn(),
    getUserNotificationPreferences: vi.fn(),
    updateUserNotificationPreferences: vi.fn(),
    getNotificationHistory: vi.fn(),
    processPendingNotifications: vi.fn(),
    retryFailedNotifications: vi.fn(),
  },
}));

vi.mock("../../services/financial-reports", () => svc.reports);
vi.mock("../../services/notification-service", () => svc.notify);
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import reportsRouter from "../../routes/reports";
import notificationsRouter from "../../routes/notifications";

const ADMIN = { id: "u1", organizationId: "org-1", role: "admin", permissions: [] };
const ISO = "2025-01-06T00:00:00.000Z";
const RANGE = { startDate: ISO, endDate: ISO };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reports routes", () => {
  it("denies access for an unauthorized role", async () => {
    const r = await invokeRoute(reportsRouter, "get", "/dashboard", {
      user: { ...ADMIN, role: "member" },
    });
    expect(r.statusCode).toBe(403);
  });

  it("returns the dashboard", async () => {
    svc.reports.getFinancialDashboard.mockResolvedValue({ revenue: 1 });
    const r = await invokeRoute(reportsRouter, "get", "/dashboard", { user: ADMIN, query: RANGE });
    expect(r.statusCode).toBe(200);
  });

  it("rejects dashboard without org", async () => {
    const r = await invokeRoute(reportsRouter, "get", "/dashboard", { user: { role: "admin" } });
    expect(r.statusCode).toBe(401);
  });

  it("returns 500 on dashboard error", async () => {
    svc.reports.getFinancialDashboard.mockRejectedValue(new Error("boom"));
    const r = await invokeRoute(reportsRouter, "get", "/dashboard", { user: ADMIN, query: RANGE });
    expect(r.statusCode).toBe(500);
  });

  it("returns collection metrics", async () => {
    svc.reports.getCollectionMetrics.mockResolvedValue({ rate: 0.9 });
    const r = await invokeRoute(reportsRouter, "get", "/collection-metrics", { user: ADMIN, query: RANGE });
    expect(r.statusCode).toBe(200);
  });

  it("validates collection metrics date range", async () => {
    const r = await invokeRoute(reportsRouter, "get", "/collection-metrics", { user: ADMIN, query: {} });
    expect(r.statusCode).toBe(400);
  });

  it("rejects collection metrics without org", async () => {
    const r = await invokeRoute(reportsRouter, "get", "/collection-metrics", { user: { role: "admin" }, query: RANGE });
    expect(r.statusCode).toBe(401);
  });

  it("returns arrears statistics", async () => {
    svc.reports.getArrearsStatistics.mockResolvedValue({ total: 5 });
    const r = await invokeRoute(reportsRouter, "get", "/arrears-statistics", { user: ADMIN });
    expect(r.statusCode).toBe(200);
  });

  it("rejects arrears without org", async () => {
    const r = await invokeRoute(reportsRouter, "get", "/arrears-statistics", { user: { role: "admin" } });
    expect(r.statusCode).toBe(401);
  });

  it("returns 500 on arrears error", async () => {
    svc.reports.getArrearsStatistics.mockRejectedValue(new Error("boom"));
    const r = await invokeRoute(reportsRouter, "get", "/arrears-statistics", { user: ADMIN });
    expect(r.statusCode).toBe(500);
  });

  it("returns revenue analysis", async () => {
    svc.reports.getRevenueAnalysis.mockResolvedValue({ trend: "up" });
    const r = await invokeRoute(reportsRouter, "get", "/revenue-analysis", { user: ADMIN, query: RANGE });
    expect(r.statusCode).toBe(200);
  });

  it("validates revenue analysis range", async () => {
    const r = await invokeRoute(reportsRouter, "get", "/revenue-analysis", { user: ADMIN, query: {} });
    expect(r.statusCode).toBe(400);
  });

  it("returns member payment patterns", async () => {
    svc.reports.getMemberPaymentPatterns.mockResolvedValue([{ memberId: "m1" }]);
    const r = await invokeRoute(reportsRouter, "get", "/member-payment-patterns", {
      user: ADMIN,
      query: { ...RANGE, limit: "10" },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).data.count).toBe(1);
  });

  it("validates member payment patterns range", async () => {
    const r = await invokeRoute(reportsRouter, "get", "/member-payment-patterns", { user: ADMIN, query: {} });
    expect(r.statusCode).toBe(400);
  });

  it("exports a JSON report", async () => {
    svc.reports.getArrearsStatistics.mockResolvedValue({ total: 5 });
    const r = await invokeRoute(reportsRouter, "get", "/export", {
      user: ADMIN,
      query: { type: "arrears", format: "json", ...RANGE },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).reportType).toBe("arrears");
  });

  it("exports a CSV report from array data", async () => {
    svc.reports.getMemberPaymentPatterns.mockResolvedValue([{ memberId: "m1", score: 90 }]);
    const r = await invokeRoute(reportsRouter, "get", "/export", {
      user: ADMIN,
      query: { type: "patterns", format: "csv", ...RANGE },
    });
    expect(r.statusCode).toBe(200);
    expect(typeof r.body).toBe("string");
  });

  it("exports a CSV report from object data", async () => {
    svc.reports.getFinancialDashboard.mockResolvedValue({ revenue: 1, arrears: 2 });
    const r = await invokeRoute(reportsRouter, "get", "/export", {
      user: ADMIN,
      query: { type: "dashboard", format: "csv", ...RANGE },
    });
    expect(r.statusCode).toBe(200);
  });

  it("exports collection and revenue report types", async () => {
    svc.reports.getCollectionMetrics.mockResolvedValue({ rate: 1 });
    svc.reports.getRevenueAnalysis.mockResolvedValue({ trend: "up" });
    const c = await invokeRoute(reportsRouter, "get", "/export", { user: ADMIN, query: { type: "collection", ...RANGE } });
    expect(c.statusCode).toBe(200);
    const v = await invokeRoute(reportsRouter, "get", "/export", { user: ADMIN, query: { type: "revenue", ...RANGE } });
    expect(v.statusCode).toBe(200);
  });

  it("requires a report type for export", async () => {
    const r = await invokeRoute(reportsRouter, "get", "/export", { user: ADMIN, query: { ...RANGE } });
    expect(r.statusCode).toBe(400);
  });

  it("rejects an invalid report type", async () => {
    const r = await invokeRoute(reportsRouter, "get", "/export", { user: ADMIN, query: { type: "nope", ...RANGE } });
    expect(r.statusCode).toBe(400);
  });

  it("validates export date range", async () => {
    const r = await invokeRoute(reportsRouter, "get", "/export", { user: ADMIN, query: { type: "arrears" } });
    expect(r.statusCode).toBe(400);
  });

  it("rejects export without org", async () => {
    const r = await invokeRoute(reportsRouter, "get", "/export", { user: { role: "admin" }, query: { type: "arrears", ...RANGE } });
    expect(r.statusCode).toBe(401);
  });
});

describe("notifications routes", () => {
  const ORG_HEADERS = { "x-organization-id": "org-1" };
  const validNotification = {
    userId: "11111111-1111-1111-1111-111111111111",
    type: "payment_confirmation",
    channels: ["email"],
    data: { amount: "10" },
  };

  it("queues a notification", async () => {
    svc.notify.queueNotification.mockResolvedValue("n1");
    const r = await invokeRoute(notificationsRouter, "post", "/queue", {
      headers: ORG_HEADERS,
      body: validNotification,
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).notificationId).toBe("n1");
  });

  it("rejects queue without org header", async () => {
    const r = await invokeRoute(notificationsRouter, "post", "/queue", { body: validNotification });
    expect(r.statusCode).toBe(400);
  });

  it("returns 400 on queue validation error", async () => {
    const r = await invokeRoute(notificationsRouter, "post", "/queue", { headers: ORG_HEADERS, body: {} });
    expect(r.statusCode).toBe(400);
  });

  it("gets preferences", async () => {
    svc.notify.getUserNotificationPreferences.mockResolvedValue({ email: true });
    const r = await invokeRoute(notificationsRouter, "get", "/preferences", {
      headers: ORG_HEADERS,
      query: { userId: "u1" },
    });
    expect(r.statusCode).toBe(200);
  });

  it("requires org and userId for preferences", async () => {
    const r = await invokeRoute(notificationsRouter, "get", "/preferences", { query: {} });
    expect(r.statusCode).toBe(400);
  });

  it("returns 500 on preferences error", async () => {
    svc.notify.getUserNotificationPreferences.mockRejectedValue(new Error("boom"));
    const r = await invokeRoute(notificationsRouter, "get", "/preferences", {
      headers: ORG_HEADERS,
      query: { userId: "u1" },
    });
    expect(r.statusCode).toBe(500);
  });

  it("updates preferences", async () => {
    svc.notify.updateUserNotificationPreferences.mockResolvedValue(undefined);
    const r = await invokeRoute(notificationsRouter, "put", "/preferences", {
      headers: ORG_HEADERS,
      body: { userId: "u1", preferences: { email: true } },
    });
    expect(r.statusCode).toBe(200);
  });

  it("requires org and userId to update preferences", async () => {
    const r = await invokeRoute(notificationsRouter, "put", "/preferences", { body: {} });
    expect(r.statusCode).toBe(400);
  });

  it("returns 400 on update preferences validation error", async () => {
    const r = await invokeRoute(notificationsRouter, "put", "/preferences", {
      headers: ORG_HEADERS,
      body: { userId: "u1" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("gets history", async () => {
    svc.notify.getNotificationHistory.mockResolvedValue([{ id: "n1" }]);
    const r = await invokeRoute(notificationsRouter, "get", "/history", {
      headers: ORG_HEADERS,
      query: { userId: "u1", limit: "10" },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).count).toBe(1);
  });

  it("requires org and userId for history", async () => {
    const r = await invokeRoute(notificationsRouter, "get", "/history", { query: {} });
    expect(r.statusCode).toBe(400);
  });

  it("returns 500 on history error", async () => {
    svc.notify.getNotificationHistory.mockRejectedValue(new Error("boom"));
    const r = await invokeRoute(notificationsRouter, "get", "/history", {
      headers: ORG_HEADERS,
      query: { userId: "u1" },
    });
    expect(r.statusCode).toBe(500);
  });

  it("processes pending notifications", async () => {
    svc.notify.processPendingNotifications.mockResolvedValue(5);
    const r = await invokeRoute(notificationsRouter, "post", "/process", { body: { batchSize: "10" } });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).processed).toBe(5);
  });

  it("returns 500 on process error", async () => {
    svc.notify.processPendingNotifications.mockRejectedValue(new Error("boom"));
    const r = await invokeRoute(notificationsRouter, "post", "/process", { body: {} });
    expect(r.statusCode).toBe(500);
  });

  it("retries failed notifications", async () => {
    svc.notify.retryFailedNotifications.mockResolvedValue(2);
    const r = await invokeRoute(notificationsRouter, "post", "/retry-failed", { body: { maxAttempts: "5" } });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).retried).toBe(2);
  });

  it("returns 500 on retry error", async () => {
    svc.notify.retryFailedNotifications.mockRejectedValue(new Error("boom"));
    const r = await invokeRoute(notificationsRouter, "post", "/retry-failed", { body: {} });
    expect(r.statusCode).toBe(500);
  });

  it("sends a test notification", async () => {
    svc.notify.queueNotification.mockResolvedValue("n1");
    svc.notify.processPendingNotifications.mockResolvedValue(1);
    const r = await invokeRoute(notificationsRouter, "post", "/test", { headers: ORG_HEADERS, body: {} });
    expect(r.statusCode).toBe(200);
  });

  it("rejects test without org header", async () => {
    const r = await invokeRoute(notificationsRouter, "post", "/test", { body: {} });
    expect(r.statusCode).toBe(400);
  });

  it("returns 500 on test error", async () => {
    svc.notify.queueNotification.mockRejectedValue(new Error("boom"));
    const r = await invokeRoute(notificationsRouter, "post", "/test", { headers: ORG_HEADERS, body: {} });
    expect(r.statusCode).toBe(500);
  });
});
