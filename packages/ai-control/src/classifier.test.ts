import { describe, it, expect } from "vitest";
import { OutputClassifier } from "./classifier.js";

describe("OutputClassifier", () => {
  it("classifies clean text as safe", () => {
    const classifier = new OutputClassifier();
    const result = classifier.classify("This is a normal response about the weather.");
    expect(result.classification).toBe("safe");
  });

  it("detects SSN patterns as restricted", () => {
    const classifier = new OutputClassifier();
    const result = classifier.classify("The SSN is 123-45-6789");
    expect(result.classification).toBe("restricted");
    expect(result.matchedRules.length).toBeGreaterThan(0);
  });

  it("detects email as warning", () => {
    const classifier = new OutputClassifier();
    const result = classifier.classify("Contact user@example.com for details");
    expect(result.classification).toBe("warning");
  });

  it("detects credit card patterns as restricted", () => {
    const classifier = new OutputClassifier();
    const result = classifier.classify("Card: 4111-1111-1111-1111");
    expect(result.classification).toBe("restricted");
  });
});
