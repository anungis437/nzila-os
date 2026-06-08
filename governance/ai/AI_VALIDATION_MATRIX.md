# AI Validation Matrix

Last validated: 2026-06-07
Validation owner: GitHub Copilot (agent execution pass)
Source of truth: [inventory.json](inventory.json)

## Surface Coverage Matrix

| Surface ID | Scope | Runtime evidence | Wiring evidence | Governance evidence | Accountability status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| console-ai | console | `apps/console/app/(dashboard)/console/ai/overview/page.tsx`, `apps/console/app/(dashboard)/console/ai/usage/page.tsx` | `apps/console/app/(dashboard)/workspace/_lib/ai-management.ts`, [../../apps/console/lib/ml-server.ts](../../apps/console/lib/ml-server.ts) | [../privacy/ai-pia/surfaces/console-rag.md](../privacy/ai-pia/surfaces/console-rag.md), [../../tooling/ai-evals/datasets/console/extract-golden.json](../../tooling/ai-evals/datasets/console/extract-golden.json) | ACCOUNTED | Console uses live AI/ML pages and DB-backed governance tables. |
| console-ai-actions | console | `apps/console/app/(dashboard)/console/ai/actions/page.tsx` | `apps/console/app/(dashboard)/workspace/_lib/ai-management.ts` | [../../tooling/ai-evals/datasets/console/adversarial-prompts.json](../../tooling/ai-evals/datasets/console/adversarial-prompts.json) | ACCOUNTED | Tier-1 DEV approval remains pending in inventory and should be advanced by governance. |
| console-ml | console | `apps/console/app/(dashboard)/console/ml/overview/page.tsx`, `apps/console/app/(dashboard)/console/ml/runs/page.tsx` | [../../apps/console/lib/ml-server.ts](../../apps/console/lib/ml-server.ts) | [inventory.json](inventory.json) | ACCOUNTED | ML surface is live and integrated with workspace operations AI panel. |
| memora-companion | memora | None (DESIGN) | None (DESIGN) | [../../tooling/ai-evals/datasets/memora/greeting-golden.json](../../tooling/ai-evals/datasets/memora/greeting-golden.json) | ACCOUNTED-DESIGN | Inventory marks DESIGN; no runtime app evidence required yet. |
| union-eyes-triage | union-eyes | [../../apps/union-eyes/app/api/ai/grievances/[id]/clause-reasoning/route.ts](../../apps/union-eyes/app/api/ai/grievances/[id]/clause-reasoning/route.ts), [../../apps/union-eyes/app/api/ai/search/route.ts](../../apps/union-eyes/app/api/ai/search/route.ts) | [../../apps/union-eyes/lib/ai-client.ts](../../apps/union-eyes/lib/ai-client.ts), [../../apps/union-eyes/lib/ai/ai-client.ts](../../apps/union-eyes/lib/ai/ai-client.ts) | [../privacy/ai-pia/surfaces/union-eyes-cognition.md](../privacy/ai-pia/surfaces/union-eyes-cognition.md), [../../tooling/ai-evals/datasets/union-eyes/triage-golden.json](../../tooling/ai-evals/datasets/union-eyes/triage-golden.json) | ACCOUNTED | UE has 22 AI API routes and governed profile-based client usage. |
| zonga-voice | zonga | None (DESIGN) | [../../apps/zonga/lib/ai-client.ts](../../apps/zonga/lib/ai-client.ts) | [../privacy/ai-pia/surfaces/zonga-voice.md](../privacy/ai-pia/surfaces/zonga-voice.md) | ACCOUNTED-DESIGN | Inventory reconciled to DESIGN with planned entrypoint until runtime voice endpoint launches. |
| platform-cognition-phase1 | package | [../../packages/platform-cognition-core/src/index.ts](../../packages/platform-cognition-core/src/index.ts) | [../../packages/platform-cognition-core/src/types.ts](../../packages/platform-cognition-core/src/types.ts) | [../privacy/ai-pia/surfaces/platform-cognition-phase1.md](../privacy/ai-pia/surfaces/platform-cognition-phase1.md) | ACCOUNTED | Package-only PROD surface is present and test-covered. |
| abr-ai | abr | None (DESIGN) | [../../apps/abr/lib/ai-client.ts](../../apps/abr/lib/ai-client.ts), [../../apps/abr/lib/ml-client.ts](../../apps/abr/lib/ml-client.ts) | [inventory.json](inventory.json) | ACCOUNTED-DESIGN | Reconciled to DESIGN until a governed runtime entrypoint consumes AI wiring. |
| cfo-ai | cfo | [../../apps/cfo/lib/actions/advisory-actions.ts](../../apps/cfo/lib/actions/advisory-actions.ts), [../../apps/cfo/lib/actions/report-actions.ts](../../apps/cfo/lib/actions/report-actions.ts) | [../../apps/cfo/lib/ai-client.ts](../../apps/cfo/lib/ai-client.ts), [../../apps/cfo/lib/ml-client.ts](../../apps/cfo/lib/ml-client.ts) | [inventory.json](inventory.json) | ACCOUNTED | Runtime usage is library-driven and uses governed SDK entrypoints. |
| flow-ai | flow | [../../apps/flow/app/api/quotes/ai/route.ts](../../apps/flow/app/api/quotes/ai/route.ts) | [../../apps/flow/lib/ai-client.ts](../../apps/flow/lib/ai-client.ts), [../../apps/flow/lib/ml-client.ts](../../apps/flow/lib/ml-client.ts) | [inventory.json](inventory.json) | ACCOUNTED | Flow has live AI quote API route and governed clients. |
| nacp-exams-ai | nacp-exams | None (DESIGN) | [../../apps/nacp-exams/lib/ai-client.ts](../../apps/nacp-exams/lib/ai-client.ts), [../../apps/nacp-exams/lib/ml-client.ts](../../apps/nacp-exams/lib/ml-client.ts) | [inventory.json](inventory.json) | ACCOUNTED-DESIGN | Reconciled to DESIGN until a governed runtime entrypoint consumes AI wiring. |
| partners-ai | partners | None (DESIGN) | [../../apps/partners/lib/ai-client.ts](../../apps/partners/lib/ai-client.ts), [../../apps/partners/lib/ml-client.ts](../../apps/partners/lib/ml-client.ts) | [inventory.json](inventory.json) | ACCOUNTED-DESIGN | Reconciled to DESIGN until a governed runtime entrypoint consumes AI wiring. |
| web-ai | web | None (DESIGN) | None (DESIGN) | [inventory.json](inventory.json) | ACCOUNTED-DESIGN | Reconciled to DESIGN until lazy/RSC runtime artifact is implemented and evidenced. |
| weekone-ai | weekone | None (DESIGN) | None (DESIGN) | [inventory.json](inventory.json) | ACCOUNTED-DESIGN | Reconciled to DESIGN pending first governed AI runtime implementation. |
| trustcore-ai | trustcore | None (DESIGN) | [../../apps/trustcore/lib/ai-client.ts](../../apps/trustcore/lib/ai-client.ts), [../../apps/trustcore/lib/ml-client.ts](../../apps/trustcore/lib/ml-client.ts) | [inventory.json](inventory.json) | ACCOUNTED-DESIGN | Reconciled to DESIGN because runtime AI entrypoints do not yet consume governed wiring. |
| trustcore-trustops-ai | trustcore-trustops | None (DESIGN) | [../../apps/trustcore-trustops/lib/ai-client.ts](../../apps/trustcore-trustops/lib/ai-client.ts), [../../apps/trustcore-trustops/lib/ml-client.ts](../../apps/trustcore-trustops/lib/ml-client.ts) | [inventory.json](inventory.json) | ACCOUNTED-DESIGN | Reconciled to DESIGN because runtime AI entrypoints do not yet consume governed wiring. |

## Agent Validation Checklist

| Check | Result |
| --- | --- |
| Every inventory surface ID appears in this matrix | PASS |
| Runtime evidence attached for DEV/PROD surfaces where available | PASS |
| Missing runtime evidence explicitly marked as ACCOUNTED-ATTENTION | PASS |
| DESIGN-only surface marked separately | PASS |
| Console workspace AI panel switched to live surfaces only | PASS |
