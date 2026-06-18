import { describe, it, expect, vi, beforeEach } from "vitest";
import { invokeRoute } from "./_route-harness";

const h = vi.hoisted(() => {
  const queue: any[] = [];
  function next() {
    const v = queue.shift();
    if (v instanceof Error) throw v;
    return v ?? rows([]);
  }
  const db: any = { execute: vi.fn(async () => next()) };
  const stripe = {
    paymentIntents: { create: vi.fn() },
    webhooks: { constructEvent: vi.fn() },
  };
  return { queue, db, stripe };
});

// Hybrid result: an array that also exposes `.rows` pointing to itself, matching
// both `result.rows[...]` and `result[0]`/`result.length` access patterns.
function rows(arr: any[]): any {
  const a = [...arr];
  (a as any).rows = a;
  return a;
}

vi.mock("@nzila/payments-stripe", () => ({ getStripeClient: vi.fn(() => h.stripe) }));
vi.mock("../../db", () => ({ db: h.db }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import donationsRouter from "../../routes/donations";
import strikeFundsRouter from "../../routes/strike-funds";

const UUID = "11111111-1111-1111-1111-111111111111";

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

beforeEach(() => {
  h.queue.length = 0;
  h.db.execute.mockClear();
  h.stripe.paymentIntents.create.mockReset();
  h.stripe.webhooks.constructEvent.mockReset();
});

describe("donations routes", () => {
  const donateBody = { fundId: UUID, amount: 50, donorEmail: "d@x.com" };

  it("creates a donation payment intent", async () => {
    h.stripe.paymentIntents.create.mockResolvedValue({ id: "pi_1", client_secret: "cs_1" });
    enqueue(rows([{ id: "f1", fund_name: "Fund", tenant_id: "org-1", status: "active" }]), rows([{ id: "don1" }]));
    const r = await invokeRoute(donationsRouter, "post", "/", { body: donateBody });
    expect(r.statusCode).toBe(201);
    expect((r.body as any).data.donationId).toBe("don1");
  });

  it("returns 404 when the fund is inactive", async () => {
    enqueue(rows([]));
    const r = await invokeRoute(donationsRouter, "post", "/", { body: donateBody });
    expect(r.statusCode).toBe(404);
  });

  it("returns 400 on validation error", async () => {
    const r = await invokeRoute(donationsRouter, "post", "/", { body: { amount: -1 } });
    expect(r.statusCode).toBe(400);
  });

  it("returns 500 when stripe throws", async () => {
    enqueue(rows([{ id: "f1", fund_name: "Fund", tenant_id: "org-1", status: "active" }]));
    h.stripe.paymentIntents.create.mockRejectedValue(new Error("stripe down"));
    const r = await invokeRoute(donationsRouter, "post", "/", { body: donateBody });
    expect(r.statusCode).toBe(500);
  });

  it("rejects a webhook with no signature", async () => {
    const r = await invokeRoute(donationsRouter, "post", "/webhooks/stripe", { body: {} });
    expect(r.statusCode).toBe(400);
  });

  it("returns 503 when webhook secret is missing", async () => {
    const prev = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    try {
      const r = await invokeRoute(donationsRouter, "post", "/webhooks/stripe", {
        headers: { "stripe-signature": "sig" },
        body: {},
      });
      expect(r.statusCode).toBe(503);
    } finally {
      if (prev !== undefined) process.env.STRIPE_WEBHOOK_SECRET = prev;
    }
  });

  it("returns 400 when signature verification fails", async () => {
    const prev = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec";
    h.stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });
    try {
      const r = await invokeRoute(donationsRouter, "post", "/webhooks/stripe", {
        headers: { "stripe-signature": "sig" },
        body: {},
      });
      expect(r.statusCode).toBe(400);
    } finally {
      if (prev === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = prev;
    }
  });

  it("handles payment_intent.succeeded", async () => {
    const prev = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec";
    h.stripe.webhooks.constructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_1", amount: 5000, metadata: { fundId: UUID } } },
    });
    enqueue(rows([]), rows([])); // update donation, update fund balance
    try {
      const r = await invokeRoute(donationsRouter, "post", "/webhooks/stripe", {
        headers: { "stripe-signature": "sig" },
        body: {},
      });
      expect(r.statusCode).toBe(200);
      expect((r.body as any).received).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = prev;
    }
  });

  it("handles payment_intent.payment_failed and canceled", async () => {
    const prev = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec";
    try {
      h.stripe.webhooks.constructEvent.mockReturnValue({
        type: "payment_intent.payment_failed",
        data: { object: { id: "pi_1", amount: 100, metadata: {} } },
      });
      const failed = await invokeRoute(donationsRouter, "post", "/webhooks/stripe", {
        headers: { "stripe-signature": "sig" },
        body: {},
      });
      expect(failed.statusCode).toBe(200);

      h.stripe.webhooks.constructEvent.mockReturnValue({
        type: "payment_intent.canceled",
        data: { object: { id: "pi_1", amount: 100, metadata: {} } },
      });
      const canceled = await invokeRoute(donationsRouter, "post", "/webhooks/stripe", {
        headers: { "stripe-signature": "sig" },
        body: {},
      });
      expect(canceled.statusCode).toBe(200);

      h.stripe.webhooks.constructEvent.mockReturnValue({
        type: "some.other.event",
        data: { object: {} },
      });
      const other = await invokeRoute(donationsRouter, "post", "/webhooks/stripe", {
        headers: { "stripe-signature": "sig" },
        body: {},
      });
      expect(other.statusCode).toBe(200);
    } finally {
      if (prev === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = prev;
    }
  });

  it("returns 500 when a webhook handler throws", async () => {
    const prev = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec";
    h.stripe.webhooks.constructEvent.mockReturnValue({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_1", amount: 100, metadata: { fundId: UUID } } },
    });
    enqueue(new Error("db down"));
    try {
      const r = await invokeRoute(donationsRouter, "post", "/webhooks/stripe", {
        headers: { "stripe-signature": "sig" },
        body: {},
      });
      expect(r.statusCode).toBe(500);
    } finally {
      if (prev === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
      else process.env.STRIPE_WEBHOOK_SECRET = prev;
    }
  });

  it("returns campaign info", async () => {
    enqueue(
      rows([
        {
          id: "f1",
          fund_name: "Fund",
          description: "d",
          target_amount: "1000",
          current_balance: "200",
          status: "active",
          donor_count: "3",
          total_donations: "500",
        },
      ]),
      rows([{ donor_name: "Jane", amount: "100" }]),
    );
    const r = await invokeRoute(donationsRouter, "get", "/campaigns/:fundId", { params: { fundId: UUID } });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).data.donorCount).toBe(3);
  });

  it("returns 404 for a missing campaign", async () => {
    enqueue(rows([]));
    const r = await invokeRoute(donationsRouter, "get", "/campaigns/:fundId", { params: { fundId: UUID } });
    expect(r.statusCode).toBe(404);
  });

  it("returns 500 for an invalid campaign id", async () => {
    const r = await invokeRoute(donationsRouter, "get", "/campaigns/:fundId", { params: { fundId: "not-a-uuid" } });
    expect(r.statusCode).toBe(500);
  });

  it("returns donation status", async () => {
    enqueue(rows([{ id: "don1", amount: "50", status: "completed" }]));
    const r = await invokeRoute(donationsRouter, "get", "/:donationId", { params: { donationId: UUID } });
    expect(r.statusCode).toBe(200);
  });

  it("returns 404 for a missing donation", async () => {
    enqueue(rows([]));
    const r = await invokeRoute(donationsRouter, "get", "/:donationId", { params: { donationId: UUID } });
    expect(r.statusCode).toBe(404);
  });
});

