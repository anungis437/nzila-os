import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => {
  const queue: any[] = [];
  const captured: any[] = [];
  function next() {
    const v = queue.shift();
    if (v instanceof Error) throw v;
    return v ?? [];
  }
  function makeChain(): any {
    const chain: any = {};
    for (const m of ["select", "from", "where", "limit", "groupBy", "orderBy", "set", "returning"]) {
      chain[m] = vi.fn(() => chain);
    }
    chain.values = vi.fn((v: any) => {
      captured.push(v);
      return chain;
    });
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
  return { queue, captured, db, schema };
});

vi.mock("../../db", () => ({ db: h.db }));
vi.mock("../../db/schema-platform-economics", () => h.schema);

import {
  trackSubscriptionEvent,
  calculateMonthlyMrrSnapshot,
} from "../../services/subscription-event-tracker";

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

beforeEach(() => {
  h.queue.length = 0;
  h.captured.length = 0;
  h.db.select.mockClear();
  h.db.insert.mockClear();
  h.db.update.mockClear();
});

describe("trackSubscriptionEvent", () => {
  it("records a new subscription and creates an acquisition record", async () => {
    enqueue([], [], []); // insert event, select existing (none), insert acquisition
    await trackSubscriptionEvent({
      organizationId: "org-1",
      eventType: "subscription_started",
      planTier: "pro",
      source: "stripe",
    });
    // first captured value is the subscription event with mrrChange = monthly (99)
    expect(h.captured[0].mrrChange).toBe("99");
    expect(h.captured[0].monthlyAmount).toBe("99");
    // acquisition insert happened
    expect(h.captured.length).toBe(2);
  });

  it("updates an existing acquisition record on subscription_started", async () => {
    enqueue([], [{ id: "c1", totalRevenue: "100", monthsActive: 2 }], []);
    await trackSubscriptionEvent({
      organizationId: "org-1",
      eventType: "subscription_started",
      planTier: "starter",
    });
    // only the event insert is captured (update path, no second insert)
    expect(h.captured).toHaveLength(1);
    expect(h.db.update).toHaveBeenCalled();
  });

  it("computes MRR delta for an upgrade and updates customer MRR", async () => {
    enqueue([], [{ id: "c1", totalRevenue: "50", monthsActive: 3 }], []);
    await trackSubscriptionEvent({
      organizationId: "org-1",
      eventType: "subscription_upgraded",
      planTier: "enterprise",
      previousMonthlyAmount: 99,
    });
    // 299 - 99 = 200
    expect(h.captured[0].mrrChange).toBe("200");
    expect(h.db.update).toHaveBeenCalled();
  });

  it("computes negative MRR delta for a downgrade", async () => {
    enqueue([], [{ id: "c1", totalRevenue: "50", monthsActive: 3 }], []);
    await trackSubscriptionEvent({
      organizationId: "org-1",
      eventType: "subscription_downgraded",
      planTier: "starter",
      previousMonthlyAmount: 99,
    });
    // 29 - 99 = -70
    expect(h.captured[0].mrrChange).toBe("-70");
  });

  it("marks the customer churned on cancellation", async () => {
    enqueue([], [{ id: "c1" }], []);
    await trackSubscriptionEvent({
      organizationId: "org-1",
      eventType: "subscription_cancelled",
      planTier: "pro",
      previousMonthlyAmount: 99,
    });
    expect(h.captured[0].mrrChange).toBe("-99");
    expect(h.db.update).toHaveBeenCalled();
  });

  it("handles reactivation and billing-cycle change without follow-up writes", async () => {
    enqueue([]); // just the event insert
    await trackSubscriptionEvent({
      organizationId: "org-1",
      eventType: "subscription_reactivated",
      planTier: "pro",
    });
    expect(h.captured[0].mrrChange).toBe("99");

    h.captured.length = 0;
    enqueue([]);
    await trackSubscriptionEvent({
      organizationId: "org-1",
      eventType: "billing_cycle_changed",
      planTier: "pro",
      billingCycle: "yearly",
      previousMonthlyAmount: 29,
    });
    // yearly: 99 - 29 = 70
    expect(h.captured[0].mrrChange).toBe("70");
  });

  it("defaults to zero pricing for an unknown plan tier", async () => {
    enqueue([]);
    await trackSubscriptionEvent({
      organizationId: "org-1",
      eventType: "payment_succeeded",
      planTier: "mystery",
    });
    expect(h.captured[0].monthlyAmount).toBe("0");
    expect(h.captured[0].mrrChange).toBe("0");
  });
});

describe("calculateMonthlyMrrSnapshot", () => {
  it("aggregates MRR components and growth rate then inserts a snapshot", async () => {
    enqueue(
      // this-month events
      [
        { eventType: "subscription_started", mrrChange: "99", monthlyAmount: "99", organizationId: "o1" },
        { eventType: "subscription_upgraded", mrrChange: "50", monthlyAmount: "149", organizationId: "o1" },
        { eventType: "subscription_downgraded", mrrChange: "-20", monthlyAmount: "129", organizationId: "o2" },
        { eventType: "subscription_cancelled", mrrChange: "-99", monthlyAmount: "99", organizationId: "o3" },
        { eventType: "subscription_reactivated", mrrChange: "30", monthlyAmount: "30", organizationId: "o4" },
      ],
      // prior events for current-state computation (first per org wins)
      [
        { organizationId: "o1", eventType: "subscription_started", monthlyAmount: "99", eventDate: "2024-12-01" },
        { organizationId: "o2", eventType: "subscription_downgraded", monthlyAmount: "129", eventDate: "2024-12-02" },
        { organizationId: "o3", eventType: "subscription_cancelled", monthlyAmount: "99", eventDate: "2024-12-03" },
      ],
      // last snapshot
      [{ totalMrr: "200" }],
      // insert snapshot
      [],
    );

    await calculateMonthlyMrrSnapshot();

    const snap = h.captured[0];
    expect(snap.newMrr).toBe("99");
    expect(snap.expansionMrr).toBe("50");
    expect(snap.contractionMrr).toBe("-20");
    expect(snap.churnMrr).toBe("99");
    expect(snap.reactivationMrr).toBe("30");
    expect(snap.newSubscriptions).toBe(1);
    expect(snap.cancelledSubscriptions).toBe(1);
    // current state: o1 started (+99 active), o2 downgraded (+129, not active), o3 cancelled (skip)
    expect(snap.totalMrr).toBe("228");
    expect(snap.activeSubscriptions).toBe(1);
  });

  it("handles an empty month with no prior snapshot", async () => {
    enqueue([], [], [], []);
    await calculateMonthlyMrrSnapshot();
    const snap = h.captured[0];
    expect(snap.totalMrr).toBe("0");
    expect(snap.mrrGrowthRate).toBe("0");
    expect(snap.activeSubscriptions).toBe(0);
  });
});
