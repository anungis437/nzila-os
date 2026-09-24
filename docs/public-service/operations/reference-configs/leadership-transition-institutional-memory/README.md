# Leadership Transition / Institutional Memory — reusable reference pattern

> **Internal reference configuration.** Not public copy. Not a product SKU.  
> **Not OMHRA-specific.** **OMHRA** (Ontario Municipal Human Resources Association)
> may be used only as an *example first case* of this reusable pattern. Do not
> fork SAGE/CIVIC core for a single prospect.

## What this is

A reusable **Leadership Transition / Institutional Memory** operating pattern for
public-service and institutional continuity work under the CIVIC → CLEAR → SAGE
hierarchy:

| Layer | Role in this pattern |
| --- | --- |
| **CIVIC** | Engagement framing: continuity, implementation, visibility, integrity, capacity during leadership change |
| **CLEAR** | Evidence discipline: register sources, classify authorization, claim→evidence mapping |
| **SAGE** | Governed workspace runtime: membership, roles, evidence authorization, decision records, **institutional-context choke** |

## What this is not

- Not pension, labour-relations, or HR entitlement advice
- Not a replacement for the client's own succession matrix or board pack
- Not Member365 / LRIS / HRIS product integration (see gap analysis)
- Not authorization to name a real institution in proof runs without separate approval
- Not a SAGE availability, procurement, or pilot-commercial claim
- Not a launch GO (staging B-005 still open)

## Pack index (start here)

| File | Purpose |
| --- | --- |
| **[DEMO_PATH.md](./DEMO_PATH.md)** | ~10 min FICTIONAL demo: authorized provenance + denied sensitive path |
| [institution-workspace.yaml](./institution-workspace.yaml) | Generic workspace roles (outgoing/incoming executive, ED/admin, board, reviewer, contributor, auditor) |
| [evidence-source-classes.yaml](./evidence-source-classes.yaml) | CLEAR/SAGE-aligned source classes + authorization defaults |
| [pilot-definition.md](./pilot-definition.md) | Bounded pilot template |
| [continuity-discovery.md](./continuity-discovery.md) | Continuity discovery questions (incl. why B / what changed / unresolved) |
| [continuity-matrix-extension.md](./continuity-matrix-extension.md) | Optional extension — **does not** replace client succession matrix |
| [knowledge-dependency-map.md](./knowledge-dependency-map.md) | Knowledge dependency capture template |
| [success-metrics.md](./success-metrics.md) | Baseline/after scaffold (no invented %) |
| [handoff-checklist.md](./handoff-checklist.md) | Short transition handoff checklist template |

## FICTIONAL fixtures (not real OMHRA)

| Path | Contents |
| --- | --- |
| `fixtures/leadership-transition-institutional-memory/chronology-2022-2026.json` | Synthetic 2022–2026 timeline |
| `fixtures/leadership-transition-institutional-memory/synthesis-candidates.json` | Candidates for synthesis-context tests |
| `fixtures/leadership-transition-institutional-memory/claim-register.json` | Claim → evidence → source → date → authority |

## Code choke points (in-repo)

| Primitive | Path |
| --- | --- |
| Authorization-before-context | `packages/sage-core/src/synthesis-context.ts` |
| Claim-chain filter + QA document | `packages/sage-core/src/claim-chain.ts` |
| Institutional QA aggregation | `packages/sage-core/src/institutional-context.ts` |
| Wired into list + export + API | `listSageEvidenceItems`, `generateSageExportPackage`, `POST …/institutional-context` |

## Related doctrine

- `docs/public-service/workforce-transition-and-institutional-memory.md`
- `docs/CIVIC_OCI_ALIGNMENT.md`
- `docs/public-service/clear-method-canonical.md`
- `docs/public-service/sage-workspace-canonical.md`
- `docs/public-service/operations/sage-acceptance/` (B-005, G11 manual, gap analysis)
