import assert from 'node:assert/strict'
import ts from 'typescript'
import { frozenStatements } from './close-w5a-replay-graph'
import { tableDefinition } from './w5bc-boundary-semantics'
import { sqlTokens } from './close-w4t-named-types'
import { read } from './w4-physical-producers'
import {
  replayDigest,
  replayHash,
} from '../../apps/union-eyes/scripts/provisioning/post-w4p-replay'
import {
  authorizedParentRelations,
  parentKeySql,
  type ParentRelation,
} from '../../apps/union-eyes/scripts/provisioning/parent-key-supplement'

export const keySources: Record<ParentRelation, { schema: string; migration: string }> = {
  allocation_rules: {
    schema: 'apps/union-eyes/db/schema/domains/finance/allocation.ts',
    migration: 'apps/union-eyes/db/migrations/20260325_dapl_platform_ledger.sql',
  },
  allocation_runs: {
    schema: 'apps/union-eyes/db/schema/domains/finance/allocation.ts',
    migration: 'apps/union-eyes/db/migrations/20260325_dapl_platform_ledger.sql',
  },
  commercial_contracts: {
    schema: 'apps/union-eyes/db/schema/domains/finance/contracts.ts',
    migration: 'apps/union-eyes/db/migrations/0085_monetization_infrastructure_layer.sql',
  },
  committee_meetings: {
    schema: 'apps/union-eyes/db/schema/committee-workspace-schema.ts',
    migration: 'apps/union-eyes/db/migrations/0096_add_missing_ue_required_tables.sql',
  },
  correspondence: {
    schema: 'apps/union-eyes/db/schema/domains/documents/correspondence.ts',
    migration: 'apps/union-eyes/db/migrations/0105_correspondence_pipeline.sql',
  },
  duplicate_groups: {
    schema: 'apps/union-eyes/db/schema/ingestion-schema.ts',
    migration: 'apps/union-eyes/db/migrations/0104_dedup_and_quality_warnings.sql',
  },
  ingestion_batches: {
    schema: 'apps/union-eyes/db/schema/ingestion-schema.ts',
    migration: 'apps/union-eyes/db/migrations/0089_ingestion_hardening.sql',
  },
  platform_invoices: {
    schema: 'apps/union-eyes/db/schema/domains/finance/platform-billing.ts',
    migration: 'apps/union-eyes/db/migrations/20260325_dapl_platform_ledger.sql',
  },
  platform_payments: {
    schema: 'apps/union-eyes/db/schema/domains/finance/platform-billing.ts',
    migration: 'apps/union-eyes/db/migrations/20260325_dapl_platform_ledger.sql',
  },
  reconciliation_runs: {
    schema: 'apps/union-eyes/db/schema/domains/finance/reconciliation.ts',
    migration: 'apps/union-eyes/db/migrations/0086_monetization_phase2.sql',
  },
}
export function recoverKeyAuthority(
  relation: ParentRelation,
  schemaBytes: string,
  migrationBytes: string,
) {
  const source = ts.createSourceFile(
    keySources[relation].schema,
    schemaBytes,
    ts.ScriptTarget.Latest,
    true,
  )
  const definitions: ts.PropertyAssignment[] = []
  const tables: ts.CallExpression[] = []
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'pgTable' &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === relation
    ) {
      tables.push(node)
      const fields = node.arguments[1]
      assert(fields && ts.isObjectLiteralExpression(fields), 'AUTHORITATIVE_TABLE_FIELDS_REQUIRED')
      for (const field of fields.properties)
        if (
          ts.isPropertyAssignment(field) &&
          field.name.getText(source).replace(/['"]/g, '') === 'id'
        )
          definitions.push(field)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.equal(tables.length, 1, 'EXACT_RELATION_DECLARATION_REQUIRED')
  assert.equal(definitions.length, 1, 'EXACT_ID_DECLARATION_REQUIRED')
  const declaration = definitions[0].initializer.getText(source)
  const calls: string[] = []
  const canonicalImport = (name: string) =>
    source.statements.some((statement) => {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        statement.moduleSpecifier.text !== 'drizzle-orm/pg-core'
      )
        return false
      const bindings = statement.importClause?.namedBindings
      return (
        bindings &&
        ts.isNamedImports(bindings) &&
        bindings.elements.some(
          (element) =>
            element.name.text === name &&
            (!element.propertyName || element.propertyName.text === name),
        )
      )
    })
  let zeroChainArguments = true
  let current = definitions[0].initializer
  while (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
    zeroChainArguments &&= current.arguments.length === 0
    calls.push(current.expression.name.text)
    current = current.expression.expression
  }
  const schemaAdditionalKeySemantics: string[] = []
  const inspectCallback = (node: ts.Node) => {
    if (
      (ts.isPropertyAccessExpression(node) && node.name.text === 'id') ||
      (ts.isElementAccessExpression(node) &&
        ts.isStringLiteral(node.argumentExpression) &&
        node.argumentExpression.text === 'id')
    )
      schemaAdditionalKeySemantics.push(node.getText(source))
    ts.forEachChild(node, inspectCallback)
  }
  tables[0].arguments.slice(2).forEach(inspectCallback)
  const schemaExact =
    canonicalImport('uuid') &&
    canonicalImport('pgTable') &&
    zeroChainArguments &&
    schemaAdditionalKeySemantics.length === 0 &&
    ts.isCallExpression(current) &&
    ts.isIdentifier(current.expression) &&
    current.expression.text === 'uuid' &&
    current.arguments.length === 1 &&
    ts.isStringLiteral(current.arguments[0]) &&
    current.arguments[0].text === 'id' &&
    calls.length === 2 &&
    calls.includes('primaryKey') &&
    calls.includes('defaultRandom')
  const tableStatements = frozenStatements(migrationBytes)
    .map((statement) => ({
      statement,
      definition: tableDefinition(statement.TEXT),
    }))
    .filter((entry) => entry.definition?.schema === 'public' && entry.definition.name === relation)
  assert.equal(tableStatements.length, 1, 'EXACT_HISTORICAL_RELATION_DEFINITION_REQUIRED')
  const historical = tableStatements[0]
  const field = historical.definition?.fields.find((entry) => entry.name === 'id')
  assert(field, 'HISTORICAL_KEY_DEFINITION_REQUIRED')
  const historicalAdditionalKeySemantics = historical.definition!.constraints.filter((constraint) =>
    sqlTokens(constraint).some(
      (token) =>
        (token.kind === 'WORD' && token.value.toLowerCase() === 'id') ||
        (token.kind === 'IDENTIFIER' && token.value === 'id'),
    ),
  )
  const historicalExact =
    historicalAdditionalKeySemantics.length === 0 &&
    /^"?id"?\s+uuid\s+primary\s+key\s+default\s+gen_random_uuid\(\)(?:\s+not\s+null)?$/i.test(
      field.definition,
    )
  const definitionStatus = schemaExact && historicalExact ? 'EXACT' : 'CONFLICTING_AUTHORITY'
  const fieldOffset = historical.statement.TEXT.indexOf(field.definition)
  assert(fieldOffset >= 0, 'HISTORICAL_KEY_RANGE_REQUIRED')
  const fieldStart = historical.statement.START + fieldOffset
  const evidence = [
    {
      FILE: keySources[relation].schema,
      SOURCE_SHA256: replayHash(schemaBytes),
      SOURCE_LINES: [
        source.getLineAndCharacterOfPosition(definitions[0].getStart(source)).line + 1,
        source.getLineAndCharacterOfPosition(definitions[0].end).line + 1,
      ],
      EXACT_DEFINITION: declaration,
      DEFINITION_SHA256: replayHash(declaration),
      RANK: 1,
    },
    {
      FILE: keySources[relation].migration,
      SOURCE_SHA256: replayHash(migrationBytes),
      SOURCE_LINES: [
        migrationBytes.slice(0, fieldStart).split('\n').length,
        migrationBytes.slice(0, fieldStart + field.definition.length).split('\n').length,
      ],
      EXACT_DEFINITION: field.definition,
      DEFINITION_SHA256: replayHash(field.definition),
      RANK: 1,
    },
  ]
  const established = (value: string) =>
    definitionStatus === 'EXACT' ? value : 'NOT_ESTABLISHED_CONFLICTING_AUTHORITY'
  const semantics = {
    DATA_TYPE: established('uuid'),
    TYPE_MODIFIERS: established('NONE'),
    NULLABILITY: established('NOT_NULL_IMPLICIT_PRIMARY_KEY'),
    DEFAULT: established('gen_random_uuid()'),
    IDENTITY_BEHAVIOR: established('NONE'),
    SEQUENCE_BEHAVIOR: established('NONE'),
    PRIMARY_KEY_STATUS: established('SINGLE_COLUMN_ID'),
    UNIQUE_STATUS: established('IMPLICIT_PRIMARY_KEY_UNIQUE'),
    FOREIGN_KEY_STATUS: established('NONE'),
    COLLATION: established('NONE'),
    GENERATED_STATUS: established('NONE'),
    OWNERSHIP_PRIVILEGE_IMPLICATIONS: established(
      'Existing relation owner retained;no role/grant/owner mutation. New column inherits table-level privileges;no explicit column ACL. Referenced schema/default function must be qualified and verified by future adapter.',
    ),
  }
  const body = {
    PARENT_KEY_ID: `PRE_W5_PK:${relation}`,
    RELATION: relation,
    COLUMN: 'id',
    PHYSICAL_IDENTITY: `public.${relation}.id`,
    EVIDENCE_SOURCES: evidence,
    EVIDENCE_DIGESTS: evidence.map((entry) => entry.DEFINITION_SHA256),
    ...semantics,
    AUXILIARY_KEY_SEMANTICS: {
      SCHEMA: schemaAdditionalKeySemantics,
      HISTORICAL: historicalAdditionalKeySemantics,
    },
    OTHER_CONSTRAINTS:
      definitionStatus === 'EXACT'
        ? 'NONE_ON_ID_BEYOND_PRIMARY_KEY'
        : 'NOT_ESTABLISHED_CONFLICTING_AUTHORITY',
    DEFINITION_STATUS: definitionStatus,
    EMPTY_RELATION_CREATE_PATH:
      'EXACT_W4P_PARENT_SHAPE_PLUS_ROW_COUNT_ZERO;add canonical UUID default and primary key',
    EXISTING_RELATION_MISSING_KEY_PATH:
      'POPULATED_DENY_KEY_ABSENT_AMBIGUOUS_DATA_STATE;no regeneration of historical identity',
    EXACT_CANONICAL_DDL: definitionStatus === 'EXACT' ? parentKeySql(relation) : null,
  }
  return { ...body, SOURCE_AUTHORITY_DIGEST: replayDigest(body) }
}
export function buildParentKeyAuthority() {
  const records = authorizedParentRelations.map((relation) => {
    const sources = keySources[relation]
    return recoverKeyAuthority(relation, read(sources.schema), read(sources.migration))
  })
  return {
    PHASE: 'PHASE_1B_3C_A1I_W5B_PK',
    NEW_PROSPECTIVE_AUTHORITY: 'PRE_W5_PARENT_KEY_PRODUCTION_SUPPLEMENT',
    AUTHORIZED_PARENT_KEY_IDENTITIES: 10,
    EXACT: records.filter((entry) => entry.DEFINITION_STATUS === 'EXACT').length,
    CONFLICTING_AUTHORITY: records.filter(
      (entry) => entry.DEFINITION_STATUS === 'CONFLICTING_AUTHORITY',
    ).length,
    RECORDS: records,
    AUTHORITY_DIGEST: replayDigest(records),
    SEARCH_CEILING:
      'Exact10relation/id declarations in canonical Drizzle,historical matching CREATEs,accepted W4/W4P definition context and bound23sources. No downstream operand/producer search. Backend exact-name search found no corresponding db_table/model declaration.',
    HISTORICAL_W4P_CHANGED: 'NO',
    W5A_TOPOLOGY_CHANGED: 'NO',
    FROZEN_MIGRATIONS_CHANGED: 'NO',
    RETROACTIVE_HISTORICAL_CLAIM: 'NO',
  }
}
