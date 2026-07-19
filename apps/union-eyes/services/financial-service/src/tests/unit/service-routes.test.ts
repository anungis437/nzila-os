import { describe, it, expect, vi, beforeEach } from "vitest";
import { invokeRoute } from "./_route-harness";

const svc = vi.hoisted(() => ({
  payment: {
    createDuesPaymentIntent: vi.fn(),
    confirmDuesPayment: vi.fn(),
    createStipendPayout: vi.fn(),
    batchProcessStipendPayouts: vi.fn(),
    createDonationPaymentIntent: vi.fn(),
    confirmDonationPayment: vi.fn(),
    processStripeWebhook: vi.fn(),
    getPaymentSummary: vi.fn(),
  },
  picket: {
    checkIn: vi.fn(),
    checkOut: vi.fn(),
    getActiveCheckIns: vi.fn(),
    getAttendanceHistory: vi.fn(),
    getAttendanceSummary: vi.fn(),
    generateQRCodeData: vi.fn(),
    validateQRCodeData: vi.fn(),
    coordinatorOverride: vi.fn(),
    calculateDistance: vi.fn(),
  },
  stipend: {
    calculateWeeklyStipends: vi.fn(),
    createDisbursement: vi.fn(),
    batchCreateDisbursements: vi.fn(),
    getPendingDisbursements: vi.fn(),
    getMemberDisbursements: vi.fn(),
    approveDisbursement: vi.fn(),
    markDisbursementPaid: vi.fn(),
    getStrikeFundDisbursementSummary: vi.fn(),
  },
}));

vi.mock("../../services/payment-processing", () => svc.payment);
vi.mock("../../services/picket-tracking", () => svc.picket);
vi.mock("../../services/stipend-calculation", () => svc.stipend);
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import paymentsRouter from "../../routes/payments";
import picketRouter from "../../routes/picket-tracking";
import stipendsRouter from "../../routes/stipends";

