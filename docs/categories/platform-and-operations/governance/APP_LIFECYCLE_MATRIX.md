# App Lifecycle Matrix — Nzila OS

> Lifecycle tier classification for every application under `apps/`.
> Each app is assigned a tier, owner, domain, and maturity notes.
>
> Machine-readable source: `platform/registry/apps.json`
> Enforced by: `pnpm exec tsx scripts/app-lifecycle-check.ts`

---

## Lifecycle Tiers

### PRODUCTION

- Full gold standard compliance
- Strong test coverage, documentation, and governance integration
- Suitable for live customers and production traffic
- Health, metrics, and evidence endpoints required

### PILOT

- Operationally credible with controlled customer use
- Core workflows implemented and tested
- Documentation and governance in progress
- Health endpoint required

### INCUBATING

- Strong architecture, incomplete workflow maturity
- Key integrations wired but not fully validated
- Internal use and development iteration
- Health endpoint expected

### EXPERIMENTAL

- Exploratory or internal-only
- Early-stage development
- No customer-facing traffic
- Minimal governance requirements

---

## App Registry

| App | Tier | Owner | Domain | Notes |
|-----|------|-------|--------|-------|
| union-eyes | PRODUCTION | union | union | Full gold standard. 21+ test files, docs, health/metrics/evidence endpoints, domain model. Reference implementation. |
| flow | PRODUCTION | commerce | commerce | Full gold standard. Commerce vertical reference app with domain core, governance, evidence. |
| web | PRODUCTION | platform | platform | Public-facing site. 3+ test files, docs, health endpoint. |
| partners | PILOT | commerce | commerce | Partner operations portal. 4+ test files, docs, health endpoint. Proving workflows with controlled partner use. |
| cfo | PILOT | finance | finance | Financial intelligence and reporting. 5+ test files, docs, health endpoint. Operational with limited user base. |
| console | PILOT | platform | platform | Operator/developer tooling shell. 2+ test files, health endpoint. Docs in progress. |
| control-plane | PILOT | platform | platform | Executive/operator platform shell. Docs present, route governance enforced. Tests expanding. |
| zonga | INCUBATING | media | media | Creator/media marketplace. Docs and domain model present. Test coverage expanding. Health endpoint live. |
| abr | INCUBATING | platform | audit | Audit/bridge/reconciliation engine. Health endpoint live. Specialised governance via bridge boundary contract tests. |
| cora | INCUBATING | platform | compliance | Compliance and regulatory assurance. Health endpoint live. Tests expanding. |
| trade | INCUBATING | commerce | trade | Trade and vehicle commerce. Health endpoint live. 2+ tests. Domain packages maturing. |
| agrimo | INCUBATING | platform | analytics | Data intelligence and analytics. Health endpoint live. Architecture solidifying. |
| platform-admin | INCUBATING | platform | platform | Platform configuration and governance admin. Health endpoint live. Functionality expanding. |
| orchestrator-api | INCUBATING | platform | platform | API orchestration layer. 4+ tests. Health endpoint in progress. |
| nacp-exams | EXPERIMENTAL | education | education | Examination and certification workflows. Health endpoint live. Early-stage vertical. |
| mobility | EXPERIMENTAL | mobility | mobility | Investment migration advisory (CBI/RBI). Health endpoint live. Domain packages under development. |
| mobility-client-portal | EXPERIMENTAL | mobility | mobility | Mobility customer self-service portal. Health endpoint live. Early-stage. |

---

## Tier Graduation Criteria

### EXPERIMENTAL → INCUBATING

- Health endpoint operational
- At least 1 test file
- Package.json with `dev`, `build`, `typecheck` scripts
- Architecture boundaries respected

### INCUBATING → PILOT

- Minimum 3 test files
- Documentation directory with at least README or domain model
- Health and metrics endpoints operational
- Demo seed capability
- Policy enforcement integration started

### PILOT → PRODUCTION

- Full gold standard compliance (see [APP_GOLD_STANDARD.md](APP_GOLD_STANDARD.md))
- 5+ test files, target 1+ E2E spec
- Complete documentation including domain model and pilot playbook
- Health, metrics, and evidence export endpoints
- Policy enforcement active
- Governance checks passing

---

## Related Documents

- [APP_GOLD_STANDARD.md](APP_GOLD_STANDARD.md) — structural requirements for production apps
- [ARCHITECTURAL_LAYERS.md](../architecture/ARCHITECTURAL_LAYERS.md) — dependency model and layer rules
- [PACKAGE_OWNERSHIP.md](PACKAGE_OWNERSHIP.md) — package metadata registry
