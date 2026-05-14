# Union Eyes Mobile Field Readiness

## Verdict

GO WITH RESTRICTIONS.

Union Eyes is mobile-aware in product design, but the mobile-critical case submission path is not trustworthy enough yet for a live CUPE rollout. The UI supports voice capture, attachment handling, and a responsive dashboard, but the backend wiring behind those features is the limiting factor.

## Strengths

1. The new-claim experience is clearly designed for field use, including voice transcription and document uploads.
2. The dashboard and public flows have at least basic Playwright coverage.
3. The workbench console suggests a usable staff-side coordination model once cases are in the system.

## Gating Risks

1. Mobile claim submission still posts to `/api/claims`, not the hardened intake route.
2. Mobile attachment handling still posts to `/api/upload`, which is not a case evidence endpoint.
3. Voice transcription enriches the wrong intake path, so the mobile convenience layer is built on an unreliable submission flow.
4. There is no authenticated end-to-end test proving a mobile-style intake, attachment, and acknowledgment cycle.

## Pilot Recommendation

1. Treat mobile field capture as staff-assisted only until the API wiring is corrected.
2. Allow mobile viewing and workbench triage for staff, not member self-serve evidence submission.
3. Add one high-value Playwright flow for phone-width member intake after rewiring.

## Launch Position

The interface direction is good. The live mobile intake path is not ready to be trusted by members yet.
