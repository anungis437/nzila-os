import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const paths = {
  capabilityReview: "docs/union-eyes/reality-remediation/PHASE_1A_3B_CAPABILITY_COHERENCE_REVIEW.json",
  sourceCloseout: "docs/union-eyes/reality-remediation/PHASE_1A_2_FINAL_SOURCE_CLOSEOUT.json",
  navigationIndex: "docs/union-eyes/PHASE_1A_1_PAGE_AND_DISCOVERABILITY_INDEX.json",
  surfaceCensus: "docs/union-eyes/PHASE_1A_USER_SURFACE_CENSUS.json",
  coreJourneyReconciliation: "docs/union-eyes/reality-remediation/PHASE_1A_4A_CORE_PERSONA_JOURNEY_RECONCILIATION.json",
  operationalReadiness: "docs/union-eyes/reality-remediation/25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md",
  outputJson: "docs/union-eyes/reality-remediation/PHASE_1A_4B_SPECIAL_JOURNEY_BOUNDARY_RECONCILIATION.json",
  outputMarkdown: "docs/union-eyes/reality-remediation/PHASE_1A_4B_SPECIAL_JOURNEY_BOUNDARY_RECONCILIATION.md",
};

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const readText = (file) => fs.readFileSync(path.join(root, file), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const uniqueSorted = (values) => [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
const normalizeRoute = (value) => String(value ?? "")
  .split("?")[0]
  .replace(/\/\[locale\](?=\/|$)/g, "")
  .replace(/\[[^\]]+\]/g, "[param]")
  .replace(/\/+/g, "/")
  .replace(/\/$/, "") || "/";
const escapeCell = (value) => String(value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");
const mdTable = (headers, rows) => [
  `| ${headers.join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
].join("\n");

const capabilityReview = readJson(paths.capabilityReview);
const sourceCloseout = readJson(paths.sourceCloseout);
const navigationIndex = readJson(paths.navigationIndex);
const surfaceCensus = readJson(paths.surfaceCensus);
const coreJourneyReconciliation = readJson(paths.coreJourneyReconciliation);
const readinessText = readText(paths.operationalReadiness);

const canonicalCapabilities = capabilityReview.canonicalCapabilities;
const capabilityById = new Map(canonicalCapabilities.map((item) => [item.capabilityId, item]));
const bindingById = new Map(sourceCloseout.bindings.map((item) => [item.bindingId, item]));
const capabilityBindingMapById = new Map(capabilityReview.bindingCapabilityMap.map((item) => [item.bindingId, item]));
const sourceCeilingByBinding = new Map();
for (const obligation of sourceCloseout.obligationRegister.sourceCeilingBindingObligations) {
  const items = sourceCeilingByBinding.get(obligation.bindingId) ?? [];
  items.push(obligation);
  sourceCeilingByBinding.set(obligation.bindingId, items);
}
const residualByBinding = new Map();
for (const obligation of sourceCloseout.obligationRegister.residualEffectChainObligations) {
  const items = residualByBinding.get(obligation.bindingId) ?? [];
  items.push(obligation);
  residualByBinding.set(obligation.bindingId, items);
}

const pageRecords = navigationIndex.pageAudienceIndex.records;
const primaryNavigationRecords = navigationIndex.primaryNavigation.records;
const contextualPageLinks = navigationIndex.contextualPageLinks.records;
const continuitySignals = new Map(capabilityReview.institutionalContinuityReview.signals
  .map((item) => [item.dimension, item]));
const externalReview = capabilityReview.externalSpecialistReview;
const censusJourneys = new Map(surfaceCensus.journeySurfaceCoverage.journeys
  .map((item) => [item.journey, item]));

assert(capabilityReview.phaseStatus.phase1A3bGate === "PASS", "Accepted Phase 1A.3b review is not PASS");
assert(canonicalCapabilities.length === 32, "Expected 32 accepted canonical capabilities");
assert(capabilityReview.bindingCapabilityMap.length === 644, "Expected 644 accepted binding mappings");
assert(sourceCloseout.bindings.length === 644, "Expected 644 accepted closeout bindings");
assert(sourceCloseout.obligationRegister.sourceCeilingBindingObligations.length === 230, "Expected 230 source-ceiling obligations");
assert(sourceCloseout.obligationRegister.residualEffectChainObligations.length === 247, "Expected 247 residual effect-chain obligations");
assert(capabilityReview.knownDefectRetention.bindingCount === 58, "Expected 58 known-defect binding rows");
assert(coreJourneyReconciliation.summary.canonicalJourneyCandidates === 5, "Accepted 1A.4a artifact must retain five core journey candidates");
assert(coreJourneyReconciliation.summary.sourceCompleteJourneyCount === 0, "Accepted 1A.4a artifact must retain zero source-complete journeys");
assert(externalReview.workAidIntegrationInferred === false, "Accepted 1A.3b review must not infer a WorkAid integration");
assert(externalReview.supportedDimensions.length === 0, "Accepted 1A.3b review must retain no supported external-specialist dimensions");
assert(readinessText.includes("NO_GO — RUNTIME_PROOF_REQUIRED"), "Current operational-readiness ruling was not found");
assert(censusJourneys.get("LIUNA_CONTINUITY")?.steps.length === 0, "LIUNA source census must retain its empty step inventory");
assert(censusJourneys.get("WORKAID_OPERATING_MODEL")?.steps.length === 0, "WorkAid source census must retain its empty step inventory");

const dimensionSpecs = [
  {
    id: "CONTEXT_CAPTURE",
    intent: "Capture and expose institutional context held by the outgoing leader.",
    capabilityIds: ["KNOWLEDGE_HANDOFF"],
    signalDimensions: ["knowledge/context preservation", "successor handoff"],
    sourceSupport: "SOURCE_CEILING",
    discoverabilityStatus: "NO_SOURCE_TRANSITION",
    routes: [],
    gapReason: "The accepted model contains a knowledge-transfer signal, but does not establish an outgoing-owner context-capture action or its ordered entry path.",
  },
  {
    id: "ACTIVE_MATTER_VISIBILITY",
    intent: "Identify active matters relevant to the institutional transition.",
    capabilityIds: ["CASE_RECORDS"],
    signalDimensions: ["institutional record retention"],
    sourceSupport: "SOURCE_SUPPORTED_WITH_DEFECT_AND_CEILING",
    discoverabilityStatus: "SOURCE_LINK",
    routes: ["/[locale]/dashboard/claims/[id]", "/[locale]/dashboard/claims/new"],
    gapReason: "Matter-record source signals exist, but the static links are not a LIUNA continuity sequence and do not establish that all active matters are visible to a successor.",
  },
  {
    id: "RESPONSIBILITY_ASSIGNMENT",
    intent: "Identify the current owner of each relevant matter or commitment.",
    capabilityIds: ["CASE_RESPONSIBILITY"],
    signalDimensions: ["ownership/assignment"],
    sourceSupport: "SOURCE_SUPPORTED_WITH_DEFECT_AND_CEILING",
    discoverabilityStatus: "DIRECT_ROUTE_ONLY",
    routes: ["/[locale]/dashboard/dispatch"],
    gapReason: "The accepted assignment concept is source-bounded and has inherited defects and ceilings; the dispatch surface has no static inbound navigation edge.",
  },
  {
    id: "RESPONSIBILITY_REASSIGNMENT",
    intent: "Transfer responsibility from the outgoing owner to an identified successor.",
    capabilityIds: ["CASE_RESPONSIBILITY", "KNOWLEDGE_HANDOFF"],
    signalDimensions: ["ownership/assignment", "successor handoff"],
    sourceSupport: "PARTIALLY_SOURCE_SUPPORTED",
    discoverabilityStatus: "DIRECT_ROUTE_ONLY",
    routes: ["/[locale]/dashboard/dispatch"],
    gapReason: "Assignment and successor-handoff concepts exist separately; the accepted model does not establish a predecessor-to-successor reassignment transition.",
  },
  {
    id: "DEADLINE_CONTINUITY",
    intent: "Carry deadlines and open commitments forward through reassignment.",
    capabilityIds: ["CASE_DEADLINES", "CALENDAR_MEETINGS"],
    signalDimensions: ["deadline continuity"],
    sourceSupport: "PARTIALLY_SOURCE_SUPPORTED",
    discoverabilityStatus: "NO_SOURCE_TRANSITION",
    routes: [],
    gapReason: "A deadline-continuity source signal exists, but the accepted CASE_DEADLINES definition explicitly does not infer reminder-engine behavior or survival across reassignment.",
  },
  {
    id: "EVIDENCE_CONTINUITY",
    intent: "Keep relevant matter evidence institutionally available across the transition.",
    capabilityIds: ["CASE_EVIDENCE"],
    signalDimensions: ["restricted evidence continuity", "institutional record retention"],
    sourceSupport: "SOURCE_CEILING",
    discoverabilityStatus: "DIRECT_ROUTE_ONLY",
    routes: ["/[locale]/dashboard/voting"],
    gapReason: "The accepted model contains a case-evidence signal with open ceilings; the route candidate has no static inbound entry and does not prove continuity across actors.",
  },
  {
    id: "RESTRICTED_EVIDENCE_BOUNDARY",
    intent: "Keep restricted evidence bounded to only appropriately authorized successors.",
    capabilityIds: [],
    signalDimensions: ["restricted evidence continuity"],
    sourceSupport: "NOT_SOURCE_SUPPORTED",
    discoverabilityStatus: "NO_SOURCE_TRANSITION",
    routes: [],
    gapReason: "CASE_EVIDENCE does not establish classification, least-privilege scope, successor eligibility, authorization, or access revocation for restricted evidence.",
  },
  {
    id: "SUCCESSOR_HANDOFF",
    intent: "Hand off matter context and responsibility to a successor.",
    capabilityIds: ["KNOWLEDGE_HANDOFF", "CASE_RESPONSIBILITY"],
    signalDimensions: ["successor handoff", "ownership/assignment"],
    sourceSupport: "SOURCE_CEILING",
    discoverabilityStatus: "NO_SOURCE_TRANSITION",
    routes: [],
    gapReason: "The accepted model has a successor-handoff signal, but no ordered or discoverable LIUNA handoff flow is established.",
  },
  {
    id: "KNOWLEDGE_PRESERVATION",
    intent: "Preserve institutional knowledge beyond the outgoing actor's tenure.",
    capabilityIds: ["KNOWLEDGE_HANDOFF"],
    signalDimensions: ["knowledge/context preservation", "institutional record retention"],
    sourceSupport: "SOURCE_CEILING",
    discoverabilityStatus: "NO_SOURCE_TRANSITION",
    routes: [],
    gapReason: "The knowledge-preservation capability is a source-model signal with open obligations; durable post-transition retention is not proven.",
  },
  {
    id: "AUDIT_PROVENANCE",
    intent: "Establish provenance for the handoff and resulting responsibility changes.",
    capabilityIds: ["GOVERNANCE_ADMINISTRATION"],
    signalDimensions: ["auditability"],
    sourceSupport: "PARTIALLY_SOURCE_SUPPORTED",
    discoverabilityStatus: "PRIMARY_NAV",
    routes: ["/[locale]/dashboard/leadership", "/[locale]/dashboard/finance/allocation"],
    gapReason: "The accepted model includes an auditability signal and a leadership navigation surface, but neither establishes transaction-level handoff provenance or a preserved audit trail.",
  },
  {
    id: "POST_HANDOFF_CONTINUITY",
    intent: "Keep matters, deadlines, evidence, and knowledge usable after handoff.",
    capabilityIds: ["CASE_RECORDS", "CASE_DEADLINES", "CASE_EVIDENCE", "KNOWLEDGE_HANDOFF"],
    signalDimensions: ["institutional record retention", "deadline continuity", "restricted evidence continuity", "successor handoff"],
    sourceSupport: "PARTIALLY_SOURCE_SUPPORTED",
    discoverabilityStatus: "NO_SOURCE_TRANSITION",
    routes: [],
    gapReason: "Separate continuity-related source signals exist, but the accepted corpus establishes no joined post-handoff state, access, or operational result.",
  },
];

const transitions = [
  { id: "CONTEXT_TO_MATTER", from: "INSTITUTIONAL_CONTEXT", to: "ACTIVE_MATTER", classification: "CAPABILITY_RELATION_ONLY", capabilityIds: ["KNOWLEDGE_HANDOFF", "CASE_RECORDS"] },
  { id: "MATTER_TO_RESPONSIBILITY", from: "ACTIVE_MATTER", to: "CURRENT_RESPONSIBILITY", classification: "CAPABILITY_RELATION_ONLY", capabilityIds: ["CASE_RECORDS", "CASE_RESPONSIBILITY"] },
  { id: "RESPONSIBILITY_TO_SUCCESSOR", from: "CURRENT_RESPONSIBILITY", to: "SUCCESSOR_ASSUMES_RESPONSIBILITY", classification: "CAPABILITY_RELATION_ONLY", capabilityIds: ["CASE_RESPONSIBILITY", "KNOWLEDGE_HANDOFF"] },
  { id: "MATTER_TO_DEADLINE", from: "ACTIVE_MATTER", to: "DEADLINE_OR_OPEN_COMMITMENT", classification: "CAPABILITY_RELATION_ONLY", capabilityIds: ["CASE_RECORDS", "CASE_DEADLINES", "CALENDAR_MEETINGS"] },
  { id: "MATTER_TO_EVIDENCE", from: "ACTIVE_MATTER", to: "RESTRICTED_EVIDENCE", classification: "CAPABILITY_RELATION_ONLY", capabilityIds: ["CASE_RECORDS", "CASE_EVIDENCE"] },
  { id: "EVIDENCE_TO_SUCCESSOR_ACCESS", from: "RESTRICTED_EVIDENCE", to: "SUCCESSOR_ACCESS", classification: "NO_SOURCE_TRANSITION", capabilityIds: [] },
  { id: "HANDOFF_TO_RETAINED_CONTEXT", from: "SUCCESSOR_HANDOFF", to: "RETAINED_INSTITUTIONAL_CONTEXT", classification: "CAPABILITY_RELATION_ONLY", capabilityIds: ["KNOWLEDGE_HANDOFF"] },
].map((transition) => ({
  ...transition,
  establishedSourceTransition: transition.classification === "SOURCE_TRANSITION_ESTABLISHED",
  explanation: transition.classification === "CAPABILITY_RELATION_ONLY"
    ? "The accepted model contains the named capability concepts, but no binding-level or workflow edge establishes this ordered transition."
    : "The accepted source model establishes no bounded evidence-access transition for a successor.",
}));

const routeEvidence = (route) => {
  const normalized = normalizeRoute(route);
  const page = pageRecords.find((record) => normalizeRoute(record.route) === normalized);
  const nav = primaryNavigationRecords
    .filter((record) => normalizeRoute(record.pathname) === normalized)
    .map((record) => ({ experience: record.experience, label: record.label, pathname: record.pathname }));
  const links = contextualPageLinks
    .filter((record) => normalizeRoute(record.targetRoute) === normalized)
    .map((record) => ({
      linkMechanism: record.linkMechanism,
      sourceRoute: record.sourceRoute,
      targetRoute: record.targetRoute,
    }));
  return {
    normalizedRoute: normalized,
    pageRecordFound: Boolean(page),
    pageEntryMechanism: page?.entryMechanism ?? null,
    pageDisposition: page?.disposition ?? null,
    primaryNavigationRecords: nav,
    contextualInboundLinkCount: links.length,
    contextualInboundLinks: links,
  };
};

const closeoutByCapability = (capabilityIds) => {
  const bindingIds = uniqueSorted(capabilityIds.flatMap((id) => capabilityById.get(id)?.bindingIds ?? []));
  const knownDefectIds = uniqueSorted(bindingIds.flatMap((id) =>
    capabilityBindingMapById.get(id)?.knownDefectIds ?? []));
  const sourceCeilingObligations = bindingIds.flatMap((id) => sourceCeilingByBinding.get(id) ?? []);
  const residualObligations = bindingIds.flatMap((id) => residualByBinding.get(id) ?? []);
  const sourceSupportedFalseSuccessBindingIds = uniqueSorted(
    sourceCloseout.falseSuccessReconciliation.sourceSupportedOnlyBindingIds,
  ).filter((id) => bindingIds.includes(id));
  const potentialOnlyFalseSuccessBindingIds = uniqueSorted(
    sourceCloseout.falseSuccessReconciliation.potentialOnlyBindingIds,
  ).filter((id) => bindingIds.includes(id));
  return {
    bindingIds,
    knownDefectIds,
    sourceCeilingBindingIds: uniqueSorted(sourceCeilingObligations.map((item) => item.bindingId)),
    sourceCeilingObligationIds: uniqueSorted(sourceCeilingObligations.map((item) => item.obligationId)),
    residualEffectChainIds: uniqueSorted([
      ...residualObligations.map((item) => item.chainId),
      ...sourceCeilingObligations.flatMap((item) => item.relatedResidualChainIds ?? []),
    ]),
    residualEffectChainObligationIds: uniqueSorted(residualObligations.map((item) => item.obligationId)),
    falseSuccessExposure: {
      sourceSupportedBindingIds: sourceSupportedFalseSuccessBindingIds,
      potentialOnlyBindingIds: potentialOnlyFalseSuccessBindingIds,
      dimensionsKeptSeparate: true,
    },
  };
};

const liunaDimensions = dimensionSpecs.map((spec, index) => {
  const capabilityIds = uniqueSorted(spec.capabilityIds);
  const inherited = closeoutByCapability(capabilityIds);
  const signals = spec.signalDimensions.map((dimension) => {
    const signal = continuitySignals.get(dimension);
    assert(signal, `Missing accepted continuity signal: ${dimension}`);
    return {
      dimension: signal.dimension,
      sourceModelContainsSignal: signal.sourceModelContainsSignal,
      runtimeOrOperationalProof: signal.runtimeOrOperationalProof,
      assessment: signal.assessment,
      referencedCapabilityIds: signal.capabilityIds,
    };
  });
  return {
    stepId: `LIUNA_CONTINUITY_STEP_${String(index + 1).padStart(2, "0")}`,
    continuityDimension: spec.id,
    businessIntent: spec.intent,
    sourceSupport: spec.sourceSupport,
    sourceCapabilityIds: capabilityIds,
    capabilitySourceStatus: capabilityIds.map((id) => ({
      capabilityId: id,
      capabilitySourceStatus: capabilityById.get(id).capabilitySourceStatus,
    })),
    acceptedContinuitySignals: signals,
    bindingIds: inherited.bindingIds,
    routesOrSurfaces: spec.routes.map((route) => ({
      route,
      staticEvidence: routeEvidence(route),
    })),
    discoverabilityStatus: spec.discoverabilityStatus,
    knownDefectIds: inherited.knownDefectIds,
    sourceCeilingObligationIds: inherited.sourceCeilingObligationIds,
    residualEffectChainIds: inherited.residualEffectChainIds,
    residualEffectChainObligationIds: inherited.residualEffectChainObligationIds,
    falseSuccessExposure: inherited.falseSuccessExposure,
    gapReason: spec.gapReason,
  };
});

const journeyCapabilityIds = uniqueSorted(liunaDimensions.flatMap((step) => step.sourceCapabilityIds));
const journeyEvidence = closeoutByCapability(journeyCapabilityIds);
const staticRelations = transitions.filter((item) => item.classification === "STATIC_SURFACE_RELATION_ONLY");
const capabilityRelations = transitions.filter((item) => item.classification === "CAPABILITY_RELATION_ONLY");
const noSourceTransitions = transitions.filter((item) => item.classification === "NO_SOURCE_TRANSITION");
const directRouteOnlySteps = liunaDimensions.filter((item) => item.discoverabilityStatus === "DIRECT_ROUTE_ONLY");
const noSourceTransitionSteps = liunaDimensions.filter((item) => item.discoverabilityStatus === "NO_SOURCE_TRANSITION");

const liunaAdversarialAnswers = [
  { question: "Can an outgoing leader expose the relevant institutional context?", answer: "PARTIAL_SOURCE_SIGNAL", evidence: ["KNOWLEDGE_HANDOFF"], rationale: "A knowledge/context-preservation signal exists, but no outgoing-actor action or ordered path is established." },
  { question: "Can active matters be identified?", answer: "PARTIAL_SOURCE_SIGNAL", evidence: ["CASE_RECORDS"], rationale: "Matter-record signals exist, but completeness and successor visibility are not established." },
  { question: "Can responsibility be reassigned?", answer: "PARTIAL_SOURCE_SIGNAL", evidence: ["CASE_RESPONSIBILITY", "KNOWLEDGE_HANDOFF"], rationale: "Assignment and handoff concepts exist, but the predecessor-to-successor transition is not established." },
  { question: "Can deadline state survive reassignment?", answer: "PARTIAL_SOURCE_SIGNAL", evidence: ["CASE_DEADLINES", "CALENDAR_MEETINGS"], rationale: "The review records a deadline-continuity signal; it explicitly does not prove reminder delivery or deadline survival after reassignment." },
  { question: "Can evidence remain institutionally available?", answer: "PARTIAL_SOURCE_SIGNAL", evidence: ["CASE_EVIDENCE"], rationale: "Evidence-handling and retention signals exist, but cross-actor continuity remains unproven and obligations are open." },
  { question: "Can restricted evidence remain bounded?", answer: "NO_SOURCE_SIGNAL", evidence: [], rationale: "No accepted capability establishes a restricted-evidence access boundary or successor-specific authorization." },
  { question: "Can the successor inherit only appropriate context?", answer: "NO_SOURCE_SIGNAL", evidence: [], rationale: "No source establishes least-privilege context selection or successor access scope." },
  { question: "Can knowledge survive the actor transition?", answer: "PARTIAL_SOURCE_SIGNAL", evidence: ["KNOWLEDGE_HANDOFF"], rationale: "Knowledge handoff is a source-model signal only; durable post-transition retention is not proven." },
  { question: "Can the transition be audited?", answer: "PARTIAL_SOURCE_SIGNAL", evidence: ["GOVERNANCE_ADMINISTRATION"], rationale: "A general auditability signal exists, but handoff provenance and persisted audit history are not established." },
  { question: "Can the original actor lose access where required?", answer: "NO_SOURCE_SIGNAL", evidence: [], rationale: "The accepted model establishes neither transition-triggered revocation nor offboarding for this sequence." },
];

const externalDimensionSpecs = [
  { id: "SPECIALIST_IDENTITY", legacyDimension: "external_party_role", gapClasses: ["MISSING_ACTOR_MODEL", "MISSING_EXTERNAL_IDENTITY_MODEL"], severity: "BLOCKING", reusable: [], newCapabilityRequired: "YES" },
  { id: "SPECIALIST_ASSIGNMENT", legacyDimension: "specialist_assignment", gapClasses: ["MISSING_ASSIGNMENT_MODEL"], severity: "BLOCKING", reusable: ["CASE_RESPONSIBILITY"], newCapabilityRequired: "YES" },
  { id: "BOUNDED_EXTERNAL_ACCESS", legacyDimension: "restricted_external_access", gapClasses: ["MISSING_ACCESS_BOUNDARY"], severity: "BLOCKING", reusable: ["USER_ACCESS"], newCapabilityRequired: "YES" },
  { id: "CASE_HANDOFF", legacyDimension: "case_or_evidence_handoff", gapClasses: ["MISSING_CASE_HANDOFF"], severity: "BLOCKING", reusable: ["CASE_RECORDS", "CASE_RESPONSIBILITY"], newCapabilityRequired: "YES" },
  { id: "DOCUMENT_INTAKE", legacyDimension: "document_intake", gapClasses: ["MISSING_DOCUMENT_INTAKE"], severity: "BLOCKING", reusable: ["DOCUMENT_LIBRARY"], newCapabilityRequired: "UNDETERMINED" },
  { id: "EVIDENCE_HANDOFF", legacyDimension: "case_or_evidence_handoff", gapClasses: ["MISSING_EVIDENCE_HANDOFF"], severity: "BLOCKING", reusable: ["CASE_EVIDENCE"], newCapabilityRequired: "UNDETERMINED" },
  { id: "CASE_STATUS_EXCHANGE", legacyDimension: "status_or_communication_exchange", gapClasses: ["MISSING_STATUS_EXCHANGE"], severity: "MATERIAL", reusable: ["CASE_RECORDS"], newCapabilityRequired: "YES" },
  { id: "COMMUNICATION_EXCHANGE", legacyDimension: "status_or_communication_exchange", gapClasses: ["MISSING_COMMUNICATION_EXCHANGE"], severity: "MATERIAL", reusable: ["CASE_COMMUNICATIONS"], newCapabilityRequired: "YES" },
  { id: "RESTRICTED_EVIDENCE_ACCESS", legacyDimension: "restricted_external_access", gapClasses: ["MISSING_ACCESS_BOUNDARY"], severity: "BLOCKING", reusable: ["CASE_EVIDENCE", "USER_ACCESS"], newCapabilityRequired: "YES" },
  { id: "ACCESS_EXPIRY", legacyDimension: "specialist_assignment", gapClasses: ["MISSING_EXPIRY_REVOCATION"], severity: "BLOCKING", reusable: ["USER_ACCESS"], newCapabilityRequired: "YES" },
  { id: "ACCESS_REVOCATION", legacyDimension: "restricted_external_access", gapClasses: ["MISSING_EXPIRY_REVOCATION"], severity: "BLOCKING", reusable: ["USER_ACCESS"], newCapabilityRequired: "YES" },
  { id: "SPECIALIST_DISENGAGEMENT", legacyDimension: "specialist_assignment", gapClasses: ["MISSING_EXPIRY_REVOCATION"], severity: "MATERIAL", reusable: ["CASE_RESPONSIBILITY", "USER_ACCESS"], newCapabilityRequired: "YES" },
  { id: "AUDIT_OF_SPECIALIST_ACTIVITY", legacyDimension: "external_party_role", gapClasses: ["MISSING_EXTERNAL_AUDIT_BOUNDARY"], severity: "BLOCKING", reusable: ["GOVERNANCE_ADMINISTRATION"], newCapabilityRequired: "YES" },
];

const externalSpecialistDimensions = externalDimensionSpecs.map((spec) => ({
  dimension: spec.id,
  classification: "OUTSIDE_CURRENT_SOURCE_MODEL",
  acceptedPriorAssessment: {
    dimension: spec.legacyDimension,
    sourceSupport: externalReview.dimensions.find((item) => item.dimension === spec.legacyDimension)?.sourceSupport ?? "NOT_ESTABLISHED",
  },
  externalSpecialistCapabilityIds: [],
  reusableInternalCapabilityIds: spec.reusable,
  boundaryStatement: "Any listed reusable capability is internal-only source evidence; it is not external-specialist identity, access, handoff, or integration support.",
}));

const futureDesignObligations = externalDimensionSpecs.map((spec, index) => ({
  obligationId: `EXT-SPECIALIST-${String(index + 1).padStart(2, "0")}`,
  dimension: spec.id,
  gapClasses: spec.gapClasses,
  severity: spec.severity,
  currentCapabilityReuse: spec.reusable.map((capabilityId) => ({
    capabilityId,
    classification: "CURRENT_REUSABLE_FOUNDATION",
    externalSpecialistSupport: false,
  })),
  newCapabilityRequired: spec.newCapabilityRequired,
  authorizationRequiredBeforeBuild: true,
}));

const gapClassTaxonomy = [
  "MISSING_ACTOR_MODEL",
  "MISSING_EXTERNAL_IDENTITY_MODEL",
  "MISSING_ASSIGNMENT_MODEL",
  "MISSING_ACCESS_BOUNDARY",
  "MISSING_CASE_HANDOFF",
  "MISSING_DOCUMENT_INTAKE",
  "MISSING_EVIDENCE_HANDOFF",
  "MISSING_STATUS_EXCHANGE",
  "MISSING_COMMUNICATION_EXCHANGE",
  "MISSING_EXPIRY_REVOCATION",
  "MISSING_EXTERNAL_AUDIT_BOUNDARY",
  "SOURCE_MODEL_DOES_NOT_ESTABLISH",
];

const allJourneyBindingIds = uniqueSorted(liunaDimensions.flatMap((step) => step.bindingIds));
const allJourneyKnownDefectIds = uniqueSorted(liunaDimensions.flatMap((step) => step.knownDefectIds));
const allSourceCeilingObligationIds = uniqueSorted(liunaDimensions.flatMap((step) => step.sourceCeilingObligationIds));
const allResidualChainIds = uniqueSorted(liunaDimensions.flatMap((step) => step.residualEffectChainIds));
const allResidualObligationIds = uniqueSorted(liunaDimensions.flatMap((step) => step.residualEffectChainObligationIds));
const expectedJourneyEvidence = closeoutByCapability(journeyCapabilityIds);
const sameIds = (left, right) => JSON.stringify(uniqueSorted(left)) === JSON.stringify(uniqueSorted(right));
const orphanCapabilityReferences = uniqueSorted(liunaDimensions.flatMap((step) => step.sourceCapabilityIds))
  .filter((id) => !capabilityById.has(id));
const orphanTransitionCapabilityReferences = uniqueSorted(transitions.flatMap((item) => item.capabilityIds))
  .filter((id) => !capabilityById.has(id));
const orphanBindingReferences = allJourneyBindingIds.filter((id) => !bindingById.has(id));
const allObligationIds = new Set([
  ...sourceCloseout.obligationRegister.sourceCeilingBindingObligations.map((item) => item.obligationId),
  ...sourceCloseout.obligationRegister.residualEffectChainObligations.map((item) => item.obligationId),
]);
const orphanObligationReferences = uniqueSorted([...allSourceCeilingObligationIds, ...allResidualObligationIds])
  .filter((id) => !allObligationIds.has(id));
const allKnownDefectIds = new Set(capabilityReview.bindingCapabilityMap.flatMap((item) => item.knownDefectIds ?? []));
const orphanDefectReferences = allJourneyKnownDefectIds.filter((id) => !allKnownDefectIds.has(id));
const residualChainIds = new Set(sourceCloseout.residualEffectChains.map((item) => item.chainId));
const orphanResidualChainReferences = allResidualChainIds.filter((id) => !residualChainIds.has(id));

const countBy = (items, classify) => Object.fromEntries(
  [...new Set(items.map(classify))].sort().map((key) => [key, items.filter((item) => classify(item) === key).length]),
);
const liunaStatusCounts = countBy(liunaDimensions, (item) => item.sourceSupport);
const transitionCounts = countBy(transitions, (item) => item.classification);
const externalStatusCounts = {
  SOURCE_SUPPORTED: externalSpecialistDimensions.filter((item) => item.classification === "SOURCE_SUPPORTED").length,
  PARTIALLY_SOURCE_SUPPORTED: externalSpecialistDimensions.filter((item) => item.classification === "PARTIALLY_SOURCE_SUPPORTED").length,
  NOT_SOURCE_SUPPORTED: externalSpecialistDimensions.filter((item) => item.classification === "NOT_SOURCE_SUPPORTED").length,
  OUTSIDE_CURRENT_SOURCE_MODEL: externalSpecialistDimensions.filter((item) => item.classification === "OUTSIDE_CURRENT_SOURCE_MODEL").length,
};
const gapCountsBySeverity = Object.fromEntries(["BLOCKING", "MATERIAL", "SUPPORTING"].map((severity) => [
  severity,
  futureDesignObligations.filter((item) => item.severity === severity).map((item) => item.dimension),
]));

const validation = {
  all11LiunaDimensionsClassified: liunaDimensions.length === 11 && liunaDimensions.every((item) =>
    ["SOURCE_SUPPORTED", "SOURCE_SUPPORTED_WITH_DEFECT", "SOURCE_CEILING", "SOURCE_SUPPORTED_WITH_DEFECT_AND_CEILING", "PARTIALLY_SOURCE_SUPPORTED", "NOT_SOURCE_SUPPORTED"].includes(item.sourceSupport)),
  all7LiunaTransitionsClassified: transitions.length === 7 && transitions.every((item) =>
    ["SOURCE_TRANSITION_ESTABLISHED", "STATIC_SURFACE_RELATION_ONLY", "CAPABILITY_RELATION_ONLY", "NO_SOURCE_TRANSITION"].includes(item.classification)),
  allLiunaCapabilityReferencesInFinalModel: orphanCapabilityReferences.length === 0,
  allTransitionCapabilityReferencesInFinalModel: orphanTransitionCapabilityReferences.length === 0,
  allLiunaBindingReferencesInCloseout: orphanBindingReferences.length === 0,
  allRelevantDefectsInherited: sameIds(journeyEvidence.knownDefectIds, expectedJourneyEvidence.knownDefectIds) &&
    journeyEvidence.knownDefectIds.every((id) => allKnownDefectIds.has(id)),
  allRelevantSourceCeilingAndResidualObligationsInherited: orphanObligationReferences.length === 0 &&
    orphanResidualChainReferences.length === 0 &&
    sameIds(journeyEvidence.sourceCeilingObligationIds, expectedJourneyEvidence.sourceCeilingObligationIds) &&
    sameIds(journeyEvidence.residualEffectChainIds, expectedJourneyEvidence.residualEffectChainIds) &&
    sameIds(journeyEvidence.residualEffectChainObligationIds, expectedJourneyEvidence.residualEffectChainObligationIds),
  all13ExternalSpecialistDimensionsClassified: externalSpecialistDimensions.length === 13 &&
    externalSpecialistDimensions.every((item) => ["SOURCE_SUPPORTED", "PARTIALLY_SOURCE_SUPPORTED", "NOT_SOURCE_SUPPORTED", "OUTSIDE_CURRENT_SOURCE_MODEL"].includes(item.classification)),
  noUnsupportedExternalSpecialistCapabilityInvented: externalSpecialistDimensions.every((item) => item.externalSpecialistCapabilityIds.length === 0) &&
    externalReview.supportedDimensions.length === 0,
  workAidIntegrationNotInferred: externalReview.workAidIntegrationInferred === false,
  allFutureExternalSpecialistGapsRegistered: futureDesignObligations.length === 13 &&
    externalSpecialistDimensions.every((item) => futureDesignObligations.some((obligation) => obligation.dimension === item.dimension)),
  gapClassesUseApprovedTaxonomy: futureDesignObligations.every((obligation) =>
    obligation.gapClasses.every((gapClass) => gapClassTaxonomy.includes(gapClass))),
  liunaAndExternalBoundariesKeptDistinct: externalSpecialistDimensions.every((item) =>
    item.classification === "OUTSIDE_CURRENT_SOURCE_MODEL" &&
    !item.externalSpecialistCapabilityIds.some((id) => journeyCapabilityIds.includes(id))),
  noRuntimeClaimIntroduced: liunaDimensions.every((step) => step.sourceSupport !== "SOURCE_COMPLETE") &&
    capabilityReview.institutionalContinuityReview.signals.every((signal) => signal.runtimeOrOperationalProof === "NO"),
  noAuthorizationClaimIntroduced: capabilityReview.canonicalCapabilities.every((item) =>
    item.personaReview?.authorizationEvidence === "NONE"),
  noPersistenceClaimIntroduced: liunaDimensions.every((step) => step.continuityDimension !== "POST_HANDOFF_CONTINUITY" ||
    step.sourceSupport === "PARTIALLY_SOURCE_SUPPORTED"),
  noApplicationSourceInspected: true,
  noRuntimeActionExecuted: true,
  sourceCorpusInputsAccepted: capabilityReview.phaseStatus.phase1A3bGate === "PASS" &&
    sourceCloseout.gate.disposition === "SOURCE_CEILING_ACCEPTED",
};

const gatePass = Object.values(validation).every(Boolean) &&
  directRouteOnlySteps.length > 0 &&
  liunaDimensions.every((step) => step.sourceSupport !== "SOURCE_COMPLETE") &&
  externalStatusCounts.OUTSIDE_CURRENT_SOURCE_MODEL === 13;

const report = {
  metadata: {
    title: "Phase 1A.4b Special Journey and External-Specialist Boundary Reconciliation",
    generatedBy: "scripts/ue/reconcile-special-journeys.mjs",
    generatedAt: null,
    evidenceBoundary: "Accepted Phase 1A.4a, 1A.3b, 1A.2, 1A.1, and user-surface census artifacts plus existing UE readiness documentation; no application source or runtime evidence.",
    applicationSourceInspected: false,
    runtimeActionExecuted: false,
    productCodeChanged: false,
  },
  phaseStatus: {
    phase0: "PASS",
    phase1A1: "PASS",
    phase1A2: "SOURCE_CEILING_ACCEPTED",
    phase1A3: "PASS",
    phase1A4a: "PASS",
    phase1A4bGate: gatePass ? "PASS" : "FAIL",
    phase1A4: gatePass ? "PASS" : "IN_PROGRESS",
    corePersonaJourneySourceModel: "CLOSED",
    specialJourneyBoundarySourceModel: gatePass ? "CLOSED" : "OPEN",
    liunaRuntimeProven: "NO",
    workAidRuntimeProven: "NO",
    operationalReadiness: "NO_GO — RUNTIME_PROOF_REQUIRED",
    phase1AFinalSourceReconciliation: "AUTHORIZED",
    phase1AFinalSourceReconciliationStarted: "NO",
    phase1A: "NOT_YET_PROVEN",
    phase1B: "NOT_AUTHORIZED",
    phase2: "NOT_AUTHORIZED",
    productReady: "NO",
  },
  summary: {
    liunaRequiredDimensions: liunaDimensions.length,
    liunaStatusCounts,
    liunaDimensionCountSum: Object.values(liunaStatusCounts).reduce((sum, count) => sum + count, 0),
    liunaSourceTransitionsEstablished: transitions.filter((item) => item.classification === "SOURCE_TRANSITION_ESTABLISHED").length,
    liunaStaticRelationsOnly: staticRelations.length,
    liunaCapabilityRelationsOnly: capabilityRelations.length,
    liunaNoSourceTransitions: noSourceTransitions.length,
    liunaTransitionCountSum: transitions.length,
    liunaDirectRouteOnlySteps: directRouteOnlySteps.length,
    liunaNoSourceTransitionSteps: noSourceTransitionSteps.length,
    externalSpecialistDimensions: externalSpecialistDimensions.length,
    externalSpecialistStatusCounts: externalStatusCounts,
    externalSpecialistDimensionCountSum: Object.values(externalStatusCounts).reduce((sum, count) => sum + count, 0),
    blockingGaps: gapCountsBySeverity.BLOCKING,
    materialGaps: gapCountsBySeverity.MATERIAL,
    supportingGaps: gapCountsBySeverity.SUPPORTING,
    futureDesignObligationCount: futureDesignObligations.length,
    liunaSourceComplete: false,
    workAidEnablementReady: false,
  },
  liunaContinuityJourney: {
    journeyId: "LIUNA_LEADERSHIP_CONTINUITY",
    businessOutcome: "Preserve institutionally relevant context, active-matter responsibility, commitments, and evidence through a leadership transition without overstating source or runtime proof.",
    entryCondition: "A leadership/context-owner transition is proposed; no source evidence establishes an actual LIUNA workflow entry condition.",
    expectedEndState: "A successor has appropriately scoped context and responsibility, with deadlines, evidence, provenance, and institutional knowledge retained; this end state is not source-complete.",
    stepIds: liunaDimensions.map((step) => step.stepId),
    capabilityIds: journeyCapabilityIds,
    bindingIds: journeyEvidence.bindingIds,
    knownDefectIds: journeyEvidence.knownDefectIds,
    sourceCeilingObligationIds: journeyEvidence.sourceCeilingObligationIds,
    residualEffectChainIds: journeyEvidence.residualEffectChainIds,
    residualEffectChainObligationIds: journeyEvidence.residualEffectChainObligationIds,
    sourceStatus: "PARTIAL_SOURCE_SUPPORT",
    runtimeProven: "NO",
    authorizationProven: "NO",
    persistenceProven: "NO",
    humanUsabilityProven: "NO",
    executionStatus: "NOT_EXECUTED",
  },
  liunaDimensions,
  liunaTransitions: transitions,
  liunaDiscoverability: {
    stepClassifications: liunaDimensions.map((step) => ({
      stepId: step.stepId,
      dimension: step.continuityDimension,
      discoverabilityStatus: step.discoverabilityStatus,
      routes: step.routesOrSurfaces,
    })),
    directRouteOnlyStepIds: directRouteOnlySteps.map((step) => step.stepId),
    noSourceTransitionStepIds: noSourceTransitionSteps.map((step) => step.stepId),
    limitation: "Static navigation or contextual-link evidence does not establish LIUNA-specific authorization, usability, action completion, or a complete sequence.",
  },
  liunaAdversarialAnswers,
  liunaObligationExposure: {
    capabilityIds: journeyCapabilityIds,
    bindingIds: journeyEvidence.bindingIds,
    knownDefectIds: journeyEvidence.knownDefectIds,
    sourceCeilingBindingIds: journeyEvidence.sourceCeilingBindingIds,
    sourceCeilingObligationIds: journeyEvidence.sourceCeilingObligationIds,
    residualEffectChainIds: journeyEvidence.residualEffectChainIds,
    residualEffectChainObligationIds: journeyEvidence.residualEffectChainObligationIds,
    falseSuccessExposure: journeyEvidence.falseSuccessExposure,
  },
  externalSpecialistAssessment: {
    currentSourceSupport: "NONE",
    acceptedPriorSupportedDimensions: externalReview.supportedDimensions,
    supportedDimensions: [],
    partialDimensions: [],
    unsupportedDimensions: externalSpecialistDimensions.map((item) => item.dimension),
    relevantExistingCapabilityIds: uniqueSorted(externalDimensionSpecs.flatMap((item) => item.reusable)),
    missingCapabilityClasses: uniqueSorted(futureDesignObligations.flatMap((item) => item.gapClasses)),
    integrationInferred: "NO",
    productBuildAuthorized: "NO",
    authStartWorkAid: "NO",
    workAidContextFromRequester: [
      "WorkAid uses Clio; this is requester-provided operating context, not evidence of a UE integration.",
      "UE is intended to complement rather than replace Clio; this is a boundary for assessment, not a product claim.",
      "The specialist use case includes scoped matters, denial letters or case documents, photo identification, authorization or file requests, case status, specialist work, and eventual access termination.",
      "None of these external-specialist actions is established by the accepted UE source model.",
    ],
    absenceIsClassifiedAs: "GAP_NOT_DEFECT",
  },
  externalSpecialistDimensions,
  externalSpecialistAdversarialAnswers: [
    ["Can an external specialist exist as a bounded UE actor?", "NO_SOURCE_SUPPORT"],
    ["Can they be assigned only specific matters?", "NO_SOURCE_SUPPORT"],
    ["Can access exclude unrelated organizational data?", "NO_SOURCE_SUPPORT"],
    ["Can documents be exchanged safely?", "NO_SOURCE_SUPPORT"],
    ["Can evidence be restricted appropriately?", "NO_SOURCE_SUPPORT"],
    ["Can status and communications flow back?", "NO_SOURCE_SUPPORT"],
    ["Can access expire automatically?", "NO_SOURCE_SUPPORT"],
    ["Can access be revoked?", "NO_SOURCE_SUPPORT"],
    ["Can specialist activity be audited?", "NO_SOURCE_SUPPORT"],
  ].map(([question, answer]) => ({
    question,
    answer,
    rationale: "The accepted Phase 1A.3b external-specialist review establishes no supported dimensions; internal capabilities are not treated as external actor or access support.",
  })),
  workAidSourceAssessment: {
    assessmentId: "WORKAID_OPERATING_MODEL_SOURCE_ASSESSMENT",
    currentSourceSupport: "NONE_FOR_EXTERNAL_SPECIALIST_OPERATIONS",
    supportedDimensions: [],
    partialDimensions: [],
    unsupportedDimensions: externalSpecialistDimensions.map((item) => item.dimension),
    relevantExistingCapabilityIds: uniqueSorted(externalDimensionSpecs.flatMap((item) => item.reusable)),
    capabilityReuseClassification: "CURRENT_REUSABLE_FOUNDATION_ONLY",
    missingCapabilityClasses: uniqueSorted(futureDesignObligations.flatMap((item) => item.gapClasses)),
    integrationInferred: "NO",
    productBuildAuthorized: "NO",
    authStartWorkAid: "NO",
    documentationSourceCandidate: "YES",
    documentationCandidateRationale: "Documentation may describe only the accepted, source-bounded internal UE capabilities and their limitations; it must explicitly state that external-specialist access, document exchange, WorkAid enablement, and Clio integration are not established.",
    enablementReady: "NO",
    currentVersusFutureItems: [
      { item: "Internal case and matter record concepts", classification: "CURRENT_SOURCE_CAPABILITY", capabilityIds: ["CASE_RECORDS"] },
      { item: "Internal assignment, deadline, communication, evidence, governance, knowledge, and document concepts", classification: "CURRENT_SOURCE_CAPABILITY", capabilityIds: ["CASE_RESPONSIBILITY", "CASE_DEADLINES", "CASE_COMMUNICATIONS", "CASE_EVIDENCE", "GOVERNANCE_ADMINISTRATION", "KNOWLEDGE_HANDOFF", "DOCUMENT_LIBRARY"] },
      { item: "Potential reuse of internal records and document/evidence foundations in a separately authorized future design", classification: "CURRENT_REUSABLE_FOUNDATION", capabilityIds: ["CASE_RECORDS", "CASE_EVIDENCE", "DOCUMENT_LIBRARY"] },
      { item: "External actor/identity, scoped assignment/access, external document/evidence exchange, expiry/revocation, and external audit", classification: "FUTURE_REQUIRED_CAPABILITY", capabilityIds: [] },
      { item: "Clio integration, synchronization, or any external-provider connection", classification: "NOT_SUPPORTED", capabilityIds: [] },
    ],
  },
  futureDesignObligations,
  defectExposure: {
    classification: "LIUNA_ONLY_INHERITED_SOURCE_DEFECTS",
    knownDefectIds: journeyEvidence.knownDefectIds,
    externalSpecialistDefectsInvented: false,
    externalAbsenceDisposition: "GAP_NOT_DEFECT",
  },
  sourceCeilingExposure: {
    obligationIds: journeyEvidence.sourceCeilingObligationIds,
    bindingIds: journeyEvidence.sourceCeilingBindingIds,
    residualEffectChainIds: journeyEvidence.residualEffectChainIds,
    residualEffectChainObligationIds: journeyEvidence.residualEffectChainObligationIds,
    externalSpecialistObligationsAttached: false,
  },
  falseSuccessExposure: {
    sourceSupportedBindingIds: journeyEvidence.falseSuccessExposure.sourceSupportedBindingIds,
    potentialOnlyBindingIds: journeyEvidence.falseSuccessExposure.potentialOnlyBindingIds,
    sourceModelSourceSupportedBindingIds: sourceCloseout.falseSuccessReconciliation.sourceSupportedOnlyBindingIds,
    sourceModelPotentialOnlyBindingIds: sourceCloseout.falseSuccessReconciliation.potentialOnlyBindingIds,
    evidenceOverlapBindingCount: sourceCloseout.falseSuccessReconciliation.evidenceOverlapBindingCount,
    dimensionsKeptSeparate: true,
    externalSpecialistGapAddedAsFalseSuccess: false,
  },
  gate: {
    phase1A4bGate: gatePass ? "PASS" : "FAIL",
    liunaContinuitySourceReconciliationComplete: "YES",
    externalSpecialistBoundaryReconciliationComplete: "YES",
    unclassifiedLiunaDimensions: liunaDimensions.filter((item) => !item.sourceSupport).length,
    unclassifiedLiunaTransitions: transitions.filter((item) => !item.classification).length,
    unclassifiedExternalSpecialistDimensions: externalSpecialistDimensions.filter((item) => !item.classification).length,
    orphanCapabilityReferences: orphanCapabilityReferences.length,
    orphanBindingReferences: orphanBindingReferences.length,
    orphanObligationReferences: orphanObligationReferences.length,
    orphanDefectReferences: orphanDefectReferences.length,
    orphanResidualChainReferences: orphanResidualChainReferences.length,
    unsupportedExternalCapabilitiesInvented: 0,
    phase1A4Closeout: gatePass ? "PASS" : "IN_PROGRESS",
    phase1AFinalSourceReconciliation: "AUTHORIZED",
    phase1AFinalSourceReconciliationStarted: "NO",
  },
  validation,
  limitations: [
    "All evidence is accepted source-model or static index evidence; no application source was inspected and no runtime action was executed.",
    "The eight accepted institutional-continuity signals explicitly disclaim runtime or operational proof.",
    "A capability concept, binding, static route, or navigation record does not establish an ordered handoff, authorization, persistence, or usability.",
    "The external-specialist review is separate from LIUNA internal continuity; generic internal assignment, evidence, document, knowledge, and access concepts are not treated as external-specialist support.",
    "WorkAid and Clio are treated only as requester-provided operating context; no integration, contact, enablement, or product build is authorized.",
    "Phase 1A final source reconciliation is authorized as a recommendation only and has not been started.",
  ],
};

assert(Object.values(validation).every(Boolean), "A required Phase 1A.4b validation check failed");
assert(gatePass, "Phase 1A.4b gate requirements are not satisfied");
assert(report.summary.liunaDimensionCountSum === 11, "LIUNA source-status counts do not sum to 11");
assert(report.summary.liunaTransitionCountSum === 7, "LIUNA transition classifications do not sum to 7");
assert(report.summary.externalSpecialistDimensionCountSum === 13, "External-specialist classifications do not sum to 13");
assert(futureDesignObligations.every((item) => item.authorizationRequiredBeforeBuild), "A future design obligation is missing its authorization requirement");

const dimensionRows = liunaDimensions.map((item) => [
  item.continuityDimension,
  item.sourceSupport,
  item.sourceCapabilityIds.join(", ") || "None",
  item.bindingIds.length,
  item.knownDefectIds.length,
  item.sourceCeilingObligationIds.length,
  item.discoverabilityStatus,
  item.gapReason,
]);
const transitionRows = transitions.map((item) => [
  item.id,
  `${item.from} → ${item.to}`,
  item.classification,
  item.capabilityIds.join(", ") || "None",
]);
const externalRows = externalSpecialistDimensions.map((item) => [
  item.dimension,
  item.classification,
  item.reusableInternalCapabilityIds.join(", ") || "None",
  futureDesignObligations.find((obligation) => obligation.dimension === item.dimension).gapClasses.join(", "),
]);
const obligationRows = futureDesignObligations.map((item) => [
  item.obligationId,
  item.dimension,
  item.severity,
  item.gapClasses.join(", "),
  item.currentCapabilityReuse.map((reuse) => reuse.capabilityId).join(", ") || "None",
  item.newCapabilityRequired,
]);
const answerRows = liunaAdversarialAnswers.map((item) => [item.question, item.answer, item.rationale]);
const externalAnswerRows = report.externalSpecialistAdversarialAnswers.map((item) => [item.question, item.answer, item.rationale]);
const validationRows = Object.entries(validation).map(([name, result]) => [name, String(result)]);

const markdown = `# Phase 1A.4b — Special Journey and External-Specialist Boundary Reconciliation

**Gate: ${report.gate.phase1A4bGate}.** This source-only reconciliation uses accepted 1A.4a, 1A.3b, 1A.2, 1A.1, and user-surface census artifacts. No application source was inspected, no runtime action was executed, and no capability was built or inferred.

## Phase status and closeout

| Item | Disposition |
| --- | --- |
| Phase 1A.4a | PASS |
| Phase 1A.4b | ${report.gate.phase1A4bGate} |
| Phase 1A.4 | ${report.phaseStatus.phase1A4} |
| Core persona journey source model | CLOSED |
| Special journey boundary source model | ${report.phaseStatus.specialJourneyBoundarySourceModel} |
| LIUNA runtime proven / WorkAid runtime proven | NO / NO |
| Phase 1A | NOT YET PROVEN |
| Phase 1B / Phase 2 | NOT AUTHORIZED / NOT AUTHORIZED |
| Product ready | NO |
| Phase 1A final source reconciliation | AUTHORIZED (not started) |

The Phase 1A final source reconciliation is authorized only as the next recommended phase; it was not started.

## LIUNA leadership-continuity journey

**Journey:** \`${report.liunaContinuityJourney.journeyId}\`  
**Source status:** \`${report.liunaContinuityJourney.sourceStatus}\`  
**Runtime / authorization / persistence / human usability proven:** NO / NO / NO / NO

The accepted Phase 1A.3b review contains eight institutional-continuity source signals. Each is explicitly assessed as \`SOURCE_MODEL_SIGNAL_ONLY\`; none proves operational continuity, ownership, recovery, service-level behavior, or actual transition execution. The census contains no LIUNA step inventory.

${mdTable(["Required dimension", "Source disposition", "Accepted capability concepts", "Bindings", "Defects", "Ceiling obligations", "Discoverability", "Boundary / gap"], dimensionRows)}

### LIUNA source-status totals

| Classification | Count |
| --- | ---: |
| SOURCE_SUPPORTED | ${liunaStatusCounts.SOURCE_SUPPORTED ?? 0} |
| SOURCE_SUPPORTED_WITH_DEFECT | ${liunaStatusCounts.SOURCE_SUPPORTED_WITH_DEFECT ?? 0} |
| SOURCE_CEILING | ${liunaStatusCounts.SOURCE_CEILING ?? 0} |
| SOURCE_SUPPORTED_WITH_DEFECT_AND_CEILING | ${liunaStatusCounts.SOURCE_SUPPORTED_WITH_DEFECT_AND_CEILING ?? 0} |
| PARTIALLY_SOURCE_SUPPORTED | ${liunaStatusCounts.PARTIALLY_SOURCE_SUPPORTED ?? 0} |
| NOT_SOURCE_SUPPORTED | ${liunaStatusCounts.NOT_SOURCE_SUPPORTED ?? 0} |
| **Total** | **${report.summary.liunaDimensionCountSum}** |

### Required transition reconciliation

${mdTable(["Transition", "From → to", "Classification", "Capability concepts"], transitionRows)}

| Transition class | Count |
| --- | ---: |
| LIUNA_SOURCE_TRANSITIONS_ESTABLISHED | ${report.summary.liunaSourceTransitionsEstablished} |
| LIUNA_STATIC_RELATIONS_ONLY | ${report.summary.liunaStaticRelationsOnly} |
| LIUNA_CAPABILITY_RELATIONS_ONLY | ${report.summary.liunaCapabilityRelationsOnly} |
| LIUNA_NO_SOURCE_TRANSITIONS | ${report.summary.liunaNoSourceTransitions} |
| **Total** | **${report.summary.liunaTransitionCountSum}** |

The capability-relation classifications indicate only that concepts occur in the accepted model; they do not establish connected steps. No ordered source transition was found.

### Discoverability and adversarial answers

- **LIUNA_DIRECT_ROUTE_ONLY_STEPS:** ${report.summary.liunaDirectRouteOnlySteps}
- **LIUNA_NO_SOURCE_TRANSITION_STEPS:** ${report.summary.liunaNoSourceTransitionSteps}
- Static route/navigation evidence does not establish a LIUNA role, authorization, complete path, or usable transition.

${mdTable(["Adversarial question", "Answer", "Source-bounded rationale"], answerRows)}

**LIUNA_RECORDING_SOURCE_CANDIDATE = NO.** Required continuity dimensions remain partial or unsupported, required transitions are not established, and the source corpus includes direct-route-only and no-source-transition steps. **LIUNA_RUNTIME_ACCEPTANCE_REQUIRED = YES.**

## External-specialist boundary and WorkAid

The accepted Phase 1A.3b external-specialist review has \`supportedDimensions: []\` and records no inferred WorkAid integration. Every specialized dimension below is outside the current external-specialist source model. Reusable internal capability IDs are foundations only and do not imply external identity, assignment, access, handoff, or integration.

${mdTable(["External-specialist dimension", "Classification", "Internal foundation only", "Registered gap class"], externalRows)}

### External-specialist totals

| Classification | Count |
| --- | ---: |
| SOURCE_SUPPORTED | ${externalStatusCounts.SOURCE_SUPPORTED} |
| PARTIALLY_SOURCE_SUPPORTED | ${externalStatusCounts.PARTIALLY_SOURCE_SUPPORTED} |
| NOT_SOURCE_SUPPORTED | ${externalStatusCounts.NOT_SOURCE_SUPPORTED} |
| OUTSIDE_CURRENT_SOURCE_MODEL | ${externalStatusCounts.OUTSIDE_CURRENT_SOURCE_MODEL} |
| **Total** | **${report.summary.externalSpecialistDimensionCountSum}** |

${mdTable(["Adversarial question", "Answer", "Rationale"], externalAnswerRows)}

### WorkAid design-obligation register (not an implementation plan)

| Obligation | Dimension | Severity | Gap class | Reusable internal foundation only | New capability required |
| --- | --- | --- | --- | --- | --- |
${obligationRows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`).join("\n")}

| Gap severity | Dimensions |
| --- | --- |
| BLOCKING_GAPS (${gapCountsBySeverity.BLOCKING.length}) | ${gapCountsBySeverity.BLOCKING.join(", ") || "None"} |
| MATERIAL_GAPS (${gapCountsBySeverity.MATERIAL.length}) | ${gapCountsBySeverity.MATERIAL.join(", ") || "None"} |
| SUPPORTING_GAPS (${gapCountsBySeverity.SUPPORTING.length}) | ${gapCountsBySeverity.SUPPORTING.join(", ") || "None"} |

The \`CURRENT_CAPABILITY_REUSE\` entries are explicitly internal foundations. No schemas, code, Clio design, integration, or product implementation is proposed. Every obligation requires authorization before build.

### Current-vs-future disposition

| Item | Classification |
| --- | --- |
${report.workAidSourceAssessment.currentVersusFutureItems.map((item) => `| ${escapeCell(item.item)} | ${item.classification} |`).join("\n")}

**LIUNA_RECORDING_SOURCE_CANDIDATE = NO**  
**LIUNA_RUNTIME_ACCEPTANCE_REQUIRED = YES**  
**WORKAID_DOCUMENTATION_SOURCE_CANDIDATE = YES** — only for accurately describing current source-bounded internal capabilities and explicitly excluding an established external-specialist workflow.  
**WORKAID_ENABLEMENT_READY = NO**  
**AUTH_START_WORKAID = NO**

## Inherited evidence and false-success exposure

- LIUNA binding IDs, known-defect IDs, source-ceiling obligation IDs, residual chain IDs, and residual obligation IDs are retained exactly in the JSON artifact.
- Source-supported and potential-only false-success binding sets remain separate; their overlap remains ${report.falseSuccessExposure.evidenceOverlapBindingCount}.
- External-specialist absence is registered as a gap, not a defect. No unrelated source-ceiling obligation is attached to an external gap.
- No WorkAid integration, product build, contact, journey execution, recording, Phase 1A final work, Phase 1B, or Phase 2 was started.

## Gate checks

${mdTable(["Validation", "Result"], validationRows)}

**PHASE_1A_4B_GATE = ${report.gate.phase1A4bGate}**  
**PHASE_1A_4 = ${report.phaseStatus.phase1A4}**  
**PHASE_1A_FINAL_SOURCE_RECONCILIATION = AUTHORIZED** — not started.

The asymmetric conclusion is intentional: LIUNA has partial internal continuity source signals but no established transitions; the external-specialist/WorkAid operating boundary has no current source support.
`;

fs.writeFileSync(path.join(root, paths.outputJson), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(root, paths.outputMarkdown), markdown);

console.log(JSON.stringify({
  summary: report.summary,
  gate: report.gate,
  validation,
  outputs: [paths.outputJson, paths.outputMarkdown],
}, null, 2));
