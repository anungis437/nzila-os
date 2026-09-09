# Union Eyes Storage Authority Census (round 38)

Generated: 2026-09-09T13:33:33.558Z

CANDIDATES ONLY — this report never rewrites the manifest. Every disposition below must be
independently reviewed and applied by hand to the relevant db/rls-storage-authority/*.ts domain file.

Total NEEDS_REVIEW entries scanned: 1

## Candidate classification counts

- LATENT_UNREACHABLE (Lane A — Dead, high confidence): 0
- CONTAINED_NO_AUTHORITY (Lane B — Contained, high confidence): 0
- Still NEEDS_REVIEW (requires deep review): 1

## Cohort counts

- COMPLEX:user:HIGH: 1

## High-confidence candidates (Lane A + Lane B)

| table | candidate | confidence | evidence |
|---|---|---|---|

## Remaining NEEDS_REVIEW, grouped by cohort lane (for batched deep review)

### COMPLEX (1)

| table | blocker |
|---|---|
| strike_fund_disbursements | ambiguous shape — needs manual review |

## Advisory evidence fields

These fields are generated evidence only. They do not rewrite candidate classifications.

| table | operations | reachability | auth evidence | org evidence | mutation boundary |
|---|---|---|---|---|---|
| strike_fund_disbursements | INSERT, SELECT, UPDATE | MIXED | app/api/strike-fund/dashboard/route.ts: withApi<br>app/api/strike-fund/dashboard/route.ts: explicit auth config | services/tax-slip-service.ts: organization identifier reference<br>app/api/strike-fund/dashboard/route.ts: organization identifier reference<br>backend/billing/views.py: organization identifier reference | services/tax-slip-service.ts: insert/write path<br>services/tax-slip-service.ts: update/write path<br>backend/billing/views.py: update/write path |