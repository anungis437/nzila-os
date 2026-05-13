/**
 * Seed: Employer Execution Marathon Pilot
 *
 * Usage:
 *   npx tsx apps/union-eyes/scripts/seed-employer-execution-marathon.ts
 */

import fs from "fs/promises";
import path from "path";
import { and, eq } from "drizzle-orm";
import { assertNotProduction } from "@/lib/runtime/production-guard";
import { db } from "@/db/db";

assertNotProduction("seed-employer-execution-marathon");
import {
  organizationMembers,
  memberEmployment,
  jobClassifications,
  orgEntitlements,
  employerExecutionProfiles,
  cbaRuleVersions,
  cbaRuleSetItems,
  employerTimesheetBatches,
  employerTimesheetEntries,
  employerPayrollRuns,
  employerPayrollRunItems,
  employerRemittanceRuns,
  employerRemittanceRunItems,
  employerExecutionComplianceEvents,
  employerExecutionArtifacts,
  employerExecutionReplays,
} from "@/db/schema";
import {
  employers as unionEmployers,
  worksites,
  bargainingUnits,
} from "@/db/schema/union-structure-schema";
import { collectiveAgreements } from "@/db/schema/collective-agreements-schema";
import { normalizeCsv, calculatePayroll, resolvePayrollRules, sha256 } from "@/app/api/employer-execution/_lib";

const ORG_ID = "458a56cb-251a-4c91-a0b5-81bb8ac39087";
const MEMBER_ID = "44444444-4444-4444-8444-444444444444";
const EMPLOYER_ID = "11111111-1111-4111-8111-111111111111";
const WORKSITE_ID = "11111111-1111-4111-8111-111111111112";
const UNIT_ID = "11111111-1111-4111-8111-111111111113";
const PROFILE_ID = "11111111-1111-4111-8111-111111111114";
const CBA_ID = "11111111-1111-4111-8111-111111111115";
const RULE_VERSION_ID = "11111111-1111-4111-8111-111111111116";
const CLASSIFICATION_ID = "11111111-1111-4111-8111-111111111117";
const EMPLOYMENT_ID = "11111111-1111-4111-8111-111111111118";
const TIMESHEET_BATCH_ID = "11111111-1111-4111-8111-111111111119";
const PAYROLL_RUN_ID = "11111111-1111-4111-8111-111111111120";
const PAYROLL_REPLAY_RUN_ID = "11111111-1111-4111-8111-111111111121";
const REMITTANCE_RUN_ID = "11111111-1111-4111-8111-111111111122";
const REPLAY_ID = "11111111-1111-4111-8111-111111111123";

const REQUIRED_ENTITLEMENTS = [
  "employer_execution",
  "employer_timesheet_ingest",
  "employer_payroll_preview",
  "employer_payroll_official",
  "employer_remittance_generation",
  "employer_execution_replay",
  "employer_execution_compliance",
] as const;

async function ensureMember() {
  const [existing] = await db
    .select()
    .from(organizationMembers)
    .where(and(eq(organizationMembers.id, MEMBER_ID), eq(organizationMembers.organizationId, ORG_ID)))
    .limit(1);

  if (!existing) {
    await db.insert(organizationMembers).values({
      id: MEMBER_ID,
      userId: "marathon-member-0001",
      organizationId: ORG_ID,
      role: "member",
      status: "active",
      name: "Marathon Operator",
      email: "marathon.operator@pilot.unioneyes.local",
      joinedAt: new Date(),
    });
  }
}

