import { z } from 'zod'
import type { InstitutionalReference } from '@nzila/platform-contracts'
import { syntheticFoundation, fictionalScope } from '../foundation/synthetic.fixture'
import type { FoundationAction } from '../foundation/runtime'
import type { StoredInstitutionalRecord } from '../foundation/local-store'
import { InstitutionalOperatingRuntime, type OperatingAction } from './runtime'
import { type SourceRead, type OperatingSourcePorts } from './sources'
import { refKey } from './estate'
import { InstitutionalCommandReadModel, type CommandItem, type CommandSourceCollection, type CommandReadPorts } from './command'

export function syntheticOperating(filename = ':memory:', seedBinding = true) {
  const f = syntheticFoundation(filename, seedBinding)
  const sourceRows = new Map<string, SourceRead>()
  const commandSources = new Map<CommandItem, CommandSourceCollection>()
  const hidden = new Set<string>()
  const measurement = { value: 12 as number | null, qualitativeResult: true as boolean | null, baselineVerified: true }
  f.authority.ports.canReadReference = (_actor, ref) => !hidden.has(ref.sourceId)
  const sources: OperatingSourcePorts & CommandReadPorts = {
    localNamespace: 'fictional-local',
    measurement: () => structuredClone(measurement),
    commandSource: (_actor, _scope, item) => structuredClone(commandSources.get(item) ?? {
      reads: [], status: 'UNAVAILABLE', complete: false, observedAt: null, watermark: null, freshness: null, error: 'FIXTURE_SOURCE_UNAVAILABLE',
    }),
    read: (_actor, ref) => structuredClone(sourceRows.get(refKey(ref)) ?? {
      ref, value: null, complete: false, status: 'UNAVAILABLE',
      observedAt: null, watermark: null, freshness: null, error: 'FIXTURE_SOURCE_UNAVAILABLE',
    }),
  }
  const runtime = new InstitutionalOperatingRuntime(f.boundary, sources)
  const commandRead = new InstitutionalCommandReadModel(f.boundary, sources)
  const foundation = runtime.foundation
  const ref = (row: StoredInstitutionalRecord): InstitutionalReference => ({
    scope: row.scope, kind: row.kind, namespace: sources.localNamespace, sourceId: row.id, revision: row.version,
  })
  const command = (kind: string, id: string, payload: unknown, version = 0) =>
    f.command(f.target(kind, id, Math.max(1, version)), payload, version)
  const execute = (actor: string, action: OperatingAction, kind: string, id: string, payload: unknown, version = 0) =>
    runtime.execute(actor, action, command(kind, id, payload, version))
  const record = async (actor: string, action: OperatingAction, kind: string, id: string, payload: unknown, version = 0) => {
    const row = execute(actor, action, kind, id, payload, version)
    await f.boundary.deliver(row.scope, z.object({ auditEventId: z.string().uuid() }).parse(row.data).auditEventId)
    return f.store.get(row.scope, row.kind, row.id, row.version)!
  }
  const baseRecord = async (actor: string, action: FoundationAction, kind: string, id: string, payload: unknown, version = 0) => {
    const row = foundation.execute(actor, action, command(kind, id, payload, version))
    await f.boundary.deliver(row.scope, z.object({ auditEventId: z.string().uuid() }).parse(row.data).auditEventId)
    return f.store.get(row.scope, row.kind, row.id, row.version)!
  }
  function source(kind: string, id: string, status = 'active'): InstitutionalReference {
    const reference = { scope: fictionalScope, kind, sourceId: id, namespace: `fictional-source-${kind}`, revision: 1 }
    sourceRows.set(refKey(reference), {
      ref: reference, status: 'ILLUSTRATIVE', complete: true,
      value: { title: `Fictional ${id}`, status, owner: 'fictional-H1', affectedRefs: [], evidenceRefs: [], rootCause: 'UNKNOWN' },
      observedAt: f.controls.now, watermark: 'fixture-v1',
      freshness: { policyRef: 'fictional-policy-v1', maxAgeMs: 3600000 }, error: null,
    })
    return reference
  }
  async function estate(kind: 'InstitutionalProduct' | 'Capability' | 'Service' | 'ExternalDependency', id: string) {
    const sourceRef = source(kind, id)
    await record('fictional-H1', 'estate.record', 'EstateReference', id, {
      sourceRef, classification: kind, lifecycle: 'ACTIVE', steward: 'fictional-H1', evidenceRefs: [],
    })
    return sourceRef
  }
  async function edge(from: InstitutionalReference, to: InstitutionalReference, id = `${from.sourceId}-${to.sourceId}`) {
    return record('fictional-H1', 'relationship.record', 'InstitutionalRelationship', id,
      { from, to, relation: 'DEPENDS_ON', purpose: 'fictional-operational-dependency', binding: true, status: 'CURRENT' })
  }
  function traverse(seed: InstitutionalReference, direction: 'incoming' | 'outgoing' = 'incoming', extra: object = {}) {
    return runtime.traverse('fictional-H1', command('EstateRead', 'query', {
      seed, direction, mode: 'CURRENT_OPERATING', depthLimit: 10, nodeBudget: 100, edgeBudget: 100, ...extra,
    }))
  }
  const readCommand = (item?: CommandItem, extra: object = {}) => commandRead.read('fictional-H1',
    command('CommandRead', 'query', { view: 'ALL', illustrative: true, filters: item ? { item } : {}, pageSize: 100, ...extra }))
  return { ...f, sources, runtime, commandRead, commandSources, readCommand, foundation, sourceRows, hidden, measurement, ref, command, execute, record, baseRecord, source, estate, edge, traverse }
}
