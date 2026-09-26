# P0.10 Documentation and Evidence Convergence

**Baseline:** `abc7e07bae4b11fcaf9c4d51a2245758ad31e9d8`

**Primary lane:** LANE-006 / PR #808 at inspected head
`9b8aaa35602fcc94b4af92d94b3036a127ec0687`

**Ruling:** `DOCUMENTATION_CONVERGENCE = REBASE_AND_REGENERATE`

PR #808 is the documentation-truth convergence source, but it is not a static
bundle that can be merged ahead of the code estate. Its inspected diff spans
234 files, including 69 documentation files reported by the PR API plus broad
index, archive, validator, and generated-report changes in the full branch
diff. It is currently behind the converged target and has one failing
governance check.

## Authority classes

Every changed artifact must be handled according to its class:

| Class | Treatment |
| --- | --- |
| Editable authority | Rebase deliberately and resolve against current catalog, doctrine, architecture, and ownership sources |
| Derived truth surface | Regenerate from the converged exact head; never hand-edit merely to settle a conflict |
| Historical evidence | Preserve content and original claim context; relocate/index if required, but do not rewrite the historical result |
| SHA/environment-bound evidence | Keep as historical evidence only; rerun to make a claim about the converged head |
| Superseded documentation | Archive or remove from current navigation according to the disposition ledger; do not restore it as current authority |
| Generated debug/test output | Exclude or archive according to repository policy; it is not architectural authority |

## Canonical precedence

Conflicts are resolved in this order:

1. machine authority and current constitutional contracts;
2. current portfolio catalog and lifecycle/deployment inventory;
3. current architecture and security ownership registries;
4. exact-head runtime, CI, and deployment evidence;
5. explanatory and commercial documentation;
6. historical evidence and archived plans.

Prose does not override machine state. A successful old run does not certify a
new head. A generated report does not become an editable source because it is
in a merge conflict.

## PR #808 integration ruling

Preserve the branch's useful structural work:

- explicit separation between repository presence and deployment/readiness;
- portfolio catalog as the editable product/GTM authority;
- current-versus-historical document disposition;
- centralized documentation indexes and audience routing;
- claim-verification rules that reject unsupported deployment/readiness
  language;
- removal or archival of bulk debug output;
- explicit Union Eyes `NO_GO` language where runtime proof is absent.

Do not carry the branch's generated outputs or readiness text verbatim across
the code convergence. In particular:

- regenerate documentation index, consistency, claim-verification, ownership,
  release-governance, secret-audit, and Union Eyes authority reports;
- recompute any unsafe-claim list against the final file topology;
- re-evaluate every Union Eyes readiness statement against the latest
  operational-readiness ruling and replacement schema/authority head;
- keep the proven GitOps fail-closed result as foundational deployment-control
  evidence, without converting it into SaaS or production readiness;
- defer the platform-admin lifecycle metadata decision until the converged
  baseline decision explicitly authorizes it.

## Other lane rules

- LANE-003 and LANE-004 documentation may explain their implementations but
  cannot publish final schema/RLS evidence until their replacement head is
  built and verified.
- LANE-008, LANE-011, LANE-027, and LANE-028 generated reports are historical
  inputs. Accepted source changes require newly generated evidence.
- LANE-012 stash evidence remains immutable history. Requirements may be
  extracted, but old PASS envelopes do not transfer to current code.
- LANE-013, LANE-014, LANE-015, LANE-016, LANE-019, and LANE-026 remain
  historical or superseded. They must not win a documentation conflict over
  current main.
- LANE-029 CourtLens evidence stays outside the Union Eyes SaaS claim set.

## Claim vocabulary

The converged docs must keep these states separate:

- implemented;
- tested locally or in CI;
- deployed to staging;
- proven on an exact staging revision;
- authorized for a bounded pilot;
- production promoted;
- commercially or operationally ready.

No implication may bridge those states without the evidence required by the
programme. The GitOps result proves the deployment proof controls and its
specific staging run; it does not prove production promotion or SaaS
readiness.

## Integration sequence

1. Finish code, migration, authority, RLS, operations, and CIVIC control
   convergence.
2. Rebase or replace PR #808 on that exact code head.
3. Resolve editable authority documents manually using the precedence above.
4. Regenerate every derived surface using repository commands.
5. Run documentation consistency, link, claim-verification, portfolio,
   governance, and evidence gates.
6. Review all added readiness/pilot/deployed language and all moved historical
   documents.
7. Merge only when the exact documentation head is green.

## Exit conditions

P0.10 can change to PASS when current authority is internally consistent,
historical evidence has not been rewritten, all derived reports match the
exact converged head, and documentation CI is green with no unsupported
readiness claim.

Until then, LANE-006 is fully accounted for but deliberately scheduled last.
