# Union Eyes Gate 0C.3 - carbon accounting scope decision record

Register: `docs/union-eyes/convergence/register/ue-carbon-scope-decision-0c3.json`
Register sha256: `65a78d5766d9f25cfd775bfc2f5e8439acfaa0b7d823517659cc65f72b130106`
Decision: `UE-INST-CARBON-ACCOUNTING-SCOPE`. State: OUTSTANDING. Status: DECISION_READY_NOT_DECIDED.

## Status of this record

A decision-ready record for the institutional decision that the four carbon operations wait on. It states three options, the evidence for and against each and a preparer recommendation. It selects nothing, adopts nothing and does not change the four decision-bound scope exceptions, which are not owned, authorized, adopted, approved or production ready.

No option is selected and none is adopted. The four operations stay DECISION_BOUND_SCOPE_EXCEPTION. The recommendation below is the preparer's input to the deciding authority and decides nothing.

## Question

Does the platform operator or an organization own carbon accounting, and which measured data source, if any, may back an emissions figure or a neutrality claim?

Decision owner role: INSTITUTION_TO_BE_NAMED. Required approval evidence: An adopted institutional decision record that names the deciding authority, its date, its scope and the decision text, and that is independent of the preparer. No such record format is adopted in the repository yet, so none exists for any of the 79.

## The four operations

| Operation | Classification | Option chosen | Owned | Authorized | Defects |
| --- | --- | --- | --- | --- | --- |
| carbon/dashboard/route.ts\|GET | DECISION_BOUND_SCOPE_EXCEPTION | none | no | no | DEF-0B4-CARBON-FABRICATED-MEASUREMENTS-RETURNED-200, DEF-0B4-CARBON-ORG-ID-FROM-QUERY-STRING |
| carbon/infrastructure/route.ts\|GET | DECISION_BOUND_SCOPE_EXCEPTION | none | no | no | DEF-0B4-CARBON-FABRICATED-MEASUREMENTS-RETURNED-200 |
| carbon/validate/route.ts\|GET | DECISION_BOUND_SCOPE_EXCEPTION | none | no | no |  |
| carbon/validate/route.ts\|POST | DECISION_BOUND_SCOPE_EXCEPTION | none | no | no | DEF-0B4-CARBON-VALIDATE-ATTESTS-CALLER-DATA |

## Current behavior

The dashboard and infrastructure routes return emissions totals, regional breakdowns, renewable percentages and optimization advice as literals in the handler with success true and status 200, and the validate routes compute a certification-shaped verdict from caller-supplied data points. No route reads a table or a service.

Defect: `DEF-0B4-CARBON-FABRICATED-MEASUREMENTS-RETURNED-200` (HIGH, RELEASE_BLOCKING, PROPOSED_NOT_ACCEPTED).

Route evidence:
- `apps/union-eyes/app/api/carbon/dashboard/route.ts`: `totalEmissions: 1245.67,`
- `apps/union-eyes/app/api/carbon/dashboard/route.ts`: `const organizationId = searchParams.get('organizationId') || 'union-eyes';`
- `apps/union-eyes/app/api/carbon/infrastructure/route.ts`: `export const GET = withApiAuth(`
- `apps/union-eyes/app/api/carbon/validate/route.ts`: `let certificationEligible = false;`

## Evidence found outside the routes

Sources outside the four route files that name carbon accounting.

- `apps/union-eyes/services/carbon-accounting-service.ts`: `Tracks UnionEyes' carbon footprint:` - The service names the platform product own footprint as its subject.
- `apps/union-eyes/services/carbon-accounting-service.ts`: `// For now, use estimated values based on carbon reduction plan` - Scope 2 is an estimate from a plan, not a measurement.
- `apps/union-eyes/services/carbon-accounting-service.ts`: `const employeeCount = 20; // Estimated from carbon plan` - Scope 3 uses a fixed estimated head count.
- `apps/union-eyes/services/carbon-accounting-service.ts`: `return 5000;` - The active member count is a constant.
- `apps/union-eyes/services/carbon-accounting-integration.ts`: `// For now, we'll use mock data structure` - The infrastructure monitor is a mock data structure.
- `apps/union-eyes/services/carbon-accounting-integration.ts`: `verificationStatus: 'estimated',` - The service records its own emissions as estimated, never measured.
- `apps/union-eyes/db/migrations/0004_phase2_complete.sql`: `CREATE TABLE IF NOT EXISTS "carbon_emissions" (` - A carbon_emissions table is declared in migration 0004 only; its organization_id column is nullable.
- `apps/union-eyes/backend/services/api/carbon_accounting_service_views.py`: `permission_classes = [IsAuthenticated]` - A backend (not Next.js) viewset records and reports emissions per organization and is open to any authenticated user.
- `apps/union-eyes/backend/services/api/carbon_accounting_service_views.py`: `Required fields: source, scope (scope_1|scope_2|scope_3), amount_kg, emission_date.` - The recorded figures are caller-entered amounts, not measured values.
- `apps/union-eyes/backend/services/api/carbon_accounting_service_views.py`: `Data store: Uses AuditLogs with resource_type 'CarbonEmission', 'CarbonTarget',` - The backend stores them as audit-log rows until dedicated carbon models exist.

