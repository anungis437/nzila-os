import { describe, it, expect } from "vitest";
import { createSpan, endSpan, addSpanEvent, withSpan } from "./spans.js";

describe("Spans", () => {
  it("creates a span with name and attributes", () => {
    const span = createSpan("test-span", undefined, { "http.method": "GET" });
    expect(span.name).toBe("test-span");
    expect(span.attributes["http.method"]).toBe("GET");
    expect(span.status).toBe("unset");
    expect(span.startTime).toBeGreaterThan(0);
  });

  it("adds events to a span", () => {
    const span = createSpan("event-span");
    addSpanEvent(span, "checkpoint", { step: 1 });
    expect(span.events).toHaveLength(1);
    expect(span.events[0]!.name).toBe("checkpoint");
  });

  it("ends a span with duration", () => {
    const span = createSpan("end-span");
    endSpan(span);
    expect(span.endTime).toBeDefined();
    expect(span.endTime! >= span.startTime).toBe(true);
    expect(span.status).toBe("ok");
  });

  it("ends with error status", () => {
    const span = createSpan("error-span");
    endSpan(span, "error");
    expect(span.status).toBe("error");
  });

  it("withSpan instruments an async function", async () => {
    const result = await withSpan("instrumented", async (_span) => {
      return 42;
    });
    expect(result).toBe(42);
  });

  it("withSpan records errors and rethrows", async () => {
    await expect(
      withSpan("failing", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
