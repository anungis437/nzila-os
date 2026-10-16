import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const closeoutPath = "docs/union-eyes/reality-remediation/PHASE_1A_2_FINAL_SOURCE_CLOSEOUT.json";
const censusPath = "docs/union-eyes/PHASE_1A_USER_SURFACE_CENSUS.json";
const outputJsonPath = "docs/union-eyes/reality-remediation/PHASE_1A_3A_BUSINESS_CAPABILITY_MODEL.json";
const outputMarkdownPath = "docs/union-eyes/reality-remediation/PHASE_1A_3A_BUSINESS_CAPABILITY_MODEL.md";

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const unique = (values) => [...new Set(values)];
const sorted = (values) => [...values].sort((a, b) => String(a).localeCompare(String(b)));
const countBy = (values, key) => {
  const result = {};
  for (const value of values) result[key(value)] = (result[key(value)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
};

const closeout = readJson(closeoutPath);
const surfaceCensus = readJson(censusPath);
assert(closeout.metadata.status === "SOURCE_CEILING_ACCEPTED", "Phase 1A.2 closeout is not accepted");
assert(closeout.bindings.length === 644, "Expected exactly 644 closed canonical bindings");
assert(closeout.obligationRegister.sourceCeilingBindingObligations.length === 230, "Expected 230 binding source-ceiling obligations");
assert(closeout.obligationRegister.residualEffectChainObligations.length === 247, "Expected 247 residual effect-chain obligations");

const legacyRecords = surfaceCensus.capabilityRegistryReconciliation.records;
assert(legacyRecords.length === 31, `Expected 31 legacy registry rows; found ${legacyRecords.length}`);
assert(
  surfaceCensus.derivedCapabilityIndex.records.every((candidate) => candidate.evidenceClass === "UNKNOWN"),
  "The prior derived-capability label census unexpectedly contains non-UNKNOWN evidence classes",
);

const PERSONAS = [
  "MEMBER",
  "STAFF",
  "EXECUTIVE",
  "GOVERNANCE",
  "ADMIN",
  "PUBLIC",
  "MULTI_PERSONA",
  "OTHER_EXPLICIT",
];
const DOMAINS = [
  "MEMBERSHIP",
  "GRIEVANCE_CASE",
  "COMMUNICATION",
  "DOCUMENT_EVIDENCE",
  "FINANCE_DUES",
  "GOVERNANCE",
  "ELECTION",
  "HEALTH_SAFETY",
  "ORGANIZING",
  "STRIKE",
  "LEARNING_TRAINING",
  "KNOWLEDGE_TRANSFER",
  "REPORTING_ANALYTICS",
  "ADMINISTRATION",
  "IDENTITY",
  "OTHER_EXPLICIT",
];

function personaValues(binding) {
  const aliases = {
    SYSTEM: "OTHER_EXPLICIT",
    PUBLIC: "PUBLIC",
    MEMBER: "MEMBER",
    STAFF: "STAFF",
    EXECUTIVE: "EXECUTIVE",
    ADMIN: "ADMIN",
    MULTI_PERSONA: "MULTI_PERSONA",
    GOVERNANCE: "GOVERNANCE",
  };
  const original = binding.persona.sourceAudienceClasses ?? [];
  const values = unique(original.map((value) => aliases[value] ?? "OTHER_EXPLICIT"));
  return values.length > 1 ? ["MULTI_PERSONA"] : values;
}

function evidenceText(binding) {
  return [
    binding.bindingId,
    binding.sourceLocation.file,
    binding.sourceLocation.handlerIdentity,
    ...(binding.sourceActionFamily.familyName ? [binding.sourceActionFamily.familyName] : []),
    ...(binding.intentCandidate.directCallTargets ?? []),
    ...(binding.intentCandidate.candidateText ?? []),
    ...binding.serverEffectChains.map((chain) => chain.businessOperation ?? ""),
  ].join(" ").toLowerCase();
}

const cap = (
  id,
  name,
  businessDefinition,
  domain,
  criticality,
  match,
  options = {},
) => ({
  id,
  name,
  businessDefinition,
  domain,
  criticality,
  match,
  parentId: options.parentId ?? null,
  dependencies: options.dependencies ?? [],
  primaryPersonaPreference: options.primaryPersonaPreference ?? [],
  continuityTags: options.continuityTags ?? [],
  aiAssisted: options.aiAssisted ?? false,
  underlyingCapabilityIds: options.underlyingCapabilityIds ?? [],
  newDomainJustification: options.newDomainJustification ?? null,
});

const capabilityDefinitions = [
  cap(
    "MEMBER_RECORDS",
    "Create and maintain member records",
    "Create, inspect, update, transfer, and export member records or member-specific information.",
    "MEMBERSHIP",
    "CORE",
    (b, text) => /members-console|members\/new|member-profile|member-record|organization-members|membercertificates/.test(text) &&
      !/payment-history|deduction-history|report-deduction|memberlearningportal/.test(text),
    { primaryPersonaPreference: ["ADMIN", "STAFF", "MEMBER"], continuityTags: ["institutional_record_retention"] },
  ),
  cap(
    "ORGANIZATION_STRUCTURE",
    "Maintain organizational and bargaining-unit structure",
    "Manage the union, local, organization, committee, and bargaining-unit structure represented in the action graph.",
    "MEMBERSHIP",
    "CORE",
    (b, text) => /organization-tree|organization-selector|organization-members|bulk-operations|bulk-import-organizations|union-structure|bargaining-unit/.test(text) &&
      !/case|grievance|committee-meeting/.test(text),
    { primaryPersonaPreference: ["ADMIN", "GOVERNANCE"], continuityTags: ["institutional_record_retention"] },
  ),
  cap(
    "USER_ACCESS",
    "Invite users and administer access",
    "Initiate user invitations and manage account, sign-in, profile, or access-administration steps evidenced in the closed action graph.",
    "IDENTITY",
    "MATERIAL",
    (b, text) => /login|sign-in|signout|sign-out|mfa|magic.?link|sso|invite|access-control|user-role|permission|account-settings|session/.test(text),
    { primaryPersonaPreference: ["ADMIN", "STAFF", "MEMBER"], dependencies: ["ORGANIZATION_STRUCTURE"] },
  ),
  cap(
    "CASE_RECORDS",
    "Create and maintain grievance and claim matters",
    "Create, review, update, or triage grievance, claim, incident, or related institutional matter records.",
    "GRIEVANCE_CASE",
    "CORE",
    (b, text) => /grievance|claim|case-management|case-record|claim-list|claim-workbook|investigation/.test(text) &&
      !/deadline|evidence|communication|correspondence|triage|assignment|precedent|clause/.test(text),
    { primaryPersonaPreference: ["STAFF", "MEMBER", "GOVERNANCE"], continuityTags: ["institutional_record_retention"] },
  ),
  cap(
    "CASE_RESPONSIBILITY",
    "Assign and reassign case responsibility",
    "Select, assign, transfer, or coordinate responsibility for member or case work where the source action identifies that job.",
    "GRIEVANCE_CASE",
    "CORE",
    (b, text) => /assign|reassign|assignment|transfer|dispatch|steward-recommendation|work-queue|triage/.test(text) &&
      /grievance|claim|case|steward|dispatch|organization|member|workbook/.test(text),
    { primaryPersonaPreference: ["STAFF", "GOVERNANCE"], dependencies: ["CASE_RECORDS"], continuityTags: ["ownership_assignment"] },
  ),
  cap(
    "CASE_DEADLINES",
    "Calculate and manage matter deadlines",
    "Calculate or act on statutory, claim, grievance, or matter deadlines represented in the closed graph; no reminder-engine behavior is inferred.",
    "GRIEVANCE_CASE",
    "CORE",
    (b, text) => /deadline|limitation-period|jurisdictional-clock/.test(text) &&
      !/deadline-engine|reminder-scheduler|overdue-notifications/.test(text),
    { primaryPersonaPreference: ["STAFF", "GOVERNANCE"], dependencies: ["CASE_RECORDS"], continuityTags: ["deadline_continuity"] },
  ),
  cap(
    "CASE_COMMUNICATIONS",
    "Record and manage communications about a matter",
    "Compose, review, or associate correspondence and communications with a grievance, claim, or other institutional matter.",
    "COMMUNICATION",
    "CORE",
    (b, text) => /correspondence|new-letter-composer|case-communication|matter-communication|grievance.*messag|claim.*messag/.test(text),
    { primaryPersonaPreference: ["STAFF", "MEMBER"], dependencies: ["CASE_RECORDS"], continuityTags: ["case_communications"] },
  ),
  cap(
    "CASE_EVIDENCE",
    "Capture and retrieve matter evidence",
    "Upload, share, compare, or retrieve documents and other evidence in support of a case, claim, grievance, or collective agreement.",
    "DOCUMENT_EVIDENCE",
    "CORE",
    (b, text) => /evidence|uploadgoverneddocument|clause-library|clauselibrary|clausecompare|clauseviewer|clausesharing|clausetag|document.*case|case.*document/.test(text),
    { primaryPersonaPreference: ["STAFF", "MEMBER", "GOVERNANCE"], dependencies: ["CASE_RECORDS"], continuityTags: ["restricted_evidence_continuity", "institutional_record_retention"] },
  ),
  cap(
    "COLLECTIVE_BARGAINING",
    "Develop and compare collective-bargaining positions",
    "Explore collective agreements, compare clauses or benchmarks, and manage bargaining proposals or review tasks represented in the graph.",
    "OTHER_EXPLICIT",
    "MATERIAL",
    (b, text) => /bargaining|cba-intelligence|agreement-explorer|benchmark-view|freshness-dashboard|review-queue|proposalmanager|clause-reasoning|clause-suggestions/.test(text),
    {
      primaryPersonaPreference: ["STAFF", "GOVERNANCE", "EXECUTIVE"],
      continuityTags: ["institutional_record_retention", "knowledge_context_preservation"],
      newDomainJustification: "Collective bargaining is directly named by closed action-graph surfaces, but the supplied finalized taxonomy has no bargaining domain; OTHER_EXPLICIT is used rather than misclassifying this as grievance casework.",
    },
  ),
  cap(
    "CALENDAR_MEETINGS",
    "Schedule and manage institutional events",
    "Create, update, select, or synchronize calendar events and meetings represented by source-bound actions.",
    "GOVERNANCE",
    "MATERIAL",
    (b, text) => /calendar|meeting-schedul|schedulemeeting|events/.test(text) &&
      !/deadline|reminder-scheduler|overdue/.test(text),
    { primaryPersonaPreference: ["STAFF", "GOVERNANCE"], continuityTags: ["deadline_continuity"] },
  ),
  cap(
    "GOVERNANCE_ADMINISTRATION",
    "Administer committees and union governance",
    "Manage governance records, committee work, reserved matters, votes, and institutional oversight actions.",
    "GOVERNANCE",
    "CORE",
    (b, text) => /governance|committee|reserved-matter|golden-share|classavote|classbvote|audit|union-structure/.test(text) &&
      !/calendar|meeting-schedul/.test(text),
    { primaryPersonaPreference: ["GOVERNANCE", "EXECUTIVE", "ADMIN"], continuityTags: ["institutional_record_retention", "auditability"] },
  ),
  cap(
    "ELECTIONS",
    "Administer elections and ballot participation",
    "Set up election candidates or processes and support the ballot-selection or submission steps present in the source graph.",
    "ELECTION",
    "MATERIAL",
    (b, text) => /election|ballot|candidate|submitballot|voting/.test(text),
    { primaryPersonaPreference: ["GOVERNANCE", "MEMBER"], continuityTags: ["institutional_record_retention"] },
  ),
  cap(
    "HEALTH_SAFETY_CASES",
    "Manage workplace health and safety matters",
    "Record, inspect, report, or follow up on workplace safety incidents, hazards, corrective actions, and inspection findings.",
    "HEALTH_SAFETY",
    "CORE",
    (b, text) => /health-safety|incident|hazard|inspection|corrective-action|ppe-distribution|safety-committee|safetycommittee/.test(text),
    { primaryPersonaPreference: ["STAFF", "MEMBER", "GOVERNANCE"], continuityTags: ["ownership_assignment", "institutional_record_retention"] },
  ),
  cap(
    "ORGANIZING_CAMPAIGNS",
    "Plan and coordinate organizing campaigns",
    "Create, review, target, or coordinate organizing campaigns and related member-engagement work represented in the graph.",
    "ORGANIZING",
    "CORE",
    (b, text) => /organizing|campaign|targets-console|target.*campaign/.test(text),
    { primaryPersonaPreference: ["STAFF", "GOVERNANCE"], continuityTags: ["ownership_assignment"] },
  ),
  cap(
    "STRIKE_ACTION",
    "Administer strike-related institutional work",
    "Manage strike funds or other strike-related actions explicitly represented in the graph.",
    "STRIKE",
    "MATERIAL",
    (b, text) => /strike/.test(text),
    { primaryPersonaPreference: ["GOVERNANCE", "EXECUTIVE", "STAFF"], continuityTags: ["institutional_record_retention"] },
  ),
  cap(
    "MEMBER_DUES_SELF_SERVICE",
    "Review dues, deductions, and payment records",
    "Review member dues, payroll deductions, receipts, or payment details and report a deduction issue; payment completion is not inferred.",
    "FINANCE_DUES",
    "MATERIAL",
    (b, text) => /components\/dues|dashboard\/dues\/pay|dashboard\/dues\/receipts|payment-history|deduction-history|report-deduction-issue|payment-success-popup/.test(text),
    { primaryPersonaPreference: ["MEMBER"], continuityTags: ["institutional_record_retention"] },
  ),
  cap(
    "DUES_REMITTANCE_ADMIN",
    "Administer dues and remittance records",
    "Review, calculate, reconcile, or report on institutional dues, remittances, billing cycles, and payment records.",
    "FINANCE_DUES",
    "MATERIAL",
    (b, text) => /dashboard\/admin\/dues|remittance|billing-cycle|dues-reports|dues-dashboard|dues-management/.test(text),
    { primaryPersonaPreference: ["ADMIN", "STAFF", "EXECUTIVE"], dependencies: ["MEMBER_DUES_SELF_SERVICE"], continuityTags: ["institutional_record_retention", "auditability"] },
  ),
  cap(
    "FINANCIAL_PLANNING",
    "Manage budgets and organizational expenses",
    "Prepare or review budgets, expense requests, vendor records, financial forecasts, and related institutional reporting.",
    "FINANCE_DUES",
    "MATERIAL",
    (b, text) => /financial|finance|budget|expense|vendor|payroll/.test(text) &&
      !/dues|payment-history|payment-portal|remittance/.test(text),
    { primaryPersonaPreference: ["ADMIN", "STAFF", "EXECUTIVE"], continuityTags: ["institutional_record_retention", "auditability"] },
  ),
  cap(
    "GENERAL_COMMUNICATIONS",
    "Manage organizational communications",
    "Manage communications, message threads, notification preferences, templates, or announcements not specifically tied to one case.",
    "COMMUNICATION",
    "MATERIAL",
    (b, text) => /communication|message|notification|announcement|email-template|newsletter|inbox|subscriber|contact-list|survey/.test(text) &&
      !/case|grievance|correspondence/.test(text),
    { primaryPersonaPreference: ["STAFF", "ADMIN", "MEMBER"], continuityTags: ["institutional_record_retention"] },
  ),
  cap(
    "ARBITRATION_PRECEDENT_KNOWLEDGE",
    "Maintain arbitration precedents and jurisdiction preferences",
    "Review, maintain, or configure arbitration-precedent records and jurisdiction preferences explicitly represented in the closed action graph.",
    "OTHER_EXPLICIT",
    "MATERIAL",
    (b, text) => /precedent|jurisdiction-preferences/.test(text),
    {
      primaryPersonaPreference: ["STAFF", "GOVERNANCE"],
      continuityTags: ["knowledge_context_preservation", "institutional_record_retention"],
      newDomainJustification: "The closed action graph explicitly identifies arbitration precedents and jurisdiction preferences, which are not a named finalized domain; OTHER_EXPLICIT avoids conflating them with grievance case records.",
    },
  ),
  cap(
    "DOCUMENT_LIBRARY",
    "Manage institutional documents and records",
    "Upload, organize, retrieve, or export institutional documents where the closed action graph supports a document-handling job outside case evidence.",
    "DOCUMENT_EVIDENCE",
    "MATERIAL",
    (b, text) => /document|file-library|file-upload|upload|attachment|bulk-import|content-workflow/.test(text) &&
      !/case|grievance|claim|clause|evidence/.test(text),
    { primaryPersonaPreference: ["STAFF", "ADMIN", "GOVERNANCE"], continuityTags: ["institutional_record_retention"] },
  ),
  cap(
    "LEARNING_TRAINING",
    "Manage member learning and training",
    "Access or administer courses, member learning, and training certificates identified in source-bound actions.",
    "LEARNING_TRAINING",
    "MATERIAL",
    (b, text) => /learning|training|course|certificate|education|membercertificates|memberlearningportal/.test(text),
    { primaryPersonaPreference: ["MEMBER", "STAFF"], continuityTags: ["knowledge_context_preservation"] },
  ),
  cap(
    "KNOWLEDGE_HANDOFF",
    "Preserve and transfer institutional knowledge",
    "Capture, organize, or transfer institutional context, memory-holder information, and responsibility during personnel or representative transitions.",
    "KNOWLEDGE_TRANSFER",
    "CORE",
    (b, text) => /knowledge|memory-holder|memoryholders|continuity|succession|workbook|handoff|propagation/.test(text),
    { primaryPersonaPreference: ["STAFF", "GOVERNANCE", "EXECUTIVE"], continuityTags: ["successor_handoff", "knowledge_context_preservation", "institutional_record_retention"] },
  ),
  cap(
    "INSTITUTIONAL_REPORTING",
    "Generate and export institutional reports",
    "Generate, refresh, inspect, or export dashboards, analytics, reports, and institutional data extracts.",
    "REPORTING_ANALYTICS",
    "MATERIAL",
    (b, text) => /report|analytics|dashboard|insight|export|leadership-export|employer-hotspots/.test(text) &&
      !/dues|case|claim|health-safety|pilot|bargaining/.test(text),
    { primaryPersonaPreference: ["STAFF", "ADMIN", "EXECUTIVE", "GOVERNANCE"], continuityTags: ["institutional_record_retention"] },
  ),
  cap(
    "PILOT_ADMINISTRATION",
    "Coordinate pilot onboarding and administration",
    "Review pilot applications, onboarding, readiness, feedback, and proposal-package actions in the source graph.",
    "ADMINISTRATION",
    "SUPPORTING",
    (b, text) => /pilot|onboarding-console|pilot-feedback|readiness-checklist/.test(text) &&
      !/pilot-request|marketing/.test(text),
    { primaryPersonaPreference: ["ADMIN", "STAFF"] },
  ),
  cap(
    "PUBLIC_INQUIRIES",
    "Receive public inquiries and pilot requests",
    "Collect public contact or pilot-request information through source-bound form and submission actions.",
    "OTHER_EXPLICIT",
    "SUPPORTING",
    (b, text) => /contact-form|pilot-request|public-inquiry|contact.*submit/.test(text),
    {
      primaryPersonaPreference: ["PUBLIC"],
      newDomainJustification: "The taxonomy has no public-relations domain; the graph contains explicit public inquiry/request workflows, retained as OTHER_EXPLICIT.",
    },
  ),
  cap(
    "WORKPLACE_RISK_ASSESSMENT",
    "Complete workplace risk assessments",
    "Capture assessment responses and associated consent steps represented by ICRA assessment actions.",
    "OTHER_EXPLICIT",
    "MATERIAL",
    (b, text) => /icraassessmentflow|icra\/|risk-assessment/.test(text),
    {
      primaryPersonaPreference: ["STAFF", "GOVERNANCE"],
      newDomainJustification: "The closed graph explicitly represents ICRA assessment actions, while the finalized taxonomy has no distinct workplace risk-assessment domain.",
    },
  ),
  cap(
    "MEMBER_RECOGNITION",
    "Nominate and redeem member recognition",
    "Submit peer nominations or redemption requests in the recognition actions present in the closed graph.",
    "OTHER_EXPLICIT",
    "SUPPORTING",
    (b, text) => /rewards|peer-nomination|redemption-form/.test(text),
    {
      primaryPersonaPreference: ["MEMBER"],
      newDomainJustification: "The source graph contains explicit peer nomination and redemption actions, while the finalized taxonomy has no recognition domain.",
    },
  ),
  cap(
    "TRUSTEE_PENSION_PORTAL",
    "Access trustee and pension workflows",
    "Use trustee or pension-specific action paths represented in the closed graph; no wider pension administration capability is inferred.",
    "OTHER_EXPLICIT",
    "SUPPORTING",
    (b, text) => /pension|trustee-portal/.test(text),
    {
      primaryPersonaPreference: ["GOVERNANCE", "EXECUTIVE"],
      newDomainJustification: "The action graph identifies trustee/pension-specific work not named by the supplied finalized domain taxonomy.",
    },
  ),
  cap(
    "ORGANIZATION_RISK_CONTROLS",
    "Review organizational compliance and risk controls",
    "Perform explicit institutional compliance, consent, or risk-control actions evidenced in source-bound handlers.",
    "ADMINISTRATION",
    "SUPPORTING",
    (b, text) => /compliance|consentgate|consent|privacy|gdpr/.test(text) &&
      !/cookie-consent|banner/.test(text),
    { primaryPersonaPreference: ["ADMIN", "GOVERNANCE"] },
  ),
  cap(
    "WORK_COORDINATION",
    "Coordinate operational work queues",
    "Review and coordinate dispatch or workbench actions that are explicitly represented as work coordination, without asserting a case outcome.",
    "OTHER_EXPLICIT",
    "SUPPORTING",
    (b, text) => /dispatch|workbench-console|work-queue/.test(text),
    {
      primaryPersonaPreference: ["STAFF", "ADMIN"],
      newDomainJustification: "Dispatch/workbench coordination appears in the closed action graph but is not a named finalized domain; OTHER_EXPLICIT avoids an invented taxonomy domain.",
    },
  ),
  cap(
    "APPLICATION_ADMINISTRATION",
    "Configure and administer the application",
    "Perform administrative setup, configuration, data maintenance, system controls, and operational settings evidenced by named actions.",
    "ADMINISTRATION",
    "SUPPORTING",
    (b, text) => /admin|settings|configuration|bulk-operation|bulk-import|cache|database|system-health|organization-config/.test(text) &&
      !/dues|remittance|pilot|user-access|identity/.test(text),
    { primaryPersonaPreference: ["ADMIN"] },
  ),
  cap(
    "AI_CASE_ASSISTANCE",
    "AI-assisted case and steward support",
    "Provide AI/copilot-oriented case triage, employer-risk, or steward-support steps represented in the action graph; this is separate from matter ownership or resolution.",
    "GRIEVANCE_CASE",
    "SUPPORTING",
    (b, text) => /components\/ai\/(?:ai-chatbot|employer-risk-card|grievance-triage-card|steward-copilot-drawer)|steward-recommendations/.test(text),
    { primaryPersonaPreference: ["STAFF", "MEMBER"], aiAssisted: true, underlyingCapabilityIds: ["CASE_RECORDS"] },
  ),
  cap(
    "AI_COLLECTIVE_AGREEMENT_ASSISTANCE",
    "AI-assisted collective-agreement analysis",
    "Provide AI or generated clause and agreement-analysis steps represented in the graph, separately from collective-bargaining records and decisions.",
    "OTHER_EXPLICIT",
    "SUPPORTING",
    (b, text) => /clause-reasoning|clause-suggestions|cba-intelligence|agreement-explorer|benchmark-view/.test(text),
    {
      primaryPersonaPreference: ["STAFF", "GOVERNANCE"],
      aiAssisted: true,
      underlyingCapabilityIds: ["COLLECTIVE_BARGAINING"],
      newDomainJustification: "Collective-agreement assistance follows the explicit bargaining domain exception described for COLLECTIVE_BARGAINING.",
    },
  ),
];

const capsById = new Map(capabilityDefinitions.map((definition) => [definition.id, definition]));
for (const definition of capabilityDefinitions) {
  assert(DOMAINS.includes(definition.domain), `${definition.id} uses an unsupported domain`);
  assert(["CORE", "MATERIAL", "SUPPORTING"].includes(definition.criticality), `${definition.id} has invalid criticality`);
}

const nonBusinessRules = [
  {
    id: "SHARED_PRESENTATION_OR_NAVIGATION",
    description: "Shared UI affordances, navigation, visual-only controls, or presentation state with no independently evidenced institutional job.",
    matches: /components\/(?:ui\/|language-switcher|onboarding-overlay|onboarding-provider|onboarding\/|action-hint|sidebar|compliance\/qc-bilingual-banner|gdpr\/cookie-consent-banner|cancellation-popup|payment-success-popup|mobile\/(?:syncstatus|mobileheader)|monitoring\/statuspage|pilot\/demo-data-badge|empty-state|organizational-continuity-risk\/.*humanscenescarousel|workspace\/deep-work-link)|\/error\.tsx|sentry-example-page|data-table-advanced|pricing\/_components\/pricing-tabs/,
  },
];

const sourceCeilingByBinding = new Map();
for (const obligation of closeout.obligationRegister.sourceCeilingBindingObligations) {
  const obligations = sourceCeilingByBinding.get(obligation.bindingId) ?? [];
  obligations.push(obligation.obligationId);
  sourceCeilingByBinding.set(obligation.bindingId, obligations);
}
for (const obligation of closeout.obligationRegister.residualEffectChainObligations) {
  const obligations = sourceCeilingByBinding.get(obligation.bindingId) ?? [];
  obligations.push(obligation.obligationId);
  sourceCeilingByBinding.set(obligation.bindingId, obligations);
}

function classifyBinding(binding) {
  const text = evidenceText(binding);
  const matched = capabilityDefinitions.filter((definition) => definition.match(binding, text));
  const capIds = matched.map((definition) => definition.id);
  if (capIds.length === 0) {
    const nonBusiness = nonBusinessRules.find((rule) => rule.matches.test(text));
    if (nonBusiness) {
      return {
        capabilityIds: [],
        classification: "NON_BUSINESS_OR_INACTIVE",
        rationale: nonBusiness.description,
        nonBusinessClass: nonBusiness.id,
        crossCapability: false,
        crossCapabilityJustification: null,
      };
    }
    return {
      capabilityIds: [],
      classification: "UNMAPPED_BUSINESS_CANDIDATE",
      rationale: "No conservative evidence-backed capability rule matched this binding; it requires explicit review rather than forced mapping.",
      nonBusinessClass: null,
      crossCapability: false,
      crossCapabilityJustification: null,
    };
  }

  let retained = capIds;
  let justification = null;
  if (capIds.includes("AI_CASE_ASSISTANCE") && capIds.includes("CASE_RECORDS")) {
    retained = ["AI_CASE_ASSISTANCE", "CASE_RECORDS"];
    justification = "This binding is an explicit AI/copilot action within a case-support workflow; it contributes both the distinct assist capability and the underlying case-work capability.";
  } else if (capIds.includes("AI_COLLECTIVE_AGREEMENT_ASSISTANCE") && capIds.includes("COLLECTIVE_BARGAINING")) {
    retained = ["AI_COLLECTIVE_AGREEMENT_ASSISTANCE", "COLLECTIVE_BARGAINING"];
    justification = "This binding is an explicit AI/analysis action within a collective-agreement workflow; both the distinct assistance capability and underlying bargaining capability are represented.";
  } else if (capIds.includes("USER_ACCESS") && capIds.includes("MEMBER_RECORDS")) {
    retained = ["USER_ACCESS", "MEMBER_RECORDS"];
    justification = "The action both administers an access/invitation step and is a member-record operation, as named by its source action evidence.";
  } else {
    retained = [capIds[0]];
  }
  return {
    capabilityIds: retained,
    classification: "BUSINESS_BINDING_MAPPED",
    rationale: "Mapped from the closed action binding, source action-family name, and bounded effect evidence; not inferred from page existence alone.",
    nonBusinessClass: null,
    crossCapability: retained.length > 1,
    crossCapabilityJustification: justification,
  };
}

const bindingCapabilityMap = closeout.bindings.map((binding) => {
  const classification = classifyBinding(binding);
  return {
    bindingId: binding.bindingId,
    capabilityIds: classification.capabilityIds,
    classification: classification.classification,
    rationale: classification.rationale,
    nonBusinessClass: classification.nonBusinessClass,
    sourceDisposition: binding.primaryDisposition,
    knownDefectIds: binding.rootFindingIds,
    knownDefectCategories: binding.knownDefectCategories,
    sourceCeilingObligationIds: sorted(unique(sourceCeilingByBinding.get(binding.bindingId) ?? [])),
    sourceActionFamilyKey: binding.sourceActionFamily.familyKey,
    closeoutActionFamilyKey: binding.actionFamilyKey,
  };
});

const businessMappedIds = new Set(
  bindingCapabilityMap.filter((entry) => entry.classification === "BUSINESS_BINDING_MAPPED").map((entry) => entry.bindingId),
);
const nonBusinessIds = new Set(
  bindingCapabilityMap.filter((entry) => entry.classification === "NON_BUSINESS_OR_INACTIVE").map((entry) => entry.bindingId),
);
const intentionallyDisabledIds = new Set(
  bindingCapabilityMap.filter((entry) => entry.classification === "INTENTIONALLY_DISABLED").map((entry) => entry.bindingId),
);
const unmappedBusinessIds = new Set(
  bindingCapabilityMap.filter((entry) => entry.classification === "UNMAPPED_BUSINESS_CANDIDATE").map((entry) => entry.bindingId),
);

const capabilityRecords = [];
for (const definition of capabilityDefinitions) {
  const mapRows = bindingCapabilityMap.filter((entry) => entry.capabilityIds.includes(definition.id));
  if (mapRows.length === 0) continue;
  const bindings = mapRows.map((row) => closeout.bindings.find((binding) => binding.bindingId === row.bindingId));
  const defectRows = mapRows.filter((row) => row.knownDefectIds.length > 0 || row.knownDefectCategories.length > 0);
  const ceilingRows = mapRows.filter((row) => row.sourceCeilingObligationIds.length > 0);
  const disabledRows = mapRows.filter((row) => row.classification === "INTENTIONALLY_DISABLED");
  const hasDefects = defectRows.length > 0;
  const hasCeiling = ceilingRows.length > 0;
  let sourceStatus;
  if (hasDefects && hasCeiling) sourceStatus = "SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS";
  else if (hasDefects) sourceStatus = "SOURCE_MODEL_BOUNDED_WITH_DEFECTS";
  else if (hasCeiling) sourceStatus = "SOURCE_MODEL_HAS_CEILING_OBLIGATIONS";
  else if (disabledRows.length === mapRows.length) sourceStatus = "INTENTIONALLY_DISABLED";
  else sourceStatus = "SOURCE_MODEL_BOUNDED";

  const personasFor = (binding) => personaValues(binding);
  const allPersonas = sorted(unique(bindings.flatMap(personasFor)));
  const primaryPreference = definition.primaryPersonaPreference.filter((persona) => allPersonas.includes(persona));
  const primaryPersonas = primaryPreference.length > 0 ? primaryPreference : allPersonas.slice(0, 1);
  const secondaryPersonas = allPersonas.filter((persona) => !primaryPersonas.includes(persona));
  const sourceFamilyIds = sorted(unique(bindings.map((binding) => binding.sourceActionFamily.actionFamilyId)));
  const sourceActionFamilyKeys = sorted(unique(bindings.map((binding) => binding.sourceActionFamily.familyKey)));
  const sourceSurfaceValues = sorted(unique(bindings.map((binding) => binding.sourceLocation.sourceSurface)));
  const routeCandidates = sorted(unique(bindings.map((binding) => binding.sourceLocation.routePathCandidate).filter(Boolean)));
  const bindingIds = sorted(unique(mapRows.map((row) => row.bindingId)));
  const defectIds = sorted(unique(defectRows.flatMap((row) => row.knownDefectIds)));
  const defectCategories = sorted(unique(defectRows.flatMap((row) => row.knownDefectCategories)));
  const ceilingBindingIds = sorted(unique(ceilingRows.map((row) => row.bindingId)));
  const runtimeObligationIds = sorted(unique(ceilingRows.flatMap((row) => row.sourceCeilingObligationIds)));
  const sourceCompleteBindingIds = mapRows
    .filter((row) => !row.knownDefectIds.length && !row.knownDefectCategories.length && !row.sourceCeilingObligationIds.length)
    .map((row) => row.bindingId);
  capabilityRecords.push({
    capabilityId: definition.id,
    capabilityName: definition.name,
    businessDefinition: definition.businessDefinition,
    domain: definition.domain,
    newDomainJustification: definition.newDomainJustification,
    parentCapabilityId: definition.parentId,
    primaryPersonas,
    secondaryPersonas,
    personaEvidence: allPersonas,
    actionFamilyKeys: sourceActionFamilyKeys,
    actionFamilyIds: sourceFamilyIds,
    bindingIds,
    routes: routeCandidates,
    routeEvidenceKind: "SOURCE_PATH_CANDIDATE_ONLY",
    surfaces: sourceSurfaceValues,
    criticality: definition.criticality,
    capabilitySourceStatus: sourceStatus,
    runtimeProven: "NO",
    authorizationProven: "NO",
    persistenceProven: "NO",
    totalBindings: bindingIds.length,
    sourceGraphCompleteBindings: unique(sourceCompleteBindingIds).length,
    knownDefectBindings: unique(defectRows.map((row) => row.bindingId)).length,
    knownDefectIds: defectIds,
    knownDefectCategories: defectCategories,
    sourceCeilingBindings: ceilingBindingIds.length,
    sourceCeilingBindingIds: ceilingBindingIds,
    runtimeObligationIds,
    intentionallyDisabledBindings: unique(disabledRows.map((row) => row.bindingId)).length,
    dependsOnCapabilityIds: definition.dependencies,
    continuitySignals: definition.continuityTags,
    aiAssistedCapability: definition.aiAssisted,
    underlyingCapabilityIds: definition.underlyingCapabilityIds,
    actionEvidence: mapRows.map((row) => ({
      bindingId: row.bindingId,
      actionFamilyKey: row.sourceActionFamilyKey,
      sourceDisposition: row.sourceDisposition,
    })),
  });
}

const capabilityIdSet = new Set(capabilityRecords.map((record) => record.capabilityId));
for (const record of capabilityRecords) {
  assert(record.bindingIds.length > 0, `${record.capabilityId} has no binding evidence`);
  assert(record.actionFamilyKeys.length > 0, `${record.capabilityId} has no action-family evidence`);
  assert(record.runtimeProven === "NO", `${record.capabilityId} improperly claims runtime proof`);
  assert(record.knownDefectIds.length > 0 || record.knownDefectCategories.length === 0, `${record.capabilityId} has defect categories but no finding IDs`);
  assert(record.sourceCeilingBindings === 0 || record.runtimeObligationIds.length > 0, `${record.capabilityId} lacks inherited runtime obligations`);
  assert(record.dependsOnCapabilityIds.every((id) => capabilityIdSet.has(id)), `${record.capabilityId} has an unresolved capability dependency`);
}

const legacyCapabilityMap = {
  "UE-CRON-MONTHLY-DUES": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "The legacy item describes a scheduled backend job, not a user/institutional ability represented by the closed UI action graph." },
  "UE-CRON-OVERDUE-NOTIFICATIONS": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "Scheduled notification processing is a backend mechanism, not a distinct capability established by this user-facing action graph." },
  "UE-CRON-PROCESS-MESSAGES": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "Message processing is a scheduled backend mechanism; no user capability is inferred from the job label." },
  "UE-CRON-PROCESS-NOTIFICATIONS": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "Notification processing is a scheduled backend mechanism; user-facing notification actions are modeled separately." },
  "UE-CRON-SCHEDULED-REPORTS": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "The registry row describes a cron process, not the separate user-facing ability to inspect or generate reports." },
  "UE-ADMIN-PILOT-STATUS": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "An aggregator endpoint is implementation/observability plumbing; pilot-administration UI actions are separate and do not prove this endpoint capability." },
  "UE-FIN-BOC-EXCHANGE-RATE": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "FX resolution is a service behavior, not an independently evidenced user capability in the closed action graph." },
  "UE-DEMO-SEPARATE-PACKAGE": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "Package separation is a delivery/build property, not a business capability." },
  "UE-BUILD-OPERATIONAL-ISOLATION": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "Operational build isolation is a deployment property; sidebar actions do not turn it into a user capability." },
  "UE-DASH-REPORTS-INDEX": { disposition: "NO_SOURCE_SUPPORT", ids: [], rationale: "The registry explicitly marks the reports-index surface removed; do not retain a capability on its historical label." },
  "UE-DASH-DEBUG": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "A dev-only debug page is not a business capability in the current user-facing model." },
  "UE-DEV-SENTRY-EXAMPLE": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "A dev-only Sentry example page and its known missing implementation are not a Union Eyes business capability." },
  "UE-DEADLINE-CORE": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "The registry row is a schema/engine implementation item; the closed graph's deadline actions are modeled separately." },
  "UE-DEADLINE-REMINDERS": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "A reminder scheduler is a backend mechanism; no scheduler runtime capability is inferred." },
  "UE-DEADLINE-DELIVERY": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "Worker/provider delivery guarantees are infrastructure properties outside this user-action capability model." },
  "UE-DEADLINE-OVERDUE": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "An overdue detector is a backend implementation item, not a separately evidenced user ability." },
  "UE-DEADLINE-RECOVERY": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "Lease recovery and append-only worker audit are backend mechanisms outside the closed UI action graph." },
  "UE-DEADLINE-WORKER-CLAIM": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "Worker locking/claim semantics are technical implementation details, not a business capability." },
  "UE-DEADLINE-EXECUTION-PERSISTENCE": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "Execution-row persistence is a backend implementation detail; persistence is unproven in this phase." },
  "UE-DEADLINE-PROVIDER-ACCEPTANCE": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "Provider acceptance is a delivery mechanism, not a user capability established by the action graph." },
  "UE-DEADLINE-DIRECT-DEAD-LETTER": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "Dead-letter handling is a worker failure mechanism outside this source-derived user capability model." },
  "UE-DUES-PORTAL-BALANCE": { disposition: "MERGED_INTO", ids: ["MEMBER_DUES_SELF_SERVICE"], rationale: "The closed graph contains member-facing dues/payment portal bindings; this maps to the broader source-bounded member dues self-service capability without asserting balance correctness." },
  "UE-DUES-PORTAL-PAYMENT-HISTORY": { disposition: "MERGED_INTO", ids: ["MEMBER_DUES_SELF_SERVICE"], rationale: "Payment-history action bindings are part of the same member dues self-service job; the inherited source ceiling remains visible." },
  "UE-DUES-PORTAL-ISSUE-REPORTING": { disposition: "MERGED_INTO", ids: ["MEMBER_DUES_SELF_SERVICE"], rationale: "The source graph has a dues issue-reporting action; keep it within member dues self-service rather than inflate a separate capability." },
  "UE-DUES-PORTAL-DEDUCTIONS": { disposition: "MERGED_INTO", ids: ["MEMBER_DUES_SELF_SERVICE"], rationale: "Deduction-history actions belong to the same member-facing dues self-service ability." },
  "UE-DUES-DIRECT-PAYMENT": { disposition: "MERGED_INTO", ids: ["MEMBER_DUES_SELF_SERVICE"], rationale: "The closed graph contains dues payment-selection actions, but does not prove payment completion; retain the action under member dues self-service with its ceiling obligation." },
  "UE-DEADLINE-ASSIGNMENT-CONTINUITY": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "The registry row makes a backend recipient-continuity claim that is not established by this closed action graph; case responsibility and deadlines remain separate modeled source actions." },
  "UE-CLAIM-DEADLINES-SURFACE": { disposition: "MERGED_INTO", ids: ["CASE_DEADLINES"], rationale: "The source graph includes jurisdictional deadline calculation actions; it does not establish the latent claim_deadlines table surface or persistence." },
  "UE-FIN-DUES-CALCULATION-WORKFLOW": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "A financial-service calculation workflow is a backend process, not independently established by the user-facing action graph." },
  "UE-FIN-DUES-REMINDER-SCHEDULER": { disposition: "OUTSIDE_CURRENT_SCOPE", ids: [], rationale: "A reminder scheduler is a backend process; no runtime reminder capability is asserted." },
  "UE-ANALYTICS-SCHEDULED-REPORTS-UI": { disposition: "MERGED_INTO", ids: ["INSTITUTIONAL_REPORTING"], rationale: "Scheduled-report UI labels are not a separate capability; any source-supported report actions belong to institutional reporting, with defects/ceilings inherited per binding." },
};

