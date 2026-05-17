# Healthcare Discovery Surveys

Healthcare Discovery Surveys is the first governed discovery seed for Nzila Healthcare inside Nzila OS.

It is intentionally narrow:
- one local
- one champion
- one unit
- one anonymous discovery survey
- one first workflow wedge recommendation

It is not a grievance intake system, not an employer scheduling integration, and not a broad healthcare product rollout.

## Why this lives in Nzila OS (not Base44)

Base44 was used for visual appetite validation only.

Discovery, governance, audit trails, privacy guardrails, and pilot readiness decisions are implemented inside Nzila OS so they can be reviewed and extended under the platform's existing controls.

## Data governance boundaries

The survey is designed for de-identified workflow discovery only.

It does not collect:
- patient names or identifiers
- employee names
- nurse names
- manager names
- formal grievance details
- medical details

All respondent copy includes a no-identifying-details warning.

Anonymous response collection is the default.

## Survey template

Default template: Unit Scheduling Experience Survey.

Purpose:
Understand scheduling clarity, communication friction, schedule-change issues, open-shift transparency, shift-exchange confusion, and documentation gaps before selecting a pilot wedge.

## Pilot wedge scoring model

Deterministic recommendation logic is package-level and tested.

Primary wedge outputs:
- Schedule Change Log
- Open Shift Offer Trace
- Scheduling Event Timeline
- Shift Exchange Checklist
- Discovery Only (when governance/adoption risk is too high)

Confidence model:
- low: fewer than 5 responses
- medium: 5-9 responses or ambiguous winner
- high: at least 10 responses and clear top margin

If privacy/identification/employer-access concerns are high, recommendation includes a governance warning before any pilot.

## First Target Campaign: UNA Local 115 - Unit 92 Short Stay Cardiology

Why one unit only:
- reduces rollout risk
- avoids over-interpreting thin evidence
- keeps privacy and governance controls practical in the first cycle

Why survey first:
- validates where friction is strongest before any workflow is piloted
- identifies whether the safest wedge is change tracking, offer traceability, timeline reconstruction, or exchange clarity

Why Base44 is not the pilot platform:
- pilots need governed storage, auditability, and scoped access controls already present in Nzila OS

Why no patient/member-identifying data:
- this is workflow discovery, not care delivery documentation and not grievance filing

How results determine first wedge:
- aggregate workflow scores + first-choice signal + adoption concerns
- low response thresholds lower confidence and caution against over-interpretation

Likely first wedges:
- Schedule Change Log
- Open Shift Offer Trace
- Scheduling Event Timeline
- Shift Exchange Checklist

## Current limitations

This first slice does not include:
- AI analysis
- employer-system integration
- grievance/case management
- PDF export pipeline
- broad UNA or multi-site rollout tooling

It is a discovery wedge intended to produce one practical next pilot decision.
