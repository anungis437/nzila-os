/**
 * scripts/rls-enforcement/__tests__/deployment-dag-contract.test.ts
 *
 * Round 58C section 58-59 — static contract test for the Round 58
 * enforcement-migration deployment wiring in
 * .github/workflows/deploy-union-eyes.yml.
 *
 * This is a STATIC YAML-shape check only. It never runs the workflow, never
 * calls the GitHub API, and never touches any real environment — it only
 * parses the committed YAML and asserts the job exists with the expected
 * safety properties:
 *   - the job is gated on workflow_dispatch + an explicit boolean input
 *     (apply_authority_enforcement_migration), so it can NEVER fire as
 *     part of the ordinary push-triggered deploy path;
 *   - the job is NOT listed in any other job's `needs` (i.e. nothing is
 *     unconditionally blocked on it yet — Round 58C deliberately did not
 *     promote it to a mandatory pre-deploy gate, unlike apply-icra-
 *     capability-migration, because of the unresolved 111-table finding);
 *   - the corresponding workflow_dispatch input exists and defaults to
 *     false.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as yaml from "js-yaml";

const WORKFLOW_PATH = path.resolve(__dirname, "../../../../../.github/workflows/deploy-union-eyes.yml");

describe("Round 58 deployment DAG contract (static, no dispatch)", () => {
  const raw = fs.readFileSync(WORKFLOW_PATH, "utf8");
  const doc = yaml.load(raw) as any;

  it("workflow file parses as valid YAML with a jobs map", () => {
    expect(doc).toBeTruthy();
    expect(doc.jobs).toBeTruthy();
  });

  it("defines apply-authority-enforcement-migration as a workflow_dispatch-gated job", () => {
    const job = doc.jobs["apply-authority-enforcement-migration"];
    expect(job).toBeTruthy();
    expect(job.if).toContain("github.event_name == 'workflow_dispatch'");
    expect(job.if).toContain("apply_authority_enforcement_migration == 'true'");
  });

  it("declares the apply_authority_enforcement_migration workflow_dispatch input, defaulting to false", () => {
    const input = doc.on?.workflow_dispatch?.inputs?.apply_authority_enforcement_migration;
    expect(input).toBeTruthy();
    expect(input.type).toBe("boolean");
    expect(input.default).toBe(false);
  });

  it("is NOT (yet) a mandatory dependency of any other job — deliberately not promoted to a hard gate", () => {
    for (const [jobName, job] of Object.entries<any>(doc.jobs)) {
      if (jobName === "apply-authority-enforcement-migration") continue;
      const needs = job.needs ? (Array.isArray(job.needs) ? job.needs : [job.needs]) : [];
      expect(needs).not.toContain("apply-authority-enforcement-migration");
    }
  });

  it("references the exact committed migration file path", () => {
    const job = doc.jobs["apply-authority-enforcement-migration"];
    const stepsText = JSON.stringify(job.steps);
    expect(stepsText).toContain("db/migrations/20260910_rls_enforcement_expansion_round58.sql");
  });
});
