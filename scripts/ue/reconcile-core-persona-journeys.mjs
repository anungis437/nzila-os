import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const paths = {
  capabilityReview: "docs/union-eyes/reality-remediation/PHASE_1A_3B_CAPABILITY_COHERENCE_REVIEW.json",
  sourceCloseout: "docs/union-eyes/reality-remediation/PHASE_1A_2_FINAL_SOURCE_CLOSEOUT.json",
  navigationIndex: "docs/union-eyes/PHASE_1A_1_PAGE_AND_DISCOVERABILITY_INDEX.json",
  surfaceCensus: "docs/union-eyes/PHASE_1A_USER_SURFACE_CENSUS.json",
  operationalReadiness: "docs/union-eyes/reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md",
  pilotMetrics: "docs/union-eyes/pilot-evidence-pack/PILOT_SUCCESS_METRICS.md",
  executiveConvergence: "docs/union-eyes/runtime-convergence/full-executive-procurement-experience-convergence.md",
  demoConvergence: "docs/union-eyes/runtime-convergence/full-demo-pilot-experience-reconvergence.md",
  outputJson: "docs/union-eyes/reality-remediation/PHASE_1A_4A_CORE_PERSONA_JOURNEY_RECONCILIATION.json",
  outputMarkdown: "docs/union-eyes/reality-remediation/PHASE_1A_4A_CORE_PERSONA_JOURNEY_RECONCILIATION.md",
};

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const readText = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const sorted = (values) => [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
const countBy = (values, key) => {
  const counts = {};
  for (const value of values) counts[key(value)] = (counts[key(value)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
};
const escapeCell = (value) => String(value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");
const mdTable = (headers, rows) => [
  `| ${headers.join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
].join("\n");
const normalizeRoute = (value) => String(value ?? "")
  .split("?")[0]
  .replace(/\/\[locale\](?=\/|$)/g, "")
  .replace(/\/+/g, "/")
  .replace(/\/$/, "") || "/";
const experienceToPersona = {
  MEMBER: "member",
  STAFF: "staff",
  EXECUTIVE: "executive",
  GOVERNANCE: "governance",
  ADMIN: "admin",
  PUBLIC: "public",
};
const personaOrder = ["MEMBER", "STAFF", "EXECUTIVE", "GOVERNANCE", "ADMIN", "PUBLIC"];
const canonicalSpecs = [
  {
    id: "MEMBER_CASE_REVIEW",
    persona: "MEMBER",
    title: "Access and follow a representation case",
    capabilityIds: ["CASE_RECORDS", "CASE_DEADLINES"],
    historicalPersona: "MEMBER",
  },
  {
    id: "STAFF_CASE_CORRESPONDENCE",
    persona: "STAFF",
    title: "Record case-related correspondence",
    capabilityIds: ["CASE_COMMUNICATIONS"],
    historicalPersona: "STAFF",
  },
  {
    id: "EXECUTIVE_GOVERNANCE_REPORTING",
    persona: "EXECUTIVE",
    title: "Review institutional governance and reporting surfaces",
    capabilityIds: ["GOVERNANCE_ADMINISTRATION", "INSTITUTIONAL_REPORTING"],
    historicalPersona: "EXECUTIVE",
  },
  {
    id: "ADMIN_ORGANIZATION_ACCESS",
    persona: "ADMIN",
    title: "Administer organizational structure and user access",
    capabilityIds: ["ORGANIZATION_STRUCTURE", "USER_ACCESS"],
    historicalPersona: "ADMIN",
  },
  {
    id: "PUBLIC_INQUIRY_SUBMISSION",
    persona: "PUBLIC",
    title: "Submit a public inquiry or pilot request",
    capabilityIds: ["PUBLIC_INQUIRIES"],
    historicalPersona: null,
  },
];

const capabilityReview = readJson(paths.capabilityReview);
const sourceCloseout = readJson(paths.sourceCloseout);
const navigationIndex = readJson(paths.navigationIndex);
const surfaceCensus = readJson(paths.surfaceCensus);
const readinessText = readText(paths.operationalReadiness);
const pilotMetricsText = readText(paths.pilotMetrics);
const executiveConvergenceText = readText(paths.executiveConvergence);
const demoConvergenceText = readText(paths.demoConvergence);

assert(capabilityReview.phaseStatus.phase1A3bGate === "PASS", "Accepted Phase 1A.3b review is not PASS");
assert(capabilityReview.canonicalCapabilities.length === 32, "Expected 32 accepted canonical capabilities");
assert(capabilityReview.bindingCapabilityMap.length === 644, "Expected 644 accepted binding mappings");
assert(sourceCloseout.bindings.length === 644, "Expected 644 Phase 1A.2 closeout bindings");
assert(sourceCloseout.obligationRegister.sourceCeilingBindingObligations.length === 230, "Expected 230 source-ceiling obligations");
assert(sourceCloseout.obligationRegister.residualEffectChainObligations.length === 247, "Expected 247 residual effect-chain obligations");
assert(capabilityReview.knownDefectRetention.bindingCount === 58, "Expected 58 known-defect binding rows");
assert(readinessText.includes("NO_GO — RUNTIME_PROOF_REQUIRED"), "Current operational readiness ruling was not found");
assert(pilotMetricsText.includes("Intake → resolution or formal deferral"), "Pilot case-lifecycle target was not found");
assert(executiveConvergenceText.includes("governance walkthroughs"), "Executive/governance doctrinal target was not found");
assert(demoConvergenceText.includes("executive + procurement + steward + member"), "Demo/pilot doctrinal target was not found");

const capabilityById = new Map(capabilityReview.canonicalCapabilities.map((capability) => [capability.capabilityId, capability]));
const bindingMapById = new Map(capabilityReview.bindingCapabilityMap.map((binding) => [binding.bindingId, binding]));
const closeoutBindingById = new Map(sourceCloseout.bindings.map((binding) => [binding.bindingId, binding]));
const navRecords = navigationIndex.primaryNavigation.records;
const contextualRecords = navigationIndex.contextualPageLinks.records;
const pageRecords = navigationIndex.pageAudienceIndex.records;
const staticJourneys = surfaceCensus.journeySurfaceCoverage.journeys;
const staticJourneyByPersona = new Map(staticJourneys.map((journey) => [journey.journey, journey]));

const sourceCeilingByBinding = new Map();
for (const obligation of sourceCloseout.obligationRegister.sourceCeilingBindingObligations) {
  const obligations = sourceCeilingByBinding.get(obligation.bindingId) ?? [];
  obligations.push(obligation);
  sourceCeilingByBinding.set(obligation.bindingId, obligations);
}
const residualByBinding = new Map();
for (const obligation of sourceCloseout.obligationRegister.residualEffectChainObligations) {
  const obligations = residualByBinding.get(obligation.bindingId) ?? [];
  obligations.push(obligation);
  residualByBinding.set(obligation.bindingId, obligations);
}

const exactRouteCapabilities = (route) => {
  const normalized = normalizeRoute(route);
  return capabilityReview.canonicalCapabilities
    .filter((capability) => (capability.routeCandidates ?? []).some((candidate) => normalizeRoute(candidate) === normalized))
    .map((capability) => capability.capabilityId)
    .sort();
};
const routeEvidence = (route, persona) => {
  const normalized = normalizeRoute(route);
  const personaExperience = experienceToPersona[persona];
  const primaryEntries = navRecords.filter((entry) =>
    entry.experience === personaExperience && normalizeRoute(entry.pathname) === normalized);
  const allEntries = navRecords.filter((entry) => normalizeRoute(entry.pathname) === normalized);
  const contextualInbound = contextualRecords.filter((entry) => normalizeRoute(entry.targetRoute) === normalized);
  const page = pageRecords.find((entry) => normalizeRoute(entry.route) === normalized);
  return {
    normalizedRoute: normalized,
    staticPageRecordFound: Boolean(page),
    pageEntryMechanism: page?.entryMechanism ?? null,
    pageDisposition: page?.disposition ?? null,
    pageCallerSourceCount: page?.callerSources?.length ?? null,
    primaryNavigationEntryCountForPersona: primaryEntries.length,
    primaryNavigationExperiences: sorted(allEntries.map((entry) => entry.experience)),
    contextualInboundEdgeCount: contextualInbound.length,
    routeCandidateCapabilityIds: exactRouteCapabilities(route),
  };
};

const buildJourneyEvidence = (spec) => {
  const capabilities = spec.capabilityIds.map((id) => {
    const capability = capabilityById.get(id);
    assert(capability, `Missing canonical capability: ${id}`);
    assert(capability.primaryPersonas.includes(spec.persona), `${id} is not primary for ${spec.persona}`);
    return capability;
  });
  const bindingIds = sorted(capabilities.flatMap((capability) => capability.bindingIds));
  const sourceCeilingObligations = sorted(bindingIds.flatMap((id) =>
    (sourceCeilingByBinding.get(id) ?? []).map((obligation) => obligation.obligationId)));
  const residualEffectChainObligations = sorted(bindingIds.flatMap((id) =>
    (residualByBinding.get(id) ?? []).map((obligation) => obligation.obligationId)));
  const residualEffectChainIds = sorted(bindingIds.flatMap((id) =>
    (residualByBinding.get(id) ?? []).map((obligation) => obligation.chainId)));
  const knownDefectIds = sorted(bindingIds.flatMap((id) =>
    (bindingMapById.get(id)?.knownDefectIds ?? [])));
  const sourceSupportedFalseSuccessBindingIds = sorted(sourceCloseout.falseSuccessReconciliation.sourceSupportedOnlyBindingIds)
    .filter((id) => bindingIds.includes(id));
  const potentialOnlyFalseSuccessBindingIds = sorted(sourceCloseout.falseSuccessReconciliation.potentialOnlyBindingIds)
    .filter((id) => bindingIds.includes(id));
  const priorityCounts = countBy(
    bindingIds.map((id) => closeoutBindingById.get(id)?.priorityClass ?? "UNCLASSIFIED"),
    (priority) => priority,
  );
  const priorityOrder = ["P0", "P1", "P2"];
  const highestOpenPriority = priorityOrder.find((priority) =>
    Object.entries(priorityCounts).some(([priorityClass, count]) =>
      priorityClass.startsWith(`${priority}_`) && count > 0)) ?? null;
  const historical = spec.historicalPersona ? staticJourneyByPersona.get(spec.historicalPersona) : null;
  const steps = historical
    ? historical.steps.map((step, index) => ({
      stepId: `${spec.id}_STEP_${String(index + 1).padStart(2, "0")}`,
      sourceLabel: step.label,
      sourceHref: step.href,
      staticSurfaceExists: step.surfaceExists,
      staticNavEntryExists: step.navEntryExists,
      censusCoverage: step.coverage,
      navigationEvidence: routeEvidence(step.href, spec.persona),
      actionEvidenceClassification: exactRouteCapabilities(step.href).length
        ? "EXACT_ROUTE_CANDIDATE_MATCH_ONLY"
        : step.navEntryExists
          ? "STATIC_SURFACE_AND_NAVIGATION_ONLY"
          : "STATIC_SURFACE_ONLY",
      executionStatus: "NOT_EXECUTED",
    }))
    : [];
  const sourceCeilingBindingIds = sorted(bindingIds.filter((id) => (sourceCeilingByBinding.get(id) ?? []).length));
  const residualBindingIds = sorted(bindingIds.filter((id) => (residualByBinding.get(id) ?? []).length));
  const defectBindingIds = sorted(bindingIds.filter((id) => (bindingMapById.get(id)?.knownDefectIds ?? []).length));

  return {
    journeyId: spec.id,
    persona: spec.persona,
    title: spec.title,
    criticality: capabilities.some((capability) => capability.criticality === "CORE")
      ? "CORE"
      : capabilities.some((capability) => capability.criticality === "MATERIAL")
        ? "MATERIAL"
        : "SUPPORTING",
    evidenceDisposition: "SOURCE_DERIVED_UNVERIFIED",
    journeyOrderEvidence: historical ? "STATIC_STAKEHOLDER_SEQUENCE" : "NO_ORDERED_PUBLIC_SEQUENCE_FOUND",
    sourceSequenceFile: historical?.sourceFile ?? null,
    capabilityIds: capabilities.map((capability) => capability.capabilityId),
    capabilitySourceStatus: capabilities.map((capability) => ({
      capabilityId: capability.capabilityId,
      capabilitySourceStatus: capability.capabilitySourceStatus,
      primaryPersonas: capability.primaryPersonas,
      criticality: capability.criticality,
    })),
    candidateRouteEvidence: capabilities.flatMap((capability) =>
      capability.routeCandidates.map((route) => ({
        capabilityId: capability.capabilityId,
        route,
        staticSurfaceExists: pageRecords.some((page) => normalizeRoute(page.route) === normalizeRoute(route)),
        navigationEvidence: routeEvidence(route, spec.persona),
      }))),
    steps,
    bindingIds,
    sourceCeilingBindingIds,
    sourceCeilingObligationIds: sourceCeilingObligations,
    residualEffectChainBindingIds: residualBindingIds,
    residualEffectChainIds,
    residualEffectChainObligationIds: residualEffectChainObligations,
    knownDefectBindingIds: defectBindingIds,
    knownDefectIds,
    priority: {
      bindingCountsByClass: priorityCounts,
      highestOpenPriority,
      source: "Phase 1A.2 binding priorityClass joined by retained bindingId",
    },
    falseSuccessExposure: {
      sourceSupportedBindingIds: sourceSupportedFalseSuccessBindingIds,
      potentialOnlyBindingIds: potentialOnlyFalseSuccessBindingIds,
      dimensionsKeptSeparate: true,
    },
    claims: {
      sourceComplete: false,
      runtimeVerified: false,
      authorizationVerified: false,
      persistenceVerified: false,
      userActionExecuted: false,
      explanation: "Static page, navigation, capability, and action-binding evidence does not establish a completed user journey or successful business effect.",
    },
  };
};

const journeys = canonicalSpecs.map(buildJourneyEvidence);
const personaReconciliation = personaOrder.map((persona) => {
  const primaryCapabilities = capabilityReview.canonicalCapabilities
    .filter((capability) => capability.primaryPersonas.includes(persona))
    .map((capability) => capability.capabilityId)
    .sort();
  const journey = journeys.find((entry) => entry.persona === persona);
  const historic = staticJourneyByPersona.get(persona);
  return {
    persona,
    primaryCapabilityIds: primaryCapabilities,
    historicalStaticSequenceFound: Boolean(historic?.steps?.length),
    canonicalJourneyIds: journey ? [journey.journeyId] : [],
    sourceCompleteJourneyCount: 0,
    disposition: journey
      ? "CANONICAL_CANDIDATE_SOURCE_DERIVED_UNVERIFIED"
      : primaryCapabilities.length
        ? "NO_CANONICAL_JOURNEY_DERIVED_FROM_THIS_CORPUS"
        : "NO_PRIMARY_PERSONA_CAPABILITY_EVIDENCE",
  };
});

const historicalJourneyReconciliation = staticJourneys.map((record) => {
  if (["LIUNA_CONTINUITY", "WORKAID_OPERATING_MODEL"].includes(record.journey)) {
    return {
      sourceJourney: record.journey,
      sourceFile: record.sourceFile,
      sourceStepCount: record.steps.length,
      disposition: "DEFERRED_TO_PHASE_1A_4B",
      canonicalJourneyId: null,
      stepEvidence: [],
    };
  }
  const spec = canonicalSpecs.find((entry) => entry.historicalPersona === record.journey);
  const canonical = journeys.find((entry) => entry.journeyId === spec?.id);
  return {
    sourceJourney: record.journey,
    sourceFile: record.sourceFile,
    sourceStepCount: record.steps.length,
    sourceCoverage: record.coverage,
    disposition: canonical
      ? "RECONCILED_TO_SOURCE_DERIVED_UNVERIFIED_CANDIDATE"
      : "NAVIGATION_SEQUENCE_ONLY_NO_PRIMARY_PERSONA_CAPABILITY",
    canonicalJourneyId: canonical?.journeyId ?? null,
    stepEvidence: record.steps.map((step, index) => ({
      stepId: `${record.journey}_HISTORICAL_STEP_${String(index + 1).padStart(2, "0")}`,
      label: step.label,
      href: step.href,
      staticSurfaceExists: step.surfaceExists,
      navEntryExists: step.navEntryExists,
      coverage: step.coverage,
      routeEvidence: routeEvidence(step.href, record.journey),
      executionStatus: "NOT_EXECUTED",
    })),
  };
});

const documentedTargets = [
  {
    targetId: "PILOT_CASE_LIFECYCLE",
    sourceFile: paths.pilotMetrics,
    recordType: "PILOT_SUCCESS_TARGET",
    target: "Intake → resolution or formal deferral",
    targetThreshold: "At least 20 cases processed end-to-end by pilot close",
    persona: null,
    capabilityIds: ["CASE_RECORDS"],
    disposition: "DOCUMENTED_OUTCOME_TARGET_NOT_JOURNEY_EXECUTION_EVIDENCE",
  },
  {
    targetId: "EXECUTIVE_PROCUREMENT_WALKTHROUGHS",
    sourceFile: paths.executiveConvergence,
    recordType: "DOCTRINAL_WALKTHROUGH_TARGETS",
    target: "Executive, governance, trust-center, procurement, pilot, onboarding, and operational-proof flows",
    persona: null,
    capabilityIds: [],
    disposition: "DOCTRINAL_TARGETS_WITHOUT_ORDERED_SOURCE_STEPS",
  },
  {
    targetId: "DEMO_PILOT_WALKTHROUGHS",
    sourceFile: paths.demoConvergence,
    recordType: "DOCTRINAL_WALKTHROUGH_TARGETS",
    target: "Executive, procurement, steward, and member operational walkthroughs",
    persona: null,
    capabilityIds: [],
    disposition: "DOCTRINAL_TARGETS_WITHOUT_ORDERED_SOURCE_STEPS",
  },
];

const phaseStatus = {
  phase1A3bGate: capabilityReview.phaseStatus.phase1A3bGate,
  phase1A: "NOT_YET_PROVEN",
  operationalReadiness: "NO_GO — RUNTIME_PROOF_REQUIRED",
  phase1A4b: "DEFERRED",
  phase1B: "NOT_AUTHORIZED",
  phase2: "NOT_AUTHORIZED",
  phase3B: "BLOCKED_UNTIL_OPERATIONAL_READINESS_PASS",
};

const report = {
  metadata: {
    title: "Phase 1A.4a Core Persona Journey Reconciliation",
    evidenceBoundary: "Accepted Phase 1A.3b capability model as primary evidence; Phase 1A.2 closeout for inherited binding obligations and priority; Phase 1A.1 index and Phase 1A census for static surface/discoverability only; pilot and convergence documents as documented targets only.",
    generatedBy: "scripts/ue/reconcile-core-persona-journeys.mjs",
    generatedAt: null,
    applicationSourceInspected: false,
    runtimeActionExecuted: false,
    productCodeChanged: false,
  },
  phaseStatus,
  summary: {
    requiredPersonas: personaOrder.length,
    canonicalJourneyCandidates: journeys.length,
    historicalJourneyRecords: historicalJourneyReconciliation.length,
    historicalStepRecords: historicalJourneyReconciliation.reduce((sum, record) => sum + record.sourceStepCount, 0),
    deferredPhase1A4bRecords: historicalJourneyReconciliation.filter((record) => record.disposition === "DEFERRED_TO_PHASE_1A_4B").length,
    sourceCompleteJourneyCount: journeys.filter((journey) => journey.claims.sourceComplete).length,
    runtimeVerifiedJourneyCount: journeys.filter((journey) => journey.claims.runtimeVerified).length,
    documentedWalkthroughTargetsWithoutOrderedSteps: documentedTargets
      .filter((target) => target.recordType === "DOCTRINAL_WALKTHROUGH_TARGETS").length,
  },
  personaReconciliation,
  canonicalJourneys: journeys,
  historicalJourneyReconciliation,
  documentedTargets,
  falseSuccessReconciliation: {
    sourceSupportedBindingIds: sorted(sourceCloseout.falseSuccessReconciliation.sourceSupportedOnlyBindingIds),
    sourceSupportedChainIds: sorted(sourceCloseout.falseSuccessReconciliation.sourceSupportedChainIds),
    potentialOnlyBindingIds: sorted(sourceCloseout.falseSuccessReconciliation.potentialOnlyBindingIds),
    evidenceOverlapBindingCount: sourceCloseout.falseSuccessReconciliation.evidenceOverlapBindingCount,
    interpretation: sourceCloseout.falseSuccessReconciliation.interpretation,
  },
  limitations: [
    "Historical stakeholder-demo paths are static source inventories; no journey was executed.",
    "Route and navigation presence do not establish action completion, authorization, persistence, successful external effects, or audit behavior.",
    "Capability persona tags are analytical source labels, not role-access proof.",
    "Per-step capability matches require exact normalized route-candidate equality; no semantic route-to-capability inference is made.",
    "The pilot case lifecycle and executive/procurement/demo walkthroughs are documented targets, not evidence that the target flows occurred.",
    "The five source-supported and four potential-only false-success binding sets are retained separately.",
    "LIUNA continuity and WorkAid operating-model journeys remain deferred to Phase 1A.4b.",
  ],
  validation: {
    acceptedPhase1A3bInput: capabilityReview.phaseStatus.phase1A3bGate === "PASS",
    acceptedBindingDenominators: capabilityReview.bindingCapabilityMap.length === 644 && sourceCloseout.bindings.length === 644,
    sourceCeilingObligationDenominatorRetained: sourceCloseout.obligationRegister.sourceCeilingBindingObligations.length === 230,
    residualEffectChainDenominatorRetained: sourceCloseout.obligationRegister.residualEffectChainObligations.length === 247,
    knownDefectBindingDenominatorRetained: capabilityReview.knownDefectRetention.bindingCount === 58,
    allRequiredPersonasRepresented: personaReconciliation.length === 6 && personaOrder.every((persona) => personaReconciliation.some((row) => row.persona === persona)),
    everyHistoricalJourneyRecordReconciled: historicalJourneyReconciliation.length === staticJourneys.length,
    allStaticJourneyStepsPreserved: historicalJourneyReconciliation.reduce((sum, record) => sum + record.sourceStepCount, 0) === staticJourneys.reduce((sum, record) => sum + record.steps.length, 0),
    externalSpecialistJourneysDeferred: ["LIUNA_CONTINUITY", "WORKAID_OPERATING_MODEL"].every((persona) =>
      historicalJourneyReconciliation.find((record) => record.sourceJourney === persona)?.disposition === "DEFERRED_TO_PHASE_1A_4B"),
    canonicalCapabilitiesPrimaryForPersona: journeys.every((journey) => journey.capabilityIds.every((id) =>
      capabilityById.get(id)?.primaryPersonas.includes(journey.persona))),
    candidatesWithoutHistoricalSequenceHaveNoOrderedSteps: journeys.every((journey) =>
      journey.sourceSequenceFile !== null || journey.steps.length === 0),
    highestOpenPriorityMatchesRetainedPriorityClasses: journeys.every((journey) => {
      const expected = ["P0", "P1", "P2"].find((priority) =>
        Object.entries(journey.priority.bindingCountsByClass).some(([priorityClass, count]) =>
          priorityClass.startsWith(`${priority}_`) && count > 0)) ?? null;
      return journey.priority.highestOpenPriority === expected;
    }),
    inheritedBindingAndObligationIdsResolve: journeys.every((journey) =>
      journey.bindingIds.every((id) => bindingMapById.has(id) && closeoutBindingById.has(id)) &&
      journey.sourceCeilingObligationIds.every((id) => sourceCloseout.obligationRegister.sourceCeilingBindingObligations.some((obligation) => obligation.obligationId === id)) &&
      journey.residualEffectChainObligationIds.every((id) => sourceCloseout.obligationRegister.residualEffectChainObligations.some((obligation) => obligation.obligationId === id))),
    falseSuccessDimensionsRemainSeparate: sourceCloseout.falseSuccessReconciliation.evidenceOverlapBindingCount === 0 &&
      journeys.every((journey) => journey.falseSuccessExposure.dimensionsKeptSeparate),
    noJourneyExecutionOrRuntimeClaims: journeys.every((journey) =>
      !journey.claims.sourceComplete && !journey.claims.runtimeVerified && !journey.claims.authorizationVerified &&
      !journey.claims.persistenceVerified && !journey.claims.userActionExecuted) &&
      historicalJourneyReconciliation.every((record) => record.stepEvidence.every((step) => step.executionStatus === "NOT_EXECUTED")),
    noLaterPhaseStarted: phaseStatus.phase1A4b === "DEFERRED" &&
      phaseStatus.phase1B === "NOT_AUTHORIZED" &&
      phaseStatus.phase2 === "NOT_AUTHORIZED" &&
      phaseStatus.phase3B === "BLOCKED_UNTIL_OPERATIONAL_READINESS_PASS",
    applicationSourceInspected: false,
    runtimeActionExecuted: false,
    productCodeChanged: false,
  },
};

const canonicalRows = journeys.map((journey) => [
  journey.persona,
  journey.journeyId,
  journey.title,
  journey.criticality,
  journey.capabilityIds.join(", "),
  journey.bindingIds.length,
  journey.sourceCeilingObligationIds.length,
  journey.residualEffectChainObligationIds.length,
  journey.knownDefectIds.length,
  journey.priority.highestOpenPriority ?? "—",
  `${journey.falseSuccessExposure.sourceSupportedBindingIds.length} source-supported / ${journey.falseSuccessExposure.potentialOnlyBindingIds.length} potential-only`,
]);
const personaRows = personaReconciliation.map((row) => [
  row.persona,
  row.primaryCapabilityIds.length,
  row.historicalStaticSequenceFound ? "Yes" : "No",
  row.canonicalJourneyIds.join(", ") || "None",
  row.sourceCompleteJourneyCount,
  row.disposition,
]);
const historyRows = historicalJourneyReconciliation.map((record) => [
  record.sourceJourney,
  record.sourceStepCount,
  record.disposition,
  record.canonicalJourneyId ?? "—",
]);
const stepSections = journeys.filter((journey) => journey.steps.length).map((journey) => `### ${journey.persona} — ${journey.title}

${mdTable(["Step", "Source label", "Route", "Surface", "Persona nav entries", "Contextual inbound edges", "Exact route capability candidates", "Action evidence"], journey.steps.map((step) => [
  step.stepId,
  step.sourceLabel,
  step.navigationEvidence.normalizedRoute,
  step.staticSurfaceExists ? "Present in static census" : "Not found in page index",
  step.navigationEvidence.primaryNavigationEntryCountForPersona,
  step.navigationEvidence.contextualInboundEdgeCount,
  step.navigationEvidence.routeCandidateCapabilityIds.join(", ") || "None",
  step.actionEvidenceClassification,
]))}`).join("\n\n");

const markdown = `# Phase 1A.4a — Core Persona Journey Reconciliation

**Artifact status: generated from accepted source evidence only.** The accepted Phase 1A.3b capability-coherence review is the primary capability source. Phase 1A.2 contributes retained binding-level obligations, defect identifiers, false-success classifications, and priorities. Phase 1A.1 and the Phase 1A user-surface census contribute static route and navigation evidence only.

## Phase boundary and current ruling

| Item | Evidence disposition |
| --- | --- |
| Phase 1A.3b capability review | ${report.phaseStatus.phase1A3bGate} |
| Phase 1A | ${report.phaseStatus.phase1A} |
| SaaS operational readiness | ${report.phaseStatus.operationalReadiness} |
| Phase 1A.4b (LIUNA continuity and WorkAid) | ${report.phaseStatus.phase1A4b} |
| Phase 1B / Phase 2 | ${report.phaseStatus.phase1B} / ${report.phaseStatus.phase2} |
| Phase 3B recording work | ${report.phaseStatus.phase3B} |
| Application source inspected / runtime actions executed | No / No |

This reconciliation does not reopen or resolve the Phase 1A.3b source model, execute product journeys, prove capabilities, or authorize later work. Static route existence and menu entries do not establish user actions, authorization, persistence, business effects, or readiness.

## Persona reconciliation

${mdTable(["Persona", "Primary capability concepts", "Historical static sequence", "Canonical candidate", "Source-complete journeys", "Disposition"], personaRows)}

The \`GOVERNANCE\` persona has a static navigation sequence but no canonical capability with \`GOVERNANCE\` as a primary persona in the accepted 1A.3b model. It is therefore retained as a navigation-only historical record, not promoted to a business journey. \`PUBLIC\` has a primary \`PUBLIC_INQUIRIES\` capability and route candidates, but no named public E2E sequence in the historical census.

## Canonical journey candidates

${mdTable(["Persona", "Journey ID", "Candidate", "Criticality", "Capability IDs", "Bindings", "Source-ceiling obligations", "Residual obligations", "Known-defect IDs", "Highest open priority", "False-success exposure"], canonicalRows)}

Every candidate is marked \`SOURCE_DERIVED_UNVERIFIED\`. Historical step sequences are retained as static records; candidates without an ordered historical sequence are represented by route candidates in the JSON artifact, not by invented steps. Capability associations are evidence-bounded; they are not a claim that a complete workflow exists or that any action succeeded. The exact inherited binding IDs, source-ceiling obligation IDs, residual effect-chain IDs and obligation IDs, known-defect IDs, and separated false-success binding sets are preserved in the JSON artifact.

### Historical static journey records

${mdTable(["Historical persona", "Steps", "Disposition", "Canonical candidate"], historyRows)}

${stepSections}

Historical step ordering is retained exactly from the census. Per-step capability association is reported only where the normalized route exactly matches an accepted capability route candidate. Other steps remain surface/navigation evidence only.

## Other documented targets (not journey execution evidence)

${mdTable(["Record", "Source", "Documented target", "Disposition"], documentedTargets.map((target) => [
  target.targetId,
  target.sourceFile,
  target.target,
  target.disposition,
]))}

The pilot case lifecycle is a target metric, not an observed intake-to-outcome sequence. The executive/procurement and demo/pilot materials describe desired walkthroughs but provide no ordered source steps here; those targets are not elevated into verified or runtime journeys.

## False-success classifications

The Phase 1A.2 closeout's **${report.falseSuccessReconciliation.sourceSupportedBindingIds.length} source-supported** false-success binding IDs and **${report.falseSuccessReconciliation.potentialOnlyBindingIds.length} potential-only** binding IDs remain separate. Their overlap count is **${report.falseSuccessReconciliation.evidenceOverlapBindingCount}**. Journey-level intersections are similarly reported in separate JSON fields; the two dimensions are not combined.

## Limitations

${report.limitations.map((limitation) => `- ${limitation}`).join("\n")}

## Validation

${mdTable(["Check", "Result"], Object.entries(report.validation).map(([check, result]) => [check, String(result)]))}

Outputs are deterministic: \`generatedAt\` is null, and rerunning the generator from the same accepted inputs produces byte-identical JSON and Markdown.
`;

assert(Object.values(report.validation).every((value) => typeof value === "boolean"), "Validation report contains a non-boolean result");
assert(Object.entries(report.validation)
  .filter(([key]) => !["applicationSourceInspected", "runtimeActionExecuted", "productCodeChanged"].includes(key))
  .every(([, value]) => value), "A required Phase 1A.4a validation check failed");

fs.writeFileSync(path.join(root, paths.outputJson), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(root, paths.outputMarkdown), markdown);
console.log(JSON.stringify({
  summary: report.summary,
  validation: report.validation,
  outputs: [paths.outputJson, paths.outputMarkdown],
}, null, 2));
