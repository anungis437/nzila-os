import { ProvisioningError } from './governed-provisioning'
import { replayDigest, replayHash, replayText } from './post-w4p-replay'
import type { ReplayEffectComponent } from './replay-effect-registry'
import type {
  ReplayExecutionContext,
  ReplayExecutionSpecification,
  ReplayInspectionWitness,
  ReplayUnitReceipt,
} from './post-w4p-execution'
import {
  executionPlanDigest,
  validateExecutionSpecification,
  verifyUnitReceipt,
} from './post-w4p-execution'

export interface ReplayOwnedAtom {
  key: string
  semanticsDigest: string
  operation: 'ASSERT' | 'SET' | 'ENSURE' | 'CONDITIONAL' | 'GUARD'
}
function atom(
  parts: string[],
  semantics: unknown,
  operation: ReplayOwnedAtom['operation'] = 'SET',
): ReplayOwnedAtom {
  return { key: JSON.stringify(parts), semanticsDigest: replayDigest(semantics), operation }
}
function columnAtoms(
  schema: string,
  table: string,
  column: { name: string; normalizedDefault: unknown; [key: string]: unknown },
): ReplayOwnedAtom[] {
  const {
    normalizedDefault,
    defaultExpression: _expression,
    sourceDefinitionHash: _hash,
    ...shape
  } = column
  return [
    atom(['COLUMN', schema, table, column.name], shape, 'ENSURE'),
    atom(['DEFAULT', schema, table, column.name], normalizedDefault, 'ENSURE'),
  ]
}
/** Source selectors are retained verbatim; unqualified functions are not assigned an invented schema. */
export function replayOwnedAtoms(effect: ReplayEffectComponent): ReplayOwnedAtom[] {
  const spec = effect.compiled
  switch (spec.kind) {
    case 'SCHEMA':
      return [
        atom(
          ['SCHEMA', spec.contract.name],
          { exists: true },
          spec.contract.guarded ? 'ENSURE' : 'SET',
        ),
      ]
    case 'RELATION': {
      const c = spec.contract
      return [
        atom(
          ['RELATION', c.schema, c.name],
          { kind: 'r', standalone: true },
          c.guarded ? 'ENSURE' : 'SET',
        ),
        ...c.columns.flatMap((column) => columnAtoms(c.schema, c.name, column)),
        ...c.constraints.map((constraint) =>
          atom(
            [
              'CONSTRAINT',
              c.schema,
              c.name,
              constraint.name ??
                replayDigest({
                  kind: constraint.kind,
                  columns: constraint.columns,
                }),
            ],
            constraint,
            c.guarded ? 'ENSURE' : 'SET',
          ),
        ),
      ]
    }
    case 'COLUMN':
      return columnAtoms(spec.contract.schema, spec.contract.table, spec.contract.column)
    case 'FOREIGN_KEY':
      return [
        atom(['CONSTRAINT', spec.contract.schema, spec.contract.table, spec.contract.name], {
          columns: spec.contract.columns,
          parentSchema: spec.contract.parentSchema,
          parent: spec.contract.parent,
          parentColumns: spec.contract.parentColumns,
          deleteAction: spec.contract.deleteAction,
          updateAction: spec.contract.updateAction,
        }),
      ]
    case 'INDEX': {
      const {
        sourceHash: _source,
        contractDigest: _digest,
        guarded: _guarded,
        ...definition
      } = spec.contract
      return [
        atom(
          ['INDEX', spec.contract.schema, spec.contract.name],
          definition,
          spec.contract.guarded ? 'ENSURE' : 'SET',
        ),
      ]
    }
    case 'RLS':
      return [
        atom(
          ['RLS', spec.contract.schema, spec.contract.table, spec.contract.field],
          spec.contract.value,
        ),
      ]
    case 'POLICY_DROP':
      return [
        atom(['POLICY', spec.contract.schema, spec.contract.table, spec.contract.name], {
          exists: false,
        }),
      ]
    case 'POLICY_CREATE': {
      const {
        schema,
        table,
        name,
        sourceHash: _source,
        contractDigest: _digest,
        ...definition
      } = spec.contract
      return [atom(['POLICY', schema, table, name], definition)]
    }
    case 'POLICY_HELPER':
      return [
        atom(['RLS', 'UNQUALIFIED', spec.contract.table, 'enabled'], true),
        atom(['RLS', 'UNQUALIFIED', spec.contract.table, 'forced'], true),
        ...spec.contract.policies.map((policy) =>
          atom(['POLICY', 'UNQUALIFIED', spec.contract.table, policy.name], policy),
        ),
      ]
    case 'FUNCTION': {
      const c = spec.contract
      return [
        atom(
          [
            'FUNCTION',
            c.schema ?? 'UNQUALIFIED',
            c.name,
            replayDigest(c.arguments.map((argument) => argument.type)),
          ],
          c.action === 'DROP_IF_EXISTS'
            ? { exists: false }
            : {
                arguments: c.arguments,
                returns: c.returns,
                language: c.language,
                body: c.body,
                volatility: c.volatility,
                securityDefiner: c.securityDefiner,
                strict: c.strict,
                parallel: c.parallel,
                config: c.config,
              },
        ),
      ]
    }
    case 'DEFAULT':
      return spec.contract.action === 'ADD_DEFAULT_COLUMN'
        ? columnAtoms(
            spec.contract.column.schema,
            spec.contract.column.table,
            spec.contract.column.column,
          )
        : [
            atom(
              ['DEFAULT', spec.contract.schema, spec.contract.table, spec.contract.name],
              spec.contract.value,
            ),
          ]
    case 'BACKFILL':
      return [
        atom(
          ['DATA_POSTCONDITION', spec.contract.schema, spec.contract.table, spec.contract.column],
          { qualifyingNulls: 0 },
          'ASSERT',
        ),
      ]
    case 'ACL':
      // ALL-object inventories and grantor selection are replay-position dependent.
      return [atom(['ACL_POSITION', effect.effectId], spec.contract, 'ASSERT')]
    case 'PROCEDURAL': {
      const g = spec.contract.geometry
      switch (g.kind) {
        case 'ENUM':
          return [atom(['ENUM', g.enum.schema, g.enum.name], g.enum.members, 'ENSURE')]
        case 'POLICIES':
          return [
            ...(g.rls
              ? [
                  atom(['RLS', 'public', g.table, 'enabled'], true),
                  atom(['RLS', 'public', g.table, 'forced'], true),
                ]
              : []),
            ...g.policies.map((policy) => atom(['POLICY', 'public', g.table, policy.name], policy)),
          ]
        case 'RETROFIT':
          return g.columns.flatMap((entry) => [
            ...columnAtoms('public', g.table, entry.column),
            ...entry.foreignKeys.map((fk) =>
              atom(['CONSTRAINT', fk.schema, fk.table, fk.name], fk, 'ENSURE'),
            ),
            ...entry.indexes.map((index) =>
              atom(['INDEX', index.schema, index.name], index, 'ENSURE'),
            ),
          ])
        case 'DEFAULTS':
          return [
            ...g.assignments.map((assignment) =>
              atom(['DEFAULT', 'public', g.table, assignment.column], assignment, 'CONDITIONAL'),
            ),
            ...(g.updateNullCategory
              ? [
                  atom(
                    ['DATA_POSTCONDITION', 'public', g.table, 'member_category'],
                    { qualifyingNulls: 0 },
                    'CONDITIONAL',
                  ),
                ]
              : []),
          ]
        case 'BACKFILL':
          return [
            ...columnAtoms('public', g.table, g.column),
            ...g.indexes.map((index) => atom(['INDEX', index.schema, index.name], index, 'ENSURE')),
            atom(
              ['DATA_POSTCONDITION', 'public', g.table, g.column.name],
              {
                sourceHash: effect.sourceHash,
                unambiguousMembership: true,
              },
              'ASSERT',
            ),
          ]
        case 'TRIGGER':
          return [
            atom(
              ['TRIGGER', 'public', g.table, g.name],
              { functionName: g.functionName },
              'CONDITIONAL',
            ),
          ]
        case 'CONNECT':
          return [atom(['DATABASE_ACL_POSITION', effect.effectId], g.roles, 'ASSERT')]
        case 'GUARD':
          return [atom(['GUARD_POSITION', effect.effectId], g, 'GUARD')]
      }
    }
  }
}
export interface ReplayTemporalOwner {
  effectId: string
  unitId: string
  position: number
  sourceOrdinal: number
  atom: ReplayOwnedAtom
}
export interface ReplayTemporalHandoff {
  key: string
  predecessor: ReplayTemporalOwner
  successor: ReplayTemporalOwner
  kind: 'SAME_SEMANTICS' | 'EXPLICIT_REPLACEMENT' | 'CONDITIONAL_OR_ENSURE_NOT_SUPERSESSION'
}
export function buildReplayTemporalOwnership(
  specification: ReplayExecutionSpecification,
  effects: ReplayEffectComponent[],
) {
  validateExecutionSpecification(specification)
  if (effects.length !== 762 || new Set(effects.map((effect) => effect.effectId)).size !== 762)
    throw new ProvisioningError('REPLAY_TEMPORAL_EFFECT_COVERAGE_INVALID')
  const owners: ReplayTemporalOwner[] = []
  for (const effect of effects) {
    const index = specification.units.findIndex(
      (unit) => unit.node.REPLAY_UNIT_ID === effect.boundaryId,
    )
    if (index < 0) throw new ProvisioningError('REPLAY_TEMPORAL_BOUNDARY_NOT_IN_PLAN')
    const unit = specification.units[index]
    if (
      unit.node.REPLAY_UNIT_CLASS !== 'FROZEN_MIGRATION_UNIT' ||
      effect.boundaryHash !== unit.node.EXACT_UNIT_SHA256 ||
      replayHash(effect.source) !== effect.sourceHash ||
      Buffer.from(unit.sql, 'utf8')
        .subarray(...effect.byteRange)
        .toString('utf8') !== effect.source
    )
      throw new ProvisioningError('REPLAY_TEMPORAL_EFFECT_SOURCE_DRIFT')
    for (const owned of replayOwnedAtoms(effect))
      owners.push({
        effectId: effect.effectId,
        unitId: effect.boundaryId,
        position: index + 1,
        sourceOrdinal: effect.ordinal,
        atom: owned,
      })
  }
  owners.sort(
    (left, right) => left.position - right.position || left.sourceOrdinal - right.sourceOrdinal,
  )
  const latest = new Map<string, ReplayTemporalOwner>(),
    handoffs: ReplayTemporalHandoff[] = []
  for (const owner of owners) {
    const previous = latest.get(owner.atom.key)
    if (previous)
      handoffs.push({
        key: owner.atom.key,
        predecessor: previous,
        successor: owner,
        kind:
          owner.atom.semanticsDigest === previous.atom.semanticsDigest
            ? 'SAME_SEMANTICS'
            : owner.atom.operation === 'SET'
              ? 'EXPLICIT_REPLACEMENT'
              : 'CONDITIONAL_OR_ENSURE_NOT_SUPERSESSION',
      })
    latest.set(owner.atom.key, owner)
  }
  const body = { owners, handoffs }
  return { ...body, digest: replayDigest(body) }
}
/** A later source write alone is not proof. Validate the entire actual receipt chain before accepting a temporal witness. */
export function authenticatedTemporalReceipt(
  unitId: string,
  specification: ReplayExecutionSpecification,
  context: ReplayExecutionContext,
  witness: ReplayInspectionWitness,
): ReplayUnitReceipt | null {
  if (
    witness.planDigest !== executionPlanDigest(specification) ||
    !Number.isInteger(witness.position) ||
    witness.position < 1 ||
    witness.position > specification.units.length ||
    !['BEFORE', 'PRE_SEND', 'POST_SEND', 'FINAL_SCOPE'].includes(witness.phase)
  )
    throw new ProvisioningError('REPLAY_TEMPORAL_WITNESS_BINDING_INVALID')
  const units = new Map(
    specification.units.map((unit) => [replayText(unit.node.REPLAY_UNIT_ID), unit]),
  )
  const validate = (receipts: ReadonlyMap<string, ReplayUnitReceipt>) => {
    for (const [id, receipt] of receipts) {
      const unit = units.get(id)
      if (
        !unit ||
        id !== receipt.UNIT_ID ||
        !verifyUnitReceipt(receipt, unit, specification, context)
      )
        throw new ProvisioningError('REPLAY_TEMPORAL_RECEIPT_BINDING_INVALID')
      const position = specification.units.indexOf(unit) + 1
      if (
        receipts === witness.verifiedReceipts &&
        witness.phase !== 'FINAL_SCOPE' &&
        position >= witness.position
      )
        throw new ProvisioningError('REPLAY_TEMPORAL_FUTURE_VERIFICATION_INVALID')
      for (const predecessor of receipt.PREDECESSOR_RECEIPT_DIGESTS)
        if (receipts.get(predecessor.UNIT_ID)?.RECEIPT_DIGEST !== predecessor.DIGEST)
          throw new ProvisioningError('REPLAY_TEMPORAL_RECEIPT_CHAIN_INVALID')
    }
  }
  validate(witness.historicalReceipts)
  validate(witness.verifiedReceipts)
  return witness.verifiedReceipts.get(unitId) ?? witness.historicalReceipts.get(unitId) ?? null
}