const legacyRegistryReconciliation = legacyRecords.map((legacy) => {
  const reconciliation = legacyCapabilityMap[legacy.id];
  assert(reconciliation, `Legacy registry row has no reconciliation: ${legacy.id}`);
  assert(
    reconciliation.ids.every((id) => capabilityIdSet.has(id)),
    `Legacy registry row ${legacy.id} points to a capability without action evidence`,
  );
  return {
    legacyCapability: {
      id: legacy.id,
      title: legacy.title,
      registryState: legacy.state,
      censusDisposition: legacy.disposition,
      ownerPaths: legacy.ownedBy,
    },
    disposition: reconciliation.disposition,
    canonicalCapabilityIds: reconciliation.ids,
    rationale: reconciliation.rationale,
  };
});

const legacyDispositionCounts = countBy(legacyRegistryReconciliation, (record) => record.disposition);
const unmappedLegacy = legacyRegistryReconciliation.filter((record) => !record.disposition);
const crossCapabilityBindings = bindingCapabilityMap.filter((entry) => entry.capabilityIds.length > 1);
const capabilitiesWithDefects = capabilityRecords.filter((record) => record.knownDefectBindings > 0);
const capabilitiesWithCeiling = capabilityRecords.filter((record) => record.sourceCeilingBindings > 0);
const capabilitiesWithBoth = capabilityRecords.filter((record) => record.knownDefectBindings > 0 && record.sourceCeilingBindings > 0);
const capabilitiesWithNeither = capabilityRecords.filter((record) => record.knownDefectBindings === 0 && record.sourceCeilingBindings === 0);

