# UnionEyes — Module & Page Inventory

*Last updated: 2026-05-17 | Pass: User-Facing Product Validation*

---

## Overview

This document is the authoritative page-level reference for the UnionEyes labour union management platform. It covers every dashboard module, documents each page's purpose, role-gating rules, required data, primary/secondary actions, empty-state and error-state behaviour, and whether the page is pilot-critical for the CAPE-CLC demo.

**How to use this document:**
- **Product testers** — use the page-by-page entries to build test cases and check that role gating, empty states, and data rendering work correctly.
- **Demo operators** — look for pages rated `HIGH` under *Pilot/Demo Relevance* and cross-reference with the [DEMO_RUNBOOK.md](./DEMO_RUNBOOK.md).
- **Security reviewers** — use the Role Access Matrix and the *Intended Roles* field on every page to verify no privilege escalation paths exist.

**Routing model:** All user-facing pages live under `app/[locale]/` with the locale prefix injected at runtime (e.g., `/en/dashboard/inbox`). The auth group uses `(auth)` route-group parentheses; the primary dashboard uses `(dashboard)` for layout inheritance. Route segments that look like `[id]` or `[[...slug]]` are dynamic.

**Role resolution:** On every authenticated request the server calls `getUserRole(userId, organizationId)` then `getRoleLandingPath(role)`. Five experience levels drive sidebar content and allowed-route sets: `member`, `staff`, `executive`, `governance`, `admin`.

---

## Primary User Groups

| Group | Role(s) | Description |
|---|---|---|
| **Union Admin** | `admin`, `system_admin`, `platform_lead` | Manages the organization tenant: user provisioning, org settings, pilot configuration, billing, integrations. Lands at `/dashboard/admin/organizations`. |
| **Union Staff / Rep** | `steward`, `chief_steward`, `bargaining_committee`, `health_safety_rep`, `clerk`, `officer` | Front-line representatives who manage casework, grievances, member intake, and scheduling. Lands at `/dashboard/work`. |
| **Member** | `member` | Rank-and-file union members who submit intake requests and track their representation cases. Lands at `/dashboard/inbox`. |
| **Executive / Leadership** | `president`, `vice_president`, `secretary_treasurer`, `national_officer`, `app_owner`, `coo`, `cto` | Officers and leadership who need strategic intelligence, continuity insights, and outcome reporting. Lands at `/dashboard/intelligence`. |
| **Governance / Oversight** | `officer`, `compliance_manager`, `security_manager`, `clc_executive`, `fed_executive` | Responsible for bylaws, policy alignment, audit trails, and trust reporting. Lands at `/dashboard/governance`. |
| **Platform Admin** | `app_owner`, `system_admin`, `cto`, `platform_lead` | Nzila Ventures staff with cross-tenant access to platform operations, billing, and AI usage analytics. Has access to platform settings vs. org settings in `Settings`. |

---

## Module Index

| # | Module | Primary Route Prefix | Role Access Summary | Pilot-Critical |
|---|--------|---------------------|---------------------|----------------|
| 1 | **Auth** | `/[locale]/(auth)/` | Public | Yes |
| 2 | **Dashboard Root** | `/[locale]/dashboard` | All authenticated | Yes |
| 3 | **Inbox / Intake** | `/dashboard/inbox` | All authenticated; intake conversion staff+ | Yes |
| 4 | **Work / Casework Console** | `/dashboard/work`, `/dashboard/workbench`, `/dashboard/priorities` | steward+ | Yes |
| 5 | **Grievances** | `/dashboard/grievances` | steward+ | Yes |
| 6 | **Cases** | `/dashboard/cases` | steward+; creation via claims/new for members | Yes |
| 7 | **Claims / Intake Forms** | `/dashboard/claims` | member (new); steward+ (list) | Yes |
| 8 | **Evidence & Documents** | `/dashboard/documents`, `/dashboard/audits` | steward+ for docs; officer+ for audits | Yes |
| 9 | **Members** | `/dashboard/members` | steward+ | Yes |
| 10 | **Governance** | `/dashboard/governance`, `/dashboard/governance-center`, `/dashboard/elections`, `/dashboard/voting` | officer+; governance experience | Yes |
| 11 | **Finance & Dues** | `/dashboard/finance`, `/dashboard/dues`, `/dashboard/admin/dues` | member (dues pay); admin/executive (full finance) | Medium |
| 12 | **Analytics & Intelligence** | `/dashboard/analytics`, `/dashboard/intelligence`, `/dashboard/outcomes` | steward+; scoped by role | Medium |
| 13 | **CBA & Bargaining** | `/dashboard/bargaining`, `/dashboard/cba-intelligence`, `/dashboard/clause-library` | bargaining_committee+ | Medium |
| 14 | **Admin & Settings** | `/dashboard/admin`, `/dashboard/settings`, `/dashboard/security` | admin experience; settings available to all | Yes |
| 15 | **Communications** | `/dashboard/communications`, `/dashboard/correspondence`, `/dashboard/notifications` | steward+ | Medium |
| 16 | **Knowledge, Training & Continuity** | `/dashboard/education`, `/dashboard/institutional-memory`, `/dashboard/knowledge-transfer` | All authenticated (read); steward+ (write) | Low |
| 17 | **Onboarding & Pilot** | `/(marketing)/pilot-request`, `/dashboard/pilot`, `/dashboard/admin/onboarding` | Public (request); officer+ (pilot dashboard) | Yes |

---

## 1. AUTH Module

### Login Page

- **Route:** `/[locale]/(auth)/login/[[...login]]/`
- **Module:** Auth
- **Purpose:** Primary sign-in entry point for all users. Renders a `LoginForm` component inside an `AuthPageLayout` that displays platform statistics (locals served, members, uptime). Supports NextAuth-based credentials or SSO via Microsoft Entra.
- **Intended Roles:** Public (unauthenticated). Authenticated users who land here should be redirected to their role landing path.
- **Required Data:** `AUTH_SECRET` env var must be set. Platform stats are i18n strings (no live DB call on this page).
- **Primary Action:** Sign in with email/password or SSO provider.
- **Secondary Actions:** Navigate to sign-up; navigate to forgot-password; navigate to magic-link; switch locale.
- **Empty State:** N/A — static layout.
- **Error State:** Invalid credentials → inline form error from `LoginForm`. Missing `AUTH_SECRET` → 500 on boot (never reaches this page).
- **Audit/Governance Relevance:** Successful and failed login events should be recorded via platform auth telemetry.
- **Pilot/Demo Relevance:** HIGH — every demo begins here.
- **Notes:** The catch-all `[[...login]]` segment delegates slug routing to the Better Auth / Entra adapter. Do not navigate to `/login` with extra segments unless the auth adapter supports them.

---

### Sign-In Page

- **Route:** `/[locale]/(auth)/sign-in/[[...sign-in]]/`
- **Module:** Auth
- **Purpose:** Alternative sign-in entry matching the `/sign-in` redirect path used throughout the codebase (many server components call `redirect('/sign-in')`). Functionally equivalent to the Login page.
- **Intended Roles:** Public.
- **Required Data:** Same as Login.
- **Primary Action:** Sign in.
- **Secondary Actions:** Link to `/sign-up`; magic-link alternative.
- **Empty State:** N/A.
- **Error State:** Same as Login.
- **Audit/Governance Relevance:** Same as Login.
- **Pilot/Demo Relevance:** HIGH.
- **Notes:** Both `/login` and `/sign-in` must work. A tester should verify both routes render without 404.

