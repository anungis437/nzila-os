/**
 * OCI Organizational Discovery Framework.
 *
 * Five sections that, taken together, give the institution a
 * complete landscape view during Mapping. Each section carries
 * its own discovery prompts and a synthesis starter used by the
 * facilitator to open the section's reflective close.
 *
 * Doctrine sources:
 *  - docs/oci/OCI_PILOT_FRAMEWORK.md  (Phase 2: Mapping)
 *  - docs/oci/OCI_DELIVERY_MODEL.md   (Mapping cadence and artifacts)
 */

import type {
  DiscoveryPromptSection,
  DiscoverySectionId,
} from './types';

export const INSTITUTIONAL_DISCOVERY_FRAMEWORK: readonly DiscoveryPromptSection[] = [
  {
    sectionId: 'governance-landscape',
    title: { 'en-CA': 'Governance Landscape' },
    purpose: {
      'en-CA':
        'To map the institution\u2019s governance structures, the cadence at which they operate, and the lineage of how decisions are made and remembered.',
    },
    prompts: [
      {
        promptId: 'governance-bodies',
        prompt: {
          'en-CA':
            'Which governance bodies hold authority over which decisions, and how often do they convene?',
        },
        rationale: {
          'en-CA':
            'Establishes the formal governance terrain before discussion of where memory of decisions actually lives.',
        },
      },
      {
        promptId: 'decision-record',
        prompt: {
          'en-CA':
            'When the institution makes a decision of consequence, where is its rationale recorded, and who keeps the record?',
        },
        rationale: {
          'en-CA':
            'Surfaces the gap between recording decisions (often present) and recording rationale (often absent).',
        },
      },
      {
        promptId: 'governance-succession',
        prompt: {
          'en-CA':
            'When members of the governance body change, what passes between the outgoing and incoming members, and what does not?',
        },
        rationale: {
          'en-CA':
            'Names governance succession as a continuity question rather than a procedural one.',
        },
      },
      {
        promptId: 'governance-interpretation',
        prompt: {
          'en-CA':
            'Who interprets ambiguous governance language for the institution, and how is that interpretation recorded?',
        },
        rationale: {
          'en-CA':
            'Identifies whether interpretation is concentrated in one person or distributed across roles.',
        },
      },
      {
        promptId: 'governance-cadence-drift',
        prompt: {
          'en-CA':
            'Where has the governance cadence drifted from its founding intent, by whose authority, and with what record?',
        },
        rationale: {
          'en-CA':
            'Surfaces undocumented drift that may compound over leadership transitions.',
        },
      },
    ],
    synthesisStarter: {
      'en-CA':
        'Looking across what we have just named, where does the institution\u2019s governance memory live, and where does it sit only in the room with us?',
    },
  },
  {
    sectionId: 'stewardship-hotspots',
    title: { 'en-CA': 'Stewardship Hotspots' },
    purpose: {
      'en-CA':
        'To identify the organizational roles in which continuity-critical knowledge is most concentrated, recognising the stewards who carry that knowledge.',
    },
    prompts: [
      {
        promptId: 'single-keeper-roles',
        prompt: {
          'en-CA':
            'Which organizational roles, today, are held by a single person whose departure would change how the institution operates within a quarter?',
        },
        rationale: {
          'en-CA':
            'Surfaces single-keeper roles without requiring the steward to be in the room.',
        },
      },
      {
        promptId: 'undocumented-stewardship',
        prompt: {
          'en-CA':
            'Which responsibilities are carried by stewards without being named in any role description, and who knows these responsibilities exist?',
        },
        rationale: {
          'en-CA':
            'Names invisible stewardship that organizational documentation does not capture.',
        },
      },
      {
        promptId: 'historical-stewards',
        prompt: {
          'en-CA':
            'When a long-tenured steward has left in the past, what did the institution discover it had lost in the months that followed?',
        },
        rationale: {
          'en-CA':
            'Draws on the institution\u2019s own historical memory to ground the discussion in lived continuity loss.',
        },
      },
      {
        promptId: 'unrecognised-load',
        prompt: {
          'en-CA':
            'Which stewards are carrying load the institution has not yet recognised, and how do you know?',
        },
        rationale: {
          'en-CA':
            'Surfaces unrecognised stewardship as an organizational debt to be paid before continuity work begins.',
        },
      },
      {
        promptId: 'role-vs-person',
        prompt: {
          'en-CA':
            'Where has a role become inseparable from the person currently holding it, and what would it take to recover the distinction?',
        },
        rationale: {
          'en-CA':
            'Frames stewardship hotspots as a role-design question rather than a personnel question.',
        },
      },
    ],
    synthesisStarter: {
      'en-CA':
        'Of the stewardship hotspots we have just named, which does the institution carry knowingly, and which surface today for the first time?',
    },
  },
  {
    sectionId: 'continuity-fragility',
    title: { 'en-CA': 'Continuity Fragility' },
    purpose: {
      'en-CA':
        'To name the dependencies whose failure would, within a quarter, change the institution\u2019s ability to operate as it currently does.',
    },
    prompts: [
      {
        promptId: 'quarter-horizon-failures',
        prompt: {
          'en-CA':
            'If the next quarter brought the unavailability of three specific organizational capacities, which three would the institution regret most?',
        },
        rationale: {
          'en-CA':
            'Bounds fragility to a quarter horizon, which keeps the discipline editorial rather than catastrophic.',
        },
      },
      {
        promptId: 'oral-only-knowledge',
        prompt: {
          'en-CA':
            'Which organizational knowledge today exists only in conversation, with no written record the institution can fall back on?',
        },
        rationale: {
          'en-CA':
            'Surfaces oral-only knowledge as a fragility class distinct from documented complexity.',
        },
      },
      {
        promptId: 'transition-near-misses',
        prompt: {
          'en-CA':
            'Where has the institution had a near-miss in continuity \u2014 a transition that almost went badly, even if it did not?',
        },
        rationale: {
          'en-CA':
            'Draws on near-misses as the most informative continuity evidence the institution holds.',
        },
      },
      {
        promptId: 'irrecoverable-records',
        prompt: {
          'en-CA':
            'Are there organizational records whose loss would be effectively irrecoverable, and where do those records live?',
        },
        rationale: {
          'en-CA':
            'Identifies record fragility as distinct from steward fragility, often requiring different stabilisation moves.',
        },
      },
      {
        promptId: 'concealed-dependencies',
        prompt: {
          'en-CA':
            'Are there dependencies on external counterparts \u2014 specific suppliers, partners, regulators \u2014 that the institution has not formally recognised?',
        },
        rationale: {
          'en-CA':
            'Surfaces fragilities outside the organizational boundary that internal continuity work may otherwise miss.',
        },
      },
    ],
    synthesisStarter: {
      'en-CA':
        'Of the fragilities we have just named, which does the institution carry by choice, and which would it choose to address if the choice were before it?',
    },
  },
  {
    sectionId: 'modernization-pressure',
    title: { 'en-CA': 'Modernization Pressure' },
    purpose: {
      'en-CA':
        'To map the modernization pressures the institution faces, distinguishing those it has chosen from those imposed on it, and recognising where modernization itself creates new continuity load.',
    },
    prompts: [
      {
        promptId: 'modernization-sources',
        prompt: {
          'en-CA':
            'What modernization pressures is the institution carrying, and which are chosen versus imposed by external context?',
        },
        rationale: {
          'en-CA':
            'Distinguishes voluntary from imposed modernization to avoid framing all modernization as organizational choice.',
        },
      },
      {
        promptId: 'modernization-stewardship',
        prompt: {
          'en-CA':
            'When the institution modernizes a process, who carries the organizational memory of the prior process, and for how long?',
        },
        rationale: {
          'en-CA':
            'Names the stewardship load created by modernization itself \u2014 a load often invisible to modernization plans.',
        },
      },
      {
        promptId: 'modernization-fragility',
        prompt: {
          'en-CA':
            'Where has a recent modernization introduced a new continuity fragility the institution did not anticipate?',
        },
        rationale: {
          'en-CA':
            'Surfaces fragility that modernization itself produces, distinct from legacy fragility.',
        },
      },
      {
        promptId: 'modernization-pacing',
        prompt: {
          'en-CA':
            'At what pace can the institution absorb modernization without overwhelming its stewardship capacity?',
        },
        rationale: {
          'en-CA':
            'Grounds the discussion of modernization in the institution\u2019s actual carrying capacity rather than in vendor timelines.',
        },
      },
      {
        promptId: 'modernization-deferral',
        prompt: {
          'en-CA':
            'Are there modernization moves the institution has deferred for continuity reasons, and what would change the institution\u2019s decision to defer?',
        },
        rationale: {
          'en-CA':
            'Names deferral as a legitimate organizational act and surfaces the conditions under which it might be revisited.',
        },
      },
    ],
    synthesisStarter: {
      'en-CA':
        'Of the modernization pressures we have just named, which align with the institution\u2019s continuity posture, and which sit in tension with it?',
    },
  },
  {
    sectionId: 'political-sensitivities',
    title: { 'en-CA': 'Political Sensitivities' },
    purpose: {
      'en-CA':
        'To recognise the political sensitivities the institution carries \u2014 internal and external \u2014 that may shape how continuity work is conducted, communicated, or paused.',
    },
    prompts: [
      {
        promptId: 'internal-political-context',
        prompt: {
          'en-CA':
            'Are there internal organizational sensitivities \u2014 between leadership and stewardship, between departments, between governance bodies \u2014 that the engagement should hold quietly?',
        },
        rationale: {
          'en-CA':
            'Surfaces internal political context without inviting the engagement to take a position within it.',
        },
      },
      {
        promptId: 'external-political-context',
        prompt: {
          'en-CA':
            'Are there external political pressures \u2014 from members, regulators, sector partners, funders \u2014 that shape what the institution can say publicly about continuity?',
        },
        rationale: {
          'en-CA':
            'Identifies external pressures that bear on the engagement\u2019s visibility posture.',
        },
      },
      {
        promptId: 'sensitive-topics',
        prompt: {
          'en-CA':
            'Are there topics the engagement should not raise without prior sponsor agreement?',
        },
        rationale: {
          'en-CA':
            'Establishes red lines explicitly, so the facilitator does not encounter them mid-session unprepared.',
        },
      },
      {
        promptId: 'pause-conditions',
        prompt: {
          'en-CA':
            'Under what political conditions would the institution prefer the engagement to pause?',
        },
        rationale: {
          'en-CA':
            'Sets a written record of pause conditions, so a future pause is recognised rather than negotiated under pressure.',
        },
      },
      {
        promptId: 'institutional-silence',
        prompt: {
          'en-CA':
            'Are there sensitive matters the institution carries about which it prefers no record be created, even within this engagement?',
        },
        rationale: {
          'en-CA':
            'Honours organizational silence as a legitimate posture; records the choice to not record rather than recording the matter itself.',
        },
      },
    ],
    synthesisStarter: {
      'en-CA':
        'Of the sensitivities we have just named, which should shape how the engagement conducts itself from this session forward?',
    },
  },
];

/** Lookup map by section identifier, derived from the framework above. */
export const INSTITUTIONAL_DISCOVERY_BY_SECTION: Readonly<
  Record<DiscoverySectionId, DiscoveryPromptSection>
> = Object.freeze(
  INSTITUTIONAL_DISCOVERY_FRAMEWORK.reduce(
    (acc, section) => {
      acc[section.sectionId] = section;
      return acc;
    },
    {} as Record<DiscoverySectionId, DiscoveryPromptSection>,
  ),
);