const statusCounts = countBy(capabilityRecords, (record) => record.capabilitySourceStatus);
const criticalityCounts = countBy(capabilityRecords, (record) => record.criticality);
const domainCounts = countBy(capabilityRecords, (record) => record.domain);
const personaCounts = Object.fromEntries(PERSONAS.map((persona) => [
  persona,
  capabilityRecords.filter((record) =>
    record.primaryPersonas.includes(persona) || record.secondaryPersonas.includes(persona),
  ).length,
]));
const bindingStatus = {
  totalCanonicalBindings: closeout.bindings.length,
  businessBindingsMappedToCapability: businessMappedIds.size,
  nonBusinessOrInactiveBindings: nonBusinessIds.size,
  intentionallyDisabledBindings: intentionallyDisabledIds.size,
  unmappedBusinessBindings: unmappedBusinessIds.size,
};
const bindingCoverage = {
  ...bindingStatus,
  totalCanonicalBindings: 644,
  unmappedBusinessBindingIds: sorted(unmappedBusinessIds),
  nonBusinessOrInactiveBindingIds: sorted(nonBusinessIds),
  intentionallyDisabledBindingIds: sorted(intentionallyDisabledIds),
};
const sourceCeilingBindingIds = new Set(closeout.sourceCeiling.b1TraceCandidateBindingIds.concat(
  closeout.sourceCeiling.b1NoInRepositoryCallerBindingIds,
  closeout.sourceCeiling.r2eResidualBindingIds,
));
assert(sourceCeilingBindingIds.size === 230, `Expected 230 unique source-ceiling bindings; found ${sourceCeilingBindingIds.size}`);
const knownDefectBindingIds = new Set(
  closeout.bindings.filter((binding) => binding.knownDefectCategories.length > 0).map((binding) => binding.bindingId),
);
const businessBindingIds = new Set(
  bindingCapabilityMap.filter((row) => row.classification === "BUSINESS_BINDING_MAPPED").map((row) => row.bindingId),
);
const capBindingIds = new Set(bindingCapabilityMap.filter((row) => row.capabilityIds.length).map((row) => row.bindingId));
const businessSourceCeilingBindingIds = new Set([...sourceCeilingBindingIds].filter((id) => businessBindingIds.has(id)));
const sourceCeilingBindingLevelOnlyIds = sorted([...sourceCeilingBindingIds].filter((id) => !businessBindingIds.has(id)));
const businessKnownDefectBindingIds = new Set([...knownDefectBindingIds].filter((id) => businessBindingIds.has(id)));
const missingSourceCeilingBindingMap = sorted(bindingCapabilityMap
  .filter((row) => sourceCeilingBindingIds.has(row.bindingId) && row.sourceCeilingObligationIds.length === 0)
  .map((row) => row.bindingId));
