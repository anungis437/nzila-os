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
  MaturitySelectQuestion,
  Question,
  QuestionOption,
  SectionId,
} from './types';

export const QUESTION_BANK_VERSION = 1;

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
];

// ─────────────────────────────────────────────────────────────────────────────
// Consolidated exports
// ─────────────────────────────────────────────────────────────────────────────

export const QUESTIONS_BY_SECTION: Record<SectionId, Question[]> = {
  organizational_context: [],
  operational_dependency: OPERATIONAL_DEPENDENCY,
  governance_visibility: GOVERNANCE_VISIBILITY,
  institutional_memory: INSTITUTIONAL_MEMORY,
  transition_readiness: TRANSITION_READINESS,
  operational_coordination: OPERATIONAL_COORDINATION,
  explainability_trust: EXPLAINABILITY_TRUST,
  sovereignty_governance: SOVEREIGNTY_GOVERNANCE,
};

export const ALL_QUESTIONS: Question[] = [
  ...OPERATIONAL_DEPENDENCY,
  ...GOVERNANCE_VISIBILITY,
  ...INSTITUTIONAL_MEMORY,
  ...TRANSITION_READINESS,
  ...OPERATIONAL_COORDINATION,
  ...EXPLAINABILITY_TRUST,
  ...SOVEREIGNTY_GOVERNANCE,
];

export const TOTAL_SCORED_QUESTIONS = ALL_QUESTIONS.length; // 32

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