async function seed() {
  console.log("Seeding Employer Execution marathon pilot...");

  await ensureMember();

  const [employer] = await db.select().from(unionEmployers).where(eq(unionEmployers.id, EMPLOYER_ID)).limit(1);
  if (!employer) {
    await db.insert(unionEmployers).values({
      id: EMPLOYER_ID,
      organizationId: ORG_ID,
      name: "Marathon Underground Ltd.",
      employerType: "private",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const [worksite] = await db.select().from(worksites).where(eq(worksites.id, WORKSITE_ID)).limit(1);
  if (!worksite) {
    await db.insert(worksites).values({
      id: WORKSITE_ID,
      organizationId: ORG_ID,
      employerId: EMPLOYER_ID,
      name: "Marathon - North Tunnel",
      code: "MAR-NT-01",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const [unit] = await db.select().from(bargainingUnits).where(eq(bargainingUnits.id, UNIT_ID)).limit(1);
  if (!unit) {
    await db.insert(bargainingUnits).values({
      id: UNIT_ID,
      organizationId: ORG_ID,
      employerId: EMPLOYER_ID,
      worksiteId: WORKSITE_ID,
      name: "Marathon Underground Trades Unit",
      unitNumber: "MU-001",
      unitType: "mixed",
      status: "active",
      memberCount: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const [profile] = await db
    .select()
    .from(employerExecutionProfiles)
    .where(eq(employerExecutionProfiles.id, PROFILE_ID))
    .limit(1);
  if (!profile) {
    await db.insert(employerExecutionProfiles).values({
      id: PROFILE_ID,
      organizationId: ORG_ID,
      profileCode: "contractor_execution",
      status: "active",
      jurisdiction: "ontario",
      currency: "CAD",
      configJson: {
        timezone: "America/Toronto",
        remittanceDueOffsetDays: 15,
      },
    });
  }

  for (const featureKey of REQUIRED_ENTITLEMENTS) {
    const [entitlement] = await db
      .select()
      .from(orgEntitlements)
      .where(and(eq(orgEntitlements.organizationId, ORG_ID), eq(orgEntitlements.featureKey, featureKey)))
      .limit(1);

    if (!entitlement) {
      await db.insert(orgEntitlements).values({
        organizationId: ORG_ID,
        featureKey,
        status: "active",
        grantedBy: "seed-script",
      });
    }
  }

  const [agreement] = await db
    .select()
    .from(collectiveAgreements)
    .where(eq(collectiveAgreements.id, CBA_ID))
    .limit(1);
  if (!agreement) {
    await db.insert(collectiveAgreements).values({
      id: CBA_ID,
      organizationId: ORG_ID,
      cbaNumber: "MAR-UE-2026-01",
      title: "Marathon Underground Collective Agreement",
      jurisdiction: "ontario",
      language: "en",
      employerName: "Marathon Underground Ltd.",
      employerId: EMPLOYER_ID,
      unionName: "UnionEyes Pilot Local",
      unionLocal: "UE-100",
      effectiveDate: new Date("2026-01-01"),
      expiryDate: new Date("2028-12-31"),
      industrySector: "construction",
      status: "active",
      structuredData: { benefitSummary: { scope: "pilot" } },
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    });
  }

  const [classification] = await db
    .select()
    .from(jobClassifications)
    .where(eq(jobClassifications.id, CLASSIFICATION_ID))
    .limit(1);
  if (!classification) {
    await db.insert(jobClassifications).values({
      id: CLASSIFICATION_ID,
      organizationId: ORG_ID,
      bargainingUnitId: UNIT_ID,
      jobCode: "UG-JOURNEY",
      jobTitle: "Underground Journeyman",
      standardRate: "52.00",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const [employment] = await db
    .select()
    .from(memberEmployment)
    .where(eq(memberEmployment.id, EMPLOYMENT_ID))
    .limit(1);
  if (!employment) {
    await db.insert(memberEmployment).values({
      id: EMPLOYMENT_ID,
      organizationId: ORG_ID,
      memberId: MEMBER_ID,
      employerId: EMPLOYER_ID,
      worksiteId: WORKSITE_ID,
      bargainingUnitId: UNIT_ID,
      employmentStatus: "active",
      employmentType: "full_time",
      hireDate: "2024-01-01",
      seniorityDate: "2024-01-01",
      jobTitle: "Underground Journeyman",
      jobCode: "UG-JOURNEY",
      jobClassification: "Journeyman",
      payFrequency: "hourly",
      hourlyRate: "52.00",
      regularHoursPerWeek: "40.00",
      checkoffAuthorized: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const [ruleVersion] = await db.select().from(cbaRuleVersions).where(eq(cbaRuleVersions.id, RULE_VERSION_ID)).limit(1);
  if (!ruleVersion) {
    await db.insert(cbaRuleVersions).values({
      id: RULE_VERSION_ID,
      organizationId: ORG_ID,
      profileId: PROFILE_ID,
      collectiveAgreementId: CBA_ID,
      employerId: EMPLOYER_ID,
      worksiteId: WORKSITE_ID,
      bargainingUnitId: UNIT_ID,
      ruleVersionCode: "MAR-RULES-2026.1",
      status: "active",
      effectiveFrom: "2026-01-01",
      sourceHash: sha256("marathon-rules-v1"),
      sourceMetadata: { source: "pilot-seed" },
      rulesJson: { baseRate: 52, duesRate: 0.02, benefitRate: 0.03, pensionRate: 0.04 },
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "seed-script",
    });

    await db.insert(cbaRuleSetItems).values({
      organizationId: ORG_ID,
      cbaRuleVersionId: RULE_VERSION_ID,
      itemType: "base_rate",
      ruleCode: "base_rate_default",
      precedence: 1,
      conditionJson: { classificationCode: "UG-JOURNEY" },
      actionJson: { baseRate: 52 },
      ruleHash: sha256("base_rate_default"),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const csvPath = path.resolve("apps/union-eyes/scripts/fixtures/employer-execution/marathon-timesheet.csv");
  const csv = await fs.readFile(csvPath, "utf8");
  const normalized = normalizeCsv(csv);

  const [batch] = await db.select().from(employerTimesheetBatches).where(eq(employerTimesheetBatches.id, TIMESHEET_BATCH_ID)).limit(1);
  if (!batch) {
    await db.insert(employerTimesheetBatches).values({
      id: TIMESHEET_BATCH_ID,
      organizationId: ORG_ID,
      employerId: EMPLOYER_ID,
      worksiteId: WORKSITE_ID,
      bargainingUnitId: UNIT_ID,
      batchCode: "MAR-TS-2026-04A",
      sourceFileName: "marathon-timesheet.csv",
      sourceFileHash: sha256(csv),
      periodStart: "2026-04-01",
      periodEnd: "2026-04-15",
      status: normalized.summary.invalid > 0 ? "rejected" : "validated",
      validationSummary: normalized.summary,
      uploadedBy: "seed-script",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(employerTimesheetEntries).values(
      normalized.entries.map((entry) => ({
        organizationId: ORG_ID,
        batchId: TIMESHEET_BATCH_ID,
        memberEmploymentId: EMPLOYMENT_ID,
        employerId: EMPLOYER_ID,
        worksiteId: WORKSITE_ID,
        bargainingUnitId: UNIT_ID,
        jobClassificationId: CLASSIFICATION_ID,
        employeeExternalId: entry.employeeExternalId,
        shiftDate: entry.shiftDate,
        regularHours: entry.regularHours.toString(),
        overtimeHours: entry.overtimeHours.toString(),
        doubletimeHours: entry.doubletimeHours.toString(),
        travelHours: entry.travelHours.toString(),
        premiumCode: entry.premiumCode,
        rowNumber: entry.rowNumber,
        sourceRowHash: sha256(`${entry.rowNumber}|${entry.employeeExternalId}|${entry.shiftDate}`),
        validationErrors: entry.validationErrors,
        status: entry.validationErrors.length > 0 ? ("invalid" as const) : ("valid" as const),
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
  }

  const validEntries = normalized.entries.filter((entry) => entry.validationErrors.length === 0);
  const resolvedRules = resolvePayrollRules({
    ruleVersionId: RULE_VERSION_ID,
    ruleVersionCode: "MAR-2026-04A",
    sourceHash: sha256("MAR-2026-04A"),
    rulesJson: { base_rate: 52, dues: 0.02, benefits: 0.03, pension: 0.04, overtime: 1.5, double_time: 2 },
    ruleItems: [{ itemType: "base_rate", ruleCode: "base_rate_default", precedence: 1, actionJson: { rate: 52 } }],
    workDate: "2026-04-15",
  });
  const calc = calculatePayroll(validEntries, resolvedRules, {
    engineVersion: "employer-execution-v1",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-15",
  });

  const [payrollRun] = await db.select().from(employerPayrollRuns).where(eq(employerPayrollRuns.id, PAYROLL_RUN_ID)).limit(1);
  if (!payrollRun) {
    await db.insert(employerPayrollRuns).values({
      id: PAYROLL_RUN_ID,
      organizationId: ORG_ID,
      runCode: "MAR-PR-2026-04A",
      runType: "preview",
      status: "calculated",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-15",
      sourceBatchId: TIMESHEET_BATCH_ID,
      cbaRuleVersionId: RULE_VERSION_ID,
      engineVersion: "employer-execution-v1",
      inputSnapshot: { source: "seed" },
      calcTrace: calc.calcTrace,
      calcTraceHash: calc.calcTraceHash,
      totalGross: calc.totals.gross.toString(),
      totalNet: calc.totals.net.toString(),
      totalDues: calc.totals.dues.toString(),
      totalBenefits: calc.totals.benefits.toString(),
      totalPension: calc.totals.pension.toString(),
      immutableSnapshotLocked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(employerPayrollRunItems).values(
      calc.items.map((item) => ({
        organizationId: ORG_ID,
        payrollRunId: PAYROLL_RUN_ID,
        memberEmploymentId: EMPLOYMENT_ID,
        employeeExternalId: item.employeeExternalId,
        grossPay: item.grossPay.toString(),
        netPay: item.netPay.toString(),
        duesAmount: item.duesAmount.toString(),
        benefitAmount: item.benefitAmount.toString(),
        pensionAmount: item.pensionAmount.toString(),
        remittanceGroupKey: "default",
        traceJson: item.trace,
        traceHash: item.traceHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
  }

  const [officialRun] = await db.select().from(employerPayrollRuns).where(eq(employerPayrollRuns.id, PAYROLL_REPLAY_RUN_ID)).limit(1);
  if (!officialRun) {
    await db.insert(employerPayrollRuns).values({
      id: PAYROLL_REPLAY_RUN_ID,
      organizationId: ORG_ID,
      runCode: "MAR-PR-2026-04B",
      runType: "official",
      status: "approved",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-15",
      sourceBatchId: TIMESHEET_BATCH_ID,
      cbaRuleVersionId: RULE_VERSION_ID,
      engineVersion: "employer-execution-v1.1",
      inputSnapshot: { source: "seed-official" },
      calcTrace: calc.calcTrace,
      calcTraceHash: sha256(JSON.stringify({ ...calc.calcTrace, revision: 1 })),
      totalGross: (calc.totals.gross + 1).toString(),
      totalNet: calc.totals.net.toString(),
      totalDues: calc.totals.dues.toString(),
      totalBenefits: calc.totals.benefits.toString(),
      totalPension: calc.totals.pension.toString(),
      immutableSnapshotLocked: true,
      approvedBy: "seed-script",
      approvedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const [remittanceRun] = await db.select().from(employerRemittanceRuns).where(eq(employerRemittanceRuns.id, REMITTANCE_RUN_ID)).limit(1);
  if (!remittanceRun) {
    const totalDue = calc.totals.dues + calc.totals.benefits + calc.totals.pension;
    await db.insert(employerRemittanceRuns).values({
      id: REMITTANCE_RUN_ID,
      organizationId: ORG_ID,
      payrollRunId: PAYROLL_REPLAY_RUN_ID,
      runCode: "MAR-RR-2026-04A",
      status: "generated",
      periodStart: "2026-04-01",
      periodEnd: "2026-04-15",
      dueDate: "2026-04-30",
      totalDue: totalDue.toString(),
      packageSummary: { totalDue, itemCount: calc.items.length },
      outputFormats: ["csv", "json"],
      immutableSnapshotLocked: true,
      generatedBy: "seed-script",
      generatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.insert(employerRemittanceRunItems).values([
      {
        organizationId: ORG_ID,
        remittanceRunId: REMITTANCE_RUN_ID,
        groupKey: "dues",
        contributionType: "dues",
        amount: calc.totals.dues.toString(),
        memberCount: String(calc.items.length),
        traceJson: { sourceRun: PAYROLL_REPLAY_RUN_ID },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        organizationId: ORG_ID,
        remittanceRunId: REMITTANCE_RUN_ID,
        groupKey: "benefits",
        contributionType: "benefits",
        amount: calc.totals.benefits.toString(),
        memberCount: String(calc.items.length),
        traceJson: { sourceRun: PAYROLL_REPLAY_RUN_ID },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await db.insert(employerExecutionArtifacts).values([
      {
        organizationId: ORG_ID,
        remittanceRunId: REMITTANCE_RUN_ID,
        artifactType: "summary",
        artifactName: "marathon-remittance-summary.json",
        storageRef: "inline://seed/marathon-remittance-summary",
        artifactHash: sha256(JSON.stringify({ totalDue })),
        manifestJson: { totalDue },
        createdBy: "seed-script",
      },
      {
        organizationId: ORG_ID,
        remittanceRunId: REMITTANCE_RUN_ID,
        artifactType: "evidence_seal",
        artifactName: "marathon-remittance-seal.sig",
        storageRef: "inline://seed/marathon-remittance-seal",
        artifactHash: sha256(`seal:${REMITTANCE_RUN_ID}`),
        manifestJson: { algorithm: "sha256" },
        createdBy: "seed-script",
      },
    ]);
  }

  const [replay] = await db.select().from(employerExecutionReplays).where(eq(employerExecutionReplays.id, REPLAY_ID)).limit(1);
  if (!replay) {
    const diff = {
      changed: true,
      differences: [
        {
          scope: "run",
          subjectId: PAYROLL_RUN_ID,
          field: "totalGross",
          originalValue: calc.totals.gross,
          replayValue: calc.totals.gross + 1,
          causeType: "derived_change",
          causeDetail: "seeded replay variance",
          originalRulePath: ["seed", "baseline"],
          replayRulePath: ["seed", "simulated"],
        },
      ],
      summary: "Simulated replay produced a gross-pay variance.",
    };

    await db.insert(employerExecutionReplays).values({
      id: REPLAY_ID,
      organizationId: ORG_ID,
      sourcePayrollRunId: PAYROLL_RUN_ID,
      replayPayrollRunId: PAYROLL_REPLAY_RUN_ID,
      mode: "simulated",
      sourceEngineVersion: "employer-execution-v1",
      replayEngineVersion: "employer-execution-v1.1",
      diffJson: diff,
      diffSummary: diff.summary,
      diffHash: sha256(JSON.stringify(diff)),
      createdBy: "seed-script",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  await db.insert(employerExecutionComplianceEvents).values({
    organizationId: ORG_ID,
    payrollRunId: PAYROLL_REPLAY_RUN_ID,
    remittanceRunId: REMITTANCE_RUN_ID,
    eventCode: "replay_variance_detected",
    severity: "warning",
    status: "open",
    summary: "Replay variance event seeded for pilot verification",
    details: { replayId: REPLAY_ID },
    blocking: "no",
    detectedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  console.log("Employer Execution marathon pilot seed complete.");
}

seed()
  .catch((error) => {
    console.error("Employer execution seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    process.exit(0);
  });
