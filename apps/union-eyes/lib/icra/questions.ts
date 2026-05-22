/**
 * ARTIFACT TYPE: Question Bank
 * DOCTRINE_VERSION: 1.0.0
 * CHANGE CLASS: Operational
 * CANONICAL DOCTRINE SOURCE: docs/doctrine/DOCTRINE.md
 *
 * ICRA Question Bank — 32 MaturitySelectQuestions across 7 scored sections.
 * Each question uses a five-point institutional maturity scale.
 * No opaque logic. Every question maps explicitly to named dimensions.
 * Anti-surveillance by design: no question asks about named individuals,
 * personal behaviour, or productivity metrics.
 *
 * Every question is replayable: the active QUESTION_BANK_VERSION is
 * snapshotted with each Answer so older assessments stay interpretable
 * if the bank evolves.
 */
import type {
  LikertQuestion,
  MaturitySelectQuestion,
  MultipleChoiceQuestion,
  Question,
  QuestionOption,
  SectionId,
} from './types';

export const QUESTION_BANK_VERSION = 3;

/** Section display metadata for the assessment UI */
export interface SectionDefinition {
  id: SectionId;
  ordinal: number;
  title: string;
  intro: string;
}

export const SECTIONS: readonly SectionDefinition[] = [
  {
    id: 'organizational_context',
    ordinal: 1,
    title: 'Organizational Context',
    intro:
      'A small amount of context so the resulting profile can be interpreted appropriately. Nothing here is personally identifying.',
  },
  {
    id: 'operational_dependency',
    ordinal: 2,
    title: 'Operational Dependency',
    intro:
      'Where institutional function relies on specific people rather than institutional procedure.',
  },
  {
    id: 'governance_visibility',
    ordinal: 3,
    title: 'Governance Visibility',
    intro:
      'Whether governance bodies can see operational reality without heroic reporting effort.',
  },
  {
    id: 'institutional_memory',
    ordinal: 4,
    title: 'Institutional Memory',
    intro:
      'Whether decisions, precedent, and operational knowledge outlast the individuals who shaped them.',
  },
  {
    id: 'transition_readiness',
    ordinal: 5,
    title: 'Transition Readiness',
    intro:
      'How the institution absorbs role and leadership change without operational disruption.',
  },
  {
    id: 'operational_coordination',
    ordinal: 6,
    title: 'Operational Coordination',
    intro:
      'How operational activity is coordinated across teams, units, or federated structures.',
  },
  {
    id: 'explainability_trust',
    ordinal: 7,
    title: 'Explainability & Trust',
    intro:
      'Whether decisions can be explained from evidence — to members, oversight bodies, and successors.',
  },
  {
    id: 'sovereignty_governance',
    ordinal: 8,
    title: 'Sovereignty & Governance Control',
    intro:
      'Whether the institution controls its own institutional data, infrastructure, and direction.',
  },
] as const;
// ─────────────────────────────────────────────────────────────────────────────
// Canonical five-point maturity options — shared across all scored questions
// ─────────────────────────────────────────────────────────────────────────────

