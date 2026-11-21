/** B002 logical-case source facts; no default institutional adoption or bulk backfill. */
import type { StorageAuthorityEntry } from './types';
export const caseScopeEntries: StorageAuthorityEntry[] = [
  ...['case_authority_scopes','case_scope_proposals','case_respondents'].map((table): StorageAuthorityEntry => ({
    table, classification:'TENANT_RLS_REQUIRED',
    reason:'Django grievances owns the logical-case scope/party aggregate. Session-bound exact-case source writer, immutable canonical parent and proposal, independent canonical approval, tenant composite FKs, no default scope-amendment rule, no destructive respondent history and deferred mandatory audit. Case scope/party writes require qualified case-scope physical guards; installation alone adopts no union instrument.',
    supportingCapability:['lib/authority/store/case-scope.ts','lib/authority/store/resources.ts','db/auth/case-scope-physical-guards.ts'],
    requiredRuntimePrivileges:['SELECT','INSERT','UPDATE'], requiredSystemPrivileges:[], invocationAuthority:'TENANT_USER', dbExecutionPrincipal:'TENANT_RUNTIME', reviewPriority:'HIGH',
  })),
  {table:'case_territories',classification:'TENANT_RLS_REQUIRED',
    reason:'Institution-defined territory reference, Django grievances canonical. Tenant runtime reads only; no customer territory or adoption is invented by source installation. Any future real territory provisioning requires an institution-owned recorded instrument and governed operator action, outside automatic backfill.',
    supportingCapability:['lib/authority/store/case-scope.ts','lib/authority/store/resources.ts','db/auth/case-scope-physical-guards.ts'],
    requiredRuntimePrivileges:['SELECT'],requiredSystemPrivileges:[],invocationAuthority:'TENANT_USER',dbExecutionPrincipal:'TENANT_RUNTIME',reviewPriority:'HIGH'},
];