---

### Sign-Up Page

- **Route:** `/[locale]/(auth)/sign-up/[[...sign-up]]/`
- **Module:** Auth
- **Purpose:** New user self-registration. In pilot deployments, access is gated: users must be pre-provisioned or invited. The sign-up flow may be disabled for closed pilot tenants.
- **Intended Roles:** Public (but may be invite-only in pilot).
- **Required Data:** Email, name; org invite token (for gated sign-up).
- **Primary Action:** Create a new account.
- **Secondary Actions:** Return to sign-in; accept org invitation.
- **Empty State:** N/A.
- **Error State:** Duplicate email → form error. Invite token invalid → block and show message.
- **Audit/Governance Relevance:** Account creation events are audit-logged.
- **Pilot/Demo Relevance:** MEDIUM — relevant for onboarding demo; not the primary demo entry.
- **Notes:** There are two sign-up routes: `sign-up` and `signup` (without hyphen). Both should resolve. Verify both render.

---

### MFA / Settings MFA Page

- **Route:** `/[locale]/settings/mfa/`
- **Module:** Auth
- **Purpose:** Multi-factor authentication configuration for the authenticated user. Allows enabling TOTP or SMS second factor.
- **Intended Roles:** All authenticated users.
- **Required Data:** Current auth session; MFA enrollment API.
- **Primary Action:** Enroll a TOTP authenticator app.
- **Secondary Actions:** Remove existing MFA method; view backup codes; disable MFA (if org policy permits).
- **Empty State:** "No MFA method configured — your account uses password-only authentication."
- **Error State:** MFA enrollment API failure → toast error; do not expose stack trace.
- **Audit/Governance Relevance:** MFA enrollment and removal are security-critical audit events.
- **Pilot/Demo Relevance:** LOW.
- **Notes:** Lives outside the `(auth)` route group, under `/settings/mfa`. Ensure the layout does not require the dashboard sidebar since it may be accessed pre-role-resolution.

---

## 2. DASHBOARD Module

### Dashboard Root (Role Redirect)

- **Route:** `/[locale]/dashboard/`
- **Module:** Dashboard
- **Purpose:** Pure server-side redirect. Resolves the authenticated user's organization and role, then issues a `redirect()` to the appropriate landing page. No UI is ever rendered at this route.
- **Intended Roles:** All authenticated; unauthenticated users are redirected to `/login`.
- **Required Data:** `auth()` session; `getOrganizationIdForUser(userId)`; `getUserRole(userId, orgId)`.
- **Primary Action:** Automatic redirect to role landing path.
- **Secondary Actions:** None.
- **Empty State:** N/A (no render).
- **Error State:** If `getOrganizationIdForUser` throws (org not found), the error propagates as a 500. If `getUserRole` throws, same. Both are logged at `error` level. Testers should verify a user with no org membership gets a meaningful error, not a blank page.
- **Audit/Governance Relevance:** Landing path resolution is logged at `info` level with userId, orgId, role, and destination path. Useful for audit trails.
- **Pilot/Demo Relevance:** HIGH — every session traverses this route.
- **Notes:** Landing paths by experience: `member` → `/dashboard/inbox`; `staff` → `/dashboard/work`; `executive` → `/dashboard/intelligence`; `governance` → `/dashboard/governance`; `admin` → `/dashboard/admin/organizations`.

---

## 3. INBOX Module

### Unified Inbox

- **Route:** `/[locale]/dashboard/inbox`
- **Module:** Inbox / Intake
- **Purpose:** The primary landing surface for members and secondary surface for staff. Merges intake submissions, messages, alerts, and system notifications into a single prioritized feed. Answers "What needs my attention right now?" Query param `?type=intake` filters to representation requests; `?type=message` filters to direct messages.
- **Intended Roles:** All authenticated users. Members see their own items only. Staff see intake submissions assigned to their unit.
- **Required Data:** Intake submissions table; notification records; message threads; org scoping enforced server-side.
- **Primary Action:** Review the latest intake or message requiring action.
- **Secondary Actions:** Filter by type (intake/message/alert); mark as read; convert intake to formal case (staff only); request more information from member; archive item.
- **Empty State:** "Your inbox is empty — no new activity." Include a prompt to explore help resources for members, or to check the Priorities page for staff.
- **Error State:** API failure → "Unable to load inbox — please refresh. If the problem persists, contact support." Do not show raw error messages.
- **Audit/Governance Relevance:** Intake-to-case conversion events are audit-logged. Message reads are not audited by default.
- **Pilot/Demo Relevance:** HIGH — the member's entire post-login experience begins here.
- **Notes:** `InboxConsole` is a client component. If the member has no prior submissions, the empty state with an action CTA is essential for the demo ("Open Representation Case" button should be visible).

---

## 4. WORK / CASEWORK Console Module

### Casework Console (Work Surface)

- **Route:** `/[locale]/dashboard/work`
- **Module:** Work / Casework Console
- **Purpose:** Primary work surface for stewards and reps. Provides a tabbed view of active cases (WorkbenchConsole), grievances (GrievancesConsole), and bargaining (NegotiationDashboard). Represents all active casework streams in one place. This is the steward's operational home.
- **Intended Roles:** `steward`+. Members are redirected to `/dashboard/inbox`.
- **Required Data:** Cases table; grievances table; bargaining negotiations table; all filtered by `organizationId`.
- **Primary Action:** Review open cases and advance work.
- **Secondary Actions:** Switch between Cases / Grievances / Bargaining tabs; filter by status, priority, or assignee; open individual case or grievance detail; create new case.
- **Empty State:** "No active cases — great work! Use the Members tab to support members proactively." Each tab shows its own empty state independently.
- **Error State:** If the cases API fails, show per-tab skeleton with retry button. Do not block all three tabs on a single tab's failure.
- **Audit/Governance Relevance:** Case status transitions made from this surface emit `workflow_transition_success_rate` pilot metrics. HIGH governance relevance.
- **Pilot/Demo Relevance:** HIGH — this is the central pilot demonstration surface for stewards.
- **Notes:** `WorkSurface` is the root client component. The `WorkbenchConsole` and `GrievancesConsole` sub-components each make independent API calls. Ensure that both have independent loading and error states.

---

### Priorities

- **Route:** `/[locale]/dashboard/priorities`
- **Module:** Work / Casework Console
- **Purpose:** Surfaces the most urgent items requiring action: overdue cases, cases approaching SLA deadline, urgency signals, and — for officers — a team-level overview. Query param `?view=team` shows team priorities.
- **Intended Roles:** `steward`+. Members redirected to inbox.
- **Required Data:** Cases with `deadline` and `status`; SLA watchdog data; `avg_time_to_first_response` metric.
- **Primary Action:** Identify and open the highest-priority overdue case.
- **Secondary Actions:** Switch between personal and team view; filter by severity; sort by deadline; reassign.
- **Empty State:** "No overdue or urgent items — all cases are on track."
- **Error State:** SLA data unavailable → degrade gracefully, show case list without SLA annotations.
- **Audit/Governance Relevance:** Viewing a team priorities list with officer role is an audit event. SLA breaches logged by the cron watchdog, not this page.
- **Pilot/Demo Relevance:** HIGH — demonstrates SLA compliance and rep responsiveness.
- **Notes:** `PrioritiesConsole` client component. The `?view=team` param is only meaningful for `officer`+; stewards should not see other reps' caseloads.

