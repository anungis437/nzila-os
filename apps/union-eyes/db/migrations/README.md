# Database Migrations

## Overview

This directory contains all database migrations for the UnionEyes application. Migrations are split into two categories:

### 1. Core Drizzle Migrations (Root Directory)

Located in: `db/migrations/`

These are **auto-generated** by Drizzle Kit and track the primary database schema evolution:

- `0000_flippant_luke_cage.sql` - Initial schema with core tables
- `0001_phase5b_inter_union_features.sql` - Inter-union features
- `0002_true_selene.sql` - Schema updates
- `0003_curious_agent_zero.sql` - Additional tables
- `0004_phase2_complete.sql` - Phase 2 completion
- `0005_lazy_kate_bishop.sql` - Latest schema state (feature flags, compliance)

**Migration Tracking**: Managed by Drizzle via `meta/_journal.json`

**How to Apply**:

```bash
# Generate new migration from schema changes
pnpm drizzle-kit generate

# Push migrations to database
pnpm drizzle-kit push

# Or migrate programmatically
pnpm drizzle-kit migrate
```

### 2. Manual Migrations (manual/ Directory)

Located in: `db/migrations/manual/`

These are **hand-written SQL patches** for features not handled by Drizzle's schema system:

**RLS (Row-Level Security) Policies**:

- `053_enable_rls_policies.sql` - Enable RLS on all tables
- `054_fix_rls_policies.sql` - RLS policy fixes
- `055_pension_trustee_rls_policies.sql` - Pension/trustee specific policies
- `067_advanced_analytics_rls_fix.sql` - Analytics RLS

**Feature Enhancements**:

- `056_critical_business_functions.sql` - Critical business logic (601 lines)
- `057_add_audit_timestamps.sql` - Audit trail timestamps (310 lines)
- `058_recognition_rewards_system.sql` - Recognition & rewards (464 lines)
- `067_advanced_analytics_q1_2025.sql` - Q1 2025 analytics (410 lines)
- `067_advanced_analytics_q1_2025_azure.sql` - Azure-specific analytics (285 lines)
- `068_add_encrypted_pii_fields.sql` - PII encryption (218 lines)
- `069_feature_flags_system.sql` - Feature flags system (75 lines)

**Patch Migrations**:

- `add_cited_cases_column.sql` - Add cited cases to arbitration
- `add-notification-preferences.sql` - Notification preferences
- `apply-feature-flags.sql` - Feature flag application
- `cba_intelligence_manual.sql` - CBA intelligence features (399 lines)
- `phase5b_inter_union_features.sql` - Phase 5B features (580 lines)

**⚠️ Important**: Manual migrations are NOT tracked by Drizzle's journal. You must apply them manually in order.

**How to Apply Manual Migrations**:

```bash
# Via psql
psql $DATABASE_URL -f db/migrations/manual/053_enable_rls_policies.sql
psql $DATABASE_URL -f db/migrations/manual/054_fix_rls_policies.sql
# ... etc in numeric order

# Or via script (recommended)
node scripts/apply-manual-migrations.js
```

## Migration Workflow

### For New Features

1. **Update Schema Files**: Modify `db/schema/*.ts` files
2. **Generate Migration**: Run `pnpm drizzle-kit generate`
3. **Review Generated SQL**: Check `db/migrations/XXXX_*.sql`
4. **Test Migration**: Apply to staging database
5. **Apply to Production**: Run migration commands

### For RLS/Triggers/Functions

1. **Create Manual Migration**: Add file to `db/migrations/manual/`
2. **Number Sequentially**: Use next available number (070+)
3. **Test on Staging**: Apply and verify
4. **Document**: Update this README with description
5. **Apply to Production**: Run SQL file manually

## Schema Alignment

The current schema in `db/schema/index.ts` represents the **desired state** after:

- ✅ Core Drizzle migrations (0000-0005)
- ⚠️ Manual migrations (053-069) - must be applied separately

To verify your database matches the schema:

```bash
# Check for drift
pnpm drizzle-kit check

# Generate diff
pnpm drizzle-kit push --dry-run
```

## Rollback Strategy

**Core Migrations**: Drizzle doesn't support automatic rollback. Create reverse migrations manually.

**Manual Migrations**: Write corresponding rollback SQL files with `.rollback.sql` suffix.

## Production Checklist

Before deploying migrations to production:

- [ ] All migrations tested on local database
- [ ] Migrations tested on staging database
- [ ] Database backup completed
- [ ] Downtime window scheduled (if needed)
- [ ] Core migrations applied: `pnpm drizzle-kit migrate`
- [ ] Manual migrations applied in order
- [ ] Schema alignment verified: `pnpm drizzle-kit check`
- [ ] Application tested with new schema
- [ ] Rollback plan prepared

## Troubleshooting

**"Duplicate migration numbers"**: Run cleanup script to remove orphaned files
**"Schema drift detected"**: Compare `db/schema/` with latest migration SQL
**"RLS policies missing"**: Apply manual migrations from `manual/` directory
**"Migration order unclear"**: Follow numeric order: 0000 → 0005, then 053 → 069

## meta/ Directory

The `meta/` directory contains Drizzle's internal migration tracking:

- `_journal.json` - Migration history and order
- `XXXX_snapshot.json` - Schema snapshots per migration

**⚠️ Never manually edit meta files** - they're managed by Drizzle Kit.
