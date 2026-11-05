/**
 * Every reference a statement makes, resolved against a catalog snapshot (UE-CONV-H-013).
 *
 * PostgreSQL's own PREPARE reports only the first thing that does not exist, so a statement written against a design the database never received is
 * discovered one object at a time. This walks the parse tree that PostgreSQL's parser produces (libpg-query), resolves every alias, CTE, subquery and
 * function range the way the analyzer does, and lists every relation, column, function and type that is absent, every conflict target that no unique
 * index backs, and every INSERT that leaves out a column nothing can fill. PREPARE stays the oracle: the judge compares the two, so a gap in this
 * walk is itself a finding.
 *
 * It does not type-check (operators, coercions, enum labels): those are the server's, reported through PREPARE.
 */
import { acceptsArgumentCount, findFunctions, findRelation, hasType, requiredColumns, SYSTEM_COLUMNS, type Catalog, type CatalogRelation } from './catalog'
import type { ParseNode } from './parse'

type Node = ParseNode

/** What the site extractor writes where part of a statement is not known (sites.ts): it names nothing, so no reference to it can be absent. */
const HOLE = '__hole__'
const isHole = (name: string | undefined): boolean => name === HOLE

export type FindingKind =
  | 'RELATION_ABSENT'
  | 'COLUMN_ABSENT'
  | 'ALIAS_UNRESOLVED'
  | 'FUNCTION_ABSENT'
  | 'FUNCTION_ARITY'
  | 'TYPE_ABSENT'
  | 'ON_CONFLICT_NO_ARBITER'
  | 'INSERT_OMITS_REQUIRED'
  | 'NULL_INTO_NOT_NULL'
  | 'INSERT_VALUE_COUNT'

export interface Finding {
  kind: FindingKind
  /** The thing that is wrong, stable across runs: `deadline_alerts`, `deadline_alerts.recipient_id`, `add_business_days/2`, `claims(a,b)`. */
  object: string
  relation?: string
  column?: string
  columns?: string[]
  detail?: string
  clause?: string
  /** The column was written without a qualifier, so which relation it belongs to is inferred from what is in scope. */
  unqualified?: true
}

export interface Analysis {
  statementKind: string
  findings: Finding[]
  /** Relations that exist and that the statement reads or writes. */
  relations: string[]
  /** For each relation that does not exist, the columns the statement asks of it: the shape the code expects. */
  expectedShape: Record<string, string[]>
  writes: Array<{ operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'MERGE'; relation: string }>
  gucReads: string[]
  gucWrites: string[]
  parameters: number
}

interface Binding {
  alias: string
  relation: CatalogRelation | null
  /** The qualified name of a relation that does not exist. */
  absent?: string
  /** null: unknown (a function range, a star over an unknown), so any column is accepted. */
  columns: Set<string> | null
}

class Scope {
  readonly bindings: Binding[] = []
  readonly ctes = new Map<string, Set<string> | null>()
  outputs: Set<string> | null = null
  constructor(readonly parent: Scope | null) {}
  cte(name: string): Set<string> | null | undefined {
    if (this.ctes.has(name)) return this.ctes.get(name)
    return this.parent?.cte(name)
  }
}

const strings = (list: Node[] | undefined): string[] => (list ?? []).map((item) => item?.String?.sval).filter((value): value is string => typeof value === 'string')
const qualified = (relation: CatalogRelation): string => (relation.schema === 'public' ? relation.name : `${relation.schema}.${relation.name}`)

export class Analyzer {
  private findings: Finding[] = []
  private relations = new Set<string>()
  private expectedShape = new Map<string, Set<string>>()
  private writes: Analysis['writes'] = []
  private gucReads = new Set<string>()
  private gucWrites = new Set<string>()
  private parameters = 0

  constructor(private readonly catalog: Catalog) {}