describe("strike-funds routes", () => {
  const ADMIN = { organizationId: "org-1", userId: "u1", role: "admin" };

  it("checks in to the picket line", async () => {
    enqueue(rows([]), rows([{ id: "att1" }])); // no existing, insert
    const r = await invokeRoute(strikeFundsRouter, "post", "/:fundId/check-in", {
      user: ADMIN,
      params: { fundId: UUID },
      body: { picketLocationId: UUID, checkInMethod: "manual" },
    });
    expect(r.statusCode).toBe(201);
  });

  it("rejects a duplicate check-in", async () => {
    enqueue(rows([{ id: "existing" }]));
    const r = await invokeRoute(strikeFundsRouter, "post", "/:fundId/check-in", {
      user: ADMIN,
      params: { fundId: UUID },
      body: { picketLocationId: UUID, checkInMethod: "manual" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("fails GPS check-in when location is not verified", async () => {
    enqueue(rows([]), rows([{ verified: false }]));
    const r = await invokeRoute(strikeFundsRouter, "post", "/:fundId/check-in", {
      user: ADMIN,
      params: { fundId: UUID },
      body: { picketLocationId: UUID, checkInMethod: "gps", latitude: 1, longitude: 2 },
    });
    expect(r.statusCode).toBe(400);
  });

  it("allows a GPS check-in when verified", async () => {
    enqueue(rows([]), rows([{ verified: true }]), rows([{ id: "att1" }]));
    const r = await invokeRoute(strikeFundsRouter, "post", "/:fundId/check-in", {
      user: ADMIN,
      params: { fundId: UUID },
      body: { picketLocationId: UUID, checkInMethod: "gps", latitude: 1, longitude: 2 },
    });
    expect(r.statusCode).toBe(201);
  });

  it("returns 400 on check-in validation error", async () => {
    const r = await invokeRoute(strikeFundsRouter, "post", "/:fundId/check-in", {
      user: ADMIN,
      params: { fundId: UUID },
      body: {},
    });
    expect(r.statusCode).toBe(400);
  });

  it("checks out from the picket line", async () => {
    enqueue(rows([{ id: "att1" }]));
    const r = await invokeRoute(strikeFundsRouter, "post", "/:fundId/check-out", {
      user: ADMIN,
      params: { fundId: UUID },
      body: { attendanceId: UUID },
    });
    expect(r.statusCode).toBe(200);
  });

  it("returns 404 when there is no active check-in to check out", async () => {
    enqueue(rows([]));
    const r = await invokeRoute(strikeFundsRouter, "post", "/:fundId/check-out", {
      user: ADMIN,
      params: { fundId: UUID },
      body: { attendanceId: UUID },
    });
    expect(r.statusCode).toBe(404);
  });

  it("returns 400 on check-out validation error", async () => {
    const r = await invokeRoute(strikeFundsRouter, "post", "/:fundId/check-out", {
      user: ADMIN,
      params: { fundId: UUID },
      body: {},
    });
    expect(r.statusCode).toBe(400);
  });

  it("calculates stipends (dry run)", async () => {
    enqueue(rows([{ member_id: "m1", hours_worked: 8, stipend_amount: 100 }]));
    const r = await invokeRoute(strikeFundsRouter, "post", "/:fundId/stipends/calculate", {
      user: ADMIN,
      params: { fundId: UUID },
      body: { weekStart: "2025-01-01", weekEnd: "2025-01-07", dryRun: true },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).data.dryRun).toBe(true);
  });

  it("calculates stipends and creates disbursements", async () => {
    enqueue(rows([{ member_id: "m1", hours_worked: 8, stipend_amount: 100 }]), rows([{ id: "d1" }]));
    const r = await invokeRoute(strikeFundsRouter, "post", "/:fundId/stipends/calculate", {
      user: ADMIN,
      params: { fundId: UUID },
      body: { weekStart: "2025-01-01", weekEnd: "2025-01-07" },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).data.totalDisbursements).toBe(1);
  });

  it("denies stipend calculation for non-admins", async () => {
    const r = await invokeRoute(strikeFundsRouter, "post", "/:fundId/stipends/calculate", {
      user: { organizationId: "org-1", userId: "u1", role: "member" },
      params: { fundId: UUID },
      body: {},
    });
    expect(r.statusCode).toBe(403);
  });

  it("returns 400 on stipend validation error", async () => {
    const r = await invokeRoute(strikeFundsRouter, "post", "/:fundId/stipends/calculate", {
      user: ADMIN,
      params: { fundId: UUID },
      body: { weekStart: "not-a-date" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("lists strike funds", async () => {
    enqueue(rows([{ id: "f1" }]));
    const r = await invokeRoute(strikeFundsRouter, "get", "/", { user: ADMIN });
    expect(r.statusCode).toBe(200);
  });

  it("returns 500 when listing throws", async () => {
    enqueue(new Error("db down"));
    const r = await invokeRoute(strikeFundsRouter, "get", "/", { user: ADMIN });
    expect(r.statusCode).toBe(500);
  });

  it("creates a strike fund", async () => {
    enqueue(rows([{ id: "f1" }]));
    const r = await invokeRoute(strikeFundsRouter, "post", "/", {
      user: ADMIN,
      body: { name: "Fund", targetAmount: 1000, weeklyStipendAmount: 100, startDate: "2025-01-01" },
    });
    expect(r.statusCode).toBe(201);
  });

  it("denies fund creation for non-admins", async () => {
    const r = await invokeRoute(strikeFundsRouter, "post", "/", {
      user: { organizationId: "org-1", userId: "u1", role: "financial_admin" },
      body: {},
    });
    expect(r.statusCode).toBe(403);
  });

  it("returns 400 on fund creation validation error", async () => {
    const r = await invokeRoute(strikeFundsRouter, "post", "/", { user: ADMIN, body: { name: "" } });
    expect(r.statusCode).toBe(400);
  });
});