const ORG = { organizationId: "org-1", id: "user-1" };
const UUID = "11111111-1111-1111-1111-111111111111";
const ISO = "2025-01-06T00:00:00.000Z";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("payments routes", () => {
  it("creates a dues payment intent", async () => {
    svc.payment.createDuesPaymentIntent.mockResolvedValue({ id: "pi_1" });
    const r = await invokeRoute(paymentsRouter, "post", "/dues/intent", {
      user: ORG,
      body: { memberId: UUID, amount: 10, paymentMethod: "card" },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).success).toBe(true);
  });

  it("rejects dues intent without org", async () => {
    const r = await invokeRoute(paymentsRouter, "post", "/dues/intent", { body: {} });
    expect(r.statusCode).toBe(401);
  });

  it("returns 400 when the service throws on dues intent", async () => {
    svc.payment.createDuesPaymentIntent.mockRejectedValue(new Error("stripe down"));
    const r = await invokeRoute(paymentsRouter, "post", "/dues/intent", {
      user: ORG,
      body: { memberId: UUID, amount: 10, paymentMethod: "card" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("confirms a dues payment", async () => {
    svc.payment.confirmDuesPayment.mockResolvedValue(undefined);
    const r = await invokeRoute(paymentsRouter, "post", "/dues/confirm", {
      user: ORG,
      body: { paymentIntentId: "pi_1", transactionId: UUID },
    });
    expect(r.statusCode).toBe(200);
  });

  it("rejects dues confirm without org", async () => {
    const r = await invokeRoute(paymentsRouter, "post", "/dues/confirm", { body: {} });
    expect(r.statusCode).toBe(401);
  });

  it("creates a stipend payout", async () => {
    svc.payment.createStipendPayout.mockResolvedValue({ id: "po_1" });
    const r = await invokeRoute(paymentsRouter, "post", "/stipends/payout", {
      user: ORG,
      body: {
        disbursementId: UUID,
        amount: 100,
        recipientBankAccount: {
          accountNumber: "123",
          routingNumber: "456",
          accountHolderName: "Jane",
          accountType: "checking",
        },
      },
    });
    expect(r.statusCode).toBe(200);
  });

  it("rejects stipend payout without org", async () => {
    const r = await invokeRoute(paymentsRouter, "post", "/stipends/payout", { body: {} });
    expect(r.statusCode).toBe(401);
  });

  it("processes a batch stipend payout", async () => {
    svc.payment.batchProcessStipendPayouts.mockResolvedValue([{ id: "po_1" }]);
    const r = await invokeRoute(paymentsRouter, "post", "/stipends/payout/batch", {
      user: ORG,
      body: { strikeFundId: UUID, disbursementIds: [UUID] },
    });
    expect(r.statusCode).toBe(200);
  });

  it("rejects batch payout without org", async () => {
    const r = await invokeRoute(paymentsRouter, "post", "/stipends/payout/batch", { body: {} });
    expect(r.statusCode).toBe(401);
  });

  it("creates a donation intent (org from body)", async () => {
    svc.payment.createDonationPaymentIntent.mockResolvedValue({ id: "pi_d" });
    const r = await invokeRoute(paymentsRouter, "post", "/donations/intent", {
      body: { organizationId: "org-1", strikeFundId: UUID, amount: 25 },
    });
    expect(r.statusCode).toBe(200);
  });

  it("confirms a donation", async () => {
    svc.payment.confirmDonationPayment.mockResolvedValue("don_1");
    const r = await invokeRoute(paymentsRouter, "post", "/donations/confirm", {
      body: { organizationId: "org-1", paymentIntentId: "pi_d" },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).donationId).toBe("don_1");
  });

  it("rejects a webhook with no signature", async () => {
    const r = await invokeRoute(paymentsRouter, "post", "/webhook/stripe", { body: {} });
    expect(r.statusCode).toBe(400);
  });

  it("returns 500 when webhook secret is not configured", async () => {
    const prev = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    try {
      const r = await invokeRoute(paymentsRouter, "post", "/webhook/stripe", {
        headers: { "stripe-signature": "sig" },
        body: {},
      });
      expect(r.statusCode).toBe(500);
    } finally {
      if (prev !== undefined) process.env.STRIPE_WEBHOOK_SECRET = prev;
    }
  });

  it("processes a valid webhook", async () => {
    const prev = process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    svc.payment.processStripeWebhook.mockResolvedValue(undefined);
    try {
      const r = await invokeRoute(paymentsRouter, "post", "/webhook/stripe", {
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

  it("gets a payment summary", async () => {
    svc.payment.getPaymentSummary.mockResolvedValue({ total: 100 });
    const r = await invokeRoute(paymentsRouter, "get", "/summary", {
      user: ORG,
      query: { strikeFundId: UUID, startDate: ISO, endDate: ISO },
    });
    expect(r.statusCode).toBe(200);
  });

  it("rejects summary without org", async () => {
    const r = await invokeRoute(paymentsRouter, "get", "/summary", { query: {} });
    expect(r.statusCode).toBe(401);
  });
});

describe("picket-tracking routes", () => {
  it("checks in a member", async () => {
    svc.picket.checkIn.mockResolvedValue({ success: true, attendanceId: "a1", distance: 10 });
    const r = await invokeRoute(picketRouter, "post", "/check-in", {
      user: ORG,
      body: { strikeFundId: UUID, memberId: UUID, method: "manual" },
    });
    expect(r.statusCode).toBe(200);
  });

  it("returns 400 when check-in fails", async () => {
    svc.picket.checkIn.mockResolvedValue({ success: false, error: "too far", distance: 999 });
    const r = await invokeRoute(picketRouter, "post", "/check-in", {
      user: ORG,
      body: { strikeFundId: UUID, memberId: UUID, method: "gps" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("returns 400 on check-in validation error", async () => {
    const r = await invokeRoute(picketRouter, "post", "/check-in", { user: ORG, body: { method: "x" } });
    expect(r.statusCode).toBe(400);
  });

  it("checks out a member", async () => {
    svc.picket.checkOut.mockResolvedValue({ success: true, hoursWorked: 8 });
    const r = await invokeRoute(picketRouter, "post", "/check-out", {
      user: ORG,
      body: { attendanceId: UUID },
    });
    expect(r.statusCode).toBe(200);
  });

  it("returns 400 when check-out fails", async () => {
    svc.picket.checkOut.mockResolvedValue({ success: false, error: "not found" });
    const r = await invokeRoute(picketRouter, "post", "/check-out", {
      user: ORG,
      body: { attendanceId: UUID },
    });
    expect(r.statusCode).toBe(400);
  });

  it("lists active check-ins", async () => {
    svc.picket.getActiveCheckIns.mockResolvedValue([{ id: "a1" }]);
    const r = await invokeRoute(picketRouter, "get", "/active", {
      user: ORG,
      query: { strikeFundId: UUID },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).count).toBe(1);
  });

  it("requires strikeFundId for active", async () => {
    const r = await invokeRoute(picketRouter, "get", "/active", { user: ORG, query: {} });
    expect(r.statusCode).toBe(400);
  });

  it("returns 500 when active lookup throws", async () => {
    svc.picket.getActiveCheckIns.mockRejectedValue(new Error("db"));
    const r = await invokeRoute(picketRouter, "get", "/active", { user: ORG, query: { strikeFundId: UUID } });
    expect(r.statusCode).toBe(500);
  });

  it("fetches attendance history", async () => {
    svc.picket.getAttendanceHistory.mockResolvedValue([{ id: "a1" }]);
    const r = await invokeRoute(picketRouter, "get", "/history", {
      user: ORG,
      query: { strikeFundId: UUID, startDate: ISO, endDate: ISO },
    });
    expect(r.statusCode).toBe(200);
  });

  it("validates history date params", async () => {
    const missing = await invokeRoute(picketRouter, "get", "/history", { user: ORG, query: { strikeFundId: UUID } });
    expect(missing.statusCode).toBe(400);
    const bad = await invokeRoute(picketRouter, "get", "/history", {
      user: ORG,
      query: { strikeFundId: UUID, startDate: "bad", endDate: "bad" },
    });
    expect(bad.statusCode).toBe(400);
  });

  it("requires strikeFundId for history", async () => {
    const r = await invokeRoute(picketRouter, "get", "/history", { user: ORG, query: {} });
    expect(r.statusCode).toBe(400);
  });

  it("fetches attendance summary", async () => {
    svc.picket.getAttendanceSummary.mockResolvedValue([{ memberId: "m1" }]);
    const r = await invokeRoute(picketRouter, "get", "/summary", {
      user: ORG,
      query: { strikeFundId: UUID, startDate: ISO, endDate: ISO },
    });
    expect(r.statusCode).toBe(200);
  });

  it("validates summary params", async () => {
    const noFund = await invokeRoute(picketRouter, "get", "/summary", { user: ORG, query: {} });
    expect(noFund.statusCode).toBe(400);
    const noDates = await invokeRoute(picketRouter, "get", "/summary", { user: ORG, query: { strikeFundId: UUID } });
    expect(noDates.statusCode).toBe(400);
    const badDates = await invokeRoute(picketRouter, "get", "/summary", {
      user: ORG,
      query: { strikeFundId: UUID, startDate: "x", endDate: "x" },
    });
    expect(badDates.statusCode).toBe(400);
  });

  it("generates QR data", async () => {
    svc.picket.generateQRCodeData.mockReturnValue("qr-data");
    const r = await invokeRoute(picketRouter, "post", "/generate-qr", {
      body: { strikeFundId: UUID, memberId: UUID },
    });
    expect(r.statusCode).toBe(200);
  });

  it("requires fields for QR generation", async () => {
    const r = await invokeRoute(picketRouter, "post", "/generate-qr", { body: {} });
    expect(r.statusCode).toBe(400);
  });

  it("validates QR data", async () => {
    svc.picket.validateQRCodeData.mockReturnValue({ valid: true, fundId: "f1", memberId: "m1" });
    const r = await invokeRoute(picketRouter, "post", "/validate-qr", { body: { qrData: "x" } });
    expect(r.statusCode).toBe(200);
  });

  it("rejects invalid QR data", async () => {
    svc.picket.validateQRCodeData.mockReturnValue({ valid: false, error: "expired" });
    const r = await invokeRoute(picketRouter, "post", "/validate-qr", { body: { qrData: "x" } });
    expect(r.statusCode).toBe(400);
  });

  it("requires qrData for validation", async () => {
    const r = await invokeRoute(picketRouter, "post", "/validate-qr", { body: {} });
    expect(r.statusCode).toBe(400);
  });

  it("allows a coordinator override", async () => {
    svc.picket.coordinatorOverride.mockResolvedValue({ success: true, attendanceId: "a1" });
    const r = await invokeRoute(picketRouter, "post", "/coordinator-override", {
      user: { organizationId: "org-1", role: "coordinator" },
      body: { strikeFundId: UUID, memberId: UUID, hours: 8, reason: "valid reason here", verifiedBy: "u1" },
    });
    expect(r.statusCode).toBe(200);
  });

  it("rejects coordinator override for non-coordinators", async () => {
    const r = await invokeRoute(picketRouter, "post", "/coordinator-override", {
      user: { organizationId: "org-1", role: "member" },
      body: {},
    });
    expect(r.statusCode).toBe(403);
  });

  it("returns 400 when coordinator override fails", async () => {
    svc.picket.coordinatorOverride.mockResolvedValue({ success: false, error: "bad" });
    const r = await invokeRoute(picketRouter, "post", "/coordinator-override", {
      user: { organizationId: "org-1", role: "admin" },
      body: { strikeFundId: UUID, memberId: UUID, hours: 8, reason: "valid reason here", verifiedBy: "u1" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("returns 400 on coordinator override validation error", async () => {
    const r = await invokeRoute(picketRouter, "post", "/coordinator-override", {
      user: { organizationId: "org-1", role: "admin" },
      body: { hours: 8 },
    });
    expect(r.statusCode).toBe(400);
  });

  it("calculates distance", async () => {
    svc.picket.calculateDistance.mockReturnValue(1609.34);
    const r = await invokeRoute(picketRouter, "post", "/calculate-distance", {
      body: { lat1: 1, lon1: 2, lat2: 3, lon2: 4 },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).data.distanceMeters).toBe(1609);
  });

  it("requires all coordinates for distance", async () => {
    const r = await invokeRoute(picketRouter, "post", "/calculate-distance", { body: { lat1: 1 } });
    expect(r.statusCode).toBe(400);
  });
});

describe("stipends routes", () => {
  const week = { weekStartDate: ISO, weekEndDate: ISO };

  it("calculates stipends", async () => {
    svc.stipend.calculateWeeklyStipends.mockResolvedValue([
      { eligible: true, stipendAmount: 100 },
      { eligible: false, stipendAmount: 0 },
    ]);
    const r = await invokeRoute(stipendsRouter, "post", "/calculate", {
      user: ORG,
      body: { strikeFundId: UUID, ...week },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).summary.eligible).toBe(1);
  });

  it("returns 500 when calculate validation fails", async () => {
    const r = await invokeRoute(stipendsRouter, "post", "/calculate", { user: ORG, body: {} });
    expect(r.statusCode).toBe(500);
  });

  it("creates a disbursement", async () => {
    svc.stipend.createDisbursement.mockResolvedValue({ success: true, disbursementId: "d1" });
    const r = await invokeRoute(stipendsRouter, "post", "/disbursements", {
      user: ORG,
      body: { strikeFundId: UUID, memberId: UUID, amount: 100, ...week, paymentMethod: "check" },
    });
    expect(r.statusCode).toBe(200);
  });

  it("returns 400 when disbursement creation fails", async () => {
    svc.stipend.createDisbursement.mockResolvedValue({ success: false, error: "bad" });
    const r = await invokeRoute(stipendsRouter, "post", "/disbursements", {
      user: ORG,
      body: { strikeFundId: UUID, memberId: UUID, amount: 100, ...week, paymentMethod: "check" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("batch creates disbursements", async () => {
    svc.stipend.batchCreateDisbursements.mockResolvedValue({ success: true, created: 3 });
    const r = await invokeRoute(stipendsRouter, "post", "/disbursements/batch", {
      user: ORG,
      body: { strikeFundId: UUID, ...week, paymentMethod: "cash" },
    });
    expect(r.statusCode).toBe(200);
  });

  it("gets pending disbursements", async () => {
    svc.stipend.getPendingDisbursements.mockResolvedValue([{ id: "d1" }]);
    const r = await invokeRoute(stipendsRouter, "get", "/disbursements/pending/:strikeFundId", {
      user: ORG,
      params: { strikeFundId: UUID },
    });
    expect(r.statusCode).toBe(200);
  });

  it("gets member disbursements", async () => {
    svc.stipend.getMemberDisbursements.mockResolvedValue([{ amount: 100 }, { amount: 50 }]);
    const r = await invokeRoute(stipendsRouter, "get", "/disbursements/member/:memberId", {
      user: ORG,
      params: { memberId: UUID },
      query: { strikeFundId: UUID },
    });
    expect(r.statusCode).toBe(200);
    expect((r.body as any).totalAmount).toBe(150);
  });

  it("approves a disbursement", async () => {
    svc.stipend.approveDisbursement.mockResolvedValue({ success: true });
    const r = await invokeRoute(stipendsRouter, "post", "/disbursements/:disbursementId/approve", {
      user: ORG,
      params: { disbursementId: UUID },
      body: { approvalNotes: "ok" },
    });
    expect(r.statusCode).toBe(200);
  });

  it("returns 400 when approval fails", async () => {
    svc.stipend.approveDisbursement.mockResolvedValue({ success: false, error: "bad" });
    const r = await invokeRoute(stipendsRouter, "post", "/disbursements/:disbursementId/approve", {
      user: ORG,
      params: { disbursementId: UUID },
      body: {},
    });
    expect(r.statusCode).toBe(400);
  });

  it("marks a disbursement paid", async () => {
    svc.stipend.markDisbursementPaid.mockResolvedValue({ success: true });
    const r = await invokeRoute(stipendsRouter, "post", "/disbursements/:disbursementId/paid", {
      user: ORG,
      params: { disbursementId: UUID },
      body: { transactionId: "tx1" },
    });
    expect(r.statusCode).toBe(200);
  });

  it("returns 400 when mark-paid fails", async () => {
    svc.stipend.markDisbursementPaid.mockResolvedValue({ success: false, error: "bad" });
    const r = await invokeRoute(stipendsRouter, "post", "/disbursements/:disbursementId/paid", {
      user: ORG,
      params: { disbursementId: UUID },
      body: { transactionId: "tx1" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("gets a strike fund summary", async () => {
    svc.stipend.getStrikeFundDisbursementSummary.mockResolvedValue({ total: 500 });
    const r = await invokeRoute(stipendsRouter, "get", "/summary/:strikeFundId", {
      user: ORG,
      params: { strikeFundId: UUID },
    });
    expect(r.statusCode).toBe(200);
  });

  it("returns 500 when summary lookup throws", async () => {
    svc.stipend.getStrikeFundDisbursementSummary.mockRejectedValue(new Error("db"));
    const r = await invokeRoute(stipendsRouter, "get", "/summary/:strikeFundId", {
      user: ORG,
      params: { strikeFundId: UUID },
    });
    expect(r.statusCode).toBe(500);
  });
});
