import { readFileSync } from 'node:fs'
import path from 'node:path'
import { compileAuthBootstrapSql } from '../../../apps/union-eyes/scripts/bootstrap-v2/auth-sql'
import { compileFrameworkSql } from '../../../apps/union-eyes/scripts/bootstrap-v2/framework-sql'
import { compileSecurity } from '../../../apps/union-eyes/scripts/bootstrap-v2/security'
import { assertCurrentSourceCommitments, type V2Plan } from '../../../apps/union-eyes/scripts/bootstrap-v2/source'
import { compileAuthorityMembershipReaderSql } from '../../../apps/union-eyes/lib/authority/store/platform-identity'
import { compileMemberAccessProjectionSql } from '../../../apps/union-eyes/db/auth/member-access-projection'
import { compileCaseAssigneePredicateSql } from '../../../apps/union-eyes/db/auth/case-assignee-predicate'
import { compileConversationAssigneePredicateSql } from '../../../apps/union-eyes/db/auth/conversation-assignee-predicate'
import { compileQueuedCaseMailSql } from '../../../apps/union-eyes/db/auth/queued-case-mail'
import { compileCaseDomainSupportSql, CASE_PRIMARY_DOMAIN_GUARDS } from '../../../apps/union-eyes/db/auth/case-primary-domain-guards'
import { AUTHORITY_PHYSICAL_GUARDS } from '../../../apps/union-eyes/db/auth/authority-physical-guards'
import { CASE_SCOPE_PHYSICAL_GUARDS } from '../../../apps/union-eyes/db/auth/case-scope-physical-guards'
import { AUTHORITY_ISSUER_GUARDS } from '../../../apps/union-eyes/db/auth/authority-issuer-guards'
import { compileGuardFunction } from '../../../apps/union-eyes/db/auth/physical-guard-catalog'
import { BUSINESS_SESSION_POLICY, BUSINESS_SESSION_CATALOG_PREDICATE } from '../../../apps/union-eyes/db/auth/business-session-policy'
import { parseSql } from '../../../apps/union-eyes/scripts/lib/sql-census/parse'
import { projectCurrentCompilerSecurity } from './union-eyes-current-security-contract'
import { compileMessagingPhysicalGuards } from '../../../apps/union-eyes/db/auth/messaging-physical-guards'
import type { CanonicalPostgresMajor } from '../../../packages/db/src/auth-storage-authority/membership-semantics'
import { compileExternalReadRolePreparationSql, compileExternalReadSql, compileExternalReadRoleFinalizationSql } from '../../../apps/union-eyes/lib/external-resource-read/source'
import { compileExternalAuthBridgeSql } from '../../../apps/union-eyes/lib/external-resource-read/auth-bridge'
import { REWARD_NOMINATION_GUARDS } from '../../../apps/union-eyes/db/auth/reward-nomination-guards'
import { projectSourcePhysicalTriggers } from '../../../apps/union-eyes/scripts/bootstrap-v2/physical-trigger-source'

export const CURRENT_CASE_GUARDS = [AUTHORITY_PHYSICAL_GUARDS, CASE_SCOPE_PHYSICAL_GUARDS, AUTHORITY_ISSUER_GUARDS, CASE_PRIMARY_DOMAIN_GUARDS, REWARD_NOMINATION_GUARDS] as const

export function loadCurrentSecurityPlan(root: string): V2Plan {
  const plan = JSON.parse(readFileSync(path.join(root, 'docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8')) as V2Plan
  if (plan.contractVersion !== '2.0' || plan.lineage !== 'PROSPECTIVE_UE_BOOTSTRAP_V2' || !plan.authExecution || !plan.frameworkExecution)
    throw new Error('Current canonical auth/framework source plan required')
  assertCurrentSourceCommitments(plan)
  return plan
}

/** Same source producers as canonical V2; no historical SQL is replayed here. */
export function currentSecurityPrograms(plan: V2Plan, options: { postgresMajor?: CanonicalPostgresMajor } = {}) {
  return {
    auth: [compileAuthBootstrapSql({ rolesPreprovisioned: true, ...options }), compileAuthorityMembershipReaderSql()],
    framework: compileFrameworkSql(plan, { rolesPreprovisioned: true, ...options }),
    companions: [compileMemberAccessProjectionSql(), compileCaseAssigneePredicateSql(), compileConversationAssigneePredicateSql(), compileQueuedCaseMailSql(), compileCaseDomainSupportSql()],
    guardFunctions: CURRENT_CASE_GUARDS.flatMap(contract => contract.functions.flatMap(compileGuardFunction)),
    messaging: compileMessagingPhysicalGuards(plan.tables),
    externalRead: {
      prepare: compileExternalReadRolePreparationSql({ rolesPreprovisioned: true }),
      install: compileExternalReadSql({ rolesPreprovisioned: true }),
      authBridge: compileExternalAuthBridgeSql({ rolesPreprovisioned: true }),
      finalize: compileExternalReadRoleFinalizationSql(),
    },
  }
}

export async function currentSecurityProjection(plan: V2Plan, options: { postgresMajor?: CanonicalPostgresMajor } = {}) {
  const security = compileSecurity(plan)
  if (security.blockers.length) throw new Error('Unresolved current canonical security authority: ' + JSON.stringify(security.blockers))
  const programs = currentSecurityPrograms(plan, options)
  const publicTableGrants: string[] = []
  for (const sql of security.statements) {
    const parsed = await parseSql(sql)
    if (!parsed.ok) throw new Error('Current canonical privilege compiler must parse')
    if (parsed.statements.some(node => node.GrantStmt?.objtype === 'OBJECT_TABLE')) publicTableGrants.push(sql)
  }
  const sourcePrograms = [
    // Match canonical installation order: public security revokes precede
    // dedicated framework/companion grants. Include its source-owned invoker
    // helpers as exact function producers as well as its table/column ACLs.
    ...security.statements, ...programs.auth, programs.framework,
    ...programs.companions, ...programs.guardFunctions, ...programs.messaging,
    programs.externalRead.prepare, programs.externalRead.install, programs.externalRead.authBridge, programs.externalRead.finalize,
  ]
  const projection = await projectCurrentCompilerSecurity(sourcePrograms)
  // Both supported installation paths create or converge every declared
  // source relation to this canonical owner. Never infer an owner from a DB.
  const relationOwners = Object.fromEntries(plan.tables.map(table => [
    table.name.includes('.') ? table.name : `public.${table.name}`, 'ue_v2_owner',
  ]))
  return {
    security, programs, publicTableGrants,
    functions: projection.functions,
    columnGrants: projection.columnGrants,
    tableGrants: projection.tableGrants,
    requiredContainedParentPolicies: security.containedParentPolicies,
    requiredPhysicalTriggers: await projectSourcePhysicalTriggers(CURRENT_CASE_GUARDS, sourcePrograms, relationOwners),
    requiredSessionPolicy: {
      name: BUSINESS_SESSION_POLICY, command: '*', permissive: false,
      roles: ['union_eyes_runtime'], predicate: BUSINESS_SESSION_CATALOG_PREDICATE,
    },
  }
}