## Correction to the frozen evidence

Frozen statement (preserved, not edited): No table, service, persona source, register entry or product caller names carbon accounting or Azure emissions monitoring, so there is no engineering capability whose obligation covers the operation and no institutional office that owns it.

Discrepancy: The frozen Gate 0B.4 and Gate 0B.5 statement says no source names carbon accounting. A Next.js service, an integration service, a backend viewset and a database migration do name it. None is reachable from the four routes and every figure in them is an estimate or a caller-entered amount, so the four routes still have no measured source, owner or persona. The frozen statement is preserved and not edited.

Review required: An independent reviewer confirms whether the backend recording path is part of the released scope; that is a separate scope question from the four routes.

## Options

### OPT-PLATFORM-OWNED-MEASURED - Platform-owned measured carbon accounting

The platform operator owns carbon accounting of its own hosting and operations and publishes figures backed by a measured data source.

Requires:
- A named measured data source (for example provider-reported emissions or metered usage), which no repository source names.
- A named owning office and an approval path for any neutrality, renewable or net-zero claim.
- A decision whether organizations see the platform figures or none.

Route consequence: The dashboard and infrastructure routes read from the measured source for the platform scope and return 501 until it exists; the validate routes either verify a claim against measured platform data or are retired; organizationId stops being caller supplied.

Evidence for:
- The existing service and integration define the subject as the platform product own footprint, so a platform owner matches the in-repository design intent.

Evidence against:
- Every figure in the service is an estimate from a plan or a literal constant; no measured source exists in the source tree.
- The integration names itself a mock data structure.

Reversibility: Adoptable later without undoing the 501 containment.

Selected: no. Adopted: no.

### OPT-ORGANIZATION-OWNED-MEASURED - Organization-owned measured carbon accounting

Each union organization owns its own carbon accounting and the platform only stores and presents it.

Requires:
- A per-organization measured data source and an intake path for it; none exists.
- A named organization office that owns the figures and any claim, per organization.
- Tenant isolation and audience rules for the figures.

Route consequence: The routes become organization-scoped from the session organization, never from a query parameter, and return 501 until an intake and an owner exist.

Evidence for:
- The declared carbon_emissions table has an organization_id column.
- A backend viewset already records and reports emissions per organization from caller-entered amounts, so a per-organization design intent exists in the repository.

Evidence against:
- That column is nullable and the table has no Drizzle declaration and no Next.js route or service that reads or writes it.
- The backend figures are caller-entered, stored as audit-log rows and open to any authenticated user; they are not measured, and nothing shows the backend is part of the released scope.
- No persona, capability or caller names an organization carbon owner.
- The Next.js service computes no per-organization figure.

Reversibility: Adoptable later without undoing the 501 containment.

Selected: no. Adopted: no.

### OPT-RETIRE-ROUTES - Retire the four unsupported routes

The four carbon operations leave the product scope and answer 501 retired; the Next.js estimate service stays unrouted until a later decision.

Requires:
- Removal of the four operations from navigation, documentation and the route registry, and a retired-route contract answering 501.

Route consequence: carbon/dashboard GET, carbon/infrastructure GET, carbon/validate GET and carbon/validate POST answer 501 and are counted as retired, not owned; the Gate 8 obligation to prevent unsupported success responses is met by retirement.

Evidence for:
- No measured data source, owner office, persona or product caller exists for any of the four operations.
- The routes return literal figures and a certification-shaped result today.
- It is the only option that needs no capability the repository does not contain.

Evidence against:
- The platform product carries its own sustainability plan in the service, so retirement discards a stated product intent unless it is reopened later.
- Retiring the four Next.js routes does not remove the backend recording path, which needs its own scope decision.

Reversibility: Reversible: a later adoption of either measured option can reopen the scope.

Selected: no. Adopted: no.

## Preparer recommendation (not selected)

Recommended option: `OPT-RETIRE-ROUTES`. Status: PREPARER_RECOMMENDATION_NOT_SELECTED. Not selected, not adopted.

Basis:
- No measured data source, owner office, persona or product caller exists for any of the four operations.
- The routes return literal figures and a certification-shaped result today.
- It is the only option that needs no capability the repository does not contain.

Caveats:
- The platform product carries its own sustainability plan in the service, so retirement discards a stated product intent unless it is reopened later.
- Retiring the four Next.js routes does not remove the backend recording path, which needs its own scope decision.
- If the deciding authority names a measured data source and an owning office, a measured option replaces this recommendation.
- Retirement is a scope action. It is taken only by the deciding authority and this record retires no route.

## Preserved obligation

Capability `UE-CAP-H-001`, Gate 8: Whichever option the institution chooses, the routes must not return emissions totals, renewable percentages, optimization advice or a certification-shaped result as success while no measured data source exists. Until then they return 501 not implemented. This obligation is held by the retired scaffold capability and is independent of who owns carbon accounting.

Whichever option the institution chooses, the four routes must not return an unsupported success response. This gate does not return 501 from them; the repair is owned by Gate 8 and stays open.
