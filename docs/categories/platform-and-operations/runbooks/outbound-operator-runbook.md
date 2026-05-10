# Outbound Operator Runbook — Union Eyes Pipeline

## Who This Is For

This runbook is for the sales/ops person managing the Union Eyes outbound pipeline day-to-day. It covers: adding targets, scoring prospects, enrolling sequences, advancing deal stages, and reading the pipeline dashboard.

---

## Daily Workflow

### Morning: Check the pipeline dashboard

Open the console at `[console URL]/ue-pipeline`.

Review in order:

1. **Dormant deals** — any deal in `dormant` should either be enrolled in the Re-Engagement sequence or marked `lost`
2. **Active sequences** — are any contacts at step 3+ without a reply? They may need a manual personal touch
3. **Demos completed without proposals sent** — deal should move to `pilot_proposed` within 5 days of demo

---

## Adding a New Target

### From a conference lead (post-event)

```typescript
import { events, icp } from '@nzila/platform-growth-os'

// 1. Create event (if not already created)
const evt = events.createConferenceEvent({
  scope: { tenantId: 'nzila-os', orgId: 'platform', product: 'union-eyes' },
  name: 'CUPE National Convention 2025',
  eventType: 'cupe_convention',
  location: 'Québec City',
  province: 'QC',
  startDate: '2025-10-14',
  endDate: '2025-10-17',
  attendanceCount: 3000,
})

// 2. Capture lead during the event
const lead = events.captureEventLead({
  scope: { tenantId: 'nzila-os', orgId: 'platform', product: 'union-eyes' },
  eventId: evt.id,
  contactName: 'Marie Tremblay',
  contactEmail: 'marie.tremblay@cupelocal.ca',
  rawOrgName: 'CUPE Local 299',
  memberCountEstimate: 1200,
  captureMethod: 'booth_conversation',
  conversationNotes: 'Handles all grievances manually. 45 active files. No system.',
  painPointsDiscussed: ['manual_tracking', 'deadline_management', 'arbitration_prep'],
})

// 3. Create a TargetOrg from the lead
const org = icp.createTargetOrg({
  scope: { tenantId: 'nzila-os', orgId: 'platform', product: 'union-eyes' },
  name: 'CUPE Local 299',
  sourcingMethod: 'conference',
  attributes: {
    sector: 'municipal',
    memberCount: 1200,
    governanceComplexity: 0.65,
    techMaturityProxy: 'spreadsheet_only',
  },
  notes: 'Met at CUPE National Convention booth. High urgency.',
})

// 4. Link the event lead to the resolved org
events.updateLeadStatus(lead.id, 'qualified', { resolvedTargetOrgId: org.id })
```

### From LinkedIn / cold research

Skip the event step — go directly to step 3 above with `sourcingMethod: 'linkedin_research'` or `'public_database'`.

---

## Enrolling a Sequence

```typescript
import { sequences } from '@nzila/platform-growth-os'

// Bootstrap sequences on first run (idempotent — safe to call every time)
sequences.bootstrapSequences()

// Find the right sequence
const all = sequences.listSequences()
const postEvent = all.find((s) => s.kind === 'post_event')

// Enroll
const instance = sequences.enrollInSequence({
  sequenceId: postEvent.id,
  targetOrgId: org.id,
  dealEngineId: null, // set once deal is created in deal-engine
  contactName: 'Marie Tremblay',
  contactEmail: 'marie.tremblay@cupelocal.ca',
})

// Update lead record
events.updateLeadStatus(lead.id, 'enrolled_sequence', {
  sequenceInstanceId: instance.id,
})
```

The `nextStepAt` field on the instance tells you when to send the next touch.

---

## Sequence Selection Guide

| Situation | Sequence |
|---|---|
| Cold prospecting, no prior relationship | cold |
| Partner or CLC affiliate referral | warm_intro |
| Just captured at a conference or convention | post_event |
| Demo completed — close now | demo_followup |
| Deal in procurement/vendor review | procurement |
| Deal has been silent ≥ 45 days | re_engagement |

---

## Advancing a Deal Stage

The deal-engine FSM governs all stage transitions. Do not move deals backward.

Valid transitions (extract):

```
lead → qualified → demo_scheduled → demo_completed → pilot_proposed
     → pilot_active → data_received → ingestion_running → pilot_review
     → converted
     → dormant → (re_engagement sequence) → back to qualified
     → lost
```

When a demo is completed, immediately trigger the `demo_followup` sequence (Day 0→10).

When a pilot is proposed, immediately trigger the `procurement` sequence.

---

## ICP Score Interpretation

| Tier | Score | Action |
|---|---|---|
| A (≥ 0.70) | High fit | Prioritise. Assign to senior rep. Cold outbound or warm intro within 24h. |
| B (≥ 0.40) | Good fit | Sequence eligible. Enrich attributes before outreach. |
| C (< 0.40) | Weak signal | Do not cold outreach. Enrich first or wait for inbound/conference signal. |

To re-score a target after enrichment:

```typescript
icp.enrichTargetOrg(orgId, { sector: 'healthcare', memberCount: 850 })
```

---

## Re-Engagement Trigger

For any deal in `dormant` stage, run:

1. Confirm deal is still contactable (email not bounced)
2. Find a genuine re-engagement hook: new case study, new feature, sector news
3. Enroll in `re_engagement` sequence
4. If no reply within 7 days → mark `lost`

---

## Pipeline Dashboard Sections

| Section | What to Look For |
|---|---|
| Top-of-funnel | Is the sequence enrollment number growing week-over-week? |
| Mid-funnel | Are demo-completed deals stalling without proposals? Target ≤ 5 days to proposal. |
| Bottom-of-funnel | Pilot active → converted cycle time target: ≤ 90 days |
| Land-and-expand | After any conversion: immediately prospect the surfaced adjacent locals |
| Dormant | Anything here ≥ 60 days should be `lost` or re-engaged |
