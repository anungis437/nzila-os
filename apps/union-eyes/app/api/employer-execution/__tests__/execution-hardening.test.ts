import { describe, expect, it } from "vitest";
import {
  buildReplayDiff,
  calculatePayroll,
  createEvidencePack,
  enforcePayrollLifecycleTransition,
  resolvePayrollRules,
  verifyEvidenceChainFromArtifacts,
  type EvidenceManifestArtifactRecord,
} from "../_lib";

/** Builds a realistic `evidence_manifest` artifact row exactly as payroll-run-transitions.ts persists one: the
 *  stored artifactHash column is the pack's own manifestHash, and manifestJson is the manifest with its chain link
 *  embedded - so every test fixture here is a GENUINELY valid, cryptographically-sealed artifact, not a hand-typed
 *  stand-in. */
function buildArtifact(
  entityType: "payroll_run" | "remittance_run" | "replay" | "approval" | "adjustment_run",
  runRefId: string,
  organizationId: string,
  parentLink?: { linkId: string; sealHash: string; chainDepth: number } | null,
): { artifact: EvidenceManifestArtifactRecord; chainLink: ReturnType<typeof createEvidencePack>["chainLink"] } {
  const pack = createEvidencePack({
    entityType,
    runRefId,
    organizationId,
    artifacts: [],
    metadata: { parentLink: parentLink ?? null },
  });
  return {
    artifact: {
      organizationId,
      artifactHash: pack.manifestHash,
      manifestJson: { ...pack.manifest, chainLink: pack.chainLink },
    },
    chainLink: pack.chainLink,
  };
}

const sampleEntries = [
  {
    rowNumber: 1,
    employeeExternalId: "EMP-001",
    shiftDate: "2026-04-01",
    regularHours: 8,
    overtimeHours: 2,
    doubletimeHours: 1,
    travelHours: 1,
    premiumCode: "NIGHT",
    validationErrors: [],
  },
  {
    rowNumber: 2,
    employeeExternalId: "EMP-002",
    shiftDate: "2026-04-01",
    regularHours: 8,
    overtimeHours: 0,
    doubletimeHours: 0,
    travelHours: 0,
    validationErrors: [],
  },
];

