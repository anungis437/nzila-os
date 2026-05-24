/**
 * OCI Facilitation Guide.
 *
 * One entry per canonical facilitation session type. Each entry
 * captures the editorial posture and operational guidance the
 * facilitator carries into the session.
 *
 * Doctrine source: docs/oci/OCI_WORKSHOP_OPENING_SCRIPT.md
 * Delivery model:  docs/oci/OCI_DELIVERY_MODEL.md
 */

import type { FacilitationGuideEntry, FacilitationSessionType } from './types';

export const FACILITATION_GUIDE: readonly FacilitationGuideEntry[] = [
  {
    sessionType: 'executive-interpretation',
    title: {
      'en-CA': 'Executive Interpretation Session',
    },
    purpose: {
      'en-CA':
        'To read the Executive Continuity Brief with the sponsor and at most one other institutional reader, in editorial pace, without diagnosis.',
    },
    audience: {
      'en-CA': [
        'Executive sponsor',
        'At most one additional institutional reader of the Brief',
        'Facilitator',
      ],
    },
    durationMinutes: 90,
    openingPosture: {
      'en-CA':
        'The Brief is a record of what the institution has been carrying. It is not a finding. It is not a recommendation. The session reads the shape of the institution together.',
    },
    mappingArc: {
      'en-CA': [
        'Recognition of the Brief as a record, not a verdict',
        'Page-by-page reading at the sponsor\u2019s pace',
        'Pause at moments the sponsor wishes to hold',
        'Closing without a decision; the sponsor decides in their own time whether to move into Mapping',
      ],
    },
    closingPosture: {
      'en-CA':
        'No decision is requested at the close. The Brief is left with the sponsor. The next conversation happens when the sponsor names a date.',
    },
    successSignals: {
      'en-CA': [
        'The sponsor can articulate the continuity shape in their own words after the reading',
        'The sponsor names at least one continuity dependency they had not previously articulated',
        'The room remains calm; the conversation does not accelerate into action planning',
      ],
    },
    failureSignals: {
      'en-CA': [
        'The facilitator interprets findings rather than reading the Brief',
        'The session accelerates toward action items or remediation lists',
        'The sponsor is pressed for a decision before the Brief has settled',
        'Specific individuals are characterised rather than institutional patterns',
      ],
    },
    materialsRequired: {
      'en-CA': [
        'Printed and bound Executive Continuity Brief (one copy per reader)',
        'Quiet room, in person where possible',
        'No slides, no laptops on the table, no projection',
      ],
    },
    whatToAvoid: {
      'en-CA': [
        'Opening with the engagement\u2019s branding or the Method by name',
        'Asserting urgency or scheduling a follow-up before the Brief has settled',
        'Showing comparable institutions\u2019 figures',
        'Characterising individuals named in the Brief',
        'Promising specific outcomes from a future engagement',
      ],
    },
  },
  {
    sessionType: 'workbook-orientation',
    title: {
      'en-CA': 'Workbook Orientation Session',
    },
    purpose: {
      'en-CA':
        'To open the Governance Entropy Workbook with the sponsor and the continuity steward, name its sections, and agree the cadence at which the institution will fill it.',
    },
    audience: {
      'en-CA': ['Executive sponsor', 'Continuity steward', 'Facilitator'],
    },
    durationMinutes: 60,
    openingPosture: {
      'en-CA':
        'Mapping is the slowest phase. The workbook in front of us is the instrument; the substance is what the institution holds in memory and in practice. Today we orient. We do not fill the workbook today.',
    },
    mappingArc: {
      'en-CA': [
        'A short statement of what Mapping is, and what it is not',
        'A walk through the workbook\u2019s sections by name',
        'A description of the Stewardship Density Index and its institutional, not personal, posture',
        'Agreement on the working cadence and the steward\u2019s available time',
      ],
    },
    closingPosture: {
      'en-CA':
        'The workbook is left in the room. The next session begins to fill it. No homework is assigned between sessions.',
    },
    successSignals: {
      'en-CA': [
        'The steward understands the workbook records roles and responsibilities, not personal evaluations',
        'A working cadence is agreed and is realistic for the steward\u2019s calendar',
        'The sponsor confirms the anti-surveillance and AI boundaries before the workbook is filled',
      ],
    },
    failureSignals: {
      'en-CA': [
        'The session moves into actually filling the workbook before orientation is complete',
        'The steward is left with the impression that they are being measured',
        'A cadence is agreed that does not match the steward\u2019s actual availability',
      ],
    },
    materialsRequired: {
      'en-CA': [
        'A printed copy of the workbook structure (sections and prompts, blank)',
        'A copy of the OCI Anti-Surveillance Position to leave with the sponsor',
        'A quiet room',
      ],
    },
    whatToAvoid: {
      'en-CA': [
        'Beginning to fill workbook sections during orientation',
        'Showing example workbooks from other institutions',
        'Asking the steward to volunteer additional hours beyond the agreed cadence',
        'Describing the workbook as an efficiency instrument or output-tracking tool',
      ],
    },
  },
  {
    sessionType: 'stewardship-density-review',
    title: {
      'en-CA': 'Stewardship Density Review',
    },
    purpose: {
      'en-CA':
        'To read the Stewardship Density Index together as an institutional figure, in editorial voice, without comparative benchmarking and without characterisation of individuals.',
    },
    audience: {
      'en-CA': [
        'Executive sponsor',
        'Governance liaison',
        'Continuity steward',
        'Facilitator',
      ],
    },
    durationMinutes: 90,
    openingPosture: {
      'en-CA':
        'The Index describes how much of the institution\u2019s continuity is held by how few of its people. It is a measure of concentration. It is not a measure of the people who carry the load.',
    },
    mappingArc: {
      'en-CA': [
        'A reading of the Index figure and its interpretive paragraph',
        'A reading of the Memory Holders cartography alongside the Index',
        'A grounded conversation about which concentrations the institution wishes to address',
        'A note of the conversation, kept in institutional records, for use in Stabilization',
      ],
    },
    closingPosture: {
      'en-CA':
        'No stabilisation moves are committed in this session. The reading produces a note; the moves are made in the next phase.',
    },
    successSignals: {
      'en-CA': [
        'The institution accepts the Index as a description of its own situation',
        'The conversation stays at the institutional level even when names of stewards come up',
        'The session ends with a small number of institutional questions, not a list of personal interventions',
      ],
    },
    failureSignals: {
      'en-CA': [
        'A specific steward is characterised by their proximity to the Index',
        'A comparable institution\u2019s figure is brought into the room',
        'Stabilisation moves are committed before the Stabilization phase opens',
        'The Index is treated as a verdict rather than as a description',
      ],
    },
    materialsRequired: {
      'en-CA': [
        'The institution\u2019s Stewardship Density Index page (printed)',
        'The institution\u2019s Memory Holders cartography (printed)',
        'A working note pad for the institutional note from the session',
      ],
    },
    whatToAvoid: {
      'en-CA': [
        'Showing benchmarks or comparable institutions\u2019 indices',
        'Naming a steward as a single point of failure in personal terms',
        'Framing the Index as a leaderboard, a score, or a maturity rating',
        'Committing to stabilisation moves before Phase 3 opens',
      ],
    },
  },
  {
    sessionType: 'continuity-breakpoint-working-session',
    title: {
      'en-CA': 'Continuity Breakpoint Working Session',
    },
    purpose: {
      'en-CA':
        'To identify, with the institution, which continuity dependencies to stabilise first, in a reductive discipline that removes fragility rather than adding work.',
    },
    audience: {
      'en-CA': [
        'Executive sponsor',
        'Continuity steward',
        'Governance liaison (when available)',
        'Facilitator',
      ],
    },
    durationMinutes: 120,
    openingPosture: {
      'en-CA':
        'Stabilisation is reductive. It removes fragility. If a stabilisation move looks like it adds work, we re-shape it or we do not do it.',
    },
    mappingArc: {
      'en-CA': [
        'A reading of the cartography\u2019s most concentrated dependencies',
        'A grounded question for each: if it failed in the next quarter, would the institution regret it?',
        'A short list of stabilisation moves that reduce fragility without adding load',
        'Agreement on which moves enter the operational survivability priorities',
      ],
    },
    closingPosture: {
      'en-CA':
        'A short, time-bounded list of priorities is drafted in the room. The list belongs to the institution and is refined before the governance continuity plan is drafted.',
    },
    successSignals: {
      'en-CA': [
        'The list is short \u2014 typically three to five priorities',
        'No priority requires a named steward to absorb additional load',
        'The sponsor recognises each priority as institutional, not personal',
      ],
    },
    failureSignals: {
      'en-CA': [
        'The list grows beyond what the institution can carry in a quarter',
        'A priority depends on a specific steward taking on additional hours',
        'The conversation drifts into modernization planning beyond stabilisation',
        'The facilitator proposes moves the institution did not ask for',
      ],
    },
    materialsRequired: {
      'en-CA': [
        'The institution\u2019s stewardship cartography (printed, marked)',
        'The institution\u2019s Stewardship Density Index page',
        'A draft template for the operational survivability priorities (one page)',
      ],
    },
    whatToAvoid: {
      'en-CA': [
        'Treating the session as a project planning meeting',
        'Loading additional responsibility onto a steward as a stabilisation move',
        'Framing stabilisation as transformation, modernization, or optimization',
        'Drifting into selling the embedding phase before Phase 3 closes',
      ],
    },
  },
  {
    sessionType: 'governance-continuity-plan-ratification',
    title: {
      'en-CA': 'Governance Continuity Plan Ratification Session',
    },
    purpose: {
      'en-CA':
        'To read the institution\u2019s draft governance continuity plan together in preparation for ratification by the governance body under its own procedures.',
    },
    audience: {
      'en-CA': [
        'Executive sponsor',
        'Governance liaison',
        'Continuity steward',
        'Facilitator',
        'Optional: representatives of the governance body',
      ],
    },
    durationMinutes: 90,
    openingPosture: {
      'en-CA':
        'The plan was drafted by the institution under facilitation. Today we read it together, note where the language could be clearer, and confirm that the plan is the institution\u2019s.',
    },
    mappingArc: {
      'en-CA': [
        'A page-by-page reading of the plan',
        'A noting of language that could be sharpened before the governance body reads it',
        'A confirmation that no individual is named as a single point of stewardship without an institutional response',
        'Agreement on the date the plan is presented to the governance body for ratification',
      ],
    },
    closingPosture: {
      'en-CA':
        'The plan leaves the room as the institution\u2019s document. Ratification is a governance act under the body\u2019s own procedures. The facilitator does not participate in the ratification vote.',
    },
    successSignals: {
      'en-CA': [
        'The sponsor recognises the plan as the institution\u2019s own',
        'Every fragility named is paired with an institutional move',
        'The governance liaison is confident bringing the plan to the body',
        'A clear ratification date is on the governance body\u2019s calendar',
      ],
    },
    failureSignals: {
      'en-CA': [
        'The plan reads as the facilitator\u2019s recommendations rather than the institution\u2019s commitments',
        'An individual is named as a single point of stewardship with no paired institutional move',
        'The plan commits the governance body to actions outside its remit',
        'The session pressures the body for an immediate ratification',
      ],
    },
    materialsRequired: {
      'en-CA': [
        'The draft governance continuity plan (printed, single copy per reader)',
        'A pen for sponsor edits',
        'The governance body\u2019s upcoming meeting calendar',
      ],
    },
    whatToAvoid: {
      'en-CA': [
        'Presenting the plan as the facilitator\u2019s deliverable',
        'Naming individuals as failure points without institutional response',
        'Asking the governance body to ratify on the day it first reads the plan',
        'Treating ratification as a marketing milestone',
      ],
    },
  },
];

/** Lookup map by session type, derived from the catalogue above. */
export const FACILITATION_GUIDE_BY_SESSION: Readonly<
  Record<FacilitationSessionType, FacilitationGuideEntry>
> = Object.freeze(
  FACILITATION_GUIDE.reduce(
    (acc, entry) => {
      acc[entry.sessionType] = entry;
      return acc;
    },
    {} as Record<FacilitationSessionType, FacilitationGuideEntry>,
  ),
);
