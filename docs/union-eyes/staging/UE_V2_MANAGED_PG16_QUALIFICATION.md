# Managed PostgreSQL 16 restore qualification

The disposable export uses the PostgreSQL bootstrap superuser. The Azure staging
operator is a separate, non-superuser server administrator. These are different
role graphs and must be qualified separately.

[PostgreSQL 16](https://www.postgresql.org/docs/16/role-attributes.html) automatically
grants a role creator ADMIN without INHERIT or SET, recorded under the bootstrap
superuser. The creator cannot revoke that provider grant. Azure reserves
[`azuresu`](https://learn.microsoft.com/en-us/azure/postgresql/security/security-access-control)
for the provider and owns a new database's public schema through `azure_pg_admin`.
Treating these memberships as application execution grants would misclassify the
operator; discarding them from a catalog comparison would hide real escalation.

The managed profile enumerates every permitted membership, grantor and option:
canonical internal grants made by `uev2admin`, provider-owned creator grants,
four NOINHERIT application logins, and one temporary owner SET delegation during
an open restore. FINAL requires removal of that temporary delegation. Additional
owner/gateway/admin membership, direct login privileges, changed ACLs, RLS flags,
function bodies, ownership, missing objects and duplicate identities all fail.
Multiple grantors on a role/member pair are compared as separate edges.

The original native privilege probe remains unchanged and its fixture-profile
result is retained. Only its exact installer-delegation difference is replaced
by the fully enumerated managed-role comparison. Every other native privilege
failure still fails qualification. The canonical schema projection must match
the qualified export; raw managed and canonical digests are reported separately.
This does not turn a failed fixture-profile result into an unqualified PASS.

The local-only command accepts a hash-checked qualified export, creates its own
pinned Docker PostgreSQL with a non-superuser administrator and provider-owned
public schema, and restores the actual emitted SQL. It transfers public schema
ownership while the operator still owns the empty database, before transferring
the database to the canonical owner. Four genuine restricted logins then prove
bare-access and cross-role denials. The actual auth client proves separate ordinary
and system gateway contexts and rejects reusing the ordinary credential for the
system context. Both pg and postgres.js prove the startup role options required
by shared read-only health/catalog inspection. The real packaged admission
queries must pass against the restored catalog. Native negative controls add an owner-role
membership and a direct table grant; qualification must reject both. The
command removes only its own disposable container and accepts no remote target.

```sh
pnpm exec tsx tooling/scripts/qualify-ue-managed-pg16-restore.cts \
  --export /absolute/qualified-export \
  --receipt /absolute/new-receipt.json
```

CI first creates the reference with the existing exporter, then runs the managed
qualification and preserves its measured receipt. The pure comparator also has
negative tests. Local results are prerequisite evidence, explicitly
`stagingAcceptance=false`. An actual Azure qualification must additionally bind
the owned staging server, private address, TLS peer, database, source/image,
export hashes and real native snapshots. It must use FINAL, pin `azuresu` as
provider grantor, preserve the raw probe result, and verify the four real
application login roles. No simulated session, Azure response, or metadata
substitution is permitted. Unexpected existing target state stops the restore.

The [measured local receipt](evidence/ue-v2-managed-pg16-local-20261110.json)
records 23,849 canonical objects, 23,878 managed objects, 21 native login denials,
the retained fixture graph difference, and both rejected privilege injections.
The comparator's 22 tests and the CLI's strict isolated typecheck also passed.
The export source in this local procedure rehearsal is recorded explicitly;
it is not current-candidate Azure acceptance. CI regenerates its own reference
and receipt on its checked-out source.
