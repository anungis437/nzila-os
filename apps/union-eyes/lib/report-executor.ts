/**
 * Report Executor Module
 * 
 * Executes report configurations by generating and running SQL queries dynamically.
 * Supports joins, aggregations, filters, sorting, and custom formulas.
 * 
 * Created: December 5, 2025
 * Part of: Phase 2 - Enhanced Analytics & Reports
 * 
 * SECURITY: Uses safeIdentifier functions for all dynamic SQL identifiers
 * Updated: February 11, 2026 - P2 Security Enhancement
 */

import { sql, SQL } from 'drizzle-orm';
import { db } from '@/db/db';
import { safeTableName, safeColumnName, safeIdentifier } from '@/lib/safe-sql-identifiers';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ReportConfig {
  dataSourceId: string;
  fields: SelectedField[];
  joins?: JoinConfig[];
  filters?: FilterCondition[];
  groupBy?: string[];
  having?: FilterCondition[];
  sortBy?: SortRule[];
  limit?: number;
  offset?: number;
}

export interface SelectedField {
  fieldId: string;
  fieldName: string;
  table?: string;
  aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'count_distinct' | 'string_agg';
  alias?: string;
  formula?: string; // For calculated fields
}

export interface JoinConfig {
  table: string;
  type: 'inner' | 'left' | 'right' | 'full';
  on: {
    leftField: string;
    rightField: string;
    operator?: '=' | '!=' | '>' | '<' | '>=' | '<=';
  };
}

export interface FilterCondition {
  fieldId: string;
  fieldName?: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'like' | 'ilike' | 'in' | 'not_in' | 'is_null' | 'is_not_null' | 'between';
  value?: unknown;
  values?: unknown[];
  logicalOperator?: 'AND' | 'OR';
}

export interface FilterGroup {
  conditions: FilterCondition[];
  logicalOperator: 'AND' | 'OR';
}

export interface SortRule {
  fieldId: string;
  direction: 'asc' | 'desc';
  nulls?: 'first' | 'last';
}

export interface ExecutionResult {
  success: boolean;
  data?: unknown[];
  rowCount?: number;
  executionTimeMs: number;
  error?: string;
  sql?: string; // For debugging
}

export interface DataSourceMetadata {
  id: string;
  name: string;
  table: string;
  schema?: string;
  fields: FieldMetadata[];
  joinable?: string[];
}

export interface FieldMetadata {
  id: string;
  name: string;
  column: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'json';
  aggregatable: boolean;
  filterable: boolean;
  sortable: boolean;
  nullable: boolean;
}

// ============================================================================
// Data Source Metadata Registry
// ============================================================================

/**
 * Registry of available data sources with metadata
 */