describe("Employer Execution hardening helpers", () => {
  it("is deterministic for the same input and rule set", () => {
    const resolvedRules = resolvePayrollRules({
      ruleVersionId: "v1",
      ruleVersionCode: "2026-04A",
      sourceHash: "hash-v1",
      rulesJson: {
        base_rate: 52,
        overtime: 1.5,
        double_time: 2,
        shift_premium: 0.1,
        travel: 0.5,
        dues: 0.02,
        benefits: 0.03,
        pension: 0.04,
      },
      ruleItems: [],
      workDate: "2026-04-01",
    });

    const first = calculatePayroll(sampleEntries, resolvedRules, {
      engineVersion: "engine-v1",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-15",
    });

    const second = calculatePayroll(sampleEntries, resolvedRules, {
      engineVersion: "engine-v1",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-15",
    });

    expect(first.totals).toEqual(second.totals);
    expect(first.calcTraceHash).toBe(second.calcTraceHash);
    expect(first.snapshotHash).toBe(second.snapshotHash);
    expect(first.items).toEqual(second.items);
  });

  it("changes output when executable rule strategy inputs change", () => {
    const baseRules = resolvePayrollRules({
      ruleVersionId: "v1",
      ruleVersionCode: "2026-04A",
      sourceHash: "hash-v1",
      rulesJson: {
        base_rate: 52,
        overtime: 1.5,
        double_time: 2,
        shift_premium: 0.1,
        travel: 0.25,
        dues: 0.02,
        benefits: 0.03,
        pension: 0.04,
        statutory_holiday: 1,
        regional_override: 1,
        classification_override: 1,
      },
      ruleItems: [
        {
          itemType: "travel",
          ruleCode: "travel.hourly",
          precedence: 10,
          actionJson: { strategy: "hourly", amount: 0.25 },
        },
      ],
    });

    const overriddenRules = resolvePayrollRules({
      ruleVersionId: "v2",
      ruleVersionCode: "2026-04B",
      sourceHash: "hash-v2",
      rulesJson: {
        base_rate: 52,
        overtime: 1.5,
        double_time: 2,
        shift_premium: 0.1,
        travel: 0.25,
        dues: 0.02,
        benefits: 0.03,
        pension: 0.04,
        statutory_holiday: 1,
        regional_override: 1,
        classification_override: 1,
      },
      ruleItems: [
        {
          itemType: "travel",
          ruleCode: "travel.flat",
          precedence: 10,
          actionJson: { strategy: "flat", amount: 75 },
        },
      ],
    });

    const original = calculatePayroll(sampleEntries, baseRules, {
      engineVersion: "engine-v1",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-15",
    });
    const replay = calculatePayroll(sampleEntries, overriddenRules, {
      engineVersion: "engine-v1",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-15",
    });

    expect(replay.totals.gross).not.toBe(original.totals.gross);
    expect(replay.items[0]?.trace).toMatchObject({
      calc_trace: {
        applied_rules: expect.arrayContaining([
          expect.objectContaining({ kind: "travel", strategy: "flat" }),
        ]),
      },
    });
  });

  it("fails closed when required executable rules are missing", () => {
    const resolvedRules = resolvePayrollRules({
      ruleVersionId: "v1",
      ruleVersionCode: "2026-04A",
      sourceHash: "hash-v1",
      rulesJson: {
        base_rate: 52,
      },
      ruleItems: [],
    });

    const invalidRules = {
      ...resolvedRules,
      executableRules: resolvedRules.executableRules.filter((rule) => rule.kind !== "base_rate"),
    };

    expect(() =>
      calculatePayroll(sampleEntries, invalidRules, {
        engineVersion: "engine-v1",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-15",
      }),
    ).toThrow("Missing required executable rule: base_rate");
  });

  it("enforces lifecycle FSM transitions", () => {
    expect(() =>
      enforcePayrollLifecycleTransition({
        status: "draft",
        action: "approve",
        immutableSnapshotLocked: false,
        criticalOpenCount: 0,
        errorOpenCount: 0,
        acknowledgedErrorCount: 0,
      }),
    ).toThrow("Official run can only be approved from calculated status");

    expect(() =>
      enforcePayrollLifecycleTransition({
        status: "calculated",
        action: "seal",
        immutableSnapshotLocked: false,
        criticalOpenCount: 0,
        errorOpenCount: 0,
        acknowledgedErrorCount: 0,
      }),
    ).toThrow("Only approved payroll runs can be sealed");
  });

  it("builds replay diffs with cause attribution and rule paths", () => {
    const noDiff = buildReplayDiff({ totalDues: 100 }, { totalDues: 100 }, "input change: exact replay mismatch", {
      scope: "run",
      subjectId: "run-1",
    });
    expect(noDiff.changed).toBe(false);
    expect(noDiff.differences).toHaveLength(0);
    expect(noDiff.graphDifferences).toHaveLength(0);

    const withDiff = buildReplayDiff(
      { dues_amount: 120.5 },
      { dues_amount: 125.75 },
      "rule change: dues rate override",
      {
        scope: "employee_item",
        subjectId: "EMP-001",
        originalRulePath: ["rules", "dues", "v1"],
        replayRulePath: ["rules", "dues", "v2"],
      },
    );

    expect(withDiff.changed).toBe(true);
    expect(withDiff.differences[0]).toEqual({
      scope: "employee_item",
      subjectId: "EMP-001",
      field: "dues_amount",
      originalValue: 120.5,
      replayValue: 125.75,
      causeType: "rule_change",
      causeDetail: "rule change: dues rate override",
      originalRulePath: ["rules", "dues", "v1"],
      replayRulePath: ["rules", "dues", "v2"],
    });
    expect(withDiff.graphDifferences).toEqual([]);
  });

  it("captures graph-level replay divergence when condition flips", () => {
    const original = {
      trace: {
        calc_trace: {
          evaluation_graph: {
            nodes: [
              {
                nodeId: "n1",
                payrollRunId: "run-1",
                employeeExternalId: "EMP-001",
                ruleKind: "travel",
                ruleCode: "travel.regional",
                sourceRuleId: "rule-a",
                strategy: "hourly",
                precedence: 10,
                conditionResult: "true",
                decision: "applied",
                decisionReason: "Applied",
                compositionMode: "replace",
                path: ["ruleItems", "10", "travel.regional"],
                evaluationOrder: 1,
                inputSnapshotHash: "hash-1",
                createdAt: "2026-04-01T00:00:00.000Z",
              },
            ],
            appliedPath: ["n1"],
          },
        },
      },
    };

    const replayed = {
      trace: {
        calc_trace: {
          evaluation_graph: {
            nodes: [
              {
                nodeId: "n1",
                payrollRunId: "run-1",
                employeeExternalId: "EMP-001",
                ruleKind: "travel",
                ruleCode: "travel.regional",
                sourceRuleId: "rule-a",
                strategy: "hourly",
                precedence: 10,
                conditionResult: "false",
                decision: "skipped",
                decisionReason: "Condition evaluated to false",
                compositionMode: "replace",
                path: ["ruleItems", "10", "travel.regional"],
                evaluationOrder: 1,
                inputSnapshotHash: "hash-2",
                createdAt: "2026-04-01T00:00:00.000Z",
              },
            ],
            appliedPath: [],
          },
        },
      },
    };

    const diff = buildReplayDiff(original, replayed, "rule change: travel condition flip", {
      scope: "employee_item",
      subjectId: "EMP-001",
    });

    expect(diff.graphDifferences.some((entry) => entry.changeType === "condition_changed")).toBe(true);
    expect(diff.graphDifferences.some((entry) => entry.changeType === "applied_path_changed")).toBe(true);
  });

  it("supports replace/augment/stack/suppress composition deterministically", () => {
    const composedRules = resolvePayrollRules({
      ruleVersionId: "v-compose",
      rulesJson: {
        base_rate: 50,
        overtime: 1.5,
        double_time: 2,
        shift_premium: 0.1,
        travel: 0.2,
        dues: 0,
        benefits: 0,
        pension: 0,
        statutory_holiday: 1,
        regional_override: 1,
        classification_override: 1,
      },
      ruleItems: [
        {
          itemType: "base_rate",
          ruleCode: "base.replace",
          precedence: 10,
          actionJson: { amount: 55, compositionMode: "replace" },
        },
        {
          itemType: "premium",
          ruleCode: "premium.stack",
          precedence: 20,
          actionJson: { amount: 2, compositionMode: "stack", strategy: "flat_per_hour" },
        },
        {
          itemType: "travel",
          ruleCode: "travel.suppress",
          precedence: 30,
          actionJson: { amount: 10, compositionMode: "suppress", strategy: "hourly" },
        },
        {
          itemType: "dues",
          ruleCode: "dues.augment",
          precedence: 40,
          actionJson: { amount: 0.02, compositionMode: "augment", strategy: "percent_gross" },
        },
      ],
    });

    const result = calculatePayroll(sampleEntries, composedRules, {
      engineVersion: "engine-v1",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-15",
    });

    expect(result.totals.gross).toBeGreaterThan(0);
    const firstTrace = result.items[0]?.trace as {
      calc_trace?: {
        applied_rules?: Array<{ compositionMode?: string }>;
        evaluation_graph?: { nodes?: Array<{ decision?: string; compositionMode?: string }> };
      };
    };
    expect(firstTrace.calc_trace?.applied_rules?.some((rule) => rule.compositionMode === "stack")).toBe(true);
    expect(firstTrace.calc_trace?.applied_rules?.some((rule) => rule.compositionMode === "augment")).toBe(true);
    expect(firstTrace.calc_trace?.evaluation_graph?.nodes?.some((node) => node.decision === "superseded")).toBe(true);
  });

  it("validates evidence chain continuity and detects tampering", () => {
    const { artifact: payrollArtifact, chainLink: payrollLink } = buildArtifact("payroll_run", "run-1", "org-1");
    const { artifact: remittanceArtifact, chainLink: remittanceLink } = buildArtifact("remittance_run", "remit-1", "org-1", {
      linkId: payrollLink.linkId,
      sealHash: payrollLink.sealHash,
      chainDepth: payrollLink.chainDepth,
    });

    const valid = verifyEvidenceChainFromArtifacts([payrollArtifact, remittanceArtifact], {
      organizationId: "org-1",
      entityType: "remittance_run",
      targetEntityId: "remit-1",
    });
    expect(valid.valid).toBe(true);
    expect(valid.checkedLinks).toBe(2);

    const tamperedParentSeal: EvidenceManifestArtifactRecord = {
      ...remittanceArtifact,
      manifestJson: {
        ...remittanceArtifact.manifestJson,
        chainLink: { ...remittanceLink, parentSealHash: "tampered-seal" },
      },
    };
    const broken = verifyEvidenceChainFromArtifacts([payrollArtifact, tamperedParentSeal], {
      organizationId: "org-1",
      entityType: "remittance_run",
      targetEntityId: "remit-1",
    });
    expect(broken.valid).toBe(false);
    expect(broken.issues.some((issue) => issue.includes("Parent seal mismatch"))).toBe(true);
  });

  it("detects tampered manifest content even when the chain link's own claimed fields are internally consistent", () => {
    const { artifact } = buildArtifact("payroll_run", "run-tamper", "org-1");
    const tampered: EvidenceManifestArtifactRecord = {
      ...artifact,
      manifestJson: { ...artifact.manifestJson, status: "forged-approved" },
    };
    const result = verifyEvidenceChainFromArtifacts([tampered], {
      organizationId: "org-1",
      entityType: "payroll_run",
      targetEntityId: "run-tamper",
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.includes("Content integrity failure"))).toBe(true);
  });

  it("detects a forged seal that was never produced by EVIDENCE_SEAL_KEY", () => {
    const { artifact, chainLink } = buildArtifact("payroll_run", "run-forged-seal", "org-1");
    const forged: EvidenceManifestArtifactRecord = {
      ...artifact,
      manifestJson: { ...artifact.manifestJson, chainLink: { ...chainLink, sealHash: "0".repeat(64) } },
    };
    const result = verifyEvidenceChainFromArtifacts([forged], {
      organizationId: "org-1",
      entityType: "payroll_run",
      targetEntityId: "run-forged-seal",
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.includes("Seal authenticity failure"))).toBe(true);
  });

  it("refuses a swapped artifact whose linkId does not match its own entity, target and content", () => {
    const { artifact: a } = buildArtifact("payroll_run", "run-a", "org-1");
    const { artifact: b } = buildArtifact("payroll_run", "run-b", "org-1");
    // Splice run-b's chain link onto run-a's artifact content: content integrity (manifestHash) is internally
    // consistent within the swapped pieces only if constructed carelessly - here the linkId was computed for run-b's
    // own manifest hash, not run-a's, so it fails identity even before content integrity would catch it.
    const swapped: EvidenceManifestArtifactRecord = {
      organizationId: "org-1",
      artifactHash: a.artifactHash,
      manifestJson: { ...a.manifestJson, chainLink: (b.manifestJson as { chainLink: unknown }).chainLink },
    };
    const result = verifyEvidenceChainFromArtifacts([swapped], {
      organizationId: "org-1",
      entityType: "payroll_run",
      targetEntityId: "run-a",
    });
    expect(result.valid).toBe(false);
  });

  it("refuses a link that belongs to a different organization than the caller's", () => {
    const { artifact } = buildArtifact("payroll_run", "run-cross-tenant", "org-victim");
    const result = verifyEvidenceChainFromArtifacts([artifact], {
      organizationId: "org-attacker",
      entityType: "payroll_run",
      targetEntityId: "run-cross-tenant",
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.includes("expected organization"))).toBe(true);
  });

  it("refuses when no evidence chain link exists for the expected entity", () => {
    const { artifact } = buildArtifact("payroll_run", "run-real", "org-1");
    const result = verifyEvidenceChainFromArtifacts([artifact], {
      organizationId: "org-1",
      entityType: "payroll_run",
      targetEntityId: "run-does-not-exist",
    });
    expect(result.valid).toBe(false);
    expect(result.checkedLinks).toBe(0);
  });

  it("refuses a replayed link reused under a different claimed target", () => {
    const { artifact, chainLink } = buildArtifact("payroll_run", "run-original", "org-1");
    // Same artifact content and seal, but the chain link now claims a different targetEntityId than the one its
    // linkId and seal were actually computed for.
    const replayed: EvidenceManifestArtifactRecord = {
      ...artifact,
      manifestJson: { ...artifact.manifestJson, chainLink: { ...chainLink, targetEntityId: "run-replayed-onto" } },
    };
    const result = verifyEvidenceChainFromArtifacts([replayed], {
      organizationId: "org-1",
      entityType: "payroll_run",
      targetEntityId: "run-replayed-onto",
    });
    expect(result.valid).toBe(false);
  });

  it("blocks approval when compliance gates are not satisfied", () => {
    expect(() =>
      enforcePayrollLifecycleTransition({
        status: "calculated",
        action: "approve",
        immutableSnapshotLocked: false,
        criticalOpenCount: 1,
        errorOpenCount: 0,
        acknowledgedErrorCount: 0,
      }),
    ).toThrow("Cannot approve official payroll run while critical compliance events are unresolved");

    expect(() =>
      enforcePayrollLifecycleTransition({
        status: "calculated",
        action: "approve",
        immutableSnapshotLocked: false,
        criticalOpenCount: 0,
        errorOpenCount: 2,
        acknowledgedErrorCount: 1,
      }),
    ).toThrow("All error-severity compliance events must be acknowledged before approval");

    expect(() =>
      enforcePayrollLifecycleTransition({
        status: "calculated",
        action: "approve",
        immutableSnapshotLocked: false,
        criticalOpenCount: 0,
        errorOpenCount: 2,
        acknowledgedErrorCount: 2,
      }),
    ).not.toThrow();
  });
});
