import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { is } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import * as authorityDeclarations from '../../db/schema/domains/ml/authority-kernel'
import { AUTHORITY_PHYSICAL_GUARDS } from '../../db/auth/authority-physical-guards'
import { REWARD_NOMINATION_GUARDS } from '../../db/auth/reward-nomination-guards'
import { sourcePhysicalTriggers } from '../../db/auth/physical-guard-catalog'
import { compileQueuedCaseMailSql, QUEUED_CASE_MAIL_OPERATION } from '../../db/auth/queued-case-mail'
import { projectSourcePhysicalTriggers } from './physical-trigger-source'
import type { V2Plan } from './source'
import { currentSecurityPrograms, CURRENT_CASE_GUARDS } from '../../../../tooling/scripts/lib/union-eyes-current-security-programs'
import { compileSecurity } from './security'
import { EXTERNAL_READ_TRIGGER_TABLES } from '../../lib/external-resource-read/source'
import { MESSAGING_GUARD_TRIGGERS } from '../../db/auth/messaging-physical-guards'

const plan = JSON.parse(readFileSync(new URL('../../../../docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json', import.meta.url),'utf8')) as V2Plan
const owners: Record<string,string> = Object.fromEntries(plan.tables.map(table => [table.name.includes('.') ? table.name : `public.${table.name}`, 'ue_v2_owner']))
for (const value of Object.values(authorityDeclarations)) if (is(value,PgTable)) {
  const table=getTableConfig(value)
  owners[`${table.schema??'public'}.${table.name}`]='ue_v2_owner'
}
const queued = compileQueuedCaseMailSql()

