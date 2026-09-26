# Reference

Technical reference documentation for the Nzila OS platform.

## Architecture

- [Architecture Overview](../../../../ARCHITECTURE.md) — Authority boundaries and system design
- [Package Catalogue](packages.md) — All packages and their roles
- Database schema — no reference page; the schema itself is authoritative
  (`packages/db/src/schema/`), with org-scoping rules in
  [../architecture/ORG_SCOPED_TABLES.md](../architecture/ORG_SCOPED_TABLES.md)

## Security

- [Policy Engine](../architecture/policy-engine.md) — RBAC, zero-trust, and OPA policies
- [Evidence System](../architecture/EVIDENCE_LIFECYCLE.md) — Hash-chained audit trails

## AI

- [AI Platform Contract](../architecture/AI_PLATFORM_CONTRACT.md) — AI routing, capability
  profiles, budgets

## Configuration

- Environment variables and settings — no reference page; each app validates its own
  environment with Zod at startup and ships an `.env.example`. Environment topology is in
  [../architecture/ENVIRONMENT_ARCHITECTURE.md](../architecture/ENVIRONMENT_ARCHITECTURE.md).
