import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const cronFns: Array<() => unknown> = [];
  const processAutomatedAlerts = vi.fn(async () => ({
    success: true,
    alertsSent: 2,
    alerts: [
      { fundId: "f1", fundName: "F1", severity: "critical", message: "x" },
      { fundId: "f2", fundName: "F2", severity: "warning", message: "y" },
    ],
  }));
  const generateWeeklyForecastReport = vi.fn(async () => ({
    success: true,
    reportGenerated: true,
    totalFunds: 3,
    criticalFunds: 1,
    warningFunds: 1,
  }));
  return { cronFns, processAutomatedAlerts, generateWeeklyForecastReport };
});

vi.mock("node-cron", () => ({
  default: {
    schedule: vi.fn((..._args: any[]) => {
      const fn = _args.find((a) => typeof a === "function");
      if (fn) h.cronFns.push(fn);
      return { start: vi.fn(), stop: vi.fn() };
    }),
  },
}));
vi.mock("../../services/burn-rate-predictor", () => ({
  processAutomatedAlerts: h.processAutomatedAlerts,
  generateWeeklyForecastReport: h.generateWeeklyForecastReport,
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
// Gate 13 governance tracking is exercised by dedicated job-cancellation-service tests;
// stub it here so it doesn't consume the shared business-logic mock db queue above.
vi.mock("../../services/job-cancellation-service", () => {
  class JobCancellationService {
    async startJobExecution() { return { id: "test-exec-state-id" }; }
    async requestCancellation() { /* no-op */ }
    async isJobCancelled() { return false; }
    async completeJob() { /* no-op */ }
    async failJob() { /* no-op */ }
    async cancelJob() { /* no-op */ }
    async recordAuditEvent() { /* no-op */ }
    async getExecutionState() { return null; }
  }
  return { JobCancellationService, jobCancellationService: new JobCancellationService() };
});

import { startAnalyticsJobs, stopAnalyticsJobs, getJobsStatus } from "../../jobs/analytics-processor";

beforeEach(() => {
  h.processAutomatedAlerts.mockClear();
  h.generateWeeklyForecastReport.mockClear();
});

describe("analytics-processor", () => {
  it("start/stop/getStatus operate without throwing", () => {
    const jobs = startAnalyticsJobs();
    expect(jobs.hourlyAlertsJob).toBeDefined();
    expect(() => stopAnalyticsJobs()).not.toThrow();
    const status = getJobsStatus();
    expect(status.hourlyAlerts.running).toBe(true);
    expect(status.weeklyForecast.running).toBe(true);
  });

  it("runs the scheduled cron callbacks", async () => {
    await Promise.all(h.cronFns.map((fn) => fn()));
    expect(h.processAutomatedAlerts).toHaveBeenCalled();
    expect(h.generateWeeklyForecastReport).toHaveBeenCalled();
  });
});
