# UE Release Readiness

Last updated: 2026-06-08
Scope: Union Eyes release only

## Release-Critical AI Surfaces

The following AI surfaces are required for UE release and are treated as hard blockers:

1. union-eyes-triage
2. platform-cognition-phase1

## Non-Blocking AI Surfaces For This Release

The following surfaces are out of scope for UE release and do not block go-live when marked DESIGN:

1. memora-companion
2. zonga-voice
3. abr-ai
4. nacp-exams-ai
5. partners-ai
6. web-ai
7. weekone-ai
8. trustcore-ai
9. trustcore-trustops-ai

## UE AI Release Exit Criteria

1. union-eyes-triage status is DEV or PROD in governance/ai/inventory.json.
2. platform-cognition-phase1 status is DEV or PROD in governance/ai/inventory.json.
3. Both required surfaces are ACCOUNTED in governance/ai/AI_VALIDATION_MATRIX.md.
4. UE runtime AI artifacts exist:
   - apps/union-eyes/app/api/ai/grievances/[id]/clause-reasoning/route.ts
   - apps/union-eyes/app/api/ai/search/route.ts
   - apps/union-eyes/lib/ai-client.ts
   - apps/union-eyes/lib/ai/ai-client.ts
5. Platform cognition runtime artifact exists:
   - packages/platform-cognition-core/src/index.ts
6. union-eyes-triage includes valid governance evidence in inventory:
   - pia path exists
   - evalDataset path exists

## Enforcement

CI enforcement is implemented in tooling/contract-tests/ue-release-readiness.test.ts.
A failure in this test means UE AI release criteria are not met.
