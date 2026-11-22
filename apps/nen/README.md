# Nzila Economic Network (NEN) — isolated monorepo foundation

**Black business. Built to last.**

NEN is an EXPERIMENTAL Nzila OS product, intentionally separate from Union Eyes, CIVIC, Partners and Flow. Public landing, existing platform-auth sign-in and a signed-in read-only workspace shell are included. No business/financial records, test identities, or NEN grants are provisioned.

- `pnpm --filter @nzila/nen dev` — local development (port 3018).
- `pnpm --filter @nzila/nen typecheck` and `pnpm --filter @nzila/nen build` — integration checks once dependencies are installed.
- `pnpm --filter @nzila/nen-core test` — tested deterministic teaming/contract-share domain.

**No live customer operations.** Session authentication is delegated to `@nzila/platform-auth`; a session and selected organization do not grant NEN record access. Before connecting persistence, require canonical organization mandates, an append-only transactional outbox, legal contracting/evidence arrangements and reviewed migrations.
