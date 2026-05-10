# ORG_SCOPE_PLAN.md — Nzila Commerce Engine

> Phase 5 Deliverable — Organisation Model Gap Plan
> Generated from legacy `shop_quoter_tool_v1-main` audit

---

## 1. Executive Summary

The legacy shop quoter has **zero multi-tenancy support**. Out of 31 source files and
40+ database tables, not a single one references `org_id`. Every query returns all
records globally. Every Supabase client is initialized with a single project URL.

The NzilaOS Commerce Engine requires **full org-scoped isolation** where:

- Every entity belongs to exactly one organisation
- Every query is filtered by `org_id` at the database level (RLS)
- Every API request is scoped by the authenticated user's org membership
- Cross-org data access is impossible by default

This document specifies the complete org-scoping requirements for migration.

---

## 2. Current State — Zero Org Scoping

### 2.1 Database Layer

| Finding | Detail |
|---------|--------|
| Tables with `org_id` column | **0 / 40+** |
| RLS policies defined | **0** (RLS enabled on 17 tables but no policies written) |
| Row-level filtering in queries | None — all `SELECT *` return global results |
| Org isolation mechanism | None |
| Schema-per-org | Not used |

### 2.2 Application Layer

| Finding | Detail |
|---------|--------|
| Files with org_id reference | **0 / 31** |
| Auth context carrying org_id | No — auth returns `user_id` only |
| API routes with org scoping | None |
| Middleware org resolution | None |
| Service constructors accepting org_id | None (all services are singletons) |

### 2.3 External Integrations

| Integration | Org Scoping | Risk |
|-------------|-------------|------|
| Zoho CRM | Single org credentials hardcoded | All syncs go to one Zoho org |
| Zoho Books | Single org credentials hardcoded | All invoices in one Books org |
| Zoho Inventory | Single org credentials hardcoded | All inventory in one org |
| OpenAI | Single API key | Shared usage, no per-org billing |
| Supabase Auth | Single project | All users in one auth pool |
| Supabase Storage | Single bucket | All files accessible globally |

---

## 3. Target Org Model — NzilaOS

### 3.1 Core Principles

1. **Org is the root aggregate** — every business entity descends from an org
2. **RLS enforces isolation** — application code cannot bypass org boundaries
3. **Auth carries org context** — JWT includes `org_id` claim
4. **Services are org-scoped** — no singletons, every service instance knows its org
5. **External credentials per-org** — each org has its own Zoho/API keys

### 3.2 Org Entity Definition

```typescript
interface Organisation {
  id: string;                    // UUID
  slug: string;                  // URL-friendly identifier
  name: string;                  // Display name
  type: 'enterprise' | 'partner' | 'subsidiary';
  status: 'active' | 'suspended' | 'archived';
  settings: OrgSettings;
  created_at: string;
  updated_at: string;
}

interface OrgSettings {
  currency: string;              // ISO 4217 (e.g. "CAD")
  locale: string;                // BCP 47 (e.g. "fr-CA")
  tax_jurisdiction: string;      // e.g. "CA-QC" for Quebec
  fiscal_year_start: string;     // MM-DD (e.g. "01-01")
  timezone: string;              // IANA (e.g. "America/Montreal")
  features: string[];            // enabled feature flags
}

interface OrgMembership {
  id: string;
  org_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'manager' | 'member' | 'viewer';
  permissions: string[];         // granular permission keys
  status: 'active' | 'invited' | 'suspended';
  created_at: string;
}
```

---

## 4. Entity Org-Scoping Requirements

### 4.1 Commerce Entities

Every entity below requires an `org_id` column with:

- NOT NULL constraint
- Foreign key to `organisations.id`
- Included in RLS policy
- Indexed for query performance

| Entity | Legacy Table(s) | org_id Required | RLS Policy | Index |
|--------|----------------|-----------------|------------|-------|
| Quote | `quotes` | ✅ YES | ✅ | `idx_quotes_org_id` |
| QuoteLine | `quote_line_items` | ✅ YES | ✅ | `idx_quote_lines_org_id` |
| QuoteVersion | *new table* | ✅ YES | ✅ | `idx_quote_versions_org_id` |
| Customer | `customers` | ✅ YES | ✅ | `idx_customers_org_id` |
| Order | *new table* | ✅ YES | ✅ | `idx_orders_org_id` |
| OrderLine | *new table* | ✅ YES | ✅ | `idx_order_lines_org_id` |
| Invoice | `invoices` | ✅ YES | ✅ | `idx_invoices_org_id` |
| InvoiceLine | `invoice_line_items` | ✅ YES | ✅ | `idx_invoice_lines_org_id` |
| Payment | `payments` | ✅ YES | ✅ | `idx_payments_org_id` |
| PartialInvoice | `partial_invoices` | ✅ YES | ✅ | `idx_partial_invoices_org_id` |

