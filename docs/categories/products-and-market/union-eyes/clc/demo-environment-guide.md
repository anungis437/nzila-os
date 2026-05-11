# Union Eyes — CLC Demo Environment Guide
## Canonical Live Demo Setup · May 2026

---

## Overview

The CLC demo environment is a seeded, institutionally believable replica of a real-world Union Eyes deployment. It is designed for live executive demonstrations at the CLC convention and structured pilot conversations.

It is **not** a test environment. Every name, case, and organizational detail is realistic.

---

## Canonical Organization

**CUPE Local 4279 — Ontario Healthcare**

| Field          | Value                                                      |
|----------------|------------------------------------------------------------|
| Full name      | CUPE Local 4279                                            |
| Display name   | CUPE Local 4279 — Ontario Healthcare                       |
| Sector         | Healthcare                                                 |
| Jurisdiction   | Ontario                                                    |
| Affiliation    | Canadian Union of Public Employees / CLC                   |
| Membership     | 1,240 active members                                       |
| Sites          | Hamilton General, St. Joseph's Healthcare, Juravinski      |
| Founded        | 1978                                                       |
| City           | Hamilton, ON                                               |
| Pilot status   | Active                                                     |

This organization is instantly credible to a CLC convention audience: mid-sized, healthcare, Ontario, CLC-affiliated. It is not fictitious enough to break immersion or realistic enough to create confusion with actual locals.

---

## Canonical Personas

### Margaret Beaumont — Executive Director

| Field          | Value                                    |
|----------------|------------------------------------------|
| Role           | president → Executive experience         |
| Seniority      | 22 years                                 |
| Email          | margaret.beaumont@demo.union-eyes.ca     |
| Demo focus     | Continuity visibility, leadership resilience, governance posture |

**Demo narrative:** Margaret is considering Union Eyes as the institutional continuity backbone for the local's succession planning cycle starting in 2027. She wants to know if it's safe and governable.

---

### David Okafor — Governance Officer

| Field          | Value                                    |
|----------------|------------------------------------------|
| Role           | compliance_manager → Governance experience |
| Seniority      | 14 years                                 |
| Email          | david.okafor@demo.union-eyes.ca          |
| Demo focus     | Explainability, audit trails, governance review cadence |

**Demo narrative:** David oversees all governance review processes. He wants to understand how Union Eyes preserves oversight and explainability — and whether it makes his quarterly governance reviews easier or harder.

---

### Sofia Lemaire — Steward Lead

| Field          | Value                                    |
|----------------|------------------------------------------|
| Role           | chief_steward → Staff experience         |
| Seniority      | 11 years                                 |
| Email          | sofia.lemaire@demo.union-eyes.ca         |
| Demo focus     | Case coordination, assignment flow, operational clarity |

**Demo narrative:** Sofia coordinates the steward network across three hospital sites. She needs fewer coordination emails, clearer assignment visibility, and a reliable way to track case status without chasing people.

---

### Raymond Chen — Union Staff Coordinator

| Field          | Value                                    |
|----------------|------------------------------------------|
| Role           | support_agent → Staff experience         |
| Seniority      | 7 years                                  |
| Email          | raymond.chen@demo.union-eyes.ca          |
| Demo focus     | Workbench, case tracking, documentation  |

**Demo narrative:** Raymond is the operational backbone of member services. He processes case intake, manages correspondence, and tracks deadlines. The platform needs to reduce his coordination overhead.

---

### Teresa Nakamura — Member Participant

| Field          | Value                                    |
|----------------|------------------------------------------|
| Role           | member → Member experience               |
| Seniority      | 5 years                                  |
| Email          | teresa.nakamura@demo.union-eyes.ca       |
| Demo focus     | Case status visibility, submission simplicity, messages |

**Demo narrative:** Teresa filed a scheduling grievance in March 2026. She wants to know what's happening with her case without calling the union office. The experience should feel respectful and clear.

