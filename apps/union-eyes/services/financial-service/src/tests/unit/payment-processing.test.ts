import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const queue: any[] = [];
  function next() {
    const v = queue.shift();
    if (v instanceof Error) throw v;
    return v ?? [];
  }
  function makeChain(): any {
    const chain: any = {};
    for (const m of ["select", "from", "where", "limit", "set", "values", "returning"]) {
      chain[m] = vi.fn(() => chain);
    }
    chain.then = (resolve: (v: any) => void, reject?: (e: any) => void) => {
      try {
        return resolve(next());
      } catch (e) {
        return reject ? reject(e) : Promise.reject(e);
      }
    };
    return chain;
  }
  const db: any = {
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => makeChain()),
    update: vi.fn(() => makeChain()),
  };
  const tableCache: Record<string, any> = {};
  const schema: any = new Proxy(
    {},
    {
      get: (_t, table: string) => {
        if (table === "__esModule") return true;
        if (!tableCache[table]) {
          tableCache[table] = new Proxy(
            { __name: table },
            { get: (o: any, col: string) => (col in o ? o[col] : { __col: col }) },
          );
        }
        return tableCache[table];
      },
      has: () => true,
    },
  );
  const stripe = {
    paymentIntents: { create: vi.fn(), retrieve: vi.fn() },
    transfers: { create: vi.fn() },
    webhooks: { constructEvent: vi.fn() },
  };
  return { queue, db, schema, stripe };
});

vi.mock("@nzila/payments-stripe", () => ({ getStripeClient: vi.fn(() => h.stripe) }));
vi.mock("../../db", () => ({ db: h.db }));
vi.mock("../../db/schema", () => h.schema);
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
  createDuesPaymentIntent,
  confirmDuesPayment,
  createStipendPayout,
  batchProcessStipendPayouts,
  createDonationPaymentIntent,
  confirmDonationPayment,
  processStripeWebhook,
  getPaymentSummary,
} from "../../services/payment-processing";

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

beforeEach(() => {
  h.queue.length = 0;
  h.db.select.mockClear();
  h.db.insert.mockClear();
  h.db.update.mockClear();
  h.stripe.paymentIntents.create.mockReset();
  h.stripe.paymentIntents.retrieve.mockReset();
  h.stripe.transfers.create.mockReset();
  h.stripe.webhooks.constructEvent.mockReset();
});

describe("createDuesPaymentIntent", () => {
  it("creates a payment intent", async () => {
    h.stripe.paymentIntents.create.mockResolvedValue({
      id: "pi_1",
      client_secret: "cs_1",
      currency: "usd",
      status: "requires_payment_method",
    });
    const result = await createDuesPaymentIntent({
      organizationId: "org-1",
      memberId: "m1",
      amount: 25,
      paymentMethod: "card",
    });
    expect(result.id).toBe("pi_1");
    expect(result.clientSecret).toBe("cs_1");
  });

  it("rejects amounts below the Stripe minimum", async () => {
    await expect(
      createDuesPaymentIntent({
        organizationId: "org-1",
        memberId: "m1",
        amount: 0.1,
        paymentMethod: "card",
      }),
    ).rejects.toThrow("at least $0.50");
  });
});

describe("confirmDuesPayment", () => {
  it("updates the transaction when the intent succeeded", async () => {
    h.stripe.paymentIntents.retrieve.mockResolvedValue({ status: "succeeded" });
    await expect(
      confirmDuesPayment({ organizationId: "org-1", paymentIntentId: "pi_1", transactionId: "t1" }),
    ).resolves.toBeUndefined();
  });

  it("throws when the intent has not succeeded", async () => {
    h.stripe.paymentIntents.retrieve.mockResolvedValue({ status: "requires_action" });
    await expect(
      confirmDuesPayment({ organizationId: "org-1", paymentIntentId: "pi_1", transactionId: "t1" }),
    ).rejects.toThrow("Payment not successful");
  });
});

