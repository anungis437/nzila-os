/**
 * OCI Continuity Conversation Prompts.
 *
 * A catalogue of conversation prompts the facilitator may draw on
 * across many sessions during the OCI pilot. The prompts are
 * categorised by the facet of continuity they probe; they are not
 * bound to a specific workshop flow.
 *
 * Every prompt is written in editorial voice, never in blame
 * voice. Prompts that would invite personal characterisation,
 * productivity comparison, or behavioural inference are out of
 * scope for the catalogue by design.
 *
 * Doctrine sources:
 *  - docs/oci/OCI_PILOT_FRAMEWORK.md
 *  - docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md
 *  - docs/doctrine/FIRST_CONTACT_MESSAGING.md
 */

import type {
  ConversationCategory,
  ConversationPrompt,
} from '../facilitation/types';

export const CONTINUITY_CONVERSATION_PROMPTS: readonly ConversationPrompt[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // Category 1 — Governance Survivability
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'gs-001',
    category: 'governance-survivability',
    question: {
      'en-CA':
        'If the chair of your governance body were unavailable for a quarter, which decisions would slow down, and which would still move?',
    },
    whyItMatters: {
      'en-CA':
        'Surfaces governance dependencies on a single chair without characterising the chair personally.',
    },
    whatToListenFor: {
      'en-CA': [
        'Whether the governance body has decision-making continuity in the chair\u2019s absence',
        'Which decisions are explicitly reserved to the chair by tradition rather than by rule',
        'Whether the institution has experienced a chair absence and what was learned',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Personal health information about the current chair',
        'Internal political disputes about chair succession',
      ],
    },
  },
  {
    id: 'gs-002',
    category: 'governance-survivability',
    question: {
      'en-CA':
        'When a member of the governance body departs, what passes to their successor, and what does the institution accept will be lost?',
    },
    whyItMatters: {
      'en-CA':
        'Names governance succession as a continuity question rather than a procedural one.',
    },
    whatToListenFor: {
      'en-CA': [
        'Presence or absence of a structured handover practice',
        'Acceptance of irreducible loss as a governance fact',
        'Whether departing members are debriefed on rationale, not just on activities',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Specific reasons for any individual\u2019s past departure',
        'Disputes between current and former governance members',
      ],
    },
  },
  {
    id: 'gs-003',
    category: 'governance-survivability',
    question: {
      'en-CA':
        'Are there decisions the governance body has made whose rationale would be hard to reconstruct today?',
    },
    whyItMatters: {
      'en-CA':
        'Identifies governance entropy without requiring the institution to litigate the underlying decisions.',
    },
    whatToListenFor: {
      'en-CA': [
        'Decisions whose written record captures the outcome but not the reasoning',
        'Decisions remembered by one steward whose departure would erase the rationale',
        'Acceptance that some lost rationale is a structural fact of long-tenured institutions',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'A current member\u2019s frustration about a specific past decision',
        'Suggestions of bad faith in governance acts whose rationale is now lost',
      ],
    },
  },
  {
    id: 'gs-004',
    category: 'governance-survivability',
    question: {
      'en-CA':
        'How does the institution distinguish between governance language that has been formally amended and governance language that has drifted by practice?',
    },
    whyItMatters: {
      'en-CA':
        'Surfaces drift between written governance and operating governance \u2014 a common continuity risk in long-tenured institutions.',
    },
    whatToListenFor: {
      'en-CA': [
        'Whether the institution maintains a living interpretation record',
        'Whether interpretation is concentrated in one steward',
        'Whether drift has been formally recognised at any cadence',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Specific past interpretive disputes with departed members',
        'Allegations that drift was deliberate rather than incidental',
      ],
    },
  },
  {
    id: 'gs-005',
    category: 'governance-survivability',
    question: {
      'en-CA':
        'If the governance body had to ratify a major decision next month without its longest-tenured member, where would the institution feel the absence?',
    },
    whyItMatters: {
      'en-CA':
        'Tests governance resilience to the loss of a single institutional memory holder without personalising the test.',
    },
    whatToListenFor: {
      'en-CA': [
        'Acknowledgement of concentration in long tenure rather than office',
        'Recognition that institutional memory is a governance function',
        'Whether the institution has prepared for this scenario',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Speculation about the longest-tenured member\u2019s departure',
        'Comparison of the member to others on the body',
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Category 2 — Stewardship Burden
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'sb-001',
    category: 'stewardship-burden',
    question: {
      'en-CA':
        'Which stewards in the institution are carrying responsibilities that no role description acknowledges?',
    },
    whyItMatters: {
      'en-CA':
        'Names unrecognised stewardship as an institutional fact requiring institutional response.',
    },
    whatToListenFor: {
      'en-CA': [
        'Examples of work the institution depends on but has not formalised',
        'Recognition that informality has a cost paid by specific stewards',
        'Sponsor willingness to formalise where possible',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Characterisation of the steward as either uniquely capable or uniquely overloaded',
        'Promises of compensation adjustments outside the institution\u2019s normal channels',
      ],
    },
  },
  {
    id: 'sb-002',
    category: 'stewardship-burden',
    question: {
      'en-CA':
        'Where would the institution most regret a steward\u2019s departure for reasons that are not yet articulated?',
    },
    whyItMatters: {
      'en-CA':
        'Surfaces stewardship value the institution feels but has not named in its records.',
    },
    whatToListenFor: {
      'en-CA': [
        'Roles where institutional knowledge has accumulated invisibly',
        'Recognition that articulating the value is itself a stewardship act',
        'Stewards whose departure would expose layers of dependency',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Speculation about specific stewards\u2019 plans to depart',
        'Personnel matters under active review',
      ],
    },
  },
  {
    id: 'sb-003',
    category: 'stewardship-burden',
    question: {
      'en-CA':
        'Where has institutional habit assumed a steward\u2019s capacity is unlimited, when in fact it is not?',
    },
    whyItMatters: {
      'en-CA':
        'Allows the sponsor to name overloads honestly without the steward needing to be the one to surface it.',
    },
    whatToListenFor: {
      'en-CA': [
        'Recognition of overload as an institutional pattern, not a personal failing',
        'Willingness to redistribute load as part of stabilisation',
        'Concrete examples of accumulated stewardship overflow',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Personal health or family information about the steward',
        'Comparisons between stewards on tolerance for load',
      ],
    },
  },
  {
    id: 'sb-004',
    category: 'stewardship-burden',
    question: {
      'en-CA':
        'Which stewardship responsibilities, if redistributed, would reduce institutional fragility without adding load anywhere?',
    },
    whyItMatters: {
      'en-CA':
        'Tests the reductive discipline of stabilisation at the conversation level.',
    },
    whatToListenFor: {
      'en-CA': [
        'Candidate moves that genuinely reduce rather than shift load',
        'Honest acknowledgement when no such move exists for a given responsibility',
        'Willingness to defer where a reductive move cannot yet be drafted',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Pressure to act on a redistribution before Phase 3 opens',
        'Proposals that quietly shift load to a less senior steward',
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Category 3 — Operational Reconstruction
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'or-001',
    category: 'operational-reconstruction',
    question: {
      'en-CA':
        'If the institution had to reconstruct one of its core operating processes from documentation alone, which process would be hardest to reconstruct, and why?',
    },
    whyItMatters: {
      'en-CA':
        'Names documentation gaps in terms of recoverability rather than completeness.',
    },
    whatToListenFor: {
      'en-CA': [
        'Processes whose written form omits decision points',
        'Processes carried by oral practice with no written counterpart',
        'Acknowledgement that some processes have evolved beyond their documentation',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Blame for stewards who maintained the process without documenting it',
        'Treatment of the gap as a personal performance question',
      ],
    },
  },
  {
    id: 'or-002',
    category: 'operational-reconstruction',
    question: {
      'en-CA':
        'When the institution has reconstructed a process after a steward\u2019s departure, what was learned in the reconstruction that was not visible before?',
    },
    whyItMatters: {
      'en-CA':
        'Draws on lived reconstruction experience to inform what continuity work could surface preemptively.',
    },
    whatToListenFor: {
      'en-CA': [
        'Discoveries of complexity that the institution had not appreciated',
        'Recognition that some reconstructions altered the process rather than restoring it',
        'Estimation of the time and cost the reconstruction required',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Criticism of departed stewards for the gaps revealed',
        'Use of the reconstruction as evidence in current personnel reviews',
      ],
    },
  },
  {
    id: 'or-003',
    category: 'operational-reconstruction',
    question: {
      'en-CA':
        'Which institutional processes have evolved over the years such that their original rationale is no longer accessible to the people who operate them today?',
    },
    whyItMatters: {
      'en-CA':
        'Surfaces processes whose stewardship has continued without the institutional understanding that originally shaped them.',
    },
    whatToListenFor: {
      'en-CA': [
        'Processes maintained out of habit rather than reasoning',
        'Recognition that some of those processes may no longer be necessary',
        'Acknowledgement that recovering the rationale is itself stewardship work',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Sweeping conclusions about processes that "no one understands"',
        'Plans to retire processes without confirming their current institutional function',
      ],
    },
  },
  {
    id: 'or-004',
    category: 'operational-reconstruction',
    question: {
      'en-CA':
        'Where does the institution depend on external counterparts \u2014 suppliers, partners, regulators \u2014 to remember institutional context the institution itself has not preserved?',
    },
    whyItMatters: {
      'en-CA':
        'Surfaces external continuity dependencies that internal mapping would otherwise miss.',
    },
    whatToListenFor: {
      'en-CA': [
        'External counterparts who function as institutional memory holders',
        'Acknowledgement that external memory is exposed to that counterpart\u2019s own continuity',
        'Reflection on whether external memory should be repatriated',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Detailed criticism of any external counterpart',
        'Plans to act unilaterally on relationships with sensitive counterparts',
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Category 4 — Institutional Memory
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'im-001',
    category: 'institutional-memory',
    question: {
      'en-CA':
        'Which institutional stories does the organisation tell about itself, and where do those stories live when their primary tellers have moved on?',
    },
    whyItMatters: {
      'en-CA':
        'Names institutional memory as a cultural fact carried by storytelling, not only by records.',
    },
    whatToListenFor: {
      'en-CA': [
        'Stories that orient new members to institutional values',
        'Stewards who function as primary tellers of institutional history',
        'Acknowledgement that lost stories shift institutional self-understanding',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Discussion of contested institutional events whose retelling is politically charged',
        'Pressure to canonise or suppress specific stories',
      ],
    },
  },
  {
    id: 'im-002',
    category: 'institutional-memory',
    question: {
      'en-CA':
        'When the institution has had to explain itself to a new external party \u2014 a regulator, a partner, a member cohort \u2014 what context did it discover it had not preserved?',
    },
    whyItMatters: {
      'en-CA':
        'Uses external explanation as a test of whether institutional context has been preserved in usable form.',
    },
    whatToListenFor: {
      'en-CA': [
        'Gaps surfaced through explanation that internal work had not surfaced',
        'Recognition that explanation is a continuity activity',
        'Materials produced for explanation that could become institutional records',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Specific friction with regulators or partners',
        'Sensitive matters under active negotiation with an external party',
      ],
    },
  },
  {
    id: 'im-003',
    category: 'institutional-memory',
    question: {
      'en-CA':
        'Where does the institution\u2019s memory live that the institution itself cannot reach without a specific person\u2019s involvement?',
    },
    whyItMatters: {
      'en-CA':
        'Names person-bound memory as a continuity question rather than as a personal property.',
    },
    whatToListenFor: {
      'en-CA': [
        'Knowledge that requires the steward present to be reached',
        'Acknowledgement that reaching memory through the steward is acceptable for now but exposed long-term',
        'Concrete examples of recent occasions where this exposure was felt',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Pressure on the steward to externalise their knowledge on a deadline',
        'Treating the steward\u2019s knowledge as institutional property rather than as their stewardship',
      ],
    },
  },
  {
    id: 'im-004',
    category: 'institutional-memory',
    question: {
      'en-CA':
        'Are there moments in the institution\u2019s history that the institution has chosen not to record, and how does the institution remember those choices?',
    },
    whyItMatters: {
      'en-CA':
        'Recognises deliberate institutional silence as a form of memory governance worth being aware of.',
    },
    whatToListenFor: {
      'en-CA': [
        'Acknowledgement that some silences are deliberate and honourable',
        'Recognition that successor stewards inherit silences they did not create',
        'Reflection on whether any silences should now be reconsidered',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Pressure to reopen silences the institution has chosen to hold',
        'Recording the silenced matter in the engagement\u2019s own records',
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Category 5 — Onboarding Fragility
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'of-001',
    category: 'onboarding-fragility',
    question: {
      'en-CA':
        'When a new senior steward joins the institution, what do they come to know within a year that the institution has not written down for them?',
    },
    whyItMatters: {
      'en-CA':
        'Names the institutional context senior stewards absorb through mentorship and presence rather than through documentation.',
    },
    whatToListenFor: {
      'en-CA': [
        'Recognition that a year is the typical horizon for orientation, not weeks',
        'Mentors who function as primary orienters and whose absence would slow new stewards',
        'Acknowledgement that the unwritten context is the most consequential',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Plans to reduce orientation time without addressing what is being absorbed during it',
        'Comparisons between new stewards on their orientation pace',
      ],
    },
  },
  {
    id: 'of-002',
    category: 'onboarding-fragility',
    question: {
      'en-CA':
        'Where does the institution\u2019s orientation depend on a specific mentor\u2019s patience and availability, and what happens when that mentor is unavailable?',
    },
    whyItMatters: {
      'en-CA':
        'Surfaces dependency on individual mentorship as a continuity question rather than a personal favour.',
    },
    whatToListenFor: {
      'en-CA': [
        'Roles whose orientation has historically been carried by one mentor',
        'Recognition that mentorship-as-orientation is an unrecognised stewardship load',
        'Acknowledgement that the orientation pattern is exposed to the mentor\u2019s own continuity',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Characterisation of the mentor as either over-relied-upon or under-recognised in personal terms',
        'Plans to formalise mentorship in ways that reduce the steward\u2019s discretion',
      ],
    },
  },
  {
    id: 'of-003',
    category: 'onboarding-fragility',
    question: {
      'en-CA':
        'When orientation goes well in the institution, what conditions are usually present, and which of those conditions cannot be guaranteed for the next steward?',
    },
    whyItMatters: {
      'en-CA':
        'Names the conditions for orientation as institutional rather than personal, and identifies fragility in those conditions.',
    },
    whatToListenFor: {
      'en-CA': [
        'Concrete conditions the institution can reproduce reliably',
        'Honest acknowledgement of conditions that depend on circumstance',
        'Recognition that orientation success has been partially accidental',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Plans to systematise orientation in ways that strip it of its institutional character',
        'Use of past orientation difficulty as evidence in current personnel decisions',
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Category 6 — Continuity Fairness
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'cf-001',
    category: 'continuity-fairness',
    question: {
      'en-CA':
        'Where does the institution rely on stewards whose continuity load is not reflected in the way the institution recognises their contribution?',
    },
    whyItMatters: {
      'en-CA':
        'Names the fairness dimension of continuity work as an institutional concern rather than as an HR concern.',
    },
    whatToListenFor: {
      'en-CA': [
        'Recognition that continuity load and visible contribution often diverge',
        'Acknowledgement that the divergence accumulates over years',
        'Willingness to reflect the divergence in how the institution speaks about stewards',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Detailed compensation matters under active review',
        'Promises of recognition outside the institution\u2019s normal channels',
      ],
    },
  },
  {
    id: 'cf-002',
    category: 'continuity-fairness',
    question: {
      'en-CA':
        'When the institution asks a steward to absorb additional continuity load, what does the institution offer in return, and is the exchange acknowledged?',
    },
    whyItMatters: {
      'en-CA':
        'Frames the addition of continuity load as a reciprocal institutional act rather than as a unilateral request.',
    },
    whatToListenFor: {
      'en-CA': [
        'Recognition that reciprocity is currently informal',
        'Examples of unacknowledged additions to load',
        'Willingness to formalise the reciprocity where appropriate',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Litigation of past requests that the steward absorbed without acknowledgement',
        'Personal grievances about the institution\u2019s recognition practices',
      ],
    },
  },
  {
    id: 'cf-003',
    category: 'continuity-fairness',
    question: {
      'en-CA':
        'Are there stewardship loads carried disproportionately by stewards in groups whose institutional voice is quieter?',
    },
    whyItMatters: {
      'en-CA':
        'Surfaces equity-of-load questions without inviting characterisation of specific individuals.',
    },
    whatToListenFor: {
      'en-CA': [
        'Recognition of patterns of load distribution that may not be the institution\u2019s intent',
        'Willingness to investigate the patterns with appropriate institutional process',
        'Acknowledgement that the engagement is not the venue for equity adjudication',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Specific equity complaints involving named individuals',
        'Use of the engagement to substitute for the institution\u2019s own equity process',
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Category 7 — Modernization Risk
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'mr-001',
    category: 'modernization-risk',
    question: {
      'en-CA':
        'When the institution has recently modernized a process, where did the modernization expose continuity assumptions that had previously been invisible?',
    },
    whyItMatters: {
      'en-CA':
        'Treats modernization as a continuity diagnostic, not as a continuity remedy.',
    },
    whatToListenFor: {
      'en-CA': [
        'Specific moments where modernization revealed assumptions',
        'Recognition that modernization changes which stewards carry which load',
        'Honest assessment of whether the new pattern is more or less fragile',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Vendor disputes about the modernization project',
        'Use of the conversation to relitigate the modernization decision',
      ],
    },
  },
  {
    id: 'mr-002',
    category: 'modernization-risk',
    question: {
      'en-CA':
        'Are there modernizations underway that depend on stewards whose continuity exposure has not been considered in the modernization plan?',
    },
    whyItMatters: {
      'en-CA':
        'Surfaces continuity load created by in-flight modernization, often invisible to modernization planning.',
    },
    whatToListenFor: {
      'en-CA': [
        'Modernizations whose success depends on a small number of stewards',
        'Recognition that modernization itself is a stewardship load',
        'Willingness to reflect continuity considerations in modernization governance',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Plans to pause modernization without proper institutional process',
        'Critique of stewards leading the modernization',
      ],
    },
  },
  {
    id: 'mr-003',
    category: 'modernization-risk',
    question: {
      'en-CA':
        'When the institution has chosen not to modernize a process, what continuity considerations contributed to that choice, and are they still valid?',
    },
    whyItMatters: {
      'en-CA':
        'Recognises deferred modernization as a legitimate institutional choice with continuity rationale worth re-examining periodically.',
    },
    whatToListenFor: {
      'en-CA': [
        'Continuity reasoning that informed past deferral',
        'Acknowledgement that the reasoning has a horizon',
        'Conditions under which the institution would revisit the deferral',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Pressure to reconsider deferral without proper institutional process',
        'External vendor narratives about why the deferral was wrong',
      ],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Category 8 — Governance Interpretation Drift
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'gid-001',
    category: 'governance-interpretation-drift',
    question: {
      'en-CA':
        'Where has the operating interpretation of a governance provision drifted from its written form, and who carries the institutional memory of when and why the drift occurred?',
    },
    whyItMatters: {
      'en-CA':
        'Identifies interpretation drift as a governance continuity question, not as a compliance question.',
    },
    whatToListenFor: {
      'en-CA': [
        'Provisions whose practice has diverged from text',
        'Stewards who carry the institutional rationale for the divergence',
        'Acknowledgement that the divergence is exposed to those stewards\u2019 continuity',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Specific compliance matters under regulator review',
        'Allegations of governance impropriety in past interpretation acts',
      ],
    },
  },
  {
    id: 'gid-002',
    category: 'governance-interpretation-drift',
    question: {
      'en-CA':
        'When the institution has interpreted ambiguous governance language, where is that interpretation recorded for the benefit of successor governance members?',
    },
    whyItMatters: {
      'en-CA':
        'Tests whether interpretation acts are preserved as institutional memory or carried orally.',
    },
    whatToListenFor: {
      'en-CA': [
        'Presence or absence of a living interpretation record',
        'Whether interpretation is shared with successor members at handover',
        'Whether the institution treats interpretation as a governance act',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Disputes about specific past interpretations',
        'Pressure to retroactively codify interpretations the body has not ratified',
      ],
    },
  },
  {
    id: 'gid-003',
    category: 'governance-interpretation-drift',
    question: {
      'en-CA':
        'Are there governance provisions whose interpretation is concentrated in a single steward, such that their departure would reset the institutional reading?',
    },
    whyItMatters: {
      'en-CA':
        'Surfaces interpretation concentration as a stewardship density question within the governance dimension.',
    },
    whatToListenFor: {
      'en-CA': [
        'Provisions read consistently because one steward is present',
        'Recognition that the institution\u2019s reading is exposed to that steward\u2019s continuity',
        'Willingness to broaden the interpretation conversation before a transition occurs',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Characterisation of the steward\u2019s interpretation as personally biased',
        'Plans to displace the steward\u2019s interpretive role without process',
      ],
    },
  },
  // ─────────────────────────────────────────────────────────────────────────
  // Module-specific extensions — engine v2.0.0 alignment
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'im-101',
    category: 'institutional-memory',
    question: {
      'en-CA':
        'Which precedents in the institution are living, which are observed, which are fading, and which have lapsed without succession of memory?',
    },
    whyItMatters: {
      'en-CA':
        'Names lineage as a continuity layer in its own right, distinct from documentation or process.',
    },
    whatToListenFor: {
      'en-CA': [
        'Recognition that lapsed precedents may not be recoverable from records alone',
        'Living precedents whose continuity rests on a single carrier',
        'Acceptance that some fading precedents are appropriate to release deliberately',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Disputes over which past precedent was correct',
        'Plans to revive a precedent the institution has consciously released',
      ],
    },
  },
  {
    id: 'im-102',
    category: 'institutional-memory',
    question: {
      'en-CA':
        'Where would the institution\u2019s reading of its own history change if a long-tenured steward were no longer present to anchor it?',
    },
    whyItMatters: {
      'en-CA':
        'Surfaces interpretation drift risk at the lineage layer without naming individuals as the source of truth.',
    },
    whatToListenFor: {
      'en-CA': [
        'Historical readings carried by one steward without secondary witness',
        'Willingness to broaden the reading deliberately rather than wait for departure',
        'Acceptance that some readings will shift after transition and that is institutional',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Personal characterisation of the steward as the only correct reader',
        'Plans to formalise the steward\u2019s reading into doctrine without discussion',
      ],
    },
  },
  {
    id: 'mr-101',
    category: 'modernization-risk',
    question: {
      'en-CA':
        'For each modernization initiative under way, are the carriers of the displaced practice consulted before the practice is replaced, or after?',
    },
    whyItMatters: {
      'en-CA':
        'Distinguishes continuity-safe modernization from continuity-eroding modernization at the consultation gate.',
    },
    whatToListenFor: {
      'en-CA': [
        'Initiatives where carrier consultation is a precondition, not an afterthought',
        'Initiatives where lineage capture is in scope before displacement',
        'Initiatives where successor identification is part of the rollout, not a residual task',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Characterisation of carriers as obstacles to modernization',
        'Internal disputes about specific vendors or platforms',
      ],
    },
  },
  {
    id: 'mr-102',
    category: 'modernization-risk',
    question: {
      'en-CA':
        'Which modernization initiatives, if completed as currently scoped, would erase a body of practice the institution has no other carrier for?',
    },
    whyItMatters: {
      'en-CA':
        'Names the compound modernization–lineage erosion pattern as a continuity question rather than an IT question.',
    },
    whatToListenFor: {
      'en-CA': [
        'Recognition that some initiatives carry continuity cost even when they succeed technically',
        'Willingness to add lineage capture to scope before displacement begins',
        'Acceptance that scope renegotiation is sometimes the continuity-safe path',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Blame directed at initiative sponsors',
        'Disputes about budget ownership for lineage capture',
      ],
    },
  },
  {
    id: 'of-101',
    category: 'onboarding-fragility',
    question: {
      'en-CA':
        'For the roles the institution considers critical, how long does competency take to form, and what is the institution\u2019s position if a transition compresses that window?',
    },
    whyItMatters: {
      'en-CA':
        'Names onboarding fragility as a continuity question, distinct from training.',
    },
    whatToListenFor: {
      'en-CA': [
        'Roles where competency exceeds typical handover windows',
        'Recognition that shadowing is sometimes structurally infeasible',
        'Willingness to broaden practice before transition rather than after',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Personal performance assessments of current carriers',
        'Plans to accelerate transition without continuity preparation',
      ],
    },
  },
  {
    id: 'of-102',
    category: 'onboarding-fragility',
    question: {
      'en-CA':
        'Where the written onboarding for a role is thin or absent, what does the institution accept will be reconstructed by the next carrier rather than transferred?',
    },
    whyItMatters: {
      'en-CA':
        'Surfaces the reconstruction burden honestly, without staging it as a documentation gap that can be \u201cfixed\u201d.',
    },
    whatToListenFor: {
      'en-CA': [
        'Acceptance that some practice is institutional rather than transferable',
        'Recognition of the burden the next carrier will inherit',
        'Willingness to extend the handover window where the burden is highest',
      ],
    },
    avoidIfShared: {
      'en-CA': [
        'Characterisation of current carriers as having failed to document',
        'Plans to retrofit onboarding by interview without carrier consent',
      ],
    },
  },
];

/** Lookup: prompts grouped by category. */
export const CONTINUITY_CONVERSATION_PROMPTS_BY_CATEGORY: Readonly<
  Record<ConversationCategory, readonly ConversationPrompt[]>
> = Object.freeze(
  CONTINUITY_CONVERSATION_PROMPTS.reduce(
    (acc, prompt) => {
      const bucket = acc[prompt.category] ?? [];
      acc[prompt.category] = [...bucket, prompt];
      return acc;
    },
    {} as Record<ConversationCategory, readonly ConversationPrompt[]>,
  ),
);
