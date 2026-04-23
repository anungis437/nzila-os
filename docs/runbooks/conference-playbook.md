# Conference & Event Playbook — Union Eyes

## Objective

Convert conference attendance into enrolled pipeline. Every event should end with:
- All booth conversations logged as EventLeads
- Tier A/B leads enrolled in the Post-Conference sequence before end of Day 0
- At least one demo booked per 5 leads captured

---

## Target Events (Priority Order)

| Event | Type | When | Attendees | Why |
|---|---|---|---|---|
| CUPE National Convention | cupe_convention | Oct (biennial) | ~3,000 | Largest pool of CUPE locals |
| CLC National Convention | clc_convention | May (biennial) | ~3,000 | National federation, broad affiliate access |
| CUPE Ontario Regional | union_conference | Varies | ~500–800 | Ontario locals, high municipal concentration |
| HRPA Annual Conference | hr_conference | Jan | ~3,000 | HR directors who advise union negotiations |
| PSAC National | union_conference | Varies | ~1,500 | Federal sector — CAPE-ACEP adjacency |
| Sector-specific labour summits | sector_summit | Varies | ~200–500 | Healthcare (ONA/OPSEU adjacency) |

---

## Pre-Event Preparation (7–14 Days Before)

1. **Build target list** from union map seed data filtered by event location + sector
   ```typescript
   unionMap.listUnionNodes().filter(n => n.province === 'QC' && n.sector === 'municipal')
   ```

2. **Create ConferenceEvent record**
   ```typescript
   events.createConferenceEvent({ name, eventType, location, province, startDate, endDate, attendanceCount })
   ```

3. **Prepare personalised talking points** per sector:
   - Municipal: "grievance deadline compliance, arbitration prep"
   - Healthcare: "discipline tracking, privacy-compliant case files"
   - Federal: "Treasury Board negotiation cycle, PSLRA compliance"

4. **Pre-book demo slots** — block 45-min slots in calendar for Days 5–10 post-event

5. **Load demo environment** with sector-appropriate sample data

---

## At-Event Lead Capture (Day 0)

### For every booth conversation (≥ 5 min):

```typescript
events.captureEventLead({
  scope: { tenantId: 'nzila-os', orgId: 'platform', product: 'union-eyes' },
  eventId: evt.id,
  contactName: 'Full Name',
  contactEmail: 'email@union.ca',      // ask explicitly — don't assume badge scan
  contactTitle: 'President / Recording Secretary / Grievance Officer',
  rawOrgName: 'CUPE Local XXX',
  memberCountEstimate: 800,            // ask: "roughly how many members?"
  captureMethod: 'booth_conversation',
  conversationNotes: 'One-sentence summary of their pain',
  painPointsDiscussed: ['manual_tracking', 'deadline_management'],
})
```

### Conversation prompts:

- "How do you currently track open grievances?"
- "How many active files do you have right now?"
- "When a grievance deadline approaches, how do you know?"
- "Have you ever missed an arbitration step because something slipped?"

If they answer "spreadsheets" or "we have a system but it's old" → `techMaturityProxy: 'spreadsheet_only'` or `'legacy_system'`

---

## Day 0 Follow-Up (Same Evening)

Within 4 hours of meeting:

1. Score all captured leads:
   ```typescript
   icp.createTargetOrg({ ...resolved org from lead data })
   ```

2. Enroll Tier A/B leads in Post-Conference sequence immediately
3. Send Day 0 email (step 1 of post_event sequence — `post-event-email-day0`)
4. Connect on LinkedIn the same night

**Target:** Day 0 email sent to ≥ 80% of captured leads before midnight.

---

## Day 2

- Send LinkedIn message (step 2 of sequence — `linkedin-connection-note`)
- Reference the specific conversation topic in the connection note

---

## Day 4–5

- Send value email (step 3 — `post-event-email-day2` with pain point reference)
- Attach sector-specific case study

---

## Day 6

- Send ROI bundle (step 4 — `post-event-email-day5` with calculator + case study)
- Include a direct link to book a 30-min demo

---

## Day 7–10 (If Demo Booked)

Demo completed → immediately trigger `demo_followup` sequence (Day 0→10 ENTERPRISE_CLOSE_SEQUENCE).

---

## Post-Event Debrief (Day 14)

1. Update `ConferenceEvent.debrief` with:
   - Total leads captured
   - Demos booked
   - Tier A count
   - Key learnings (what messaging landed, what didn't)

2. For leads with no response after full 4-step sequence → check `computePlaybookState` phase = `post_event` → move to `re_engagement` sequence or disqualify

3. For any converted or pilot-active leads traced back to this event → update `EventLead.status = 'converted'`

---

## Event Performance Targets

| Metric | Target |
|---|---|
| Leads captured per event-day | ≥ 5 |
| Day 0 follow-up rate | ≥ 80% of leads |
| Demo book rate from post-event sequence | ≥ 20% (benchmark: 22%) |
| Demo → pilot conversion rate | ≥ 40% |

---

## Integration with Deal Engine

When a lead books a demo (status = `demo_booked`), create the deal in deal-engine:

```typescript
// Create deal in deal-engine (adapter-backed in prod)
const deal = { id: makeId('deal'), product: 'union-eyes', stage: 'demo_scheduled', ... }

// Link back to event lead
events.updateLeadStatus(lead.id, 'demo_booked', { dealEngineId: deal.id })
```

Once the deal converts → use `unionMap.getExpansionTargets(nodeId)` to surface adjacent locals for the next conference wave.
