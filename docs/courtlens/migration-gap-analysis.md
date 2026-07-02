# CourtLens Migration Gap Analysis

## Scope

This gap analysis compares discovered legacy CourtLens capabilities with current `@nzila/abr` capabilities using a reuse-first stance.

Classification values:

- True missing capability.
- Existing ABR capability needing CourtLens vocabulary/view/configuration.
- Legacy-only feature not worth migrating.

Delivery priority tags used inside each row:

- Must-have for first pilot.
- Should-have for credible demo.
- Later-stage platform feature.
- Do not migrate.

## Capability Comparison and Classification

## 1. Public Intake (housing/employment/debt)
- Legacy: implemented with dedicated public and tenant-scoped public routes.
- Current ABR: no equivalent public intake UX/workflow in place.
- Gap type: True missing capability.
- Delivery priority: Must-have for first pilot.

## 2. Matter Queue and Matter Detail Workspace
- Legacy: implemented with tenant queue and detailed matter workspace.
- Current ABR: incident APIs exist, but no CourtLens matter queue/product surface.
- Gap type: Existing ABR capability needing CourtLens vocabulary/view/configuration.
- Delivery priority: Must-have for first pilot.
- Reuse note: treat as a product-surface gap first; avoid duplicating incident-domain infrastructure.

## 3. Review Packet Assembly
- Legacy: case packet concept and extracted fact artifacts present.
- Current ABR: AI legal action primitives exist, but no dedicated review packet module.
- Gap type: Existing ABR capability needing composition/workflow configuration.
- Delivery priority: Must-have for first pilot.
- Reuse note: compose over AI legal actions + evidence/NAR, not a new AI subsystem.

## 4. Human Approval Workflow for AI Output
- Legacy: explicit draft framing and reviewer approval doctrine.
- Current ABR: AI actions exist; no CourtLens-specific draft-to-approval workflow for packet output.
- Gap type: Existing ABR capability needing CourtLens workflow adaptation.
- Delivery priority: Must-have for first pilot.

## 5. Referral and Status Tracking
- Legacy: referral lifecycle and status check patterns exist.
- Current ABR: no dedicated CourtLens referral/status module.
- Gap type: True missing capability (workflow surface), with reusable ABR transition patterns.
- Delivery priority: Must-have for first pilot.

## 6. Document Submission and Review Linking
- Legacy: document entity and upload workflows in public and tenant surfaces.
- Current ABR: no CourtLens document pipeline mapped to matter/review packet.
- Gap type: Existing ABR capability needing CourtLens vocabulary/view/configuration where blob/evidence primitives already exist.
- Delivery priority: Must-have for first pilot.

## 7. Parent/Network Aggregate Portal
- Legacy: parent view with child-tenant aggregate visibility.
- Current ABR: no CourtLens parent network surface.
- Gap type: Existing ABR capability needing CourtLens aggregate views/redaction policy configuration.
- Delivery priority: Should-have for credible demo.

## 8. Platform Admin Surface (tenant onboarding, source verification controls)
- Legacy: broad platform admin controls.
- Current ABR: platform-oriented controls exist for ABR domain, not CourtLens domain.
- Gap type: Existing ABR capability needing CourtLens product-surface adaptation.
- Delivery priority: Should-have for credible demo.

## 9. Jurisdiction and Source Verification
- Legacy: source registry, verification, citation/snapshot artifacts.
- Current ABR: intelligence source concepts exist but not CourtLens reviewer trust flow.
- Gap type: Existing ABR capability needing CourtLens reviewer-trust composition.
- Delivery priority: Should-have for credible demo.

## 10. Impact/Funder Reporting
- Legacy: tenant/parent/platform reporting concepts.
- Current ABR: reporting/export exists in ABR context; CourtLens impact model absent.
- Gap type: Existing ABR capability needing CourtLens metric vocabulary and views.
- Delivery priority: Should-have for credible demo.

## 11. Tenant/Parent/Platform Role Mapping
- Legacy: 13-role model across four surfaces.
- Current ABR: 9-role ABR model.
- Gap type: Existing ABR capability needing CourtLens role mapping and visibility tuning.
- Delivery priority: Must-have for first pilot (minimum safe mapping), later-stage platform feature (full mapped role coverage).

## 12. Support Session Controlled Access
- Legacy: tenant support session entity and controls.
- Current ABR: no CourtLens support-session workflow.
- Gap type: True missing capability.
- Delivery priority: Later-stage platform feature.

## 13. Stripe Billing Coupled to Tenant Portal
- Legacy: Stripe checkout/portal/webhook integrated in legacy runtime pattern.
- Current ABR: billing sidecar exists, but no CourtLens billing architecture finalized.
- Gap type: Existing ABR capability needing CourtLens commercial configuration.
- Delivery priority: Later-stage platform feature.
- Legacy-only feature not worth migrating: tenant-coupled billing pattern is Do not migrate.

## 14. Legacy Base44 Runtime and Deno Function Structure
- Legacy: runtime-specific implementation details.
- Current ABR: Next.js + platform package architecture.
- Gap type: Legacy-only feature not worth migrating.
- Delivery priority: Do not migrate.

## 15. Legacy Base44 IDs, Env-Specific Config, Demo Credentials
- Legacy: includes app/runtime identifiers and demo credentials patterns.
- Current ABR: must remain clean-room from secrets/IDs.
- Gap type: Legacy-only feature not worth migrating.
- Delivery priority: Do not migrate.

## 16. Any AI Flow Presenting Final Legal Advice
- Legacy: doctrine already warns against this risk.
- Current ABR: must enforce stronger supervised framing in CourtLens UX/copy.
- Gap type: Legacy-only feature not worth migrating.
- Delivery priority: Do not migrate.

## Risk Notes

## Unauthorized Practice / Legal Advice Boundary
- Risk: public-facing or reviewer-facing text implies final legal advice.
- Control: hard product boundary language and forced human approval before external action.

## Privacy and Sensitive Client Data
- Risk: intake and client records include sensitive legal/life context.
- Control: org-scoped storage, least-privilege access, redaction-safe parent/platform views.

## Auditability
- Risk: reviewer and AI actions not provable or distinguishable.
- Control: audited write path, immutable evidence pattern, explicit AI-vs-human event typing.

## AI Hallucination and Unsupported Claims
- Risk: unsupported factual/legal assertions in packet drafts.
- Control: source citation requirements, jurisdiction verification, reviewer gate before output use.

## Billing Separation
- Risk: subscription logic entangled with operational casework lifecycle.
- Control: dedicated billing module boundary; no case outcome dependency on billing internals.

## Multi-Tenancy
- Risk: cross-tenant data leakage in parent/platform reporting or support workflows.
- Control: org-scoped registry, scoped DB access, aggregate-only parent layer by default.

## Demo Data Safety
- Risk: accidental use of real/identifiable case data in demos.
- Control: synthetic-only seed data, explicit demo-safe roles, no external demo before smoke gate pass.
