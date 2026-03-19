import { describe, it, expect } from "vitest";
import {
  generateTraceId,
  generateSpanId,
  getTraceContext,
  withTraceContextAsync,
  parseTraceparent,
  buildTraceparent,
} from "./context.js";
import type { TraceContext } from "./context.js";

describe("TraceContext", () => {
  it("generates valid IDs", () => {
    const traceId = generateTraceId();
    const spanId = generateSpanId();
    expect(traceId).toHaveLength(32);
    expect(spanId).toHaveLength(16);
  });

  it("propagates context via AsyncLocalStorage", async () => {
    const ctx: TraceContext = {
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      tenantId: "t2",
      actorId: "a2",
      requestId: "req-1",
    };
    let captured: TraceContext | undefined;

    await withTraceContextAsync(ctx, async () => {
      captured = getTraceContext();
    });

    expect(captured).toBeDefined();
    expect(captured!.traceId).toBe(ctx.traceId);
    expect(captured!.tenantId).toBe("t2");
  });

  it("returns undefined outside of context", () => {
    expect(getTraceContext()).toBeUndefined();
  });
});

describe("W3C traceparent", () => {
  it("parses a valid traceparent header", () => {
    const traceId = "0af7651916cd43dd8448eb211c80319c";
    const spanId = "b7ad6b7169203331";
    const header = `00-${traceId}-${spanId}-01`;

    const result = parseTraceparent(header);
    expect(result).not.toBeNull();
    expect(result!.traceId).toBe(traceId);
    expect(result!.spanId).toBe(spanId);
  });

  it("returns null for invalid traceparent", () => {
    expect(parseTraceparent("invalid")).toBeNull();
    expect(parseTraceparent("")).toBeNull();
  });

  it("roundtrips build → parse", () => {
    const traceId = generateTraceId();
    const spanId = generateSpanId();
    const header = buildTraceparent(traceId, spanId);
    const parsed = parseTraceparent(header);
    expect(parsed!.traceId).toBe(traceId);
    expect(parsed!.spanId).toBe(spanId);
  });
});
