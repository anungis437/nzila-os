# Platform Proof Demo Script

> Step-by-step walkthrough for demonstrating the Nzila OS governance proof layer
> to enterprise evaluators, technical buyers, or auditors.

## Prerequisites

- Node.js 22+, pnpm installed
- Repository cloned and dependencies installed (`pnpm install`)

## Demo Flow (5 minutes)

### Step 1 — Set the Stage (30 seconds)

> "Every governance control in Nzila OS — enforcement pipelines, policy
> evaluation, AI controls, event contracts, and audit chains — is not just
> tested, but **proven** with machine-verifiable artifacts. Let me show you."

### Step 2 — Run the Full Proof Suite (60 seconds)

```bash
pnpm proof:run
```

**What to show:**

- 4 scenario suites execute
- 36 assertions pass
- Artifacts are generated in `proof-artifacts/`

> "Each scenario exercises a complete governed lifecycle — not a mock, not a
> stub. Real enforcement pipelines, real policy evaluation, real hash-chained
> audit entries."

### Step 3 — Inspect a Governance Artifact (60 seconds)

Open `proof-artifacts/ue-governed-mutation/governance.json`:

```bash
cat proof-artifacts/ue-governed-mutation/governance.json
```

**What to highlight:**

- `outcome: "allow"` — the governance engine evaluated and permitted
- `matchedRuleId` — which specific policy rule authorized the action
- `evaluatedAt` — timestamp of evaluation
- `durationMs` — sub-millisecond policy evaluation

> "This isn't a test assertion saying 'governance was called'. This is the
> actual governance decision, captured as evidence."

### Step 4 — Verify the Audit Chain (60 seconds)

Open `proof-artifacts/ue-governed-mutation/audit-chain.json`:

```bash
cat proof-artifacts/ue-governed-mutation/audit-chain.json
```

**What to highlight:**

- `valid: true` — the hash chain is cryptographically intact
- `entriesChecked` — number of audit entries verified
- Each entry has a `hash` and `prevHash` forming an immutable chain

> "Every mutation is recorded in a hash-chained audit log. If any entry is
> tampered with, the chain breaks. This is the same integrity model used by
> blockchain audit systems — but built into the application layer."

### Step 5 — Show the Compliance Dual-Path (60 seconds)

Open `proof-artifacts/compliance-sensitive-action/governance.json`:

```bash
cat proof-artifacts/compliance-sensitive-action/governance.json
```

**What to highlight:**

- `denyDecision` — viewer was blocked with explicit reason
- `allowDecision` — compliance officer was permitted
- Both decisions are linked by trace ID

> "The platform doesn't just allow or deny — it records WHY, WHO, and WHEN
> for both outcomes. An auditor can reconstruct the full decision path."

### Step 6 — Verify Artifacts Programmatically (30 seconds)

```bash
pnpm proof:verify
```

> "Machine verification confirms every expected artifact exists and is valid
> JSON. This runs in CI on every commit — governance proof is not optional."

### Step 7 — Show CI Integration (30 seconds)

Open `.github/workflows/ci.yml` and point to the governance-gates job:

- Platform proof tests run after contract tests
- Artifacts are uploaded to GitHub Actions (90-day retention)
- Any failure blocks the pipeline

> "Nobody ships code that breaks a governance control. The proof layer is
> a hard gate in CI."

## Key Talking Points

1. **Not synthetic tests** — real package APIs, real policy evaluation, real
   audit hashing
2. **Machine-verifiable** — every artifact is JSON, every chain is
   cryptographically validated
3. **CI-enforced** — proof tests run on every commit, failures block deployment
4. **Auditor-friendly** — trace IDs, timestamps, actor/tenant attribution in
   every artifact
5. **7 governance packages** under proof: enforcement, governance, audit,
   ai-control, events, contracts, observability
