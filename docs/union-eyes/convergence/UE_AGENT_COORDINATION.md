# Union Eyes agent coordination

This record is the lane contract for two engineering branches and one integration owner.

| Field | Value |
| --- | --- |
| Integration branch | `agents/ue-final-convergence` |
| Cursor branch | `agents/ue-cursor-documents-convergence` |
| Git merge base against `origin/main` | `0c994b968aed0657cca5b702954ba87252408245` |
| Cursor development baseline | `fde81a81a088a1c8c4aa6d498b2b3a52e0dea298` |
| Integration HEAD | The moving tip of `agents/ue-final-convergence`. Later integrator commits are not part of Cursor's review range. |
| Architectural authority | The integration branch. Cursor's branch is an implementation source. |
| Integrated Cursor commits | Tranche 1: `38e002e54ae2866a567b4d48d00d386dfe149091` and `74aed8ec9bc44d6306918c0056c5a4c788b64b7f` (integration commits `34c1222bf6daec9579e788f1c1b8093420650962` and `146da419fa88e4203e488cdcabfd19c0ae161888`); integrator corrections `b56f71bd095bb8f91b6146b97fbd20665451ab28`. Tranche 2 is isolated and IN_PROGRESS. |

The machine-readable list is [`UE_AGENT_COORDINATION.json`](UE_AGENT_COORDINATION.json). The integration register is [`UE_CONVERGENCE_REGISTER.json`](UE_CONVERGENCE_REGISTER.json).

## Cursor's exclusive lane

Cursor retires the legacy document API, migrates document consumers onto the canonical repository contract, and edits document-facing UI components. The editable paths are the `cursorMayEdit` array. They cover:

- `/api/documents` legacy routes, excluding `/api/documents/repository`
- portal, signature, external-document, and CBA document routes
- `app/[locale]/dashboard/documents` and `components/documents`
- the legacy `document-service` module and the SharePoint document adapter

## Shared contracts Cursor consumes

Cursor does not edit `cursorMustConsumeWithoutEditing`. That set includes the repository routes, `documents-schema`, document authorization, governance, retention, blob integrity, storage, external grants, case-related document selection, precedent documents, case authorization, the capability registry, and the ontology matrix.

Case, member, grievance, committee, exit-interview, and arbitration document routes stay on the integrator lane because they are case-kernel surfaces. A document-consumer change inside one of those files is a contract gap. The integrator makes the canonical change and Cursor consumes it.

Schema, migrations, the architecture and ontology ledgers, route ratchets, finance, WorkAid, identity revocation, and governance remain integrator-owned.

## Tranche 1 integration

Cherry-picked in order onto the integration branch with the original source SHAs kept as provenance. The integrator then corrected the candidate (B1 mandatory download audit, B2 legacy storage URLs, B3 bulk downloads, B4 document versions, B5 retention semantics) in `b56f71bd095bb8f91b6146b97fbd20665451ab28`. The corrected paths are listed in `integratorCorrectedPaths`; Cursor rebases onto that commit before editing them. Signed-in browser acceptance is not done; jsdom evidence is not substitute for it.

## Reserved canonical contracts for tranche 2

`reservedCanonicalContracts` lists four contracts the integrator owns and Cursor consumes: short-lived ownership-bound intake cleanup, OCR processing authority, durable audit of unlinked document creation, and governed reviewed-transcript writes. Cursor does not implement them. Tranche 2 is not integrated until its two P0 findings are corrected on the Cursor branch and the reserved contracts it depends on are published and consumed.

## Integration

Before accepting a Cursor handoff, prove `fde81a81a088a1c8c4aa6d498b2b3a52e0dea298` is an ancestor of the Cursor tip and review only `git diff fde81a81a088a1c8c4aa6d498b2b3a52e0dea298...<cursor-tip>`. The Git merge base against `origin/main` stays `0c994b968aed0657cca5b702954ba87252408245` and is a different range. Overlap is resolved by preserving the canonical contract. Use a conflict-free cherry-pick or a controlled merge. After integration, rerun the affected tests, kernel authorization proofs, this ownership ratchet, schema validation, and the relevant database suite. Record the Cursor commit IDs in the convergence register.

`UE_SAAS_OPERATIONAL_READINESS` stays `NO_GO`. This coordination does not authorize staging or production deployment.