const missingCeilingMap = sorted([...businessSourceCeilingBindingIds].filter((id) => !capBindingIds.has(id)));
const missingDefectMap = sorted([...businessKnownDefectBindingIds].filter((id) => !capBindingIds.has(id)));

const dependencies = capabilityRecords.map((record) => ({
  capabilityId: record.capabilityId,
  dependsOnCapabilityIds: record.dependsOnCapabilityIds,
  relationshipType: "BUSINESS_PREREQUISITE",
}));
const continuityDimensions = [
  ["ownership_assignment", "ownership/assignment"],
  ["successor_handoff", "successor handoff"],
  ["institutional_record_retention", "institutional record retention"],
  ["deadline_continuity", "deadline continuity"],
  ["restricted_evidence_continuity", "restricted evidence continuity"],
  ["auditability", "auditability"],
  ["knowledge_context_preservation", "knowledge/context preservation"],
  ["case_communications", "case communications"],
];
const institutionalContinuityCapabilities = continuityDimensions.map(([tag, label]) => {
  const matches = capabilityRecords.filter((record) => record.continuitySignals.includes(tag));
  return {
    dimension: label,
    sourceModelContainsSignal: matches.length > 0,
    runtimeOrOperationalProof: "NO",
    capabilityIds: matches.map((record) => record.capabilityId),
    bindingIds: sorted(unique(matches.flatMap((record) => record.bindingIds))),
  };
});

