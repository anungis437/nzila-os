/**
 * Unit Tests — Dispatch Engine
 *
 * Tests the dispatch priority scoring, candidate ranking,
 * and rule-based worker assignment logic.
 */
import { describe, it, expect, vi } from "vitest";

// Mock db module to avoid DATABASE_URL requirement for pure-logic tests
vi.mock("@/db/db", () => ({
  db: {},
  client: {},
  getDatabase: vi.fn(),
}));

import {
  calculateDispatchPriority,
  type MemberCandidate,
} from "@/lib/services/dispatch-engine";

// ─── Test Data ───────────────────────────────────────────────────────────────

type RuleInput = Parameters<typeof calculateDispatchPriority>[2][number];

const baseCandidate: MemberCandidate = {
  memberId: "m-001",
  seniorityYears: 10,
  available: true,
  skills: ["welding", "plumbing"],
};

const seniorityRule: RuleInput = {
  ruleType: "seniority",
  ruleDefinition: {},
  priority: 2,
};

const skillsRule: RuleInput = {
  ruleType: "skills_match",
  ruleDefinition: {},
  priority: 3,
};

const availabilityRule: RuleInput = {
  ruleType: "availability",
  ruleDefinition: {},
  priority: 2,
};

const proximityRule: RuleInput = {
  ruleType: "geographic_proximity",
  ruleDefinition: {},
  priority: 1,
};

// ─── calculateDispatchPriority ───────────────────────────────────────────────

describe("calculateDispatchPriority", () => {
  it("returns a numeric score", () => {
    const score = calculateDispatchPriority(
      baseCandidate,
      ["welding"],
      [seniorityRule],
    );
    expect(typeof score).toBe("number");
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("higher seniority yields higher score", () => {
    const senior: MemberCandidate = { ...baseCandidate, seniorityYears: 20 };
    const junior: MemberCandidate = { ...baseCandidate, seniorityYears: 2 };

    const seniorScore = calculateDispatchPriority(senior, ["welding"], [seniorityRule]);
    const juniorScore = calculateDispatchPriority(junior, ["welding"], [seniorityRule]);

    expect(seniorScore).toBeGreaterThan(juniorScore);
  });

  it("full skill match scores higher than partial", () => {
    const perfect: MemberCandidate = { ...baseCandidate, skills: ["welding", "plumbing"] };
    const partial: MemberCandidate = { ...baseCandidate, skills: ["welding"] };
    const none: MemberCandidate = { ...baseCandidate, skills: ["painting"] };

    const required = ["welding", "plumbing"];
    const perfectScore = calculateDispatchPriority(perfect, required, [skillsRule]);
    const partialScore = calculateDispatchPriority(partial, required, [skillsRule]);
    const noneScore = calculateDispatchPriority(none, required, [skillsRule]);

    expect(perfectScore).toBeGreaterThan(partialScore);
    expect(partialScore).toBeGreaterThan(noneScore);
  });

  it("unavailable candidate gets zero for availability rule", () => {
    const unavailable: MemberCandidate = { ...baseCandidate, available: false };
    const score = calculateDispatchPriority(unavailable, ["welding"], [availabilityRule]);
    expect(score).toBe(0);
  });

  it("combined rules produce higher max score", () => {
    const all = [seniorityRule, skillsRule, availabilityRule, proximityRule];
    const single = [seniorityRule];

    const allScore = calculateDispatchPriority(baseCandidate, ["welding"], all);
    const singleScore = calculateDispatchPriority(baseCandidate, ["welding"], single);

    expect(allScore).toBeGreaterThanOrEqual(singleScore);
  });

  it("returns 0 for empty rules", () => {
    const score = calculateDispatchPriority(baseCandidate, ["welding"], []);
    expect(score).toBe(0);
  });
});
