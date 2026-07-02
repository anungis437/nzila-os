# Legacy Product Inventory: CourtLens Access (Base44)

## Purpose

This document inventories the legacy CourtLens Access Base44 application as product/domain reference for migration planning.

The legacy app is not the production source of truth for implementation details.

Legacy concepts in this inventory are product references, not architecture instructions for the ABR runtime.

## Product Positioning Preserved

- Supervised, review-ready justice operations infrastructure.
- Human review required before external use of AI output.
- Institutional workflow support for legal clinics, legal aid teams, pro bono programs, unions, nonprofits, and parent legal networks.

## Four Product Surfaces

## 1. Public Surface (Unauthenticated)

Primary user: members of the public seeking intake support.

Key flows:
- Start intake by legal problem type (housing, employment, debt).
- Upload documents.
- Intake confirmation.
- Check status.
- Follow-up routes.
- Public resources and legal boundary pages.

Notable route pattern:
- Tenant-scoped public routes: `/t/:tenantSlug/...`.

Product role:
- Convert messy legal need into structured intake artifacts before human legal/community review.

## 2. Tenant Portal (Authenticated, Organization Scoped)

Primary users: tenant legal/community justice teams.

Key capabilities:
- Matter queue and triage.
- Matter workspace/detail.
- Document handling.
- Referral handling.
- Reviewer workload view.
- Audit and reporting views.
- Tenant settings and user management.

Product role:
- Day-to-day frontline casework operations inside tenant boundary.

## 3. Parent Portal (Authenticated, Network Scoped)

Primary users: parent organizations coordinating multiple tenants.

Key capabilities:
- Child tenant visibility.
- Onboarding and pilot request flows.
- Parent-level reporting and audit.
- Parent settings and users.

Product role:
- Network-level coordination and performance visibility.
- Aggregate oversight without unrestricted child matter disclosure.

## 4. Platform Admin Surface (Authenticated, Platform Scoped)

Primary users: platform operators/administrators.

Key capabilities:
- Parent and tenant organization administration.
- Tenant onboarding and pilot administration.
- Jurisdiction intelligence and source verification.
- Platform audit and support session tooling.
- Network reporting, system health, demo data controls.

Product role:
- Governance, operational control, trust mechanisms, and cross-network administration.

## Major Entity Catalog and Product Role

Core entities discovered in legacy Base44 entity definitions:

- `Matter`: central casework object; legal problem typing, lifecycle status, urgency, summary fields, risk flags, referral and engagement state.
- `ClientProfile`: person-level intake and context profile tied to matters.
- `Document`: submitted/managed artifacts used in review packet preparation.
- `Referral`: external or internal handoff record for service routing.
- `ReviewerNote`: reviewer-generated analysis and decisions.
- `RiskFlag`: structured risk markers for escalation and prioritization.
- `TimelineEvent`: chronological matter activity trail.
- `FollowUpRequest`: pending client/staff follow-up interactions.
- `CasePacket`: assembled review-ready packet for supervised review.
- `ExtractedFact`: structured fact extraction artifact.

Governance and trust entities:

- `AuditLog`: immutable accountability trace for actions and outcomes.
- `PublicSource`: trusted source registry entries.
- `SourceCitation`: linkage from generated/reviewer content to authoritative source.
- `SourceSnapshot`: source freshness and evidence capture.
- `JurisdictionProfile`: jurisdiction context metadata.
- `JurisdictionRule`: jurisdiction-aware rule set metadata.
- `TenantSupportSession`: controlled support-access workflow trace.

Organization model entities:

- `Organization`: tenant/parent/platform organization record.
- `OrganizationMembership`: user-to-organization membership with role binding.
- `User`: authenticated user context for role and workflow actions.
- `PilotRequest`: onboarding/procurement pilot workflow object.
- `BillingEvent`: billing subscription state/audit events.

## Reusable Product and Domain Concepts

Concepts to preserve and map into target architecture:

- Four-surface separation (public, tenant, parent, platform).
- Strong organization and membership model.
- Matter-centric lifecycle with review status and urgency/risk.
- Human-in-the-loop AI status model (draft to approved/revised).
- Reviewer workload and referral flow.
- Source and jurisdiction verification as reviewer trust layer.
- Audit log visibility by role/scope.
- Demo/stakeholder safe viewing role.
- Bilingual and Canada-first access-to-justice posture.

Important translation rule:

- Base44 surface separation should inform ABR views, permissions, and scoped projections.
- It should not force a separate runtime model beside ABR.

## Must Not Migrate As-Is

The following legacy implementation assumptions must not be copied directly:

- Base44 SDK/runtime assumptions.
- Deno serverless function structure as implementation baseline.
- Base44 app identifiers.
- Secrets or environment-specific configuration values.
- Hard-coded demo credentials and static demo login tables.
- Tenant-coupled Stripe assumptions mixed into operational casework flows.
- Any UX or text that can be interpreted as AI giving final legal advice.

## Legal and Safety Boundary Carry-Forward

Migration must preserve explicit boundaries:

- No lawyer replacement claims.
- No final legal advice from AI.
- AI output remains draft-only until human approval.
- Public-facing copy must use legal information/intake/review packet framing.