const MATURITY_OPTIONS: QuestionOption[] = [
  { value: '0', label: 'Absent',       score: 0.0,  observation: 'This does not exist in our organization.' },
  { value: '1', label: 'Informal',     score: 0.25, observation: 'We have informal or ad-hoc approaches.' },
  { value: '2', label: 'Partial',      score: 0.5,  observation: 'We have documented some aspects inconsistently.' },
  { value: '3', label: 'Structured',   score: 0.75, observation: 'We have structured processes most people follow.' },
  { value: '4', label: 'Institutional',score: 1.0,  observation: 'This is embedded in how we operate at all levels.' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Metadata questions — organizational context, not scored
// ─────────────────────────────────────────────────────────────────────────────

export interface MetadataQuestion {
  id: string;
  section: 'organizational_context';
  order: number;
  prompt: string;
  helpText?: string;
  type: 'select' | 'text';
  required: boolean;
  options?: Array<{ value: string; label: string }>;
}

export const METADATA_QUESTIONS: MetadataQuestion[] = [
  {
    id: 'ctx_org_type',
    section: 'organizational_context',
    order: 1,
    prompt: 'What type of organization are you representing?',
    type: 'select',
    required: true,
    options: [
      { value: 'local_union',   label: 'Local union' },
      { value: 'national_union',label: 'National or international union' },
      { value: 'federation',    label: 'Labour federation or council' },
      { value: 'guild',         label: 'Professional guild or association' },
      { value: 'clc_affiliate', label: 'CLC affiliate or department' },
      { value: 'other',         label: 'Other labour organization' },
    ],
  },
  {
    id: 'ctx_sector',
    section: 'organizational_context',
    order: 2,
    prompt: 'What is the primary sector your organization operates in?',
    type: 'select',
    required: true,
    options: [
      { value: 'public_sector',       label: 'Public sector' },
      { value: 'private_sector',      label: 'Private sector' },
      { value: 'healthcare',          label: 'Healthcare and social services' },
      { value: 'education',           label: 'Education' },
      { value: 'construction',        label: 'Construction and skilled trades' },
      { value: 'transportation',      label: 'Transportation and logistics' },
      { value: 'retail_hospitality',  label: 'Retail and hospitality' },
      { value: 'media_communications',label: 'Media and communications' },
      { value: 'financial_services',  label: 'Financial services' },
      { value: 'other',               label: 'Other / mixed sector' },
    ],
  },
  {
    id: 'ctx_membership_size',
    section: 'organizational_context',
    order: 3,
    prompt: 'Approximately how many members does your organization represent?',
    type: 'select',
    required: true,
    options: [
      { value: 'under_100',   label: 'Fewer than 100' },
      { value: '100_499',     label: '100-499' },
      { value: '500_1999',    label: '500-1,999' },
      { value: '2000_9999',   label: '2,000-9,999' },
      { value: '10000_49999', label: '10,000-49,999' },
      { value: '50000_plus',  label: '50,000 or more' },
    ],
  },
  {
    id: 'ctx_years_operating',
    section: 'organizational_context',
    order: 4,
    prompt: 'How long has this organization been operating?',
    type: 'select',
    required: true,
    options: [
      { value: 'under_5', label: 'Fewer than 5 years' },
      { value: '5_14',    label: '5-14 years' },
      { value: '15_29',   label: '15-29 years' },
      { value: '30_plus', label: '30 years or more' },
    ],
  },
  {
    id: 'ctx_primary_challenge',
    section: 'organizational_context',
    order: 5,
    prompt: 'Is there a specific continuity or governance challenge that prompted this assessment? (Optional)',
    helpText: 'This context is not required and does not affect your results. It helps us understand the range of situations organizations bring to this assessment.',
    type: 'text',
    required: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Section: operational_dependency (5 questions)
// ─────────────────────────────────────────────────────────────────────────────

const OPERATIONAL_DEPENDENCY: MaturitySelectQuestion[] = [
  {
    id: 'od_01', section: 'operational_dependency', order: 1, type: 'maturity_select',
    prompt: 'How well can your organization continue day-to-day operations if one or two key people become unavailable without warning?',
    helpText: 'Consider what would happen if your executive director, operations lead, or equivalent left today with no handover.',
    weights: { institutional_continuity: 1, operational_memory: 0.8 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Single-person operational dependency is the primary driver of continuity risk.',
  },
  {
    id: 'od_02', section: 'operational_dependency', order: 2, type: 'maturity_select',
    prompt: 'To what extent is critical institutional knowledge documented in systems that others can access?',
    helpText: 'This includes procedures, contacts, decision histories, and operational context — not personal files or inboxes.',
    weights: { institutional_continuity: 1, operational_memory: 0.8 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Knowledge accessibility determines whether absence becomes disruption.',
  },
  {
    id: 'od_03', section: 'operational_dependency', order: 3, type: 'maturity_select',
    prompt: 'How consistently do departing staff or transitioning leaders complete formal knowledge handovers?',
    helpText: 'A knowledge handover includes documented decisions, in-progress matters, key relationships, and operational context passed to successors or the organization.',
    weights: { institutional_continuity: 1, operational_memory: 0.8 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Handover discipline directly governs continuity during transitions.',
  },
  {
    id: 'od_04', section: 'operational_dependency', order: 4, type: 'maturity_select',
    prompt: 'How broadly is operational knowledge distributed — i.e., does more than one person understand each critical function well enough to perform it?',
    helpText: 'Consider your most operationally critical functions: member intake, payroll, grievance tracking, communications.',
    weights: { institutional_continuity: 1, operational_memory: 0.8 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Knowledge concentration creates single points of failure.',
  },
  {
    id: 'od_05', section: 'operational_dependency', order: 5, type: 'maturity_select',
    prompt: 'How prepared is your organization to onboard a new senior leader or operations lead without a lengthy informal apprenticeship?',
    helpText: 'Would a new leader find documented context, decision histories, and operational guidance — or would they rely primarily on institutional memory held by current staff?',
    weights: { institutional_continuity: 1, operational_memory: 0.8 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Onboarding readiness reflects the depth of externalized institutional memory.',
  },
  // ── New v2 questions: invisible continuity burden ──
  {
    id: 'icb_01', section: 'operational_dependency', order: 6, type: 'maturity_select',
    prompt: 'To what extent does your organization recognize and account for the informal continuity work that certain staff or leaders carry on behalf of the institution?',
    helpText: 'Consider whether the time spent compensating for absent institutional memory — translating context, explaining history, maintaining relationships — is visible to leadership or absorbed silently into individual roles.',
    weights: { institutional_continuity: 0.8, operational_memory: 1.0 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Invisible continuity labour is the primary precursor of burnout and sudden institutional knowledge loss.',
  },
  {
    id: 'icb_02', section: 'operational_dependency', order: 7, type: 'maturity_select',
    prompt: 'How deliberately does your organization distribute continuity responsibilities — so that institutional knowledge is not quietly concentrated in a small number of people?',
    helpText: 'As opposed to allowing continuity knowledge to accumulate with whoever happens to have been around the longest or is most engaged.',
    weights: { institutional_continuity: 1.0, operational_memory: 0.8 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Continuity equity prevents single points of knowledge failure and protects institutional memory holders from unsustainable burden.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Section: governance_visibility (4 questions)
// ─────────────────────────────────────────────────────────────────────────────

const GOVERNANCE_VISIBILITY: MaturitySelectQuestion[] = [
  {
    id: 'gv_01', section: 'governance_visibility', order: 1, type: 'maturity_select',
    prompt: 'How consistently are governance decisions recorded with the rationale, context, and evidence needed to understand them later?',
    helpText: 'This includes board decisions, executive decisions, and policy changes — not only formal minutes.',
    weights: { institutional_continuity: 1, governance_fragility: 0.8 },
    riskInverted: false, options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Decision traceability is the foundation of governance continuity.',
  },
  {
    id: 'gv_02', section: 'governance_visibility', order: 2, type: 'maturity_select',
    prompt: 'How visible are your governance processes to oversight bodies, incoming leaders, and those affected by decisions?',
    helpText: 'Visibility means that governance processes are accessible, understandable, and auditable — not merely that they exist.',
    weights: { institutional_continuity: 1, governance_fragility: 0.8 },
    riskInverted: false, options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Governance opacity is itself a form of institutional fragility.',
  },
  {
    id: 'gv_03', section: 'governance_visibility', order: 3, type: 'maturity_select',
    prompt: 'How dependent is your governance oversight on what key individuals choose to surface to the board or governing body?',
    helpText: 'Consider whether your governance body can independently verify operational realities, or whether it relies on curated reporting from staff.',
    weights: { institutional_continuity: 1, governance_fragility: 0.8 },
    riskInverted: true, options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Information-gating by individuals is a governance fragility indicator.',
  },
  {
    id: 'gv_04', section: 'governance_visibility', order: 4, type: 'maturity_select',
    prompt: 'How consistently does your organization follow documented governance procedures rather than informal precedent?',
    helpText: "Consider how decisions are made in practice versus how they're described in policy — for routine governance as well as exceptional situations.",
    weights: { institutional_continuity: 1, governance_fragility: 0.8 },
    riskInverted: false, options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Divergence between written and practiced governance is a leading fragility indicator.',
  },
  // ── New v2 question: governance interpretation survivability ──
  {
    id: 'gis_01', section: 'governance_visibility', order: 5, type: 'maturity_select',
    prompt: 'How consistently do governance interpretations — how policies are applied, how disputes are resolved, how discretion is exercised — survive leadership transitions?',
    helpText: 'Consider whether incoming leaders typically inherit documented interpretive guidance, or whether they develop their own interpretations independently, sometimes reversing what came before.',
    weights: { institutional_continuity: 0.8, governance_fragility: 1.0 },
    riskInverted: false, options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Governance interpretation survivability is the quiet test of whether governance continuity is real or nominal.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Section: institutional_memory (4 questions)
// ─────────────────────────────────────────────────────────────────────────────

const INSTITUTIONAL_MEMORY: MaturitySelectQuestion[] = [
  {
    id: 'im_01', section: 'institutional_memory', order: 1, type: 'maturity_select',
    prompt: 'How well does your organization preserve and make accessible the history of significant decisions, negotiations, and operational events?',
    helpText: 'Consider whether a new leader five years from now could understand why a current policy exists, who negotiated it, and what the alternatives were.',
    weights: { institutional_continuity: 1, operational_memory: 1.0 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Historical accessibility determines whether the past can inform the present.',
  },
  {
    id: 'im_02', section: 'institutional_memory', order: 2, type: 'maturity_select',
    prompt: 'How well does your organization capture and maintain the relational context that shapes how you work — relationships with employers, federations, regulators, and community partners?',
    helpText: 'Relational context includes communication histories, relationship dynamics, negotiation posture, and the organizational knowledge needed to sustain key relationships.',
    weights: { institutional_continuity: 1, operational_memory: 1.0 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Relational memory loss during transitions can damage institutional credibility.',
  },
  {
    id: 'im_03', section: 'institutional_memory', order: 3, type: 'maturity_select',
    prompt: "How well-preserved is your organization's knowledge of its own evolution — policy changes, structural decisions, and governance choices over time?",
    helpText: 'This includes things like why certain provisions are in your bylaws, how your dues structure evolved, or when and why specific operational practices were adopted.',
    weights: { institutional_continuity: 1, operational_memory: 1.0 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Organizational self-knowledge is foundational to coherent stewardship.',
  },
  {
    id: 'im_04', section: 'institutional_memory', order: 4, type: 'maturity_select',
    prompt: 'How consistently is institutional memory treated as an organizational asset — actively maintained, structured, and protected from loss?',
    helpText: 'As opposed to treating institutional memory as something that lives in long-tenured staff, and reconstituting it from scratch when those people leave.',
    weights: { institutional_continuity: 1, operational_memory: 1.0 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Whether memory is treated as infrastructure determines whether it compounds or decays.',
  },
  // ── New v2 questions: operational reconstruction labour, institutional forgetting ──
  {
    id: 'orl_01', section: 'institutional_memory', order: 5, type: 'maturity_select',
    prompt: 'How often does your organization find itself solving the same operational problems that were previously solved — because the earlier solution was not preserved?',
    helpText: 'This includes re-establishing vendor relationships, re-negotiating terms that were previously settled, re-developing procedures that once existed, or re-learning institutional context already known to former staff.',
    weights: { institutional_continuity: 0.8, operational_memory: 1.0 },
    options: MATURITY_OPTIONS, allowNote: true,
    riskInverted: true,
    rationale: 'Repeated operational reconstruction is the direct cost of institutional forgetting.',
  },
  {
    id: 'orl_02', section: 'institutional_memory', order: 6, type: 'maturity_select',
    prompt: 'How well does your organization preserve the context behind decisions — not just what was decided, but why, what was considered, and what was rejected?',
    helpText: 'Decision context allows successors to understand the reasoning behind current practices, rather than inheriting outcomes without explanation.',
    weights: { institutional_continuity: 0.8, operational_memory: 1.0 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Preserved decision context is what allows institutions to learn from their own history.',
  },
  {
    id: 'if_01', section: 'institutional_memory', order: 7, type: 'maturity_select',
    prompt: 'To what extent does your organization retain the operational knowledge gained during challenging periods — restructurings, disputes, crises, or significant transitions?',
    helpText: 'Consider whether the institutional learning from difficult periods is preserved and accessible, or whether it is absorbed into the informal memory of those who were present and lost when they leave.',
    weights: { institutional_continuity: 0.8, operational_memory: 1.0 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Institutional learning from adversity is among the most valuable and most frequently lost forms of organizational memory.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Section: transition_readiness (5 questions)
// ─────────────────────────────────────────────────────────────────────────────

const TRANSITION_READINESS: MaturitySelectQuestion[] = [
  {
    id: 'tr_01', section: 'transition_readiness', order: 1, type: 'maturity_select',
    prompt: 'How prepared is your organization for a planned leadership transition — executive director, elected president, or equivalent?',
    helpText: 'Consider whether documented succession plans, candidate development, and knowledge transfer processes exist and are current.',
    weights: { institutional_continuity: 1, transition_readiness: 1.0 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Planned transition readiness is the baseline measure of succession governance.',
  },
  {
    id: 'tr_02', section: 'transition_readiness', order: 2, type: 'maturity_select',
    prompt: 'How prepared is your organization for an unplanned leadership departure — sudden resignation, medical leave, or removal?',
    helpText: 'Consider what would happen in the first 90 days after an unplanned senior departure, and how operational coherence would be maintained.',
    weights: { institutional_continuity: 1, transition_readiness: 1.0 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Unplanned departure readiness distinguishes resilient organizations.',
  },
  {
    id: 'tr_03', section: 'transition_readiness', order: 3, type: 'maturity_select',
    prompt: 'How formally does your organization manage leadership and role transitions — including documented handover, overlap periods, and structured onboarding?',
    helpText: 'Rather than informal knowledge transfer through shadowing or observation.',
    weights: { institutional_continuity: 1, transition_readiness: 1.0 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Transition formality determines how much institutional context survives.',
  },
  {
    id: 'tr_04', section: 'transition_readiness', order: 4, type: 'maturity_select',
    prompt: 'How actively does your organization identify and develop internal capacity for future leadership roles?',
    helpText: 'Includes steward development, committee leadership, mentorship programs, or deliberate succession pipelines — not just formal training programs.',
    weights: { institutional_continuity: 1, transition_readiness: 1.0 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Leadership pipeline depth determines long-term transition resilience.',
  },
  {
    id: 'tr_05', section: 'transition_readiness', order: 5, type: 'maturity_select',
    prompt: 'How well does your organization maintain strategic direction continuity through leadership changes?',
    helpText: 'Consider whether incoming leaders inherit documented strategic context — decisions made, rationale, alternatives rejected — or reconstruct direction through their own interpretation.',
    weights: { institutional_continuity: 1, transition_readiness: 1.0 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Strategic continuity during transitions preserves institutional legitimacy.',
  },
  // ── New v2 question: onboarding continuity ──
  {
    id: 'onb_01', section: 'transition_readiness', order: 6, type: 'maturity_select',
    prompt: 'How effectively does your onboarding process transfer institutional intelligence — not just role responsibilities, but the operational context, relational history, and governance understanding that allow a new person to act effectively?',
    helpText: 'As opposed to onboarding that covers formal procedures and tools, but leaves new staff to absorb institutional context through observation and informal conversation over months or years.',
    weights: { institutional_continuity: 0.8, transition_readiness: 1.0, operational_memory: 0.6 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Onboarding quality determines how much institutional intelligence survives each transition.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Section: operational_coordination (5 questions)
// ─────────────────────────────────────────────────────────────────────────────

const OPERATIONAL_COORDINATION: MaturitySelectQuestion[] = [
  {
    id: 'oc_01', section: 'operational_coordination', order: 1, type: 'maturity_select',
    prompt: 'How well does your organization coordinate operational work across teams, departments, or locals through shared, documented mechanisms?',
    helpText: 'Rather than through personal relationships, informal communication, or whoever happens to know both parties.',
    weights: { institutional_continuity: 1, operational_memory: 0.6 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Coordination dependence on relationships is a continuity risk.',
  },
  {
    id: 'oc_02', section: 'operational_coordination', order: 2, type: 'maturity_select',
    prompt: 'How consistently are operational decisions and their outcomes recorded in accessible organizational systems?',
    helpText: 'Not only formal decisions — also include operational judgement calls, process exceptions, and service delivery choices that could affect future operations.',
    weights: { institutional_continuity: 1, operational_memory: 0.6 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Operational decision capture determines whether learning is possible.',
  },
  {
    id: 'oc_03', section: 'operational_coordination', order: 3, type: 'maturity_select',
    prompt: 'How well does your organization track and manage cross-functional responsibilities and accountabilities?',
    helpText: 'Including who is responsible for what, how work is handed off between roles or teams, and how gaps or conflicts in responsibility are identified and resolved.',
    weights: { institutional_continuity: 1, operational_memory: 0.6 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Accountability clarity reduces operational fragility.',
  },
  {
    id: 'oc_04', section: 'operational_coordination', order: 4, type: 'maturity_select',
    prompt: 'How well does your organization manage vendor, service provider, and partner relationships — including contract oversight and institutional context?',
    helpText: "Consider whether incoming staff or leadership would find the context they need to manage these relationships without relying on their predecessor's knowledge.",
    weights: { institutional_continuity: 1, operational_memory: 0.6 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'External relationship memory is often among the first things lost in transition.',
  },
  {
    id: 'oc_05', section: 'operational_coordination', order: 5, type: 'maturity_select',
    prompt: 'How consistently does your organization report on operational performance using verifiable, documented information rather than informal narrative?',
    helpText: 'This includes reporting to boards, committees, membership, or funders — whether operational reality is substantiated or primarily communicated through trusted individuals.',
    weights: { institutional_continuity: 1, operational_memory: 0.6 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Evidence-based reporting indicates institutional operational discipline.',
  },
  // ── New v2 question: continuity fairness ──
  {
    id: 'cf_01', section: 'operational_coordination', order: 6, type: 'maturity_select',
    prompt: 'How equitably is continuity responsibility distributed across your organization — rather than concentrated in a small number of individuals who quietly carry disproportionate institutional burden?',
    helpText: 'Consider whether the work of maintaining institutional continuity — keeping context, translating between teams, preserving relationships — is recognized and shared, or whether it falls to the same people repeatedly.',
    weights: { institutional_continuity: 0.8, operational_memory: 0.6 },
    options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Continuity fairness is both an equity concern and an institutional resilience indicator.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Section: explainability_trust (5 questions)
// ─────────────────────────────────────────────────────────────────────────────

const EXPLAINABILITY_TRUST: MaturitySelectQuestion[] = [
  {
    id: 'et_01', section: 'explainability_trust', order: 1, type: 'maturity_select',
    prompt: 'How well can your organization explain its governance decisions — including rationale, evidence, and alternatives considered — to those affected by them?',
    helpText: 'Explainability means that the reasoning behind decisions is accessible and understandable to members, staff, and oversight bodies, not only to those who made them.',
    weights: { institutional_continuity: 1, trust_debt: 0.8, governance_fragility: 0.4 },
    riskInverted: false, options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Unexplainable governance erodes institutional legitimacy over time.',
  },
  {
    id: 'et_02', section: 'explainability_trust', order: 2, type: 'maturity_select',
    prompt: 'How much accumulated institutional trust debt does your organization carry — unresolved grievances, unexplained decisions, or governance conduct that has not been adequately accounted for?',
    helpText: 'Trust debt is the gap between the governance conduct your organization projects and the institutional memory held by those who experienced it differently.',
    weights: { institutional_continuity: 1, trust_debt: 0.8, governance_fragility: 0.4 },
    riskInverted: true, options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Unacknowledged trust debt compounds and surfaces during transitions.',
  },
  {
    id: 'et_03', section: 'explainability_trust', order: 3, type: 'maturity_select',
    prompt: 'How consistently does your organization provide affected parties — members, staff, bargaining units — with meaningful notice and explanation of decisions that affect them?',
    helpText: 'Meaningful means substantive, not merely procedurally compliant — the kind of communication that allows people to understand, assess, and respond.',
    weights: { institutional_continuity: 1, trust_debt: 0.8, governance_fragility: 0.4 },
    riskInverted: false, options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Meaningful communication is foundational to democratic trust infrastructure.',
  },
  {
    id: 'et_04', section: 'explainability_trust', order: 4, type: 'maturity_select',
    prompt: 'How well does your organization handle internal disputes, complaints, or concerns through documented, consistently applied processes?',
    helpText: 'As opposed to relying on the judgment and informal authority of specific leaders to resolve internal tensions.',
    weights: { institutional_continuity: 1, trust_debt: 0.8, governance_fragility: 0.4 },
    riskInverted: false, options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Process-based dispute resolution reduces personality-dependent trust risk.',
  },
  {
    id: 'et_05', section: 'explainability_trust', order: 5, type: 'maturity_select',
    prompt: 'How confidently could your organization produce a governance audit trail — decisions, evidence, approvals, and accountability — under external scrutiny?',
    helpText: 'Consider what you would present to a labour board, auditor, federation, or regulatory body reviewing your governance conduct.',
    weights: { institutional_continuity: 1, trust_debt: 0.8, governance_fragility: 0.4 },
    riskInverted: false, options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Audit readiness reveals the depth and quality of governance documentation discipline.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Section: sovereignty_governance (4 questions)
// ─────────────────────────────────────────────────────────────────────────────

const SOVEREIGNTY_GOVERNANCE: MaturitySelectQuestion[] = [
  {
    id: 'sg_01', section: 'sovereignty_governance', order: 1, type: 'maturity_select',
    prompt: 'How well does your organization maintain control over its own institutional data, records, and decision history — independent of any single vendor, platform, or external party?',
    helpText: 'This includes whether your records are portable, whether you could switch systems without losing institutional history, and whether you hold the primary copy of your own governance record.',
    weights: { institutional_continuity: 1, trust_debt: 0.6 },
    riskInverted: false, options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Data sovereignty is foundational to long-term institutional independence.',
  },
  {
    id: 'sg_02', section: 'sovereignty_governance', order: 2, type: 'maturity_select',
    prompt: 'How clearly does your organization distinguish between governance decisions that require member consent, board approval, or executive authority respectively?',
    helpText: 'Clear decision authority means that the appropriate level of consent is sought and documented — not that decisions are escalated to the highest level as a default.',
    weights: { institutional_continuity: 1, trust_debt: 0.6 },
    riskInverted: false, options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Authority clarity prevents governance fragility during leadership transitions.',
  },
  {
    id: 'sg_03', section: 'sovereignty_governance', order: 3, type: 'maturity_select',
    prompt: 'How well does your organization protect member-facing data from uses that were not explicitly authorized — including reporting, analytics, and external sharing?',
    helpText: 'Consider whether data collected for one purpose (e.g., dues administration) is ever used for another purpose (e.g., productivity monitoring, performance evaluation) without explicit consent.',
    weights: { institutional_continuity: 1, trust_debt: 0.6 },
    riskInverted: true, options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Unauthorized data use is a source of institutional trust debt.',
  },
  {
    id: 'sg_04', section: 'sovereignty_governance', order: 4, type: 'maturity_select',
    prompt: 'How actively does your organization govern its relationships with technology vendors, platforms, and digital tools — including reviewing terms, data handling, and exit options?',
    helpText: 'Active governance means periodic review, documented concerns, and the organizational capacity to make informed decisions about digital dependencies — not passive acceptance of vendor defaults.',
    weights: { institutional_continuity: 1, trust_debt: 0.6 },
    riskInverted: false, options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Technology governance is an increasingly significant source of sovereignty risk.',
  },
  // ── New v2 questions: modernization trauma ──
  {
    id: 'mt_01', section: 'sovereignty_governance', order: 5, type: 'maturity_select',
    prompt: 'How well does your organization preserve institutional context and operational memory when transitioning between systems, platforms, or technology approaches?',
    helpText: 'Consider whether past transitions — moving between case management systems, financial platforms, communication tools — resulted in institutional memory loss or whether context was preserved and transferred.',
    weights: { institutional_continuity: 0.8, operational_memory: 0.8, trust_debt: 0.4 },
    riskInverted: false, options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Technology transitions are one of the primary pathways through which institutional memory is silently lost.',
  },
  {
    id: 'mt_02', section: 'sovereignty_governance', order: 6, type: 'maturity_select',
    prompt: 'How deliberately does your organization evaluate whether modernization efforts preserve — rather than replace — institutional continuity?',
    helpText: 'Consider whether modernization decisions account for the institutional knowledge embedded in current practices, relationships, and systems — or whether they prioritize capability gains without assessing continuity risk.',
    weights: { institutional_continuity: 0.8, operational_memory: 0.6, trust_debt: 0.4 },
    riskInverted: false, options: MATURITY_OPTIONS, allowNote: true,
    rationale: 'Modernization without continuity assessment is among the most common causes of institutional forgetting.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Consolidated exports
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Continuity Confidence Signals — likert_5 modality (v3)
// Doctrine: docs/oci/assessment/OCI_MODALITY_DOCTRINE.md §4
// These questions sense perceived continuity confidence and ambiguity.
// They are statements; respondents indicate the degree to which each is true.
// ─────────────────────────────────────────────────────────────────────────────

const CONFIDENCE_SCALE = {
  min: 1 as const,
  max: 5 as const,
  minLabel: 'Not at all true of our organization',
  maxLabel: 'Consistently true of our organization',
};

const CONTINUITY_CONFIDENCE: LikertQuestion[] = [
  {
    id: 'ccs_01',
    section: 'operational_dependency',
    order: 10,
    type: 'likert_5',
    prompt:
      'Operational knowledge is consistently recoverable when key individuals are unavailable.',
    helpText:
      'Consider both planned absences and unplanned departures. Recoverability means the institution can continue functioning without that person present.',
    weights: { institutional_continuity: 0.6, operational_memory: 0.6 },
    scale: CONFIDENCE_SCALE,
    allowNote: true,
    rationale: 'Senses perceived recoverability — the institution\'s own read of its survivability.',
    intelligence: {
      modalityRole: 'confidence_sensing',
      intelligenceContribution: ['recoverability_confidence', 'survivability_perception'],
      longitudinalValue: 'high',
      stabilizationRelevance: 'runtime_reliability',
      runtimeRelevance: 'incident_continuity',
      intelligenceNetworkRelevance: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: false,
    },
  },
  {
    id: 'ccs_02',
    section: 'governance_visibility',
    order: 10,
    type: 'likert_5',
    prompt:
      'Governance decisions can be traced from current outcomes back to documented rationale.',
    weights: { institutional_continuity: 0.6, governance_fragility: 0.4 },
    scale: CONFIDENCE_SCALE,
    allowNote: true,
    rationale: 'Senses perceived governance traceability without requiring named decision audits.',
    intelligence: {
      modalityRole: 'confidence_sensing',
      intelligenceContribution: ['governance_sophistication'],
      longitudinalValue: 'high',
      stabilizationRelevance: 'governance_replay',
      runtimeRelevance: 'replay_continuity',
      intelligenceNetworkRelevance: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: true,
    },
  },
  {
    id: 'ccs_03',
    section: 'institutional_memory',
    order: 10,
    type: 'likert_5',
    prompt:
      'The institution can reconstruct the reasoning behind past significant decisions without relying on long-tenured individuals.',
    weights: { institutional_continuity: 0.6, operational_memory: 0.6 },
    scale: CONFIDENCE_SCALE,
    allowNote: true,
    rationale: 'Senses the institution\'s confidence in reconstruction without memory holders.',
    intelligence: {
      modalityRole: 'confidence_sensing',
      intelligenceContribution: ['reconstruction_confidence'],
      longitudinalValue: 'high',
      stabilizationRelevance: 'governance_replay',
      runtimeRelevance: 'replay_continuity',
      intelligenceNetworkRelevance: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: false,
    },
  },
  {
    id: 'ccs_04',
    section: 'transition_readiness',
    order: 10,
    type: 'likert_5',
    prompt:
      'A newly onboarded senior leader could act on real institutional context within their first quarter, not after a year of informal learning.',
    weights: { institutional_continuity: 0.6, transition_readiness: 0.8 },
    scale: CONFIDENCE_SCALE,
    allowNote: true,
    rationale: 'Senses onboarding confidence as a leading indicator of transition resilience.',
    intelligence: {
      modalityRole: 'confidence_sensing',
      intelligenceContribution: ['onboarding_confidence'],
      longitudinalValue: 'high',
      stabilizationRelevance: 'not_applicable',
      runtimeRelevance: 'not_applicable',
      intelligenceNetworkRelevance: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: false,
    },
  },
  {
    id: 'ccs_05',
    section: 'sovereignty_governance',
    order: 10,
    type: 'likert_5',
    prompt:
      'Past technology and platform transitions preserved institutional context rather than discarding it.',
    weights: { institutional_continuity: 0.6, operational_memory: 0.4 },
    scale: CONFIDENCE_SCALE,
    allowNote: true,
    rationale: 'Senses modernization-continuity confidence — whether change typically preserves memory.',
    intelligence: {
      modalityRole: 'confidence_sensing',
      intelligenceContribution: ['modernization_continuity'],
      longitudinalValue: 'high',
      stabilizationRelevance: 'not_applicable',
      runtimeRelevance: 'not_applicable',
      intelligenceNetworkRelevance: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: false,
    },
  },
  {
    id: 'ccs_06',
    section: 'operational_dependency',
    order: 11,
    type: 'likert_5',
    prompt:
      'Critical operational functions could continue for at least 30 days without the people most associated with them.',
    weights: { institutional_continuity: 0.6, operational_memory: 0.6 },
    scale: CONFIDENCE_SCALE,
    allowNote: true,
    rationale: 'Senses the institution\'s recoverability confidence under sustained absence.',
    intelligence: {
      modalityRole: 'confidence_sensing',
      intelligenceContribution: ['recoverability_confidence'],
      longitudinalValue: 'high',
      stabilizationRelevance: 'runtime_reliability',
      runtimeRelevance: 'incident_continuity',
      intelligenceNetworkRelevance: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: false,
    },
  },
  {
    id: 'ccs_07',
    section: 'operational_coordination',
    order: 10,
    type: 'likert_5',
    prompt:
      'Operational coordination across teams happens through shared mechanisms rather than through specific individuals knowing both sides.',
    weights: { institutional_continuity: 0.6, operational_memory: 0.4 },
    scale: CONFIDENCE_SCALE,
    allowNote: true,
    rationale: 'Senses operational clarity — whether coordination is structural or relational.',
    intelligence: {
      modalityRole: 'confidence_sensing',
      intelligenceContribution: ['operational_clarity'],
      longitudinalValue: 'high',
      stabilizationRelevance: 'not_applicable',
      runtimeRelevance: 'not_applicable',
      intelligenceNetworkRelevance: 'high',
      confidenceSensitivity: true,
      governanceSensitivity: false,
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Structural Continuity Signals — multiple_choice modality (v3)
// Doctrine: docs/oci/assessment/OCI_MODALITY_DOCTRINE.md §5
// Each option represents a recognizable structural continuity pattern.
// No "correct" answer — selection surfaces the topology, not a rank.
// Option values are aligned with QUESTION_OPTION_PATTERNS in
// structuralContinuitySignals.ts.
// ─────────────────────────────────────────────────────────────────────────────

const STRUCTURAL_CONTINUITY: MultipleChoiceQuestion[] = [
  {
    id: 'scs_01',
    section: 'operational_dependency',
    order: 20,
    type: 'multiple_choice',
    prompt:
      'How does operational continuity most commonly transfer in your organization today?',
    helpText:
      'Choose the pattern that most closely reflects current practice, not the one your organization aspires to.',
    weights: { institutional_continuity: 0.3, operational_memory: 0.4 },
    rationale: 'Surfaces the dominant operational transfer topology for archetype detection.',
    options: [
      { value: 'documented',     label: 'Documented procedures and reference materials', score: 1.0 },
      { value: 'committee',      label: 'Committee or team-based inheritance',            score: 0.85 },
      { value: 'shadowing',      label: 'Structured shadowing or apprenticeship',         score: 0.7 },
      { value: 'mentorship',     label: 'Informal mentorship',                            score: 0.45 },
      { value: 'escalation',     label: 'Escalation to a small number of individuals',    score: 0.2 },
      { value: 'undocumented',   label: 'Undocumented knowledge held by long-tenured staff', score: 0.1 },
      { value: 'reconstructed',  label: 'Reconstructed from scratch at each transition',  score: 0.05 },
    ],
    allowNote: true,
    intelligence: {
      modalityRole: 'inheritance_pattern',
      intelligenceContribution: ['inheritance_topology', 'stewardship_distribution'],
      longitudinalValue: 'medium',
      stabilizationRelevance: 'not_applicable',
      runtimeRelevance: 'not_applicable',
      intelligenceNetworkRelevance: 'high',
      confidenceSensitivity: false,
      governanceSensitivity: false,
      archetypeContribution: [
        'operational_continuity',
        'stewardship_concentration',
        'institutional_memory_dependency',
        'onboarding_survivability',
      ],
    },
  },
  {
    id: 'scs_02',
    section: 'governance_visibility',
    order: 20,
    type: 'multiple_choice',
    prompt: 'How does escalation of significant governance decisions most commonly work?',
    weights: { institutional_continuity: 0.3, governance_fragility: 0.4 },
    rationale: 'Surfaces governance escalation topology.',
    options: [
      { value: 'documented', label: 'Documented escalation procedures applied consistently', score: 1.0 },
      { value: 'committee',  label: 'Standing committee with defined authority',              score: 0.8 },
      { value: 'individual', label: 'Routed to one or two senior individuals',                score: 0.3 },
      { value: 'ambiguous',  label: 'Escalation paths are situationally negotiated',          score: 0.1 },
    ],
    allowNote: true,
    intelligence: {
      modalityRole: 'topology_pattern',
      intelligenceContribution: ['structural_topology', 'governance_sophistication'],
      longitudinalValue: 'medium',
      stabilizationRelevance: 'governance_replay',
      runtimeRelevance: 'not_applicable',
      intelligenceNetworkRelevance: 'high',
      confidenceSensitivity: false,
      governanceSensitivity: true,
      archetypeContribution: ['governance_fragmentation', 'stewardship_concentration'],
    },
  },
  {
    id: 'scs_03',
    section: 'institutional_memory',
    order: 20,
    type: 'multiple_choice',
    prompt: 'How is continuity ownership distributed in your organization?',
    helpText:
      'Continuity ownership is the responsibility for maintaining institutional memory and ensuring it survives transitions.',
    weights: { institutional_continuity: 0.3, operational_memory: 0.4 },
    rationale: 'Surfaces continuity ownership topology.',
    options: [
      { value: 'distributed',  label: 'Distributed across multiple roles with documented responsibilities', score: 1.0 },
      { value: 'rotational',   label: 'Rotational — periodically reassigned by design',                     score: 0.85 },
      { value: 'concentrated', label: 'Concentrated in a small number of long-tenured people',              score: 0.25 },
      { value: 'unassigned',   label: 'No explicit ownership — it happens or doesn\'t',                     score: 0.05 },
    ],
    allowNote: true,
    intelligence: {
      modalityRole: 'structural_pattern',
      intelligenceContribution: ['stewardship_distribution', 'structural_topology'],
      longitudinalValue: 'medium',
      stabilizationRelevance: 'not_applicable',
      runtimeRelevance: 'not_applicable',
      intelligenceNetworkRelevance: 'high',
      confidenceSensitivity: false,
      governanceSensitivity: false,
      archetypeContribution: [
        'operational_continuity',
        'stewardship_concentration',
        'institutional_memory_dependency',
        'governance_fragmentation',
      ],
    },
  },
  {
    id: 'scs_04',
    section: 'sovereignty_governance',
    order: 20,
    type: 'multiple_choice',
    prompt: 'When the organization adopts new systems or modernizes infrastructure, which pathway most commonly applies?',
    weights: { institutional_continuity: 0.3, operational_memory: 0.3 },
    rationale: 'Surfaces modernization continuity topology.',
    options: [
      { value: 'continuity_preserving', label: 'Continuity is explicitly preserved as part of the transition', score: 1.0 },
      { value: 'capability_first',      label: 'Capability gains drive the transition; continuity is addressed if there is time', score: 0.35 },
      { value: 'reactive',              label: 'Transitions happen reactively, often under pressure',           score: 0.1 },
    ],
    allowNote: true,
    intelligence: {
      modalityRole: 'structural_pattern',
      intelligenceContribution: ['modernization_continuity', 'structural_topology'],
      longitudinalValue: 'medium',
      stabilizationRelevance: 'not_applicable',
      runtimeRelevance: 'not_applicable',
      intelligenceNetworkRelevance: 'high',
      confidenceSensitivity: false,
      governanceSensitivity: false,
      archetypeContribution: ['operational_continuity', 'modernization_fragility', 'institutional_memory_dependency'],
    },
  },
  {
    id: 'scs_05',
    section: 'transition_readiness',
    order: 20,
    type: 'multiple_choice',
    prompt: 'When a new person inherits a role, how do they typically acquire the institutional context required to do it well?',
    weights: { institutional_continuity: 0.3, transition_readiness: 0.4 },
    rationale: 'Surfaces onboarding inheritance topology.',
    options: [
      { value: 'structured',    label: 'Through a structured inheritance process with documented context', score: 1.0 },
      { value: 'observational', label: 'Through observation, informal conversation, and time',             score: 0.4 },
      { value: 'self_directed', label: 'Largely self-directed; context is acquired as it becomes necessary', score: 0.15 },
    ],
    allowNote: true,
    intelligence: {
      modalityRole: 'inheritance_pattern',
      intelligenceContribution: ['onboarding_confidence', 'inheritance_topology'],
      longitudinalValue: 'medium',
      stabilizationRelevance: 'not_applicable',
      runtimeRelevance: 'not_applicable',
      intelligenceNetworkRelevance: 'high',
      confidenceSensitivity: false,
      governanceSensitivity: false,
      archetypeContribution: ['onboarding_survivability', 'operational_continuity', 'institutional_memory_dependency'],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Consolidated exports
// ─────────────────────────────────────────────────────────────────────────────

export const QUESTIONS_BY_SECTION: Record<SectionId, Question[]> = {
  organizational_context: [],
  operational_dependency: [
    ...OPERATIONAL_DEPENDENCY,
    ...CONTINUITY_CONFIDENCE.filter((q) => q.section === 'operational_dependency'),
    ...STRUCTURAL_CONTINUITY.filter((q) => q.section === 'operational_dependency'),
  ],
  governance_visibility: [
    ...GOVERNANCE_VISIBILITY,
    ...CONTINUITY_CONFIDENCE.filter((q) => q.section === 'governance_visibility'),
    ...STRUCTURAL_CONTINUITY.filter((q) => q.section === 'governance_visibility'),
  ],
  institutional_memory: [
    ...INSTITUTIONAL_MEMORY,
    ...CONTINUITY_CONFIDENCE.filter((q) => q.section === 'institutional_memory'),
    ...STRUCTURAL_CONTINUITY.filter((q) => q.section === 'institutional_memory'),
  ],
  transition_readiness: [
    ...TRANSITION_READINESS,
    ...CONTINUITY_CONFIDENCE.filter((q) => q.section === 'transition_readiness'),
    ...STRUCTURAL_CONTINUITY.filter((q) => q.section === 'transition_readiness'),
  ],
  operational_coordination: [
    ...OPERATIONAL_COORDINATION,
    ...CONTINUITY_CONFIDENCE.filter((q) => q.section === 'operational_coordination'),
    ...STRUCTURAL_CONTINUITY.filter((q) => q.section === 'operational_coordination'),
  ],
  explainability_trust: [
    ...EXPLAINABILITY_TRUST,
    ...CONTINUITY_CONFIDENCE.filter((q) => q.section === 'explainability_trust'),
    ...STRUCTURAL_CONTINUITY.filter((q) => q.section === 'explainability_trust'),
  ],
  sovereignty_governance: [
    ...SOVEREIGNTY_GOVERNANCE,
    ...CONTINUITY_CONFIDENCE.filter((q) => q.section === 'sovereignty_governance'),
    ...STRUCTURAL_CONTINUITY.filter((q) => q.section === 'sovereignty_governance'),
  ],
};

export const ALL_QUESTIONS: Question[] = [
  ...OPERATIONAL_DEPENDENCY,
  ...GOVERNANCE_VISIBILITY,
  ...INSTITUTIONAL_MEMORY,
  ...TRANSITION_READINESS,
  ...OPERATIONAL_COORDINATION,
  ...EXPLAINABILITY_TRUST,
  ...SOVEREIGNTY_GOVERNANCE,
  ...CONTINUITY_CONFIDENCE,
  ...STRUCTURAL_CONTINUITY,
];

export const TOTAL_SCORED_QUESTIONS = ALL_QUESTIONS.length;

/** @deprecated Use ALL_QUESTIONS. Kept for backwards compatibility. */
export const QUESTIONS: readonly Question[] = ALL_QUESTIONS;
/** @deprecated Use TOTAL_SCORED_QUESTIONS. */
export const TOTAL_QUESTIONS = TOTAL_SCORED_QUESTIONS;

export function questionsBySection(section: SectionId): Question[] {
  return (QUESTIONS_BY_SECTION[section] ?? []).sort((a, b) => a.order - b.order);
}

export function questionById(id: string): Question | undefined {
  return ALL_QUESTIONS.find((q) => q.id === id);
}

export function sectionById(id: SectionId): SectionDefinition | undefined {
  return SECTIONS.find((s) => s.id === id);
}
