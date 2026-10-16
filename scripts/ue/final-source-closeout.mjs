import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const evidencePaths = {
  actionIndex: "docs/union-eyes/PHASE_1A_2_EXECUTABLE_ACTION_INDEX.json",
  effectBoundaryIndex: "docs/union-eyes/PHASE_1A_2_EFFECT_BOUNDARY_INDEX.json",
  serverEffectIndex: "docs/union-eyes/PHASE_1A_2_SERVER_EFFECT_INDEX.json",
  callbackProvenance: "docs/union-eyes/reality-remediation/PHASE_1A_2B1_R1_CALLBACK_PROVENANCE.json",
  r1TerminalClosure:
    "docs/union-eyes/reality-remediation/PHASE_1A_2B2_R1_TERMINAL_EFFECT_CLOSURE.json",
  r2TerminalDispositions:
    "docs/union-eyes/reality-remediation/PHASE_1A_2B2_R2_EXACT_TERMINAL_DISPOSITIONS.json",
  r2nNormalization:
    "docs/union-eyes/reality-remediation/PHASE_1A_2B2_R2N_CANONICAL_EFFECT_NORMALIZATION.json",
  r2eBackfill:
    "docs/union-eyes/reality-remediation/PHASE_1A_2B2_R2E_EXISTING_EVIDENCE_BACKFILL.json",
  remediationLedger: "docs/union-eyes/ASSURANCE_REMEDIATION_LEDGER.md",
};

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function compareText(a, b) {
  const left = String(a);
  const right = String(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

function sorted(values) {
  return [...values].sort(compareText);
}

function unique(values) {
  return [...new Set(values)];
}

function countBy(values, keyOf) {
  const counts = {};
  for (const value of values) {
    const key = keyOf(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => compareText(a, b)));
}

const actionIndex = readJson(evidencePaths.actionIndex);
const effectBoundaryIndex = readJson(evidencePaths.effectBoundaryIndex);
const serverEffectIndex = readJson(evidencePaths.serverEffectIndex);
const callbackProvenance = readJson(evidencePaths.callbackProvenance);
const r1TerminalClosure = readJson(evidencePaths.r1TerminalClosure);
const r2TerminalDispositions = readJson(evidencePaths.r2TerminalDispositions);
const r2nNormalization = readJson(evidencePaths.r2nNormalization);
const r2eBackfill = readJson(evidencePaths.r2eBackfill);
const remediationLedger = fs.readFileSync(path.join(root, evidencePaths.remediationLedger), "utf8");

const canonicalBindingIds = sorted(actionIndex.actionFamilies.flatMap((family) => family.bindingIds));
assert(canonicalBindingIds.length === 644, `Expected 644 canonical bindings; found ${canonicalBindingIds.length}`);
assert(new Set(canonicalBindingIds).size === 644, "Canonical action-family binding IDs are not unique");

const canonicalIdSet = new Set(canonicalBindingIds);
const canonicalBindings = actionIndex.bindingRecords.filter((binding) => canonicalIdSet.has(binding.bindingId));
assert(canonicalBindings.length === 644, `Expected 644 canonical binding records; found ${canonicalBindings.length}`);
assert(new Set(canonicalBindings.map((binding) => binding.bindingId)).size === 644, "Canonical binding records contain duplicate IDs");

const familiesByBinding = new Map();
for (const family of actionIndex.actionFamilies) {
  for (const bindingId of family.bindingIds) {
    const families = familiesByBinding.get(bindingId) ?? [];
    families.push(family);
    familiesByBinding.set(bindingId, families);
  }
}
assert(
  canonicalBindingIds.every((bindingId) => familiesByBinding.get(bindingId)?.length === 1),
  "Each canonical binding must map to exactly one source action family",
);
const tracesByBinding = new Map(effectBoundaryIndex.traces.map((trace) => [trace.bindingId, trace]));
assert(tracesByBinding.size === 644, `Expected 644 effect traces; found ${tracesByBinding.size}`);
assert(canonicalBindingIds.every((bindingId) => tracesByBinding.has(bindingId)), "An action binding has no effect-boundary trace");

const r2nByChain = new Map(r2nNormalization.canonicalRecords.map((record) => [record.chainId, record]));
const r2ByChain = new Map(r2TerminalDispositions.dispositions.map((record) => [record.chainId, record]));
assert(r2nByChain.size === 394, `Expected 394 normalized server-effect chains; found ${r2nByChain.size}`);
assert(r2ByChain.size === 154, `Expected 154 exact R2 terminal dispositions; found ${r2ByChain.size}`);
assert(serverEffectIndex.chains.length === 394, `Expected 394 server-effect index chains; found ${serverEffectIndex.chains.length}`);
assert(serverEffectIndex.bindings.length === 299, `Expected 299 server/provider-bound bindings; found ${serverEffectIndex.bindings.length}`);

const r2eResidualChainIds = sorted(r2eBackfill.residualEffectChainIds);
assert(r2eResidualChainIds.length === 247, `Expected 247 R2E residual chains; found ${r2eResidualChainIds.length}`);
assert(new Set(r2eResidualChainIds).size === 247, "R2E residual chain IDs are not unique");
const r2eResidualBindings = new Set();
const r2eResidualRecords = [];
for (const chainId of r2eResidualChainIds) {
  const normalized = r2nByChain.get(chainId);
  assert(normalized, `R2E residual chain has no R2N record: ${chainId}`);
  assert(canonicalIdSet.has(normalized.bindingId), `R2E residual chain has a non-canonical binding: ${chainId}`);
  r2eResidualBindings.add(normalized.bindingId);
  const backfill = r2eBackfill.adjudications.find((record) => record.chainId === chainId);
  assert(backfill, `R2E residual chain has no adjudication record: ${chainId}`);
  const r2Record = r2ByChain.get(chainId);
  r2eResidualRecords.push({
    chainId,
    bindingId: normalized.bindingId,
    primaryDataEffect: normalized.primaryDataEffect,
    secondaryDataEffects: normalized.secondaryDataEffects,
    secondarySemanticEffects: normalized.secondarySemanticEffects,
    rootCauseId: normalized.rootCauseId,
    businessOperation: normalized.businessOperation,
    evidenceOrigin: backfill.evidenceOrigin,
    r2DispositionCode: backfill.r2DispositionCode,
    r2EffectClass: backfill.r2EffectClass,
    r2SourceDisposition: backfill.r2SourceDisposition,
    r2TerminalOutcome: backfill.r2TerminalOutcome,
    r2SourceTarget: backfill.r2SourceTarget,
    r2ExactTerminalDisposition: r2Record
      ? {
          chainKind: r2Record.chainKind,
          r1TerminalEffectAssessment: r2Record.r1TerminalEffectAssessment,
          sourceTarget: r2Record.sourceTarget,
          disposition: r2Record.disposition,
          sourceObservations: r2Record.sourceObservations,
          sourceReferences: r2Record.sourceReferences,
          b2ChainRef: r2Record.b2ChainRef,
        }
      : null,
    runtimeProven: normalized.runtimeProven,
  });
}
assert(r2eResidualBindings.size === 190, `Expected 190 bindings represented by R2E residuals; found ${r2eResidualBindings.size}`);
assert(
  r2eResidualRecords.filter((record) => record.primaryDataEffect === "UNKNOWN_DATA_EFFECT").length === 245,
  "Expected 245 R2E primary-unknown chains",
);
assert(
  r2eResidualRecords.filter((record) => record.secondaryDataEffects?.includes("UNKNOWN_DATA_EFFECT")).length === 2,
  "Expected 2 R2E secondary-unknown chains",
);

const b1TraceCandidateIds = sorted(serverEffectIndex.carryForward.traceCandidateBindingIds);
const b1NoCallerIds = sorted(serverEffectIndex.carryForward.noInRepositoryCallerBindingIds);
assert(b1TraceCandidateIds.length === 23, `Expected 23 B1 trace candidates; found ${b1TraceCandidateIds.length}`);
assert(b1NoCallerIds.length === 17, `Expected 17 B1 no-caller bindings; found ${b1NoCallerIds.length}`);
const b1TraceCandidateSet = new Set(b1TraceCandidateIds);
const b1NoCallerSet = new Set(b1NoCallerIds);
const b1Ids = new Set([...b1TraceCandidateIds, ...b1NoCallerIds]);
assert(b1Ids.size === 40, "B1 carry-forward binding IDs overlap or are not unique");
assert([...b1Ids].every((bindingId) => canonicalIdSet.has(bindingId)), "A B1 carry-forward binding is not canonical");
assert([...b1Ids].every((bindingId) => !r2eResidualBindings.has(bindingId)), "B1 and R2E residual binding sets overlap");

const routeRootsById = new Map(r1TerminalClosure.traceRoots.map((rootRecord) => [rootRecord.rootId, rootRecord]));
const knownLedgerFindings = {
  unresolvedEffect: "ACTION-EFFECT-UNKNOWN-01",
  missingRoute: "ACTION-API-ROUTE-01",
  methodMismatch: "ACTION-API-METHOD-01",
  callbackOmission: "ACTION-CALLBACK-UNBOUND-01",
};
for (const findingId of Object.values(knownLedgerFindings)) {
  assert(remediationLedger.includes(findingId), `Expected existing remediation-ledger finding: ${findingId}`);
}

const callbackClusters = callbackProvenance.rootContractClusters ?? [];
const callbackOmissions = callbackClusters.flatMap((cluster) =>
  cluster.bindingIds.map((bindingId) => ({
    bindingId,
    clusterId: cluster.id,
    sourceConclusion: cluster.sourceConclusion,
    findings: cluster.findings,
  })),
);
assert(callbackOmissions.length === 2, `Expected 2 active visible callback omissions; found ${callbackOmissions.length}`);
assert(callbackOmissions.every((item) => canonicalIdSet.has(item.bindingId)), "A callback omission is not a canonical binding");
const callbackByBinding = new Map(callbackOmissions.map((item) => [item.bindingId, item]));

const chainsByBinding = new Map();
for (const record of r2nNormalization.canonicalRecords) {
  assert(canonicalIdSet.has(record.bindingId), `Normalized chain has a non-canonical binding: ${record.chainId}`);
  const records = chainsByBinding.get(record.bindingId) ?? [];
  records.push(record);
  chainsByBinding.set(record.bindingId, records);
}

const allEffectChainIds = new Set(r2nNormalization.canonicalRecords.map((record) => record.chainId));
assert(r2eResidualChainIds.every((chainId) => allEffectChainIds.has(chainId)), "An R2E residual is not in the normalized server-effect index");

const falseSuccessRecords = r2nNormalization.canonicalRecords.filter((record) => record.falseSuccessSource === true);
assert(falseSuccessRecords.length === 5, `Expected 5 source-supported false-success chains; found ${falseSuccessRecords.length}`);
const potentialFalseSuccessBindings = new Set(
  effectBoundaryIndex.traces
    .filter((trace) => trace.potentialFalseSuccess === "YES")
    .map((trace) => trace.bindingId),
);
const sourceSupportedFalseSuccessBindings = new Set(falseSuccessRecords.map((record) => record.bindingId));

const defectCategoriesByBinding = new Map();
function addDefect(bindingId, defect) {
  const items = defectCategoriesByBinding.get(bindingId) ?? [];
  items.push(defect);
  defectCategoriesByBinding.set(bindingId, items);
}

const missingRouteChains = [];
const methodMismatchChains = [];
const missingImplementationChains = [];
const stubChains = [];
for (const chain of r2nNormalization.canonicalRecords) {
  if (chain.primaryDataEffect === "MISSING_IMPLEMENTATION") {
    missingImplementationChains.push(chain);
    const root = routeRootsById.get(chain.rootCauseId);
    if (root?.localRouteStatus === "API_ROUTE_MISSING") {
      missingRouteChains.push(chain);
      addDefect(chain.bindingId, {
        category: "MISSING_ROUTE",
        chainId: chain.chainId,
        rootCauseId: chain.rootCauseId,
        rootFindingIds: [knownLedgerFindings.missingRoute, chain.rootCauseId],
      });
    } else if (root?.localMethodStatus === "API_METHOD_MISSING") {
      methodMismatchChains.push(chain);
      addDefect(chain.bindingId, {
        category: "METHOD_MISMATCH",
        chainId: chain.chainId,
        rootCauseId: chain.rootCauseId,
        rootFindingIds: [knownLedgerFindings.methodMismatch, chain.rootCauseId],
      });
    } else {
      addDefect(chain.bindingId, {
        category: "MISSING_IMPLEMENTATION_UNCLASSIFIED",
        chainId: chain.chainId,
        rootCauseId: chain.rootCauseId,
        rootFindingIds: [knownLedgerFindings.missingRoute, knownLedgerFindings.methodMismatch, ...(chain.rootCauseId ? [chain.rootCauseId] : [])],
      });
    }
  }
  if (chain.primaryDataEffect === "STUB_OR_MOCK_EFFECT") {
    stubChains.push(chain);
    addDefect(chain.bindingId, {
      category: "STUB_OR_MOCK_EFFECT",
      chainId: chain.chainId,
      rootCauseId: chain.rootCauseId,
      rootFindingIds: [knownLedgerFindings.unresolvedEffect, ...(chain.rootCauseId ? [chain.rootCauseId] : [])],
    });
  }
  if (chain.falseSuccessSource === true) {
    addDefect(chain.bindingId, {
      category: "FALSE_SUCCESS_SOURCE_SUPPORTED",
      chainId: chain.chainId,
      rootCauseId: chain.rootCauseId,
      rootFindingIds: [knownLedgerFindings.unresolvedEffect, ...(chain.rootCauseId ? [chain.rootCauseId] : [])],
    });
  }
}
for (const omission of callbackOmissions) {
  addDefect(omission.bindingId, {
    category: "VISIBLE_ACTION_CALLBACK_OMITTED",
    rootCauseId: omission.clusterId,
    rootFindingIds: [knownLedgerFindings.callbackOmission, omission.clusterId],
  });
}

const noEffectBindingIds = new Set(
  effectBoundaryIndex.traces
    .filter((trace) => trace.primaryEffectBoundary === "NO_EFFECT")
    .map((trace) => trace.bindingId),
);

function normalizePersonas(audienceClasses) {
  const sourceValues = unique(audienceClasses ?? []);
  const normalized = sourceValues.map((value) => {
    if (value === "MULTI_PERSONA_AUTHENTICATED") return "MULTI_PERSONA";
    if (value === "SYSTEM_INTERNAL") return "SYSTEM";
    return value;
  });
  const persona = normalized.length === 0
    ? "UNCLASSIFIED"
    : normalized.length === 1
      ? normalized[0]
      : "MULTI_PERSONA";
  return { persona, sourceAudienceClasses: sourceValues, normalizedAudienceClasses: sorted(unique(normalized)) };
}

function routePathCandidate(sourceFile) {
  const normalizedPath = sourceFile.replaceAll("\\", "/");
  if (!normalizedPath.startsWith("app/") || !normalizedPath.endsWith("/page.tsx")) return null;
  const segments = normalizedPath.slice(4, -"/page.tsx".length).split("/");
  const routeSegments = segments.filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")));
  return routeSegments.length === 0 ? "/" : `/${routeSegments.join("/")}`;
}

function classifyDomain(binding, chainRecords) {
  const searchable = [
    binding.sourceFile,
    binding.handlerIdentity,
    ...binding.directCallTargets,
    ...chainRecords.map((record) => record.businessOperation),
    ...chainRecords.flatMap((record) => record.dataTargets ?? []),
  ].join(" ").toLowerCase();
  const domains = [
    ["HEALTH_SAFETY", /health.?safety|hazard|inspection|incident|corrective.?action/],
    ["GRIEVANCE_CASE", /grievance|case.?management|arbitration|precedent/],
    ["FINANCE_DUES", /finance|financial|budget|dues|remittance|billing|expense|vendor|payroll/],
    ["ELECTION", /election|ballot|voting/],
    ["ORGANIZING", /organizing|campaign/],
    ["STRIKE_ACTION", /strike.?fund|strike/],
    ["MEMBERSHIP", /membership|members|member.?profile|bargaining.?unit/],
    ["COMMUNICATION", /communication|messag|notification|email|survey|announcement/],
    ["DOCUMENT_EVIDENCE", /document|evidence|upload|attachment|file.?library/],
    ["GOVERNANCE", /governance|committee|union.?structure|constitution/],
    ["LEARNING_TRAINING", /learning|training|course|certification/],
    ["KNOWLEDGE_TRANSFER", /knowledge.?transfer|succession|institutional.?knowledge/],
    ["REPORTING_ANALYTICS", /analytics|report|insight|metric/],
    ["IDENTITY_ACCESS", /auth|identity|sign.?in|login|session|permission|role/],
    ["CALENDAR_SCHEDULING", /calendar|schedule|event|meeting/],
    ["PUBLIC_MARKETING", /marketing|contact.?form|landing|case.?studies|pricing|newsletter/],
    ["WORKSPACE_PRODUCTIVITY", /workspace|deep.?work|task|productivity|focus/],
    ["ADMINISTRATION", /admin|settings|configuration|cache/],
  ];
  return domains.find(([, pattern]) => pattern.test(searchable))?.[0] ?? "UNCLASSIFIED";
}

const entries = [];
const sortedBindings = [...canonicalBindings].sort((a, b) => compareText(a.bindingId, b.bindingId));
for (const [index, binding] of sortedBindings.entries()) {
  const family = familiesByBinding.get(binding.bindingId)[0];
  const trace = tracesByBinding.get(binding.bindingId);
  const chainRecords = chainsByBinding.get(binding.bindingId) ?? [];
  const residualIds = chainRecords.filter((record) => r2eResidualChainIds.includes(record.chainId)).map((record) => record.chainId);
  const defects = defectCategoriesByBinding.get(binding.bindingId) ?? [];
  const hasB1TraceCandidate = b1TraceCandidateSet.has(binding.bindingId);
  const hasB1NoCaller = b1NoCallerSet.has(binding.bindingId);
  const hasB2Residual = r2eResidualBindings.has(binding.bindingId);
  const hasCallbackOmission = callbackByBinding.has(binding.bindingId);

  let primaryDisposition;
  if (hasB1TraceCandidate) primaryDisposition = "B1_TRACE_TERMINAL_UNPROVEN";
  else if (hasB1NoCaller) primaryDisposition = "B1_NO_IN_REPOSITORY_COMPONENT_CALLER_FOUND";
  else if (hasB2Residual) primaryDisposition = "R2E_UNKNOWN_EFFECT_SOURCE_CEILING";
  else if (hasCallbackOmission) primaryDisposition = "VISIBLE_ACTION_CALLBACK_OMITTED";
  else if (defects.some((defect) =>
    ["MISSING_ROUTE", "METHOD_MISMATCH", "MISSING_IMPLEMENTATION_UNCLASSIFIED"].includes(defect.category),
  )) {
    primaryDisposition = "KNOWN_MISSING_IMPLEMENTATION";
  } else if (defects.some((defect) => defect.category === "STUB_OR_MOCK_EFFECT")) {
    primaryDisposition = "KNOWN_STUB_OR_MOCK_EFFECT";
  } else if (noEffectBindingIds.has(binding.bindingId)) {
    primaryDisposition = "SOURCE_NO_EFFECT_CLASSIFIED";
  } else {
    primaryDisposition = "SOURCE_EFFECT_BOUNDARY_CLASSIFIED";
  }

  const persona = normalizePersonas(binding.reachableAudienceClasses);
  const domain = classifyDomain(binding, chainRecords);
  const knownDefectCategories = sorted(unique(defects.map((defect) => defect.category)));
  const sourceRootCauseIds = sorted(unique(defects.map((defect) => defect.rootCauseId).filter(Boolean)));
  const rootFindingIds = sorted(unique(defects.flatMap((defect) => defect.rootFindingIds)));
  const sourceChecksObserved = {
    authentication: chainRecords.some((record) => record.authCheckObserved === true),
    role: chainRecords.some((record) => record.roleCheckObserved === true),
    organizationResolution: chainRecords.some((record) => record.orgResolutionObserved === true),
    resourcePermission: chainRecords.some((record) => record.resourcePermissionCheckObserved === true),
    auditWrite: chainRecords.some((record) => record.auditWriteObserved === true),
  };
  const hasSourceCeiling = hasB1TraceCandidate || hasB1NoCaller || hasB2Residual;
  const priorityClass = knownDefectCategories.some((category) =>
    category === "FALSE_SUCCESS_SOURCE_SUPPORTED" || category === "VISIBLE_ACTION_CALLBACK_OMITTED",
  )
    ? "P1_SOURCE_DEFECT"
    : knownDefectCategories.length > 0
      ? "P2_SOURCE_DEFECT"
      : hasSourceCeiling
        ? "P2_EVIDENCE_CLOSURE"
        : "P3_SOURCE_CLASSIFIED";

  entries.push({
    bindingId: binding.bindingId,
    actionFamilyKey: `AFB-${String(index + 1).padStart(4, "0")}`,
    actionFamilyGrouping: "SINGLE_BINDING_CONSERVATIVE",
    sourceActionFamily: {
      actionFamilyId: family.actionFamilyId,
      familyKey: family.familyKey,
      familyName: family.familyName,
      semanticsLimit: family.semanticsLimit,
    },
    sourceLocation: {
      file: binding.sourceFile,
      line: binding.sourceLine,
      column: binding.sourceColumn,
      event: binding.event,
      handlerIdentity: binding.handlerIdentity,
      handlerKind: binding.handlerKind,
      bindingClass: binding.bindingClass,
      sourceSurface: binding.sourceSurface,
      pageSourceFlag: binding.pageSource,
      routePathCandidate: routePathCandidate(binding.sourceFile),
      mobileOnlySourceFlag: binding.mobileOnlySource,
      reachableSurfaceClasses: binding.reachableSurfaceClasses,
    },
    persona,
    businessDomain: domain,
    intentCandidate: {
      status: "CANDIDATE_NOT_CONFIRMED",
      handlerName: family.familyName,
      directCallTargets: binding.directCallTargets,
      candidateText: chainRecords.map((record) => record.businessOperation).filter(Boolean),
    },
    primaryDisposition,
    priorityClass,
    priorityBasis: "Source-closeout sequencing only; not a security severity, business criticality, or runtime impact rating.",
    effectBoundary: {
      classification: trace.primaryEffectBoundary,
      effectTarget: trace.effectTarget,
      apiRequests: trace.apiRequests,
      apiRouteStatuses: trace.apiRouteStatuses,
      secondaryEffects: trace.secondaryEffects,
      potentialFalseSuccess: trace.potentialFalseSuccess,
      potentialProductTheater: trace.potentialProductTheater,
      unknownReason: trace.unknownReason,
    },
    serverEffectChains: chainRecords.map((record) => ({
      chainId: record.chainId,
      serverTargetClass: record.serverTargetClass,
      methodStatus: record.methodStatus,
      primaryDataEffect: record.primaryDataEffect,
      secondaryDataEffects: record.secondaryDataEffects,
      secondarySemanticEffects: record.secondarySemanticEffects,
      dataTargets: record.dataTargets,
      businessOperation: record.businessOperation,
      requestResponseContract: record.requestResponseContract,
      rootCauseId: record.rootCauseId,
      falseSuccessSource: record.falseSuccessSource,
      runtimeProven: record.runtimeProven,
      r2ExactTerminalDisposition: r2ByChain.has(record.chainId)
        ? {
            chainKind: r2ByChain.get(record.chainId).chainKind,
            r1TerminalEffectAssessment: r2ByChain.get(record.chainId).r1TerminalEffectAssessment,
            sourceTarget: r2ByChain.get(record.chainId).sourceTarget,
            disposition: r2ByChain.get(record.chainId).disposition,
            sourceObservations: r2ByChain.get(record.chainId).sourceObservations,
            sourceReferences: r2ByChain.get(record.chainId).sourceReferences,
            b2ChainRef: r2ByChain.get(record.chainId).b2ChainRef,
          }
        : null,
    })),
    residualR2EChainIds: sorted(residualIds),
    knownDefectCategories,
    defectEvidence: defects,
    sourceRootCauseIds,
    rootFindingIds,
    sourceChecksObserved,
    proofStatus: {
      sourceDisposition: "RECORDED",
      runtimeBehavior: "UNPROVEN",
      persistenceOutcome: "UNPROVEN",
      authenticationEnforcement: "UNPROVEN",
      organizationScopeEnforcement: "UNPROVEN",
      auditBehavior: "UNPROVEN",
      implementationCompletion: hasSourceCeiling
        ? "UNPROVEN_SOURCE_CEILING"
        : knownDefectCategories.length > 0
          ? "KNOWN_SOURCE_DEFECT"
          : "SOURCE_BOUNDARY_CLASSIFIED_ONLY",
    },
  });
}

const entryById = new Map(entries.map((entry) => [entry.bindingId, entry]));
const primaryDispositionCounts = countBy(entries, (entry) => entry.primaryDisposition);
assert(Object.values(primaryDispositionCounts).reduce((sum, value) => sum + value, 0) === 644, "Primary dispositions do not sum to 644");
assert(primaryDispositionCounts.B1_TRACE_TERMINAL_UNPROVEN === 23, "B1 trace-terminal disposition total changed");
assert(primaryDispositionCounts.B1_NO_IN_REPOSITORY_COMPONENT_CALLER_FOUND === 17, "B1 no-caller disposition total changed");
assert(primaryDispositionCounts.R2E_UNKNOWN_EFFECT_SOURCE_CEILING === 190, "R2E binding disposition total changed");
assert(primaryDispositionCounts.KNOWN_MISSING_IMPLEMENTATION === 38, "Non-ceiling missing-implementation disposition total changed");
assert(primaryDispositionCounts.KNOWN_STUB_OR_MOCK_EFFECT === 4, "Non-ceiling stub/mock disposition total changed");
assert(primaryDispositionCounts.VISIBLE_ACTION_CALLBACK_OMITTED === 2, "Callback-omission disposition total changed");
assert(primaryDispositionCounts.SOURCE_NO_EFFECT_CLASSIFIED === 13, "NO_EFFECT source-observation disposition total changed");
assert(primaryDispositionCounts.SOURCE_EFFECT_BOUNDARY_CLASSIFIED === 357, "Source-effect disposition total changed");

const sourceCeilingEntries = entries.filter((entry) =>
  ["B1_TRACE_TERMINAL_UNPROVEN", "B1_NO_IN_REPOSITORY_COMPONENT_CALLER_FOUND", "R2E_UNKNOWN_EFFECT_SOURCE_CEILING"].includes(entry.primaryDisposition),
);
assert(sourceCeilingEntries.length === 230, `Expected 230 source-ceiling bindings; found ${sourceCeilingEntries.length}`);

const bindingObligations = sourceCeilingEntries.map((entry) => {
  const types = entry.primaryDisposition === "B1_TRACE_TERMINAL_UNPROVEN"
    ? ["TERMINAL_EFFECT_PROOF", "RUNTIME_OUTCOME_PROOF"]
    : entry.primaryDisposition === "B1_NO_IN_REPOSITORY_COMPONENT_CALLER_FOUND"
      ? ["IN_REPOSITORY_CALLER_OR_REACHABILITY_PROOF", "TERMINAL_EFFECT_PROOF"]
      : ["RESOLVE_UNKNOWN_EFFECT", "IMPLEMENTATION_OR_PROVIDER_TARGET_IDENTIFICATION"];
  return {
    obligationId: `BINDING-${crypto.createHash("sha256").update(entry.bindingId).digest("hex").slice(0, 12)}`,
    bindingId: entry.bindingId,
    sourceDisposition: entry.primaryDisposition,
    obligationTypes: types,
    relatedResidualChainIds: entry.residualR2EChainIds,
    status: "OPEN_DEFERRED",
    nextPhase: "PHASE_1A_3_RECOMMENDED_NOT_STARTED",
    executionAuthorized: false,
  };
});
const residualChainObligations = r2eResidualRecords.map((record) => ({
  obligationId: `CHAIN-${record.chainId}`,
  chainId: record.chainId,
  bindingId: record.bindingId,
  obligationType: "RESOLVE_RESIDUAL_UNKNOWN_EFFECT",
  observedPrimaryDataEffect: record.primaryDataEffect,
  disposition: "RETAINED_UNKNOWN",
  status: "OPEN_DEFERRED",
  nextPhase: "PHASE_1A_3_RECOMMENDED_NOT_STARTED",
  executionAuthorized: false,
}));
assert(bindingObligations.length === 230, "A source-ceiling binding is missing its binding-level obligation");
assert(residualChainObligations.length === 247, "Not all residual chains have a chain-level obligation");
assert(
  sourceCeilingEntries.every((entry) => bindingObligations.some((obligation) => obligation.bindingId === entry.bindingId)),
  "A source-ceiling binding has no obligation",
);
assert(
  r2eResidualChainIds.every((chainId) => residualChainObligations.some((obligation) => obligation.chainId === chainId)),
  "A residual chain has no obligation",
);

const missingImplementationBindingIds = new Set(missingImplementationChains.map((record) => record.bindingId));
const stubBindingIds = new Set(stubChains.map((record) => record.bindingId));
const defectRegister = [
  {
    category: "MISSING_ROUTE",
    chainCount: missingRouteChains.length,
    bindingCount: new Set(missingRouteChains.map((record) => record.bindingId)).size,
    rootCauseIds: sorted(unique(missingRouteChains.map((record) => record.rootCauseId).filter(Boolean))),
    rootFindingIds: [knownLedgerFindings.missingRoute],
  },
  {
    category: "METHOD_MISMATCH",
    chainCount: methodMismatchChains.length,
    bindingCount: new Set(methodMismatchChains.map((record) => record.bindingId)).size,
    rootCauseIds: sorted(unique(methodMismatchChains.map((record) => record.rootCauseId).filter(Boolean))),
    rootFindingIds: [knownLedgerFindings.methodMismatch],
  },
  {
    category: "MISSING_IMPLEMENTATION",
    chainCount: missingImplementationChains.length,
    bindingCount: missingImplementationBindingIds.size,
    primaryDispositionBindingCount: entries.filter((entry) => entry.primaryDisposition === "KNOWN_MISSING_IMPLEMENTATION").length,
    rootCauseIds: sorted(unique(missingImplementationChains.map((record) => record.rootCauseId).filter(Boolean))),
    rootFindingIds: [knownLedgerFindings.missingRoute, knownLedgerFindings.methodMismatch],
  },
  {
    category: "STUB_OR_MOCK_EFFECT",
    chainCount: stubChains.length,
    bindingCount: stubBindingIds.size,
    primaryDispositionBindingCount: entries.filter((entry) => entry.primaryDisposition === "KNOWN_STUB_OR_MOCK_EFFECT").length,
    rootCauseIds: sorted(unique(stubChains.map((record) => record.rootCauseId).filter(Boolean))),
    rootFindingIds: [knownLedgerFindings.unresolvedEffect],
  },
  {
    category: "FALSE_SUCCESS_SOURCE_SUPPORTED",
    chainCount: falseSuccessRecords.length,
    bindingCount: new Set(falseSuccessRecords.map((record) => record.bindingId)).size,
    rootCauseIds: sorted(unique(falseSuccessRecords.map((record) => record.rootCauseId).filter(Boolean))),
    rootFindingIds: [knownLedgerFindings.unresolvedEffect],
    potentialFalseSuccessTraceBindingCount: potentialFalseSuccessBindings.size,
    distinction: "The R2N source-supported count is not interchangeable with the effect-index potential flag count.",
    evidence: falseSuccessRecords.map((record) => ({
      chainId: record.chainId,
      bindingId: record.bindingId,
      rootCauseId: record.rootCauseId,
      businessOperation: record.businessOperation,
      primaryDataEffect: record.primaryDataEffect,
    })),
  },
  {
    category: "VISIBLE_ACTION_CALLBACK_OMITTED",
    chainCount: 0,
    bindingCount: callbackOmissions.length,
    rootCauseIds: sorted(unique(callbackOmissions.map((item) => item.clusterId))),
    rootFindingIds: [knownLedgerFindings.callbackOmission],
    sourceEvidence: callbackOmissions,
  },
];
assert(missingImplementationChains.length === 60, `Expected 60 missing-implementation chains; found ${missingImplementationChains.length}`);
assert(missingRouteChains.length === 46, `Expected 46 missing-route chains; found ${missingRouteChains.length}`);
assert(methodMismatchChains.length === 14, `Expected 14 method-mismatch chains; found ${methodMismatchChains.length}`);
assert(stubChains.length === 5, `Expected 5 stub/mock chains; found ${stubChains.length}`);
assert(defectRegister.every((defect) => defect.rootFindingIds.length > 0), "A defect register entry has no root finding ID");
assert(
  entries.filter((entry) => entry.knownDefectCategories.length > 0)
    .every((entry) => entry.rootFindingIds.length > 0),
  "A binding-level defect has no root finding ID",
);

const unclassifiedDomainBindings = entries.filter((entry) => entry.businessDomain === "UNCLASSIFIED").map((entry) => entry.bindingId);
const defectFindingReferences = sorted(unique(defectRegister.flatMap((defect) => defect.rootFindingIds)));
const outputJson = {
  metadata: {
    title: "Phase 1A.2 Final Source Closeout",
    status: "SOURCE_CEILING_ACCEPTED",
    evidenceBoundary: "Accepted Phase 1A.2/B1/R1/R2/R2N/R2E artifacts and the existing remediation ledger only.",
    generatedBy: "scripts/ue/final-source-closeout.mjs",
    generatedAt: null,
    applicationSourceInspected: false,
    runtimeExecuted: false,
    applicationFilesModified: false,
  },
  gate: {
    disposition: "SOURCE_CEILING_ACCEPTED",
    sourceCloseoutComplete: true,
    phase1A3: "RECOMMENDED_NOT_STARTED",
    phase1B: "NOT_AUTHORIZED",
    phase2: "NOT_AUTHORIZED",
    runtimeProof: "UNPROVEN",
    persistenceProof: "UNPROVEN",
    authenticationProof: "UNPROVEN",
    organizationScopeProof: "UNPROVEN",
    auditProof: "UNPROVEN",
  },
  denominators: {
    canonicalBindings: 644,
    serverProviderBoundBindings: 299,
    serverEffectChains: 394,
    r2ExactTerminalDispositionChains: r2ByChain.size,
    b1TraceTerminalUnprovenBindings: 23,
    b1NoInRepositoryCallerBindings: 17,
    b1Bindings: 40,
    r2eResidualEffectChains: 247,
    r2eResidualPrimaryUnknownChains: 245,
    r2eResidualSecondaryUnknownChains: 2,
    r2eResidualBindings: 190,
    b1R2eBindingOverlap: 0,
  },
  primaryDispositionCounts,
  sourceCeiling: {
    bindingCount: sourceCeilingEntries.length,
    b1TraceCandidateBindingIds: b1TraceCandidateIds,
    b1NoInRepositoryCallerBindingIds: b1NoCallerIds,
    r2eResidualBindingIds: sorted(r2eResidualBindings),
  },
  defectRegister,
  existingLedgerRootFindings: defectFindingReferences,
  effectBoundaryCounts: countBy(effectBoundaryIndex.traces, (trace) => trace.primaryEffectBoundary),
  sourceFindingCategoryCounts: {
    MISSING_CALLBACK_IMPLEMENTATION: {
      confirmedBindingCount: 0,
      confirmedRootCauseCount: 0,
      interpretation: "No distinct missing-callback-implementation finding was established beyond the separately recorded visible callback omissions.",
    },
    VISIBLE_ACTION_CALLBACK_OMITTED: {
      bindingCount: callbackOmissions.length,
      rootCauseCount: new Set(callbackOmissions.map((item) => item.clusterId)).size,
      rootFindingIds: [knownLedgerFindings.callbackOmission],
    },
    NO_EFFECT: {
      bindingCount: noEffectBindingIds.size,
      defectRootCauseCount: 0,
      interpretation: "Source-boundary observation only; not treated as a defect or as proof of harmlessness.",
    },
    LOCAL_ONLY_PERSISTENT_INTENT: {
      confirmedBindingCount: 0,
      confirmedRootCauseCount: 0,
      potentialProductTheaterBindingCount: new Set(
        effectBoundaryIndex.traces
          .filter((trace) => trace.potentialProductTheater === "YES")
          .map((trace) => trace.bindingId),
      ).size,
      interpretation: "The accepted index marks four potential product-theater traces, but does not establish business intent or persistent-state expectations; they remain candidates, not findings.",
    },
  },
  noEffectObservation: {
    bindingCount: noEffectBindingIds.size,
    bindingIds: sorted(noEffectBindingIds),
    isTreatedAsDefect: false,
    interpretation: "NO_EFFECT is a source-boundary observation, not proof that a visible action is harmless, unreachable, or intentionally a no-op.",
    distinctFromNoPersistentEffectChains: new Set(
      r2nNormalization.canonicalRecords
        .filter((record) => record.primaryDataEffect === "NO_PERSISTENT_EFFECT")
        .map((record) => record.bindingId),
    ).size,
  },
  falseSuccessReconciliation: {
    r2nSourceSupportedChainCount: falseSuccessRecords.length,
    r2nSourceSupportedBindingCount: new Set(falseSuccessRecords.map((record) => record.bindingId)).size,
    effectIndexPotentialBindingCount: potentialFalseSuccessBindings.size,
    evidenceOverlapBindingCount: [...sourceSupportedFalseSuccessBindings].filter((bindingId) =>
      potentialFalseSuccessBindings.has(bindingId),
    ).length,
    sourceSupportedOnlyBindingIds: sorted(
      [...sourceSupportedFalseSuccessBindings].filter(
        (bindingId) => !potentialFalseSuccessBindings.has(bindingId),
      ),
    ),
    sourceSupportedChainIds: sorted(falseSuccessRecords.map((record) => record.chainId)),
    potentialOnlyBindingIds: sorted(
      [...potentialFalseSuccessBindings].filter(
        (bindingId) => !falseSuccessRecords.some((record) => record.bindingId === bindingId),
      ),
    ),
    interpretation: "Preserve both source-supported false-success records and the smaller effect-index potential flag as separate evidence dimensions.",
  },
  domainSummary: {
    bindingCounts: countBy(entries, (entry) => entry.businessDomain),
    unclassifiedBindingIds: sorted(unclassifiedDomainBindings),
    unclassifiedBindingCount: unclassifiedDomainBindings.length,
    classificationRule: "Conservative lexical candidates from accepted binding paths, handler names, and normalized server-operation evidence; UNCLASSIFIED is retained where no domain is supported.",
  },
  globalUnprovenObligations: [
    { dimension: "RUNTIME_BEHAVIOR", bindingCount: 644, status: "UNPROVEN", executionAuthorized: false },
    { dimension: "PERSISTENCE_OUTCOME", bindingCount: 644, status: "UNPROVEN", executionAuthorized: false },
    { dimension: "AUTHENTICATION_ENFORCEMENT", bindingCount: 644, status: "UNPROVEN", executionAuthorized: false },
    { dimension: "ORGANIZATION_SCOPE_ENFORCEMENT", bindingCount: 644, status: "UNPROVEN", executionAuthorized: false },
    { dimension: "AUDIT_BEHAVIOR", bindingCount: 644, status: "UNPROVEN", executionAuthorized: false },
  ],
  obligationRegister: {
    sourceCeilingBindingObligations: bindingObligations,
    residualEffectChainObligations: residualChainObligations,
  },
  sourceInventory: {
    evidencePaths,
    excludedActivities: [
      "Application-source inspection",
      "Runtime execution or testing",
      "Application behavior repairs",
      "Phase 1A.3 execution",
      "Phase 1B execution",
      "Phase 2 execution",
    ],
    acceptedSecondaryInputs: {
      r2TerminalDispositionRecordCount: r2TerminalDispositions.dispositions?.length ?? null,
      sourceFamilySemanticsLimit: "Source action-family names remain syntactic references; no multi-binding semantic grouping was inferred.",
    },
  },
  validation: {
    canonicalBindingsExactlyOnce: entries.length === 644 && new Set(entries.map((entry) => entry.bindingId)).size === 644,
    primaryDispositionsSumToCanonicalCount:
      Object.values(primaryDispositionCounts).reduce((sum, value) => sum + value, 0) === 644,
    allB1BindingsCarriedForward: b1Ids.size === 40 && [...b1Ids].every((bindingId) => entryById.has(bindingId)),
    allR2eResidualChainsCarriedForward: residualChainObligations.length === 247,
    noOrphanResidualChains: r2eResidualRecords.length === 247 && r2eResidualRecords.every((record) => entryById.has(record.bindingId)),
    allSourceCeilingBindingsHaveObligations: bindingObligations.length === 230,
    allDefectsReferenceRootFindingIds:
      defectRegister.every((defect) => defect.rootFindingIds.length > 0) &&
      entries.filter((entry) => entry.knownDefectCategories.length > 0).every((entry) => entry.rootFindingIds.length > 0),
    b1AndR2eBindingSetsDisjoint: [...b1Ids].every((bindingId) => !r2eResidualBindings.has(bindingId)),
    sourceOnlyEvidenceBoundaryPreserved: true,
  },
  bindings: entries,
  residualEffectChains: r2eResidualRecords,
};

const reportJsonPath = path.join(
  root,
  "docs/union-eyes/reality-remediation/PHASE_1A_2_FINAL_SOURCE_CLOSEOUT.json",
);
const reportMarkdownPath = path.join(
  root,
  "docs/union-eyes/reality-remediation/PHASE_1A_2_FINAL_SOURCE_CLOSEOUT.md",
);

const mdTable = (headers, rows) => [
  `| ${headers.join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map((value) => String(value).replaceAll("|", "\\|")).join(" | ")} |`),
].join("\n");

const mdLines = [
  "# Phase 1A.2 Final Source Closeout",
  "",
  `**Gate: ${outputJson.gate.disposition}.** This accepts the source-evidence ceiling only; it is not runtime, persistence, authorization, organization-scope, audit, or product-readiness proof.`,
  "",
  "## Evidence boundary",
  "",
  "This closeout reconciles the accepted Phase 1A.2 executable-action and effect-boundary indexes, server-effect index, B1 callback provenance, R1 terminal closure, R2 dispositions, R2N normalization, R2E existing-evidence backfill, and the existing assurance remediation ledger. No application source was inspected; no runtime or tests were executed; no application behavior was changed.",
  "",
  "The 644-binding denominator is the union of `actionFamilies[].bindingIds`, not the broader 1,827-record binding inventory. Action-family names and keys are retained as source references only. Bindings are not grouped into shared business families unless semantics were established in the accepted evidence; this closeout conservatively keeps one closeout family key per binding.",
  "",
  "## Reconciliation totals",
  "",
  mdTable(["Measure", "Count"], [
    ["Canonical bindings", outputJson.denominators.canonicalBindings],
    ["Server/provider-bound bindings", outputJson.denominators.serverProviderBoundBindings],
    ["Server-effect chains", outputJson.denominators.serverEffectChains],
    ["Exact R2 terminal dispositions", outputJson.denominators.r2ExactTerminalDispositionChains],
    ["B1 trace-candidate terminal effects unproven", outputJson.denominators.b1TraceTerminalUnprovenBindings],
    ["B1 no in-repository component caller found", outputJson.denominators.b1NoInRepositoryCallerBindings],
    ["Total B1 carry-forward bindings", outputJson.denominators.b1Bindings],
    ["R2E residual unknown-effect chains", outputJson.denominators.r2eResidualEffectChains],
    ["R2E primary-unknown chains", outputJson.denominators.r2eResidualPrimaryUnknownChains],
    ["R2E secondary-unknown chains", outputJson.denominators.r2eResidualSecondaryUnknownChains],
    ["Distinct bindings represented by R2E residual chains", outputJson.denominators.r2eResidualBindings],
    ["B1/R2E binding overlap", outputJson.denominators.b1R2eBindingOverlap],
  ]),
  "",
  "## Primary binding dispositions",
  "",
  mdTable(
    ["Primary disposition", "Bindings"],
    Object.entries(primaryDispositionCounts).map(([name, count]) => [name, count]),
  ),
  "",
  "All 644 canonical bindings have exactly one primary disposition. Known defects are retained as overlays as well, so a B2 source-ceiling disposition does not erase a concurrently evidenced missing route, method mismatch, stub, or false-success condition.",
  "",
  "## Known source findings",
  "",
  mdTable(
    ["Finding category", "Chains", "Bindings", "Root causes", "Ledger root finding"],
    defectRegister.map((defect) => [
      defect.category,
      defect.chainCount,
      defect.bindingCount,
      defect.rootCauseIds.join(", ") || "Not applicable",
      defect.rootFindingIds.join(", "),
    ]),
  ),
  "",
  "Missing-route and method-mismatch totals above are chain counts, not binding counts. The binding counts deduplicate canonical binding IDs. The 60 missing-implementation chains comprise 46 missing-route and 14 method-mismatch chains. The 5 source-supported false-success chains are a separate evidence dimension from the effect-boundary index's 4 potential-false-success traces; neither count is silently substituted for the other.",
  "",
  "The 13 `NO_EFFECT` effect-boundary traces are recorded as observations, not defects. They do not establish that an action is intentionally inert, unreachable, or harmless. `NO_PERSISTENT_EFFECT` is a distinct normalized server-chain classification.",
  "",
  "The separately requested `MISSING_CALLBACK_IMPLEMENTATION` category has zero confirmed findings; the two accepted callback issues are specifically classified as `VISIBLE_ACTION_CALLBACK_OMITTED`. The accepted effect index flags four potential product-theater traces, but no source-supported local-only persistent-intent root finding was established. Those four remain candidates for later evidence review, not confirmed defects. The exact category counts and distinctions are in the JSON report.",
  "",
  "## Domain and surface mapping",
  "",
  `Business-domain candidates are lexically derived from accepted source paths, handler names, and server-operation evidence; they are not confirmed product taxonomy. **${outputJson.domainSummary.unclassifiedBindingCount} bindings** remain \`UNCLASSIFIED\`; their exact IDs are in the JSON report.`,
  "",
  mdTable(
    ["Business-domain candidate", "Bindings"],
    Object.entries(outputJson.domainSummary.bindingCounts).map(([name, count]) => [name, count]),
  ),
  "",
  "Each binding record preserves its source file/line, source-surface class, reachable-surface classes, persona classes, page-source flag, optional route-path candidate, source action-family reference, direct call targets, and effect evidence. Route-path candidates are derived only for `page.tsx` source paths and are explicitly candidates, not a claim that the route resolves at runtime. All 644 are marked as not specially identified as mobile-only by the accepted index; no mobile behavior is inferred.",
  "",
  "Personas preserve source audience classes, normalize `MULTI_PERSONA_AUTHENTICATED` to `MULTI_PERSONA`, and normalize `SYSTEM_INTERNAL` to `SYSTEM`. This is source-surface metadata, not authorization evidence.",
  "",
  "## Open obligations and deferred proof",
  "",
  `The JSON register contains ${bindingObligations.length} binding-level obligations for all 230 source-ceiling bindings and ${residualChainObligations.length} chain-level obligations for all 247 R2E residual chains. Each is \`OPEN_DEFERRED\`, recommends Phase 1A.3 only, and is not authorized for execution by this closeout.`,
  "",
  mdTable(
    ["Proof dimension", "Scope", "Status"],
    outputJson.globalUnprovenObligations.map((item) => [item.dimension, item.bindingCount, item.status]),
  ),
  "",
  "The source-boundary observations that authentication, role, organization-resolution, resource-permission, or audit-write checks were seen are included per binding where applicable. Such observations do not prove effective runtime enforcement or tenant isolation.",
  "",
  "## Gate and phase boundary",
  "",
  "- `SOURCE_CEILING_ACCEPTED` means the source-only accounting reconciles exactly: 644 canonical bindings, 40 B1 carry-forwards, 247 R2E residual chains, no orphan residual chain, and no B1/R2E binding overlap.",
  "- Phase 1A.3 is recommended but **not started**.",
  "- Phase 1B and Phase 2 remain **not authorized** by this closeout.",
  "- Runtime behavior, persistence outcome, authentication enforcement, organization scope, and audit behavior remain **unproven**.",
  "- No route, UI, callback, authorization, or product behavior was repaired or changed.",
  "",
  "## Validation",
  "",
  mdTable(
    ["Check", "Result"],
    Object.entries(outputJson.validation).map(([name, passed]) => [name, passed ? "PASS" : "FAIL"]),
  ),
  "",
  `The machine-readable binding-level register, 247 residual-chain records, root-finding references, obligation records, and validation results are in [PHASE_1A_2_FINAL_SOURCE_CLOSEOUT.json](./PHASE_1A_2_FINAL_SOURCE_CLOSEOUT.json).`,
  "",
];
const outputMarkdown = `${mdLines.join("\n")}`;

assert(Object.values(outputJson.validation).every(Boolean), "A final source-closeout validation failed");
fs.writeFileSync(reportJsonPath, `${JSON.stringify(outputJson, null, 2)}\n`);
fs.writeFileSync(reportMarkdownPath, outputMarkdown);
console.log(
  JSON.stringify(
    {
      outputs: [
        path.relative(root, reportJsonPath),
        path.relative(root, reportMarkdownPath),
      ],
      bindingDispositionCounts: primaryDispositionCounts,
      sourceCeilingBindingCount: sourceCeilingEntries.length,
      residualChainCount: residualChainObligations.length,
      unclassifiedDomainBindingCount: unclassifiedDomainBindings.length,
      validation: outputJson.validation,
    },
    null,
    2,
  ),
);
