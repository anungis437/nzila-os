/**
 * OCI Executive Workshop Flows.
 *
 * Five workshop flows, one per canonical facilitation session type.
 * Each flow encodes the structured arc the facilitator carries
 * through the session. Each step records the prompt the facilitator
 * makes, what the facilitator listens to surface, facilitator-only
 * notes, the tone the facilitator carries, and the red lines that
 * bound the step.
 *
 * Doctrine source: docs/oci/OCI_WORKSHOP_OPENING_SCRIPT.md
 */

import type { FacilitationSessionType, WorkshopFlow } from './types';

export const EXECUTIVE_WORKSHOP_FLOWS: readonly WorkshopFlow[] = [
  {
    sessionType: 'executive-interpretation',
    title: { 'en-CA': 'Executive Interpretation Flow' },
    summary: {
      'en-CA':
        'A reading of the Executive Continuity Brief with the sponsor, page by page, with no diagnosis and no decision request at close.',
    },
    steps: [
      {
        stepId: 'opening-reflection',
        prompt: {
          'en-CA':
            'Before we open the Brief, what has the institution been carrying that you wanted a record of?',
        },
        expectedSurface: {
          'en-CA':
            'A short statement, in the sponsor\u2019s own voice, of the continuity question the institution recognises.',
        },
        facilitatorNotes: {
          'en-CA':
            'Listen without writing. Let the sponsor name the question first; the Brief\u2019s language follows their language, not the other way around.',
        },
        tonePosture: { 'en-CA': 'Calm, unhurried, observational.' },
        redLines: {
          'en-CA': [
            'Do not summarise the Brief before the sponsor has spoken',
            'Do not assert what the institution is carrying on the sponsor\u2019s behalf',
          ],
        },
      },
      {
        stepId: 'operational-mapping',
        prompt: {
          'en-CA':
            'We will read the Brief together, at your pace. Stop wherever a page asks to be held.',
        },
        expectedSurface: {
          'en-CA':
            'Sponsor identifies the pages that resonate; some pages will pass quickly, others will hold the room.',
        },
        facilitatorNotes: {
          'en-CA':
            'Read each page aloud or in silence as the sponsor prefers. Note the pages they hold; do not interpret why.',
        },
        tonePosture: { 'en-CA': 'Editorial, patient.' },
        redLines: {
          'en-CA': [
            'Do not paraphrase the Brief into recommendations',
            'Do not skip pages to maintain pace',
          ],
        },
      },
      {
        stepId: 'stewardship-recognition',
        prompt: {
          'en-CA':
            'The Brief names organizational roles, not individuals. Where the sponsor recognises a specific steward, we name the role and recognise the person quietly.',
        },
        expectedSurface: {
          'en-CA':
            'The sponsor will, naturally, attach names to the roles. The recognition is organizational even when the name is shared.',
        },
        facilitatorNotes: {
          'en-CA':
            'When a name is shared, repeat it once in the spirit of acknowledgement. Do not characterise the person further.',
        },
        tonePosture: { 'en-CA': 'Dignified, brief.' },
        redLines: {
          'en-CA': [
            'Do not characterise the steward\u2019s performance, conduct, or capability',
            'Do not promise to address the steward in the institution\u2019s next phase',
          ],
        },
      },
      {
        stepId: 'governance-realization',
        prompt: {
          'en-CA':
            'What in the Brief had not been articulated inside the institution before today?',
        },
        expectedSurface: {
          'en-CA':
            'The sponsor names one or two articulations that surface for the first time in this reading.',
        },
        facilitatorNotes: {
          'en-CA':
            'These articulations are the most important record of the session. Note them in the sponsor\u2019s own words.',
        },
        tonePosture: { 'en-CA': 'Quiet attentiveness.' },
        redLines: {
          'en-CA': [
            'Do not propose what the institution should do about the new articulation',
            'Do not record the articulation in language other than the sponsor\u2019s',
          ],
        },
      },
      {
        stepId: 'stabilization-pathway',
        prompt: {
          'en-CA':
            'There is no decision in front of you today. The Brief is yours. Read it again at your pace. We will speak again when you are ready.',
        },
        expectedSurface: {
          'en-CA':
            'A close without commitment. The sponsor leaves the room with the Brief and time.',
        },
        facilitatorNotes: {
          'en-CA':
            'Do not schedule the next session before leaving. Let the sponsor reach out when the Brief has settled.',
        },
        tonePosture: { 'en-CA': 'Honest closure, no pressure.' },
        redLines: {
          'en-CA': [
            'Do not ask for a Mapping decision at the close',
            'Do not propose follow-up timelines unprompted',
          ],
        },
      },
    ],
  },
  {
    sessionType: 'workbook-orientation',
    title: { 'en-CA': 'Workbook Orientation Flow' },
    summary: {
      'en-CA':
        'An orientation to the Governance Entropy Workbook with the sponsor and continuity steward, naming what the workbook is and is not, and agreeing a working cadence.',
    },
    steps: [
      {
        stepId: 'opening-reflection',
        prompt: {
          'en-CA':
            'The workbook is the instrument; the substance is what the institution holds. Today we orient. We do not fill the workbook today.',
        },
        expectedSurface: {
          'en-CA':
            'The room understands that Mapping is a slow phase and that today\u2019s session has a bounded purpose.',
        },
        facilitatorNotes: {
          'en-CA':
            'Set the bounded purpose explicitly. Stewards arriving expecting to begin work need to know the session is preparatory.',
        },
        tonePosture: { 'en-CA': 'Plain, structural.' },
        redLines: {
          'en-CA': [
            'Do not begin filling sections during orientation',
            'Do not characterise the workbook as an efficiency instrument or an output-tracking tool',
          ],
        },
      },
      {
        stepId: 'operational-mapping',
        prompt: {
          'en-CA':
            'We will walk the workbook\u2019s sections by name. Each section has a purpose and a posture; we name both.',
        },
        expectedSurface: {
          'en-CA':
            'The steward and the sponsor recognise the sections as organizational, not as a survey of personal effort.',
        },
        facilitatorNotes: {
          'en-CA':
            'Name each section\u2019s purpose in one sentence; name its posture in one sentence. Do not extend.',
        },
        tonePosture: { 'en-CA': 'Editorial, brief.' },
        redLines: {
          'en-CA': [
            'Do not show example workbook entries from other institutions',
            'Do not assert how long any section will take',
          ],
        },
      },
      {
        stepId: 'stewardship-recognition',
        prompt: {
          'en-CA':
            'The workbook will name memory holders by role and by name. A steward who appears in the workbook is being recognised; they are not being measured.',
        },
        expectedSurface: {
          'en-CA':
            'The steward in the room hears, plainly, that their entry is recognition rather than measurement.',
        },
        facilitatorNotes: {
          'en-CA':
            'This is the most important sentence of the session. Deliver it slowly. Do not move on until the steward has heard it.',
        },
        tonePosture: { 'en-CA': 'Dignified, direct.' },
        redLines: {
          'en-CA': [
            'Do not bundle this with operational logistics',
            'Do not introduce scoring or rating language',
          ],
        },
      },
      {
        stepId: 'governance-realization',
        prompt: {
          'en-CA':
            'The Stewardship Density Index will be computed from the workbook. It is organizational, not personal. It is not shared outside this engagement without explicit organizational approval.',
        },
        expectedSurface: {
          'en-CA':
            'The sponsor confirms the anti-surveillance and AI boundaries before any workbook content is recorded.',
        },
        facilitatorNotes: {
          'en-CA':
            'Reference the OCI Anti-Surveillance Position and OCI AI Boundary documents by name. Leave printed copies if the sponsor wishes.',
        },
        tonePosture: { 'en-CA': 'Structural, plain.' },
        redLines: {
          'en-CA': [
            'Do not soften the boundary statements to make the orientation faster',
            'Do not invite the sponsor to defer the boundary conversation',
          ],
        },
      },
      {
        stepId: 'stabilization-pathway',
        prompt: {
          'en-CA':
            'What cadence is realistic for the steward, week to week, over the next six weeks?',
        },
        expectedSurface: {
          'en-CA':
            'A cadence agreed in the room that matches the steward\u2019s actual availability, including pause windows.',
        },
        facilitatorNotes: {
          'en-CA':
            'Listen to the steward more than to the sponsor. Stewards are often over-committed by sponsor enthusiasm; the cadence must reflect reality.',
        },
        tonePosture: { 'en-CA': 'Protective of the steward.' },
        redLines: {
          'en-CA': [
            'Do not commit the steward to a cadence the sponsor proposed and the steward did not affirm',
            'Do not schedule sessions inside the institution\u2019s named pause windows',
          ],
        },
      },
    ],
  },
  {
    sessionType: 'stewardship-density-review',
    title: { 'en-CA': 'Stewardship Density Review Flow' },
    summary: {
      'en-CA':
        'A reading of the Stewardship Density Index as an organizational figure, with the cartography alongside, ending in an organizational note rather than personal interventions.',
    },
    steps: [
      {
        stepId: 'opening-reflection',
        prompt: {
          'en-CA':
            'Before we read the Index, what concentrations did the institution already know it carried?',
        },
        expectedSurface: {
          'en-CA':
            'The sponsor or governance liaison surfaces concentrations the institution recognised before the Index was computed.',
        },
        facilitatorNotes: {
          'en-CA':
            'This question grounds the Index as a confirmation of organizational self-knowledge, not as an external verdict.',
        },
        tonePosture: { 'en-CA': 'Observational, unhurried.' },
        redLines: {
          'en-CA': [
            'Do not lead with the Index figure',
            'Do not characterise the institution\u2019s prior self-knowledge as incomplete',
          ],
        },
      },
      {
        stepId: 'operational-mapping',
        prompt: {
          'en-CA':
            'We read the Index figure and the interpretive paragraph that accompanies it. The figure is a measure of concentration. It is not a verdict.',
        },
        expectedSurface: {
          'en-CA':
            'The Index is read as a description. The interpretive paragraph is read aloud once.',
        },
        facilitatorNotes: {
          'en-CA':
            'Do not embellish the interpretive paragraph; it is canonical. Do not introduce comparable institutions.',
        },
        tonePosture: { 'en-CA': 'Editorial, level.' },
        redLines: {
          'en-CA': [
            'Do not show benchmarks or other institutions\u2019 figures',
            'Do not frame the Index as a leaderboard or maturity rating',
          ],
        },
      },
      {
        stepId: 'stewardship-recognition',
        prompt: {
          'en-CA':
            'The cartography sits alongside the Index. Where the Index identifies a concentration, the cartography names the role that carries it. We recognise the role; we do not characterise the person.',
        },
        expectedSurface: {
          'en-CA':
            'The institution sees its concentrations at the role level, with stewards named only where recognition is appropriate.',
        },
        facilitatorNotes: {
          'en-CA':
            'When the sponsor reaches for a personal characterisation, return the conversation to the role with a short organizational sentence.',
        },
        tonePosture: { 'en-CA': 'Quiet, dignified.' },
        redLines: {
          'en-CA': [
            'Do not characterise the steward\u2019s capability or load tolerance',
            'Do not frame any steward as a single point of failure in personal terms',
          ],
        },
      },
      {
        stepId: 'governance-realization',
        prompt: {
          'en-CA':
            'Which concentrations does the institution wish to address, and which does the institution accept as the cost of its current shape?',
        },
        expectedSurface: {
          'en-CA':
            'The sponsor articulates which concentrations are accepted and which become candidates for Stabilization.',
        },
        facilitatorNotes: {
          'en-CA':
            'Acceptance is honourable. Not every concentration is a problem. The institution chooses what to address.',
        },
        tonePosture: { 'en-CA': 'Respectful of organizational choice.' },
        redLines: {
          'en-CA': [
            'Do not pressure the institution toward addressing every concentration',
            'Do not commit stabilisation moves in this session',
          ],
        },
      },
      {
        stepId: 'stabilization-pathway',
        prompt: {
          'en-CA':
            'A short organizational note from this session will accompany the cartography into Stabilization. The note is the institution\u2019s record of what it has chosen to take forward.',
        },
        expectedSurface: {
          'en-CA':
            'A few sentences, recorded in the sponsor\u2019s voice, naming what the institution carries into the next phase.',
        },
        facilitatorNotes: {
          'en-CA':
            'The note is short and is the institution\u2019s own. The facilitator drafts it from the sponsor\u2019s words; the sponsor edits.',
        },
        tonePosture: { 'en-CA': 'Editorial, faithful to the sponsor.' },
        redLines: {
          'en-CA': [
            'Do not record stabilisation commitments in the note',
            'Do not paraphrase the sponsor into facilitator language',
          ],
        },
      },
    ],
  },
  {
    sessionType: 'continuity-breakpoint-working-session',
    title: { 'en-CA': 'Continuity Breakpoint Working Flow' },
    summary: {
      'en-CA':
        'A working session that identifies a small number of stabilisation moves that reduce fragility without adding load on named stewards.',
    },
    steps: [
      {
        stepId: 'opening-reflection',
        prompt: {
          'en-CA':
            'Stabilisation is reductive. It removes fragility. If a move looks like it adds work, we re-shape it or we do not do it.',
        },
        expectedSurface: {
          'en-CA':
            'The room enters the session with the reductive frame in place rather than the project-planning frame.',
        },
        facilitatorNotes: {
          'en-CA':
            'Sponsors arrive expecting a planning meeting. Reframe explicitly before the cartography is opened.',
        },
        tonePosture: { 'en-CA': 'Plain, structural.' },
        redLines: {
          'en-CA': [
            'Do not let the session become a project plan',
            'Do not allow moves that depend on additional steward hours',
          ],
        },
      },
      {
        stepId: 'operational-mapping',
        prompt: {
          'en-CA':
            'We read the cartography\u2019s most concentrated dependencies. For each: if it failed in the next quarter, would the institution regret it?',
        },
        expectedSurface: {
          'en-CA':
            'A short list of dependencies the institution would regret losing within a quarter.',
        },
        facilitatorNotes: {
          'en-CA':
            'The quarter horizon is editorial; longer horizons dilute the discipline. Hold to it.',
        },
        tonePosture: { 'en-CA': 'Editorial, time-bounded.' },
        redLines: {
          'en-CA': [
            'Do not extend the horizon to "someday" or to "over the next year"',
            'Do not characterise individual stewards in evaluating dependencies',
          ],
        },
      },
      {
        stepId: 'stewardship-recognition',
        prompt: {
          'en-CA':
            'Each dependency we name is carried by people. Before we propose a move, we recognise the steward who has been carrying the dependency.',
        },
        expectedSurface: {
          'en-CA':
            'The room acknowledges the steward\u2019s labour before proposing a stabilisation move that affects it.',
        },
        facilitatorNotes: {
          'en-CA':
            'This is a discipline of conduct, not a ceremony. The recognition is one sentence per steward, not a tribute.',
        },
        tonePosture: { 'en-CA': 'Dignified, brief.' },
        redLines: {
          'en-CA': [
            'Do not propose stabilisation that shifts load onto the same steward',
            'Do not frame the steward as the source of the fragility',
          ],
        },
      },
      {
        stepId: 'governance-realization',
        prompt: {
          'en-CA':
            'For each dependency, we draft a move that reduces fragility without adding load. If we cannot draft such a move today, we set the dependency aside for a later session.',
        },
        expectedSurface: {
          'en-CA':
            'A short list of stabilisation moves that the institution can carry, and a smaller list of dependencies deferred.',
        },
        facilitatorNotes: {
          'en-CA':
            'Deferral is a legitimate outcome. The discipline of refusing additive moves protects the institution\u2019s operating load.',
        },
        tonePosture: { 'en-CA': 'Honest, reductive.' },
        redLines: {
          'en-CA': [
            'Do not force a move where the reductive form does not yet exist',
            'Do not bundle multiple moves to inflate the priority list',
          ],
        },
      },
      {
        stepId: 'stabilization-pathway',
        prompt: {
          'en-CA':
            'The list becomes the operational survivability priorities. It is short, time-bounded, and the institution\u2019s own.',
        },
        expectedSurface: {
          'en-CA':
            'A draft one-page priorities document, ready for the sponsor to ratify before the governance continuity plan is drafted.',
        },
        facilitatorNotes: {
          'en-CA':
            'Keep the document to one page. Longer documents lose the discipline that produced them.',
        },
        tonePosture: { 'en-CA': 'Editorial, restrained.' },
        redLines: {
          'en-CA': [
            'Do not produce a multi-page priorities document',
            'Do not append rationales beyond one sentence per move',
          ],
        },
      },
    ],
  },
  {
    sessionType: 'governance-continuity-plan-ratification',
    title: { 'en-CA': 'Governance Continuity Plan Ratification Flow' },
    summary: {
      'en-CA':
        'A reading of the draft governance continuity plan in preparation for ratification by the institution\u2019s governance body under its own procedures.',
    },
    steps: [
      {
        stepId: 'opening-reflection',
        prompt: {
          'en-CA':
            'The plan was drafted by the institution under facilitation. Today we read it together and confirm that the plan is the institution\u2019s.',
        },
        expectedSurface: {
          'en-CA':
            'The sponsor and governance liaison hear, plainly, that the plan is their own document.',
        },
        facilitatorNotes: {
          'en-CA':
            'If the room treats the plan as the facilitator\u2019s deliverable, the engagement has slipped. Reframe before reading.',
        },
        tonePosture: { 'en-CA': 'Quiet, direct.' },
        redLines: {
          'en-CA': [
            'Do not refer to the plan as "our plan" from the facilitator\u2019s voice',
            'Do not present the plan as a finished product',
          ],
        },
      },
      {
        stepId: 'operational-mapping',
        prompt: {
          'en-CA':
            'We read the plan page by page. Where the language could be clearer for the governance body, we note an edit. We do not redesign the plan.',
        },
        expectedSurface: {
          'en-CA':
            'A modest set of language edits, in the sponsor\u2019s voice, that sharpen the plan without redesigning it.',
        },
        facilitatorNotes: {
          'en-CA':
            'Edits are language-level. Structural redesign at this stage means the previous phase was not closed; raise that separately if it is true.',
        },
        tonePosture: { 'en-CA': 'Editorial, careful.' },
        redLines: {
          'en-CA': [
            'Do not redraft sections wholesale in this session',
            'Do not introduce new commitments not derived from Phase 3',
          ],
        },
      },
      {
        stepId: 'stewardship-recognition',
        prompt: {
          'en-CA':
            'Where the plan names a steward, the plan also names an organizational response. We confirm this pattern across the document.',
        },
        expectedSurface: {
          'en-CA':
            'Every named steward has a paired organizational response, with no exceptions.',
        },
        facilitatorNotes: {
          'en-CA':
            'This is the highest-priority review pass. A steward named without an organizational response is a doctrine violation in print.',
        },
        tonePosture: { 'en-CA': 'Vigilant, plain.' },
        redLines: {
          'en-CA': [
            'Do not approve a section that names a steward without an organizational response',
            'Do not allow the plan to read as personal accountability assignment',
          ],
        },
      },
      {
        stepId: 'governance-realization',
        prompt: {
          'en-CA':
            'Ratification is a governance act under the body\u2019s own procedures. The plan does not commit the body to anything beyond what the body itself will ratify.',
        },
        expectedSurface: {
          'en-CA':
            'The governance liaison confirms the plan is in a form the body can read, debate, amend, or ratify under its rules.',
        },
        facilitatorNotes: {
          'en-CA':
            'The facilitator does not attend the ratification vote. State this plainly so no role confusion remains.',
        },
        tonePosture: { 'en-CA': 'Respectful of governance.' },
        redLines: {
          'en-CA': [
            'Do not promise ratification timing on the body\u2019s behalf',
            'Do not propose the facilitator attend the ratification vote',
          ],
        },
      },
      {
        stepId: 'stabilization-pathway',
        prompt: {
          'en-CA':
            'When the body ratifies, the plan is the institution\u2019s operating record. When the body amends or defers, the institution\u2019s process governs the next step.',
        },
        expectedSurface: {
          'en-CA':
            'A clear understanding that ratification is one outcome among several, all of which the institution owns.',
        },
        facilitatorNotes: {
          'en-CA':
            'Pre-empt the assumption that ratification is the only honourable outcome. Deferral and amendment are governance acts; they are not failures.',
        },
        tonePosture: { 'en-CA': 'Honest, generous.' },
        redLines: {
          'en-CA': [
            'Do not frame deferral or amendment as engagement failure',
            'Do not chase ratification through informal channels',
          ],
        },
      },
    ],
  },
];

/** Lookup map by session type, derived from the catalogue above. */
export const EXECUTIVE_WORKSHOP_FLOWS_BY_SESSION: Readonly<
  Record<FacilitationSessionType, WorkshopFlow>
> = Object.freeze(
  EXECUTIVE_WORKSHOP_FLOWS.reduce(
    (acc, flow) => {
      acc[flow.sessionType] = flow;
      return acc;
    },
    {} as Record<FacilitationSessionType, WorkshopFlow>,
  ),
);
