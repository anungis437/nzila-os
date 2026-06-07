import { describe, expect, it } from "vitest";
import { deriveCbaTabHealth } from "./cba-intelligence-client";

describe("deriveCbaTabHealth", () => {
  it("maps critical/warning levels to the correct tabs", () => {
    const result = deriveCbaTabHealth([
      { name: "ingestion_success_rate", level: "warning" },
      { name: "extraction_success_rate", level: "critical" },
      { name: "review_backlog", level: "critical" },
      { name: "source_freshness", level: "warning" },
    ]);

    expect(result).toEqual({
      ingestion: "critical",
      review: "critical",
      freshness: "warning",
    });
  });

  it("defaults missing checks to healthy", () => {
    const result = deriveCbaTabHealth([]);

    expect(result).toEqual({
      ingestion: "healthy",
      review: "healthy",
      freshness: "healthy",
    });
  });
});
