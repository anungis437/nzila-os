---
name: nzila-repository-orientation
description: Use before changing Nzila OS code when a task spans products, packages, governance documents, or an unclear source of truth. Establish boundaries, ownership, current evidence, and an exact change plan.
---

# Nzila OS repository orientation

## Trigger
Use when entering an unfamiliar application, working across package boundaries, or reconciling conflicting instructions or status claims.

## Procedure
1. Read root `AGENTS.md` and `ARCHITECTURE.md`; use `CLAUDE.md` where the agent host requires it. Read the relevant product README, governance portfolio entry, capability registry, and local instructions before modifying files. For Union Eyes follow the exact ordered reading requirement in `AGENTS.md`.
2. Identify the exact branch, base commit, application and package owners, affected APIs, tenants, permissions, migrations, background workers, and other consumers. Do not assume a historical evidence report describes the current commit.
3. Separate the requested outcome from proposed methods. Locate the authoritative issue/register and current source files; distinguish canonical implementation from duplicated, generated, legacy, demo, and deprecated paths.
4. Record an inventory of `SOURCE_OF_TRUTH`, `IN_SCOPE`, `OUT_OF_SCOPE`, `DEPENDENCIES`, `RISKS`, and `PROOF_REQUIRED`. Where a referenced path is absent, report the mismatch rather than inventing a replacement.
5. Make the smallest cohesive code change that meets the requested outcome. Avoid altering other product lines, infrastructure, protected branches, secrets, customer data, or release gates without the relevant authorization.
6. Finish with exact changed paths, commit SHA, remaining proof, and a truthfully qualified status.

## Non-negotiables
- Repository policy remains controlling; this skill is a workflow aid, not an authorization grant.
- Do not claim READY/GO based on an implementation diff or an old report.
- Prefer existing scripts and contracts to new parallel governance machinery.

