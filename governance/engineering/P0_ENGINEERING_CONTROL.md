# P0 engineering controls — Nzila OS

**State of this branch:** implementation candidate; NOT a production clearance, broker
authorization, or a claim that branch protection is configured. Human release
authority remains reserved by root AGENTS.md.

## Authority precedence (strict, fail closed)

1. Law, security, privacy and regulatory requirements.
2. Platform security and Agent Tool Fabric authority.
3. Repository AGENTS.md, CODEOWNERS, and required GitHub checks.
4. Product acceptance contracts and product-specific restrictions (e.g. UE Gate 0).
5. Canonical skills (procedures only; cannot grant capabilities).
6. Agent task instructions and untrusted provider text.

The machine-readable policy is \`authority-precedence.json\`. No lower-precedence
source can waive a higher-precedence control. If sources conflict, stop and
escalate to existing governance; do not choose the most permissive source.

## Enforcement beyond MCP

MCP is a transport, not a security boundary. Git, local scripts, editor
agents, APIs, CI and any future broker must all respect the same invariants.

- Tool Fabric remains **deny-only** (\`BROKER_READINESS=HOLD\`). No tool
  execution/installation may be activated until authenticated agent authority,
  durable/verifiable trust decisions, atomic evidence storage, revocation,
  sandbox isolation, constrained network, cancellation and cleanup are proven.
- The PR-classification CI job must run the P0 static guard; additional CI
  gates do not replace existing required checks.
- CODEOWNERS requires platform/security review of governed files. Code owner
  rules require repository branch protection to enforce them.
- A checked-in Cursor MCP config contains **no executable servers**.
  Developer-global MCP configuration is outside repository control and is NOT
  counted as a successful enforcement test.
- Existing external CodeSpring copies under .agents and .augment are compared
  for drift; they are NOT automatically admitted into Tool Fabric trust grants.

## Outcome lifecycle and closure authority

\`IMPLEMENTED\`: source-level fix linked to a specific issue/defect and immutable
commit. This is a development accounting state, not verified readiness.

\`VERIFIED\`: independent verifier checked evidence against the exact commit,
artifact digest, org, app, workflow and step. Runtime-minted proof is required
by \`platform-agent-workflows.executeStep\`, as is an explicit policy ALLOW.
Serialized JSON receipts are not executable authority. Verifier wiring MUST
come from a trusted host; the agent cannot supply it.

\`RELEASE_AUTHORIZED\`: distinct release/governance decision from the established
release controls and human authority. No workflow step or skill can mint it.
Evidence from any earlier stage must never be presented as a later stage.

Runtime proofs must bind the built SHA, environment, test run and artifact
digest, with freshness/revocation determined by the owning verifier. A local
type check or policy statement is not a staging deployment proof.

## Independent-verifier boundary

The new \`verifyOutcomeEvidence\` API is a **verified host adapter interface**,
not a self-authenticating distributed security service. In-process code that
is permitted to inject a malicious verifier can still fabricate an approval;
production integration requires a separately administered verifier identity,
authenticated evidence store, durable ledger and freshness checks. Until then,
any host without a trusted verifier fails closed on completion. A valid
\`WeakSet\`-minted proof is intentionally process-local and not replayable.

## Continuous checks and release gating

\`scripts/engineering/p0-static-guard.mjs\` checks structural invariants
without network access. It runs during the existing CI classification job
(the required classifier must fail if this guard fails).

This static gate cannot substitute for:
- protected-branch required status checks and code-owner reviews,
- actual tool-execution containment or production broker attestation,
- integration tests and rollback/recovery exercises,
- exact-environment runtime proof and human production approval.

Expensive full-workspace tests run once per release candidate SHA as established
in docs/architecture/VALIDATION_LEVELS.md; quick security/structural checks
continue at ordinary development cadence. Never claim tests passed when not run.

## Scope exclusions (do not mislabel as complete)

Tool Fabric broker readiness and its external authoritative dependencies remain
HOLD until independently integrated. GitHub branch-protection settings cannot
be inferred from files in this repository; an administrator must verify them.
Neither the existence of this file nor CI YAML activates required status checks.

## Reference pattern

Agora-style progressive disclosure is adapted to product and engineering
workflows. Skills live under \`skills/nzila\`, while Tool Fabric remains the
capability and authority boundary. Skills cannot override product or platform
policy. This document and the machine policy are canonical P0 invariants.

## Additional fail-closed policy boundary

An agent-asserted `policyCheck: {result:'allow'}` has **zero authority**. The
workflow runner now also requires `verifyOutcomePolicy` to mint an unforgeable
process-local policy permit from a trusted, independently configured host
policy authority. Results are bound to organization, app, workflow, step,
policy ID, and expire within five minutes. An injected test fake is not
production authorization; deployments still require an authoritative identity
and policy resolver. Absence of that resolver denies completion.

## Production promotion integrity (additional P0 finding)

The existing `deploy-production.yml` performed existence checks for SBOM and
attestation JSON. The new verifier performs deep-canonical signature verification,
SBOM hash and content matching, exact source SHA, immutable deployment image
checks, mandatory scan results and seven-day freshness. The staging SBOM
generator no longer silently substitutes `{}` after failure.

**HOLD remains mandatory:** the staging generator currently obtains contract/SLO
PASS from command-line switches, not independently read evidence, and does not
automatically attach successful security scan reports. The production verifier
therefore refuses release until a trusted signing key and complete real
evidence are supplied. No fabricated scan outputs or self-claimed PASS allowed.
Human GitHub Environment approval is a separate requirement.


## Promotion continuity hardening — implementation candidate

The staging artifact manifest is now assembled **before** signing. Its exact raw
SHA-256 is included in the signed release attestation, together with the
staging GitHub Actions run ID. Production obtains the selected run's workflow
name, successful conclusion, branch and exact commit from GitHub; it checks
these against the release commit and re-downloads/re-verifies the same signed
artifact set **after** the human production-environment approval. The
production job cannot rely on files from the separate verification job.

The previous provenance step incorrectly represented a 40-character Git SHA
as a SHA-256 artifact digest; it now attests the downloaded SBOM file itself.
This is **SBOM provenance only**, not container-image build provenance.
The emergency staging job's previous echo-only deployment now fails closed.

**Not yet independently certified:** the staging artifact builder does not
build and publish the pinned container images, establish a deployed staging
revision, or supply independently verified runtime and scan provenance.
A signed manifest can establish integrity of recorded targets, but does not
prove that those targets were built, scanned and exercised in staging.
GitHub Environment reviewer enforcement must be verified by an administrator.
Issue #1038 remains open and production promotion remains **HOLD** until these
external proofs and the end-to-end release exercise are completed. A CI PASS
must never be interpreted as production authorization.

## P0 recurring operational-documentation failures

The Ops Documentation Pack now recomputes a scoped, read-only GitHub-backed
operational snapshot **within CI**, verifies the timestamp, schema and each
metric's source or explicit `source_needed`, and preserves the resulting
snapshot as a GitHub Actions artifact. The separate scheduled ops-pack workflow
uses the same generator and verifier. Old committed snapshots remain historical
records, not artificially re-dated proof. Stale DORA and Azure Cost exports are
emitted as `null` with source-needed instructions; unavailable measurements
cannot be conjured by CI. No governance gate is skipped or downgraded.

Production release contracts distinguish **generating an attestation at build**
from **verifying and retaining exactly that signed attestation at promotion**.
The latter additionally records the signed upstream manifest and SBOM as
production evidence, so a newly generated local PASS is not substituted.

## Staging quality truth binding

The staging artifact now signs contract-test and staging SLO PASS only when
both named steps in the preceding `pre-deploy-gates` job have actually
succeeded and the job output has been transmitted to the build job. It cannot
set these PASS values solely because the generator accepts CLI flags. This
is **necessary, not sufficient** for release certification: Trivy, secrets,
image digest provenance, environment approval and other runtime assertions
remain separately required and cannot be synthesized from these two outcomes.

## Operational evidence generation reliability

CI and the standalone ops-pack workflow generate a fresh operational **assessment**
from source-backed observations before validating it. Existing committed exports
are not treated as current measurements: missing or stale inputs become `null`
with `source_needed` explaining the missing provider or integration.

A temporary GitHub Actions API outage, expired token, or malformed provider result
must not manufacture zero, a healthy percentage, or a build PASS. The collector
records the missing evidence as unknown and retains it as an output artifact;
the independent production/readiness gates still require real supporting data.
The Node negative tests run with both ops-pack paths so this distinction
remains verifiable even when source APIs are unavailable.

## Bounded API JSON during Zod 3-to-4 migration

The Union Eyes withApi JSON boundary now counts actual streamed bytes (512 KiB)
and rejects deeply nested and oversized JSON collections before invoking Zod 3.
A dedicated 413 response and negative tests enforce this containment. Non-JSON
multipart ingestion retains separate streaming limits. This is a mitigating
control only: it does **not** remove the vulnerable Zod 3 runtime dependency or
clear advisory GHSA-mrhx-c7xc-m3w5. P0 issue #1040 requires a genuine
Zod 4 migration, refreshed lockfile and independent dependency audit PASS.

## Completed-step receipt and freshness hardening

A completed step's process-local authenticated history now retains both the
independent outcome proof **and** the independently minted policy permit.
Executor identities must match, and any subsequent step fails closed if a
prior completed step's policy, output or evidence changes, or if its permit
expires. Outcome-verifier timestamps are checked for a five-minute window
with at most 30 seconds of clock skew; stale/future receipts cannot be minted
or replayed as fresh proof. Negative regressions cover these boundaries.

These checks do **not** implement durable host trust, policy revocation,
identity authentication or independently administered audit persistence.
Issue #1037 remains a blocker, and no broker/installer capability is opened.

## Tool trust rollback protection — Issue #1037

A persistent trust store must now present an independent high-watermark witness.
The system refuses a self-consistent but rolled-back hash chain and rejects
missing/mismatched witnesses before replay. Append success is conditional on
sealing the new revision and head digest to independent host-controlled storage.
No persistent adapter or independently administered witness is provisioned by
this change. Production broker and installer remain **HOLD**.

## Durable PostgreSQL adapter — Issue #1037

The PostgreSQL CAS adapter and schema are now implemented in
`packages/tool-fabric/src/postgres-ledger-store.ts` and
`packages/tool-fabric/sql/001_trust_ledger_pg.sql`.
Writes use a locked stream row plus an append-only event insertion and head
update in a single transaction. Missing canonical stream and corrupt snapshots
fail closed. This implementation still requires DBA-controlled migration,
least-privileged host credentials, independent high-watermark witness, real
PostgreSQL concurrency/restart testing and independent attestation. It neither
opens the broker nor constitutes persistent-store runtime certification.

## Source bundle digest strengthening — Issue #1038

The release generator now uses deterministic sorted paths and domain-separated
SHA-256 records of relative paths, file sizes and content hashes. Symlinks
and special files are rejected rather than omitted. Node negative tests
cover filesystem order, concatenation collisions, relocation, modifications
and symlink injection. This binds built directory content more precisely, but
**does not prove OCI image provenance**, registry content or production runtime.
Those remain independently gated under #1038.
