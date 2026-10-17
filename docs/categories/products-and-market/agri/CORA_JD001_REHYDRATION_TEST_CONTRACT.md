# Cora JD001 Deere-Independent Rehydration Test Contract

**Status:** Mandatory proposed acceptance contract; no test harness or
connector is implemented by this document.  
**Test profile:** Synthetic data only; no Deere endpoint, credentials,
operator account, or live farm record.

## Purpose

Demonstrate that a rights-cleared continuity capsule can be interpreted and
verified independently of both Cora and Deere. The test is intentionally
offline. It does not test Deere API behavior, establish source rights, or
prove a production recovery objective.

## Fixture and test conditions

Use fabricated organizations, subjects, field-like identifiers, timestamps,
values, scopes, and operations that cannot be mistaken for a real producer
record. Mark every fixture `SYNTHETIC_TEST_DATA`. The fixture must include:

- one item with a permitted payload and explicit source-attribution metadata;
- one normalized/derived item with input reference and declared mapping
  version;
- one source reference without payload, to exercise `SOURCE_UNAVAILABLE`;
- one item with an unknown or expired rights state;
- one optional item explicitly absent; and
- one manifest with an integrity digest and a Cora packaging signature,
  clearly not represented as a Deere signature.

The independent reader must run from a clean environment with network access
disabled, no Cora service/package/runtime, no Deere SDK/client/token, no
provider credentials, and no hidden Cora-only key or database. If authorized
payload encryption requires a separately managed decryption key, test the
documented key handoff independently and keep the key out of the capsule.

## Required test cases

| ID  | Test                                                                           | Expected result                                                                                                        |
| --- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| R1  | Parse valid synthetic manifest and payload offline.                            | `REHYDRATED_VERIFIED`; exact declared values, namespaces, scope, time, versions, and status states are visible.        |
| R2  | Verify every mandatory manifest item and digest.                               | Completeness and provenance coverage meet the hard gates in the architecture; no dropped or silently rewritten values. |
| R3  | Parse using a separately built reader with no Cora dependency.                 | Reader can interpret the documented format; no Cora-only service or database call occurs.                              |
| R4  | Modify one payload byte without updating the manifest digest.                  | `BLOCKED_INTEGRITY`; no content is presented as verified.                                                              |
| R5  | Remove a mandatory item or manifest entry.                                     | Completeness gate fails; no `REHYDRATED_VERIFIED` result.                                                              |
| R6  | Change a mandatory item to an unknown schema version.                          | `BLOCKED_SCHEMA`.                                                                                                      |
| R7  | Include `UNKNOWN`, `EXPIRED`, or `NOT_AUTHORIZED` rights for required content. | `BLOCKED_RIGHTS`; no fallback to operator consent or a technical match.                                                |
| R8  | Attempt to resolve the source-reference-only item with network disabled.       | `SOURCE_UNAVAILABLE`; no source call or inferred current value.                                                        |
| R9  | Change subject namespace, recipient, purpose, or organization scope.           | `BLOCKED_SCOPE`; no cross-organization identity substitution.                                                          |
| R10 | Rehydrate a valid but old snapshot without source verification.                | `STALE_OR_CURRENTNESS_UNKNOWN`; integrity success is not freshness.                                                    |
| R11 | Inspect the capsule and all logs/artifacts for credentials and secrets.        | Zero secrets or tokens in capsule, test output, logs, and fixtures.                                                    |
| R12 | Verify package signer and source-attribution metadata.                         | Cora package attestation is reported as packaging provenance only; no Deere source signature is claimed.               |
| R13 | Produce the report after every injected fault.                                 | Explicit failure state, item IDs, and reason; no success-shaped empty or partial payload.                              |

## Measurements and hard gates

The report must show raw numerators and denominators:

- authorized-content completeness: 100% of mandatory permitted fixture items;
- provenance coverage: 100% of required provenance fields, with unknowns
  explicitly counted and not treated as successful;
- semantic fidelity: 100% of mandatory synthetic concepts interpreted with
  declared schema and no undocumented transformation;
- reference integrity: 100% resolved locally or explicitly unavailable;
- rights coverage: 100% for every mandatory content/action in the positive
  path; and
- independent-reader portability: pass with network disabled and no Cora or
  Deere dependency.

Any missed hard gate fails acceptance. There is no weighted average by which
a rights or integrity failure can be compensated by a successful parse.

Record the version of the capsule contract, reader, fixture, test runner,
integrity algorithms, and each observed result. Do not include real operator
data or secrets in the report.

## Limits of a passing result

A pass proves only that the synthetic capsule profile can be exported,
integrity-checked, and interpreted independently under the tested
conditions. It does not prove:

- Deere supports any specific object, endpoint, identifier, schema, or
  verification method;
- Cora or an operator has permission to access, retain, derive, export,
  reuse, or disclose Deere data;
- the capsule is complete relative to a live Deere account;
- the source assertion is true, current, legally authoritative, or accepted
  by an institution;
- a receiving institution will rely on the evidence; or
- any production RTO/RPO or operational recovery target has been met.

The test is a mandatory design acceptance gate in the
[Cora data sovereignty and continuity architecture](CORA_DATA_SOVEREIGNTY_AND_CONTINUITY_ARCHITECTURE.md).
