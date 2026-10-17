# Cora JD001 Adversarial Architecture Review

**Status:** Design-time threat review of `JD001`; no Deere connector or data
path exists by virtue of this review.  
**Review scope:** Data sovereignty, continuity, identity, rights, and
cross-boundary failure modes.

## Assumptions and limits

This review assumes no Deere API behavior, account permissions, provider
terms, or source data. The public developer documentation routes identified
in the [JD001 reference architecture](CORA_JD001_REFERENCE_CONNECTOR_ARCHITECTURE.md)
did not expose enough reviewed content to assert exact operations or
semantics. Findings below are threats to any future implementation, not
claims of current exposure.

The retrieved public API Development License Agreement is not treated as
accepted by Cora, current, or applicable to production. Its displayed terms
restrict use to internal development/testing, restrict storage and
distribution of Deere Content, and require a separate Production Agreement
before third-party release. The text's literal placeholder and lack of a
visible version/effective date make current applicability an explicit
legal-review trigger; neither technical access nor operator authorization
would resolve that rights question.

Severity describes potential impact if a future connector exists:
`CRITICAL` blocks implementation until designed and tested; `HIGH` requires
mitigation before any real-data pilot; `MEDIUM` requires a tracked control
before production; `LOW` requires a documented operational safeguard.

## Threat scenarios

| ID  | Severity | Adversarial scenario                                                                                                                                                                          | Required defense and acceptance evidence                                                                                                                                                                                                              | Residual risk                                                                                                                               |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | CRITICAL | A valid Cora login or OAuth token is treated as permission to export Deere records or share them with another institution.                                                                    | Separate canonical Cora authorization, source rights, operator authorization, and recipient-purpose decision; deny by default. Test absent/expired/wrong-recipient rights.                                                                            | Rights can change after an export; revocation/deletion obligations need an enforceable ledger and process.                                  |
| T2  | CRITICAL | A connector maps a Deere organization or subject to the wrong Cora/Agrimo organization, exposing another operator's records.                                                                  | Provider-namespaced IDs, explicit org/subject binding, server-derived `orgId`, same-org checks at all layers, ambiguity quarantine. Test deliberate ID collision and cross-org references.                                                            | Provider identity semantics remain unverified until current official docs and real authorization are reviewed.                              |
| T3  | CRITICAL | A pointer-only capsule is advertised as independent continuity, but source access is revoked or the source is unavailable.                                                                    | Label pointer-only items; return `SOURCE_UNAVAILABLE`; require portable authorized payload for a true offline recovery claim. Pass R8 in the Deere-independent test.                                                                                  | Payload export may not be permitted; continuity may be limited to provenance and explicit loss of recoverability.                           |
| T4  | CRITICAL | A stale, suspended, corrected, or expired source assertion appears current because a snapshot parses or a cached status is reused.                                                            | Preserve observation/effective times and source validity semantics; separate integrity from freshness; fail closed on unknown currentness. Test R10 and stale-state UI/consumer contract.                                                             | Without an approved source verification method, current status cannot be guaranteed after capture.                                          |
| T5  | HIGH     | A forged or modified payload is accepted because Cora packaging is confused with a Deere issuer signature.                                                                                    | Bind manifest and content integrity; distinguish provider-signed assertion from Cora packaging attestation; validate signatures only against documented trust roots. Test R4/R12.                                                                     | Cryptographic integrity cannot establish source truth or issuer authority by itself.                                                        |
| T6  | HIGH     | Schema drift, unit changes, timezone differences, or changed enum semantics corrupt operational meaning during normalization.                                                                 | Pin schema versions; preserve originals and units; version transformations; quarantine unknown mandatory versions; test R6 and round-trip semantic fidelity.                                                                                          | Provider change notices or historical schema access may be incomplete; source docs are not yet reviewed.                                    |
| T7  | HIGH     | A confused-deputy or replay attack uses a valid operator grant for a broader recipient/purpose or a previous consent window.                                                                  | Bind each disclosure to actor, subject, org, purpose, recipient, fields, period, and one event; check current revocation; idempotency plus audit.                                                                                                     | Some external revocation signals may be delayed or unavailable; must be stated in the authorization model.                                  |
| T8  | HIGH     | A source credential leaks through logs, retries, diagnostic metadata, capsule contents, or test fixtures.                                                                                     | Opaque credential references, least privilege, secret-safe redaction, no secret serialization, rotation/revocation, and automated secret scans. Test R11.                                                                                             | Operational misconfiguration and privileged insider access remain; independent monitoring and response are required.                        |
| T9  | HIGH     | A malicious or compromised provider account submits oversized, malformed, duplicate, or cross-tenant payloads.                                                                                | Schema validation, size limits, org-scoped quarantine, rate limits, idempotency, signature validation where documented, and safe error reporting.                                                                                                     | Source-side compromise may produce validly authenticated false content; recipient/source accountability remains necessary.                  |
| T10 | HIGH     | Provider outage, revocation, or API discontinuation makes Cora appear operationally complete while required records are missing.                                                              | Explicit partial/unavailable states, manifest completeness, degraded-mode rules, tested independent export, connector-specific RTO/RPO before operations.                                                                                             | If rights prohibit retaining payloads, there may be no lawful independent restoration of source data.                                       |
| T11 | MEDIUM   | Cora's private mapping engine or identifier semantics create vendor captivity despite an export feature.                                                                                      | Publicly documented capsule manifest, open reader, no Cora-only runtime, measured dependency flags, independent R3/R8 test.                                                                                                                           | Some provider semantics may be non-portable even when file syntax is open; report loss rather than conceal it.                              |
| T12 | MEDIUM   | Deletion or revocation is claimed but copies persist in caches, analytics, replicas, logs, or backups.                                                                                        | Data inventory, expiry/deletion propagation, backup retention evidence, audit of completion and exceptions.                                                                                                                                           | Immutable audit evidence and legal holds may require a separate, documented minimization/retention basis.                                   |
| T13 | MEDIUM   | A matching source value is presented as an institutional approval, insurance determination, or operational instruction.                                                                       | Label source assertion, technical resolution, and each institution's decision separately; prohibit Cora-generated adjudication.                                                                                                                       | Downstream users may still over-interpret; interface and recipient contracts need human-factors review.                                     |
| T14 | LOW      | Documentation-route names are mistaken for evidence of live API support or a Deere partnership.                                                                                               | Keep the capability matrix state `DOC_ROUTE_IDENTIFIED`; require official, versioned technical and legal evidence at the appropriate gates.                                                                                                           | Marketing or third-party material can still be misquoted; claims need controlled review.                                                    |
| T15 | CRITICAL | The displayed development license is treated as permission to retain or disclose Deere Content in a third-party or production workflow.                                                       | Verify current applicable terms and obtain written production rights for the exact data, purpose, retention, derived use, export, recipient, and commercial use before any such action. Do not treat the displayed development license as sufficient. | The public text's version/effective date and applicability to Cora are unverified; no production agreement or rights record is established. |
| T16 | CRITICAL | Disconnect, access revocation, source-record deletion, account closure, agreement termination, and product discontinuation are treated as one event with an assumed common retention outcome. | Obtain event-specific contractual rules for future access, deletion, permitted historical retention/use, backups, audit evidence, and downstream copies. Keep each event and each operation distinct; fail closed on an unanswered event/action pair. | No event-specific deletion or post-disconnect retention semantics are established.                                                          |
| T17 | CRITICAL | Producer consent is treated as a grant of Deere contractual permission, or Deere permission is treated as recipient acceptance.                                                               | Preserve four independent authorities: producer authorization, Deere contractual/API permission, Cora governance, and receiving-institution authorization. Require each for its own actions and purposes.                                             | No producer grant, Deere production terms, or recipient authorization exists for JD001.                                                     |