---

## 5. GRIEVANCES Module

### Grievance Detail

- **Route:** `/[locale]/dashboard/grievances/[id]`
- **Module:** Grievances
- **Purpose:** Full detail view for a specific formal grievance. Shows grievance metadata, status, timeline of events, assigned representative, employer response, and attached evidence. Rendered by `GrievanceDetailConsole`.
- **Intended Roles:** `steward`+. The page does a hard `redirect('/dashboard')` for roles below steward.
- **Required Data:** Grievance record by `id`; org scoping; timeline events; evidence files; member profile.
- **Primary Action:** Review grievance status and decide next workflow step.
- **Secondary Actions:** Advance workflow state (triage → investigation → response_pending → resolved); upload evidence; add internal note; download grievance package; assign to different rep.
- **Empty State:** N/A (detail page — 404 if grievance not found).
- **Error State:** Grievance not found or org mismatch → 404. API error → toast with retry option.
- **Audit/Governance Relevance:** All workflow transitions are audit-logged with `actorId`, `traceId`, and timestamp. HIGH governance relevance — grievance FSM transitions drive `workflow_transition_success_rate` pilot metric.
- **Pilot/Demo Relevance:** HIGH — the Demo Runbook Scene 3 walks through FSM blocking and correct state transitions on this page.
- **Notes:** The FSM intentionally prevents jumping from `triage` directly to `resolved`. Testers must verify this constraint. See [DEMO_RUNBOOK.md](./DEMO_RUNBOOK.md) Scene 3.

---

## 6. CASES Module

### Case Detail

- **Route:** `/[locale]/dashboard/cases/[id]`
- **Module:** Cases
- **Purpose:** Comprehensive view of a single representation case. Tabs: Overview (metadata, AI assessment scores, financial figures), Timeline (ordered audit events), Evidence (attached files), Notes (internal), Claims (financial claims attached to case). Includes AI merit confidence score, precedent match score, and complexity score.
- **Intended Roles:** `steward`+. Role check via `useHasPermission(Permission.MANAGE_CASES)`.
- **Required Data:** Case record by `id`; `TimelineEvent[]`; `Evidence[]`; AI scoring fields (`aiScore`, `meritConfidence`, `precedentMatch`, `complexityScore`); financial fields (`claimAmount`, `settlementAmount`).
- **Primary Action:** Review case status and advance workflow.
- **Secondary Actions:** Upload evidence (shows upload modal); download evidence package; add note; edit case metadata (Edit button, permission-gated); assign to rep; mark resolved; view AI assessment.
- **Empty State:** Per-tab: "No timeline events yet." / "No evidence attached." / "No notes."
- **Error State:** Case load failure → full-page error card. Individual tab fetch failure → tab-level error with retry. Never expose raw API errors.
- **Audit/Governance Relevance:** Evidence exports from this page emit `evidence_pack_exports` pilot metric. Case assignment emits `assignment_efficiency`. HIGH governance relevance.
- **Pilot/Demo Relevance:** HIGH — core pilot validation surface. Evidence export is a tracked metric.
- **Notes:** This is a `'use client'` page. The `useHasPermission` hook gates the Edit button client-side; the API must enforce the same server-side. Testers should verify that a `member` role cannot navigate to this URL by guessing a case ID (403 or redirect expected).

---

## 7. CLAIMS Module

### New Claim / Intake Form

- **Route:** `/[locale]/dashboard/claims/new`
- **Module:** Claims / Intake Forms
- **Purpose:** The primary self-service intake form for members to open a new representation request. Supports typed category selection (Wage & Hour, Safety, Discrimination, Harassment, Benefits, Grievance, Working Conditions, Other), date and location fields, description text, priority selection, voice capture (Mic button), and file attachment. Tracks submission via `usePilotTracking → trackCaseCreated` and increments the pilot case count widget.
- **Intended Roles:** All authenticated users (member, staff, admin). Unauthenticated users are redirected.
- **Required Data:** `useUser()` for member identity; `POST /api/cases` endpoint; category-to-case-type mapping is client-side.
- **Primary Action:** Submit a new representation intake.
- **Secondary Actions:** Attach supporting files (drag-and-drop or browse); record voice description (browser mic API); set priority; preview form before submission; cancel and return.
- **Empty State:** Initial form render — all fields blank. Guide text explains each section.
- **Error State:** Submission failure → toast error ("Failed to submit — please try again"). Network timeout → form preserved, user not lost. File too large → file-level error.
- **Audit/Governance Relevance:** Submission calls `POST /api/cases` which emits `cases_created` pilot metric. HIGH governance relevance.
- **Pilot/Demo Relevance:** HIGH — this is the member-facing intake entry point and the first tracked pilot metric.
- **Notes:** `incrementPilotCaseCount` is called client-side after successful submission. Voice capture requires browser microphone permission — testers should verify graceful degradation when mic is denied. The `locale` parameter is used for redirect after submission (`/${locale}/dashboard/inbox`).

---

### Claims List

- **Route:** `/[locale]/dashboard/claims/[id]` (claim detail)
- **Module:** Claims / Intake Forms
- **Purpose:** FILE NOT FOUND for a dedicated list page — intake items surface in the Inbox under `?type=intake`. The `[id]` detail page shows a specific claim. Testers navigating to `/dashboard/claims` without an ID should expect either a list view or a redirect to inbox.
- **Intended Roles:** Members (own claims); steward+ (all claims for org).
- **Required Data:** Claims/intake records for the authenticated user (member) or for the org (staff+).
- **Primary Action:** View claim status and any representative response.
- **Secondary Actions:** Add supplemental information; view attached documents; escalate.
- **Empty State:** "You have no open claims — open a new representation case to get started."
- **Error State:** API failure → skeleton with retry.
- **Audit/Governance Relevance:** Medium — claim status changes are audit-logged.
- **Pilot/Demo Relevance:** MEDIUM.
- **Notes:** The `claims/new` route also uses `categoryToCaseType` mapping that maps UI categories to internal case type strings. Ensure new `caseType` values are mirrored in the API validation.

---

## 8. EVIDENCE & DOCUMENTS Module

### Documents

- **Route:** `/[locale]/dashboard/documents`
- **Module:** Evidence & Documents
- **Purpose:** FILE NOT FOUND at `dashboard/documents/page.tsx` in the route tree returned — this route is referenced by multiple nav items and `ALLOWED_PREFIXES_BY_EXPERIENCE`. It should display a scoped document library for the authenticated user: members see documents related to their own cases; staff see org-wide document repository.
- **Intended Roles:** All authenticated (scoped by role).
- **Required Data:** Document records from DB, filtered by org and/or user ID; file storage presigned URLs.
- **Primary Action:** Browse and download documents.
- **Secondary Actions:** Upload a new document; filter by type (evidence, correspondence, contract); export; share link.
- **Empty State:** "No documents yet — documents attached to your cases will appear here."
- **Error State:** Storage provider unavailable → "Documents temporarily unavailable — file storage is offline. Please try again shortly."
- **Audit/Governance Relevance:** Document downloads and uploads are audit-logged. HIGH for evidence packs.
- **Pilot/Demo Relevance:** HIGH — Demo Runbook Scene 4 references the evidence bundle.
- **Notes:** FILE NOT FOUND — route may be placeholder or the component is rendered within another layout. Verify the route resolves before demo.