const externalSpecialistDimensions = [
  "specialist_assignment",
  "case_or_evidence_handoff",
  "restricted_external_access",
  "document_intake",
  "status_or_communication_exchange",
  "external_party_role",
];
const externalSpecialistCapabilities = externalSpecialistDimensions.map((dimension) => ({
  dimension,
  sourceSupport: "NOT_ESTABLISHED",
  capabilityIds: [],
  bindingIds: [],
  interpretation: "No explicit external-specialist or WorkAid integration is established by the accepted capability evidence; shared case/document actions do not imply external-party roles or access.",
}));

const aiAssistedCapabilities = capabilityRecords
  .filter((record) => record.aiAssistedCapability)
  .map((record) => ({
    capabilityId: record.capabilityId,
    capabilityName: record.capabilityName,
    underlyingCapabilityIds: record.underlyingCapabilityIds,
    bindingIds: record.bindingIds,
    sourceCeilingBindingIds: record.sourceCeilingBindingIds,
    runtimeProven: "NO",
  }));

const sourceStatusSummary = {
  counts: {
    SOURCE_MODEL_BOUNDED: statusCounts.SOURCE_MODEL_BOUNDED ?? 0,
    SOURCE_MODEL_BOUNDED_WITH_DEFECTS: statusCounts.SOURCE_MODEL_BOUNDED_WITH_DEFECTS ?? 0,
    SOURCE_MODEL_HAS_CEILING_OBLIGATIONS: statusCounts.SOURCE_MODEL_HAS_CEILING_OBLIGATIONS ?? 0,
    SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS: statusCounts.SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS ?? 0,
    INTENTIONALLY_DISABLED: statusCounts.INTENTIONALLY_DISABLED ?? 0,
    SOURCE_MODEL_INSUFFICIENT: statusCounts.SOURCE_MODEL_INSUFFICIENT ?? 0,
  },
  definitions: capabilityRecords.map((record) => ({
    capabilityId: record.capabilityId,
    capabilitySourceStatus: record.capabilitySourceStatus,
    runtimeProven: record.runtimeProven,
  })),
};