## Architecture challenge

The phrase **“Integrate deeply. Preserve independently. Rehydrate openly.”**
is not a claim that every source payload can or should be copied. Each verb
has a distinct gate:

- **Integrate deeply:** requires documented source capability, identity
  semantics, operator authorization, and source rights for each operation.
- **Preserve independently:** requires lawful retention/export and a
  demonstrable portable representation. A backup pointer alone is
  insufficient.
- **Rehydrate openly:** requires a documented independent parser and
  permissible content; it cannot manufacture missing source records or
  restore source currentness.

If provider terms or law prohibit portable copies, the architecture must
reduce scope or stop. It must not weaken terms, scrape, reverse engineer, or
claim continuity from a source ID. If a recipient requires direct source
verification, treat that as a separate source-access architecture and rights
review; do not conceal it as “rehydration.”

Any Deere continuity discussion is limited initially to the conceptual
`Organization → Farm → Field → Boundary` slice and minimum identity,
provenance, timestamps, relationships, units, and source-state metadata.
Machine telemetry, full operation history, work plans, prescriptions, and
other higher-risk classes are excluded unless later shown necessary and
separately authorized. A historical copy must never be labelled
`CURRENTLY_CONFIRMED_BY_SOURCE` without a supported current-source check;
preserve `HISTORICALLY_CAPTURED` as a distinct state.

## Required closure before any real-data pilot

- Resolve all CRITICAL threats with evidence-backed controls and passing
  synthetic test cases.
- Resolve HIGH threats or document a specific accountable exception before
  the pilot is authorized.
- Complete the current technical and rights review in the
  [capability/rights matrix](CORA_JD001_CAPABILITY_RIGHTS_MATRIX.md).
- Pass the [Deere-independent rehydration test](CORA_JD001_REHYDRATION_TEST_CONTRACT.md).
- Obtain separate approval for the exact environment, subject cohort,
  fields, purpose, recipient, retention, audit, monitoring, recovery, and
  rollback.

No exception may turn a missing source right into an accepted risk. Until the
gates are met, `JD001` remains `REFERENCE_ONLY_NOT_IMPLEMENTED`.
