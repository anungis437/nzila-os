# Architecture Shape — Control Plane

The Control Plane is an operating shell. It coordinates platform workflows and
read models rather than introducing another domain authority.

- `app/api/` authenticates requests, validates parameters and formats responses.
- `lib/services/authority/` owns policy evaluation, approval, replay and signed workflow authorization.
- `lib/services/governance/` owns the existing governance action lifecycle.
- `lib/services/` coordinates audit exports/verification, decision intelligence,
  operational health, deal mutations, events and automations.
- `db/adapters/` implements the existing database ports and event store.
- `db/queries/` holds platform overview and commercial event queries.
- `lib/repositories/` persists and retrieves platform NAR records.
- `server/` contains the remaining dashboard read-model composition.

Services retain the existing internal API-key and organization-scoped auditor
contracts. Platform NAR records retain their platform connection. The legacy UE
ingestion adapter still assumes shared storage; this refactor grants no access
to the isolated Union Eyes database and does not qualify that integration.

See the [domain-core standard](../../../docs/categories/platform-and-operations/architecture/APP_DOMAIN_CORE_STANDARD.md)
for service/query responsibilities. This source organization does not establish
runtime or deployment readiness.
