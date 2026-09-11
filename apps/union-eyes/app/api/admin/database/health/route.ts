/**
 * GET /api/admin/database/health
 * Returns database health metrics: size, connection count, table stats,
 * and — for the RLS tenant-isolation foundation (docs/union-eyes/reality-
 * remediation/26, PR #751/#752) — the effective database principal each
 * connection actually uses. A successful CI preflight against Key-Vault-
 * sourced credentials proves those credentials and the database policy
 * state are correct; it does not by itself prove the *deployed container*
 * picked them up. This endpoint is the operator-facing way to confirm that:
 * call it after a deploy and confirm tenantPrincipal.currentUser is
 * "union_eyes_runtime" (not "nzilaadmin") and systemPrincipal.currentUser
 * is "union_eyes_system". Never returns rolpassword or any connection
 * string — only role name/attributes, matching the reviewer's specified
 * non-secret evidence set (current_user, rolsuper, rolbypassrls,
 * application_name).
 */
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

interface PrincipalInfo {
  currentUser: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
  applicationName: string | null;
}

async function readPrincipal(): Promise<PrincipalInfo> {
  const identityResult = await db.execute(
    sql`SELECT current_user as u, current_setting('application_name', true) as app_name`
  );
  const identityRow = Array.from(identityResult)[0] as Record<string, unknown> | undefined;
  const currentUser = String(identityRow?.u ?? 'unknown');

  const attrsResult = await db.execute(
    sql`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`
  );
  const attrsRow = Array.from(attrsResult)[0] as Record<string, unknown> | undefined;

  return {
    currentUser,
    rolsuper: Boolean(attrsRow?.rolsuper),
    rolbypassrls: Boolean(attrsRow?.rolbypassrls),
    applicationName: (identityRow?.app_name as string | null) ?? null,
  };
}

export const GET = withApi(
  { auth: { required: true, minRole: 'platform_lead' } },
  async () => {
    // Outside of withSystemContext(), the module-level `db` import resolves
    // to the ordinary tenant connection (union_eyes_runtime post-remediation) —
    // see db/system-context-storage.ts.
    const tenantPrincipal = await readPrincipal();
    const systemPrincipal = await withSystemContext(() => readPrincipal());

    return withSystemContext(async () => {
    const sizeResult = await db.execute(
      sql`SELECT pg_database_size(current_database()) as db_size`
    );
    const sizeRows = Array.from(sizeResult);
    const dbSizeBytes = Number((sizeRows[0] as Record<string, unknown>)?.db_size ?? 0);

    const connResult = await db.execute(
      sql`SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active'`
    );
    const connRows = Array.from(connResult);
    const activeConnections = Number((connRows[0] as Record<string, unknown>)?.active_connections ?? 0);

    const tableResult = await db.execute(
      sql`SELECT count(*) as table_count FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const tableRows = Array.from(tableResult);
    const tableCount = Number((tableRows[0] as Record<string, unknown>)?.table_count ?? 0);

    return {
      success: true,
      dbSizeBytes,
      dbSizeMb: Number((dbSizeBytes / (1024 * 1024)).toFixed(2)),
      activeConnections,
      tableCount,
      status: 'healthy',
      checkedAt: new Date().toISOString(),
      tenantPrincipal,
      systemPrincipal,
    };
  });
  },
);


