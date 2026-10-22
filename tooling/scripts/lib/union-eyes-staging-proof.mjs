import crypto from 'node:crypto'

export const COUNT_NAMES = ['fixtureA', 'fixtureB', 'ownA', 'aReadsB', 'ownB', 'bReadsA', 'emptyContext']
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')

// Only explicit framed results count. Tags are permitted for regression coverage
// even though production uses psql -q. Never mine a number out of arbitrary text.
export function parsePsqlFrames(stdout, stderr, status, expected) {
  if (status !== 0 || stderr.trim()) throw new Error('PSQL_EXECUTION_FAILED')
  const values = {}
  for (const line of stdout.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
    if (/^(BEGIN|ROLLBACK|SET|DO)$/.test(line)) continue
    const match = /^UE_([A-Za-z]+)=(.*)$/.exec(line)
    if (!match || !expected.includes(match[1]) || Object.hasOwn(values, match[1])) throw new Error('PSQL_RESULT_INVALID')
    values[match[1]] = match[2]
  }
  if (Object.keys(values).length !== expected.length) throw new Error('PSQL_RESULT_MISSING')
  return values
}

export function numericCount(value) {
  if (!/^(0|[1-9][0-9]*)$/.test(value ?? '') || !Number.isSafeInteger(Number(value))) throw new Error('PSQL_COUNT_INVALID')
  return Number(value)
}

export function fixtureDefects(fixture, approval) {
  const a = fixture?.tenantA
  const b = fixture?.tenantB
  if (!fixture || fixture.environment !== 'staging' || fixture.synthetic !== true || fixture.allowRolledBackWriteProbe !== true
    || typeof fixture.fixtureId !== 'string' || !fixture.fixtureId.trim()
    || typeof fixture.databaseName !== 'string' || !fixture.databaseName.trim()
    || !fixture.databaseBaseline || fixture.databaseBaseline !== approval?.databaseBaseline
    || ![a?.organizationId, a?.userId, a?.recordId, b?.organizationId, b?.userId, b?.recordId].every((id) => UUID_RE.test(id ?? ''))
    || a.organizationId === b.organizationId || a.userId === b.userId || a.recordId === b.recordId) return ['STAGING_RLS_FIXTURE_UNVERIFIED']
  return []
}

export function databaseProofId(proof) {
  const { evidenceId: _id, ...body } = proof
  return sha256(JSON.stringify(body))
}

export function isolationDefects(proof, approval, manifest) {
  const defects = fixtureDefects(proof?.fixture, approval)
  if (!proof || proof.kind !== 'database-isolation' || proof.source !== 'deployed-database' || proof.transport !== 'postgres'
    || proof.candidateRevision !== undefined || proof.servingRevisionReached !== undefined
    || proof.releaseSha !== manifest?.releaseSha || proof.databaseBaseline !== approval?.databaseBaseline
    || !proof.evidenceId || proof.evidenceId !== databaseProofId(proof)
    || proof.test !== 'grievances-two-tenant-v1' || typeof proof.executedSql !== 'string'
    || proof.executedSqlSha256 !== sha256(proof.executedSql ?? '') || !proof.observedAt
    || JSON.stringify(proof.fixture) !== JSON.stringify(approval?.acceptanceFixture)) defects.push('STAGING_RLS_DATABASE_BINDING_INVALID')
  const identity = proof?.identity
  if (identity?.currentUser !== 'union_eyes_runtime' || identity?.sessionUser !== 'union_eyes_runtime'
    || identity?.rolsuper !== false || identity?.rolbypassrls !== false
    || identity?.databaseName !== proof?.fixture?.databaseName) defects.push('STAGING_RLS_CONNECTION_IDENTITY_INVALID')
  const counts = proof?.counts ?? {}
  if (COUNT_NAMES.some((name) => !Number.isSafeInteger(counts[name]) || counts[name] < 0)
    || counts.fixtureA !== 1 || counts.fixtureB !== 1 || counts.ownA !== 1 || counts.ownB !== 1
    || counts.aReadsB !== 0 || counts.bReadsA !== 0 || counts.emptyContext !== 0
    || proof?.forgedWrites?.aToB !== '42501' || proof?.forgedWrites?.bToA !== '42501') defects.push('STAGING_RLS_TENANT_DENIAL_FAILED')
  return defects
}

export function candidateCorrelationDefects(input, proof) {
  if (input.phase !== 'probe') return []
  const probe = input.probe
  const binding = probe?.databaseProof
  const adminBody = probe?.responses?.find((item) => item.path === '/api/admin/database/health')?.body ?? {}
  const admin = adminBody.data ?? adminBody
  if (!binding || binding.evidenceId !== proof?.evidenceId || binding.databaseBaseline !== proof?.databaseBaseline
    || binding.releaseSha !== proof?.releaseSha || binding.runtimePrincipal !== proof?.identity?.currentUser
    || admin.tenantPrincipal?.databaseName !== proof?.identity?.databaseName
    || admin.systemPrincipal?.databaseName !== proof?.identity?.databaseName
    || admin.systemPrincipal?.rolsuper !== false || admin.systemPrincipal?.rolbypassrls !== false) return ['STAGING_RLS_CANDIDATE_EVIDENCE_MISSING']
  return []
}
