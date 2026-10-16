# Cora Synthetic Cross-Institutional Resolution Proof

**Status:** Synthetic technical conformance only  
**Scope:** Evidence resolution for two independently configured synthetic recipients  
**Live-source status:** None  
**Institutional acceptance:** Not demonstrated

**Accepted seam:** `SLICE_6A_CROSS_INSTITUTIONAL_RESOLUTION_PASS_WITH_LIMITATIONS`.
This record proves resolution and disposition separation, not closure of the
broader Slice 6 mission. The [Slice 6B institutional reuse proof](CORA_INSTITUTIONAL_EVIDENCE_REUSE_SLICE_6.md)
adds governed reuse-event qualification, reconstruction avoidance, internal
reuse/friction measurement and the continuity-support / issuer-assertion
authority boundary without replacing this seam or granting live-source rights.

## Proof objective

Verify that a stable evidence reference and exact version can be evaluated
against two separate synthetic recipient requirements, with independently
scoped disclosure authorization, mapping versions, technical results, and
recipient-owned dispositions.

## Synthetic scenario

| Property                 | Synthetic context A                    | Synthetic context B                    |
| ------------------------ | -------------------------------------- | -------------------------------------- |
| Evidence reference       | `synthetic-evidence-001`, version `v1` | `synthetic-evidence-001`, version `v1` |
| Requirement              | `synthetic-requirement-a`, version `1` | `synthetic-requirement-b`, version `3` |
| Purpose                  | `purpose-synthetic-recipient-a`        | `purpose-synthetic-recipient-b`        |
| Disclosure authorization | `synthetic-auth-synthetic-recipient-a` | `synthetic-auth-synthetic-recipient-b` |
| Mapping version          | `mapping-1`                            | `mapping-2`                            |
| Technical result         | `MATCHED`                              | `PARTIAL`                              |
| Synthetic disposition    | `SYNTHETIC_REVIEW_REQUIRED`            | `SYNTHETIC_DEFERRED`                   |

Both requirements evaluate the same evidence ID and version. They use separate
recipient identifiers, requirements, purposes, disclosure authorization
references, mapping versions, decision-authority references, and disposition
provenance. The technical resolver does not create a disposition; the fixture
stores the two synthetic dispositions as separate recipient-owned records.

## Rights and data boundary

The fixture explicitly sets source access, transient processing, and
disclosure to `ALLOWED` for its synthetic purposes and recipients. Persistence,
transformation, export, rehydration, deletion, and retention after disconnect
remain `UNKNOWN`. The resolver exercises disclosure authorization only; it
does not treat that as persistence, retention, export, or rehydration
authorization. Missing, mismatched, expired, or revoked disclosure
authorization fails closed.

Resolution results contain a stable evidence reference, technical state,
recipient and requirement references, authorization reference, mapping
version, reason references, and unresolved criteria. They do not contain
source claim values or source payload. The result is not a certification,
eligibility, approval, or institutional disposition.

## Verification boundary

This proof uses synthetic fixture data and local unit tests only. It establishes
no live provider capability, source freshness, source-rights grant, recipient
acceptance, operational benefit, or cross-institution evidence reuse in
production. The real second recipient remains unselected pending authorized
discovery, and all Deere and Organic Alpha rights gates remain unchanged.

## Implementation and tests

- Contracts and resolution logic: `apps/cora/lib/evidence-resolution/`
- Synthetic evidence, requirements, and dispositions:
  `apps/cora/lib/evidence-resolution/fixtures/synthetic-cross-institution.ts`
- Focused tests:
  `apps/cora/lib/evidence-resolution/resolve.test.ts`
- Normative proof boundaries:
  `CORA_FIRST_CROSS_INSTITUTIONAL_PROOF_CONTRACT.md`
