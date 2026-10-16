import { writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  compileMinimumRoleProvisioningSql,
  VECTOR_FUNCTION_ACL_SQL,
} from '../bootstrap-v2/minimum-installer'

/** Emits the canonical role-provisioning and vector ACL SQL for the Azure staging restore. */
const out = process.argv[2]
if (!out) throw new Error('output directory required')
writeFileSync(path.join(out, 'roles.sql'), compileMinimumRoleProvisioningSql() + '\n')
writeFileSync(path.join(out, 'vector-acl.sql'), VECTOR_FUNCTION_ACL_SQL + ';\n')
