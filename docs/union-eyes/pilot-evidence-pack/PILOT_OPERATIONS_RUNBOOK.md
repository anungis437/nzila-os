# Pilot Operations Runbook — Union Eyes CUPE Controlled Pilot

**Status:** CURRENT  
**Last updated:** 2026-05-14  
**Source of truth:** This document + `PILOT_SCOPE_LOCK.md`  
**Supersedes:** N/A (new)  
**Live-evidence dependencies:** None for this document itself

---

## 1. Pilot Kickoff Checklist

All items must be confirmed before real member data is admitted.

### Pre-Launch Gates (L-001 to L-006)

| # | Condition | Owner | Status |
|---|-----------|-------|--------|
| L-001 | DPA signed by pilot org | Legal / Product | ☐ PENDING |
| L-002 | Live Azure environment confirmed (Sections A–G of runbook) | SRE | ☐ PENDING |
| L-003 | Pilot steward accounts created with correct roles | Engineering | ☐ PENDING |
| L-004 | Pilot org/worksite/member data loaded via onboarding flow | Engineering | ☐ PENDING |
| L-005 | Emergency escalation contacts confirmed | Product | ☐ PENDING |
| L-006 | End-of-pilot evidence export tested (dry run) | Engineering | ☐ PENDING |

---

## 2. User Onboarding Checklist

### Org Administrator (Diane / ED persona)

- [ ] Create pilot org record in admin console
- [ ] Set org name, timezone, locale (English/French)
- [ ] Create 5 worksites (see scope: `PILOT_SCOPE_LOCK.md` §2)
- [ ] Assign org admin role to Diane's account
- [ ] Confirm org appears in admin org list with correct status

### Steward Setup (Alex persona)

- [ ] Create steward accounts for each participating steward
- [ ] Assign steward role scoped to correct worksite(s)
- [ ] Confirm steward can log in and view their worksite queue
- [ ] Confirm steward cannot view other orgs' cases (cross-org test)

### IT / Privacy Director (James persona)

- [ ] Create IT/privacy director account
- [ ] Assign privacy review role
- [ ] Confirm James can access audit logs for pilot org only
- [ ] Confirm James cannot access audit logs for other orgs

### Member Onboarding

- [ ] Import or create up to 200 pilot members
- [ ] Confirm each member is scoped to correct worksite
- [ ] Confirm member PII is not visible to stewards in other worksites (if applicable)

---

## 3. Roles and Permissions Setup

| Role | Capabilities | Creation method |
|------|-------------|----------------|
| `org_admin` | Full org config, user management, reports | Admin console → Org Settings |
| `steward` | Case intake, case management, evidence upload, worksite queue | Admin console → User Management |
| `privacy_director` | Audit log access, evidence export, privacy requests | Admin console → User Management |
| `member` | Case submission, case status view | Self-registration or import |
| `platform_admin` | Cross-org support access (Nzila team only) | Internal tooling only |

All role assignments are logged in the audit trail.

---

## 4. Support Process

### Tier 1 — Self-Service

Direct pilot users to:
- In-app help and tooltips
- Pilot user guide (provided at kickoff)
- FAQ document (delivered separately)

### Tier 2 — Pilot Contact

| Channel | Response SLA | Coverage |
|---------|-------------|----------|
| Pilot Slack channel | 4 hours | Business hours (ET) |
| Email: pilot-support@nzila.ca | 24 hours | Mon–Fri |

### Tier 3 — Engineering Escalation

| Trigger | Escalation path |
|---------|----------------|
| Data not saving / loss suspected | Engineering Lead → immediate |
| Authentication failure (org-wide) | SRE → immediate |
| Evidence export failure | Engineering + SRE → same-day |
| Suspected cross-org data leak | Security Lead → immediate, incident declared |

---

## 5. Incident Escalation

### Severity Classification

| Severity | Definition | Response time | Example |
|----------|-----------|---------------|---------|
| SEV-1 | Data loss, cross-org leak, auth failure | Immediate (< 30 min) | Member data visible to wrong org |
| SEV-2 | Feature unavailable, evidence export broken | 4 hours | Case creation failing |
| SEV-3 | Degraded UX, slow load, minor UI bug | Next business day | Dashboard takes 10s to load |

### Incident Response Steps

1. Detect (monitoring alert or user report)
2. Triage (classify severity)
3. Notify pilot org contact and internal incident channel
4. Contain (isolate affected component if SEV-1)
5. Investigate and fix
6. Post-incident report (SEV-1 and SEV-2 require written summary within 48h)
7. Update pilot org

---

## 6. Data Correction Process

If incorrect data is entered during pilot:

1. Steward reports incorrect data via support channel
2. Engineering confirms record ID and org scope
3. Data correction applied with audit log entry (who corrected, when, what)
4. Pilot user confirms correction
5. Correction is documented in pilot weekly log

**No bulk deletes without Privacy Director sign-off.**

---

## 7. Evidence Export Process

The evidence export feature is a primary pilot deliverable.

### Per-Case Export

1. Steward opens case in Union Eyes
2. Selects "Export Evidence Package"
3. System generates sealed PDF + manifest
4. Steward downloads and verifies manifest checksum

### Bulk Export (end-of-pilot)

1. Platform admin runs `pnpm export:pilot-evidence --org <ORG_ID>` (or equivalent)
2. Output: encrypted ZIP with all case records, audit trails, evidence files
3. ZIP is transferred to pilot org via secure channel (not email)
4. Pilot org confirms receipt and checksum

---

## 8. Weekly Review Cadence

| Meeting | Participants | Agenda |
|---------|-------------|--------|
| Weekly pilot sync | Pilot org ED + stewards, Nzila Product | Cases processed, issues, feedback |
| Weekly internal review | Nzila Product + Engineering | Metrics review, incidents, scope adherence |
| Monthly exec check-in | Pilot org leadership, Nzila founders | Progress vs. success criteria, expansion discussion |

---

## 9. End-of-Pilot Criteria

The 90-day pilot concludes with a formal assessment against `PILOT_SUCCESS_METRICS.md`.

### Minimum bars for successful pilot conclusion:

- [ ] ≥ 20 cases processed end-to-end (intake → resolution or deferral)
- [ ] ≥ 1 evidence package exported and verified
- [ ] Zero SEV-1 incidents without full resolution
- [ ] Pilot org ED and ≥ 2 stewards confirm: "usable in real situations"
- [ ] No open data correction requests unresolved at close
- [ ] All audit logs retained and accessible

---

## 10. Go / No-Go for Expansion

Expansion beyond the controlled pilot is CONDITIONAL and requires:

| Gate | Requirement |
|------|-------------|
| E-001 | Live Azure evidence complete (all Sections A–G of runbook) |
| E-002 | Minimum pilot success bars met (see §9 above) |
| E-003 | Security lead sign-off on live evidence manifest |
| E-004 | Legal sign-off on any expansion org DPAs |
| E-005 | Product review of any new modules not in current scope lock |
| E-006 | SRE capacity confirmation (monitoring, on-call, backup coverage) |

**Do not expand scope without going through this gate.**

---

*Operations questions: contact Nzila pilot team at pilot-support@nzila.ca*
