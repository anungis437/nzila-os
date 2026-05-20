# Org-Scoped Tables

> **Canonical platform documentation** for organization-scoped database tables in Nzila OS.

## Overview

All multi-tenant data in Nzila OS must be scoped to an organization. This prevents cross-tenant
data leakage and ensures that every row is associated with exactly one organization.

## Org-Scoping Requirements

Tables containing multi-tenant data MUST:
- Include an `org_id` column (UUID, NOT NULL)
- Include a foreign key constraint referencing `organizations(id)`
- Be indexed on `org_id` for efficient per-tenant queries
- Have all queries filtered by `org_id` at the application layer

## Exempted Tables

The following table categories are exempt from org-scoping:
- System/global lookup tables (e.g., decision types, policy templates)
- Audit ledger tables (append-only, scoped by actor rather than org)
- Platform-level configuration tables

## Enforcement

The `tooling/contract-tests/` suite includes a contract test that verifies all tables in the
`packages/db/src/schema/` directory meet org-scoping requirements unless explicitly exempted.

## Related

- [Architecture: Org-Scoped Tables](../architecture/ORG_SCOPED_TABLES.md)