---

### Audits

- **Route:** `/[locale]/dashboard/audits`
- **Module:** Evidence & Documents
- **Purpose:** Audit trail viewer for governance users. Shows all recorded audit events for the organization: case transitions, user provisioning, evidence exports, policy changes, sign-in events. Filterable by event type, actor, date range.
- **Intended Roles:** `officer`+; governance experience. Referenced in admin experience allowed prefixes.
- **Required Data:** `audit_events` table (or equivalent); org-scoped query.
- **Primary Action:** Search and review audit events for compliance.
- **Secondary Actions:** Export audit log as CSV; filter by actor or event type; drill into individual event detail.
- **Empty State:** "No audit events recorded yet." (Unlikely in a live org — more likely a permission or org scope issue.)
- **Error State:** DB query failure → "Audit log unavailable — contact your platform administrator."
- **Audit/Governance Relevance:** CRITICAL — this page IS the audit surface. The page itself may generate an audit event ("audit log viewed by X").
- **Pilot/Demo Relevance:** HIGH — procurement reviewers will ask to see this.
- **Notes:** The page file exists at `dashboard/audits/page.tsx`. Content not read — verify it renders correctly with seeded data before demo.

---

## 9. MEMBERS Module

### Member Directory

- **Route:** `/[locale]/dashboard/members`
- **Module:** Members
- **Purpose:** Full member directory for the authenticated organization. Shows member profiles with search and filter. Allows stewards to look up member contact details, membership status, and case history.
- **Intended Roles:** `steward`+. Redirects to `/dashboard` for members.
- **Required Data:** Member records from `organizationMembers`; member profile from `profiles` table; paginated/filtered API call.
- **Primary Action:** Search for a specific member by name or employee ID.
- **Secondary Actions:** Filter by department, status (active/inactive/on-leave); view member profile; start a new case for a member; export member list (admin only).
- **Empty State:** "No members found — if this is a new organization, use Admin to import or invite members."
- **Error State:** "Member directory unavailable — please try again." Skeleton loading state.
- **Audit/Governance Relevance:** Member profile access is logged at info level. Exporting member data is a high-sensitivity audit event.
- **Pilot/Demo Relevance:** HIGH — reps need to look up members to file cases on their behalf.
- **Notes:** `MembersConsole` is a client component. The `steward` role threshold is the minimum — verify that a `member` cannot navigate directly to this URL.

---

### Member Detail / Profile

- **Route:** `/[locale]/dashboard/members/[id]`
- **Module:** Members
- **Purpose:** Individual member profile showing employment details, membership history, active cases, dues status, and any notes attached by reps.
- **Intended Roles:** `steward`+.
- **Required Data:** Member profile by `id`; org scoping enforced; linked cases; dues payment history.
- **Primary Action:** Review member's current representation status.
- **Secondary Actions:** Create a new case for this member; add internal note; update contact info (admin/steward only); view case timeline.
- **Empty State:** Member has no active cases → "No active representation cases for this member."
- **Error State:** Member not found or cross-org access → 404.
- **Audit/Governance Relevance:** Medium — profile views are logged.
- **Pilot/Demo Relevance:** MEDIUM.
- **Notes:** New member form at `/dashboard/members/new` — verify redirect after successful creation.

---

## 10. GOVERNANCE Module

### Governance Center

