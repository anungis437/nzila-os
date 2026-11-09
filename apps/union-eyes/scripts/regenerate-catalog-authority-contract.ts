// One-off regeneration script: rebuilds lib/operations/catalog-authority-contract.json's `entries` from the
// canonical db/rls-storage-authority registry (storageAuthorityManifest), preserving every other payload key
// (nonPublic, runtimeSchemaUsage, systemSchemaUsage, rlsRequired, dedicatedRolePrivileges, approvedColumnGrants)
// unchanged, then recomputes the digest exactly as catalog-admission-core.mjs's catalogContractDigest does.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { storageAuthorityManifest } from '../db/rls-storage-authority/index';

const PRIVILEGE_ORDER = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

function privilegesInOrder(value: readonly string[] | 'TBD'): string[] | 'TBD' {
  if (value === 'TBD') return 'TBD';
  const privileges = [...value];
  return PRIVILEGE_ORDER.filter((privilege) => privileges.includes(privilege));
}

const contractPath = new URL('../lib/operations/catalog-authority-contract.json', import.meta.url);
const existing = JSON.parse(readFileSync(contractPath, 'utf8'));

const entries = storageAuthorityManifest.map((entry) => ({
  table: entry.table,
  classification: entry.classification,
  runtime: privilegesInOrder(entry.requiredRuntimePrivileges),
  system: privilegesInOrder(entry.requiredSystemPrivileges),
}));

const payload = { ...existing.payload, entries };
const digest = createHash('sha256').update(JSON.stringify(payload)).digest('hex');

writeFileSync(contractPath, JSON.stringify({ digest, payload }));

console.log(`entries: ${entries.length} (was ${existing.payload.entries.length})`);
console.log(`digest: ${digest}`);