  analyze(statement: Node): Analysis {
    this.findings = []
    this.relations = new Set()
    this.expectedShape = new Map()
    this.writes = []
    this.gucReads = new Set()
    this.gucWrites = new Set()
    this.parameters = 0
    const kind = Object.keys(statement)[0] ?? 'UNKNOWN'
    this.statement(statement, new Scope(null))
    const seen = new Set<string>()
    const findings = this.findings.filter((finding) => {
      const id = `${finding.kind}|${finding.object}|${finding.clause ?? ''}`
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
    return {
      statementKind: kind,
      findings,
      relations: [...this.relations].sort(),
      expectedShape: Object.fromEntries([...this.expectedShape].map(([name, columns]) => [name, [...columns].sort()])),
      writes: this.writes,
      gucReads: [...this.gucReads].sort(),
      gucWrites: [...this.gucWrites].sort(),
      parameters: this.parameters,
    }
  }

  private record(finding: Finding): void {
    this.findings.push(finding)
  }

  private expect(absent: string, column: string): void {
    const set = this.expectedShape.get(absent) ?? new Set<string>()
    set.add(column)
    this.expectedShape.set(absent, set)
  }

  /** Dispatches a statement node; returns the output column names it exposes (a CTE or subquery), or null when they cannot be known. */
  private statement(node: Node, parent: Scope): string[] | null {
    const type = Object.keys(node)[0]
    const body = node[type]
    switch (type) {
      case 'SelectStmt':
        return this.select(body, parent)
      case 'InsertStmt':
        return this.insert(body, parent)
      case 'UpdateStmt':
        return this.update(body, parent)
      case 'DeleteStmt':
        return this.delete(body, parent)
      case 'MergeStmt':
        return this.merge(body, parent)
      case 'ExplainStmt':
        if (body.query) this.statement(body.query, parent)
        return null
      default:
        return null
    }
  }

  private withClause(clause: Node | undefined, scope: Scope): void {
    if (!clause) return
    const recursive = clause.recursive === true
    for (const wrapper of clause.ctes ?? []) {
      const cte = wrapper.CommonTableExpr
      const aliasColumns = strings(cte.aliascolnames)
      if (recursive) scope.ctes.set(cte.ctename, aliasColumns.length ? new Set(aliasColumns) : null)
      const outputs = this.statement(cte.ctequery, scope)
      scope.ctes.set(cte.ctename, aliasColumns.length ? new Set(aliasColumns) : outputs ? new Set(outputs) : null)
    }
  }

  private select(select: Node, parent: Scope | null): string[] | null {
    const scope = new Scope(parent)
    this.withClause(select.withClause, scope)
    if (select.op && select.op !== 'SETOP_NONE') {
      // larg and rarg are typed fields (a SelectStmt), so they carry no wrapper.
      const left = this.select(select.larg.SelectStmt ?? select.larg, scope)
      this.select(select.rarg.SelectStmt ?? select.rarg, scope)
      scope.outputs = left ? new Set(left) : null
      this.walk(select.sortClause, scope, true)
      this.walk(select.limitOffset, scope)
      this.walk(select.limitCount, scope)
      return left
    }
    if (select.valuesLists) {
      for (const row of select.valuesLists) this.walk(row.List?.items, scope)
      this.walk(select.sortClause, scope)
      const width = select.valuesLists[0]?.List?.items?.length ?? 0
      return Array.from({ length: width }, (_, index) => `column${index + 1}`)
    }
    for (const item of select.fromClause ?? []) this.fromItem(item, scope)
    const outputs = this.targetList(select.targetList, scope)
    scope.outputs = outputs ? new Set(outputs) : null
    this.walk(select.distinctClause, scope)
    this.walk(select.whereClause, scope)
    // An output name is a legal reference in ORDER BY and GROUP BY, and nowhere else.
    this.walk(select.groupClause, scope, true)
    this.walk(select.havingClause, scope)
    this.walk(select.windowClause, scope)
    this.walk(select.sortClause, scope, true)
    this.walk(select.limitOffset, scope)
    this.walk(select.limitCount, scope)
    return outputs
  }

  /** Walks the target list and returns the output names, or null when a star over an unknown makes them unknowable. */
  private targetList(list: Node[] | undefined, scope: Scope): string[] | null {
    const names: string[] = []
    let known = true
    for (const wrapper of list ?? []) {
      const target = wrapper.ResTarget
      const value = target.val
      this.walk(value, scope)
      const column = value?.ColumnRef
      const fields: Node[] = column?.fields ?? []
      if (!target.name && fields.length && fields[fields.length - 1].A_Star) {
        const owner = fields.length > 1 ? fields[0].String?.sval : undefined
        const bindings = owner ? this.bindingsNamed(scope, owner) : scope.bindings
        for (const binding of bindings) {
          if (binding.columns) names.push(...binding.columns)
          else known = false
        }
        if (owner && !bindings.length) known = false
        continue
      }
      names.push(target.name ?? this.impliedName(value))
    }
    return known ? names : null
  }

  private impliedName(value: Node | undefined): string {
    if (!value) return '?column?'
    if (value.ColumnRef) return strings(value.ColumnRef.fields).at(-1) ?? '?column?'
    if (value.FuncCall) return strings(value.FuncCall.funcname).at(-1) ?? '?column?'
    if (value.TypeCast) return this.impliedName(value.TypeCast.arg)
    if (value.A_Indirection) return strings(value.A_Indirection.indirection).at(-1) ?? this.impliedName(value.A_Indirection.arg)
    if (value.CaseExpr) return 'case'
    if (value.CoalesceExpr) return 'coalesce'
    if (value.MinMaxExpr) return value.MinMaxExpr.op === 'IS_LEAST' ? 'least' : 'greatest'
    if (value.SubLink?.subLinkType === 'ARRAY_SUBLINK') return 'array'
    if (value.SQLValueFunction) return String(value.SQLValueFunction.op ?? '?column?').replace('SVFOP_', '').toLowerCase()
    return '?column?'
  }

  private bindingsNamed(scope: Scope, alias: string): Binding[] {
    for (let current: Scope | null = scope; current; current = current.parent) {
      const found = current.bindings.filter((binding) => binding.alias === alias)
      if (found.length) return found
    }
    return []
  }

  // ---- FROM -------------------------------------------------------------------------------------------------------------------------------------

  private relationBinding(rangeVar: Node, scope: Scope, allowCte: boolean): Binding {
    const alias: string = rangeVar.alias?.aliasname ?? rangeVar.relname
    const aliasColumns = strings(rangeVar.alias?.colnames)
    if (allowCte && !rangeVar.schemaname) {
      const cte = scope.cte(rangeVar.relname)
      if (cte !== undefined) return { alias, relation: null, columns: aliasColumns.length ? new Set(aliasColumns) : cte }
    }
    const relation = findRelation(this.catalog, rangeVar.schemaname, rangeVar.relname)
    if (isHole(rangeVar.relname)) return { alias, relation: null, columns: null }
    if (!relation) {
      const name = rangeVar.schemaname ? `${rangeVar.schemaname}.${rangeVar.relname}` : rangeVar.relname
      this.record({ kind: 'RELATION_ABSENT', object: name, clause: 'from' })
      return { alias, relation: null, absent: name, columns: null }
    }
    this.relations.add(qualified(relation))
    const columns = new Set(relation.columns.keys())
    aliasColumns.forEach((name, index) => {
      const original = [...relation.columns.keys()][index]
      if (original) columns.delete(original)
      columns.add(name)
    })
    return { alias, relation, columns }
  }

  private fromItem(item: Node, scope: Scope): void {
    const type = Object.keys(item)[0]
    const body = item[type]
    switch (type) {
      case 'RangeVar':
        scope.bindings.push(this.relationBinding(body, scope, true))
        return
      case 'RangeSubselect': {
        const outputs = this.select(body.subquery.SelectStmt, scope)
        const aliasColumns = strings(body.alias?.colnames)
        const columns = aliasColumns.length ? new Set([...(outputs ?? []).slice(aliasColumns.length), ...aliasColumns]) : outputs ? new Set(outputs) : null
        scope.bindings.push({ alias: body.alias?.aliasname ?? '?subquery?', relation: null, columns: aliasColumns.length && !outputs ? null : columns })
        return
      }
      case 'RangeFunction': {
        for (const entry of body.functions ?? []) this.walk(entry.List?.items, scope)
        const defined = (body.coldeflist ?? []).map((wrapper: Node) => wrapper.ColumnDef?.colname as string).filter(Boolean)
        for (const wrapper of body.coldeflist ?? []) this.walk(wrapper.ColumnDef?.typeName, scope)
        const aliasColumns = strings(body.alias?.colnames)
        const columns = defined.length ? new Set<string>(defined) : aliasColumns.length ? new Set<string>(aliasColumns) : null
        scope.bindings.push({ alias: body.alias?.aliasname ?? strings(body.functions?.[0]?.List?.items?.[0]?.FuncCall?.funcname).at(-1) ?? '?function?', relation: null, columns })
        return
      }
      case 'RangeTableFunc':
      case 'RangeTableSample':
        this.walk(body, scope)
        scope.bindings.push({ alias: body.alias?.aliasname ?? '?table-function?', relation: null, columns: null })
        return
      case 'JoinExpr': {
        const leftStart = scope.bindings.length
        this.fromItem(body.larg, scope)
        const rightStart = scope.bindings.length
        this.fromItem(body.rarg, scope)
        const using = strings(body.usingClause)
        for (const name of using) {
          for (const side of [scope.bindings.slice(leftStart, rightStart), scope.bindings.slice(rightStart)]) {
            if (side.every((binding) => binding.columns !== null) && !side.some((binding) => binding.columns!.has(name) || binding.absent)) {
              this.record({ kind: 'COLUMN_ABSENT', object: `${side.map((binding) => binding.relation?.name ?? binding.alias).join('|')}.${name}`, column: name, relation: side.map((binding) => binding.relation?.name ?? binding.alias).join('|'), clause: 'join-using' })
            }
          }
        }
        this.walk(body.quals, scope)
        if (body.alias?.aliasname) {
          // `(a JOIN b ...) AS j` hides the inner aliases behind one name.
          const merged = scope.bindings.splice(leftStart)
          scope.bindings.push({ alias: body.alias.aliasname, relation: null, columns: merged.some((binding) => binding.columns === null) ? null : new Set(merged.flatMap((binding) => [...binding.columns!])) })
        }
        return
      }
      default:
        this.walk(item, scope)
    }
  }

  // ---- DML --------------------------------------------------------------------------------------------------------------------------------------

  private target(rangeVar: Node, scope: Scope, clause: string): Binding {
    const binding = this.relationBinding(rangeVar, scope, false)
    if (binding.absent) {
      this.findings.pop()
      this.record({ kind: 'RELATION_ABSENT', object: binding.absent, clause })
    }
    return binding
  }

  private checkColumn(binding: Binding, column: string, clause: string): void {
    if (isHole(column)) return
    if (binding.relation) {
      if (!binding.relation.columns.has(column) && !SYSTEM_COLUMNS.has(column)) {
        this.record({ kind: 'COLUMN_ABSENT', object: `${binding.relation.name}.${column}`, relation: binding.relation.name, column, clause })
      }
    } else if (binding.absent) this.expect(binding.absent, column)
  }

  private returning(list: Node[] | undefined, scope: Scope): string[] | null {
    return list ? this.targetList(list, scope) : []
  }

  private insert(insert: Node, parent: Scope): string[] | null {
    const scope = new Scope(parent)
    this.withClause(insert.withClause, scope)
    const target = this.target(insert.relation, scope, 'insert')
    const supplied: string[] = []
    for (const wrapper of insert.cols ?? []) {
      const name: string = wrapper.ResTarget.name
      supplied.push(name)
      this.checkColumn(target, name, 'insert-columns')
    }
    if (target.relation) this.writes.push({ operation: 'INSERT', relation: qualified(target.relation) })
    else if (target.absent) this.writes.push({ operation: 'INSERT', relation: target.absent })

    const source: Node | undefined = insert.selectStmt?.SelectStmt
    let rows: Node[][] | null = null
    // The number of values each row supplies; -1 when a star or a set operation makes it unknowable.
    let arity = 0
    if (source) {
      this.select(source, scope)
      if (source.valuesLists) {
        rows = source.valuesLists.map((row: Node) => (row.List?.items ?? []) as Node[])
        arity = rows![0]?.length ?? 0
      } else if (!source.op || source.op === 'SETOP_NONE') {
        const list: Node[] = source.targetList ?? []
        arity = list.some((wrapper) => wrapper.ResTarget.val?.ColumnRef?.fields?.some((field: Node) => field.A_Star)) ? -1 : list.length
      } else arity = -1
    }

    if (target.relation && !supplied.some(isHole) && (insert.override ?? 'OVERRIDING_NOT_SET') === 'OVERRIDING_NOT_SET') {
      const columnList = [...target.relation.columns.keys()]
      const positional = supplied.length === 0 && arity > 0 ? columnList.slice(0, arity) : []
      const named = supplied.length ? supplied : positional
      if (supplied.length && arity > 0 && supplied.length !== arity) {
        this.record({ kind: 'INSERT_VALUE_COUNT', object: `${target.relation.name}(${supplied.length} columns, ${arity} values)`, relation: target.relation.name, detail: `${supplied.length} columns named, ${arity} values given` })
      }
      if (supplied.length === 0 && arity > columnList.length) {
        this.record({ kind: 'INSERT_VALUE_COUNT', object: `${target.relation.name}(${arity} values)`, relation: target.relation.name, detail: `${arity} values for ${columnList.length} columns` })
      }
      if (['r', 'p', 'f'].includes(target.relation.kind)) {
        const omitted = requiredColumns(target.relation).filter((name) => !named.includes(name))
        if (omitted.length) {
          const triggers = target.relation.beforeInsertTriggers
          this.record({
            kind: 'INSERT_OMITS_REQUIRED',
            object: `${target.relation.name}(${omitted.join(',')})`,
            relation: target.relation.name,
            columns: omitted,
            detail: triggers.length ? `the relation has BEFORE INSERT trigger(s) ${triggers.join(', ')} that may fill them` : undefined,
          })
        }
        if (rows) {
          const nullable = new Set<string>()
          for (const row of rows) {
            row.forEach((expression, index) => {
              const name = named[index]
              const column = name ? target.relation!.columns.get(name) : undefined
              if (column?.notNull && expression.A_Const?.isnull) nullable.add(column.name)
            })
          }
          for (const name of nullable) this.record({ kind: 'NULL_INTO_NOT_NULL', object: `${target.relation.name}.${name}`, relation: target.relation.name, column: name, clause: 'insert-values' })
        }
      }
    }

    if (insert.onConflictClause) this.onConflict(insert.onConflictClause, target, scope)
    const returningScope = new Scope(scope)
    returningScope.bindings.push(target)
    return this.returning(insert.returningList, returningScope)
  }

  private onConflict(clause: Node, target: Binding, scope: Scope): void {
    const infer = clause.infer
    const names: Node[] = (infer?.indexElems ?? []).map((wrapper: Node) => wrapper.IndexElem as Node)
    const plain: string[] = names.filter((element) => typeof element.name === 'string').map((element) => element.name as string)
    const hasExpression = names.some((element) => !element.name)
    for (const name of plain) this.checkColumn(target, name, 'on-conflict-target')
    if (target.relation && infer && !infer.conname && plain.length && !hasExpression && plain.every((name) => target.relation!.columns.has(name))) {
      const wanted = [...plain].sort().join(',')
      const candidates = target.relation.uniques.filter((unique) => !unique.expression && [...unique.columns].sort().join(',') === wanted)
      const usable = candidates.filter((unique) => !unique.partial || infer.whereClause)
      if (!usable.length) {
        const available = target.relation.uniques.map((unique) => `(${unique.columns.join(',')})${unique.partial ? ' partial' : ''}`)
        this.record({
          kind: 'ON_CONFLICT_NO_ARBITER',
          object: `${target.relation.name}(${plain.join(',')})`,
          relation: target.relation.name,
          columns: plain,
          detail: candidates.length ? 'only a partial unique index covers it, and the statement names no predicate' : `no unique index or constraint on exactly these columns; the relation has ${available.length ? available.join(' ') : 'none'}`,
        })
      }
    }
    if (target.relation && infer?.conname) {
      if (!target.relation.uniques.some((unique) => unique.name === infer.conname)) {
        this.record({ kind: 'ON_CONFLICT_NO_ARBITER', object: `${target.relation.name} ON CONSTRAINT ${infer.conname}`, relation: target.relation.name, detail: 'no unique or exclusion constraint has that name' })
      }
    }
    const conflict = new Scope(scope)
    conflict.bindings.push(target)
    if (target.relation) conflict.bindings.push({ alias: 'excluded', relation: target.relation, columns: new Set(target.relation.columns.keys()) })
    else conflict.bindings.push({ alias: 'excluded', relation: null, absent: target.absent, columns: null })
    this.walk(infer?.whereClause, conflict)
    for (const wrapper of clause.targetList ?? []) {
      const column = wrapper.ResTarget
      if (column.name) this.checkColumn(target, column.name, 'on-conflict-update')
      this.walk(column.val, conflict)
    }
    this.walk(clause.whereClause, conflict)
  }

  private update(update: Node, parent: Scope): string[] | null {
    const scope = new Scope(parent)
    this.withClause(update.withClause, scope)
    const target = this.target(update.relation, scope, 'update')
    scope.bindings.push(target)
    if (target.relation) this.writes.push({ operation: 'UPDATE', relation: qualified(target.relation) })
    else if (target.absent) this.writes.push({ operation: 'UPDATE', relation: target.absent })
    for (const item of update.fromClause ?? []) this.fromItem(item, scope)
    const nulled = new Set<string>()
    for (const wrapper of update.targetList ?? []) {
      const column = wrapper.ResTarget
      this.checkColumn(target, column.name, 'update-set')
      this.walk(column.val, scope)
      const declared = target.relation?.columns.get(column.name)
      if (declared?.notNull && column.val?.A_Const?.isnull) nulled.add(column.name)
    }
    for (const name of nulled) this.record({ kind: 'NULL_INTO_NOT_NULL', object: `${target.relation!.name}.${name}`, relation: target.relation!.name, column: name, clause: 'update-set' })
    this.walk(update.whereClause, scope)
    return this.returning(update.returningList, scope)
  }

  private delete(del: Node, parent: Scope): string[] | null {
    const scope = new Scope(parent)
    this.withClause(del.withClause, scope)
    const target = this.target(del.relation, scope, 'delete')
    scope.bindings.push(target)
    if (target.relation) this.writes.push({ operation: 'DELETE', relation: qualified(target.relation) })
    else if (target.absent) this.writes.push({ operation: 'DELETE', relation: target.absent })
    for (const item of del.usingClause ?? []) this.fromItem(item, scope)
    this.walk(del.whereClause, scope)
    return this.returning(del.returningList, scope)
  }

  private merge(merge: Node, parent: Scope): string[] | null {
    const scope = new Scope(parent)
    this.withClause(merge.withClause, scope)
    const target = this.target(merge.relation, scope, 'merge')
    scope.bindings.push(target)
    if (target.relation) this.writes.push({ operation: 'MERGE', relation: qualified(target.relation) })
    this.fromItem(merge.sourceRelation, scope)
    this.walk(merge.joinCondition, scope)
    for (const wrapper of merge.mergeWhenClauses ?? []) {
      const clause = wrapper.MergeWhenClause
      this.walk(clause.condition, scope)
      for (const item of clause.targetList ?? []) this.checkColumn(target, item.ResTarget.name, clause.commandType === 'CMD_INSERT' ? 'merge-insert' : 'merge-update')
      for (const item of clause.targetList ?? []) this.walk(item.ResTarget.val, scope)
      this.walk(clause.values, scope)
    }
    return null
  }

  // ---- expressions ------------------------------------------------------------------------------------------------------------------------------

  private walk(node: unknown, scope: Scope, allowOutputs = false): void {
    if (node === null || node === undefined || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const child of node) this.walk(child, scope, allowOutputs)
      return
    }
    const entries = Object.entries(node as Node)
    if (entries.length === 1 && /^[A-Z]/.test(entries[0][0]) && entries[0][1] && typeof entries[0][1] === 'object') {
      this.typed(entries[0][0], entries[0][1] as Node, scope, allowOutputs)
      return
    }
    for (const [key, value] of entries) {
      if (key === 'lockingClause' || key === 'intoClause') continue
      this.walk(value, scope, allowOutputs)
    }
  }

  private typed(type: string, body: Node, scope: Scope, allowOutputs: boolean): void {
    switch (type) {
      case 'ColumnRef':
        this.columnRef(body, scope, allowOutputs)
        return
      case 'ParamRef':
        this.parameters = Math.max(this.parameters, body.number ?? 0)
        return
      case 'SubLink':
        this.walk(body.testexpr, scope)
        if (body.subselect?.SelectStmt) this.select(body.subselect.SelectStmt, scope)
        return
      case 'SelectStmt':
        this.select(body, scope)
        return
      case 'FuncCall':
        this.funcCall(body, scope)
        return
      case 'TypeCast':
        this.typeName(body.typeName, 'cast')
        this.walk(body.arg, scope)
        return
      case 'RangeVar':
        return
      case 'MultiAssignRef':
        this.walk(body.source, scope)
        return
      case 'ColumnDef':
        this.typeName(body.typeName, 'column-definition')
        return
      case 'InsertStmt':
      case 'UpdateStmt':
      case 'DeleteStmt':
      case 'MergeStmt':
        this.statement({ [type]: body }, scope)
        return
      default:
        for (const [key, value] of Object.entries(body)) {
          if (key === 'lockingClause') continue
          this.walk(value, scope, allowOutputs)
        }
    }
  }

  private typeName(typeName: Node | undefined, clause: string): void {
    if (!typeName || typeName.pct_type) return
    const parts = strings(typeName.names)
    const name = parts.at(-1)
    if (!name || isHole(name)) return
    const schema = parts.length > 1 ? parts.at(-2) : undefined
    if (!hasType(this.catalog, schema, name)) this.record({ kind: 'TYPE_ABSENT', object: schema ? `${schema}.${name}` : name, clause })
  }

  private funcCall(call: Node, scope: Scope): void {
    const parts = strings(call.funcname)
    const name = parts.at(-1)
    if (name && !isHole(name)) {
      const schema = parts.length > 1 ? parts.at(-2) : undefined
      // An ordered-set aggregate counts its WITHIN GROUP arguments in pg_proc.pronargs.
      const count = (call.args ?? []).length + (call.agg_within_group ? (call.agg_order ?? []).length : 0)
      const candidates = findFunctions(this.catalog, schema, name)
      const label = schema ? `${schema}.${name}` : name
      if (!candidates.length) this.record({ kind: 'FUNCTION_ABSENT', object: `${label}/${count}`, detail: `no function named ${label}` })
      // unnest(a, b) in FROM is the parser's shorthand for ROWS FROM (unnest(a), unnest(b)), so it has no pg_proc entry of that arity.
      else if (!(name === 'unnest' && count >= 1) && !candidates.some((candidate) => acceptsArgumentCount(candidate, count))) {
        this.record({ kind: 'FUNCTION_ARITY', object: `${label}/${count}`, detail: `${label} takes ${candidates.map((candidate) => (candidate.variadic ? `${candidate.minArgs}+` : candidate.minArgs === candidate.maxArgs ? `${candidate.maxArgs}` : `${candidate.minArgs}-${candidate.maxArgs}`)).join(' or ')} argument(s), ${count} given` })
      }
      const literal = (index: number): string | undefined => call.args?.[index]?.A_Const?.sval?.sval
      if (name === 'set_config' && literal(0)) this.gucWrites.add(literal(0)!)
      if (name === 'current_setting' && literal(0)) this.gucReads.add(literal(0)!)
    }
    this.walk(call.args, scope)
    this.walk(call.agg_filter, scope)
    this.walk(call.agg_order, scope)
    this.walk(call.over, scope)
  }

  private columnRef(ref: Node, scope: Scope, allowOutputs: boolean): void {
    const fields: Node[] = ref.fields ?? []
    const parts = fields.map((field) => (field.String ? (field.String.sval as string) : '*'))
    if (parts.some(isHole)) return
    if (parts.length === 1) return this.unqualified(parts[0], scope, allowOutputs)
    if (parts.length >= 2) {
      // schema.table.column and db.schema.table.column: the table is the part before the column.
      const alias = parts[parts.length - 2]
      const column = parts[parts.length - 1]
      for (let current: Scope | null = scope; current; current = current.parent) {
        const binding = current.bindings.find((candidate) => candidate.alias === alias && (parts.length < 3 || !candidate.relation || candidate.relation.schema === parts[parts.length - 3]))
        if (binding) {
          if (column === '*') return
          if (binding.absent) return this.expect(binding.absent, column)
          if (binding.columns === null || binding.columns.has(column) || SYSTEM_COLUMNS.has(column)) return
          if (binding.relation) this.record({ kind: 'COLUMN_ABSENT', object: `${binding.relation.name}.${column}`, relation: binding.relation.name, column, clause: 'reference' })
          else this.record({ kind: 'COLUMN_ABSENT', object: `${alias}.${column}`, relation: alias, column, clause: 'reference' })
          return
        }
      }
      this.record({ kind: 'ALIAS_UNRESOLVED', object: `${alias}.${column}`, relation: alias, column, detail: `missing FROM-clause entry for table "${alias}"` })
    }
  }

  private unqualified(column: string, scope: Scope, allowOutputs: boolean): void {
    if (column === '*' || isHole(column) || SYSTEM_COLUMNS.has(column)) return
    const inScope: Binding[] = []
    for (let current: Scope | null = scope; current; current = current.parent) {
      inScope.push(...current.bindings)
      if (current.bindings.some((binding) => binding.columns === null && !binding.absent) || current.bindings.some((binding) => binding.columns?.has(column))) return
    }
    if (allowOutputs && scope.outputs?.has(column)) return
    if (allowOutputs && scope.outputs === null) return
    // A table alias used as a whole-row reference.
    if (inScope.some((binding) => binding.alias === column)) return
    const absent = inScope.filter((binding) => binding.absent)
    if (absent.length) {
      for (const binding of absent) this.expect(binding.absent!, column)
      return
    }
    const relations = inScope.map((binding) => binding.relation?.name ?? binding.alias)
    if (!relations.length) {
      this.record({ kind: 'COLUMN_ABSENT', object: column, column, detail: 'no relation in scope', clause: 'reference', unqualified: true })
      return
    }
    this.record({ kind: 'COLUMN_ABSENT', object: `${relations.length === 1 ? relations[0] : relations.join('|')}.${column}`, relation: relations.join('|'), column, clause: 'reference', unqualified: true })
  }
}
