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
contract. `src/platform-repro/` holds reference reproductions of platform defects that are
**routed to the platform owner**; nothing here patches the platform.

## What it is not

- No Clio connector, no automatic writeback, no WSIB/WSIAT filing, no database, no network.
- No real people, unions, claim numbers or documents. Every identifier is fabricated.
- Not evidence of runtime behaviour. A passing test closes no runtime gate.

## Run

No installation is needed (Node 24 strips types natively). From this directory:

```powershell
node --test test/*.test.ts                  # run the suite
node scripts/run-tests.ts                   # run and record docs/union-eyes/workaid/evidence/test-results.json
node scripts/build-baseline.ts              # regenerate 02, 08, 09, the v0.2 matrix and the findings register
```

Static check (uses a TypeScript already present in the main checkout; adds nothing):

```powershell
<path-to>\node_modules\.bin\tsc.cmd -p tsconfig.json --typeRoots <path-to>\node_modules\@types
```

`tsconfig.json` is local to this folder and extends nothing.

## Layout

| Path | Purpose |
|---|---|
| `src/` | Domain contracts (see `docs/union-eyes/workaid/03_DOMAIN_MODEL_AND_STATES.md`) |
| `src/platform-repro/` | Reproductions for Codex; reference detector, search order, storage policy |
| `test/` | Executable synthetic tests; test titles carry `[WA-T###]`, `[WA-ADV-##]`, `[WA-INT-###]` tags |
| `scripts/` | Test runner, source parsers, triage overlay, requirements, baseline builder |

Test titles are the evidence link: a tag in a title is the only way a test is credited to a matrix
case, adversarial case or finding.

## Isolation

`test/isolation.test.ts` asserts that every path changed relative to the verified base commit is
under `docs/union-eyes/workaid/` or `tooling/workaid-prep/`.