describe('complete current trigger source projection', () => {
  it('parses the complete current retained authority constructor without observing any database', async () => {
    const declared=Object.values(authorityDeclarations).filter(value=>is(value,PgTable)).map(value=>getTableConfig(value).name)
    expect(AUTHORITY_PHYSICAL_GUARDS.tables.every(table=>declared.includes(table))).toBe(true)
    const actual=await projectSourcePhysicalTriggers([AUTHORITY_PHYSICAL_GUARDS],[],owners)
    expect(actual).toHaveLength(AUTHORITY_PHYSICAL_GUARDS.triggers.length)
    expect(actual).toEqual(sourcePhysicalTriggers([AUTHORITY_PHYSICAL_GUARDS]).sort((a,b)=>`${a.schema}.${a.table_name}|${a.name}`.localeCompare(`${b.schema}.${b.table_name}|${b.name}`)))
    for(const table of ['ue_authority_workaid_matters','ue_authority_counsel_engagements','ue_authority_financial_steps','ue_authority_workaid_consent_text_proposals'])
      expect(actual.some(trigger=>trigger.table_name===table),table).toBe(true)
  })

  it('includes all sixteen current queued-mail attachments and their namespaces/exact source predicate',async()=>{
    const triggers=await projectSourcePhysicalTriggers([], [queued],owners)
    expect(triggers).toHaveLength(16)
    expect(triggers.filter(trigger=>trigger.schema==='user_management').map(trigger=>trigger.table_name).sort())
      .toEqual(['organization_users','user_sessions','users'])
    expect(triggers.find(trigger=>trigger.name==='ue_record_queued_mail_capability')).toMatchObject({
      schema:'public',table_name:'ue_authority_requests',function_schema:'public',function_name:'ue_authority_record_event',
      table_owner:'ue_v2_owner',tgtype:5,is_constraint:false,columns:[],old_table:null,new_table:null,
      condition:{kind:'text-equality',row:'new',column:'operation',value:QUEUED_CASE_MAIL_OPERATION},
    })
  })

  it('projects the actual complete flattened compiler programs, including every external and messaging trigger',async()=>{
    const programs=currentSecurityPrograms(plan,{postgresMajor:15})
    const sourcePrograms=[...compileSecurity(plan).statements,...programs.auth,programs.framework,
      ...programs.companions,...programs.guardFunctions,...programs.messaging,
      programs.externalRead.prepare,programs.externalRead.install,programs.externalRead.authBridge,programs.externalRead.finalize]
    const triggers=await projectSourcePhysicalTriggers(CURRENT_CASE_GUARDS,sourcePrograms,owners)
    const identities=new Set(triggers.map(trigger=>`${trigger.schema}.${trigger.table_name}|${trigger.name}`))
    expect(identities.size).toBe(triggers.length)
    for(const trigger of EXTERNAL_READ_TRIGGER_TABLES)
      expect(identities.has(`public.${trigger.table}|${trigger.name}`),trigger.name).toBe(true)
    for(const trigger of MESSAGING_GUARD_TRIGGERS)
      expect(identities.has(`public.${trigger.table}|${trigger.name}`),trigger.name).toBe(true)
    expect(triggers.filter(trigger=>trigger.schema==='user_management').map(trigger=>`${trigger.table_name}|${trigger.name}`).sort())
      .toEqual([
        'organization_users|auth_revoke_invites_on_membership_change',
        'organization_users|ue_lock_queued_mail_authority',
        'user_sessions|ue_lock_queued_mail_authority',
        'users|auth_revoke_invites_on_user_change',
        'users|ue_lock_queued_mail_authority',
      ])
    expect(triggers.find(trigger=>trigger.name==='auth_revoke_invites_on_user_change')?.columns).toEqual(['is_active','lifecycle_state'])
    expect(triggers.find(trigger=>trigger.name==='auth_revoke_invites_on_membership_change')?.columns).toEqual(['role','is_active'])
    expect(triggers.filter(trigger=>trigger.name==='ue_record_queued_mail_capability')).toHaveLength(1)
  })

  it('preserves independent row/statement, constraint, event, update-column, transition and argument metadata',async()=>{
    const sql=`CREATE CONSTRAINT TRIGGER source_constraint AFTER INSERT ON public.recognition_awards DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.source_guard('it''s exact','');
      CREATE TRIGGER source_columns BEFORE UPDATE OF status,reason ON public.recognition_awards FOR EACH ROW EXECUTE FUNCTION public.source_guard();
      CREATE TRIGGER source_transition AFTER UPDATE ON public.recognition_awards REFERENCING OLD TABLE AS prior_rows NEW TABLE AS next_rows FOR EACH STATEMENT EXECUTE FUNCTION public.source_guard();`
    const triggers=await projectSourcePhysicalTriggers([], [sql],owners)
    expect(triggers.find(trigger=>trigger.name==='source_constraint')).toMatchObject({tgtype:5,is_constraint:true,tgdeferrable:true,tginitdeferred:true,args_hex:Buffer.from("it's exact\0\0").toString('hex')})
    expect(triggers.find(trigger=>trigger.name==='source_columns')).toMatchObject({tgtype:19,columns:['status','reason'],is_constraint:false})
    expect(triggers.find(trigger=>trigger.name==='source_transition')).toMatchObject({tgtype:16,old_table:'prior_rows',new_table:'next_rows'})
  })

  it('deduplicates exact current definitions but refuses conflicts, missing source targets, substituted metadata and unsupported predicates',async()=>{
    const definition=REWARD_NOMINATION_GUARDS.triggers[0].definition
    expect(await projectSourcePhysicalTriggers([REWARD_NOMINATION_GUARDS],[definition],owners)).toHaveLength(1)
    await expect(projectSourcePhysicalTriggers([REWARD_NOMINATION_GUARDS],[definition.replace('BEFORE','AFTER')],owners)).rejects.toThrow('Conflicting current source')
    await expect(projectSourcePhysicalTriggers([REWARD_NOMINATION_GUARDS],[],{})).rejects.toThrow('declared relation ownership')
    await expect(projectSourcePhysicalTriggers([{...REWARD_NOMINATION_GUARDS,triggers:[{...REWARD_NOMINATION_GUARDS.triggers[0],tgtype:5}]}],[],owners)).rejects.toThrow('declaration metadata differs')
    for(const sql of ["CREATE TRIGGER source_unknown BEFORE INSERT ON other_schema.unknown FOR EACH ROW EXECUTE FUNCTION public.source_guard()",
      "CREATE TRIGGER source_unknown BEFORE INSERT ON public.recognition_awards FOR EACH ROW WHEN(NEW.operation='x' OR true) EXECUTE FUNCTION public.source_guard()",
      "DO $$ BEGIN EXECUTE 'CREATE TRIGGER hidden BEFORE INSERT ON public.recognition_awards FOR EACH ROW EXECUTE FUNCTION public.source_guard()'; END $$"])
      await expect(projectSourcePhysicalTriggers([], [sql],owners)).rejects.toThrow()
  })
})
