import { describe, it, expect, vi } from "vitest";
import { TracedLogger } from "./logger.js";
import { generateTraceId, generateSpanId, withTraceContextAsync } from "./context.js";
import type { TraceContext } from "./context.js";

describe("TracedLogger", () => {
  it("emits structured JSON with level", () => {
    const sink = vi.fn();
    const logger = new TracedLogger({ service: "test", sink });

    logger.info("hello", { key: "val" });

    expect(sink).toHaveBeenCalledTimes(1);
    const entry = sink.mock.calls[0]![0];
    expect(entry.level).toBe("info");
    expect(entry.event).toBe("hello");
    expect(entry.metadata.key).toBe("val");
    expect(entry.timestamp).toBeDefined();
  });

  it("injects trace context when available", async () => {
    const sink = vi.fn();
    const logger = new TracedLogger({ service: "test", sink });
    const ctx: TraceContext = {
      traceId: generateTraceId(),
      spanId: generateSpanId(),
      tenantId: "t1",
      actorId: "a1",
      requestId: "r1",
    };

    await withTraceContextAsync(ctx, async () => {
      logger.info("traced");
    });

    const entry = sink.mock.calls[0]![0];
    expect(entry.trace_id).toBe(ctx.traceId);
    expect(entry.span_id).toBe(ctx.spanId);
    expect(entry.tenant_id).toBe("t1");
  });

  it("creates child loggers with inherited fields", () => {
    const sink = vi.fn();
    const logger = new TracedLogger({ service: "test", sink });
    const child = logger.child({ component: "api" });

    child.warn("caution");

    const entry = sink.mock.calls[0]![0];
    expect(entry.metadata.component).toBe("api");
    expect(entry.level).toBe("warn");
  });
});