const validation = {
  allCanonicalCapabilitiesHaveActionFamilyAndBindingEvidence: capabilityRecords.every(
    (record) => record.bindingIds.length > 0 && record.actionFamilyKeys.length > 0,
  ),
  allLegacyCuratedCapabilitiesReconciled: legacyRegistryReconciliation.length === 31 && unmappedLegacy.length === 0,
  allRelevantBusinessBindingsMapped: unmappedBusinessIds.size === 0,
  allSourceCeilingBindingsRetainedAtBindingLevel: missingSourceCeilingBindingMap.length === 0,
  allBusinessSourceCeilingBindingsInherited: missingCeilingMap.length === 0,
  allKnownDefectBusinessBindingsInherited: missingDefectMap.length === 0,
  noRuntimeClaimIntroduced: capabilityRecords.every((record) =>
    record.runtimeProven === "NO" && record.authorizationProven === "NO" && record.persistenceProven === "NO",
  ),
  noApplicationSourceInspected: true,
  noRuntimeActionExecuted: true,
  taxonomyAndPersonaEnumsValid: capabilityRecords.every((record) =>
    DOMAINS.includes(record.domain) &&
    record.primaryPersonas.concat(record.secondaryPersonas).every((persona) => PERSONAS.includes(persona)),
  ),
  bindingCoverageArithmetic: bindingStatus.businessBindingsMappedToCapability +
    bindingStatus.nonBusinessOrInactiveBindings +
    bindingStatus.intentionallyDisabledBindings +
    bindingStatus.unmappedBusinessBindings === bindingStatus.totalCanonicalBindings,
  noDuplicateBindingWithinCapability: capabilityRecords.every((record) =>
    record.bindingIds.length === new Set(record.bindingIds).size,
  ),
  dependenciesResolve: capabilityRecords.every((record) =>
    record.dependsOnCapabilityIds.every((id) => capabilityIdSet.has(id)),
  ),
};

