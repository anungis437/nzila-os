#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildProducerGraph } from './lib/union-eyes-0014-producer-graph.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const graph = buildProducerGraph(repoRoot)
const json = process.argv.includes('--json')
if (json) {
  process.stdout.write(`${JSON.stringify(graph)}\n`)
} else {
  process.stdout.write(`${JSON.stringify({ counts: graph.counts, coverage: graph.coverage, v2CompileWouldMiss: graph.v2CompileWouldMiss }, null, 2)}\n`)
}
if (graph.coverage.bootstrapV2Source !== 'SOURCE_DECLARATIONS_REACHABLE' || graph.coverage.productionDrizzleBootstrap0014 !== 'DECLARED_COMPLETE') {
  process.exitCode = 1
}
