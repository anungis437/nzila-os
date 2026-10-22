/**
 * Reviewed clone-only execution adapter, NOT byte-identical execution of 0017.
 * The immutable source hash identifies the source artifact in the normal ledger.
 * A separate same-transaction receipt records the exact transformed statement.
 * No production/default execution path uses this adapter.
 */
import crypto from 'node:crypto'

export const TAG = '0017_snapshot_authority_reconciliation'
export const SOURCE_HASH = '1b383028f528daa86b079662688d072e9c60ac9e96ce607810449b9148c27f48'
export const ORIGINAL_STATEMENT_HASH = 'b3e33c3c4cccfd00a9852c6aadc170eaca41063cc149b96c1809e0bdca011c8d'
export const ROLE = 'ue_framework_authority_reader'
export const SCHEMA = 'user_management'
export const digest = (value) => crypto.createHash('sha256').update(value).digest('hex')
const firstOwner = "    EXECUTE 'ALTER FUNCTION user_management.ue_framework_actor_authorized() OWNER TO ue_framework_authority_reader';"
const secondOwner = "    EXECUTE 'ALTER FUNCTION user_management.ue_framework_admin_authorized() OWNER TO ue_framework_authority_reader';"
const ownership = firstOwner + '\n' + secondOwner
const grant = `    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'user_management' AND pg_get_userbyid(nspowner) = current_user) THEN
      RAISE EXCEPTION '0017 handoff requires actual user_management schema owner';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ue_framework_authority_reader' AND
      (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)) THEN
      RAISE EXCEPTION '0017 handoff reader role attributes unsafe';
    END IF;
    IF has_schema_privilege('ue_framework_authority_reader', 'user_management', 'CREATE') THEN
      RAISE EXCEPTION '0017 handoff unexpected pre-existing effective CREATE';
    END IF;
    ue_handoff_membership_added := NOT pg_has_role(current_user, 'ue_framework_authority_reader', 'MEMBER');
    IF ue_handoff_membership_added THEN
      EXECUTE format('GRANT ue_framework_authority_reader TO %I', current_user);
    END IF;
    EXECUTE 'GRANT CREATE ON SCHEMA user_management TO ue_framework_authority_reader';`
const revoke = `    EXECUTE 'REVOKE CREATE ON SCHEMA user_management FROM ue_framework_authority_reader';
    IF ue_handoff_membership_added THEN
      EXECUTE format('REVOKE ue_framework_authority_reader FROM %I', current_user);
    END IF;
    IF has_schema_privilege('ue_framework_authority_reader', 'user_management', 'CREATE') THEN
      RAISE EXCEPTION '0017 handoff CREATE cleanup failed';
    END IF;`

export function ownershipPlan({ tag, sourceHash, statement, index, role = ROLE, schema = SCHEMA }) {
  if (tag !== TAG || sourceHash !== SOURCE_HASH || index !== 5 || digest(statement) !== ORIGINAL_STATEMENT_HASH || role !== ROLE || schema !== SCHEMA) {
    throw new Error('0017 handoff source/statement/role/schema binding refused')
  }
  if (statement.split(ownership).length !== 2 || statement.split('DECLARE\n').length !== 2 ||
      statement.split(firstOwner).length !== 2 || statement.split(secondOwner).length !== 2) {
    throw new Error('0017 handoff unexpected literal count')
  }
  const executed = statement.replace('DECLARE\n', 'DECLARE\n  ue_handoff_membership_added boolean;\n')
    .replace(ownership, grant + '\n' + ownership + '\n' + revoke)
  return { statement: executed, sourceHash, originalStatementHash: digest(statement),
    executedStatementHash: digest(executed), exactPatch: { declaration: 'ue_handoff_membership_added boolean;', grant, original: ownership, revoke } }
}

/** Called by the canonical executor only inside its existing 0017 transaction. */
export async function executeOwnershipHandoff(client, { context, tag, sourceHash, statement, index }) {
  const { validateRecoveryContext } = await import('./ue-staging-historical-lineage.mjs')
  const validatedContext = await validateRecoveryContext(client, context)
  const plan = ownershipPlan({ tag, sourceHash, statement, index })
  const identity = (await client.query(`SELECT current_user AS current_user, session_user AS session_user,
    current_database() AS database, (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser`)).rows[0]
  if (identity.superuser || identity.database !== validatedContext.target.database) throw new Error('0017 handoff requires the authorized non-superuser migration identity')
  const memberships = (await client.query(`SELECT parent.rolname AS role, member.rolname AS member, m.admin_option
    FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles member ON member.oid=m.member
    WHERE parent.rolname='ue_framework_authority_reader' ORDER BY member.rolname`)).rows
  await client.query(plan.statement)
  const afterMemberships = (await client.query(`SELECT parent.rolname AS role, member.rolname AS member, m.admin_option
    FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles member ON member.oid=m.member
    WHERE parent.rolname='ue_framework_authority_reader' ORDER BY member.rolname`)).rows
  if (JSON.stringify(memberships) !== JSON.stringify(afterMemberships)) throw new Error('0017 handoff changed durable reader membership')
  const attributes = (await client.query(`SELECT rolname, rolcanlogin, rolinherit, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole,
    has_schema_privilege(rolname,'user_management','CREATE') AS schema_create FROM pg_roles WHERE rolname='ue_framework_authority_reader'`)).rows
  if (attributes.length !== 1 || Object.entries(attributes[0]).some(([key, value]) => key !== 'rolname' && value !== false)) throw new Error('0017 handoff reader privilege cleanup failed')
  const owners = (await client.query(`SELECT p.proname, r.rolname AS owner FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
    WHERE n.nspname='user_management' AND p.proname IN ('ue_framework_actor_authorized','ue_framework_admin_authorized') AND p.pronargs=0 ORDER BY p.proname`)).rows
  if (owners.length !== 2 || owners.some((owner) => owner.owner !== ROLE)) throw new Error('0017 handoff function owner mismatch')
  const schemaOwner = (await client.query("SELECT pg_get_userbyid(nspowner) AS owner FROM pg_namespace WHERE nspname='user_management'")).rows[0]?.owner
  if (schemaOwner !== identity.current_user) throw new Error('0017 handoff changed schema ownership')
  await client.query(`CREATE TABLE IF NOT EXISTS drizzle.ue_staging_execution_adapters
    (adapter_id text PRIMARY KEY, payload jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now())`)
  const { statement: _statement, ...evidence } = plan
  await client.query(`INSERT INTO drizzle.ue_staging_execution_adapters (adapter_id,payload) VALUES ('0017-owner-handoff-v1',$1::jsonb)`,
    [JSON.stringify({ ...evidence, targetHost: validatedContext.target.host, qualificationSha256: validatedContext.target.qualificationSha256, executor: identity, membershipsBefore: memberships, membershipsAfter: afterMemberships,
      readerAttributes: attributes, functionOwners: owners, schemaOwner, executionBytesIdenticalToSource: false, qualification: 'OWNERSHIP_HANDOFF_ONLY' })])
}
