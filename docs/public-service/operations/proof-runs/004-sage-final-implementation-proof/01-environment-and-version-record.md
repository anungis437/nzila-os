# 01 — Environment and Version Record

## Repository / build identity

| Field | Value |
|---|---|
| Base branch | `main` |
| Base commit | `66ec5ea3116828e95361ef107b4d4e24becb16b4` (`66ec5ea31`) |
| Proof branch | `proof/sage-final-implementation` |
| Node.js | `v24.16.0` |
| pnpm | `10.33.0` |
| Migration manifest | PASS — 16 root migrations locked |
| Database schema snapshot | PASS — composite hash `cbb91c13dc120de45889e3bc60d5efd0b5a6c155c7a1454ba848b63c55827c1b` |
| Environment classification | Local developer proof environment (NOT a deployed production-equivalent stack) |
| Region / data-residency | N/A for local proof (no deployed region); production intent is Canada — not exercised here |

## Component configuration status

| Component | Proof configuration | Status |
|---|---|---|
| PostgreSQL | Official PostgreSQL **18.4** server, TCP `localhost`, non-owner roles + RLS | PROVEN (production-equivalent engine) |
| In-process PostgreSQL | PGlite (WASM PostgreSQL 16) for the migration chain + lifecycle | PROVEN |
| Object storage | Content-addressed rows in `sage_export_package_object` (repo-embedded store); no external object store provisioned | PARTIAL — logic proven, external provider NOT_PROVEN |
| Notification provider (Resend) | Not provisioned in proof environment | NOT_PROVEN |
| Distributed rate limiter (Redis/Upstash) | Not provisioned in proof environment; fail-closed behaviour proven in unit tests | PARTIAL — fail-closed proven, live Redis NOT_PROVEN |
| Error monitoring (Sentry) | Not provisioned in proof environment | NOT_PROVEN |
| External uptime monitoring | Not provisioned in proof environment | NOT_PROVEN |
| Backup / restoration | Not provisioned in proof environment | NOT_PROVEN |
| Observability / OTLP export | Not provisioned in proof environment | NOT_PROVEN |

## Test data policy

Test data only. No production personal data. All identifiers in this proof are
synthetic (`org-pg-a`, `org-pg-b`, generated UUIDs). Storage references appear only as
SHA-256 hashes in evidence and audit records.

## Frozen versions used by the proof suites

- Official PostgreSQL server: PostgreSQL 18.4 (via `@embedded-postgres/darwin-arm64`,
  used locally for the proof only; **not** a committed dependency — CI uses the
  official `postgres:16` service image).
- PGlite: `@electric-sql/pglite` `^0.5.4`.
- Repository client: `postgres` (postgres.js) `^3.4.8`.
