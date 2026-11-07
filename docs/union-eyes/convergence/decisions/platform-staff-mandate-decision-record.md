# Union Eyes - platform-staff mandate decision record

Decision: `UE-INST-PLATFORM-STAFF-MANDATE-AUTHORITY`. State: OUTSTANDING. Status: DECISION_READY_NOT_DECIDED.

## Status of this record

A decision-ready record for the institutional decision that `DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ` and `DEF-0B10-OPL-14`'s remaining gap waits on. It states what engineering has already completed, what the kernel now structurally supports, and exactly what institutional step is still missing. It selects nothing and activates nothing: no issuance rule exists for the `platform_staff` domain, none can be drafted without an adopter who holds `executive` capacity for the platform pseudo-organization, and no such adopter exists today.

## Question

Who, institutionally, may hold `executive` capacity over platform-wide reads (the user directory, the activity feed, cross-organization statistics), and under what instrument (board resolution, officer appointment, operating policy) is that capacity conferred? The Authority Kernel's design principle is that no single customer organization's executives may issue authority reaching into every other organization's data (`lib/authority/capacity.ts`: "Federation and national officials act in a customer organization only through an explicit mandate scoped to that organization"); a platform-wide mandate needs its own, Nzila-level adoption path, not a reuse of any customer organization's.

Decision owner role: INSTITUTION_TO_BE_NAMED (Nzila's own governing body, not a customer organization). Required approval evidence: an adopted institutional decision record naming the deciding authority, its date, and the instrument, independent of the preparer. No such record exists yet.

## The two operations

| Operation | Defect | Engineering state | Remaining |
| --- | --- | --- | --- |
| `GET /api/admin/users`, `GET /api/admin/stats/activity` | DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ | PARTIAL_SOURCE_REMAINING_WORK | Institutional decision only |
| `GET /api/platform/stats` | DEF-0B10-OPL-14 | PARTIAL_SOURCE_REMAINING_WORK | Institutional decision only |

## What engineering has already completed (before this record)

Both routes already: check the canonical platform-staff identity fact (`isPlatformAdminUser`) instead of a role-title floor; run their cross-organization read and its audit row in one system transaction (`performAtomicPlatformRead`); record a denial under the caller's own organization when the fact is absent; return a masked e-mail and abbreviated name rather than the stored values; and are proven against a native PostgreSQL role, not an assumption. Settlement and per-capita figures are withdrawn from the stats response rather than computed, since the system role holds no privilege on them (a separate, already-documented finance-freeze blocker).

## What this record's own engineering adds

`lib/authority/ontology.ts`'s `MandateKind` gains a sixth value, `platform_staff`, scoped to `UE_SYSTEM_ORG_ID` (the existing system-context pseudo-organization sentinel, not a new one). Migration `db/migrations-platform/0082_platform_staff_mandate_kind.sql` widens `ue_authority_mandates_kind_chk` and `ue_authority_rule_domain_chk` to accept it. `lib/authority/issuance.ts`'s `HOLDER_CAPACITIES['platform_staff']` is an empty list on purpose: `hasCapacity()` against an empty list is always `false`, so the kernel can now represent this domain but still cannot grant it to any holder under any of the ten existing capacities, with or without an active rule. `lib/authority/__tests__/issuance.test.ts` exercises all ten capacities against a fully-formed, otherwise-valid active rule for this domain and pins that every one denies with `CAPACITY_NOT_ELIGIBLE`.

This is the full extent of what engineering can complete unilaterally: the kernel can now express "a platform-staff mandate, issued, time-bound, revocable, audited" as a data shape, through the exact same issuance, revocation, expiration and audit machinery every other mandate kind already uses (`lib/authority/store/lifecycle.ts` is kind-agnostic; nothing there needed to change). It remains permanently unusable - fails closed, denies every request - until the institutional question above is answered and a real adopter, drafter and approvers exist with a genuine `executive` capacity scoped to the platform pseudo-organization.

## What adopting this would require, once decided

1. A named instrument (Nzila bylaw, board resolution, or operating policy) establishing who holds `executive` capacity for `UE_SYSTEM_ORG_ID`.
2. A real membership row (or equivalent identity-fact source) for each named platform officer, carrying that capacity - this repository has no seeding mechanism for it today and none is added by this record.
3. A drafted, adopted (two independent named approvers, neither the drafter), and activated `ue_authority_issuance_rules` row for `platform_staff`/`issue`, following the exact same `draftIssuanceRule` -> `requestRuleAdoption` -> `activateIssuanceRule` path every other domain already uses.
4. Until all three exist, the routes continue operating exactly as they do today: authorized by the `isPlatformAdminUser` identity fact, not by an issued mandate.

## Non-decisions

This record does not: name who the platform officers are; decide whether Nzila's own governance should use the Authority Kernel at all for this purpose (a parallel, non-kernel mechanism is also a legitimate option the deciding authority may choose instead); or change `isPlatformAdminUser`, the routes, their projection, or their audit behavior.