export const DATA_SOURCES: DataSourceMetadata[] = [
  {
    id: 'claims',
    name: 'Claims',
    table: 'claims',
    fields: [
      { id: 'id', name: 'Claim ID', column: 'id', type: 'string', aggregatable: false, filterable: true, sortable: true, nullable: false },
      { id: 'claim_number', name: 'Claim Number', column: 'claim_number', type: 'string', aggregatable: false, filterable: true, sortable: true, nullable: false },
      { id: 'status', name: 'Status', column: 'status', type: 'string', aggregatable: true, filterable: true, sortable: true, nullable: false },
      { id: 'priority', name: 'Priority', column: 'priority', type: 'string', aggregatable: true, filterable: true, sortable: true, nullable: false },
      { id: 'claim_type', name: 'Type', column: 'claim_type', type: 'string', aggregatable: true, filterable: true, sortable: true, nullable: false },
      { id: 'created_at', name: 'Created Date', column: 'created_at', type: 'date', aggregatable: true, filterable: true, sortable: true, nullable: false },
      { id: 'resolved_at', name: 'Resolved Date', column: 'resolved_at', type: 'date', aggregatable: true, filterable: true, sortable: true, nullable: true },
      { id: 'member_id', name: 'Member ID', column: 'member_id', type: 'string', aggregatable: true, filterable: true, sortable: true, nullable: false },
      { id: 'assigned_to', name: 'Assigned To', column: 'assigned_to', type: 'string', aggregatable: true, filterable: true, sortable: true, nullable: true },
      { id: 'outcome', name: 'Outcome', column: 'outcome', type: 'string', aggregatable: true, filterable: true, sortable: true, nullable: true },
    ],
    joinable: ['organization_members', 'claim_deadlines', 'claim_notes'],
  },
  {
    id: 'organization_members',
    name: 'Members',
    table: 'organization_members',
    fields: [
      { id: 'id', name: 'Member ID', column: 'id', type: 'string', aggregatable: false, filterable: true, sortable: true, nullable: false },
      { id: 'first_name', name: 'First Name', column: 'first_name', type: 'string', aggregatable: false, filterable: true, sortable: true, nullable: false },
      { id: 'last_name', name: 'Last Name', column: 'last_name', type: 'string', aggregatable: false, filterable: true, sortable: true, nullable: false },
      { id: 'email', name: 'Email', column: 'email', type: 'string', aggregatable: false, filterable: true, sortable: true, nullable: false },
      { id: 'hire_date', name: 'Hire Date', column: 'hire_date', type: 'date', aggregatable: true, filterable: true, sortable: true, nullable: true },
      { id: 'role', name: 'Role', column: 'role', type: 'string', aggregatable: true, filterable: true, sortable: true, nullable: false },
      { id: 'status', name: 'Status', column: 'status', type: 'string', aggregatable: true, filterable: true, sortable: true, nullable: false },
      { id: 'created_at', name: 'Created Date', column: 'created_at', type: 'date', aggregatable: true, filterable: true, sortable: true, nullable: false },
    ],
    joinable: ['claims', 'dues_assignments'],
  },
  {
    id: 'claim_deadlines',
    name: 'Deadlines',
    table: 'claim_deadlines',
    fields: [
      { id: 'id', name: 'Deadline ID', column: 'id', type: 'string', aggregatable: false, filterable: true, sortable: true, nullable: false },
      { id: 'claim_id', name: 'Claim ID', column: 'claim_id', type: 'string', aggregatable: false, filterable: true, sortable: true, nullable: false },
      { id: 'deadline_type', name: 'Type', column: 'deadline_type', type: 'string', aggregatable: true, filterable: true, sortable: true, nullable: false },
      { id: 'current_deadline', name: 'Deadline Date', column: 'current_deadline', type: 'date', aggregatable: true, filterable: true, sortable: true, nullable: false },
      { id: 'status', name: 'Status', column: 'status', type: 'string', aggregatable: true, filterable: true, sortable: true, nullable: false },
      { id: 'priority', name: 'Priority', column: 'priority', type: 'string', aggregatable: true, filterable: true, sortable: true, nullable: false },
      { id: 'completed_at', name: 'Completed Date', column: 'completed_at', type: 'date', aggregatable: true, filterable: true, sortable: true, nullable: true },
    ],
    joinable: ['claims'],
  },
  {
    id: 'dues_assignments',
    name: 'Dues Assignments',
    table: 'dues_assignments',
    fields: [
      { id: 'id', name: 'Assignment ID', column: 'id', type: 'string', aggregatable: false, filterable: true, sortable: true, nullable: false },
      { id: 'member_id', name: 'Member ID', column: 'member_id', type: 'string', aggregatable: false, filterable: true, sortable: true, nullable: false },
      { id: 'amount', name: 'Amount', column: 'amount', type: 'number', aggregatable: true, filterable: true, sortable: true, nullable: false },
      { id: 'frequency', name: 'Frequency', column: 'frequency', type: 'string', aggregatable: true, filterable: true, sortable: true, nullable: false },
      { id: 'status', name: 'Status', column: 'status', type: 'string', aggregatable: true, filterable: true, sortable: true, nullable: false },
      { id: 'effective_date', name: 'Effective Date', column: 'effective_date', type: 'date', aggregatable: true, filterable: true, sortable: true, nullable: false },
      { id: 'end_date', name: 'End Date', column: 'end_date', type: 'date', aggregatable: true, filterable: true, sortable: true, nullable: true },
    ],
    joinable: ['organization_members'],
  },
];

// ============================================================================
// Report Executor Class
// ============================================================================

export class ReportExecutor {
  private organizationId: string;

  constructor(organizationId: string) {
    this.organizationId = organizationId;
  }

  /**
   * Execute a report configuration and return results
   */
  async execute(config: ReportConfig): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Validate configuration
      this.validateConfig(config);

      // Build SQL query from config
      const query = this.buildQuery(config);

      // Execute query
      const results = await db.execute(query);

      const executionTimeMs = Date.now() - startTime;