const phaseGate = Object.values(validation).every(Boolean) &&
  sourceStatusSummary.counts.SOURCE_MODEL_INSUFFICIENT === 0
  ? "PASS"
  : "FAIL";

const output = {
  metadata: {
    title: "Phase 1A.3a Business Capability Model",
    evidenceBoundary: "Closed Phase 1A.2 source model and accepted Phase 1A documentation/index artifacts only.",
    primaryEvidence: closeoutPath,
    legacyRegistryEvidence: `${censusPath}#capabilityRegistryReconciliation`,
    applicationSourceInspected: false,
    runtimeActionExecuted: false,
    productCodeChanged: false,
  },
  phaseStatus: {
    phase1A3aGate: phaseGate,
    phase1A3aSourceModel: phaseGate === "PASS" ? "PASS" : "FAIL",
    capabilityRuntimeProven: "NO",
    capabilityAuthorizationProven: "NO",
    capabilityPersistenceProven: "NO",
    phase1A3: "NOT_YET_COMPLETE",
    phase1A: "NOT_YET_PROVEN",
    phase1B: "NOT_AUTHORIZED",
    productReady: "NO",
  },
  taxonomies: { domains: DOMAINS, personas: PERSONAS, criticalities: ["CORE", "MATERIAL", "SUPPORTING"] },
  capabilities: capabilityRecords,
  legacyRegistryReconciliation,
  bindingCapabilityMap,
  bindingCoverage,
  dependencyGraph: dependencies,
  domainSummary: domainCounts,
  personaSummary: personaCounts,
  sourceStatusSummary,
  criticalitySummary: criticalityCounts,
  legacyRegistrySummary: {
    legacyCuratedCapabilities: legacyRegistryReconciliation.length,
    dispositionCounts: legacyDispositionCounts,
    unreconciledLegacyCapabilities: unmappedLegacy.length,
  },
  sourceCeilingSummary: {
    sourceCeilingBindings: sourceCeilingBindingIds.size,
    sourceCeilingBindingsMappedToBusinessCapabilities: businessSourceCeilingBindingIds.size,
    sourceCeilingBindingsRetainedAtBindingLevelOnly: sourceCeilingBindingLevelOnlyIds.length,
    sourceCeilingBindingLevelOnlyIds,
    capabilityIdsWithSourceCeiling: capabilitiesWithCeiling.map((record) => record.capabilityId),
    capabilitiesWithSourceCeiling: capabilitiesWithCeiling.length,
    capabilitiesWithoutSourceCeiling: capabilityRecords.length - capabilitiesWithCeiling.length,
  },
  defectCeilingSummary: {
    capabilitiesWithKnownDefects: capabilitiesWithDefects.length,
    capabilitiesWithSourceCeiling: capabilitiesWithCeiling.length,
    capabilitiesWithBoth: capabilitiesWithBoth.length,
    capabilitiesWithNeither: capabilitiesWithNeither.length,
    overlapArithmetic: `${capabilitiesWithDefects.length} + ${capabilitiesWithCeiling.length} - ${capabilitiesWithBoth.length} = ${capabilitiesWithDefects.length + capabilitiesWithCeiling.length - capabilitiesWithBoth.length} capabilities with one or both conditions`,
  },
  institutionalContinuityCapabilities,
  externalSpecialistCapabilities: {
    workAidIntegrationInferred: false,
    supportedDimensions: [],
    dimensions: externalSpecialistCapabilities,
  },
  aiAssistedCapabilities,
  newFromSourceGraph: capabilityRecords
    .filter((record) => legacyRegistryReconciliation.every((legacy) => !legacy.canonicalCapabilityIds.includes(record.capabilityId)))
    .map((record) => ({
      capabilityId: record.capabilityId,
      capabilityName: record.capabilityName,
      whyLegacyRegistryMissedIt: "The prior registry is a list of implementation/owner-path claims, not a curated business-capability model; this source-graph ability was derived from coherent action bindings and has no legacy equivalence claim.",
    })),
  legacyDispositionCounts,
  crossCapabilityBindingCount: crossCapabilityBindings.length,
  crossCapabilityBindings,
  validation,
  summary: {
    canonicalCapabilities: capabilityRecords.length,
    criticalityCounts,
    sourceStatusCounts: sourceStatusSummary.counts,
    legacyCuratedCapabilities: legacyRegistryReconciliation.length,
    legacyDispositionCounts,
    unreconciledLegacyCapabilities: unmappedLegacy.length,
    newFromSourceGraphCount: capabilityRecords.filter((record) =>
      legacyRegistryReconciliation.every((legacy) => !legacy.canonicalCapabilityIds.includes(record.capabilityId)),
    ).length,
    capabilitiesWithSourceCeiling: capabilitiesWithCeiling.length,
    capabilitiesWithoutSourceCeiling: capabilityRecords.length - capabilitiesWithCeiling.length,
    capabilitiesWithKnownDefects: capabilitiesWithDefects.length,
    capabilitiesWithBothDefectsAndCeiling: capabilitiesWithBoth.length,
    capabilitiesWithNeither: capabilitiesWithNeither.length,
    crossCapabilityBindingCount: crossCapabilityBindings.length,
    bindingCoverage,
    phase1A3aGate: phaseGate,
  },
};

assert(bindingCapabilityMap.length === 644, "Binding map must have exactly 644 entries");
assert(bindingStatus.businessBindingsMappedToCapability + bindingStatus.nonBusinessOrInactiveBindings +
  bindingStatus.intentionallyDisabledBindings + bindingStatus.unmappedBusinessBindings === 644,
"Canonical binding coverage does not reconcile to 644");
assert(legacyRegistryReconciliation.length === 31, "Legacy registry count changed");
assert(unmappedLegacy.length === 0, "Legacy registry contains unreconciled items");
assert(missingCeilingMap.length === 0, `Source-ceiling bindings were not inherited: ${missingCeilingMap.join(", ")}`);
assert(missingDefectMap.length === 0, `Known-defect bindings were not inherited: ${missingDefectMap.join(", ")}`);

