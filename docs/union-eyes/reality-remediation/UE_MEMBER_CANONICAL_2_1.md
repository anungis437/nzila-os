# UE_MEMBER_CANONICAL_2_1

Contract ID: `UE-MEMBER-CANONICAL-2.1`. Decision date: 2026-10-23.

| Item | Disposition |
| --- | --- |
| Architecture | FROZEN |
| Implementation | NOT CERTIFIED |
| WorkAid integration | DESIGNED, NOT QUALIFIED |
| Staging / Production | NO-GO |

This document records the frozen member product and authorization contract and an honest gap ledger against the current source. It does not certify the application, authorize staging promotion or waive any test gate. Local synthetic acceptance is not native deployed acceptance.

## 1. Frozen contract (summary)

**Doctrine.** Union Eyes is the member's trusted digital relationship with their union. Every enabled action must lead to a real, authorized, persisted and verifiable result. UI presence, seeded data, mocks, synthetic tests and optimistic success messages do not demonstrate capability.

**Six primary destinations (frozen).** Home, My Representation, Messages, My Documents, My Union, Help & Resources. Account controls (Profile, Preferences, Privacy, Account Security, Sign Out) are not primary navigation. No new primary destination may be added because a module exists; union-specific features are contextual modules inside My Union. WorkAid is contextual to My Representation and is never a top-level destination.

**Journeys.** M01 identity and access · M02 personalized Home · M03 representation intake · M04 representation lifecycle · M05 messages · M06 My Documents · M07 My Union · M08 WorkAid specialist coordination · M09 profile, privacy and preferences · M10 help, guidance and accessibility (WCAG 2.2 AA target).

**Authorization invariants.** Same-union membership never grants access to another member's case or evidence. Cross-union access needs explicit scoped authority. Member timelines exclude internal and sensitive data. Case status, legal status and professional engagement status have distinct authorities. Revocation and expiry are enforced at access time. Search, export, preview, download and direct URLs obey one authorization model. Member permissions never grant staff, admin, governance or professional authority. No identity fallback defaults. All material mutations carry durable audit evidence.

**WorkAid boundary.** Union Eyes owns membership identity, institutional referral authority and authorized member-facing projections. WorkAid owns specialist acceptance, professional judgment and what professional information is released. Clio is a provisional WorkAid system-of-record design, not an established integration. Referral, dispatch, delivery, receipt and legal filing validity are separate events; none implies another. WorkAid medical data, privileged communications, internal notes and Clio files are never synchronized to the member portal automatically. A member with multiple unions or matters has separately evaluated rights per relationship. No live WorkAid progress, regulator acknowledgement or Clio status may be shown without authoritative operational evidence.

**Capability states.** OPERATIONAL (server-owned workflow plus native acceptance evidence) · LIMITED (works, with documented limits and truthful UI) · UNAVAILABLE (not implemented or not authorized; no deceptive interaction) · BLOCKED (missing security, authority or deployment prerequisite) · NOT_APPLICABLE (not eligible). States must derive from authoritative capability evaluation, not UI assumptions. Unknown financial data stays unknown (never a zero balance or "paid up").

**Acceptance evidence per visible action.** Persona and organization, entry route and control, backend route and engine, identity/organization/resource authority, state mutation or authoritative read, database/object-store outcome, audit and notification outcome, result shown to the member, negative-authorization evidence, native session evidence, exact source and deployment revision. Required negatives: same-union unrelated member, different-union member, multiple affiliations, suspended/revoked membership, expired grants, revoked WorkAid engagement, unauthorized document or conversation participant, stale session, missing authoritative data, interrupted network/repeat submit/partial failure, internal-information redaction. Screenshots alone never pass a feature.

**Change control.** Navigation, member authority, cross-organization sharing, professional control, regulated filing claims or release scope change only through a new explicit canonical decision. Layouts, components and implementation choices are engineering freedom.

## 2. Capability ledger against the current source

Status uses the contract states. "Local evidence" means the local synthetic worktree environment only (Docker Postgres, ClamAV, Azurite, synthetic QA accounts). No row is OPERATIONAL, because no native deployed acceptance exists.

