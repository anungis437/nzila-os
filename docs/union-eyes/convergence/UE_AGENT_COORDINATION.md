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
| Integrated Cursor commits | None |

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

## Integration

Before accepting a Cursor handoff, prove `fde81a81a088a1c8c4aa6d498b2b3a52e0dea298` is an ancestor of the Cursor tip and review only `git diff fde81a81a088a1c8c4aa6d498b2b3a52e0dea298...<cursor-tip>`. The Git merge base against `origin/main` stays `0c994b968aed0657cca5b702954ba87252408245` and is a different range. Overlap is resolved by preserving the canonical contract. Use a conflict-free cherry-pick or a controlled merge. After integration, rerun the affected tests, kernel authorization proofs, this ownership ratchet, schema validation, and the relevant database suite. Record the Cursor commit IDs in the convergence register.

`UE_SAAS_OPERATIONAL_READINESS` stays `NO_GO`. This coordination does not authorize staging or production deployment.
