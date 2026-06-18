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
    for (const m of [
      "select",
      "from",
      "where",
      "limit",
      "groupBy",
      "orderBy",
      "set",
      "values",
      "returning",
      "onConflictDoUpdate",
    ]) {
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
  const sendResendEmail = vi.fn(async () => ({ success: true }));
  return { queue, db, schema, sendResendEmail };
});

vi.mock("../../db", () => ({ db: h.db }));
vi.mock("../../db/schema", () => h.schema);
vi.mock("@/lib/email-service", () => ({
  getFromEmail: vi.fn(() => "noreply@unioneyes.test"),
  sendResendEmail: h.sendResendEmail,
}));
vi.mock("twilio", () => ({
  default: vi.fn(() => ({ messages: { create: vi.fn(async () => ({})) } })),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("firebase-admin", () => ({
  apps: [],
  credential: { applicationDefault: vi.fn(() => ({})) },
  initializeApp: vi.fn(),
  messaging: vi.fn(() => ({ send: vi.fn(async () => "msg-id") })),
}));

import {
  queueNotification,
  processPendingNotifications,
  sendNotification,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  getNotificationHistory,
  retryFailedNotifications,
} from "../../services/notification-service";

function enqueue(...results: any[]) {
  h.queue.push(...results);
}

beforeEach(() => {
  h.queue.length = 0;
  h.db.select.mockClear();
  h.db.insert.mockClear();
  h.db.update.mockClear();
  h.sendResendEmail.mockClear();
  h.sendResendEmail.mockResolvedValue({ success: true });
});

describe("getUserNotificationPreferences", () => {
  it("returns default preferences when none are stored", async () => {
    enqueue([]); // no prefs row
    const prefs = await getUserNotificationPreferences("org-1", "u1");
    expect(prefs.payment_confirmation_email).toBe(true);
    expect(prefs.payment_confirmation_sms).toBe(false);
  });

  it("parses stored preferences", async () => {
    enqueue([{ preferences: JSON.stringify({ custom_flag: true }) }]);
    const prefs = await getUserNotificationPreferences("org-1", "u1");
    expect(prefs.custom_flag).toBe(true);
  });
});

describe("updateUserNotificationPreferences", () => {
  it("upserts preferences", async () => {
    await updateUserNotificationPreferences("org-1", "u1", { payment_confirmation_email: false });
    expect(h.db.insert).toHaveBeenCalled();
  });
});

describe("queueNotification", () => {
  it("filters channels by preferences and returns the queued id", async () => {
    enqueue([], [{ id: "queued-1" }]); // default prefs, then insert returning
    const id = await queueNotification({
      organizationId: "org-1",
      userId: "u1",
      type: "payment_confirmation",
      channels: ["email", "sms"], // sms disabled by default -> filtered out
      data: { amount: "$50" },
    });
    expect(id).toBe("queued-1");
  });

  it("throws when all channels are disabled by preferences", async () => {
    enqueue([{ preferences: JSON.stringify({ payment_confirmation_email: false }) }]);
    await expect(
      queueNotification({
        organizationId: "org-1",
        userId: "u1",
        type: "payment_confirmation",
        channels: ["email"],
        data: {},
      }),
    ).rejects.toThrow("All notification channels disabled");
  });
});

describe("sendNotification", () => {
  it("throws when the notification is not found", async () => {
    enqueue([]); // not found
    await expect(sendNotification("missing")).rejects.toThrow("not found");
  });

  it("throws when already sent", async () => {
    enqueue([{ id: "n1", status: "sent" }]);
    await expect(sendNotification("n1")).rejects.toThrow("already sent");
  });

  it("throws on invalid data JSON", async () => {
    enqueue([
      { id: "n1", status: "pending", channels: ["email"], data: "not-json", attempts: 0, type: "payment_confirmation" },
    ]);
    await expect(sendNotification("n1")).rejects.toThrow("Invalid notification data format");
  });

  it("sends through email and sms channels via default templates", async () => {
    enqueue([
      {
        id: "n1",
        status: "pending",
        channels: ["email", "sms"],
        data: JSON.stringify({ email: "a@b.com", amount: "$50", transactionId: "tx1" }),
        attempts: 0,
        type: "payment_confirmation",
        userId: "u1",
        tenantId: "org-1",
      },
    ]);
    const result = await sendNotification("n1");
    expect(result.success).toBe(true);
    expect(result.channelResults).toHaveLength(2);
    expect(result.channelResults.every((r) => r.success)).toBe(true);
    expect(h.sendResendEmail).toHaveBeenCalled();
  });

  it("records a channel failure when email delivery fails", async () => {
    h.sendResendEmail.mockResolvedValueOnce({ success: false, error: "bounce" });
    enqueue([
      {
        id: "n2",
        status: "pending",
        channels: ["email"],
        data: JSON.stringify({ email: "a@b.com", amount: "$50" }),
        attempts: 0,
        type: "payment_confirmation",
        userId: "u1",
        tenantId: "org-1",
      },
    ]);
    const result = await sendNotification("n2");
    expect(result.success).toBe(false);
    expect(result.channelResults[0].success).toBe(false);
  });

  it("skips email send when no recipient email is provided", async () => {
    enqueue([
      {
        id: "n3",
        status: "pending",
        channels: ["email"],
        data: JSON.stringify({ amount: "$50" }), // no email
        attempts: 0,
        type: "payment_confirmation",
        userId: "u1",
        tenantId: "org-1",
      },
    ]);
    const result = await sendNotification("n3");
    expect(result.channelResults[0].success).toBe(true);
    expect(h.sendResendEmail).not.toHaveBeenCalled();
  });

  it("creates an in-app notification using a stored template", async () => {
    enqueue(
      [
        {
          id: "n4",
          status: "pending",
          channels: ["in_app"],
          data: JSON.stringify({ amount: "$50" }),
          attempts: 0,
          type: "low_balance_alert",
          userId: "u1",
          tenantId: "org-1",
        },
      ],
      [], // update attempts
      [
        {
          id: "t1",
          type: "low_balance_alert",
          channel: "in_app",
          subject: null,
          body: "Balance is ${balance}",
          variables: JSON.stringify(["balance"]),
        },
      ], // getTemplate returns a stored template
    );
    const result = await sendNotification("n4");
    expect(result.success).toBe(true);
    expect(result.channelResults[0].channel).toBe("in_app");
  });

  it("sends a push notification via default template", async () => {
    enqueue([
      {
        id: "n5",
        status: "pending",
        channels: ["push"],
        data: JSON.stringify({ title: "T", message: "M" }),
        attempts: 0,
        type: "strike_announcement",
        userId: "u1",
        tenantId: "org-1",
      },
    ]);
    const result = await sendNotification("n5");
    expect(result.success).toBe(true);
  });

  it("delivers a push notification through FCM when configured", async () => {
    const prev = process.env.FCM_PROJECT_ID;
    process.env.FCM_PROJECT_ID = "proj-1";
    try {
      enqueue([
        {
          id: "n5b",
          status: "pending",
          channels: ["push"],
          data: JSON.stringify({ title: "T", message: "M", count: 3 }),
          attempts: 0,
          type: "strike_announcement",
          userId: "u1",
          tenantId: "org-1",
        },
      ]);
      const result = await sendNotification("n5b");
      expect(result.success).toBe(true);
      expect(result.channelResults[0].channel).toBe("push");
    } finally {
      if (prev === undefined) delete process.env.FCM_PROJECT_ID;
      else process.env.FCM_PROJECT_ID = prev;
    }
  });

  it("fails the channel when no template exists for the type/channel", async () => {
    enqueue([
      {
        id: "n6",
        status: "pending",
        channels: ["in_app"], // no default in_app template for payment_confirmation
        data: JSON.stringify({ amount: "$50" }),
        attempts: 0,
        type: "payment_confirmation",
        userId: "u1",
        tenantId: "org-1",
      },
    ]);
    const result = await sendNotification("n6");
    expect(result.success).toBe(false);
  });
});

describe("processPendingNotifications", () => {
  it("processes each pending notification", async () => {
    enqueue(
      [{ id: "n1" }], // pending list
      [
        {
          id: "n1",
          status: "pending",
          channels: ["email"],
          data: JSON.stringify({ email: "a@b.com", amount: "$5" }),
          attempts: 0,
          type: "payment_confirmation",
          userId: "u1",
          tenantId: "org-1",
        },
      ], // sendNotification lookup
    );
    const processed = await processPendingNotifications();
    expect(processed).toBe(1);
  });

  it("continues when a notification fails to send", async () => {
    enqueue([{ id: "bad" }]); // pending; sendNotification lookup returns [] -> throws -> caught
    const processed = await processPendingNotifications();
    expect(processed).toBe(0);
  });
});

describe("retryFailedNotifications", () => {
  it("retries failed notifications under the attempt cap and skips those over it", async () => {
    enqueue(
      [
        { id: "n1", attempts: "0" },
        { id: "n2", attempts: "5" }, // skipped (>= maxAttempts)
      ],
      [
        {
          id: "n1",
          status: "failed",
          channels: ["email"],
          data: JSON.stringify({ email: "a@b.com", amount: "$5" }),
          attempts: 0,
          type: "payment_confirmation",
          userId: "u1",
          tenantId: "org-1",
        },
      ],
    );
    const retried = await retryFailedNotifications();
    expect(retried).toBe(1);
  });
});

describe("getNotificationHistory", () => {
  it("maps notification rows and parses data", async () => {
    enqueue([
      {
        id: "n1",
        type: "payment_confirmation",
        channels: ["email"],
        status: "sent",
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        data: JSON.stringify({ amount: "$50" }),
      },
    ]);
    const history = await getNotificationHistory("org-1", "u1");
    expect(history).toHaveLength(1);
    expect(history[0].data.amount).toBe("$50");
  });
});
