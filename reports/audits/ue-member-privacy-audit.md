# Union Eyes Member Privacy Audit

## Verdict

GO WITH RESTRICTIONS.

Union Eyes shows real privacy intent: scoped timelines, document labels, explicit document authorization, audit trails, and controlled evidence export. The main risk is uneven enforcement across old and new code paths. For a first CUPE deployment, trust will depend less on what the strongest services can do and more on whether every live path uses them.

## Positive Privacy Controls

1. `lib/services/document-governance-service.ts` defines meaningful privacy labels such as `case_restricted`, `privileged`, and `highly_sensitive`.
2. `lib/services/document-authorization-service.ts` combines org membership, case access, document grants, and privacy labels.
3. `app/api/cases/[caseId]/notes/route.ts` records note creation in the audit log without storing full note content there.
4. Evidence export uses a sealed pack concept rather than ad hoc dumps.

## Privacy Risks

1. `lib/services/case-timeline-service.ts` contains a placeholder ownership check for member-visible timelines. It explicitly allows non-owner access in a comment path that says "for now, allow all for demonstration". Even if dormant, that code is not pilot-grade.
2. The mixed auth/org-resolution model increases the chance that a route returns same-org or wrong-org data more broadly than intended.
3. `app/[locale]/dashboard/layout.tsx` auto-provisions profiles and default org membership. That may reduce friction, but it also raises trust questions if membership creation is too automatic for a politically sensitive union deployment.
4. Member attachment handling is miswired, so privacy assurances over uploaded evidence are weaker than the product surface suggests.

## Member Trust Implications

1. Members will judge privacy by the intake and attachment flow, not by architecture docs.
2. If uploads do not go through a dedicated case evidence path, members cannot be told with confidence where their documents live or who can see them.
3. Automatic default-org provisioning should be explicitly governed in pilot operations, not left implicit.

## Required Pilot Controls

1. Restrict pilot onboarding to curated users and curated org membership.
2. Disable member attachment upload until a dedicated evidence route is in place.
3. Remove or harden any placeholder access logic before live member exposure.
4. Publish a short member privacy statement that matches actual product behavior.

## Launch Position

Privacy foundations are stronger than average, but member trust will erode quickly if the live intake path keeps bypassing the hardened controls.
