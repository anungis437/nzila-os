import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const inputPath = "docs/union-eyes/reality-remediation/PHASE_1A_3A_BUSINESS_CAPABILITY_MODEL.json";
const closeoutPath = "docs/union-eyes/reality-remediation/PHASE_1A_2_FINAL_SOURCE_CLOSEOUT.json";
const outputJsonPath = "docs/union-eyes/reality-remediation/PHASE_1A_3B_CAPABILITY_COHERENCE_REVIEW.json";
const outputMarkdownPath = "docs/union-eyes/reality-remediation/PHASE_1A_3B_CAPABILITY_COHERENCE_REVIEW.md";
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const sorted = (values) => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const countBy = (values, key) => {
  const counts = {};
  for (const value of values) counts[key(value)] = (counts[key(value)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
};
const model = readJson(inputPath);
const closeout = readJson(closeoutPath);
assert(model.phaseStatus.phase1A3aGate === "PASS", "The accepted Phase 1A.3a source model is not PASS");
assert(model.capabilities.length === 33, "Expected 33 original Phase 1A.3a capabilities");
assert(model.bindingCapabilityMap.length === 644, "Expected 644 original canonical bindings");
assert(model.legacyRegistryReconciliation.length === 31, "Expected 31 legacy registry rows");
assert(closeout.bindings.length === 644, "Supporting closeout does not contain 644 bindings");

const decision = {
  MEMBER_RECORDS: ["RENAME", "Maintain member records", "Rename to describe the institutional outcome; education certificate actions are reassigned to learning/training."],
  ORGANIZATION_STRUCTURE: ["CONFIRMED", "Maintain organizational structure", "Organization hierarchy, organization records, bulk operations, and organization settings form one coherent administrative ability; after 14 evidence-based transfers from reporting, its 73-binding breadth remains broad and its high ceiling exposure is retained."],
  USER_ACCESS: ["RENAME", "Administer user accounts and access", "Identity, invitation, profile, and sharing-control work belongs to access administration, distinct from the member-record outcome."],
  CASE_RECORDS: ["RENAME", "Manage grievance and claim matters", "The shared matter lifecycle is coherent; case records remain distinct from assignments, deadlines, communication, and evidence."],
  CASE_RESPONSIBILITY: ["RENAME", "Assign responsibility for case and operational work", "Assignment is a distinct continuity outcome, not merely a case-screen action; the named action evidence also covers dispatch/work queues."],
  CASE_DEADLINES: ["RENAME", "Calculate matter deadlines", "Two related deadline-calculation actions support a narrow capability; one binding has a known defect and remains attached."],
  CASE_COMMUNICATIONS: ["CONFIRMED", "Record matter-related communications", "Case-associated correspondence is distinct from organization-wide communication."],
  CASE_EVIDENCE: ["CONFIRMED", "Capture and manage case evidence", "Evidence handling is a coherent case-support outcome and remains distinct from the general document library."],
  COLLECTIVE_BARGAINING: ["RENAME", "Develop collective-agreement positions", "Agreement exploration, clause comparison, and proposal/review work form a coherent bargaining ability; AI assistance remains a subordinate support overlay."],
  CALENDAR_MEETINGS: ["RENAME", "Manage calendars, meetings, and institutional events", "Calendar and event creation, update, selection, and synchronization are one lifecycle, not separate screen-level abilities."],
  GOVERNANCE_ADMINISTRATION: ["CONFIRMED", "Administer union governance", "Committee, vote, oversight, and reserved-matter work shares a governance outcome; no separate capability is justified by UI division alone."],
  ELECTIONS: ["CONFIRMED", "Administer elections and ballot participation", "Election setup and ballot participation form a coherent bounded institutional outcome."],
  HEALTH_SAFETY_CASES: ["RENAME", "Manage workplace health and safety matters", "Incident, hazard, inspection, and corrective-action workflows are a coherent domain and remain separate from general grievances."],
  ORGANIZING_CAMPAIGNS: ["RENAME", "Coordinate organizing campaigns and engagement", "Campaign, target, and campaign-note actions form one organizing ability; communication delivery is not independently inferred."],
  MEMBER_DUES_SELF_SERVICE: ["CONFIRMED", "Review member dues and payment records", "Member-facing balance, deduction, receipt, and payment-selection actions are distinct from institutional remittance administration; no payment completion is inferred."],
  DUES_REMITTANCE_ADMIN: ["CONFIRMED", "Administer dues and remittance records", "Institutional calculation, reconciliation, and reporting work is a distinct actor/outcome from member self-service."],
  FINANCIAL_PLANNING: ["RENAME", "Plan organizational finances and expenses", "Budget, expense, vendor, and forecast work is coherent and distinct from member dues and remittance."],
  GENERAL_COMMUNICATIONS: ["RENAME", "Manage organizational communications and surveys", "Distribution lists, templates, communication preferences, and survey response actions are one communication domain; case communications remain separate."],
  ARBITRATION_PRECEDENT_KNOWLEDGE: ["RENAME", "Maintain arbitration precedent and jurisdiction knowledge", "Precedent and jurisdiction preference work is one coherent knowledge ability, separate from bargaining-position development."],
  DOCUMENT_LIBRARY: ["RENAME", "Manage institutional documents", "General document-library actions are distinct from evidence attached to a matter."],
  LEARNING_TRAINING: ["DEMOTE_TO_SUPPORTING", "Support member learning and training", "Course and certificate access is a real but supporting service; three certificate actions are moved here from member-record administration."],
  KNOWLEDGE_HANDOFF: ["CONFIRMED", "Preserve and transfer institutional knowledge", "Memory-holder, context, and succession actions provide an explicit knowledge-transfer outcome."],
  INSTITUTIONAL_REPORTING: ["SPLIT", "Generate institutional reports and analytics", "The existing mapping mixed analytics with organization CRUD, app configuration, user profile/access, privacy/compliance, recognition, and workplace-risk reporting. Those named binding groups are reassigned to existing coherent capabilities; no new capability is added."],
  PILOT_ADMINISTRATION: ["CONFIRMED", "Coordinate pilot onboarding and administration", "Pilot application, onboarding, feedback, and readiness actions are a bounded supporting administrative service."],
  PUBLIC_INQUIRIES: ["CONFIRMED", "Receive public inquiries and pilot requests", "Public contact and pilot-request submission is a narrow but distinct external-facing outcome."],
  WORKPLACE_RISK_ASSESSMENT: ["RENAME", "Complete workplace risk assessments and reports", "ICRA assessment and associated report actions form one bounded assessment outcome; source audience tags do not establish authorization."],
  MEMBER_RECOGNITION: ["RENAME", "Administer member recognition and rewards", "Nomination/redemption and rewards-administration actions share the recognition outcome; the admin store path is reassigned here."],
  TRUSTEE_PENSION_PORTAL: ["REMOVE_NON_CAPABILITY", null, "The only mapped record is a single inline event under a trustee portal page, with an unconfirmed handler and no evidenced institutional operation. A page/portal label plus one binding does not establish a capability; its B1 obligation remains explicitly retained as non-business assurance."],
  ORGANIZATION_RISK_CONTROLS: ["RENAME", "Record privacy, consent, and compliance actions", "The marketing consent/revocation and compliance actions are narrow supporting controls, not a broad compliance-management suite."],
  WORK_COORDINATION: ["RENAME", "Coordinate workbench queues", "The three workbench actions describe a narrow operational coordination aid and remain supporting; they are not inflated into a case-management capability."],
  APPLICATION_ADMINISTRATION: ["RENAME", "Configure and administer the application", "Platform settings, maintenance, and administrative operations form a supporting system-administration ability."],
  AI_CASE_ASSISTANCE: ["RENAME", "AI-assisted case and steward support", "This is a supporting decision-assistance overlay on case work, not a second case-management capability; provider/output behavior remains unproven."],
  AI_COLLECTIVE_AGREEMENT_ASSISTANCE: ["RENAME", "AI-assisted collective-agreement analysis", "This is a supporting analysis overlay on collective bargaining, not a second bargaining capability; provider/output behavior remains unproven."],
};
const finalNameById = Object.fromEntries(Object.entries(decision).map(([id, [, name]]) => [id, name]));
const capabilityById = new Map(model.capabilities.map((capability) => [capability.capabilityId, capability]));
assert(Object.keys(decision).length === model.capabilities.length, "Every original capability must receive exactly one disposition");
assert(model.capabilities.every((capability) => decision[capability.capabilityId]), "A capability has no adjudication");

const capabilityBindings = new Map(model.capabilities.map((capability) => [capability.capabilityId, new Set()]));
const capabilityIdsByBinding = new Map();
const bindingClassification = new Map();
const originalBindingById = new Map(model.bindingCapabilityMap.map((binding) => [binding.bindingId, binding]));
const transferReasons = new Map();
const nonBusinessAdditions = new Map();
const transfer = (bindingId, target, reason) => {
  assert(originalBindingById.has(bindingId), `Transfer refers to unknown binding ${bindingId}`);
  assert(capabilityIdsByBinding.has(bindingId) === false, `Binding was normalized more than once: ${bindingId}`);
  if (target === "NON_BUSINESS_OR_INACTIVE") {
    bindingClassification.set(bindingId, target);
    capabilityIdsByBinding.set(bindingId, []);
    nonBusinessAdditions.set(bindingId, reason);
  } else {
    assert(capabilityBindings.has(target), `Transfer target does not exist: ${target}`);
    bindingClassification.set(bindingId, "BUSINESS_BINDING_MAPPED");
    capabilityIdsByBinding.set(bindingId, [target]);
    capabilityBindings.get(target).add(bindingId);
  }
  transferReasons.set(bindingId, { fromCapabilityId: originalBindingById.get(bindingId).capabilityIds[0], toCapabilityId: target, reason });
};

const sourceTransferRules = [
  {
    match: (file) => /\/dashboard\/admin\/organizations\//i.test(file) ||
      /\/dashboard\/settings\/_components\/org-settings-content\.tsx$/i.test(file),
    target: "ORGANIZATION_STRUCTURE",
    reason: "Accepted source path and action-family identity identify organization records/settings, not reporting or analytics.",
  },
  {
    match: (file) => /\/dashboard\/admin\/rewards\/shopify\//i.test(file),
    target: "MEMBER_RECOGNITION",
    reason: "The accepted source path is explicitly the admin rewards store; rewards are part of member recognition, not reporting.",
  },
  {
    match: (file) => /\/dashboard\/profile\/|\/dashboard\/settings\/sharing\/|components\/sharing\/SharingSettingsForm\.tsx$/i.test(file),
    target: "USER_ACCESS",
    reason: "The accepted source path/action family identifies profile or sharing/access settings, not institutional reporting.",
  },
  {
    match: (file) => /\/dashboard\/settings\/_components\/platform-settings-content\.tsx$|\/dashboard\/admin\/page\.tsx$/i.test(file),
    target: "APPLICATION_ADMINISTRATION",
    reason: "The accepted source path/action family identifies platform/application administration and maintenance, not institutional reporting.",
  },
  {
    match: (file) => /\/dashboard\/compliance\/|components\/marketing\/revoke-consent-button\.tsx$/i.test(file),
    target: "ORGANIZATION_RISK_CONTROLS",
    reason: "The accepted source path/action family identifies consent/privacy/compliance controls, not reporting.",
  },
  {
    match: (file) => /components\/icra\//i.test(file),
    target: "WORKPLACE_RISK_ASSESSMENT",
    reason: "The accepted source path/action family identifies ICRA assessment/report actions, not general reporting.",
  },
  {
    match: (file) => /\/dashboard\/error\.tsx$/i.test(file),
    target: "NON_BUSINESS_OR_INACTIVE",
    reason: "The accepted closeout identifies a dashboard error-boundary reset action; that is presentation/recovery behavior, not an institutional reporting ability.",
  },
];
const closeoutByBindingId = new Map(closeout.bindings.map((binding) => [binding.bindingId, binding]));

for (const [capabilityId, bindingIds] of capabilityBindings) {
  const sourceCapability = capabilityById.get(capabilityId);
  for (const bindingId of sourceCapability.bindingIds) {
    if (capabilityId === "INSTITUTIONAL_REPORTING") {
      const source = closeoutByBindingId.get(bindingId);
      const rule = sourceTransferRules.find((candidate) => candidate.match(source.sourceLocation.file));
      if (rule) {
        transfer(bindingId, rule.target, rule.reason);
        continue;
      }
    }
    if (capabilityId === "MEMBER_RECORDS" && /components\/education\/MemberCertificates\.tsx/i.test(bindingId)) {
      transfer(bindingId, "LEARNING_TRAINING", "The accepted action-family path explicitly identifies member certificates in the education surface; education belongs with member learning, not member-record administration.");
      continue;
    }
    if (capabilityId === "TRUSTEE_PENSION_PORTAL") {
      transfer(bindingId, "NON_BUSINESS_OR_INACTIVE", "A single inline trustee-portal UI binding has no confirmed operation in the accepted action graph; retain its source-ceiling obligation without treating portal access as an institutional capability.");
      continue;
    }
    capabilityBindings.get(capabilityId).add(bindingId);
    capabilityIdsByBinding.set(bindingId, [capabilityId]);
    bindingClassification.set(bindingId, "BUSINESS_BINDING_MAPPED");
  }
}

for (const binding of model.bindingCapabilityMap) {
  if (!capabilityIdsByBinding.has(binding.bindingId)) {
    assert(binding.classification === "NON_BUSINESS_OR_INACTIVE", `Binding was not normalized: ${binding.bindingId}`);
    capabilityIdsByBinding.set(binding.bindingId, []);
    bindingClassification.set(binding.bindingId, binding.classification);
  }
}

const aiCapabilityIds = new Set(["AI_CASE_ASSISTANCE", "AI_COLLECTIVE_AGREEMENT_ASSISTANCE"]);
const memberInvitationBindingId = "components/admin/members-console.tsx:482:13:onClick";
const memberInvitationBinding = originalBindingById.get(memberInvitationBindingId);
if (memberInvitationBinding?.capabilityIds.includes("MEMBER_RECORDS") &&
    memberInvitationBinding.capabilityIds.includes("USER_ACCESS")) {
  capabilityBindings.get("MEMBER_RECORDS").delete(memberInvitationBindingId);
  capabilityBindings.get("USER_ACCESS").add(memberInvitationBindingId);
  capabilityIdsByBinding.set(memberInvitationBindingId, ["USER_ACCESS"]);
  transferReasons.set(memberInvitationBindingId, {
    fromCapabilityId: "MEMBER_RECORDS",
    toCapabilityId: "USER_ACCESS",
    reason: "The accepted action-family identity is handleSendInvite; the binding is assigned to user-access administration rather than counted simultaneously as member-record maintenance.",
  });
}
for (const binding of model.bindingCapabilityMap.filter((record) => record.capabilityIds.length > 1)) {
  const normalizedIds = capabilityIdsByBinding.get(binding.bindingId);
  const retainedAiOverlap = binding.capabilityIds.filter((id) => aiCapabilityIds.has(id));
  const baseCapability = binding.capabilityIds.find((id) => !aiCapabilityIds.has(id));
  if (baseCapability && retainedAiOverlap.length) {
    const aiId = retainedAiOverlap[0];
    capabilityIdsByBinding.set(binding.bindingId, [baseCapability, aiId]);
    capabilityBindings.get(baseCapability).add(binding.bindingId);
    capabilityBindings.get(aiId).add(binding.bindingId);
  } else if (normalizedIds.length > 1) {
    throw new Error(`Unreviewed multi-capability mapping: ${binding.bindingId}`);
  }
}

const PERSONA_REVIEW = Object.fromEntries(model.capabilities
  .filter((capability) => decision[capability.capabilityId][0] !== "REMOVE_NON_CAPABILITY")
  .map((capability) => {
    const primary = capability.primaryPersonas;
    const secondary = capability.secondaryPersonas;
    const assigned = new Set([...primary, ...secondary]);
    return [capability.capabilityId, {
      primary,
      secondary,
      incidental: sorted(new Set(capability.personaEvidence.filter((persona) => !assigned.has(persona)))),
      rationale: "Source-model persona classifications are retained without independent audience or access validation; MULTI_PERSONA and OTHER_EXPLICIT remain unresolved source labels.",
      authorizationEvidence: "NONE",
    }];
  }));

const normalizedBindingMap = model.bindingCapabilityMap.map((binding) => ({
  bindingId: binding.bindingId,
  capabilityIds: capabilityIdsByBinding.get(binding.bindingId),
  classification: bindingClassification.get(binding.bindingId),
  knownDefectIds: binding.knownDefectIds,
  knownDefectCategories: binding.knownDefectCategories,
  sourceCeilingObligationIds: binding.sourceCeilingObligationIds,
  sourceDisposition: binding.sourceDisposition,
}));
const normalizedBusinessBindings = normalizedBindingMap.filter((binding) => binding.classification === "BUSINESS_BINDING_MAPPED");
const normalizedNonBusinessBindings = normalizedBindingMap.filter((binding) => binding.classification === "NON_BUSINESS_OR_INACTIVE");
const normalizedUnmappedBindings = normalizedBindingMap.filter((binding) => binding.classification === "UNMAPPED_BUSINESS_CANDIDATE");
const canonicalCapabilities = model.capabilities
  .filter((capability) => decision[capability.capabilityId][0] !== "REMOVE_NON_CAPABILITY")
  .map((capability) => {
    const bindingIds = sorted(capabilityBindings.get(capability.capabilityId));
    const bindings = bindingIds.map((id) => originalBindingById.get(id));
    const defectBindingIds = bindings
      .filter((binding) => binding.knownDefectIds.length > 0 || binding.knownDefectCategories.length > 0)
      .map((binding) => binding.bindingId);
    const ceilingBindingIds = bindings
      .filter((binding) => binding.sourceCeilingObligationIds.length > 0)
      .map((binding) => binding.bindingId);
    const status = defectBindingIds.length && ceilingBindingIds.length
      ? "SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS"
      : defectBindingIds.length
        ? "SOURCE_MODEL_BOUNDED_WITH_DEFECTS"
        : ceilingBindingIds.length
          ? "SOURCE_MODEL_HAS_CEILING_OBLIGATIONS"
          : "SOURCE_MODEL_BOUNDED";
    const [disposition, finalName] = decision[capability.capabilityId];
    return {
      capabilityId: capability.capabilityId,
      capabilityName: finalName,
      disposition,
      businessDefinition: disposition === "SPLIT"
        ? "Generate and inspect institutional reports, analytics, and scheduled-report actions; organization, system-administration, profile/access, privacy, recognition, and ICRA actions are assigned to their existing capabilities."
        : capability.businessDefinition,
      domain: capability.domain,
      criticality: disposition === "DEMOTE_TO_SUPPORTING" ? "SUPPORTING" : capability.criticality,
      primaryPersonas: capability.primaryPersonas,
      secondaryPersonas: capability.secondaryPersonas,
      incidentalPersonas: PERSONA_REVIEW[capability.capabilityId].incidental,
      personaReview: PERSONA_REVIEW[capability.capabilityId],
      bindingIds,
      totalBindings: bindingIds.length,
      sourceCeilingBindingIds: sorted(ceilingBindingIds),
      sourceCeilingBindings: ceilingBindingIds.length,
      sourceCeilingRatio: bindingIds.length ? ceilingBindingIds.length / bindingIds.length : 0,
      knownDefectBindingIds: sorted(defectBindingIds),
      knownDefectBindings: defectBindingIds.length,
      knownDefectRatio: bindingIds.length ? defectBindingIds.length / bindingIds.length : 0,
      exposureFlags: [
        ...(bindingIds.length && ceilingBindingIds.length / bindingIds.length >= 0.5 ? ["HIGH_CEILING_EXPOSURE"] : []),
        ...(bindingIds.length && defectBindingIds.length / bindingIds.length >= 0.25 ? ["HIGH_DEFECT_EXPOSURE"] : []),
      ],
      capabilitySourceStatus: status,
      routeCandidates: sorted(new Set(bindings
        .map((binding) => closeoutByBindingId.get(binding.bindingId)?.sourceLocation?.routePathCandidate)
        .filter(Boolean))),
      actionFamilyKeys: sorted(new Set(bindings.map((binding) => binding.sourceActionFamilyKey))),
      rationale: decision[capability.capabilityId][2],
      runtimeProven: "NO",
      authorizationProven: "NO",
      persistenceProven: "NO",
    };
  });

const sourceCeilingBindingIds = sorted(new Set(
  closeout.obligationRegister.sourceCeilingBindingObligations.map((obligation) => obligation.bindingId),
));
const originalCeilingBindingIds = sorted(model.bindingCapabilityMap
  .filter((binding) => binding.sourceCeilingObligationIds.length > 0)
  .map((binding) => binding.bindingId));
const retainedCeilingBindingIds = sorted(normalizedBindingMap
  .filter((binding) => binding.sourceCeilingObligationIds.length > 0)
  .map((binding) => binding.bindingId));
const originalDefectBindings = model.bindingCapabilityMap
  .filter((binding) => binding.knownDefectIds.length || binding.knownDefectCategories.length);
const defectRetention = originalDefectBindings.map((binding) => {
  const normalized = normalizedBindingMap.find((candidate) => candidate.bindingId === binding.bindingId);
  return {
    bindingId: binding.bindingId,
    knownDefectIds: binding.knownDefectIds,
    knownDefectCategories: binding.knownDefectCategories,
    normalizedKnownDefectIds: normalized.knownDefectIds,
    normalizedKnownDefectCategories: normalized.knownDefectCategories,
    retained: JSON.stringify(binding.knownDefectIds) === JSON.stringify(normalized.knownDefectIds) &&
      JSON.stringify(binding.knownDefectCategories) === JSON.stringify(normalized.knownDefectCategories),
  };
});
const sourceCeilingObligationRetention = closeout.obligationRegister.sourceCeilingBindingObligations.map((obligation) => {
  const binding = normalizedBindingMap.find((candidate) => candidate.bindingId === obligation.bindingId);
  return {
    obligationId: obligation.obligationId,
    bindingId: obligation.bindingId,
    obligationTypes: obligation.obligationTypes,
    status: obligation.status,
    nextPhase: obligation.nextPhase,
    executionAuthorized: obligation.executionAuthorized,
    normalizedClassification: binding?.classification ?? "MISSING",
    normalizedCapabilityIds: binding?.capabilityIds ?? [],
    retained: Boolean(binding?.sourceCeilingObligationIds.includes(obligation.obligationId)),
  };
});
const residualEffectChainRetention = closeout.obligationRegister.residualEffectChainObligations.map((obligation) => {
  const binding = normalizedBindingMap.find((candidate) => candidate.bindingId === obligation.bindingId);
  return {
    obligationId: obligation.obligationId,
    chainId: obligation.chainId,
    bindingId: obligation.bindingId,
    obligationType: obligation.obligationType,
    disposition: obligation.disposition,
    status: obligation.status,
    nextPhase: obligation.nextPhase,
    executionAuthorized: obligation.executionAuthorized,
    normalizedClassification: binding?.classification ?? "MISSING",
    normalizedCapabilityIds: binding?.capabilityIds ?? [],
    retained: Boolean(binding?.sourceCeilingObligationIds.includes(obligation.obligationId)),
  };
});
const legacyReconciliation = model.legacyRegistryReconciliation.map((record) => ({
  ...record,
  originalCanonicalCapabilityIds: record.canonicalCapabilityIds,
  canonicalCapabilityIds: record.canonicalCapabilityIds
    .filter((id) => decision[id]?.[0] !== "REMOVE_NON_CAPABILITY"),
}));
const legacyDispositionCounts = countBy(legacyReconciliation, (record) => record.disposition);
const retainedCapabilityIds = new Set(canonicalCapabilities.map((capability) => capability.capabilityId));
const dispositionCounts = countBy(canonicalCapabilities, (capability) => capability.disposition);
const criticalityCounts = countBy(canonicalCapabilities, (capability) => capability.criticality);
const sourceStatusCounts = countBy(canonicalCapabilities, (capability) => capability.capabilitySourceStatus);
const domainCounts = countBy(canonicalCapabilities, (capability) => capability.domain);
const bindingCountDistribution = countBy(canonicalCapabilities, (capability) => {
  if (capability.totalBindings <= 2) return "THIN_1_TO_2";
  if (capability.totalBindings <= 5) return "SMALL_3_TO_5";
  if (capability.totalBindings <= 20) return "MEDIUM_6_TO_20";
  return "LARGE_OVER_20";
});
const thinCapabilities = canonicalCapabilities
  .filter((capability) => capability.totalBindings <= 2)
  .map(({ capabilityId, capabilityName, totalBindings, knownDefectBindings, sourceCeilingBindings }) => ({
    capabilityId, capabilityName, totalBindings, knownDefectBindings, sourceCeilingBindings,
    assessment: "NARROW_SOURCE_EVIDENCE_REQUIRES_CAUTION_NOT_A_RUNTIME_OR_READINESS_CONCLUSION",
  }));
const largeCapabilities = canonicalCapabilities
  .filter((capability) => capability.totalBindings > 20)
  .map(({ capabilityId, capabilityName, totalBindings, domain, rationale }) => ({
    capabilityId, capabilityName, totalBindings, domain, rationale,
    assessment: "BREADTH_REVIEWED_AS_OUTCOME_COHERENCE; SIZE_ALONE_DOES_NOT_JUSTIFY_A_SPLIT",
  }));
const normalizedCrossCapabilityBindings = normalizedBindingMap
  .filter((binding) => binding.capabilityIds.length > 1)
  .map((binding) => ({
    ...binding,
    rationale: binding.capabilityIds.some((id) => aiCapabilityIds.has(id))
      ? "Retained only as an explicit AI-support overlay paired with its underlying institutional capability; this does not establish AI provider behavior or authorization."
      : "Review exception requiring explicit evidence-backed rationale.",
  }));
const hierarchy = {
  parentRelationships: canonicalCapabilities
    .filter((capability) => capabilityById.get(capability.capabilityId).parentCapabilityId)
    .map((capability) => ({
      capabilityId: capability.capabilityId,
      parentCapabilityId: capabilityById.get(capability.capabilityId).parentCapabilityId,
    })),
  dependencyRelationships: model.dependencyGraph
    .filter((node) => decision[node.capabilityId]?.[0] !== "REMOVE_NON_CAPABILITY")
    .map((node) => ({
      capabilityId: node.capabilityId,
      dependsOnCapabilityIds: node.dependsOnCapabilityIds
        .filter((id) => decision[id]?.[0] !== "REMOVE_NON_CAPABILITY"),
      relationshipType: node.relationshipType,
    })),
  assessment: "Retained relationships are source-model groupings, not executable workflow dependencies or runtime sequencing.",
};
const continuityReview = model.institutionalContinuityCapabilities.map((signal) => ({
  ...signal,
  capabilityIds: signal.capabilityIds.filter((id) => decision[id]?.[0] !== "REMOVE_NON_CAPABILITY"),
  assessment: "SOURCE_MODEL_SIGNAL_ONLY; the evidence does not establish operational continuity, ownership, recovery, or service-level behavior.",
}));
const externalSpecialistReview = {
  ...model.externalSpecialistCapabilities,
  assessment: "The accepted source model supports only the listed dimensions. No WorkAid integration, external specialist access, identity, authorization, availability, or workflow completion is proven.",
};
const aiOverlayReview = model.aiAssistedCapabilities.map((overlay) => ({
  ...overlay,
  capabilityName: decision[overlay.capabilityId]?.[1] ?? overlay.capabilityName,
  underlyingCapabilityIds: overlay.underlyingCapabilityIds
    .filter((id) => decision[id]?.[0] !== "REMOVE_NON_CAPABILITY"),
  disposition: "SUPPORTING_OVERLAY_ONLY",
  assessment: "Source references identify candidate AI-assisted actions only; model/provider, output quality, human review, privacy, authorization, persistence, and runtime behavior remain unproven.",
}));
const transferLog = [...transferReasons.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([bindingId, disposition]) => ({ bindingId, ...disposition }));

assert(normalizedBindingMap.length === model.bindingCapabilityMap.length, "Normalized binding denominator changed");
assert(normalizedUnmappedBindings.length === 0, "Unmapped business bindings remain");
assert(normalizedBusinessBindings.length + normalizedNonBusinessBindings.length === model.bindingCapabilityMap.length, "Binding classification arithmetic does not reconcile");
assert(
  canonicalCapabilities.reduce((sum, capability) => sum + capability.totalBindings, 0) === normalizedBusinessBindings.length + normalizedCrossCapabilityBindings.length,
  "Capability binding assignments do not reconcile to unique business bindings plus explicit overlap rows",
);
assert(sourceCeilingBindingIds.length === 230, "Expected exactly 230 accepted source-ceiling obligations");
assert(JSON.stringify(sourceCeilingBindingIds) === JSON.stringify(originalCeilingBindingIds), "Accepted source-ceiling obligation bindings do not reconcile to Phase 1A.3a");
assert(JSON.stringify(sourceCeilingBindingIds) === JSON.stringify(retainedCeilingBindingIds), "One or more source-ceiling binding obligations were dropped");
assert(sourceCeilingObligationRetention.every((obligation) => obligation.retained), "An accepted source-ceiling obligation ID was not retained");
assert(residualEffectChainRetention.length === 247, "Expected all 247 accepted residual-effect-chain obligations");
assert(residualEffectChainRetention.every((obligation) => obligation.retained), "An accepted residual effect-chain obligation ID was not retained");
assert(
  new Set([...sourceCeilingObligationRetention, ...residualEffectChainRetention].map((obligation) => obligation.obligationId)).size ===
    sourceCeilingObligationRetention.length + residualEffectChainRetention.length,
  "Source-ceiling and residual-chain obligation identifiers do not reconcile uniquely",
);
assert(defectRetention.every((binding) => binding.retained), "Known defect identifiers/categories were dropped");
assert(legacyReconciliation.length === 31 && legacyReconciliation.every((record) => record.disposition && record.rationale), "Legacy registry rows are incomplete");
assert(legacyReconciliation.every((record) =>
  record.canonicalCapabilityIds.every((id) => retainedCapabilityIds.has(id)),
), "Legacy reconciliation points to a non-retained capability");
assert(canonicalCapabilities.length === 32, "Expected 32 retained canonical capability concepts after the trustee portal disposition");
assert(Object.keys(PERSONA_REVIEW).length === canonicalCapabilities.length, "Persona review coverage does not match retained capabilities");
assert(canonicalCapabilities.every((capability) => capability.totalBindings > 0), "A retained capability has no source binding evidence");
assert(canonicalCapabilities.every((capability) => capability.bindingIds.length === new Set(capability.bindingIds).size), "Duplicate binding within a capability");
assert(normalizedCrossCapabilityBindings.every((binding) =>
  binding.capabilityIds.length === 2 && binding.capabilityIds.some((id) => aiCapabilityIds.has(id)),
), "Unreviewed cross-capability mapping remains");
assert(transferLog.every((entry) => entry.toCapabilityId === "NON_BUSINESS_OR_INACTIVE" || capabilityBindings.get(entry.toCapabilityId).has(entry.bindingId)), "A transferred binding is missing from its destination");
assert(canonicalCapabilities.every((capability) =>
  capability.runtimeProven === "NO" && capability.authorizationProven === "NO" && capability.persistenceProven === "NO",
), "A runtime, authorization, or persistence proof claim was introduced");

const phaseStatus = {
  phase1A3bGate: "PASS",
  phase1A3aGate: "PASS",
  phase1A3: "NOT_YET_COMPLETE",
  phase1A: "NOT_YET_PROVEN",
  phase1B: "NOT_AUTHORIZED",
  phase2: "NOT_AUTHORIZED",
  productReady: "NO",
  runtimeExecuted: "NO",
  applicationSourceInspected: "NO",
  productCodeChanged: "NO",
};
const report = {
  metadata: {
    title: "Phase 1A.3b Capability Coherence Review",
    evidenceBoundary: "Accepted Phase 1A.3a business capability model as primary evidence; accepted Phase 1A.2 final source closeout for bounded supporting facts only.",
    primaryEvidence: inputPath,
    supportingEvidence: closeoutPath,
    applicationSourceInspected: false,
    runtimeActionExecuted: false,
    productCodeChanged: false,
    generatedAt: null,
  },
  phaseStatus,
  reviewMethod: {
    nature: "ADVERSARIAL_SOURCE_MODEL_COHERENCE_REVIEW",
    authoritativeBindingDenominator: model.bindingCapabilityMap.length,
    businessBindingCountBefore: model.bindingCoverage.businessBindingCount,
    businessBindingCountAfter: normalizedBusinessBindings.length,
    nonBusinessBindingCountBefore: model.bindingCoverage.nonBusinessOrInactiveCount,
    nonBusinessBindingCountAfter: normalizedNonBusinessBindings.length,
    unmappedBindingCountAfter: normalizedUnmappedBindings.length,
    sourceModelBusinessReclassifications: transferLog.length,
    thresholds: {
      highCeilingExposure: "source-ceiling binding ratio >= 0.50",
      highDefectExposure: "known-defect binding ratio >= 0.25",
      thinCapability: "1-2 mapped business bindings",
      largeCapability: "more than 20 mapped business bindings",
    },
    exclusions: [
      "No application source, route implementation, component implementation, tests, configuration, or runtime was inspected or executed.",
      "No authorization, persistence, external provider, integration, continuity operation, or product-readiness claim is inferred.",
      "Capability source ceilings and known defects are retained as open evidence obligations, not treated as resolved.",
    ],
  },
  summary: {
    originalCapabilities: model.capabilities.length,
    retainedCapabilities: canonicalCapabilities.length,
    removedNonCapabilities: model.capabilities.length - canonicalCapabilities.length,
    dispositionCounts,
    criticalityCounts,
    sourceStatusCounts,
    domainCounts,
    legacyRegistryRows: legacyReconciliation.length,
    legacyDispositionCounts,
    bindingCoverage: {
      totalCanonicalBindings: normalizedBindingMap.length,
      businessBindings: normalizedBusinessBindings.length,
      nonBusinessOrInactiveBindings: normalizedNonBusinessBindings.length,
      unmappedBusinessCandidates: normalizedUnmappedBindings.length,
      capabilityBindingAssignments: canonicalCapabilities.reduce((sum, capability) => sum + capability.totalBindings, 0),
      multiplyMappedBindings: normalizedCrossCapabilityBindings.length,
    },
    bindingCountDistribution,
    thinCapabilityCount: thinCapabilities.length,
    largeCapabilityCount: largeCapabilities.length,
    sourceCeilingBindingObligations: sourceCeilingObligationRetention.length,
    retainedSourceCeilingObligations: sourceCeilingObligationRetention.filter((obligation) => obligation.retained).length,
    residualEffectChainObligations: residualEffectChainRetention.length,
    retainedResidualEffectChainObligations: residualEffectChainRetention.filter((obligation) => obligation.retained).length,
    knownDefectBindings: defectRetention.length,
    retainedKnownDefectBindings: defectRetention.filter((binding) => binding.retained).length,
  },
  canonicalCapabilities,
  bindingCapabilityMap: normalizedBindingMap,
  reassignmentAndReclassificationLog: transferLog,
  bindingCountDistribution,
  thinCapabilities,
  largeCapabilities,
  hierarchy,
  crossCapabilityOverlap: {
    count: normalizedCrossCapabilityBindings.length,
    rationale: "All retained multi-mappings are explicit paired AI overlays; no unrelated cross-domain duplicate assignment is retained.",
    bindings: normalizedCrossCapabilityBindings,
  },
  personaReview: {
    capabilitiesReviewed: Object.keys(PERSONA_REVIEW).length,
    personas: model.taxonomies.personas.filter((persona) => !["MULTI_PERSONA", "OTHER_EXPLICIT"].includes(persona)),
    assessments: canonicalCapabilities.map((capability) => ({
      capabilityId: capability.capabilityId,
      primaryPersonas: capability.personaReview.primary,
      secondaryPersonas: capability.personaReview.secondary,
      incidentalPersonas: capability.personaReview.incidental,
      sourcePrimaryPersonas: capability.primaryPersonas,
      sourceSecondaryPersonas: capability.secondaryPersonas,
      rationale: capability.personaReview.rationale,
      authorizationEvidence: "NONE",
    })),
    globalAssessment: "Persona labels express an outcome-oriented analytical view only; they do not establish access control or actual user populations.",
  },
  institutionalContinuityReview: {
    sourceModelSignalCount: continuityReview.length,
    signals: continuityReview,
  },
  externalSpecialistReview,
  aiOverlayReview: {
    count: aiOverlayReview.length,
    overlays: aiOverlayReview,
  },
  legacyRegistryReconciliation: legacyReconciliation,
  sourceCeilingRetention: {
    obligationCount: sourceCeilingObligationRetention.length,
    retainedCount: sourceCeilingObligationRetention.filter((obligation) => obligation.retained).length,
    bindingIds: sourceCeilingBindingIds,
    obligations: sourceCeilingObligationRetention,
    status: "OPEN_DEFERRED; no execution authorized by this review",
  },
  residualEffectChainRetention: {
    obligationCount: residualEffectChainRetention.length,
    retainedCount: residualEffectChainRetention.filter((obligation) => obligation.retained).length,
    obligations: residualEffectChainRetention,
    status: "OPEN_DEFERRED; no execution authorized by this review",
  },
  knownDefectRetention: {
    bindingCount: defectRetention.length,
    retainedCount: defectRetention.filter((binding) => binding.retained).length,
    bindings: defectRetention,
    status: "RETAINED_OPEN; no defect is resolved by this review",
  },
  validation: {
    allCanonicalBindingsRetained: normalizedBindingMap.length === model.bindingCapabilityMap.length,
    allBindingsClassified: normalizedUnmappedBindings.length === 0,
    bindingClassificationArithmetic: normalizedBusinessBindings.length + normalizedNonBusinessBindings.length === normalizedBindingMap.length,
    allSourceCeilingObligationsRetained: sourceCeilingObligationRetention.every((obligation) => obligation.retained),
    allResidualEffectChainObligationsRetained: residualEffectChainRetention.length === 247 && residualEffectChainRetention.every((obligation) => obligation.retained),
    allKnownDefectIdsAndCategoriesRetained: defectRetention.every((binding) => binding.retained),
    allLegacyRegistryRowsReconciled: legacyReconciliation.length === 31 && legacyReconciliation.every((record) => record.rationale),
    everyRetainedCapabilityHasBindings: canonicalCapabilities.every((capability) => capability.totalBindings > 0),
    personaReviewCoversEveryRetainedCapability: Object.keys(PERSONA_REVIEW).length === canonicalCapabilities.length,
    allCrossCapabilityMappingsAreExplicitAiOverlays: normalizedCrossCapabilityBindings.every((binding) => binding.capabilityIds.length === 2 && binding.capabilityIds.some((id) => aiCapabilityIds.has(id))),
    noRuntimeAuthorizationPersistenceOrReadinessClaimIntroduced: canonicalCapabilities.every((capability) => capability.runtimeProven === "NO" && capability.authorizationProven === "NO" && capability.persistenceProven === "NO") && phaseStatus.productReady === "NO",
    applicationSourceInspected: false,
    runtimeActionExecuted: false,
    phase1A4Started: false,
    phase1BStarted: false,
    phase2Started: false,
  },
};

const mdTable = (headers, rows) => [
  `| ${headers.join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map((cell) => String(cell).replaceAll("|", "\\|").replaceAll("\n", " ")).join(" | ")} |`),
].join("\n");
const capabilityRows = canonicalCapabilities.map((capability) => [
  capability.capabilityId, capability.capabilityName, capability.disposition, capability.criticality,
  capability.totalBindings, capability.knownDefectBindings, capability.sourceCeilingBindings,
  capability.exposureFlags.join(", ") || "—",
]);
const markdown = `# Phase 1A.3b — Capability Coherence Review

**PHASE_1A_3B_GATE = ${phaseStatus.phase1A3bGate}.** This is an adversarial source-model coherence review, not runtime proof or authorization. Primary evidence is the accepted Phase 1A.3a model; Phase 1A.2 is used only for supporting closeout facts. No application source was inspected and no runtime action was executed.

## Gate and evidence boundary

| Item | Result |
| --- | --- |
| Original capability concepts | ${report.summary.originalCapabilities} |
| Retained canonical capability concepts | ${report.summary.retainedCapabilities} |
| Concepts removed as unsupported/non-capabilities | ${report.summary.removedNonCapabilities} |
| Canonical binding denominator | ${report.summary.bindingCoverage.totalCanonicalBindings} |
| Business bindings after review | ${report.summary.bindingCoverage.businessBindings} |
| Non-business/inactive bindings after review | ${report.summary.bindingCoverage.nonBusinessOrInactiveBindings} |
| Unmapped business candidates | ${report.summary.bindingCoverage.unmappedBusinessCandidates} |
| Source-ceiling binding obligations retained | ${report.summary.retainedSourceCeilingObligations}/${report.summary.sourceCeilingBindingObligations} |
| Residual effect-chain obligations retained | ${report.summary.retainedResidualEffectChainObligations}/${report.summary.residualEffectChainObligations} |
| Known-defect binding rows retained | ${report.summary.retainedKnownDefectBindings}/${report.summary.knownDefectBindings} |
| Legacy registry rows reconciled | ${report.summary.legacyRegistryRows}/31 |

The 230 source-ceiling obligations remain open/deferred. The review does not resolve the 1A.2 source ceiling, authorize execution, or prove Phase 1A complete. **Phase 1A remains NOT_YET_PROVEN; Phase 1B and Phase 2 remain NOT_AUTHORIZED; product readiness remains NO.**

## Capability dispositions and exposure

${mdTable(["Capability ID", "Capability", "Disposition", "Criticality", "Bindings", "Defect bindings", "Ceiling bindings", "Flags"], capabilityRows)}

Capability status describes the bounded source evidence, not feature usability. High-ceiling exposure means a source-ceiling ratio at least 0.50; high-defect exposure means a known-defect ratio at least 0.25.

### Binding volume and thin/large capability review

${mdTable(["Binding volume band", "Count"], Object.entries(bindingCountDistribution).map(([band, count]) => [band, count]))}

**Thin (1–2 bindings):** ${thinCapabilities.map((capability) => `${capability.capabilityId} (${capability.totalBindings})`).join("; ") || "None"}.

**Large (>20 bindings):** ${largeCapabilities.map((capability) => `${capability.capabilityId} (${capability.totalBindings}; ${capability.rationale})`).join("; ") || "None"}.

Thinness and breadth were treated as review prompts, not automatic grounds to invent, merge, or split capabilities.

## Reassignments and non-business reclassifications

${transferLog.length ? mdTable(["Binding ID", "From", "To", "Evidence rationale"], transferLog.map((entry) => [entry.bindingId, entry.fromCapabilityId, entry.toCapabilityId, entry.reason])) : "No binding changes."}

Each changed row retains its original binding identity, source disposition, known-defect identifiers/categories, and source-ceiling obligation identifiers. The dashboard error-boundary reset and single trustee-portal inline action are reclassified as non-business/inactive; their open assurance obligations remain attached at binding level.

## Cross-capability overlap and hierarchy

- Retained overlapping bindings: **${normalizedCrossCapabilityBindings.length}**. Each is an explicit AI-support overlay paired with an institutional capability; no unrelated multi-capability assignment is retained.
- Parent groupings: **${hierarchy.parentRelationships.length}**.
- Dependency relationships from the source model: **${hierarchy.dependencyRelationships.length}**. These are not workflow execution or sequencing proof.

${normalizedCrossCapabilityBindings.length ? mdTable(["Binding ID", "Capabilities", "Disposition", "Defects retained", "Ceiling obligations retained"], normalizedCrossCapabilityBindings.map((binding) => [binding.bindingId, binding.capabilityIds.join(", "), binding.classification, binding.knownDefectIds.join(", ") || "None", binding.sourceCeilingObligationIds.join(", ") || "None"])) : "No overlapping bindings remain."}

## Persona assessment

${mdTable(["Capability ID", "Primary outcome actors", "Secondary actors", "Incidental actors", "Authorization established?"], report.personaReview.assessments.map((item) => [item.capabilityId, item.primaryPersonas.join(", ") || "None", item.secondaryPersonas.join(", ") || "None", item.incidentalPersonas.join(", ") || "None", "No"]))}

Persona classifications are analytical, not authorization evidence. Source audience tags do not establish role enforcement or an actual population.

## Institutional continuity

${mdTable(["Continuity dimension", "Source signal", "Capability IDs", "Operational proof"], continuityReview.map((item) => [item.dimension, item.sourceModelContainsSignal ? "Present" : "Absent", item.capabilityIds.join(", ") || "None", item.runtimeOrOperationalProof]))}

Each signal remains a source-model signal only; this review does not prove ownership, recovery, continuity operation, or service levels.

## External specialist and AI assessments

- **WorkAid integration inferred:** ${externalSpecialistReview.workAidIntegrationInferred}.
- **External specialist dimensions supported by source evidence:** ${externalSpecialistReview.supportedDimensions.join(", ") || "None"}.
- **AI overlays:** ${aiOverlayReview.map((item) => `${item.capabilityId} → ${item.underlyingCapabilityIds.join(", ") || "no underlying capability"} (${item.disposition})`).join("; ")}.

No external integration, specialist access controls, AI provider availability, output quality, privacy behavior, human review, persistence, or runtime behavior is proven.

## Legacy registry reconciliation

${mdTable(["Legacy ID", "Legacy item", "Disposition", "Canonical capability IDs", "Rationale"], legacyReconciliation.map((record) => [record.legacyCapability.id, record.legacyCapability.title, record.disposition, record.canonicalCapabilityIds.join(", ") || "—", record.rationale]))}

**Reconciled ${legacyReconciliation.length}/31 legacy rows.** Legacy registry labels and owner-path references are not treated as proof of implementation or runtime capability.

## Source-ceiling and defect retention

- All **${sourceCeilingObligationRetention.length}** source-ceiling binding obligations remain associated with the same binding IDs and obligation IDs; all remain **OPEN_DEFERRED** with execution authorization false.
- All **${residualEffectChainRetention.length}** residual effect-chain obligations remain associated with the same chain IDs, obligation IDs, and binding IDs; all remain **OPEN_DEFERRED** with execution authorization false.
- All **${defectRetention.length}** binding rows carrying known-defect IDs or categories retain those identifiers/categories. No defect was resolved by this review.
- Full retained ID-level records are in the JSON report.

## Validation and phase disposition

${mdTable(["Check", "Result"], Object.entries(report.validation).map(([check, result]) => [check, String(result)]))}

This completes only the 1A.3b coherence-review artifact. It does not start Phase 1A.4, Phase 1B, or Phase 2.
`;

assert(Object.values(report.validation).every((value) => value === true || value === false), "Validation report contains a non-boolean check");
assert(Object.entries(report.validation).filter(([key]) => !["applicationSourceInspected", "runtimeActionExecuted", "phase1A4Started", "phase1BStarted", "phase2Started"].includes(key)).every(([, value]) => value), "A required Phase 1A.3b validation check failed");
fs.writeFileSync(path.join(root, outputJsonPath), `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(path.join(root, outputMarkdownPath), markdown);
console.log(JSON.stringify({
  phase1A3bGate: phaseStatus.phase1A3bGate,
  summary: report.summary,
  validation: report.validation,
  outputs: [outputJsonPath, outputMarkdownPath],
}, null, 2));
