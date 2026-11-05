import { writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { buildSchemaMutationBatches } from '../lib/schema-mutation-batches';

// Rewrites the committed batch program from the current census, keeping the file's existing indentation and final newline.
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/register/ue-schema-mutation-batches.json');
const before = readFileSync(file, 'utf8');
const indent = /^\{\n( +)"/.exec(before)?.[1].length ?? 2;
writeFileSync(file, JSON.stringify(buildSchemaMutationBatches(), null, indent) + (before.endsWith('\n') ? '\n' : ''));
console.log('regenerated ue-schema-mutation-batches.json');
