# Union Eyes Case Workflow Audit

## Verdict

GO WITH RESTRICTIONS.

The underlying workflow model is credible. The case lifecycle, transition validation, assignment, notes, escalation, audit, and export features are present. The problem is the entry path. The member-facing new-claim flow is still wired to the wrong backend, so the best workflow logic in the platform is not reliably the workflow members actually enter.

## What Works

1. `app/api/cases/intake/route.ts` is a serious intake endpoint with validation, audit, entitlement checks, and evidence pack generation.
2. `app/api/cases/[caseId]/transition/route.ts` enforces server-side FSM transitions using CUPE vocabulary.
3. `app/api/cases/[caseId]/assign/route.ts`, `notes/route.ts`, `audit/route.ts`, and `export/route.ts` form a coherent staff-side case handling path.
4. `app/api/cases/[caseId]/escalate/route.ts` provides a credible path from case intake to formal grievance escalation.

## Critical Workflow Gaps

1. `app/[locale]/dashboard/claims/new/page.tsx` still posts member submissions to `/api/claims`, not `/api/cases/intake`.
2. `app/api/claims/route.ts` requires steward-level access for POST. That means the member self-serve page is misaligned with the route it calls.
3. The same page uploads supporting documents to `/api/upload`, which is not a case evidence endpoint.
4. `components/file-upload.tsx` repeats the same assumption and uses `/api/upload` for add/remove attachment behavior.

## Operational Meaning

1. Staff-side workbench and workflow controls are stronger than the member-side intake experience.
2. A CUPE pilot that depends on member self-service case intake and evidence upload will not be trustworthy without rewiring.
3. A steward-assisted pilot can still produce value if staff intake is routed through the hardened case APIs.

## Required Actions Before Member-Facing Pilot

1. Rewire the new-claim page to `/api/cases/intake`.
2. Add a dedicated case-evidence upload route and stop using `/api/upload` for grievance attachments.
3. Add an end-to-end test for member submit, attachment upload, staff assignment, transition, and export.
4. Deprecate or visibly isolate the legacy `/api/claims` create path.

## Launch Position

The workflow engine itself is good enough for a controlled pilot. The currently wired member journey is not.