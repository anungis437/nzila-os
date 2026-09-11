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
 *   - only later, explicitly selected corrective-rollout jobs may list it in
 *     `needs`; ordinary build/deploy jobs remain independent of it;
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

  it("is only a dependency of the explicit corrective rollout chain", () => {
    const allowedDependents = new Set(["apply-round58-grant-fix-migration"]);

    for (const [jobName, job] of Object.entries<any>(doc.jobs)) {
      if (jobName === "apply-authority-enforcement-migration") continue;
      const needs = job.needs ? (Array.isArray(job.needs) ? job.needs : [job.needs]) : [];
      if (needs.includes("apply-authority-enforcement-migration")) {
        expect(allowedDependents.has(jobName)).toBe(true);
      }
    }
  });

  it("resolves the full indirection chain to the exact committed migration file path", () => {
    // Round 59D fix: the workflow step never contained the migration
    // filename literally — it invokes the package script
    // 'rls:apply-enforcement-migration', which resolves to
    // apply-authority-enforcement-migration.ts, which itself pins the
    // exact SQL path via its own MIGRATION_PATH constant. Asserting the
    // literal filename in the YAML (as this test previously did) was
    // stale from the moment the workflow was written this way — it
    // never could have passed by construction, and the indirection is
    // the stronger, more maintainable contract (the workflow doesn't
    // need to change if the migration script is ever renamed/relocated).
    const job = doc.jobs["apply-authority-enforcement-migration"];
    const stepsText = JSON.stringify(job.steps);
    expect(stepsText).toContain("rls:apply-enforcement-migration");

    const packageJsonPath = path.resolve(__dirname, "../../../package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const script = packageJson.scripts?.["rls:apply-enforcement-migration"];
    expect(script).toBeTruthy();
    expect(script).toContain("apply-authority-enforcement-migration.ts");

    const scriptPath = path.resolve(__dirname, "../../apply-authority-enforcement-migration.ts");
    const scriptSource = fs.readFileSync(scriptPath, "utf8");
    expect(scriptSource).toContain("db/migrations/20260910_rls_enforcement_expansion_round58.sql");
  });
});

/**
 * Release Gate E.3 — static contract test for the congress_memberships
 * multi-party RLS forward-corrective rollout wiring in
 * .github/workflows/deploy-union-eyes.yml. Same STATIC YAML-shape-only
 * approach as the Round 58 contract above: never dispatches the workflow,
 * never touches a real environment — only proves the deployment DAG *can*
 * deterministically reproduce the Gate E.1/E.2 staging-proven correction,
 * and that it can never do so implicitly.
 */
describe("Release Gate E.3 deployment DAG contract (static, no dispatch)", () => {
  const raw = fs.readFileSync(WORKFLOW_PATH, "utf8");
  const doc = yaml.load(raw) as any;

  it("declares the apply_congress_memberships_multi_party_rls_fix workflow_dispatch input, defaulting to false", () => {
    const input = doc.on?.workflow_dispatch?.inputs?.apply_congress_memberships_multi_party_rls_fix;
    expect(input).toBeTruthy();
    expect(input.type).toBe("boolean");
    expect(input.default).toBe(false);
  });

  it("defines apply-congress-memberships-multi-party-rls-fix as a workflow_dispatch-gated job", () => {
    const job = doc.jobs["apply-congress-memberships-multi-party-rls-fix"];
    expect(job).toBeTruthy();
    expect(job.if).toContain("github.event_name == 'workflow_dispatch'");
    expect(job.if).toContain("apply_congress_memberships_multi_party_rls_fix == 'true'");
  });

  it("is not a dependency of, and does not depend on, any build/deploy/auto-promotion job — ordinary deploys cannot invoke it", () => {
    const alwaysOnJobs = ["plan", "pre-deploy-gates", "build-push", "apply-django-migrations", "deploy", "apply-icra-capability-migration"];
    const job = doc.jobs["apply-congress-memberships-multi-party-rls-fix"];
    const needs = job.needs ? (Array.isArray(job.needs) ? job.needs : [job.needs]) : [];
    // Only ever needs the topology-resolution job, never a build/deploy job.
    expect(needs).toEqual(["plan"]);

    for (const [jobName, otherJob] of Object.entries<any>(doc.jobs)) {
      if (jobName === "apply-congress-memberships-multi-party-rls-fix") continue;
      if (!alwaysOnJobs.includes(jobName)) continue;
      const otherNeeds = otherJob.needs ? (Array.isArray(otherJob.needs) ? otherJob.needs : [otherJob.needs]) : [];
      expect(otherNeeds).not.toContain("apply-congress-memberships-multi-party-rls-fix");
    }
  });

  it("resolves the full indirection chain to the exact committed corrective script", () => {
    const job = doc.jobs["apply-congress-memberships-multi-party-rls-fix"];
    const stepsText = JSON.stringify(job.steps);
    expect(stepsText).toContain("rls:apply-congress-memberships-multi-party-rls-fix");

    const packageJsonPath = path.resolve(__dirname, "../../../package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const script = packageJson.scripts?.["rls:apply-congress-memberships-multi-party-rls-fix"];
    expect(script).toBeTruthy();
    expect(script).toContain("apply-congress-memberships-multi-party-rls-fix.ts");

    const scriptPath = path.resolve(__dirname, "../../apply-congress-memberships-multi-party-rls-fix.ts");
    expect(fs.existsSync(scriptPath)).toBe(true);
    const scriptSource = fs.readFileSync(scriptPath, "utf8");
    expect(scriptSource).toContain("ue_create_multi_party_rls_policy");
    expect(scriptSource).toContain("congress_memberships");
  });

  it("only ever retrieves the migration-admin Key Vault secret — never a runtime/system credential", () => {
    const job = doc.jobs["apply-congress-memberships-multi-party-rls-fix"];
    const stepsText = JSON.stringify(job.steps);
    expect(stepsText).toContain("union-eyes-migration-admin-database-url");
    expect(stepsText).not.toContain("union-eyes-runtime-database-url");
    expect(stepsText).not.toContain("union-eyes-system-database-url");
    // The credential is exported only for the scoped script invocation and
    // explicitly unset immediately after — never persisted as a job output,
    // never written to GITHUB_ENV, never passed to the application build/
    // deploy steps.
    expect(stepsText).toContain("RLS_ENFORCEMENT_ADMIN_DATABASE_URL");
    expect(stepsText).toContain("unset RLS_ENFORCEMENT_ADMIN_DATABASE_URL");
  });

  it("preserves the #760 production-promotion invariant — production auto-promotion remains impossible regardless of this job", () => {
    const autoPromotePath = path.resolve(__dirname, "../../../../../.github/workflows/auto-promote-union-eyes.yml");
    const autoPromoteRaw = fs.readFileSync(autoPromotePath, "utf8");
    const autoPromoteDoc = yaml.load(autoPromoteRaw) as any;
    const matrixEnvironments: string[] = autoPromoteDoc.jobs["fanout"].strategy.matrix.environment;
    expect(matrixEnvironments).toEqual(["demo", "pilot", "staging"]);
    expect(matrixEnvironments).not.toContain("production");

    // The corrective job itself requires an explicit workflow_dispatch input
    // (apply_congress_memberships_multi_party_rls_fix == 'true') in addition
    // to environment=production — a push/auto-promote event can supply
    // neither, so it can never reach this job for any environment,
    // production included.
    const job = doc.jobs["apply-congress-memberships-multi-party-rls-fix"];
    expect(job.if).toContain("workflow_dispatch");
  });
});