---

### James Whitfield — Platform Administrator

| Field          | Value                                    |
|----------------|------------------------------------------|
| Role           | admin → Admin experience                 |
| Seniority      | 3 years                                  |
| Email          | james.whitfield@demo.union-eyes.ca       |
| Demo focus     | Organization config, pilot settings, audit exports |

**Demo narrative:** James configured Union Eyes for Local 4279. For CLC, he's prepared an evidence export package and has the pilot configuration locked and reviewable.

---

## Seeded Case Distribution

| Case #       | Type                  | Status               | Priority | Assigned To     |
|--------------|-----------------------|----------------------|----------|-----------------|
| GRV-2026-041 | Scheduling grievance  | Under review         | High     | Sofia Lemaire   |
| GRV-2026-038 | Workplace harassment  | Investigation        | Critical | Sofia Lemaire   |
| GRV-2026-044 | Pay grievance         | Submitted            | Medium   | Raymond Chen    |
| GRV-2026-031 | Disability accommodation | Pending docs      | High     | Sofia Lemaire   |
| GRV-2026-019 | Contract dispute      | Resolved             | Medium   | Sofia Lemaire   |
| GRV-2026-047 | Workplace safety      | Submitted            | High     | Raymond Chen    |
| GRV-2026-033 | Disciplinary grievance | Under review        | High     | Sofia Lemaire   |
| GRV-2026-051 | Verbal harassment     | Under review         | Medium   | Raymond Chen    |

**Teresa's cases (member-facing):** GRV-2026-041, GRV-2026-044, GRV-2026-051  
**Full operational view (steward):** All 8 cases

---

## How to Seed

```bash
# From the union-eyes app directory:
npx tsx scripts/seed-clc-demo-environment.ts
```

The script is idempotent — safe to run multiple times. It will skip existing records.

---

## Login Credentials

> Demo credentials are managed separately and stored in `.env.local` or the staging KeyVault.
> Do not hardcode passwords in this document.

For CLC demonstration:
- Use `PLAYWRIGHT_TEST_AUTH=true` for cookie-based auth bypass during screenshares.
- Use the seeded `nzila_session` cookie pattern from E2E helpers for quick role switching.
- Alternatively: use staging auth with seeded email accounts (managed by platform admin).

---

## What NOT to show

| Area                         | Reason                                              |
|------------------------------|-----------------------------------------------------|
| /dashboard/cognition         | Experimental — not in pilot scope                   |
| /dashboard/workflow-builder  | Not exposed in pilot mode                           |
| /dashboard/fsm               | Internal tooling — never show                       |
| /dashboard/analytics-admin   | Backend configuration — not relevant to audience    |
| /dashboard/ai-assistant      | Excluded from pilot scope                           |
| /dashboard/integrations (advanced) | Not stable for demo                          |
| Any empty state              | Seed data first; never demo an empty screen         |
| Raw DB / admin panel         | Not part of any demo flow                           |

---

## Environment Health Check

Before any live demonstration, confirm:

- [ ] Seed script ran successfully (all 8 cases present)
- [ ] All 6 personas can log in (or cookie auth is configured)
- [ ] `/en-CA/dashboard` redirects correctly for each role
- [ ] Marketing routes render without 404s (`/en-CA/proof`, `/en-CA/trust`, `/en-CA/for-clc`)
- [ ] Pilot mode is enabled for the demo org (`/api/feature-flags?flag=pilot-mode`)
- [ ] No console errors on executive overview landing
- [ ] Governance route shows content (not empty tabs)
- [ ] Member Teresa's cases are visible on her inbox

---

## Demo Reset

If the demo environment gets modified during a walkthrough:

```bash
# Re-run the seed (idempotent — only adds missing records)
npx tsx scripts/seed-clc-demo-environment.ts
```

For a full reset (wipe and reseed), consult the ops team. Do not run destructive scripts in a shared staging environment without coordination.
