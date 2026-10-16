import { ProvisioningError } from './governed-provisioning'
import { replayDigest } from './post-w4p-replay'
import { Cursor } from './replay-structural-effects'
import type { CatalogReader } from './platform-baseline-promotion'
function requireCondition(value: unknown, code: string): asserts value {
  if (!value) throw new ProvisioningError(code)
}
export type AclObjectKind = 'SCHEMA' | 'TABLE' | 'SEQUENCE'
export interface AclObjectIdentity {
  schema: string
  name: string
  kind: AclObjectKind
  grantor: string
}
export interface AclPositionAuthority {
  sourceHash: string
  actor: string
  defaultOwner: string
  objects: AclObjectIdentity[]
}
export function compileAclEffect(source: string, sourceHash: string) {
  const cursor = new Cursor(source, sourceHash)
  let defaults = false,
    schema: string | null = null
  if (cursor.optionalWord('ALTER')) {
    defaults = true
    cursor.word('DEFAULT')
    cursor.word('PRIVILEGES')
    cursor.word('IN')
    cursor.word('SCHEMA')
    schema = cursor.identifier()
  }
  const action = cursor.identifier().toUpperCase()
  requireCondition(
    ['GRANT', 'REVOKE'].includes(action) && (!defaults || action === 'REVOKE'),
    'REPLAY_ACL_GRAMMAR_UNSUPPORTED',
  )
  const privileges = [cursor.identifier().toUpperCase()]
  while (cursor.tokens[cursor.index]?.value === ',') {
    cursor.symbol(',')
    privileges.push(cursor.identifier().toUpperCase())
  }
  cursor.word('ON')
  let all = false,
    name: string | null = null,
    kind: AclObjectKind
  if (defaults) {
    const target = cursor.identifier().toUpperCase()
    requireCondition(['TABLES', 'SEQUENCES'].includes(target), 'REPLAY_ACL_GRAMMAR_UNSUPPORTED')
    kind = target === 'TABLES' ? 'TABLE' : 'SEQUENCE'
    all = true
  } else if (cursor.optionalWord('ALL')) {
    all = true
    const target = cursor.identifier().toUpperCase()
    requireCondition(['TABLES', 'SEQUENCES'].includes(target), 'REPLAY_ACL_GRAMMAR_UNSUPPORTED')
    kind = target === 'TABLES' ? 'TABLE' : 'SEQUENCE'
    cursor.word('IN')
    cursor.word('SCHEMA')
    schema = cursor.identifier()
  } else if (cursor.optionalWord('SCHEMA')) {
    kind = 'SCHEMA'
    schema = cursor.identifier()
    name = schema
  } else {
    cursor.word('TABLE')
    kind = 'TABLE'
    const relation = cursor.relation()
    schema = relation.schema
    name = relation.name
  }
  cursor.word(action === 'GRANT' ? 'TO' : 'FROM')
  const roles = [cursor.identifier()]
  while (cursor.tokens[cursor.index]?.value === ',') {
    cursor.symbol(',')
    roles.push(cursor.identifier())
  }
  cursor.finish()
  requireCondition(
    action !== 'GRANT' || !privileges.includes('ALL'),
    'REPLAY_ACL_GRANT_ALL_NOT_SUPPORTED',
  )
  const allowed =
    kind === 'SCHEMA'
      ? ['USAGE', 'CREATE']
      : kind === 'SEQUENCE'
        ? ['USAGE', 'SELECT', 'UPDATE']
        : ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']
  requireCondition(
    new Set(privileges).size === privileges.length &&
      new Set(roles).size === roles.length &&
      ((privileges.length === 1 && privileges[0] === 'ALL') ||
        privileges.every((privilege) => allowed.includes(privilege))),
    'REPLAY_ACL_GRAMMAR_UNSUPPORTED',
  )
  const body = {
    action,
    defaults,
    all,
    kind,
    schema,
    name,
    privileges: privileges.sort(),
    roles: roles.sort(),
    sourceHash,
  }
  return { ...body, contractDigest: replayDigest(body) }
}
export const aclQueries = {
  actor: 'SELECT current_user::text AS actor',
  role: 'SELECT rolname AS name FROM pg_catalog.pg_roles WHERE rolname=$1',
  objects: `SELECT n.nspname AS schema,c.relname AS name,CASE WHEN c.relkind='S' THEN 'SEQUENCE' ELSE 'TABLE' END AS kind
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1
    AND CASE WHEN $2='SEQUENCE' THEN c.relkind='S' ELSE c.relkind IN('r','p','v','m','f') END ORDER BY c.relname`,
  schema: `SELECT n.nspname AS name FROM pg_catalog.pg_namespace n WHERE n.nspname=$1`,
  table: `SELECT c.relname AS name,c.relkind AS kind FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=$2`,
  tableAcl: `SELECT grantor.rolname AS grantor,CASE WHEN acl.grantee=0 THEN 'public' ELSE grantee.rolname END AS grantee,
    acl.privilege_type AS privilege,acl.is_grantable AS grantable
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(c.relacl,pg_catalog.acldefault(CASE WHEN c.relkind='S' THEN 's'::"char" ELSE 'r'::"char" END,c.relowner))) acl
    LEFT JOIN pg_catalog.pg_roles grantor ON grantor.oid=acl.grantor LEFT JOIN pg_catalog.pg_roles grantee ON grantee.oid=acl.grantee
    WHERE n.nspname=$1 AND c.relname=$2 ORDER BY grantor.rolname,grantee.rolname,acl.privilege_type,acl.is_grantable`,
  schemaAcl: `SELECT grantor.rolname AS grantor,CASE WHEN acl.grantee=0 THEN 'public' ELSE grantee.rolname END AS grantee,
    acl.privilege_type AS privilege,acl.is_grantable AS grantable
    FROM pg_catalog.pg_namespace n CROSS JOIN LATERAL pg_catalog.aclexplode(COALESCE(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) acl
    LEFT JOIN pg_catalog.pg_roles grantor ON grantor.oid=acl.grantor LEFT JOIN pg_catalog.pg_roles grantee ON grantee.oid=acl.grantee
    WHERE n.nspname=$1 ORDER BY grantor.rolname,grantee.rolname,acl.privilege_type,acl.is_grantable`,
  defaultAcl: `SELECT grantor.rolname AS grantor,CASE WHEN acl.grantee=0 THEN 'public' ELSE grantee.rolname END AS grantee,
    acl.privilege_type AS privilege,acl.is_grantable AS grantable
    FROM pg_catalog.pg_default_acl d JOIN pg_catalog.pg_roles owner ON owner.oid=d.defaclrole JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) acl
    LEFT JOIN pg_catalog.pg_roles grantor ON grantor.oid=acl.grantor LEFT JOIN pg_catalog.pg_roles grantee ON grantee.oid=acl.grantee
    WHERE n.nspname=$1 AND owner.rolname=$2 AND d.defaclobjtype=$3::"char"
    ORDER BY grantor.rolname,grantee.rolname,acl.privilege_type,acl.is_grantable`,
}
function row(value: unknown): Record<string, unknown> {
  requireCondition(
    value && typeof value === 'object' && !Array.isArray(value),
    'REPLAY_ACL_CATALOG_ROW_INVALID',
  )
  return Object.fromEntries(Object.entries(value))
}
export async function inspectAclEffect(
  reader: CatalogReader,
  spec: ReturnType<typeof compileAclEffect>,
  authority: AclPositionAuthority | undefined,
) {
  const observe = (
    definition: 'EXACT' | 'ABSENT' | 'DRIFTED' | 'PRECONDITION_MISSING',
    data: unknown,
  ) => ({
    definition,
    stateDigest: replayDigest({ contractDigest: spec.contractDigest, definition, data }),
  })
  if (
    !authority ||
    authority.sourceHash !== spec.sourceHash ||
    !authority.actor ||
    !authority.defaultOwner ||
    authority.objects.some(
      (object) =>
        !object.grantor ||
        !object.schema ||
        !object.name ||
        !['SCHEMA', 'TABLE', 'SEQUENCE'].includes(object.kind),
    )
  )
    return observe('PRECONDITION_MISSING', { authority: null })
  const actor = await reader.query(aclQueries.actor, [])
  requireCondition(
    actor.length === 1 && typeof row(actor[0]).actor === 'string',
    'REPLAY_ACL_CATALOG_ROW_INVALID',
  )
  if (row(actor[0]).actor !== authority.actor) return observe('PRECONDITION_MISSING', { actor })
  if (spec.defaults && authority.defaultOwner !== authority.actor)
    return observe('PRECONDITION_MISSING', { defaultOwner: authority.defaultOwner })
  for (const name of spec.roles) {
    if (name === 'public') continue
    const rows = await reader.query(aclQueries.role, [name])
    requireCondition(rows.length <= 1, 'REPLAY_ACL_CATALOG_CARDINALITY_INVALID')
    if (!rows.length) return observe('PRECONDITION_MISSING', { role: name })
    requireCondition(row(rows[0]).name === name, 'REPLAY_ACL_CATALOG_ROW_INVALID')
  }
  const namespace = await reader.query(aclQueries.schema, [spec.schema!])
  requireCondition(namespace.length <= 1, 'REPLAY_ACL_CATALOG_CARDINALITY_INVALID')
  if (!namespace.length) return observe('PRECONDITION_MISSING', { schema: spec.schema })
  requireCondition(row(namespace[0]).name === spec.schema, 'REPLAY_ACL_CATALOG_ROW_INVALID')
  let objects = authority.objects.filter(
    (object) =>
      object.schema === spec.schema &&
      object.kind === spec.kind &&
      (spec.all || object.name === spec.name),
  )
  if (spec.defaults) {
    objects = [
      {
        schema: spec.schema!,
        name: 'DEFAULT_PRIVILEGES',
        kind: spec.kind,
        grantor: authority.defaultOwner,
      },
    ]
  } else if (spec.all) {
    const actual = (await reader.query(aclQueries.objects, [spec.schema!, spec.kind])).map(row)
    requireCondition(
      actual.every(
        (object) =>
          typeof object.schema === 'string' &&
          typeof object.name === 'string' &&
          ['TABLE', 'SEQUENCE'].includes(String(object.kind)),
      ),
      'REPLAY_ACL_CATALOG_ROW_INVALID',
    )
    const identities = (entries: { schema: unknown; name: unknown; kind: unknown }[]) =>
      entries.map((entry) => `${entry.schema}.${entry.name}:${entry.kind}`).sort()
    const actualIdentities = actual.map((entry) => ({
      schema: entry.schema,
      name: entry.name,
      kind: entry.kind,
    }))
    if (
      new Set(identities(objects)).size !== objects.length ||
      replayDigest(identities(actualIdentities)) !== replayDigest(identities(objects))
    )
      return observe('PRECONDITION_MISSING', { inventory: actual })
  } else if (objects.length !== 1)
    return observe('PRECONDITION_MISSING', { objectAuthority: objects })
  const evidence: unknown[] = []
  let required = false
  for (const object of objects) {
    if (!spec.defaults && spec.kind !== 'SCHEMA') {
      const rows = await reader.query(aclQueries.table, [object.schema, object.name])
      requireCondition(rows.length <= 1, 'REPLAY_ACL_CATALOG_CARDINALITY_INVALID')
      if (!rows.length) return observe('PRECONDITION_MISSING', { object })
      const actual = row(rows[0])
      requireCondition(
        typeof actual.name === 'string' && typeof actual.kind === 'string',
        'REPLAY_ACL_CATALOG_ROW_INVALID',
      )
      if (
        actual.name !== object.name ||
        (object.kind === 'SEQUENCE'
          ? actual.kind !== 'S'
          : !['r', 'p', 'v', 'm', 'f'].includes(actual.kind))
      )
        return observe('DRIFTED', { object: actual })
    }
    const raw = spec.defaults
      ? await reader.query(aclQueries.defaultAcl, [
          object.schema,
          authority.defaultOwner,
          spec.kind === 'TABLE' ? 'r' : 'S',
        ])
      : await reader.query(
          spec.kind === 'SCHEMA' ? aclQueries.schemaAcl : aclQueries.tableAcl,
          spec.kind === 'SCHEMA' ? [object.schema] : [object.schema, object.name],
        )
    const acl = raw.map(row)
    requireCondition(
      acl.every(
        (entry) =>
          typeof entry.grantor === 'string' &&
          typeof entry.grantee === 'string' &&
          typeof entry.privilege === 'string' &&
          typeof entry.grantable === 'boolean',
      ),
      'REPLAY_ACL_CATALOG_ROW_INVALID',
    )
    const owned = acl.filter(
      (entry) =>
        entry.grantor === object.grantor &&
        spec.roles.includes(String(entry.grantee)) &&
        (spec.privileges.includes('ALL') || spec.privileges.includes(String(entry.privilege))),
    )
    if (spec.action === 'REVOKE') {
      if (owned.length) required = true
    } else {
      for (const grantee of spec.roles)
        for (const privilege of spec.privileges)
          if (!owned.some((entry) => entry.grantee === grantee && entry.privilege === privilege))
            required = true
    }
    evidence.push({ object, owned })
  }
  return observe(required ? 'ABSENT' : 'EXACT', evidence)
}
