/**
 * OCI Benchmark Intelligence — stewardship-burden pattern typology.
 *
 * Each pattern names an organizational condition (not a personal one).
 * Patterns are observed and held in the institution's own language; the
 * descriptions below are method-register articulations the facilitator
 * may use as a starting point.
 *
 * Patterns are reviewer-led: presence is asserted only after the
 * facilitator and the institution have agreed that the pattern fits.
 *
 * See: docs/oci/OCI_METHOD.md, docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md.
 */

import type {
  StewardshipBurdenCategory,
  StewardshipBurdenPattern,
  StewardshipBurdenPatternId,
} from './types';

export const STEWARDSHIP_BURDEN_PATTERNS: readonly StewardshipBurdenPattern[] = [
  // ── governance-density ────────────────────────────────────────────────────
  {
    id: 'gd-chair-concentration',
    category: 'governance-density',
    name: { 'en-CA': 'Chair concentration' },
    description: {
      'en-CA':
        'Governance momentum depends on the presence of the chair such that the body slows materially when the chair is unavailable.',
    },
    institutionalIndicators: {
      'en-CA': [
        'Decisions queued informally for the chair\u2019s return',
        'Vice-chair role exists in writing but is not routinely exercised',
        'Past absences produced visible organizational drag',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Which decisions does the governance body consistently defer when the chair is unavailable?',
        'How is the vice-chair prepared to carry the chair\u2019s interpretive load?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Rotating chair-shadow practice with explicit organizational standing',
        'Documenting interpretive precedents the chair currently carries orally',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not characterise the chair personally',
        'Do not use this pattern in any chair succession contest',
      ],
    },
  },
  {
    id: 'gd-committee-quorum-fragility',
    category: 'governance-density',
    name: { 'en-CA': 'Committee quorum fragility' },
    description: {
      'en-CA':
        'A standing committee meets quorum only when the same two or three members are present, leaving the committee structurally exposed to their availability.',
    },
    institutionalIndicators: {
      'en-CA': [
        'Meetings rescheduled around the same handful of members',
        'Quorum failures clustered around specific dates',
        'Substitute member roster exists nominally but is not used',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Which committees meet quorum only when specific members are present?',
        'Has the institution considered formal substitute pathways?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Formal substitute roster with organizational standing',
        'Adjusting committee membership to broaden the quorum surface',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not name members whose schedules currently anchor quorum',
        'Do not propose membership changes outside the institution\u2019s normal process',
      ],
    },
  },
  {
    id: 'gd-officer-overlap',
    category: 'governance-density',
    name: { 'en-CA': 'Officer role overlap' },
    description: {
      'en-CA':
        'A single steward holds more governance roles than organizational convention would normally support, creating concentration that the institution has accepted without naming.',
    },
    institutionalIndicators: {
      'en-CA': [
        'One steward listed against multiple officer roles',
        'Recognition that the overlap began as a stopgap and persisted',
        'Successor planning has not begun for any of the overlapping roles',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Which roles are currently held by the same steward, and which would the institution prefer to separate?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Drafting a role-separation plan the steward and institution both accept',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not propose the separation without the steward\u2019s explicit consent',
      ],
    },
  },

  // ── interpretive-density ──────────────────────────────────────────────────
  {
    id: 'id-single-interpreter',
    category: 'interpretive-density',
    name: { 'en-CA': 'Single interpreter' },
    description: {
      'en-CA':
        'A specific governance provision is read consistently because one steward carries the organizational reading. The institution\u2019s reading would shift if that steward were unavailable.',
    },
    institutionalIndicators: {
      'en-CA': [
        'Newer members defer to the same steward on interpretation questions',
        'No written interpretation memo exists',
        'Drift has occurred when the interpreter was absent',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Which governance provisions are read consistently because one steward is present?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Living interpretation register maintained by the governance liaison',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not characterise the interpreter\u2019s reading as biased',
        'Do not pressure the steward to formalise interpretations the body has not ratified',
      ],
    },
  },
  {
    id: 'id-oral-interpretation-record',
    category: 'interpretive-density',
    name: { 'en-CA': 'Oral interpretation record' },
    description: {
      'en-CA':
        'Interpretation decisions are carried in oral organizational memory rather than in records the governance body holds.',
    },
    institutionalIndicators: {
      'en-CA': [
        'Successor governance members rely on retelling rather than minutes',
        'Minutes record outcomes but not reasoning',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Where would a successor member find the rationale for past interpretation acts?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Adopting a brief reasoning appendix in interpretation-bearing minutes',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not retroactively codify reasoning the body has not ratified',
      ],
    },
  },
  {
    id: 'id-drift-without-witness',
    category: 'interpretive-density',
    name: { 'en-CA': 'Interpretation drift without witness' },
    description: {
      'en-CA':
        'Operating interpretation has drifted from written governance and no steward currently in role can name when or why the drift began.',
    },
    institutionalIndicators: {
      'en-CA': [
        'Practice diverges from text and no one disputes the divergence',
        'Stewards who could narrate the drift have already departed',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Which provisions are operated differently than they are written, and is that difference recognised?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Surface the drift to the governance body for explicit ratification or amendment',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not infer that the drift was deliberate',
      ],
    },
  },

  // ── operational-process-density ───────────────────────────────────────────
  {
    id: 'op-process-by-one-steward',
    category: 'operational-process-density',
    name: { 'en-CA': 'Process held by one steward' },
    description: {
      'en-CA':
        'A core operational process is operated end-to-end by a single steward whose departure would force organizational reconstruction.',
    },
    institutionalIndicators: {
      'en-CA': [
        'Process documentation, if any, captures outcomes but not decision points',
        'The steward routinely fields questions from across the institution',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Which processes are operated end-to-end by a single steward today?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Pair stewardship on the most exposed decision points',
        'Capture decision-point reasoning in the steward\u2019s own words',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not propose pairing without the steward\u2019s consent',
      ],
    },
  },
  {
    id: 'op-undocumented-decision-points',
    category: 'operational-process-density',
    name: { 'en-CA': 'Undocumented decision points' },
    description: {
      'en-CA':
        'A process is documented at the activity level but the decision points within it are carried in stewards\u2019 organizational reading.',
    },
    institutionalIndicators: {
      'en-CA': [
        'Documentation reads as a checklist with no rationale',
        'New stewards must shadow before they can operate the process',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Which decision points within this process are not visible in its documentation?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Annotated walk-through that captures the reasoning behind each decision point',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not assume undocumented reasoning is wrong',
      ],
    },
  },
  {
    id: 'op-process-rationale-loss',
    category: 'operational-process-density',
    name: { 'en-CA': 'Process rationale loss' },
    description: {
      'en-CA':
        'A process is maintained out of organizational habit; the original rationale is no longer accessible to anyone who operates it today.',
    },
    institutionalIndicators: {
      'en-CA': [
        'Stewards cannot answer why the process exists',
        'Documentation refers to circumstances that no longer apply',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Which processes are operated today whose original purpose the institution can no longer reach?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Convene a rationale-recovery conversation with the longest-tenured stewards available',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not retire a process before its current organizational function has been verified',
      ],
    },
  },

  // ── onboarding-mentorship-density ────────────────────────────────────────
  {
    id: 'om-mentor-dependency',
    category: 'onboarding-mentorship-density',
    name: { 'en-CA': 'Mentor dependency' },
    description: {
      'en-CA':
        'Onboarding for a particular role has historically depended on one mentor whose absence would materially slow the next steward\u2019s orientation.',
    },
    institutionalIndicators: {
      'en-CA': [
        'New stewards in this role have all been oriented by the same mentor',
        'No second mentor has been prepared',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Which roles depend on a specific mentor for orientation, and is the dependency recognised?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Pair-mentorship for the next orientation cycle',
        'Capture the mentor\u2019s orientation arc in writing for organizational records',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not formalise mentorship in ways that strip its organizational character',
      ],
    },
  },
  {
    id: 'om-orientation-by-presence',
    category: 'onboarding-mentorship-density',
    name: { 'en-CA': 'Orientation by presence' },
    description: {
      'en-CA':
        'New stewards absorb organizational context through co-presence rather than through any defined orientation programme.',
    },
    institutionalIndicators: {
      'en-CA': [
        'Orientation is described as "you\u2019ll pick it up"',
        'New stewards report long orientation horizons',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'What does a new steward absorb in the first year that the institution has not written down?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Draft a minimal organizational orientation note that complements presence-based learning',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not replace presence-based learning with a checklist',
      ],
    },
  },
  {
    id: 'om-cohort-gap',
    category: 'onboarding-mentorship-density',
    name: { 'en-CA': 'Cohort gap' },
    description: {
      'en-CA':
        'A significant generational or tenure gap between stewards leaves orientation responsibility concentrated on the few stewards who bridge the gap.',
    },
    institutionalIndicators: {
      'en-CA': [
        'Steward tenure distribution is bimodal with a missing middle',
        'Bridge stewards are routinely asked to translate between cohorts',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Which stewards currently bridge the institution\u2019s tenure gap, and what would happen in their absence?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Recognise bridge stewardship explicitly in role descriptions',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not propose hiring patterns the institution has not asked for',
      ],
    },
  },

  // ── external-counterpart-memory-density ──────────────────────────────────
  {
    id: 'em-external-memory-holder',
    category: 'external-counterpart-memory-density',
    name: { 'en-CA': 'External memory holder' },
    description: {
      'en-CA':
        'An external counterpart \u2014 supplier, partner, regulator \u2014 functions as a memory holder for organizational context the institution has not preserved internally.',
    },
    institutionalIndicators: {
      'en-CA': [
        'The institution turns to the counterpart to reconstruct its own history',
        'The counterpart\u2019s own staff turnover would erase the memory',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Where does the institution rely on an external counterpart to remember its own context?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Repatriate the relevant organizational memory into the institution\u2019s records',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not act unilaterally on relationships with sensitive counterparts',
      ],
    },
  },
  {
    id: 'em-vendor-rationale-keeper',
    category: 'external-counterpart-memory-density',
    name: { 'en-CA': 'Vendor rationale keeper' },
    description: {
      'en-CA':
        'A vendor or implementation partner holds the rationale for organizational decisions the institution itself has not recorded.',
    },
    institutionalIndicators: {
      'en-CA': [
        'Implementation decisions are explained by the vendor in vendor language',
        'Internal stewards cannot reconstruct the decisions independently',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Which organizational decisions are currently held in vendor records the institution does not retain?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Internal decision register that captures rationale in organizational language',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not relitigate vendor decisions inside the engagement',
      ],
    },
  },
  {
    id: 'em-regulator-context-holder',
    category: 'external-counterpart-memory-density',
    name: { 'en-CA': 'Regulator context holder' },
    description: {
      'en-CA':
        'A regulator or oversight body holds context about the institution\u2019s history that the institution itself has not curated.',
    },
    institutionalIndicators: {
      'en-CA': [
        'Past regulatory correspondence is the most complete record of past decisions',
        'Successor stewards prepare for regulator interactions by reading regulator files',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Where does the institution\u2019s record of itself live in a regulator\u2019s archive rather than its own?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Index regulator correspondence into the institution\u2019s own archive',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not surface matters under active regulator review',
      ],
    },
  },

  // ── modernization-stewardship-overload ───────────────────────────────────
  {
    id: 'mo-modernization-by-one-steward',
    category: 'modernization-stewardship-overload',
    name: { 'en-CA': 'Modernization by one steward' },
    description: {
      'en-CA':
        'A modernization initiative depends on the continuity of one steward whose departure would stall the initiative materially.',
    },
    institutionalIndicators: {
      'en-CA': [
        'No second steward can carry the initiative\u2019s history forward',
        'The initiative\u2019s rationale lives in one steward\u2019s reading',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Which modernization initiatives are currently exposed to a single steward\u2019s continuity?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Co-stewardship pairing for the highest-exposure initiatives',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not pause the initiative without proper organizational process',
      ],
    },
  },
  {
    id: 'mo-modernization-with-day-job',
    category: 'modernization-stewardship-overload',
    name: { 'en-CA': 'Modernization carried alongside the day job' },
    description: {
      'en-CA':
        'Modernization work is being absorbed by stewards whose primary role has not been adjusted to make room for it.',
    },
    institutionalIndicators: {
      'en-CA': [
        'Modernization is named as additional load rather than as a redistributed role',
        'Stewards self-report compressed primary work',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Which stewards are carrying modernization on top of their primary role, and is that recognised institutionally?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Explicit organizational acknowledgement of the additional load with named reciprocity',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not propose role changes outside the institution\u2019s normal process',
      ],
    },
  },
  {
    id: 'mo-modernization-rationale-loss',
    category: 'modernization-stewardship-overload',
    name: { 'en-CA': 'Modernization rationale loss' },
    description: {
      'en-CA':
        'A past modernization\u2019s rationale has already been lost, even though the modernization itself continues to operate.',
    },
    institutionalIndicators: {
      'en-CA': [
        'Stewards inherit the modernization without inheriting the reasoning',
        'Subsequent modernizations rebuild rather than extend',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Which past modernizations are operated today without access to their original rationale?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Rationale-recovery conversation with surviving participants where possible',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not relitigate the modernization\u2019s original choice',
      ],
    },
  },

  // ── continuity-fairness-imbalance ────────────────────────────────────────
  {
    id: 'cf-unrecognised-load',
    category: 'continuity-fairness-imbalance',
    name: { 'en-CA': 'Unrecognised load' },
    description: {
      'en-CA':
        'Continuity load carried by a steward is materially larger than the recognition the institution provides for that load.',
    },
    institutionalIndicators: {
      'en-CA': [
        'Steward role description omits the continuity load',
        'Institution acknowledges the divergence privately but not formally',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Where does continuity load and visible recognition diverge in this institution?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Adjust the role description to reflect the load',
        'Name reciprocity terms the institution can honour',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not promise compensation adjustments outside normal organizational channels',
      ],
    },
  },
  {
    id: 'cf-load-on-quieter-voice',
    category: 'continuity-fairness-imbalance',
    name: { 'en-CA': 'Load on quieter voice' },
    description: {
      'en-CA':
        'Continuity load is disproportionately carried by stewards in groups whose organizational voice is quieter, in a pattern the institution may not have intended.',
    },
    institutionalIndicators: {
      'en-CA': [
        'Pattern of load distribution recognised by sponsor when surfaced',
        'No formal equity process has examined the pattern',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Where is continuity load concentrated, and does that concentration correspond to quieter organizational voice?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Refer the pattern to the institution\u2019s own equity process',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not adjudicate equity inside the engagement',
      ],
    },
  },
  {
    id: 'cf-reciprocity-gap',
    category: 'continuity-fairness-imbalance',
    name: { 'en-CA': 'Reciprocity gap' },
    description: {
      'en-CA':
        'The institution has repeatedly added continuity load to a steward without naming what is offered in return.',
    },
    institutionalIndicators: {
      'en-CA': [
        'Additional load was added informally over time',
        'Reciprocity terms have never been recorded',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'When the institution adds continuity load, what reciprocity is named, and is it recorded?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Record reciprocity terms alongside any new continuity load',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not litigate past reciprocity gaps inside the engagement',
      ],
    },
  },

  // ── silent-stewardship ───────────────────────────────────────────────────
  {
    id: 'ss-invisible-role',
    category: 'silent-stewardship',
    name: { 'en-CA': 'Invisible role' },
    description: {
      'en-CA':
        'A steward carries a role the institution depends on but does not name in any organisational chart or role description.',
    },
    institutionalIndicators: {
      'en-CA': [
        'The role is referred to informally',
        'The role would not appear in a published organisational chart',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Which roles does the institution depend on that no chart or document names?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Name the role in organizational documents the steward consents to',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not formalise the role without the steward\u2019s explicit consent',
      ],
    },
  },
  {
    id: 'ss-load-not-in-job-description',
    category: 'silent-stewardship',
    name: { 'en-CA': 'Load outside the job description' },
    description: {
      'en-CA':
        'A steward\u2019s actual continuity load extends materially beyond what their formal job description acknowledges.',
    },
    institutionalIndicators: {
      'en-CA': [
        'Job description has not been revised in years despite role drift',
        'Institution recognises the drift privately',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Where has the work outgrown the job description, and is that acknowledged?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Revise the job description in partnership with the steward',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not use revision as a vehicle for performance review',
      ],
    },
  },
  {
    id: 'ss-cohort-load-on-one-person',
    category: 'silent-stewardship',
    name: { 'en-CA': 'Cohort load on one person' },
    description: {
      'en-CA':
        'A load that organizational convention would normally distribute across a cohort is, in practice, concentrated on a single steward.',
    },
    institutionalIndicators: {
      'en-CA': [
        'Other cohort members defer the load to the same person',
        'Past attempts at distribution lapsed quickly',
      ],
    },
    mappingPrompts: {
      'en-CA': [
        'Which loads belong to a cohort by convention but rest on one steward in practice?',
      ],
    },
    stabilizationOptions: {
      'en-CA': [
        'Cohort distribution conversation hosted by the executive sponsor',
      ],
    },
    redLines: {
      'en-CA': [
        'Do not name cohort members publicly during the engagement',
      ],
    },
  },
];

export const STEWARDSHIP_BURDEN_PATTERNS_BY_CATEGORY: Readonly<
  Record<StewardshipBurdenCategory, readonly StewardshipBurdenPattern[]>
> = Object.freeze(
  STEWARDSHIP_BURDEN_PATTERNS.reduce(
    (acc, pattern) => {
      const bucket = acc[pattern.category] ?? [];
      acc[pattern.category] = [...bucket, pattern];
      return acc;
    },
    {} as Record<StewardshipBurdenCategory, readonly StewardshipBurdenPattern[]>,
  ),
);

export const STEWARDSHIP_BURDEN_PATTERNS_BY_ID: Readonly<
  Record<StewardshipBurdenPatternId, StewardshipBurdenPattern>
> = Object.freeze(
  STEWARDSHIP_BURDEN_PATTERNS.reduce(
    (acc, pattern) => {
      acc[pattern.id] = pattern;
      return acc;
    },
    {} as Record<StewardshipBurdenPatternId, StewardshipBurdenPattern>,
  ),
);