| Destination / journey | Source today | Contract state | Local evidence and limits |
| --- | --- | --- | --- |
| Home (M02) | `/dashboard` renders `MemberHome` for members: own active cases (`/api/claims`), own in-app notifications, link to Messages. Each section loads independently and shows an error, never a zero, when its source fails. | LIMITED | No announcements, member-action requests or document requests: no engine exists, so none are shown. No unread-message count (see Messages). |
| My Representation: intake (M03) | `/dashboard/claims/new` to `POST /api/cases/intake` (NAR ledger, server-verified member id, ClamAV, blob storage). | LIMITED | Local 201 end to end including clean and EICAR evidence. Needs canonical bootstrap mode and NAR signing config. Voice input hidden for members. No privacy-acknowledgement step is captured. |
| My Representation: lifecycle (M04) | `/dashboard/claims`, `/dashboard/claims/[id]`, `GET /api/claims/[id]`, `/api/cases/[caseId]/timeline`, `/api/claims/[id]/workflow/history`. | LIMITED | Own-case authority enforced (`case-authorization.ts`) with PGlite, route and live negatives. Member withdrawal, clarification, acknowledgement and review requests are not implemented. Legal-deadline calculation is UNAVAILABLE (no engine). |
| Messages (M05) | `/dashboard/messages` (`MemberMessages`); `/api/messages/threads*` rewritten around participant scope (`lib/messaging/thread-access.ts`). | LIMITED | A member starts, reads and replies in their own conversations; repeat submits are de-duplicated; the counterpart gets a content-free in-app notice that honours their preference. Staff-initiated threads, assignment, attachments, and read/unread state are not available. **Read state is BLOCKED:** the runtime role holds SELECT and INSERT only on `message_threads` and `messages` (storage-authority manifest `baseline-0108.ts`), so `messages.read_at` cannot be updated and `message_read_receipts` is SELECT-only. Enabling it needs a governed privilege change, not a local grant. |
| My Documents (M06) | `/dashboard/documents` (`MemberDocuments`), repository routes with `hasDocumentContextAccess`. | LIMITED | Own uploads plus `public_internal` shared documents; unlinked confidential documents hidden; download, single-document and universal search routes share the check. No access-request flow. Grant, expiry and revocation are not modelled. Legacy document endpoint stays disabled. |
| My Union (M07) | `/dashboard/union` (`MyUnion`) reads the caller's own `organization_members` row via `GET /api/members/me` (replacing a generic CRUD handler over the billing `profiles` table). | LIMITED | Shows union, status, membership number, category, join date, department, position; an absent record is shown as absent. Agreement, dues, benefits, events, participation and digital card are listed as "Not available yet" with no links or values; unknown dues are never shown as paid. |
| Help & Resources (M10) | `/dashboard/help` (`HelpResources`, static guidance). | LIMITED | Signposts only to real features. No contacts directory, deadlines or legal conclusions. WCAG 2.2 AA journey checks not yet performed. |
| Account: Profile (M09) | `/dashboard/profile` read-only (`MemberProfile`); `/api/users/me/profile` returns session identity. | LIMITED | Read-only by design; no member-editable fields. |
| Account: Preferences (M09) | `/dashboard/preferences` over `GET/PUT /api/notifications/preferences` (validated, strict, RLS user-scoped, audited). | LIMITED | Only in-app notices and case-update notices are offered, because only those are delivered; case-transition and message notices check the recipient's preference on the system connection. Email, SMS and push are not offered: nothing sends them. |
| Account: Privacy (M09) | `/dashboard/privacy` (`MemberPrivacy`): access model, links, and a secure-message request path. | LIMITED | Self-service access, correction and consent-withdrawal are UNAVAILABLE. `POST /api/gdpr/data-export` returns 500 locally (no job queue) and is not offered. Law 25 / PIPEDA self-service obligations remain unmet. |
| Account Security, Sign out | Sign out available (profile page and header); no account-security surface. | LIMITED | |
| Notifications | `in_app_notifications` written on case transition and on new messages. | LIMITED | Content-free for messages. Cross-matter leakage review not complete. |
| WorkAid (M08) | No WorkAid code in Union Eyes. Separate agent and workstream. | UNAVAILABLE (design only) | No referral, projection, consent-to-share or engagement-state code. Nothing may be presented as live. |
| Identity (M01) | Cookie session, role and organization resolution fail closed for unresolved role or missing organization. | LIMITED | Multiple-affiliation and suspended/revoked membership handling is not proven end to end. |

## 3. Security findings closed during this pass (local, uncommitted to any release)

- Generic CRUD routes (`crudRoutes`, 281 member-readable sites) were tenant-scoped only. A live probe showed a member listing every organization member's name, email, phone and role through `/api/admin/alerts/recipients`. `lib/api/crud-low-role-guard.ts` now limits callers below steward to their own rows (via `userId`/`memberId`), refuses personal tables with no owner column, forces the owner on member creates, and fails closed for unresolved role or organization. Staff behaviour is unchanged. This is a platform-level change and needs security-convergence review; individual routes remain over-permissive for staff.
- `/api/messages/threads`, `/[threadId]`, `/messages` and `/notifications` returned every thread and message in the organization to any member. Replaced with participant-scoped handlers; PostgreSQL regression runs the engine under a SELECT/INSERT-only role. Live negatives: same-organization steward and cross-organization member receive 404 and cannot post.
- `/api/members/me` exposed billing identifiers (Stripe/Whop ids). Replaced with a read of the caller's own membership.
- `PUT /api/notifications/preferences` accepted unvalidated values; it is now schema-validated and strict.

## 4. Navigation delta from the frozen contract

The member navigation now shows Home, My Representation, Messages, My Documents, My Union, Help & Resources, and an Account group (Profile, Preferences, Privacy). Each destination resolves to a real page with a truthful state. Members land on Home (`/dashboard`), superseding the earlier interim decision to land on My Cases; reverting is one line in `ROLE_EXECUTION_HOME_BY_EXPERIENCE`. "Open Representation Case" is an action inside My Representation, not a destination. Mobile uses the same sidebar sheet and lists all nine entries (`components/mobile/BottomNav.tsx` is not mounted anywhere).

## 5. Outstanding gates

- Native session acceptance with exact source and deployment revision is not established.
- The security fixes must be integrated through the existing security-convergence workstream (`UE_SECURITY_CONVERGENCE_DISPOSITION.md`), not a separate PR.
- Message read state needs a governed privilege change (UPDATE on `messages` or INSERT on `message_read_receipts`).
- Self-service data export needs a job queue; access, correction and consent-withdrawal flows do not exist.
- The local database was reconciled by diagnostic SQL (not a governed migration); it must not be applied to staging.
- `UE_SAAS_OPERATIONAL_READINESS` remains NO_GO per [25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md](./25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md).

**UE_MEMBER_CANONICAL_2_1 = FROZEN (design). Operational disposition: NOT QUALIFIED FOR RELEASE.**