### 4.2 Inventory Entities

| Entity | Legacy Table(s) | org_id Required | RLS Policy | Index |
|--------|----------------|-----------------|------------|-------|
| InventoryItem | `inventory_items` | ✅ YES | ✅ | `idx_inventory_org_id` |
| InventoryReservation | `inventory_reservations` | ✅ YES | ✅ | `idx_reservations_org_id` |
| Supplier | `suppliers` | ✅ YES | ✅ | `idx_suppliers_org_id` |
| PurchaseOrder | `purchase_orders` | ✅ YES | ✅ | `idx_purchase_orders_org_id` |

### 4.3 Production Entities

| Entity | Legacy Table(s) | org_id Required | RLS Policy | Index |
|--------|----------------|-----------------|------------|-------|
| Mandate | `mandates` | ✅ YES | ✅ | `idx_mandates_org_id` |
| ProductionTask | `production_tasks` | ✅ YES | ✅ | `idx_prod_tasks_org_id` |
| QualityCheck | `quality_checks` | ✅ YES | ✅ | `idx_qc_org_id` |
| Shipment | `shipments` | ✅ YES | ✅ | `idx_shipments_org_id` |

### 4.4 Configuration Entities

| Entity | Legacy Table(s) | org_id Required | RLS Policy | Index |
|--------|----------------|-----------------|------------|-------|
| PricingTemplate | `pricing_templates` | ✅ YES | ✅ | `idx_pricing_tpl_org_id` |
| TaxConfiguration | *new table* | ✅ YES | ✅ | `idx_tax_config_org_id` |
| DiscountRule | `discount_rules` | ✅ YES | ✅ | `idx_discount_rules_org_id` |
| WorkflowConfig | *new table* | ✅ YES | ✅ | `idx_workflow_cfg_org_id` |

### 4.5 Integration Entities

| Entity | Legacy Storage | org_id Required | RLS Policy | Index |
|--------|---------------|-----------------|------------|-------|
| ZohoCredentials | env vars / hardcoded | ✅ YES | ✅ | `idx_zoho_creds_org_id` |
| ExternalSync | `zoho_sync_log` | ✅ YES | ✅ | `idx_ext_sync_org_id` |
| APIKey | *new table* | ✅ YES | ✅ | `idx_api_keys_org_id` |
| WebhookConfig | *new table* | ✅ YES | ✅ | `idx_webhooks_org_id` |

### 4.6 Audit Entities

| Entity | Legacy Storage | org_id Required | RLS Policy | Index |
|--------|---------------|-----------------|------------|-------|
| AuditLog | none (console.log only) | ✅ YES | ✅ | `idx_audit_org_id` |
| StateTransition | none | ✅ YES | ✅ | `idx_state_trans_org_id` |
| ChangeHistory | none | ✅ YES | ✅ | `idx_change_hist_org_id` |

---

## 5. Database Migration Plan

### 5.1 RLS Policy Template

Every table with `org_id` gets this RLS policy pattern:

```sql
-- Step 1: Add org_id column
ALTER TABLE {table_name}
  ADD COLUMN org_id UUID NOT NULL
  REFERENCES organisations(id);

-- Step 2: Create index
CREATE INDEX idx_{table_name}_org_id ON {table_name}(org_id);

-- Step 3: Enable RLS (already enabled on 17 legacy tables)
ALTER TABLE {table_name} ENABLE ROW LEVEL SECURITY;

-- Step 4: Create isolation policy
CREATE POLICY "org_isolation_{table_name}"
  ON {table_name}
  USING (org_id = current_setting('app.current_org_id')::UUID);

-- Step 5: Create insert policy
CREATE POLICY "org_insert_{table_name}"
  ON {table_name}
  FOR INSERT
  WITH CHECK (org_id = current_setting('app.current_org_id')::UUID);

-- Step 6: Create update policy
CREATE POLICY "org_update_{table_name}"
  ON {table_name}
  FOR UPDATE
  USING (org_id = current_setting('app.current_org_id')::UUID);

-- Step 7: Create delete policy
CREATE POLICY "org_delete_{table_name}"
  ON {table_name}
  FOR DELETE
  USING (org_id = current_setting('app.current_org_id')::UUID);
```

