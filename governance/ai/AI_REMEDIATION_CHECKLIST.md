# AI Remediation Checklist

Last updated: 2026-06-07
Input source: [AI_VALIDATION_MATRIX.md](AI_VALIDATION_MATRIX.md)

## Prioritized Queue

| Priority | Surface ID | Owner | Gap Type | Target |
| --- | --- | --- | --- | --- |
| None | None | None | No active ACCOUNTED-ATTENTION surfaces | N/A |

## Resolved Items

### zonga-voice

Resolution date: 2026-06-07
Owner: Zonga Lead
Resolution: Surface reconciled from DEV to DESIGN in [inventory.json](inventory.json), with planned entrypoint retained as metadata and matrix status moved to ACCOUNTED-DESIGN.

Follow-up for launch:
1. Implement `apps/zonga/app/api/voice-upload/route.ts` using governed [../../apps/zonga/lib/ai-client.ts](../../apps/zonga/lib/ai-client.ts).
2. Move inventory status from DESIGN to DEV only after runtime endpoint and tests are in place.

### web-ai

Resolution date: 2026-06-07
Owner: Web Lead
Resolution: Surface reconciled from DEV to DESIGN in [inventory.json](inventory.json) after implementation evidence pass found no governed AI runtime or wiring artifacts.

Follow-up for launch:
1. Add governed wiring at `apps/web/lib/ai-client.ts` or equivalent documented path.
2. Add a concrete runtime AI endpoint/action and validate with tests before moving to DEV.

### weekone-ai

Resolution date: 2026-06-07
Owner: WeekOne Lead
Resolution: Surface reconciled from DEV to DESIGN in [inventory.json](inventory.json) after implementation evidence pass found no governed AI runtime or wiring artifacts.

Follow-up for launch:
1. Add governed wiring at `apps/weekone/lib/ai-client.ts`.
2. Add a concrete runtime AI endpoint/action and validate with tests before moving to DEV.

### trustcore-ai

Resolution date: 2026-06-07
Owner: TrustCore Lead
Resolution: Surface reconciled from DEV to DESIGN in [inventory.json](inventory.json) after evidence pass showed no runtime AI entrypoint consuming governed wiring.

Follow-up for launch:
1. Add concrete runtime AI entrypoint(s) under trustcore runtime tree.
2. Ensure entrypoint imports [../../apps/trustcore/lib/ai-client.ts](../../apps/trustcore/lib/ai-client.ts).
3. Move inventory status from DESIGN to DEV only after runtime tests are in place.

### trustcore-trustops-ai

Resolution date: 2026-06-07
Owner: TrustCore TrustOps Lead
Resolution: Surface reconciled from DEV to DESIGN in [inventory.json](inventory.json) after evidence pass showed no runtime AI entrypoint consuming governed wiring.

Follow-up for launch:
1. Add concrete runtime AI entrypoint(s) under trustcore-trustops runtime tree.
2. Ensure entrypoint imports [../../apps/trustcore-trustops/lib/ai-client.ts](../../apps/trustcore-trustops/lib/ai-client.ts).
3. Move inventory status from DESIGN to DEV only after runtime tests are in place.

## web-ai

Owner: Web Lead
Current gap: Inventory describes lazy/RSC AI surface; no clear wiring module or runtime artifact found.

Actions:
1. Introduce app-level wiring module at `apps/web/lib/ai-client.ts` or formally document alternate governed path.
2. Add at least one runtime AI entrypoint (route action/server action) and reference it in inventory notes.
3. Add smoke test for the selected runtime entrypoint.

Acceptance criteria:
1. Governed wiring artifact exists and is imported by runtime code.
2. Inventory notes explicitly point to real runtime evidence.
3. Validation matrix status can move from ACCOUNTED-ATTENTION to ACCOUNTED.

## weekone-ai

Owner: WeekOne Lead
Current gap: Inventory entry exists, but wiring/runtime artifacts are not obvious in app code.

Actions:
1. Add explicit wiring at `apps/weekone/lib/ai-client.ts` if AI is live.
2. Add runtime AI route/action and inventory evidence link.
3. If AI is not active yet, downgrade status to DESIGN in [inventory.json](inventory.json).

Acceptance criteria:
1. Either DEV with concrete wiring+runtime evidence, or DESIGN with no false-live claims.
2. Matrix row no longer carries unresolved attention note.

## trustcore-ai

Owner: TrustCore Lead
Current gap: Wiring modules exist but no formal runtime AI surface path is documented.

Actions:
1. Identify and document canonical runtime entrypoint(s) in inventory metadata.
2. If missing, implement an explicit AI route/action under the app runtime tree.
3. Add contract test asserting the runtime entrypoint exists and imports governed AI wiring.

Acceptance criteria:
1. Runtime AI path is discoverable from inventory and exists.
2. Contract test guards against drift.
3. Matrix row moves to ACCOUNTED.

## trustcore-trustops-ai

Owner: TrustCore TrustOps Lead
Current gap: Wiring modules exist but no formal runtime AI surface path is documented.

Actions:
1. Identify or implement canonical runtime AI entrypoint(s).
2. Update inventory to include concrete entrypoint notes.
3. Add app-level smoke test for AI path.

Acceptance criteria:
1. Runtime AI path exists and is linked from governance inventory.
2. Matrix row moves to ACCOUNTED.

### abr-ai

Resolution date: 2026-06-07
Owner: ABR Lead
Resolution: Surface reconciled from DEV to DESIGN in [inventory.json](inventory.json) because no governed runtime entrypoint currently consumes AI wiring.

Follow-up for launch:
1. Add governed runtime AI endpoint/action path and tests.
2. Move inventory status from DESIGN to DEV after runtime evidence exists.

### nacp-exams-ai

Resolution date: 2026-06-07
Owner: NACP Lead
Resolution: Surface reconciled from DEV to DESIGN in [inventory.json](inventory.json) because no governed runtime entrypoint currently consumes AI wiring.

Follow-up for launch:
1. Add governed runtime AI endpoint/action path and tests.
2. Move inventory status from DESIGN to DEV after runtime evidence exists.

### partners-ai

Resolution date: 2026-06-07
Owner: Partners Lead
Resolution: Surface reconciled from DEV to DESIGN in [inventory.json](inventory.json) because no governed runtime entrypoint currently consumes AI wiring.

Follow-up for launch:
1. Add governed runtime AI endpoint/action path and tests.
2. Move inventory status from DESIGN to DEV after runtime evidence exists.