const table = (headers, rows) => [
  `| ${headers.join(" | ")} |`,
  `| ${headers.map(() => "---").join(" | ")} |`,
  ...rows.map((row) => `| ${row.map((value) => String(value).replaceAll("|", "\\|")).join(" | ")} |`),
].join("\n");
const statusOrder = [
  "SOURCE_MODEL_BOUNDED",
  "SOURCE_MODEL_BOUNDED_WITH_DEFECTS",
  "SOURCE_MODEL_HAS_CEILING_OBLIGATIONS",
  "SOURCE_MODEL_HAS_DEFECTS_AND_CEILING_OBLIGATIONS",
  "INTENTIONALLY_DISABLED",
  "SOURCE_MODEL_INSUFFICIENT",
];
const criticalityOrder = ["CORE", "MATERIAL", "SUPPORTING"];
const md = [
  "# Phase 1A.3a — Business Capability Model",
  "",
  `**PHASE_1A_3A_GATE = ${phaseGate}.** This is source-model derivation, not runtime proof. The Phase 1A.2 graph was treated as closed; no application source or runtime was inspected or executed.`,
  "",
  "## Canonical capability summary",
  "",
  `- **CANONICAL_CAPABILITIES = ${capabilityRecords.length}**`,
  ...criticalityOrder.map((criticality) => `- **${criticality} = ${criticalityCounts[criticality] ?? 0}**`),
  "",
  ...statusOrder.map((status) => `- **${status} = ${sourceStatusSummary.counts[status]}**`),
  `- **SUM = ${capabilityRecords.length} capabilities**`,
  "",
  "Every capability has `RUNTIME_PROVEN = NO`, `CAPABILITY_AUTHORIZATION_PROVEN = NO`, and `CAPABILITY_PERSISTENCE_PROVEN = NO`. The source-status categories describe evidence coverage and do not imply usability or readiness.",
  "",
  "## Capability catalog",
  "",
  table(
    ["ID", "Capability", "Domain", "Criticality", "Source status", "Bindings", "Defect bindings", "Ceiling bindings"],
    capabilityRecords.map((record) => [
      record.capabilityId,
      record.capabilityName,
      record.domain,
      record.criticality,
      record.capabilitySourceStatus,
      record.totalBindings,
      record.knownDefectBindings,
      record.sourceCeilingBindings,
    ]),
  ),
  "",
  "Definitions, persona evidence, source action-family keys, all binding IDs, route-path candidates, defect/root IDs, and obligation IDs are in the JSON capability records. A route candidate denotes source-path association only. There are no intentional-disabled capability claims because the closed closeout does not establish any binding as intentionally disabled; dynamic disabled attributes are not treated as intentional disablement.",
  "",
  "## Legacy curated registry reconciliation",
  "",
  `**LEGACY_CURATED_CAPABILITIES = ${legacyRegistryReconciliation.length}. UNRECONCILED_LEGACY_CAPABILITIES = ${unmappedLegacy.length}.** The previous 488 derived UI-label candidates all carry ` +
    "`evidenceClass = UNKNOWN`; they were not used to invent capabilities. The 31 registry rows are reconciled below using their recorded labels/state and closed action evidence, not owner-path existence as proof.",
  "",
  table(
    ["Legacy capability", "Disposition", "Canonical capability IDs", "Rationale"],
    legacyRegistryReconciliation.map((record) => [
      `${record.legacyCapability.id}: ${record.legacyCapability.title ?? "(untitled)"}`,
      record.disposition,
      record.canonicalCapabilityIds.join(", ") || "—",
      record.rationale,
    ]),
  ),
  "",
  "Disposition totals:",
  "",
  table(["Disposition", "Count"], Object.entries(legacyDispositionCounts).map(([name, total]) => [name, total])),
  "",
  "## New capabilities and taxonomy",
  "",
  `**NEW_FROM_SOURCE_GRAPH = ${output.newFromSourceGraph.length}.** The exact IDs and why the earlier owner-path registry missed them are in ` +
    "`newFromSourceGraph` in the JSON.",
  "",
  table(["Domain", "Capabilities"], Object.entries(domainCounts).map(([domain, total]) => [domain, total])),
  "",
  "The supplied finalized domains and source-facing persona taxonomy are used. `OTHER_EXPLICIT` is used only for explicit collective bargaining, arbitration-precedent/jurisdiction, public inquiry, workplace-risk-assessment, recognition, trustee/pension, and work-coordination jobs; each capability record carries a domain justification. No new taxonomy domain is introduced.",
  "",
  "Persona capability counts may overlap:",
  "",
  table(["Persona", "Capabilities"], PERSONAS.map((persona) => [persona, personaCounts[persona]])),
  "",
  "## Binding and inherited-evidence coverage",
  "",
  table(["Coverage class", "Bindings"], [
    ["TOTAL_CANONICAL_BINDINGS", bindingStatus.totalCanonicalBindings],
    ["BUSINESS_BINDINGS_MAPPED_TO_CAPABILITY", bindingStatus.businessBindingsMappedToCapability],
    ["NON_BUSINESS_OR_INACTIVE_BINDINGS", bindingStatus.nonBusinessOrInactiveBindings],
    ["INTENTIONALLY_DISABLED_BINDINGS", bindingStatus.intentionallyDisabledBindings],
    ["UNMAPPED_BUSINESS_BINDINGS", bindingStatus.unmappedBusinessBindings],
  ]),
  "",
  `**CAPABILITIES_WITH_SOURCE_CEILING = ${capabilitiesWithCeiling.length}. CAPABILITIES_WITHOUT_SOURCE_CEILING = ${capabilityRecords.length - capabilitiesWithCeiling.length}.** All ${sourceCeilingBindingIds.size} source-ceiling binding IDs retain their obligations in the binding map; ${businessSourceCeilingBindingIds.size} business-mapped source-ceiling bindings are inherited into capability records. The ${sourceCeilingBindingLevelOnlyIds.length} non-business/inactive source-ceiling bindings remain binding-level only and are not forced into a business capability.`,
  "",
  `**CAPABILITIES_WITH_KNOWN_DEFECTS = ${capabilitiesWithDefects.length}. CAPABILITIES_WITH_BOTH = ${capabilitiesWithBoth.length}. CAPABILITIES_WITH_NEITHER = ${capabilitiesWithNeither.length}.** Overlap arithmetic: ${output.defectCeilingSummary.overlapArithmetic}. Defect findings remain scoped to action bindings and do not imply that a parent capability as a whole is unusable.`,
  "",
  "## Business dependencies",
  "",
  table(["Capability", "Business prerequisites"], dependencies.map((item) => [
    item.capabilityId,
    item.dependsOnCapabilityIds.join(", ") || "None evidenced",
  ])),
  "",
  "These are business prerequisites, not technical service or database dependencies.",
  "",
  "## Institutional continuity",
  "",
  table(["Dimension", "Source-model signal", "Capability IDs"], institutionalContinuityCapabilities.map((item) => [
    item.dimension,
    item.sourceModelContainsSignal ? "PRESENT — not proven operational" : "NOT ESTABLISHED",
    item.capabilityIds.join(", ") || "—",
  ])),
  "",
  "Potential continuity-related source capabilities include assignment, deadline actions, evidence/record handling, case communications, and knowledge handoff. Their source presence is not proof of assignment durability, retention, restrictions, auditability, deadline delivery, or successful succession.",
  "",
  "## External-specialist / WorkAid scope",
  "",
  "No WorkAid integration, external-party role, or restricted external access is inferred. The accepted evidence does not establish the requested bounded external-specialist workflow as a current capability. The JSON lists each requested dimension as `NOT_ESTABLISHED`; generic case or document actions do not fill those gaps.",
  "",
  "## AI-assisted capabilities",
  "",
  table(["AI-assisted capability", "Underlying capability IDs", "Bindings", "Source-ceiling bindings", "Runtime proven"],
    aiAssistedCapabilities.map((item) => [
      `${item.capabilityId}: ${item.capabilityName}`,
      item.underlyingCapabilityIds.join(", ") || "None identified",
      item.bindingIds.length,
      item.sourceCeilingBindingIds.length,
      item.runtimeProven,
    ]),
  ),
  "",
  "AI-assisted actions are distinct from the underlying institutional capability. They retain their source-ceiling obligations and do not imply provider availability, output quality, human review, or persistence.",
  "",
  "## Validation and gate",
  "",
  table(["Validation", "Result"], Object.entries(validation).map(([name, passed]) => [name, passed ? "PASS" : "FAIL"])),
  "",
  `**PHASE_1A_3A_SOURCE_MODEL = ${phaseGate}.**`,
  "",
  "- `CAPABILITY_RUNTIME_PROVEN = NO`",
  "- `CAPABILITY_AUTHORIZATION_PROVEN = NO`",
  "- `CAPABILITY_PERSISTENCE_PROVEN = NO`",
  "- `PHASE_1A_3 = NOT YET COMPLETE`; `PHASE_1A = NOT YET PROVEN`",
  "- `PHASE_1B = NOT AUTHORIZED`; `PRODUCT_READY = NO`",
  "- No Phase 1A.3b, Phase 1B, or Phase 2 work was started.",
  "",
  "The binding-level classifications, exact legacy-row dispositions, capability dependencies, continuity and external-specialist evidence, and validation details are in [PHASE_1A_3A_BUSINESS_CAPABILITY_MODEL.json](./PHASE_1A_3A_BUSINESS_CAPABILITY_MODEL.json).",
  "",
].join("\n");

assert(
  Object.values(validation).every(Boolean),
  `Capability-model validations failed: ${JSON.stringify({ validation, unmappedBusinessBindingIds: sorted(unmappedBusinessIds) })}`,
);
assert(phaseGate === "PASS", "Phase 1A.3a source-model gate failed");
fs.writeFileSync(path.join(root, outputJsonPath), `${JSON.stringify(output, null, 2)}\n`);
fs.writeFileSync(path.join(root, outputMarkdownPath), md);
console.log(JSON.stringify({
  outputs: [outputJsonPath, outputMarkdownPath],
  canonicalCapabilities: capabilityRecords.length,
  criticalityCounts,
  sourceStatusCounts: sourceStatusSummary.counts,
  bindingCoverage,
  legacyDispositionCounts,
  sourceCeilingCapabilities: capabilitiesWithCeiling.length,
  capabilitiesWithDefects: capabilitiesWithDefects.length,
  capabilitiesWithBoth: capabilitiesWithBoth.length,
  crossCapabilityBindingCount: crossCapabilityBindings.length,
  newFromSourceGraph: output.newFromSourceGraph.length,
  phase1A3aGate: phaseGate,
  validation,
}, null, 2));
