/** Emits deterministic schema assignment evidence; never updates a committed ratchet. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildSchemaMutationBatches } from './lib/schema-mutation-batches';
const result = buildSchemaMutationBatches();
const out = resolve(__dirname, '../../../artifacts/ue-schema-mutation-program.json');
mkdirSync(resolve(out, '..'), { recursive: true });
writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
console.log('SCHEMA_PROGRAM_BEGIN');
console.log(JSON.stringify(result, null, 2));
console.log('SCHEMA_PROGRAM_END');
console.log('SCHEMA_EVIDENCE', JSON.stringify({
  censusCount: result.censusCount,
  schemaEntries: result.schema.length,
  liveMutationSum: result.mutationLiveSum,
  batches: result.batches.map(x => ({ id: x.id, entryCount: x.entryCount, execution: x.execution })),
  evolve: result.schema.filter(x => x.batchId === 'schema-evolve-reachable').map(x => x.table),
  requiredHolds: result.schema.filter(x => x.batchId === 'schema-verify-dead-required').map(x => x.table),
}));
