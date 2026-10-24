# VS Code Agent Mission — WorkAid Parallel Design Track (WA-PREP-01)

**Goal:** Prepare the product and implementation contracts for a WorkAid WSIB/WSIAT specialization within Union Eyes. **The staging-candidate convergence team is already working; do not interfere.**

## Authority and boundaries

The principal has approved autonomous *preparation, research, synthetic specification and isolated source/tests on a dedicated worktree* without repeated procedural approval prompts. Nothing here grants access to real WorkAid/WSIB/client records or authorizes deployment, staging database mutations, cloud configuration, granting partner credentials or production promotions.

Use the active repository baseline on checkout; compare it to the artifact's observed `main` SHA `38a824918cf2e7d7cfb7fcb0e796cbde45433be8` and report meaningful differences. Prefer a new isolated worktree `worktrees/wa-prep-01` on `feat/union-eyes-workaid-preparation` or a compliant repo branch convention; avoid modifying the active staging worktree, branches or journal. Do not merge/rebase or alter git config/CI. Maintain a commit trail for self-contained documentation and tests only; PR stays draft if opened, clearly designated **NOT A RELEASE**. A PR is optional until its source contract is reviewed.

## First autonomous sequence

1. **Inventory before building.** Locate exact current schema/runtime routes for members, external representation, claims, documents, deadlines, reminders, notifications, audit, union membership and demo personas. Record each path, import/caller, consumer, data owner, tests, deployment flag, status. Do not infer readiness from folder or schema existence.
2. **Create traceability.** Map each WorkAid request from Domenic to current reusable primitive vs missing capability, exact owner, data flows, threat tests and UX journey. Ensure WSIB claim is not silently conflated with CUPE grievance.
3. **Model bounded contracts.** Define immutable logical entities and transitions from the spec. Build typed schemas and synthetic fixtures only after cross-checking existing models and migrations. Prefer adapters/configuration to new duplicated identity, case or document stores. Never modify shared migrations in this track while convergence is active.
4. **Write negative tests first.** Implement test specifications for two-org isolation, representation authority vs view grant, per-claim/per-decision separation, missing forms with urgent exception, receipt-not-send, duplicate/replayed submission, revocation, sensitive metadata projections, holiday/DST reminders, stale queues, and spoofed external signals.
5. **Synthesize a local non-deployable UX storyboard.** Union intake -> Domenic Desk -> member approved view -> Angelo oversight, all fictional. Distinguish prototype surface from production claims; demo carries explicit label. Do not connect live Clio or WSIB accounts.
6. **Run adversarial review rounds.** Execute R1 findings as matrix; propose R2 by domain; harden and repeat. Fail on unsupported 'fully ready', 'Clio integrated' or automatic legal deadline claims.
7. **Return only actionable report:** implemented files and exact SHAs, tests executed with pass/fail counts, uncovered paths, newly found conflicts with staging work, unresolved high/critical findings, readiness of next self-contained slice. Avoid approval theatre; perform safe continuations automatically.

## Hard requirements

- `AUTH_START_WORKAID=NO` persists until deliberately changed through real counterpart onboarding; no invented approval.
- `CUSTOMER_DATA_EXECUTION_AUTHORIZED=NO` while platform evidence remains negative; all fixtures synthetic.
- No secret retrieval, Azure touches, shared staging traffic, production migrations, root schema mutation or changes to user credentials.
- No live professional filing, representation acceptance or legal advice automation.
- Do not silently alter existing legal source text, policies or old evidence artifacts to make tests pass.
- Security and negative test failures block claims of implementation completeness, but **do not** block safe docs, threat analysis, test harnesses or independent prototype work.

## Exit artifact

Provide `WA_Prep_Checkpoint.md`: base SHA, worktree, inventory table (reused/partial/absent), implementation PR/SHA if any, test matrix, adversarial findings with owners, staged-candidate conflict scan, next five autonomous slices and real blocked dependencies. Do not call it pilot-ready until runtime and counterpart acceptance exist.