- **Route:** `/[locale]/dashboard/governance`
- **Module:** Governance
- **Purpose:** Central governance management surface. Three tabs: **Bylaws** (BylawsViewer — read/edit the union's bylaws document), **Policies** (PolicyManager — CRUD for internal policies), **Signatories** (SignatoryManager — manage authorized signatories for documents and decisions). Officers view in read mode; presidents and above can edit.
- **Intended Roles:** `officer`+. Redirects to `/dashboard` for roles below officer. `canManage` flag (editable UI) requires `president`+.
- **Required Data:** Bylaws records; policy documents; signatory registry — all filtered by `organizationId`.
- **Primary Action:** Review the current bylaws or policies for compliance.
- **Secondary Actions:** Edit bylaws (president+); add/revoke policy (president+); manage signatories (president+); export governance bundle.
- **Empty State:** Per-tab: "No bylaws uploaded yet — upload a PDF or create a digital bylaw document." / "No policies defined." / "No signatories configured."
- **Error State:** DB failure → "Governance documents temporarily unavailable."
- **Audit/Governance Relevance:** CRITICAL — all edits to bylaws, policies, and signatories are audit-logged. Policy changes emit governance envelope events.
- **Pilot/Demo Relevance:** HIGH — governance visibility is a key procurement requirement. Demo Runbook Scene 2 references `ORG_SCOPE_AUDIT.md` alongside this surface.
- **Notes:** `canManage` is a prop passed from the server; the client components `BylawsViewer`, `PolicyManager`, and `SignatoryManager` respect it. Testers should verify that an `officer` role sees the governance page in read-only mode without edit controls visible.

---

### Elections

- **Route:** `/[locale]/dashboard/elections`
- **Module:** Governance
- **Purpose:** Manage union elections: create nominations, run voting periods, track participation rates. Shows stats: active elections, total eligible voters, votes cast, upcoming elections. Table lists each election with status badge, date range, and progress bar.
- **Intended Roles:** `'use client'` page — no server-side role gate visible in the file. Role check should be enforced via the API. Recommend: officer+ for managing elections; all authenticated members to vote.
- **Required Data:** `api.elections.list()` → Election records; voter eligibility list; vote tally.
- **Primary Action:** Create or open a new election.
- **Secondary Actions:** View election detail; export results; close voting period; view nomination list; download voter certificate.
- **Empty State:** "No elections found — create your first election to start managing nominations and voting."
- **Error State:** API failure → skeleton with retry.
- **Audit/Governance Relevance:** Election creation and result certification are critical audit events.
- **Pilot/Demo Relevance:** MEDIUM.
- **Notes:** This is a `'use client'` page without a server-side role gate. An RBAC guard should be added at the server component level or the API must enforce it. File this as a known gap.

---

### Voting

- **Route:** `/[locale]/dashboard/voting`
- **Module:** Governance
- **Purpose:** FILE NOT FOUND confirmed by route listing (page.tsx exists). Voting surface for eligible members to cast votes in active elections. Likely single-ballot, single-vote-per-election enforcement.
- **Intended Roles:** All authenticated members eligible to vote in an active election.
- **Required Data:** Active elections; eligibility check for current user; existing vote record (to prevent double voting).
- **Primary Action:** Cast a vote in an active election.
- **Secondary Actions:** View voting guide; confirm eligibility; review candidates.
- **Empty State:** "No active elections to vote in at this time."
- **Error State:** Already voted → "You have already submitted your vote for this election." Eligibility failure → explain reason.
- **Audit/Governance Relevance:** Vote casting is a high-governance audit event. Votes must be anonymized but auditable.
- **Pilot/Demo Relevance:** LOW.
- **Notes:** Double-vote prevention must be verified in testing. Ensure the voting page is accessible to `member` role.

---

## 11. FINANCE & DUES Module

### Dues Payment Portal

- **Route:** `/[locale]/dashboard/dues`
- **Module:** Finance & Dues
- **Purpose:** Self-service dues payment and history portal for members. Shows current dues balance, payment schedule, and history. Integrates with payment processor (via `DuesPaymentPortal` component). Also provides a receipt view at `/dashboard/dues/receipts/[transactionId]`.
- **Intended Roles:** All authenticated users. Members see their own dues only; admin sees org-wide.
- **Required Data:** Dues records for `userId`; payment history; current billing cycle.
- **Primary Action:** Pay outstanding dues.
- **Secondary Actions:** View payment history; download receipt; set up auto-pay; view dues schedule.
- **Empty State:** "Your dues account is current — no payments due."
- **Error State:** Payment processor unavailable → "Payment processing is temporarily offline. Your dues have not been charged. Please try again later."
- **Audit/Governance Relevance:** All dues payments are financial audit events.
- **Pilot/Demo Relevance:** MEDIUM.
- **Notes:** Pay transaction detail page at `/dashboard/dues/pay/[transactionId]`. Ensure `Suspense` fallback (`DuesSkeleton`) displays correctly during load.

---

### Finance Dashboard

- **Route:** `/[locale]/dashboard/finance`
- **Module:** Finance & Dues
- **Purpose:** Platform-level financial overview for executives and admins. Shows billing account status, ledger summary (total CAD, entries by cost type), recent invoices, recent chargebacks, and dues alignment anomalies (arrears count, anomaly descriptions).
- **Intended Roles:** `admin`, `executive`. This is a `'use client'` page — server-level role gate not confirmed in file; recommend `admin`+ enforcement.
- **Required Data:** Billing account; ledger entries; invoice records; chargeback records; member dues alignment.
- **Primary Action:** Review financial health at a glance.
- **Secondary Actions:** Drill into invoices list; view chargeback detail; export ledger; investigate dues anomalies; view allocation breakdown.
- **Empty State:** "No financial data available — billing account may not be configured."
- **Error State:** API failure → per-card error with retry. Never show raw DB error.
- **Audit/Governance Relevance:** HIGH — financial data access is audited. Export actions are high-sensitivity events.
- **Pilot/Demo Relevance:** MEDIUM — relevant for procurement demo but not the primary pilot evidence path.
- **Notes:** Sub-routes include `/dashboard/finance/invoices`, `/dashboard/finance/billing`, `/dashboard/finance/allocation`, `/dashboard/finance/exports`. Verify all sub-routes are accessible to the correct roles.

---

## 12. ANALYTICS & INTELLIGENCE Module

### Analytics Overview

- **Route:** `/[locale]/dashboard/analytics`
- **Module:** Analytics & Intelligence
- **Purpose:** Operational analytics dashboard for stewards and above. Shows caseload metrics, resolution rates, SLA compliance trends, member engagement, and rep performance. Top performers section visible to `chief_steward`+.
- **Intended Roles:** `steward`+. `canViewTopPerformers` prop true for `chief_steward`+. Blocked in pilot mode (listed in `PILOT_EXCLUDED_PREFIXES`).
- **Required Data:** Aggregated case metrics; SLA data; member activity data — all org-scoped.
- **Primary Action:** Understand caseload trends and team performance.
- **Secondary Actions:** Export analytics report; filter by date range; drill into specific metric; view top performers (chief_steward+).
- **Empty State:** "Not enough data yet — analytics will populate as cases are created and resolved."
- **Error State:** Analytics API failure → "Analytics temporarily unavailable."
- **Audit/Governance Relevance:** MEDIUM — analytics access is logged but not a governance event.
- **Pilot/Demo Relevance:** LOW — this route is **excluded in pilot mode** (`PILOT_EXCLUDED_PREFIXES`). Do not navigate here during a pilot demo.
- **Notes:** Testers must verify that this page is inaccessible in pilot mode and accessible in non-pilot mode for steward+.

---

### Intelligence Shell

- **Route:** `/[locale]/dashboard/intelligence`
- **Module:** Analytics & Intelligence
- **Purpose:** The executive landing page. Multi-scoped intelligence shell with query param `?scope=local` (default), `?scope=federation`, or `?scope=executive`. Executive scope shows strategic planning data; federation scope shows movement-level insights. Delegates to `IntelligenceShell` component.
- **Intended Roles:** `steward`+. Executive role sees the full scope selector; staff sees local only.
- **Required Data:** Varies by scope — local case analytics, federation aggregates, executive KPIs.
- **Primary Action:** Survey organizational intelligence at the appropriate scope.
- **Secondary Actions:** Switch scope; drill into specific insight; export report; view continuity intelligence link.
- **Empty State:** "No intelligence data available for this scope — ensure sufficient case activity exists."
- **Error State:** Scope-specific API failure → scope-level error without blocking other scopes.
- **Audit/Governance Relevance:** MEDIUM.
- **Pilot/Demo Relevance:** HIGH — executive experience lands here. Procurement viewers will see this surface.
- **Notes:** The `AIBanner` component import exists in the file but is inside an unreachable code branch (`return` appears twice). This is a known dead-code issue — the second `return` block is never executed.

---

### Outcomes

- **Route:** `/[locale]/dashboard/outcomes`
- **Module:** Analytics & Intelligence
- **Purpose:** Member Outcomes Ledger for executive view. Shows resolution outcomes, settlement data, case closure rates, and longitudinal member impact. Surfaces whether representation is delivering results.
- **Intended Roles:** `executive` experience (president, VP, secretary-treasurer, national officer, app_owner).
- **Required Data:** Resolved case records with outcome fields; settlement amounts; resolution type distribution.
- **Primary Action:** Review whether outcomes are meeting organizational expectations.
- **Secondary Actions:** Export outcomes report; drill by time period; compare against prior period.
- **Empty State:** "No resolved cases yet — outcomes will appear as cases are closed."
- **Error State:** API failure → skeleton with retry.
- **Audit/Governance Relevance:** MEDIUM.
- **Pilot/Demo Relevance:** MEDIUM.
- **Notes:** Page file exists; content not read. Verify it renders for executive role.

---

## 13. CBA & BARGAINING Module

### Bargaining Dashboard

- **Route:** `/[locale]/dashboard/bargaining`
- **Module:** CBA & Bargaining
- **Purpose:** Collective Bargaining Agreement negotiation management. Shows active negotiation sessions, proposal tracking, counterproposal history, and team assignments. Rendered by `NegotiationDashboard` component. Supports creating new negotiations (`/dashboard/bargaining/new`) and viewing individual negotiation detail (`/dashboard/bargaining/negotiations/[id]`).
- **Intended Roles:** `bargaining_committee`+. Redirects to `/dashboard` for roles below.
- **Required Data:** Negotiation records by `organizationId`; team assignments; proposal history.
- **Primary Action:** Open or review an active negotiation.
- **Secondary Actions:** Create new negotiation; view clause library; export proposals; track counterproposals; assign team members.
- **Empty State:** "No active negotiations — create a new negotiation to begin tracking CBA proposals." (`LoadingDashboard` with skeletons shown while loading.)
- **Error State:** API failure → `LoadingDashboard` skeleton (Suspense boundary). Actual errors should degrade to an error card inside the Suspense fallback.
- **Audit/Governance Relevance:** Negotiation proposals and counterproposals are high-governance events. All changes should be version-controlled and audited.
- **Pilot/Demo Relevance:** MEDIUM — relevant for unions actively in bargaining cycles.
- **Notes:** Uses `Suspense` with `LoadingDashboard` skeleton correctly. Ensure the `BargainingDashboardContent` async function's error boundary works.

---

### CBA Intelligence

- **Route:** `/[locale]/dashboard/cba-intelligence`
- **Module:** CBA & Bargaining
- **Purpose:** AI-assisted analysis of Collective Bargaining Agreement language. Surfaces comparable clause language from other agreements, precedent analysis, and strategic intelligence for bargaining committee preparation.
- **Intended Roles:** `bargaining_committee`+. Likely `executive`+ for read access.
- **Required Data:** CBA text corpus; clause library; AI inference API.
- **Primary Action:** Query the CBA intelligence for comparable clause language.
- **Secondary Actions:** Save clause to library; annotate for bargaining; export analysis; compare against current agreement.
- **Empty State:** "No CBA data indexed — upload or link a CBA document to begin analysis."
- **Error State:** AI API timeout → "Intelligence analysis unavailable — try again in a moment."
- **Audit/Governance Relevance:** LOW for viewing; MEDIUM if AI outputs are used in formal proposals.
- **Pilot/Demo Relevance:** MEDIUM.
- **Notes:** File exists at `dashboard/cba-intelligence/page.tsx`. See also `docs/cba-intelligence-openapi.yaml` for the API specification.

---

### Clause Library

- **Route:** `/[locale]/dashboard/clause-library`
- **Module:** CBA & Bargaining
- **Purpose:** Repository of saved and curated CBA clause language for bargaining committee reference. Supports tagging, searching, and exporting clause sets.
- **Intended Roles:** `bargaining_committee`+.
- **Required Data:** Clause library records; tags; version history.
- **Primary Action:** Search for a clause by keyword or topic.
- **Secondary Actions:** Add new clause; tag and categorize; export as Word/PDF; compare two clauses; link to active negotiation.
- **Empty State:** "No clauses saved yet — add clauses from CBA Intelligence or manually."
- **Error State:** DB failure → "Clause library temporarily unavailable."
- **Audit/Governance Relevance:** LOW.
- **Pilot/Demo Relevance:** LOW.
- **Notes:** File exists. Content not read.

---

## 14. ADMIN & SETTINGS Module

### Admin Dashboard

- **Route:** `/[locale]/dashboard/admin`
- **Module:** Admin & Settings
- **Purpose:** Platform administration console. Sections: **Overview** (system stats, recent activity), **Users** (system user list with role/org/status), **Locals** (organization/local list with member counts), **System** (system health), **Security** (security settings), **Reports** (scheduled reports), **Database** (DB admin), **AI Testing** (AI endpoint testing). This is an `admin`-experience page.
- **Intended Roles:** `admin`, `system_admin`, `app_owner`. `'use client'` page — no server-side gate confirmed. Server gate should be added.
- **Required Data:** System stats API; user list API; organization list; activity feed.
- **Primary Action:** Monitor system health and manage users/orgs.
- **Secondary Actions:** Search users; edit user role; deactivate user; create new organization; view DB health; run scheduled report; test AI endpoint.
- **Empty State:** Per-section: e.g., "No users found matching search." Global empty means a new deployment with no tenants.
- **Error State:** Per-section API failure → section-level error card. Do not fail the whole admin page on one section's error.
- **Audit/Governance Relevance:** HIGH — all admin actions (user role changes, org creation, deactivation) are critical audit events.
- **Pilot/Demo Relevance:** HIGH — pilot configuration (`/dashboard/admin/onboarding`) and user management are required for pilot setup.
- **Notes:** Sub-routes include `/dashboard/admin/members` (user management), `/dashboard/admin/organizations` (org management), `/dashboard/admin/onboarding` (pilot config), `/dashboard/admin/dues` (dues admin), `/dashboard/admin/governance` (governance admin), `/dashboard/admin/ai-usage` (AI usage — **excluded in pilot mode**).

---

### Settings

- **Route:** `/[locale]/dashboard/settings`
- **Module:** Admin & Settings
- **Purpose:** Dual-purpose settings page. Platform roles (app_owner, coo, cto, platform_lead, etc.) see **PlatformSettingsContent** (org settings JSONB, features_enabled flags, API keys for the platform org). All other roles see **OrgSettingsContent** (local organization settings).
- **Intended Roles:** All authenticated users. Content rendered differs by role.
- **Required Data:** For platform view: `organizations` table (platform type); `integration_api_keys`. For org view: org profile fields.
- **Primary Action:** Review and update settings for the current context.
- **Secondary Actions:** Enable/disable features (platform); rotate API keys (platform); update org branding; configure notification preferences; manage integrations link.
- **Empty State:** "No settings configured — this is a new organization."
- **Error State:** DB failure → "Settings unavailable — please try again."
- **Audit/Governance Relevance:** HIGH — feature flag changes and API key rotation are critical events.
- **Pilot/Demo Relevance:** HIGH — demo operators need to verify settings are correctly seeded.
- **Notes:** The `PLATFORM_ROLES` set defined in this file determines which view renders. Testers should sign in as a `steward` and an `admin` and verify they see different views.

---

### Security

- **Route:** `/[locale]/dashboard/security`
- **Module:** Admin & Settings
- **Purpose:** Security configuration and monitoring for admin users. Covers session management, IP allowlists, failed login monitoring, and security policy configuration.
- **Intended Roles:** `admin`, `security_manager`, governance experience.
- **Required Data:** Security event log; session table; org security policy config.
- **Primary Action:** Review active sessions and security policy.
- **Secondary Actions:** Revoke suspicious session; update IP allowlist; configure password policy; export security report.
- **Empty State:** "No active security events."
- **Error State:** Security data unavailable → "Security dashboard temporarily offline."
- **Audit/Governance Relevance:** CRITICAL — this page is itself a security event. All actions here are audit-logged.
- **Pilot/Demo Relevance:** MEDIUM — procurement will want to see this exists.
- **Notes:** Page file exists. Content not read. Verify route resolves for `security_manager` role.

---

## 15. COMMUNICATIONS Module

### Communications Hub

- **Route:** `/[locale]/dashboard/communications`
- **Module:** Communications
- **Purpose:** Central hub for all outbound communications. Tabs: **Campaigns** (bulk email/push campaigns), **Distribution Lists** (managed recipient groups), **Templates** (reusable message templates), **SMS** (SMS campaign console). Loads live metrics: active/scheduled/sent campaign counts, distribution list stats, template count, SMS campaign count, and recent campaigns table.
- **Intended Roles:** `steward`+ (implied by `requireUser` + `hasMinRole("steward")` call). `'use client'` Campaigns/Distribution/Templates sub-pages are embedded directly.
- **Required Data:** `campaigns` table; `messageTemplates`; `newsletterDistributionLists`; `smsCampaigns` — all filtered by `organizationId`.
- **Primary Action:** Launch a new member communication campaign.
- **Secondary Actions:** Create distribution list; create template; send SMS campaign; view sent campaign analytics; schedule future campaign.
- **Empty State:** Per-tab: "No campaigns yet — create your first campaign." Hub metrics show zeros.
- **Error State:** Metrics load failure → skip metrics section, still show tabs. Individual tab failures are isolated.
- **Audit/Governance Relevance:** MEDIUM — mass communications are audit-logged for governance oversight.
- **Pilot/Demo Relevance:** MEDIUM.
- **Notes:** Sub-routes: `/dashboard/communications/campaigns`, `/dashboard/communications/campaigns/new`, `/dashboard/communications/distribution-lists`, `/dashboard/communications/templates`, `/dashboard/communications/sms`. The hub page embeds sub-pages directly using `import CampaignsPage from "./campaigns/page"` — verify this doesn't cause double-auth-check.

---

### Notifications

- **Route:** `/[locale]/dashboard/notifications`
- **Module:** Communications
- **Purpose:** In-app notification inbox for the authenticated user. System notifications, case status updates, and action items.
- **Intended Roles:** All authenticated.
- **Required Data:** Notification records for `userId`; read/unread status.
- **Primary Action:** Read and dismiss notifications.
- **Secondary Actions:** Mark all as read; filter by type; link to relevant page from notification.
- **Empty State:** "No notifications — you're all caught up."
- **Error State:** API failure → "Notifications temporarily unavailable."
- **Audit/Governance Relevance:** LOW.
- **Pilot/Demo Relevance:** LOW.
- **Notes:** Page file exists.

---

## 16. KNOWLEDGE, TRAINING & CONTINUITY Module

### Institutional Memory

- **Route:** `/[locale]/dashboard/institutional-memory`
- **Module:** Knowledge, Training & Continuity
- **Purpose:** Navigate the union's preserved institutional context: procedural lineage, continuity-aware case records, knowledge graph artifacts, and provenance-stamped explainability outputs. Rendered by `InstitutionalMemoryExplorer`. Includes a `RuntimeHydrationFooter` with provenance metadata sourced from `@nzila/organizational-governance-graph`. The `/dashboard/knowledge-base` route redirects here to `?tab=knowledge-base`.
- **Intended Roles:** All authenticated users (requires auth only, no role elevation).
- **Required Data:** Institutional governance graph records; topology source adapter; continuity records.
- **Primary Action:** Explore preserved institutional knowledge and procedural history.
- **Secondary Actions:** Search by keyword; filter by record type; view provenance stamps; export for continuity review.
- **Empty State:** "No institutional memory records yet — records accumulate as cases are resolved and decisions are documented."
- **Error State:** Graph adapter failure → "Institutional memory temporarily offline — provenance source unavailable."
- **Audit/Governance Relevance:** CRITICAL — this page surfaces the union's organizational memory with explainability guarantees. All access is provenance-stamped.
- **Pilot/Demo Relevance:** MEDIUM.
- **Notes:** The `RuntimeHydrationFooter` exposes `sourceAdapter`, `substrateVersion`, and `contractVersion` — useful for procurement trust review. Do not expose these in public-facing UIs.

---

### Education & Training

- **Route:** `/[locale]/dashboard/education`
- **Module:** Knowledge, Training & Continuity
- **Purpose:** Portal for union member and rep education. Four tiles: **Courses** (course catalog at `/education/courses`), **My Learning** (enrolled courses at `/education/my-courses`), **Certificates** (earned certificates at `/education/certificates`), **Upcoming** (scheduled training sessions).
- **Intended Roles:** All authenticated users.
- **Required Data:** Course catalog; enrollment records for userId; certificate records.
- **Primary Action:** Browse and enroll in a training course.
- **Secondary Actions:** Continue an enrolled course; download a certificate; view upcoming scheduled sessions; view course completion progress.
- **Empty State:** "No courses available yet — check back soon."
- **Error State:** Course catalog unavailable → "Training catalog temporarily offline."
- **Audit/Governance Relevance:** LOW.
- **Pilot/Demo Relevance:** LOW.
- **Notes:** All four sub-pages exist (`/education/courses`, `/education/my-courses`, `/education/certificates`). `requireUser()` is called without role elevation — confirm that even a `member` can access this page.

---

### Knowledge Transfer

- **Route:** `/[locale]/dashboard/knowledge-transfer`
- **Module:** Knowledge, Training & Continuity
- **Purpose:** Structured knowledge transfer records for leadership succession and institutional continuity. Supports creating new transfer documents (`/knowledge-transfer/new`) and reviewing existing ones (`/knowledge-transfer/[id]`).
- **Intended Roles:** `steward`+ (implied — likely gated).
- **Required Data:** Knowledge transfer records; author; status (draft/in-review/approved).
- **Primary Action:** Create a new knowledge transfer document.
- **Secondary Actions:** Review pending transfers; approve/reject a draft; export as PDF; link to continuity plan.
- **Empty State:** "No knowledge transfer documents — create one to preserve critical institutional knowledge."
- **Error State:** DB failure → "Knowledge transfer records unavailable."
- **Audit/Governance Relevance:** HIGH — knowledge transfer documents feed into continuity intelligence.
- **Pilot/Demo Relevance:** LOW.
- **Notes:** Page file exists.

---

## 17. ONBOARDING & PILOT Module

### Pilot Request (Marketing)

- **Route:** `/[locale]/(marketing)/pilot-request`
- **Module:** Onboarding & Pilot
- **Purpose:** Public-facing form for unions to apply for the UnionEyes pilot program. No authentication required. Collects union name, size, contact, and use-case description.
- **Intended Roles:** Public.
- **Required Data:** Contact form submission endpoint; CRM or email notification.
- **Primary Action:** Submit a pilot application.
- **Secondary Actions:** Learn about pilot terms; read CAPE-CLC case study.
- **Empty State:** N/A — static form.
- **Error State:** Form submission failure → toast error; preserve form input.
- **Audit/Governance Relevance:** LOW.
- **Pilot/Demo Relevance:** MEDIUM — shows prospective orgs the onboarding funnel.
- **Notes:** Lives in the marketing route group, not behind auth.

---

### Pilot Dashboard

- **Route:** `/[locale]/dashboard/pilot`
- **Module:** Onboarding & Pilot
- **Purpose:** Internal pilot health dashboard for union officers managing the live pilot program. Shows pilot metrics: `cases_created`, `assignment_efficiency`, `workflow_transition_success_rate`, `evidence_pack_exports`, `sla_compliance_rate`, `sla_breach_count`. Rendered by `PilotDashboard` component.
- **Intended Roles:** `officer`+. Redirects to `/dashboard` for roles below.
- **Required Data:** `pilot_definitions` table; `pilot_metrics` records scoped to org+app; active pilot status.
- **Primary Action:** Monitor pilot health in real time.
- **Secondary Actions:** Export pilot report; view metric trends; share with CLC/procurement.
- **Empty State:** "No pilot metrics recorded yet — pilot activity will populate this dashboard as cases are created and resolved."
- **Error State:** Pilot metrics API unavailable → "Pilot metrics temporarily offline."
- **Audit/Governance Relevance:** HIGH — pilot metrics are the primary evidence artefact for the CAPE pilot proof.
- **Pilot/Demo Relevance:** HIGH — this is the pilot success validation surface.
- **Notes:** Sub-route `/dashboard/pilot/onboarding` handles the pilot onboarding wizard. An active `pilot_definition` must exist in the DB before this page shows meaningful data — run `pnpm -C apps/union-eyes staging:seed` before demo.

---

### Admin Onboarding / Pilot Configuration

- **Route:** `/[locale]/dashboard/admin/onboarding`
- **Module:** Onboarding & Pilot
- **Purpose:** Admin-facing pilot and tenant onboarding configuration wizard. Covers: seed tenant with demo data, configure active pilot definition, set org ID, enable/disable features, set environment class. Used by Nzila ops staff to stand up a new pilot tenant.
- **Intended Roles:** `admin` experience.
- **Required Data:** `pilot_definitions` table write access; org configuration.
- **Primary Action:** Configure and activate a pilot definition for the tenant.
- **Secondary Actions:** Seed demo data; validate pilot readiness; link to Pilot Dashboard.
- **Empty State:** "No pilot configuration found — use this form to set up the pilot for this organization."
- **Error State:** Pilot activation failure → show error detail (admin context; raw errors acceptable here).
- **Audit/Governance Relevance:** HIGH — pilot activation is a critical setup event.
- **Pilot/Demo Relevance:** HIGH — required before demo.
- **Notes:** Part of the admin experience allowed prefixes.

---

## Pilot-Critical Page Summary

The following pages are rated **HIGH** for pilot and demo relevance. Testers must validate these before any live demo or procurement review. Status defaults to PENDING until sign-off.

| Page | Route | Module | Tester Sign-Off |
|------|-------|--------|----------------|
| Login | `/[locale]/(auth)/login/[[...login]]` | Auth | PENDING |
| Sign-In | `/[locale]/(auth)/sign-in/[[...sign-in]]` | Auth | PENDING |
| Dashboard Root (Role Redirect) | `/[locale]/dashboard` | Dashboard | PENDING |
| Unified Inbox | `/[locale]/dashboard/inbox` | Inbox | PENDING |
| New Claim / Intake Form | `/[locale]/dashboard/claims/new` | Claims | PENDING |
| Casework Console (Work) | `/[locale]/dashboard/work` | Work | PENDING |
| Priorities | `/[locale]/dashboard/priorities` | Work | PENDING |
| Grievance Detail | `/[locale]/dashboard/grievances/[id]` | Grievances | PENDING |
| Case Detail | `/[locale]/dashboard/cases/[id]` | Cases | PENDING |
| Documents | `/[locale]/dashboard/documents` | Evidence | PENDING |
| Audits | `/[locale]/dashboard/audits` | Evidence | PENDING |
| Member Directory | `/[locale]/dashboard/members` | Members | PENDING |
| Governance Center | `/[locale]/dashboard/governance` | Governance | PENDING |
| Intelligence Shell | `/[locale]/dashboard/intelligence` | Analytics | PENDING |
| Admin Dashboard | `/[locale]/dashboard/admin` | Admin | PENDING |
| Settings | `/[locale]/dashboard/settings` | Admin | PENDING |
| Pilot Dashboard | `/[locale]/dashboard/pilot` | Onboarding | PENDING |
| Admin Onboarding | `/[locale]/dashboard/admin/onboarding` | Onboarding | PENDING |

---

## Role Access Matrix

Rows represent key pages. Columns represent the six primary user groups. Cells:
- ✅ Full access (read + write where applicable)
- 👁 Read-only access
- ❌ Denied (redirect or 403)
- 🔒 Role-gated (access depends on sub-permission or entitlement flag)

| Page | Union Admin | Union Staff / Rep | Member | Executive / Leadership | Governance / Oversight | Platform Admin |
|------|:-----------:|:-----------------:|:------:|:---------------------:|:----------------------:|:--------------:|
| Login / Sign-In | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dashboard Root | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Inbox | ✅ | ✅ | ✅ | 👁 | 👁 | ✅ |
| Work / Casework Console | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Priorities | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Claims / New Intake | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Grievance Detail | ✅ | ✅ | ❌ | 🔒 | 🔒 | ✅ |
| Case Detail | ✅ | ✅ | ❌ | 👁 | 👁 | ✅ |
| Documents | ✅ | ✅ | 👁 | 👁 | 👁 | ✅ |
| Audits | ✅ | ❌ | ❌ | 👁 | ✅ | ✅ |
| Member Directory | ✅ | ✅ | ❌ | 👁 | 👁 | ✅ |
| Governance Center | ✅ | ❌ | ❌ | 👁 | ✅ | ✅ |
| Elections | ✅ | 🔒 | 👁 | ✅ | ✅ | ✅ |
| Analytics | ✅ | ✅ | ❌ | ✅ | 👁 | ✅ |
| Intelligence Shell | ✅ | ✅ | ❌ | ✅ | 👁 | ✅ |
| Finance Dashboard | ✅ | ❌ | ❌ | ✅ | 👁 | ✅ |
| Dues Portal | ✅ | ✅ | ✅ | ✅ | 👁 | ✅ |
| Bargaining | ✅ | 🔒 | ❌ | 👁 | 👁 | ✅ |
| Communications Hub | ✅ | ✅ | ❌ | 👁 | ❌ | ✅ |
| Education | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Institutional Memory | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin Dashboard | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Settings (Org) | ✅ | 👁 | 👁 | 👁 | 👁 | 🔒 |
| Settings (Platform) | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Health & Safety | 🔒 | 🔒 | ❌ | ❌ | ❌ | 🔒 |
| Pilot Dashboard | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ |

> 🔒 = requires specific sub-role (e.g., `bargaining_committee`, `health_safety_rep`) or module entitlement flag.

---

## Empty State Standard

All pages in UnionEyes must implement a consistent empty state when no data is available. The standard is:

1. **Icon or illustration** — use a neutral, on-brand icon (e.g., from Lucide). Do not use error-style icons for empty states.
2. **Headline** — one sentence describing what would normally appear here: *"No cases yet"*, *"Your inbox is empty"*.
3. **Subtext** — one sentence explaining what action creates data: *"Cases appear here once a member submits an intake request."*
4. **Primary CTA (where appropriate)** — a button to create the first item or navigate to the relevant action (e.g., "Open Representation Case", "Create First Election"). The CTA should only appear when the current user has permission to create the item.
5. **No raw JSON, no "undefined", no "NaN"** — if a numeric metric renders as `NaN` or `undefined`, that is a bug. Verify with seeded empty data that all stat cards default to `0`.

---

## Error State Standard

All pages must handle server or API errors gracefully according to this standard:

1. **Never expose raw stack traces or SQL errors** to any user (member, staff, or admin). Raw errors must only appear in server logs.
2. **Per-section degradation** — if a page has multiple independent data sections (e.g., the Admin Dashboard tabs), a failure in one section must not block other sections. Use individual `try/catch` or `Suspense` error boundaries per section.
3. **Toast for transient errors** — use the `sonner` toast library for temporary API errors on client pages. Provide a retry action where possible.
4. **Full-page error for fatal errors** — if the page cannot render at all (e.g., auth failure, org not found), render a full-page error card with a helpful message and a link to return to the dashboard or contact support.
5. **Retry mechanism** — all pages with async data fetching must provide a way for the user to retry without a full page reload.
6. **Loading skeletons** — all async data sections must show a `Skeleton` placeholder during initial load. Never show a blank or invisible section during load.
7. **HTTP 404 for resource not found** — detail pages (case, grievance, member) that receive an invalid ID must return a 404, not a blank page or empty detail view.
8. **HTTP 403 / redirect for unauthorized access** — pages with role gates must redirect to `/dashboard` (or `/login` if unauthenticated) rather than rendering a 403 page. Tester note: verify that guessing a valid case ID as a member role results in a redirect, not partial data disclosure.

---

*Generated from source code analysis of `apps/union-eyes/app/[locale]/`, `lib/auth/roles.ts`, `lib/dashboard/role-experience.ts`, and supporting documentation in `apps/union-eyes/docs/`. For questions, contact the UnionEyes platform team or reference [INDEX.md](./INDEX.md).*
