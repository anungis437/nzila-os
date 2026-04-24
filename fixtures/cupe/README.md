# PR-011: CUPE Taxonomy Pack & Pilot Fixtures

This PR includes all CUPE-specific taxonomy and demo data for the union pilot.

## Fixtures Included

### 1. CUPE Vocabulary Pack
**File:** `fixtures/cupe/taxonomy/cupe-vocabulary.json`

Hardcoded CUPE union vocabulary (per user requirements):
- **Case Types**: discipline, harassment, discrimination, wage dispute, benefits, safety, contracting, etc. (10 types)
- **Priorities**: low (1 week SLA), medium (3 days), high (2 days), critical (1 day)
- **Severities**: minor, moderate, serious, critical
- **Roles**: member, steward, chief steward, business agent, officer, admin
- **Statuses**: 12 statuses with allowed transitions and role constraints

v0.1: Hardcoded system-wide defaults  
v0.2+: Per-org customization support (Phase 8)

### 2. CUPE Pilot Setup Fixtures
**File:** `fixtures/cupe/pilot-org/cupe-pilot-setup.json`

Complete demo org for testing:
- **1 Organization**: CUPE Local 123 (Ontario)
- **3 Worksites**: City Hall Downtown (45 members), City Hall North (38 members), Toronto Library Central (24 members)
- **7 Members**: 6 union members + 1 admin with various roles (member, steward, chief steward)
- **5 Cases**: 3 open, 1 in-progress, 1 settled (wage dispute, harassment, discipline, benefits)

## Seeding Methods

### Method 0 (Preferred — since April 2026): `@nzila/staging-seed` framework

The unified staging-seed framework registers a Union-Eyes seeder that
generates CUPE-shaped synthetic data deterministically from a profile:

```bash
# From the repo root
pnpm seed:staging --app=union-eyes --profile=demo-light
```

See [`tooling/staging-seed/README.md`](../../tooling/staging-seed/README.md)
and [`apps/union-eyes/lib/staging-seed/index.ts`](../../apps/union-eyes/lib/staging-seed/index.ts).
The methods below are kept for the admin-console workflow and for ad-hoc
local fixture loading; new automation should use the framework.

### Method 1: Admin Console Form
**Component:** `apps/union-eyes/app/components/admin/LoadCUPEPilotForm.tsx`

UI form for admins to load/reset pilot data (per user requirements - form-based only):
- Load Pilot Data button (creates 1 org + 3 worksites + 7 members + 5 cases)
- Reset Data button (deletes all CUPE Local 123 data)
- Confirmation dialog + success/error feedback

**API Route:** `apps/union-eyes/app/api/admin/seed-cupe-pilot/route.ts`
- POST /api/admin/seed-cupe-pilot
- Validates fixture structure
- Future: Direct DB insert (using RLS context)

### Method 2: CLI Script (v0.1)
**Script:** `apps/union-eyes/scripts/seed-cupe-pilot.mjs`

Command-line tool for local development seeding:
```bash
# Load fixtures
node scripts/seed-cupe-pilot.mjs

# Reset and reload
node scripts/seed-cupe-pilot.mjs --reset
```

Uses direct psql connections (development only, bypasses RLS for seed setup).

v0.2: Admin form becomes primary seeding mechanism (per user requirements)

## Integration with PR-010

The vocabulary pack is loaded by:
- `@nzila/cupe-vocabulary` package (PR-010)
- `/api/vocabulary` endpoints (PR-010)
- `useCUPEVocabulary()` React hook (PR-010)

Demo data uses vocabulary IDs:
- Case types: discipline, harassment, wage_dispute, etc.
- Priorities: low, medium, high, critical
- Statuses: filed, acknowledged, investigating, settled, etc.

## Testing

Fixtures are JSON-validated for:
- Valid case type IDs (must exist in @nzila/cupe-vocabulary)
- Valid priority IDs (must exist in @nzila/cupe-vocabulary)
- Valid severity IDs (must exist in @nzila/cupe-vocabulary)
- Valid role IDs (must exist in @nzila/cupe-vocabulary)
- Valid status IDs (must exist in @nzila/cupe-vocabulary)

Contract test: `ue-fixture-validation.test.ts` (creates fixtures/validates structure)

## Known Limitations (v0.1)

- ❌ No per-org customization (Phase 8)
- ❌ No per-worksite vocabulary overrides (Phase 8)
- ❌ No bulk import scripts (Phase 8, user deferred)
- ⚠️ CLI script bypasses RLS (dev-only; admins use form in production)
- ⚠️ Seeding is idempotent but not transactional (single errors may leave partial state)

## Next Steps

- **PR-012**: Union entity model validation + additional seed scripts for advanced scenarios (2-3 demo orgs)
- **Phase 2**: Use fixtures in intake/assignment hardening (PR-020, PR-021)
- **Phase 5**: Dashboard tests using fixture data

See also: `docs/reference/DEFERRED_ITEMS.md` for post-pilot backlog (multi-org, customization, analytics fixtures)
