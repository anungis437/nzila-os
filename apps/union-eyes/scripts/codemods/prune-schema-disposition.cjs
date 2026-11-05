'use strict'
// Removes the disposition of every relation that has left the schema census (UE-CONV-H-007).
//
// A disposition classifies a census entry; once a relation is evolved, created or its declaration retired, regenerating the census
// (UE_CENSUS_WRITE=1 on the canonical native test) drops the entry and its disposition is dead weight that the mutation-batch program would still read.
// Run this after the census is regenerated, then regenerate the batch program (regen-schema-mutation-batches.ts). It prints what it removed and
// changes nothing else: the file is read and written back with the indentation and final newline it already has.
//
//   node apps/union-eyes/scripts/codemods/prune-schema-disposition.cjs
const fs = require('node:fs')
const path = require('node:path')

const register = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/register')
const censusFile = path.join(register, 'ue-canonical-schema-census.json')
const dispositionFile = path.join(register, 'ue-canonical-schema-disposition.json')

const census = new Set(JSON.parse(fs.readFileSync(censusFile, 'utf8')).entries.map((entry) => entry.table))
const raw = fs.readFileSync(dispositionFile, 'utf8')
const indent = /^\{\n( +)"/.exec(raw)?.[1].length ?? 2
const register_ = JSON.parse(raw)

const removed = Object.keys(register_.entries).filter((table) => !census.has(table))
for (const table of removed) delete register_.entries[table]

const missing = [...census].filter((table) => !(table in register_.entries))
if (missing.length) {
  console.error(`census entries with no disposition: ${missing.join(', ')}`)
  process.exitCode = 1
}

fs.writeFileSync(dispositionFile, JSON.stringify(register_, null, indent) + (raw.endsWith('\n') ? '\n' : ''))
console.log(`removed ${removed.length} disposition(s): ${removed.join(', ') || '(none)'}`)
console.log(`${Object.keys(register_.entries).length} disposition(s) remain, one per census entry (${census.size})`)
