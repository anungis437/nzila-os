# Union Eyes Workspace Tab Schema

> Pattern: Club360-style workspace consolidation (see
> [UNION_EYES_WORKSPACE_DOCTRINE.md](./UNION_EYES_WORKSPACE_DOCTRINE.md))

This schema is the single source of truth for the seven canonical workspace
tabs. It is mirrored in code by `components/workspace/workspace-config.ts`. If
you change one, change the other.

## Universal tab contract

Following the Club360 pattern, **every** tab must render three sections:

```
Current State     — What is true right now?
Required Actions  — What needs attention?
Deep Work         — Where does the user go to execute the detailed workflow?
```

Deep Work links point at **existing legacy routes**. The workspace never
duplicates a legacy execution page.

Where no canonical data source is cleanly available, Current State and Required
Actions render **honest empty states** (never fabricated numbers).

## Tab order (v1)

```
1. Overview
2. Case Operations
3. Members
4. Governance
5. Continuity        (OCI / OCRA lives here — NOT top-level)
6. Financial
7. Documents
```

Intelligence is intentionally **not** a top-level tab in v1.

---

## 1. Overview

**Question:** How healthy is the union today?

**Invariant:** Overview summarizes every tab but **owns no deep workflow
directly**. Each Deep Work link below points at a route already owned by another
tab. (Enforced by the workspace config test.)

**Current State (signals):**
- open cases
- active grievances
- outstanding actions
- upcoming governance events
- continuity alerts
- recent document activity

**Required Actions:** cross-surface attention items (honest empty state until a
canonical aggregate exists).

**Deep Work (all owned by other tabs):**
- Cases → `/dashboard/cases` (owned by Case Operations)
- Members → `/dashboard/members` (owned by Members)
- Continuity → `/organizational-continuity-risk` (owned by Continuity)
- Governance → `/dashboard/governance` (owned by Governance)
- Documents → `/dashboard/documents` (owned by Documents)

---

## 2. Case Operations

**Question:** What representation work requires attention?

**Owns:** claims, grievances, investigations, appeals, case workflows.

**Deep Work:**
- Cases → `/dashboard/cases`
- Claims → `/dashboard/claims`
- Grievances → `/dashboard/grievances`
- Intake Queue → `/dashboard/inbox?type=intake`
- Priorities → `/dashboard/priorities`

---

## 3. Members

**Question:** What is the state of member service and representation?

**Owns:** roster, member records, representation status, member service requests.

**Deep Work:**
- Members roster → `/dashboard/members`
- Member service → `/dashboard/member`
- Stewards → `/dashboard/stewards`
- Member requests (Inbox) → `/dashboard/inbox`

---

## 4. Governance

**Question:** Can leadership explain and defend institutional decisions?

**Owns:** board/executive records, policies, meetings, resolutions, compliance,
decision records.

**Deep Work:**
- Governance → `/dashboard/governance`
- Governance Center → `/dashboard/governance-center`
- Compliance → `/dashboard/compliance`
- Audits & Evidence → `/dashboard/audits`
- Committees → `/dashboard/committees`
- Elections → `/dashboard/elections`

---

## 5. Continuity

**Question:** Where is organizational continuity at risk?

**Owns:** officer transitions, institutional memory, continuity risks, knowledge
capture, OCI/OCRA assessments, risk profiles, recommendations, reassessments.

> **Strategic differentiator:** Continuity is more than assessments. It **must
> own** officer transition (`/dashboard/leadership`), knowledge transfer
> (`/dashboard/knowledge-transfer`), and institutional memory
> (`/dashboard/institutional-memory`) — in addition to OCI/OCRA. This is what
> keeps Continuity from collapsing into "just the assessment tab."

> **Guardrail:** OCI/OCRA must NOT become a separate top-level workspace. It is
> part of Continuity. The workspace only links into the existing OCI/OCRA
> surfaces; it never changes scoring or routing behavior.

**Deep Work:**
- OCRA — Organizational Continuity Risk → `/organizational-continuity-risk`
- OCI — Institutional Continuity Risk → `/institutional-continuity-risk`
- Continuity Assessment → `/continuity-assessment/start`
- Continuity Intelligence → `/dashboard/continuity-intelligence`
- Continuity Planning → `/dashboard/continuity-planning`
- Institutional Memory → `/dashboard/institutional-memory`
- Knowledge Transfer → `/dashboard/knowledge-transfer`
- Leadership Continuity (officer transitions) → `/dashboard/leadership`
- Governance Recommendations → `/dashboard/governance-recommendations`

---

## 6. Financial

**Question:** What financial obligations and signals require attention?

**Owns:** dues, revenue, budgets, forecasts, payment status.

**Deep Work:**
- Dues → `/dashboard/dues`
- Finance → `/dashboard/finance`
- Financial → `/dashboard/financial`
- Strike Fund → `/dashboard/strike-fund`
- Pension → `/dashboard/pension`

---

## 7. Documents

**Question:** Can critical organizational information be located and trusted?

**Owns:** repository, collective agreements, governance records, templates,
retention, evidence files.

**Deep Work:**
- Documents → `/dashboard/documents`
- Agreements → `/dashboard/agreements`
- Clause Library → `/dashboard/clause-library`
- Knowledge Base → `/dashboard/knowledge-base`
- Precedents → `/dashboard/precedents`

---

## Link locale handling

Hrefs in this schema are stored **without** the locale prefix (matching the
existing sidebar convention). At render time the workspace prefixes each href
with the active locale (`/${locale}${href}`). Both `/dashboard/*` routes and
top-level locale routes (such as `/organizational-continuity-risk`) are handled
the same way.