### 5.2 Auth Context Propagation

```sql
-- Set org context at the start of every request
-- Called by middleware before any query
CREATE OR REPLACE FUNCTION set_org_context(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_org_id', p_org_id::TEXT, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 5.3 Migration Sequence

| Step | Action | Tables Affected | Risk |
|------|--------|-----------------|------|
| 1 | Create `organisations` table | 0 (new) | LOW |
| 2 | Create `org_memberships` table | 0 (new) | LOW |
| 3 | Add `org_id` to all existing tables | 29 tables | HIGH — requires data backfill |
| 4 | Backfill `org_id` with default org | 29 tables | MEDIUM — one-time migration |
| 5 | Add NOT NULL constraint | 29 tables | LOW (after backfill) |
| 6 | Create RLS policies | 29 tables | HIGH — must test thoroughly |
| 7 | Update all RPC functions to accept `org_id` | 10+ functions | HIGH |
| 8 | Update application queries | 31 files | HIGH |
| 9 | Add org context to auth JWT | Auth config | MEDIUM |
| 10 | Per-org Zoho credentials | New table | MEDIUM |

---

## 6. Application Layer Changes

### 6.1 Middleware — Org Resolution

```typescript
// Every API request must resolve org_id before hitting any service
async function orgMiddleware(req: Request, res: Response, next: Next) {
  const user = await getAuthUser(req);
  const orgId = req.headers['x-org-id'] || user.defaultOrgId;

  // Verify membership
  const membership = await db.orgMemberships.findOne({
    user_id: user.id,
    org_id: orgId,
    status: 'active',
  });

  if (!membership) {
    return res.status(403).json({ error: 'Not a member of this organisation' });
  }

  // Set DB context for RLS
  await db.raw(`SELECT set_org_context('${orgId}')`);

  req.org = { id: orgId, role: membership.role };
  next();
}
```

### 6.2 Service Layer — Eliminate Singletons

**Current (legacy):**

```typescript
// ❌ Singleton — no org context
class ZohoSyncService {
  private static instance: ZohoSyncService;
  static getInstance() {
    if (!this.instance) this.instance = new ZohoSyncService();
    return this.instance;
  }
}
```

**Target (NzilaOS):**

```typescript
// ✅ Org-scoped — created per-request
class ZohoSyncService {
  constructor(
    private readonly orgId: string,
    private readonly credentials: ZohoCredentials,
    private readonly logger: Logger,
  ) {}

  async syncCustomers(): Promise<Result<SyncReport>> {
    // All queries automatically scoped by RLS via org context
    const customers = await this.db.customers.findAll();
    // ...
  }
}

// Factory
function createZohoSyncService(org: OrgContext): ZohoSyncService {
  const credentials = await getOrgCredentials(org.id, 'zoho');
  return new ZohoSyncService(org.id, credentials, org.logger);
}
```

### 6.3 Query Pattern Changes

**Current (legacy):**

```typescript
// ❌ No org filtering
const { data } = await supabase.from('quotes').select('*');
```

**Target (NzilaOS):**

```typescript
// ✅ RLS handles filtering automatically after set_org_context()
// Application code doesn't need explicit WHERE org_id = ...
// but defensive coding adds it anyway
const { data } = await supabase
  .from('quotes')
  .select('*')
  .eq('org_id', ctx.orgId);  // Belt + suspenders with RLS
```

---

## 7. External Integration Org Scoping

### 7.1 Zoho Integration

| Aspect | Legacy | Target |
|--------|--------|--------|
| Credentials | Single set in env vars | Per-org in encrypted `org_credentials` table |
| OAuth tokens | localStorage (browser) | Server-side, per-org, encrypted at rest |
| Sync scope | All records globally | Filtered by org Zoho organization_id |
| Error handling | console.error | Structured logger with org context |
| Rate limiting | None | Per-org rate limiting to prevent noisy neighbor |

### 7.2 OpenAI Integration

| Aspect | Legacy | Target |
|--------|--------|--------|
| API key | Single key for all | Per-org key or shared key with usage tracking |
| Usage billing | Untracked | Per-org token usage metering |
| Model selection | Hardcoded `gpt-4o-mini` | Per-org model preference in settings |
| Prompt context | Generic | Org-specific prompt templates |

### 7.3 Supabase

| Aspect | Legacy | Target |
|--------|--------|--------|
| Project | Single project | Single project with RLS (or multi-project for enterprise) |
| Auth | Single user pool | Single pool with org memberships |
| Storage | Single bucket | Per-org bucket prefix: `{org_id}/documents/` |
| Realtime | Global subscriptions | Org-filtered subscriptions |

---

## 8. Data Migration Strategy

### 8.1 Default Org Bootstrap

Since the legacy system has no org concept, all existing data will be assigned to a
**bootstrap organisation**:

```sql
-- Create the bootstrap organisation
INSERT INTO organisations (id, slug, name, type, status)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'legacy-default',
  'Legacy Default Organisation',
  'enterprise',
  'active'
);