describe("createStipendPayout", () => {
  it("records a payout in dev mode (no Stripe key)", async () => {
    const prev = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      const result = await createStipendPayout({
        organizationId: "org-1",
        disbursementId: "d1",
        amount: 100,
        recipientBankAccount: {
          accountNumber: "1",
          routingNumber: "2",
          accountHolderName: "Jane",
          accountType: "checking",
        },
      });
      expect(result.status).toBe("pending");
      expect(result.transactionId).toMatch(/^ACH-/);
    } finally {
      if (prev !== undefined) process.env.STRIPE_SECRET_KEY = prev;
    }
  });

  it("creates a Stripe PaymentIntent when a key is configured", async () => {
    const prev = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test";
    h.stripe.paymentIntents.create.mockResolvedValue({ id: "pi_stipend" });
    enqueue([{ id: "d1", memberId: "m1" }]); // disbursement lookup
    try {
      const result = await createStipendPayout({
        organizationId: "org-1",
        disbursementId: "d1",
        amount: 100,
        recipientBankAccount: {
          accountNumber: "1",
          routingNumber: "2",
          accountHolderName: "Jane",
          accountType: "checking",
        },
      });
      expect(result.transactionId).toBe("pi_stipend");
    } finally {
      if (prev === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = prev;
    }
  });

  it("rejects amounts below $1", async () => {
    await expect(
      createStipendPayout({
        organizationId: "org-1",
        disbursementId: "d1",
        amount: 0.5,
        recipientBankAccount: {
          accountNumber: "1",
          routingNumber: "2",
          accountHolderName: "Jane",
          accountType: "checking",
        },
      }),
    ).rejects.toThrow("at least $1.00");
  });

  it("throws when the disbursement is missing (Stripe mode)", async () => {
    const prev = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test";
    enqueue([]); // disbursement not found
    try {
      await expect(
        createStipendPayout({
          organizationId: "org-1",
          disbursementId: "missing",
          amount: 100,
          recipientBankAccount: {
            accountNumber: "1",
            routingNumber: "2",
            accountHolderName: "Jane",
            accountType: "checking",
          },
        }),
      ).rejects.toThrow("not found");
    } finally {
      if (prev === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = prev;
    }
  });
});

describe("batchProcessStipendPayouts", () => {
  it("processes a mix of found and missing disbursements", async () => {
    enqueue([{ id: "d1", memberId: "m1" }], []); // d1 found, d2 missing
    const result = await batchProcessStipendPayouts({
      organizationId: "org-1",
      strikeFundId: "f1",
      disbursementIds: ["d1", "d2"],
    });
    expect(result.successful).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results[0].success).toBe(true);
    expect(result.results[1].success).toBe(false);
  });

  it("captures per-item errors when an update throws", async () => {
    enqueue([{ id: "d1", memberId: "m1" }], new Error("update failed"));
    const result = await batchProcessStipendPayouts({
      organizationId: "org-1",
      strikeFundId: "f1",
      disbursementIds: ["d1"],
    });
    expect(result.failed).toBe(1);
    expect(result.results[0].error).toBe("update failed");
  });
});

describe("createDonationPaymentIntent", () => {
  it("creates a donation payment intent", async () => {
    h.stripe.paymentIntents.create.mockResolvedValue({
      id: "pi_don",
      client_secret: "cs_don",
      currency: "usd",
      status: "requires_payment_method",
    });
    const result = await createDonationPaymentIntent({
      organizationId: "org-1",
      strikeFundId: "f1",
      amount: 50,
      donorEmail: "d@x.com",
    });
    expect(result.id).toBe("pi_don");
  });

  it("rejects donations below $1", async () => {
    await expect(
      createDonationPaymentIntent({ organizationId: "org-1", strikeFundId: "f1", amount: 0.5 }),
    ).rejects.toThrow("at least $1.00");
  });
});

