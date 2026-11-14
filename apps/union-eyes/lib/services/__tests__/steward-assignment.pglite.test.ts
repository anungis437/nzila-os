import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import { describe, expect, it } from 'vitest'
import { stewards } from '@/db/schema/domains/member/stewards'
import { stewardAssignments, stewardTypeEnum } from '@/db/schema/union-structure-schema'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { assignSteward } from '../steward-assignment'

async function fixture() {
  const pg = new PGlite()
  await pg.exec('CREATE TABLE organizations(id uuid PRIMARY KEY); CREATE TABLE bargaining_units(id uuid PRIMARY KEY); CREATE TABLE worksites(id uuid PRIMARY KEY);')
  const ddl = await generateMigration(generateDrizzleJson({}),generateDrizzleJson({stewards,stewardAssignments,stewardTypeEnum}))
  for(const sql of [...ddl.filter(sql=>!sql.startsWith('ALTER TABLE')), ...ddl.filter(sql=>sql.startsWith('ALTER TABLE'))]) await pg.exec(sql)
  const org=randomUUID(),foreignOrg=randomUUID(),profileId=randomUUID(),userId=randomUUID(),grievanceId=randomUUID()
  await pg.query('INSERT INTO organizations(id) VALUES($1),($2)',[org,foreignOrg])
  await pg.query('INSERT INTO stewards(id,org_id,user_id) VALUES($1,$2,$3)',[profileId,org,userId])
  const db=drizzle(pg),assign=(organizationId=org)=>db.transaction(tx=>assignSteward(organizationId,grievanceId,profileId,tx as unknown as RLSTx))
  return {pg,db,org,foreignOrg,profileId,userId,grievanceId,assign}
}

describe('steward recommendation profile versus canonical person',()=>{
  it('persists the person UUID while incrementing the selected profile, whose UUID is different',async()=>{
    const f=await fixture()
    try {
      expect(f.profileId).not.toBe(f.userId)
      const result=await f.assign()
      expect(result.stewardId).toBe(f.userId)
      expect((await f.pg.query('SELECT steward_id,grievance_id,organization_id FROM steward_assignments')).rows).toEqual([{steward_id:f.userId,grievance_id:f.grievanceId,organization_id:f.org}])
      expect((await f.pg.query('SELECT current_caseload FROM stewards WHERE id=$1',[f.profileId])).rows).toEqual([{current_caseload:1}])
    } finally {await f.pg.close()}
  })
  it('rejects a foreign profile or inactive profile without recording an assignment or increasing workload',async()=>{
    const f=await fixture()
    try {
      await expect(f.assign(f.foreignOrg)).rejects.toMatchObject({code:'NOT_FOUND'})
      await f.pg.query('UPDATE stewards SET active=false WHERE id=$1',[f.profileId])
      await expect(f.assign()).rejects.toMatchObject({code:'NOT_FOUND'})
      expect((await f.pg.query('SELECT count(*)::int AS n FROM steward_assignments')).rows).toEqual([{n:0}])
      expect((await f.pg.query('SELECT current_caseload FROM stewards')).rows).toEqual([{current_caseload:0}])
    } finally {await f.pg.close()}
  })
  it('rolls the profile and compatibility assignment back when the authority decision refuses the same transaction',async()=>{
    const f=await fixture()
    try {
      await expect(f.db.transaction(async tx=>{await assignSteward(f.org,f.grievanceId,f.profileId,tx as unknown as RLSTx);throw new Error('Authority refused')})).rejects.toThrow('Authority refused')
      expect((await f.pg.query('SELECT count(*)::int AS n FROM steward_assignments')).rows).toEqual([{n:0}])
      expect((await f.pg.query('SELECT current_caseload FROM stewards')).rows).toEqual([{current_caseload:0}])
    } finally {await f.pg.close()}
  })
})