-- Backfill all existing records
UPDATE quotes SET org_id = 'b0000000-0000-0000-0000-000000000001';
UPDATE customers SET org_id = 'b0000000-0000-0000-0000-000000000001';
UPDATE invoices SET org_id = 'b0000000-0000-0000-0000-000000000001';
-- ... repeat for all 29 tables
```

### 8.2 Org Assignment Validation

```sql
-- Verify no orphaned records after migration
SELECT table_name, COUNT(*) as orphaned
FROM information_schema.tables t
CROSS JOIN LATERAL (
  SELECT COUNT(*) FROM {table} WHERE org_id IS NULL
) counts
WHERE table_schema = 'public'
  AND column_name = 'org_id';
```

---

## 9. Testing Requirements

### 9.1 Isolation Tests

| Test | Description | Priority |
|------|-------------|----------|
| Cross-org query isolation | User in Org A cannot see Org B data | P0 |
| RLS bypass prevention | Direct SQL without context returns empty | P0 |
| Service scoping | Service created for Org A only queries Org A | P0 |
| Auth context propagation | JWT org_id reaches DB context | P0 |
| Membership enforcement | Non-member gets 403 | P0 |
| Role-based access | Viewer cannot write, member cannot delete | P1 |
| Credential isolation | Org A Zoho keys never used for Org B | P1 |
| Storage isolation | Org A cannot access Org B files | P1 |
| Realtime isolation | Org A subscriptions don't receive Org B events | P2 |

### 9.2 Migration Tests

| Test | Description | Priority |
|------|-------------|----------|
| Backfill completeness | Zero NULL org_id after migration | P0 |
| FK integrity | All org_id values exist in organisations | P0 |
| RLS policy activation | Queries without context return 0 rows | P0 |
| Performance regression | Indexed org_id queries < 10ms | P1 |

---

## 10. Effort Estimate

| Component | Effort | Dependencies |
|-----------|--------|--------------|
| `organisations` + `org_memberships` tables | 2 days | None |
| Auth JWT org claims | 2 days | Org tables |
| `org_id` column migration (29 tables) | 3 days | Org tables |
| RLS policies (29 tables) | 3 days | Column migration |
| Middleware (org resolution) | 2 days | Auth JWT |
| Service refactor (eliminate singletons) | 5 days | Middleware |
| Query updates (31 files) | 3 days | RLS policies |
| Per-org credentials table | 2 days | Org tables |
| Zoho integration refactor | 3 days | Per-org credentials |
| Storage path refactor | 1 day | Org tables |
| Isolation test suite | 3 days | All above |
| Migration test + validation | 2 days | All above |
| **Total** | **~31 days** | |

---

## 11. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Existing data has no natural org boundary | Cannot split data correctly | Bootstrap org + manual re-assignment |
| RLS policies break existing queries | App errors on all reads | Staged rollout: add column → backfill → add RLS |
| Performance degradation from RLS | Slow queries | Composite indexes: `(org_id, created_at)`, `(org_id, status)` |
| Zoho rate limits per-org | Sync failures | Queued sync with per-org rate limiting |
| Legacy code uses `Math.random()` for IDs | ID collisions across orgs | Replace with `crypto.randomUUID()` / database-generated UUIDs |
| Singleton services hold stale org context | Data leaks between requests | Request-scoped DI container, never cache org context |

---

## 12. Governance Alignment

This plan aligns with NzilaOS governance requirements:

| Requirement | Status |
|-------------|--------|
| `org_key: "org_id"` (from manifest) | ✅ Implemented via org_id column |
| `multi_org: true` (from manifest) | ✅ RLS + middleware enforce isolation |
| No singleton services | ✅ Factory pattern per-request |
| Structured logging with org context | ✅ Logger carries org_id |
| Audit trail per org | ✅ AuditLog table with org_id |
| Evidence-based compliance | ✅ StateTransition + ChangeHistory tables |

---

*Document generated as Phase 5 deliverable for Nzila Commerce Engine migration.*