      return {
        success: true,
        data: results as unknown[],
        rowCount: results.length,
        executionTimeMs,
        sql: query.queryChunks.join(' '), // For debugging
      };
    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
return {
        success: false,
        executionTimeMs,
        error: error.message || 'Report execution failed',
      };
    }
  }

  /**
   * Validate report configuration
   */
  private validateConfig(config: ReportConfig): void {
    if (!config.dataSourceId) {
      throw new Error('Data source ID is required');
    }

    if (!config.fields || config.fields.length === 0) {
      throw new Error('At least one field must be selected');
    }

    const dataSource = DATA_SOURCES.find(ds => ds.id === config.dataSourceId);
    if (!dataSource) {
      throw new Error(`Invalid data source: ${config.dataSourceId}`);
    }

    // Validate fields exist in data source
    for (const field of config.fields) {
      // SECURITY FIX: Block custom formulas to prevent SQL injection
      if (field.formula) {
        throw new Error('Custom formulas are not supported for security reasons');
      }
      
      const fieldExists = dataSource.fields.some(f => f.id === field.fieldId);
      if (!fieldExists) {
        throw new Error(`Invalid field: ${field.fieldId}`);
      }
    }
  }

  /**
   * Build SQL query from report configuration
   */
  private buildQuery(config: ReportConfig): SQL {
    const dataSource = DATA_SOURCES.find(ds => ds.id === config.dataSourceId)!;
    const baseTable = dataSource.table;

    // Build SELECT clause
    const selectFields = this.buildSelectClause(config.fields, dataSource, config.groupBy);

    // Build FROM clause
    let fromClause = safeTableName(baseTable);

    // Build JOIN clauses
    if (config.joins && config.joins.length > 0) {
      fromClause = this.buildJoinClause(fromClause, config.joins);
    }

    // Build WHERE clause (filters)
    const whereConditions: SQL[] = [];
    
    // Add tenant/organization filter
    whereConditions.push(sql`${safeTableName(baseTable)}.organization_id = ${this.organizationId}`);

    if (config.filters && config.filters.length > 0) {
      const filterSQL = this.buildFilterClause(config.filters, dataSource);
      if (filterSQL) {
        whereConditions.push(filterSQL);
      }
    }

    // Build GROUP BY clause
    let groupByClause: SQL | null = null;
    if (config.groupBy && config.groupBy.length > 0) {
      groupByClause = this.buildGroupByClause(config.groupBy);
    }

    // Build HAVING clause
    let havingClause: SQL | null = null;
    if (config.having && config.having.length > 0) {
      havingClause = this.buildFilterClause(config.having, dataSource);
    }

    // Build ORDER BY clause
    let orderByClause: SQL | null = null;
    if (config.sortBy && config.sortBy.length > 0) {
      orderByClause = this.buildOrderByClause(config.sortBy);
    }

    // Build LIMIT/OFFSET clause
    const limit = config.limit || 1000; // Default limit
    const offset = config.offset || 0;

    // Assemble complete query
    let query = sql`SELECT ${selectFields} FROM ${fromClause}`;

    if (whereConditions.length > 0) {
      query = sql`${query} WHERE ${sql.join(whereConditions, sql` AND `)}`;
    }

    if (groupByClause) {
      query = sql`${query} GROUP BY ${groupByClause}`;
    }

    if (havingClause) {
      query = sql`${query} HAVING ${havingClause}`;
    }

    if (orderByClause) {
      query = sql`${query} ORDER BY ${orderByClause}`;
    }

    query = sql`${query} LIMIT ${limit} OFFSET ${offset}`;

    return query;
  }

  /**
   * Build SELECT clause with fields and aggregations
   */
  private buildSelectClause(
    fields: SelectedField[],
    dataSource: DataSourceMetadata,
    _groupBy?: string[]
  ): SQL {
    const fieldClauses: SQL[] = [];

    for (const field of fields) {
      let fieldSQL: SQL;

      // SECURITY: Custom formulas are blocked in validateConfig()
      // This defensive check should never trigger after validation
      if (field.formula) {
        throw new Error('Custom formulas are blocked for security. This should have been caught during validation.');
      }

      const fieldMeta = dataSource.fields.find(f => f.id === field.fieldId);
      if (!fieldMeta) continue;

      const columnName = field.table
        ? `${field.table}.${fieldMeta.column}`
        : fieldMeta.column;

      if (field.aggregation) {
        // Aggregated field
        switch (field.aggregation) {
          case 'count':
            fieldSQL = sql`COUNT(${safeColumnName(columnName)})`;
            break;
          case 'count_distinct':
            fieldSQL = sql`COUNT(DISTINCT ${safeColumnName(columnName)})`;
            break;
          case 'sum':
            fieldSQL = sql`SUM(${safeColumnName(columnName)})`;
            break;
          case 'avg':
            fieldSQL = sql`AVG(${safeColumnName(columnName)})`;
            break;
          case 'min':
            fieldSQL = sql`MIN(${safeColumnName(columnName)})`;
            break;
          case 'max':
            fieldSQL = sql`MAX(${safeColumnName(columnName)})`;
            break;
          case 'string_agg':
            fieldSQL = sql`STRING_AGG(${safeColumnName(columnName)}, ', ')`;
            break;
          default:
            fieldSQL = safeColumnName(columnName);
        }
      } else {
        // Regular field
        fieldSQL = safeColumnName(columnName);
      }

      // Add alias if provided
      if (field.alias) {
        // SECURITY FIX: Validate alias format (alphanumeric + underscore only)
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.alias)) {
          throw new Error(`Invalid alias format: ${field.alias}`);
        }
        fieldSQL = sql`${fieldSQL} AS ${safeIdentifier(field.alias)}`;
      } else if (field.aggregation) {
        fieldSQL = sql`${fieldSQL} AS ${safeIdentifier(`${field.fieldId}_${field.aggregation}`)}`;
      }

      fieldClauses.push(fieldSQL);
    }

    return sql.join(fieldClauses, sql`, `);
  }

  /**
   * Build JOIN clause
   */
  private buildJoinClause(fromClause: SQL, joins: JoinConfig[]): SQL {
    const ALLOWED_JOIN_TYPES = ['INNER', 'LEFT', 'RIGHT', 'FULL'];
    const ALLOWED_OPERATORS = ['=', '!=', '>', '<', '>=', '<='];
    
    let result = fromClause;

    for (const join of joins) {
      const joinType = join.type.toUpperCase();
      const operator = join.on.operator || '=';

      // SECURITY FIX: Validate join type
      if (!ALLOWED_JOIN_TYPES.includes(joinType)) {
        throw new Error(`Invalid join type: ${join.type}`);
      }

      // SECURITY FIX: Validate operator
      if (!ALLOWED_OPERATORS.includes(operator)) {
        throw new Error(`Invalid join operator: ${operator}`);
      }

      // SECURITY FIX: Validate table exists in DATA_SOURCES
      const tableExists = DATA_SOURCES.some(ds => ds.table === join.table);
      if (!tableExists) {
        throw new Error(`Invalid join table: ${join.table}`);
      }

      result = sql`${result} ${sql.raw(joinType)} JOIN ${safeTableName(join.table)} ON ${safeColumnName(join.on.leftField)} ${sql.raw(operator)} ${safeColumnName(join.on.rightField)}`;
    }

    return result;
  }

  /**
   * Build WHERE/HAVING filter clause
   * 
   * SECURITY: Properly handles OR operators with parameterized queries
   * to prevent SQL injection vulnerabilities.
   */
  private buildFilterClause(
    filters: FilterCondition[],
    _dataSource: DataSourceMetadata
  ): SQL | null {
    if (filters.length === 0) return null;

    const conditions: SQL[] = [];
    let currentGroupConditions: SQL[] = [];
    let currentGroupOperator: 'AND' | 'OR' = 'AND';

    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      const fieldName = filter.fieldName || filter.fieldId;
      let condition: SQL;

      // Build individual condition with proper parameterization
      switch (filter.operator) {
        case 'eq':
          condition = sql`${safeColumnName(fieldName)} = ${filter.value}`;
          break;
        case 'ne':
          condition = sql`${safeColumnName(fieldName)} != ${filter.value}`;
          break;
        case 'gt':
          condition = sql`${safeColumnName(fieldName)} > ${filter.value}`;
          break;
        case 'lt':
          condition = sql`${safeColumnName(fieldName)} < ${filter.value}`;
          break;
        case 'gte':
          condition = sql`${safeColumnName(fieldName)} >= ${filter.value}`;
          break;
        case 'lte':
          condition = sql`${safeColumnName(fieldName)} <= ${filter.value}`;
          break;
        case 'like':
          condition = sql`${safeColumnName(fieldName)} LIKE ${`%${filter.value}%`}`;
          break;
        case 'ilike':
          condition = sql`${safeColumnName(fieldName)} ILIKE ${`%${filter.value}%`}`;
          break;
        case 'in':
          condition = sql`${safeColumnName(fieldName)} IN (${sql.join(filter.values!.map((v: unknown) => sql`${v}`), sql`, `)})`;
          break;
        case 'not_in':
          condition = sql`${safeColumnName(fieldName)} NOT IN (${sql.join(filter.values!.map((v: unknown) => sql`${v}`), sql`, `)})`;
          break;
        case 'is_null':
          condition = sql`${safeColumnName(fieldName)} IS NULL`;
          break;
        case 'is_not_null':
          condition = sql`${safeColumnName(fieldName)} IS NOT NULL`;
          break;
        case 'between':
          condition = sql`${safeColumnName(fieldName)} BETWEEN ${filter.values![0]} AND ${filter.values![1]}`;
          break;
        default:
          continue;
      }

      // Handle logical operator transitions
      const nextOperator = filter.logicalOperator || 'AND';
      
      if (i === 0) {
        currentGroupOperator = nextOperator;
        currentGroupConditions.push(condition);
      } else if (nextOperator === currentGroupOperator) {
        currentGroupConditions.push(condition);
      } else {
        // Operator changed - close current group and start new one
        if (currentGroupConditions.length > 0) {
          const groupSql = currentGroupOperator === 'OR'
            ? sql.join(currentGroupConditions, sql` OR `)
            : sql.join(currentGroupConditions, sql` AND `);
          conditions.push(sql`(${groupSql})`);
        }
        currentGroupConditions = [condition];
        currentGroupOperator = nextOperator;
      }
    }

    // Add remaining group
    if (currentGroupConditions.length > 0) {
      const groupSql = currentGroupOperator === 'OR'
        ? sql.join(currentGroupConditions, sql` OR `)
        : sql.join(currentGroupConditions, sql` AND `);
      conditions.push(currentGroupConditions.length === 1 ? currentGroupConditions[0] : sql`(${groupSql})`);
    }

    if (conditions.length === 0) return null;

    // Join all groups with AND (groups themselves may contain OR logic)
    return conditions.length === 1 ? conditions[0] : sql.join(conditions, sql` AND `);
  }

  /**
   * Build GROUP BY clause
   */
  private buildGroupByClause(groupBy: string[]): SQL {
    return sql.join(
      groupBy.map(field => safeColumnName(field)),
      sql`, `
    );
  }

  /**
   * Build ORDER BY clause
   */
  private buildOrderByClause(sortBy: SortRule[]): SQL {
    const orderClauses: SQL[] = [];

    for (const sort of sortBy) {
      let orderSQL = safeColumnName(sort.fieldId);

      if (sort.direction === 'desc') {
        orderSQL = sql`${orderSQL} DESC`;
      } else {
        orderSQL = sql`${orderSQL} ASC`;
      }

      if (sort.nulls) {
        const nullsDir = sort.nulls.toUpperCase();
        if (nullsDir !== 'FIRST' && nullsDir !== 'LAST') {
          throw new Error(`Invalid nulls direction: ${sort.nulls}`);
        }
        orderSQL = sql`${orderSQL} NULLS ${sql.raw(nullsDir)}`;
      }

      orderClauses.push(orderSQL);
    }

    return sql.join(orderClauses, sql`, `);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get data source metadata by ID
 */
export function getDataSource(dataSourceId: string): DataSourceMetadata | undefined {
  return DATA_SOURCES.find(ds => ds.id === dataSourceId);
}

/**
 * Get all available data sources
 */
export function getAllDataSources(): DataSourceMetadata[] {
  return DATA_SOURCES;
}

/**
 * Validate field exists in data source
 */
export function validateField(dataSourceId: string, fieldId: string): boolean {
  const dataSource = getDataSource(dataSourceId);
  if (!dataSource) return false;

  return dataSource.fields.some(f => f.id === fieldId);
}

/**
 * Get field metadata
 */
export function getFieldMetadata(
  dataSourceId: string,
  fieldId: string
): FieldMetadata | undefined {
  const dataSource = getDataSource(dataSourceId);
  if (!dataSource) return undefined;

  return dataSource.fields.find(f => f.id === fieldId);
}

