# Canonical V2 evidence persistence repair

On November 13, real-session run `43508297526` created cases successfully on
application candidate `8a0faf64cc67a8bfaef35e39f5acdda8a9ef4896`, while the
same request windows still logged `Evidence pack failed: The specified container
does not exist`. Optional pilot metrics also attempted `pilot_definitions`
queries against the V2 database.

The source establishes a deeper mismatch than a missing container. The shared
`packages/os-core/src/evidence/generate-evidence-index.ts` uploads to the
platform `evidence` container and writes platform `documents`, `audit_events`
and `evidence_pack_artifacts` models. V2's admitted storage authority instead
owns the Django `evidence_packs` and parent-owned `evidence_artifacts` models.
The document repository has a separate governed intake path and private Blob
container. Adding a Blob container would leave the incompatible database path
unfixed.

When canonical V2 is enabled, `lib/evidence.ts` now selects a native evidence
writer. It binds the supplied organization and actor to the real current
session, inserts the draft pack and actual JSON artifacts, seals it with the
existing Django-compatible checksum format, and appends mandatory canonical
audit in the same tenant transaction. The existing Django export and
`verify_seal` formats remain usable. The result truthfully identifies canonical
PostgreSQL storage; it invents no Blob, platform-document or export identifier.
The non-V2 exporter remains unchanged.

The implementation uses the already admitted schema, runtime grants and RLS.
It neither migrates tables nor changes existing data, grants, storage accounts,
containers or network rules. Artifact content records the actual supplied JSON
inside a string envelope, avoiding JavaScript/Python number-format ambiguity.
A Python-generated Unicode/checksum vector verifies interoperability locally.

The optional cross-application pilot-metrics integration now requires its
separate platform database before making a platform query in canonical V2.
Its absence remains degraded and produces no metric success claim. Canonical
audit and operational telemetry remain mandatory and independent of that
optional integration. Temporary dashboard/finance diagnostics are removed;
authorization guards and role classification are unchanged.

Source regression evidence does not close the live finding. Before acceptance,
admit the exact replacement source, rebind CHG-2026-0114, build attested images,
review a fresh no-delete what-if, use the protected staging rollout, and verify
real sealed packs/artifacts, checksums, audit and tenant denial on that candidate.
Preserve the current database and its installation receipt. No production or
financial feature implementation is authorized by this repair.
