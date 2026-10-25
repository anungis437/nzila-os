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
| Integrated Cursor commits | All 16 commits of `fde81a81a088a1c8c4aa6d498b2b3a52e0dea298..7c17ecf7a597cbcdbc332308b24b95b3349384b0`: tranche 1 (2), tranche 2 (9) and tranche 3 (5), each cherry-picked with its source SHA kept as provenance (`integratedCursorCommitProvenance`). Integrator corrections: tranche 1 `b56f71bd095bb8f91b6146b97fbd20665451ab28`; canonical contracts and tranche 2 and 3 corrections `756abaea1`. `UE_CURSOR_DOCUMENT_INTEGRATION = PASS` is an engineering verdict only. |

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

## Tranche 2 and 3 integration and the delivered contracts

The four contracts reserved for the integrator are delivered (`reservedCanonicalContracts`, status `DELIVERED`): ownership-bound temporary intake with cleanup (`document_intakes`, `lib/documents/intake-lifecycle.ts`), OCR processing authority (kernel `case:process_ocr`, `lib/documents/ocr-authority.ts`), durable audit of every document create, and governed reviewed-transcript writes (`lib/documents/transcripts.ts`). Cursor consumes them and must not edit them; they are listed in `cursorMustConsumeWithoutEditing`. Cursor's parallel `ocr-authorization.ts` was removed. External matter downloads audit before the link, and signature provider status is judged by `lib/signature/provider-sync.ts`.

The stable intake request and response contract: `POST /api/documents/intakes` (multipart `file`, `operation`, optional `targetDocumentId`), or `POST /api/documents/upload` with `canonicalIntake=1`, answers `{ success, data: { intakeId, status, operation, targetDocumentId, filename, mimeType, size, checksum, createdAt, expiresAt } }` and never a storage path. `POST /api/documents/repository` and `POST /api/documents/repository/[id]/versions` take `intakeId`. `POST /api/documents/intakes/[id]/cancel` cancels an open intake.

The engineering evidence, residual issues and the exact external activation prerequisites are in [`UE-CURSOR-DOCUMENT-INTEGRATION-EVIDENCE.md`](UE-CURSOR-DOCUMENT-INTEGRATION-EVIDENCE.md).

## Integration

Before accepting a Cursor handoff, prove `fde81a81a088a1c8c4aa6d498b2b3a52e0dea298` is an ancestor of the Cursor tip and review only `git diff fde81a81a088a1c8c4aa6d498b2b3a52e0dea298...<cursor-tip>`. The Git merge base against `origin/main` stays `0c994b968aed0657cca5b702954ba87252408245` and is a different range. Overlap is resolved by preserving the canonical contract. Use a conflict-free cherry-pick or a controlled merge. After integration, rerun the affected tests, kernel authorization proofs, this ownership ratchet, schema validation, and the relevant database suite. Record the Cursor commit IDs in the convergence register.

`UE_SAAS_OPERATIONAL_READINESS` stays `NO_GO`. This coordination does not authorize staging or production deployment.
