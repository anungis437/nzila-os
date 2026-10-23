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
| Home (M02) | No member Home. Member landing is My Cases (`/dashboard/claims`); `/dashboard`, Workspace and Inbox are not member surfaces. | UNAVAILABLE | Needs an authoritative personal overview. The contract's Home supersedes the earlier interim "land on My Cases" decision only once it exists. Do not add a decorative Home link. |
| My Representation: intake (M03) | `/dashboard/claims/new` to `POST /api/cases/intake` (NAR ledger, server-verified member id, ClamAV, blob storage). | LIMITED | Local 201 end to end including clean and EICAR evidence. Requires canonical bootstrap mode and NAR signing config. Voice input hidden for members. No privacy-disclosure acknowledgement step captured. |
| My Representation: lifecycle (M04) | `/dashboard/claims`, `/dashboard/claims/[id]`, `GET /api/claims/[id]`, `/api/cases/[caseId]/timeline`, `/api/claims/[id]/workflow/history`. | LIMITED | Own-case authority enforced (`case-authorization.ts`), with PGlite, route and live negatives. Member withdrawal, clarification, acknowledgement and review requests are not implemented. Legal-deadline calculation is UNAVAILABLE (no engine). |
| Messages (M05) | `/api/messages/threads*` exist; no member UI; link removed from member navigation. | UNAVAILABLE | Participant and matter authorization of the thread API has not been reviewed for member use. Notifications are not a substitute. |
| My Documents (M06) | `/dashboard/documents` (`MemberDocuments`), repository routes with `hasDocumentContextAccess`. | LIMITED | Own uploads plus `public_internal` shared documents; unlinked confidential documents hidden; download, single-document and universal search routes share the check. No access-request flow. Grant, expiry and revocation not modelled. Legacy document endpoint stays disabled. |
| My Union (M07) | Not present. `/dashboard/dues` and `/api/dues/*` exist but are staff/finance surfaces. | UNAVAILABLE | Membership identity, agreements, dues context, events, voting and benefits have no member-facing, authorization-backed engine. Not linked. |
| Help & Resources (M10) | `/dashboard/support` exists and is in the member allow-list. | LIMITED, unreviewed | Content, contact path and WCAG 2.2 AA verification have not been assessed. |
| Account: Profile (M09) | `/dashboard/profile` read-only (`MemberProfile`); `/api/users/me/profile` returns session identity. | LIMITED | Read-only by design; no member-editable fields. |
| Account: Preferences, Privacy | `/api/messaging/preferences`, `/api/privacy/consent`, `/api/privacy/dsar`, `/api/notifications/preferences` exist. No member UI. Org settings pages redirect non-admins to Profile. | UNAVAILABLE | No consent, access or correction flow reachable by members. Law 25 / PIPEDA obligations unmet in the UI. |
| Account Security, Sign out | Sign out available; no account-security surface. | LIMITED | |
| Notifications | `in_app_notifications` row inserted for the owning member on case transition. | LIMITED | No verified member-facing notification UI; leak review across inaccessible matters not done. |
| WorkAid (M08) | No WorkAid code in Union Eyes. Separate agent and workstream. | UNAVAILABLE (design only) | No referral, projection, consent-to-share or engagement-state code. Nothing may be presented as live. |
| Identity (M01) | Cookie session, role and organization resolution fail closed for unresolved role or missing organization. | LIMITED | Multiple-affiliation and suspended/revoked membership handling is not proven end to end. |

## 3. Known deltas from the frozen navigation

The current member navigation shows My Cases, Open Representation Case, Documents and Profile. It intentionally omits Home, Messages, My Union and Help & Resources because each lacks a qualified member engine or surface. Showing them now would violate the rule that a navigation link must not lead to a dead or deceptive surface. They enter navigation only as each moves to LIMITED or better with the evidence in section 1.

Implementation order (focus on the core member release obligation): authenticated personal Home, then member Messages (after participant/matter authorization review), membership identity inside My Union, privacy and preferences, then the WorkAid boundary. Conditional modules (dues, agreements, voting, benefits, meetings, education) stay UNAVAILABLE until their engines and authority rules are qualified.

## 4. Outstanding gates

- Native session acceptance with exact source and deployment revision is not established.
- Security fixes in the local commits must be integrated through the existing security-convergence workstream (`UE_SECURITY_CONVERGENCE_DISPOSITION.md`), not a separate PR.
- The local database was reconciled by diagnostic SQL (not a governed migration); it must not be applied to staging.
- `UE_SAAS_OPERATIONAL_READINESS` remains NO_GO per [25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md](./25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md).

**UE_MEMBER_CANONICAL_2_1 = FROZEN (design). Operational disposition: NOT QUALIFIED FOR RELEASE.**
