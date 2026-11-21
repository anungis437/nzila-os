/** Current source DDL must have one producer for each physical index identity. */
import {readFileSync} from 'node:fs'
import {describe,expect,it} from 'vitest'
import {folder,type V2Plan} from './source'
import path from 'node:path'

describe('current model DDL producer identities',()=>{
 it('emits each schema/index identity once, including the conditional respondent constraint',()=>{
  const plan=JSON.parse(readFileSync(path.join(folder,'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'),'utf8')) as V2Plan
  const indexes=new Map<string,string[]>()
  for(const statement of plan.statements){
    const match=/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+("[^".]+"(?:\."[^".]+")?)\s+ON\s+(?:"([^".]+)"\.)?"([^".]+)"/i.exec(statement.sql)
    if(!match)continue
    const identity=(match[2]??'public')+'.'+match[1]
    indexes.set(identity,[...(indexes.get(identity)??[]),statement.canonicalId])
  }
  expect(indexes.size).toBeGreaterThan(100)
  expect([...indexes].filter(([,producers])=>producers.length!==1)).toEqual([])
  expect(indexes.get('public."case_respondent_active_uniq"')).toHaveLength(1)
 })
})
