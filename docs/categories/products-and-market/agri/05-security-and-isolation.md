# Agri Stack — Security and Isolation

## Org Isolation

### Row-Level Security (RLS)

Every agri table is scoped by `org_id`. Database-level RLS policies enforce:

```sql
-- All org users see only their org's rows
CREATE POLICY agri_org_isolation ON agri_producers
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Platform roles can read all (explicit policy)
CREATE POLICY agri_platform_read ON agri_producers
  FOR SELECT
  USING (current_setting('app.current_role') = 'platform_admin');
```

### Application-Level Enforcement

1. **`resolveOrgContext()`** — every server action resolves org from platform auth
2. **Scoped DB** — `createScopedDb({ orgId })` wraps all queries with org filter
3. **Audited writes** — `createAuditedScopedDb()` logs all mutations
4. **Contract tests** — CI enforces that all actions call `resolveOrgContext()`

### Cross-Org Isolation Tests

```typescript
// Contract test: Cross-org data leak prevention
it('producer query with org A context cannot see org B data', ...)
it('lot creation without org context throws', ...)
it('batch allocation across orgs is rejected', ...)
```

## Authentication

- **Platform Auth (Entra ID)** for user authentication and org membership
- **Org roles**: admin, manager, operator, viewer
- **Session claims** carry org context + custom agri roles

## Authorization

| Role | Agrimo Permissions | Cora Permissions |
|------|-------------------|------------------|
| admin | Full CRUD + certify + execute payments | Full analytics + configure models |
| manager | CRUD producers, harvests, lots, batches | View all analytics + export |
| operator | Record harvests, inspections, milestones | View dashboards |
| viewer | Read-only | View dashboards |

## Data Classification

| Data Type | Classification | Encryption | Retention |
|-----------|---------------|------------|-----------|
| Producer PII (name, phone, email) | Confidential | At rest + in transit | 7 years |
| Harvest quantities | Internal | At rest | 7 years |
| Quality inspection results | Internal | At rest | 10 years |
| Certification artifacts | Regulatory | At rest + content hash | 10 years |
| Payment records | Financial | At rest + in transit | 10 years |
| Evidence packs | Regulatory | At rest + hash chain | Indefinite |

## Audit Trail

Every mutation produces an audit event:

- Actor ID, org ID, correlation ID
- Table name, action (insert/update/delete)
- Timestamp
- Hash-chained to previous event (tamper detection)

## Secret Management

- Database credentials via Azure Key Vault
- API keys for integrations stored in Key Vault
- No secrets in environment variables or code
- Rotation enforced via ops runbooks
