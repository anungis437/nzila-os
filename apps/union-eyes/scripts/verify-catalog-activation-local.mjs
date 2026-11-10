// One-off local verification: runs the REAL activateCatalogPrivileges against a disposable local Postgres 16
// database (partially bootstrapped: roles + scoped 0000-0013 + platform 0001-0013 + manually-applied platform 0085
// and its RLS closure 0059), to prove the "public.ue_verified_dependency_evidence is unclassified" regression is
// fixed by a real GRANT activation on a real server, not just a registry-file read.
import pg from 'pg';
import { activateCatalogPrivileges } from '../../../tooling/scripts/lib/union-eyes-catalog-authority.mjs';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const result = await activateCatalogPrivileges(client, { repoRoot: process.cwd() + '/../..', enforce: true });
  console.log('ACTIVATION_OK', JSON.stringify(result));
} catch (error) {
  console.log('ACTIVATION_FAILED', error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
