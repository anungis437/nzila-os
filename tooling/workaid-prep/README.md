# tooling/workaid-prep

Isolated, synthetic-only preparation harness for the WorkAid specialization of Union Eyes.
It is **not** part of any build, not a workspace package, and nothing in the operational
application imports it. Mission `UE-WORKAID-PREP-20261023`; branch `agents/workaid-prep-20261023`.

## What it is

Pure, deterministic TypeScript contracts (no I/O, injected clocks) and executable synthetic
tests for: referral completeness, urgent exceptions, referral lifecycle, the claim / decision /
issue / objection graph, cross-employer disclosure, acceptance vs access vs WSIB authorization,
document disclosure and holds, outbound submission states and forbidden transitions, receipt
follow-up tasks, reminder idempotency, human-confirmed deadline obligations, deny-by-default
member publication, authority revocation cascade, uploads, audit, and the Clio coexistence
contract. Slice C adds a composed synthetic `World` (`src/journey.ts`, `src/journey-views.ts`) driving
four persona journeys and cross-persona challenges, a separate filing-validity contract
(`src/filing.ts`) and a tribunal-assessment boundary (`src/tribunal.ts`). `src/platform-repro/` holds
reference reproductions of platform defects that are **routed to the platform owner**; nothing here
patches the platform.

## What it is not

- No Clio connector, no automatic writeback, no WSIB/WSIAT filing, no database, no network.
- No real people, unions, claim numbers or documents. Every identifier is fabricated.
- Not evidence of runtime behaviour. A passing test closes no runtime gate.

## Run

No installation is needed (Node 24 strips types natively). Run only from the isolated worktree on an
`agents/workaid-prep*` branch: every script calls `preflight()` and writes only through
`scripts/guard.ts`, which refuses any path outside `docs/union-eyes/workaid/`, `tooling/workaid-prep/`
and the OS temp directory, and any other worktree. From this directory:

```powershell
node --test test/*.test.ts                  # run the suite (writes nothing)
node scripts/run-tests.ts                   # run and record evidence/test-results.json and evidence/journey-trace.json
node scripts/build-baseline.ts              # regenerate 02, 08, 09, 18, the v0.3 matrix and the findings register
node scripts/validate-docs-sandboxed.ts     # run the repository document validator in a temp sandbox
```

Static check. The worktree has no installation, so TypeScript comes from another checkout's
`node_modules`, read-only. The script refuses to run without the variable, uses `--noEmit
--incremental false` and verifies the worktree is unchanged afterwards:

```powershell
$env:WORKAID_NODE_MODULES = '<path-to>\node_modules'; node scripts/typecheck.ts
```

`tsconfig.json` is local to this folder and extends nothing. Never run the repository's `validate:docs`
directly: it derives its output directory from the working directory.

## Layout

| Path | Purpose |
|---|---|
| `src/` | Domain contracts (see `docs/union-eyes/workaid/03_DOMAIN_MODEL_AND_STATES.md`) |
| `src/platform-repro/` | Reproductions for Codex; reference detector, search order, storage policy |
| `test/` | Executable synthetic tests; test titles carry `[WA-T###]`, `[WA-ADV-##]`, `[WA-INT-###]` tags |
| `scripts/` | Guard, test runner, source parsers, triage overlay, requirements, baseline builder, sandboxed validator, guarded type-check |

Test titles are the evidence link: a tag in a title is the only way a test is credited to a matrix
case, adversarial case or finding.

## Isolation

`test/isolation.test.ts` asserts that every path changed relative to the verified base commit is
under `docs/union-eyes/workaid/` or `tooling/workaid-prep/`.
