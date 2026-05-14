# Union Eyes Defensibility Assessment

## Verdict

GO WITH RESTRICTIONS.

Union Eyes has one of its strongest stories in defensibility. Audit logging, evidence pack generation, integrity hashing, and workflow-linked export logic are materially ahead of the rest of the pilot surface. The limitation is upstream trust: defensibility is only as good as the path that created the case and attached the evidence.

## Strong Signals

1. `lib/evidence-export.ts` builds a self-contained evidence pack with a seal.
2. `lib/services/defensibility-pack.ts` models timeline, audit trail, state transitions, SLA compliance, and integrity hashes explicitly.
3. `lib/workflow-engine.ts` generates defensibility packs automatically on key workflow outcomes.
4. `app/api/cases/[caseId]/export/route.ts` provides a real export path backed by audit logging.

## Limits

1. If the member intake path uses the wrong backend route, the strongest defensibility features start too late in the user journey.
2. If attachments are sent to `/api/upload`, evidence custody is ambiguous at the exact point members most care about.
3. There are multiple workflow systems in the repo, so defensibility claims must be tied to the approved pilot path, not to the whole codebase in the abstract.

## Pilot Position

1. Use defensibility as a selling point only for the approved case API workflow.
2. Do not market full chain-of-custody assurance for member-uploaded evidence until the attachment path is fixed.
3. Make sealed export verification part of go-live rehearsal.

## Launch Position

Defensibility is a real strength for Union Eyes, but only after the intake and attachment path are brought into line with it.
