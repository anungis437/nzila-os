/**
 * Unit Tests — Dispatch rule application
 *
 * DEF-0B6-CMP-DISPATCH-RULES-ENGINE-NEVER-APPLIED: the previous scorer invented points (flat rotation and proximity bonuses, a full
 * skills match when none was required, seniority times an arbitrary weight). A rule now orders candidates only when every candidate
 * has the recorded value it needs, and otherwise is reported as not applied, leaving the candidates unranked.
 */
import { describe, it, expect, vi } from "vitest";

// Mock db module to avoid DATABASE_URL requirement for pure-logic tests
vi.mock("@/db/db", () => ({
  db: {},
  client: {},
  getDatabase: vi.fn(),
}));

import {
  evaluateDispatchRules,
  rankByDispatchRules,
  type MemberCandidate,
} from "@/lib/services/dispatch-engine";

type RuleInput = Parameters<typeof rankByDispatchRules>[2][number];

const rule = (ruleType: RuleInput["ruleType"], priority = 1): RuleInput => ({ ruleType, ruleDefinition: {}, priority });
const member = (memberId: string, overrides: Partial<MemberCandidate> = {}): MemberCandidate => ({
  memberId,
  seniority: null,
  skills: null,
  available: null,
  ...overrides,
});

describe("evaluateDispatchRules", () => {
  it("never applies rotation or proximity: nothing records a rotation order or a location", () => {
    const outcomes = evaluateDispatchRules([member("m1", { seniority: 3 })], [], [rule("rotation"), rule("geographic_proximity")]);
    expect(outcomes.map((o) => o.applied)).toEqual([false, false]);
    expect(outcomes[0].reason).toMatch(/no rotation order/);
    expect(outcomes[1].reason).toMatch(/no member location/);
  });

  it("does not apply skills or availability when no member record holds them", () => {
    const outcomes = evaluateDispatchRules([member("m1")], ["welding"], [rule("skills_match"), rule("availability")]);
    expect(outcomes).toEqual([
      { ruleType: "skills_match", priority: 1, applied: false, reason: "Not applied: no record of member skills exists." },
      { ruleType: "availability", priority: 1, applied: false, reason: "Not applied: no record of member availability exists." },
    ]);
  });

  it("does not treat a request with no required skills as a full match", () => {
    const [outcome] = evaluateDispatchRules([member("m1", { skills: ["welding"] })], [], [rule("skills_match")]);
    expect(outcome.applied).toBe(false);
    expect(outcome.reason).toMatch(/names no required skills/);
  });

  it("does not apply seniority when any candidate has none recorded", () => {
    const [outcome] = evaluateDispatchRules([member("m1", { seniority: 4 }), member("m2")], [], [rule("seniority")]);
    expect(outcome.applied).toBe(false);
    expect(outcome.reason).toBe("Not applied: 1 of 2 candidates have no recorded seniority.");
  });
});

describe("rankByDispatchRules", () => {
  it("leaves candidates unranked, in their given order, when no rule has data", () => {
    const ranking = rankByDispatchRules([member("a"), member("b")], ["welding"], [rule("skills_match"), rule("rotation")]);
    expect(ranking.status).toBe("unranked");
    expect(ranking.reason).toMatch(/no configured dispatch rule has the member data/);
    expect(ranking.candidates.map((c) => [c.memberId, c.rank])).toEqual([["a", null], ["b", null]]);
  });

  it("is unranked when the organization has no rules", () => {
    const ranking = rankByDispatchRules([member("a", { seniority: 1 })], [], []);
    expect(ranking.status).toBe("unranked");
    expect(ranking.reason).toMatch(/no dispatch rules configured/);
  });

  it("orders by recorded seniority when every candidate has one, and reports the other rules as not applied", () => {
    const ranking = rankByDispatchRules(
      [member("junior", { seniority: 2 }), member("senior", { seniority: 20 })],
      ["welding"],
      [rule("seniority", 2), rule("skills_match", 3)],
    );
    expect(ranking.status).toBe("ranked");
    expect(ranking.candidates.map((c) => [c.memberId, c.rank])).toEqual([["senior", 1], ["junior", 2]]);
    expect(ranking.rules.find((r) => r.ruleType === "skills_match")?.applied).toBe(false);
  });

  it("applies rules in precedence order and falls through on a tie, without adding points", () => {
    const ranking = rankByDispatchRules(
      [
        member("partial", { seniority: 10, skills: ["welding"] }),
        member("full-junior", { seniority: 1, skills: ["welding", "plumbing"] }),
        member("full-senior", { seniority: 9, skills: ["Welding", "plumbing"] }),
      ],
      ["welding", "plumbing"],
      [rule("seniority", 1), rule("skills_match", 5)],
    );
    expect(ranking.candidates.map((c) => c.memberId)).toEqual(["full-senior", "full-junior", "partial"]);
    expect(ranking.candidates[0]).not.toHaveProperty("score");
  });
});
