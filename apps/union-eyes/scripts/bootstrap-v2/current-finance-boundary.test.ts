import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { storageAuthorityManifest } from '../../db/rls-storage-authority'
import { BASE_RELEASE_FINANCIAL_DECLARATION_OWNERS, reconcileCurrentAuthority, reconcileCurrentDeclarationAuthority } from './current-authority'
import { FRAMEWORK_MODEL_OWNERS, PLATFORM_METADATA_MODEL_OWNERS } from './framework-contract'
import { compileSecurity } from './security'
import { currentSecurityProjection } from '../../../../tooling/scripts/lib/union-eyes-current-security-programs'
import type { CurrentModel, V2Plan } from './source'
import { CURRENT_REWARDS_TABLES } from './rewards-storage-contract'
import { AUTHORITY_PHYSICAL_GUARDS } from '../../db/auth/authority-physical-guards'
import { sourcePhysicalTriggers } from '../../db/auth/physical-guard-catalog'

const root = path.resolve(import.meta.dirname, '../../../..')
const billingOwner = 'apps/union-eyes/backend/billing/models.py'
const plan = JSON.parse(readFileSync(path.join(root, 'docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8')) as V2Plan
const billing = plan.currentModels.models.filter(model => model.app === 'billing' || model.source === billingOwner)
const declarations = plan.tables.filter(table => Object.hasOwn(BASE_RELEASE_FINANCIAL_DECLARATION_OWNERS, table.name))
const financialJournal = plan.tables.find(table => table.name === 'ue_authority_financial_steps')!
const prior = (model: CurrentModel) => storageAuthorityManifest.find(entry => entry.table === model.table) ?? null
const sha = (value: string) => createHash('sha256').update(value).digest('hex')

describe('prospective base-release billing storage boundary', () => {
  it('covers the actual complete source-owned Django family', () => {
    expect(billing).toHaveLength(81)
    expect(new Set(billing.map(model => model.table)).size).toBe(81)
    const sourceDigest = sha(readFileSync(path.join(root, billingOwner), 'utf8'))
    for (const model of billing) {
      expect(model.app).toBe('billing')
      expect(model.source).toBe(billingOwner)
      expect(model.sourceDigest).toBe(sourceDigest)
    }
  })

  it.each(billing)('$table has no ordinary, system or invocation authority in this base release', model => {
    expect(reconcileCurrentAuthority(model, prior(model))).toMatchObject({
      table: model.table, classification: 'CONTAINED_NO_AUTHORITY',
      requiredRuntimePrivileges: [], requiredSystemPrivileges: [],
      invocationAuthority: 'NONE', dbExecutionPrincipal: 'NONE', reviewPriority: 'NONE',
    })
  })

  it('derives all eight approved finance-only declarations while retaining the actual voice quota consumer', () => {
    expect(declarations).toHaveLength(8)
    expect(Object.keys(BASE_RELEASE_FINANCIAL_DECLARATION_OWNERS)).toHaveLength(8)
    for (const table of declarations) {
      expect(table.source).toBe(BASE_RELEASE_FINANCIAL_DECLARATION_OWNERS[table.name])
      expect(reconcileCurrentDeclarationAuthority(table, table.authority)).toMatchObject({
        classification: 'CONTAINED_NO_AUTHORITY', requiredRuntimePrivileges: [], requiredSystemPrivileges: [],
        invocationAuthority: 'NONE', dbExecutionPrincipal: 'NONE', reviewPriority: 'NONE',
      })
      expect(() => reconcileCurrentDeclarationAuthority({ ...table, source: 'unreviewed-source' }, table.authority))
        .toThrow('UE_V2_FINANCIAL_DECLARATION_SOURCE_REQUIRED')
      expect(() => reconcileCurrentDeclarationAuthority({ ...table, name: 'unreviewed-table' }, table.authority))
        .toThrow('UE_V2_FINANCIAL_DECLARATION_SOURCE_REQUIRED')
    }
    const voice = plan.tables.find(table => table.name === 'voice_usage_reservations')!
    expect(voice.source).toBe('apps/union-eyes/db/schema/domains/finance/usage-metering.ts')
    expect(reconcileCurrentDeclarationAuthority(voice, voice.authority)).toBe(voice.authority)
    expect(readFileSync(path.join(root, 'apps/union-eyes/app/api/voice/upload/route.ts'), 'utf8')).toContain('reserveVoiceUsage')
  })

  it('refuses a mismatched billing application and declaring source without manufacturing authority', () => {
    const payment = billing.find(model => model.table === 'payments')!
    for (const invalid of [{ ...payment, app: 'grievances' }, { ...payment, source: 'apps/union-eyes/backend/grievances/models.py' }])
      expect(() => reconcileCurrentAuthority(invalid, prior(payment))).toThrow('BILLING_BASE_BOUNDARY_SOURCE_REQUIRED')
  })

  it('contains the source-owned financial journal without changing its shape or historical authority', () => {
    expect(financialJournal).toBeDefined()
    const before = JSON.stringify(financialJournal)
    const historical = JSON.stringify(storageAuthorityManifest)
    const authority = reconcileCurrentDeclarationAuthority(financialJournal, financialJournal.authority)
    expect(authority).toMatchObject({
      table: 'ue_authority_financial_steps', classification: 'CONTAINED_NO_AUTHORITY',
      requiredRuntimePrivileges: [], requiredSystemPrivileges: [],
      invocationAuthority: 'NONE', dbExecutionPrincipal: 'NONE', reviewPriority: 'NONE',
    })
    for (const source of ['unreviewed-source', billingOwner])
      expect(() => reconcileCurrentDeclarationAuthority({ ...financialJournal, source }, financialJournal.authority))
        .toThrow('UE_V2_FINANCIAL_STEPS_RETENTION_SOURCE_REQUIRED')
    expect(JSON.stringify(financialJournal)).toBe(before)
    expect(JSON.stringify(storageAuthorityManifest)).toBe(historical)
    const review = plan.tables.find(table => table.name === 'ue_authority_reviews')!
    expect(reconcileCurrentDeclarationAuthority(review, review.authority)).toBe(review.authority)
  })

  it('retains the independently strict donation owner and organization shape checks', () => {
    const donation = billing.find(model => model.table === 'donations')!
    const organization = donation.columns.find(column => column.name === 'organization_id')!
    for (const invalid of [
      { ...donation, source: 'unreviewed-owner' }, { ...donation, app: 'core' }, { ...donation, columns: [] },
      { ...donation, columns: [{ ...organization, notNull: false }] },
      { ...donation, columns: [{ ...organization, type: 'text' }] },
      { ...donation, columns: [{ ...organization, foreignKey: null }] },
      { ...donation, columns: [{ ...organization, foreignKey: { ...organization.foreignKey!, table: 'other' } }] },
      { ...donation, columns: [{ ...organization, foreignKey: { ...organization.foreignKey!, column: 'other' } }] },
    ]) expect(() => reconcileCurrentAuthority(invalid, prior(donation))).toThrow('UE_V2_DONATION_BASE_BOUNDARY_SOURCE_REQUIRED')
  })

  it('compiles the entire family without runtime/system or private helper grants and preserves unrelated rules', async () => {
    const projected: V2Plan = { ...plan, tables: plan.tables.map(table => {
      const model = billing.find(model => model.table === table.name)
      return model ? { ...table, authority: reconcileCurrentAuthority(model, prior(model)) }
        : { ...table, authority: reconcileCurrentDeclarationAuthority(table, table.authority) }
    }) }
    const security = compileSecurity(projected)
    expect(security.blockers).toEqual([])
    for (const model of billing) expect(security.rules.find(rule => rule.table === model.table)).toMatchObject({
      classification: 'CONTAINED_NO_AUTHORITY', runtimePrivileges: [], systemPrivileges: [], status: 'COMPLETE',
    })
    const complete = await currentSecurityProjection(projected, { postgresMajor: 15 })
    // Keep the original 81 + 8 source families separate from the additional
    // authority-kernel financial journal; retention does not authorize finance.
    const names = new Set([...billing.map(model => model.table), ...declarations.map(table => table.name), financialJournal.name])
    expect(names.size).toBe(90)
    for (const name of names) expect(security.rules.find(rule => rule.table === name)).toMatchObject({
      classification: 'CONTAINED_NO_AUTHORITY', runtimePrivileges: [], systemPrivileges: [], status: 'COMPLETE',
    })
    expect(complete.tableGrants.filter(grant => grant.schema === 'public' && names.has(grant.table) && grant.privileges.length)).toEqual([])
    expect(complete.columnGrants.filter(grant => grant.schema === 'public' && names.has(grant.table) && grant.columns.length)).toEqual([])
    for (const name of names) {
      expect(security.statements).toContain(`ALTER TABLE public."${name}" ENABLE ROW LEVEL SECURITY;`)
      expect(security.statements).toContain(`ALTER TABLE public."${name}" FORCE ROW LEVEL SECURITY;`)
    }
    // The same current constructor remains mandatory on all 22 tables,
    // including append-only, actor, lifecycle and audit journal attachments.
    expect(AUTHORITY_PHYSICAL_GUARDS.tables).toHaveLength(22)
    const triggers = sourcePhysicalTriggers([AUTHORITY_PHYSICAL_GUARDS])
    expect(triggers.filter(trigger => trigger.table_name === financialJournal.name).map(trigger => trigger.name).sort())
      .toEqual(['ue_authority_guard_actor', 'ue_authority_guard_insert', 'ue_authority_guard_update', 'ue_authority_no_delete', 'ue_authority_no_truncate', 'ue_authority_record_event'])
    for (const trigger of triggers) expect(complete.requiredPhysicalTriggers).toContainEqual(trigger)
    const original = compileSecurity(plan)
    for (const rule of original.rules.filter(rule => !names.has(rule.table)))
      expect(security.rules.find(current => current.table === rule.table), rule.table).toEqual(rule)
  })

  it('preserves historical registry bytes and the ordinary nonfinancial source decisions', () => {
    const before = JSON.stringify(storageAuthorityManifest)
    const special = new Set([...CURRENT_REWARDS_TABLES, ...Object.keys(PLATFORM_METADATA_MODEL_OWNERS), ...Object.keys(FRAMEWORK_MODEL_OWNERS),
      'arbitration_decisions', 'signature_audit_trail', 'claim_status_transitions', 'users', 'oauth_providers', 'evidence_packs', 'evidence_artifacts'])
    for (const model of plan.currentModels.models.filter(model => model.app !== 'billing' && model.source !== billingOwner && !special.has(model.table))) {
      const inherited = prior(model)
      expect(reconcileCurrentAuthority(model, inherited)).toBe(inherited)
    }
    expect(JSON.stringify(storageAuthorityManifest)).toBe(before)
    expect(Object.keys(PLATFORM_METADATA_MODEL_OWNERS).sort()).toEqual(['failed_login_attempts', 'rate_limit_events'])
  })

  it('routes billing models through the ordinary denied connection while real security metadata keeps its private context', () => {
    const script = `import ast,json,sys,types
tree=ast.parse(open(sys.argv[1]).read())
names={'FRAMEWORK_APPS','PLATFORM_METADATA_TABLES'}
nodes=[n for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id in names for t in n.targets) or isinstance(n,ast.ClassDef) and n.name=='CanonicalDatabaseRouter']
scope={'settings':types.SimpleNamespace(UE_V2_PROCESS_CONTEXT='web')}
exec(compile(ast.Module(body=nodes,type_ignores=[]),sys.argv[1],'exec'),scope)
router=scope['CanonicalDatabaseRouter']()
def route(app,table):return router.db_for_read(types.SimpleNamespace(_meta=types.SimpleNamespace(app_label=app,db_table=table)))
print(json.dumps({'chart':route('billing','clc_chart_of_accounts'),'payments':route('billing','payments'),'login':route('core','failed_login_attempts'),'rate':route('core','rate_limit_events'),'auth':route('auth','auth_user'),'tables':sorted(scope['PLATFORM_METADATA_TABLES'])}))`
    const result = JSON.parse(execFileSync('python', ['-c', script, path.join(root, 'apps/union-eyes/backend/auth_core/canonical_context.py')], { encoding: 'utf8' }))
    expect(result).toEqual({ chart: 'default', payments: 'default', login: 'ue_framework_request', rate: 'ue_framework_request',
      auth: 'ue_framework_request', tables: ['failed_login_attempts', 'rate_limit_events'] })
  })
})