describe("confirmDonationPayment", () => {
  it("creates a donation record and returns its id", async () => {
    h.stripe.paymentIntents.retrieve.mockResolvedValue({
      status: "succeeded",
      amount: 5000,
      metadata: { strikeFundId: "f1", donorName: "Jane", isAnonymous: "false" },
    });
    enqueue([{ id: "don_1" }]); // insert returning
    const id = await confirmDonationPayment({ organizationId: "org-1", paymentIntentId: "pi_1" });
    expect(id).toBe("don_1");
  });

  it("throws when the intent did not succeed", async () => {
    h.stripe.paymentIntents.retrieve.mockResolvedValue({ status: "processing" });
    await expect(
      confirmDonationPayment({ organizationId: "org-1", paymentIntentId: "pi_1" }),
    ).rejects.toThrow("Payment not successful");
  });
});

describe("processStripeWebhook", () => {
  it("throws when signature verification fails", async () => {
    h.stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });
    await expect(processStripeWebhook("body", "sig", "secret")).rejects.toThrow(
      "signature verification failed",
    );
  });

  it("skips duplicate events", async () => {
    h.stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_dup",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_1", metadata: {} } },
    });
    enqueue([{ id: "row", processed: true }]); // existing event found
    await expect(processStripeWebhook("body", "sig", "secret")).resolves.toBeUndefined();
  });

  it("processes a dues payment succeeded event", async () => {
    h.stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_1",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_1", amount: 2500, metadata: { type: "dues_payment", transactionId: "t1" } } },
    });
    // empty queue: existing select -> [], insert -> [], handler update -> [], mark processed -> []
    await expect(processStripeWebhook("body", "sig", "secret")).resolves.toBeUndefined();
  });

  it("processes a donation succeeded event", async () => {
    h.stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_2",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_2",
          amount: 5000,
          metadata: { type: "donation", organizationId: "org-1", strikeFundId: "f1" },
        },
      },
    });
    await expect(processStripeWebhook("body", "sig", "secret")).resolves.toBeUndefined();
  });

  it("processes a payment failed event", async () => {
    h.stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_3",
      type: "payment_intent.payment_failed",
      data: { object: { id: "pi_3", metadata: { type: "dues_payment", transactionId: "t1" } } },
    });
    await expect(processStripeWebhook("body", "sig", "secret")).resolves.toBeUndefined();
  });

  it("processes a charge refunded event", async () => {
    h.stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_4",
      type: "charge.refunded",
      data: { object: { payment_intent: "pi_4", metadata: {} } },
    });
    await expect(processStripeWebhook("body", "sig", "secret")).resolves.toBeUndefined();
  });

  it("ignores unhandled event types", async () => {
    h.stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_5",
      type: "customer.created",
      data: { object: { id: "c_1", metadata: {} } },
    });
    await expect(processStripeWebhook("body", "sig", "secret")).resolves.toBeUndefined();
  });

  it("returns early on a concurrent duplicate insert", async () => {
    h.stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_6",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_6", metadata: {} } },
    });
    enqueue([], new Error("duplicate key value violates unique constraint"));
    await expect(processStripeWebhook("body", "sig", "secret")).resolves.toBeUndefined();
  });

  it("records a processing error and rethrows when a handler fails", async () => {
    h.stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_7",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_7", amount: 2500, metadata: { type: "dues_payment", transactionId: "t1" } } },
    });
    enqueue([], [], new Error("handler boom")); // existing, insert, then handler update throws
    await expect(processStripeWebhook("body", "sig", "secret")).rejects.toThrow("handler boom");
  });
});

describe("getPaymentSummary", () => {
  it("aggregates dues, donations and stipends into a net balance", async () => {
    enqueue(
      [{ total: "1000", count: 10, average: "100" }], // dues
      [{ total: "500", count: 5, average: "100" }], // donations
      [{ total: "300", count: 3, average: "100" }], // stipends
    );
    const summary = await getPaymentSummary("org-1", "f1");
    expect(summary.totalRevenue).toBe(1500);
    expect(summary.totalDisbursed).toBe(300);
    expect(summary.netBalance).toBe(1200);
    expect(summary.duesPayments.count).toBe(10);
  });
});
